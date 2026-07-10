import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TranscriptSegmentRow {
  id: string;
  session_id: string;
  start_ms: number | null;
  end_ms: number | null;
  timestamp_label: string | null;
  speaker: string;
  text: string;
  confidence: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TranscriptVersionRow {
  id: string;
  segment_id: string;
  version: number;
  text: string;
  edited_by: string | null;
  created_at: string;
}

/** Transcript segments for a session, ordered by time. RLS scopes to members. */
export const listTranscript = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<TranscriptSegmentRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("transcript_segments")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("start_ms", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as TranscriptSegmentRow[];
  });

const pastedLine = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+)?(?:([^:]{1,40}):\s*)?(.+)$/;

function labelToMs(label: string | null): number | null {
  if (!label) return null;
  const parts = label.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  const [a, b, c] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return ((a * 60 + b) * 60 + c) * 1000;
}

/**
 * Parses pasted transcript text into ordered segments and replaces the
 * session's existing transcript. Each line may be prefixed with `[hh:mm:ss]`
 * and/or `Speaker:`. Records a version row per created segment and an audit log.
 */
export const saveTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; text: string }) =>
    z.object({ sessionId: z.string().uuid(), text: z.string().max(100_000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<TranscriptSegmentRow[]> => {
    const { supabase, userId } = context;

    const lines = data.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      const m = pastedLine.exec(line);
      const label = m?.[1] ?? null;
      const speaker = m?.[2]?.trim() || "Speaker";
      const text = (m?.[3] ?? line).trim();
      return { label, speaker, text };
    });

    // Replace existing transcript for this session.
    const { error: delErr } = await supabase
      .from("transcript_segments")
      .delete()
      .eq("session_id", data.sessionId);
    if (delErr) throw delErr;

    if (parsed.length === 0) {
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        session_id: data.sessionId,
        action: "transcript.cleared",
        detail: {},
      });
      return [];
    }

    const rowsToInsert = parsed.map((p) => ({
      session_id: data.sessionId,
      timestamp_label: p.label,
      start_ms: labelToMs(p.label),
      speaker: p.speaker,
      text: p.text,
      confidence: "medium",
      version: 1,
      created_by: userId,
    }));

    const { data: inserted, error } = await supabase
      .from("transcript_segments")
      .insert(rowsToInsert)
      .select("*");
    if (error) throw error;

    const versions = (inserted ?? []).map((r) => ({
      segment_id: r.id,
      version: r.version,
      text: r.text,
      edited_by: userId,
    }));
    if (versions.length > 0) {
      await supabase.from("transcript_versions").insert(versions);
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: data.sessionId,
      action: "transcript.saved",
      detail: { segments: rowsToInsert.length },
    });

    const sorted = ([...(inserted ?? [])] as TranscriptSegmentRow[]).sort(
      (a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0),
    );
    return sorted;
  });

/**
 * Edits a single segment's text, bumping its version and recording the new
 * version in the edit history. RLS scopes the write to session members.
 */
export const updateSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { segmentId: string; text: string; speaker?: string }) =>
    z
      .object({
        segmentId: z.string().uuid(),
        text: z.string().trim().min(1).max(5000),
        speaker: z.string().trim().min(1).max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<TranscriptSegmentRow> => {
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("transcript_segments")
      .select("id, session_id, version")
      .eq("id", data.segmentId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!current) throw new Error("Transcript segment not found.");

    const nextVersion = current.version + 1;

    const { data: updated, error } = await supabase
      .from("transcript_segments")
      .update({
        text: data.text,
        speaker: data.speaker,
        version: nextVersion,
      })
      .eq("id", data.segmentId)
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("transcript_versions").insert({
      segment_id: data.segmentId,
      version: nextVersion,
      text: data.text,
      edited_by: userId,
    });

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: current.session_id,
      action: "transcript.segment_edited",
      detail: { segment_id: data.segmentId, version: nextVersion },
    });

    return updated as TranscriptSegmentRow;
  });

/** Full edit history for a transcript segment, newest first. */
export const getSegmentVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { segmentId: string }) =>
    z.object({ segmentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<TranscriptVersionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("transcript_versions")
      .select("*")
      .eq("segment_id", data.segmentId)
      .order("version", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as TranscriptVersionRow[];
  });

const RECORDINGS_BUCKET = "recordings";

const EXT_BY_MIME: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/webm": "webm",
};

function msToLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Splits transcript text into sentence-sized segments. */
function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
  return (matches ?? [cleaned]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Transcribes a stored recording via Lovable AI speech-to-text, then replaces
 * the session's transcript with the resulting segments and records a version
 * row for each. Timestamps are distributed across the recording's duration.
 */
export const transcribeRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { recordingId: string }) =>
    z.object({ recordingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<TranscriptSegmentRow[]> => {
    const { supabase, userId } = context;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI transcription is not configured.");

    const { data: recording, error: recErr } = await supabase
      .from("recordings")
      .select("id, session_id, storage_path, mime, duration_seconds")
      .eq("id", data.recordingId)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!recording?.storage_path) {
      throw new Error("This recording has no stored audio file.");
    }

    await supabase
      .from("recordings")
      .update({ status: "transcribing" })
      .eq("id", data.recordingId);

    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from(RECORDINGS_BUCKET)
        .download(recording.storage_path);
      if (dlErr || !blob) throw dlErr ?? new Error("Could not download the recording.");

      const mime = recording.mime ?? "audio/wav";
      const ext = EXT_BY_MIME[mime.split(";")[0]] ?? "wav";

      const form = new FormData();
      form.append("model", "openai/gpt-4o-transcribe");
      form.append("file", blob, `recording.${ext}`);

      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Transcription rate limit reached. Please retry shortly.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
        throw new Error(`Transcription failed (${res.status}). ${body}`.trim());
      }

      const json = (await res.json()) as { text?: string };
      const fullText = (json.text ?? "").trim();
      const sentences = splitIntoSentences(fullText);

      // Replace any existing transcript for this session.
      const { error: delErr } = await supabase
        .from("transcript_segments")
        .delete()
        .eq("session_id", recording.session_id);
      if (delErr) throw delErr;

      if (sentences.length === 0) {
        await supabase
          .from("recordings")
          .update({ status: "transcribed" })
          .eq("id", data.recordingId);
        await supabase.from("audit_logs").insert({
          actor_id: userId,
          session_id: recording.session_id,
          action: "transcript.transcribed",
          detail: { recording_id: data.recordingId, segments: 0 },
        });
        return [];
      }

      const durationMs =
        recording.duration_seconds != null ? Math.round(recording.duration_seconds * 1000) : null;
      const perSegment = durationMs != null ? durationMs / sentences.length : null;

      const rowsToInsert = sentences.map((text, i) => {
        const startMs = perSegment != null ? Math.round(perSegment * i) : null;
        const endMs = perSegment != null ? Math.round(perSegment * (i + 1)) : null;
        return {
          session_id: recording.session_id,
          timestamp_label: startMs != null ? msToLabel(startMs) : null,
          start_ms: startMs,
          end_ms: endMs,
          speaker: "Speaker",
          text,
          confidence: "high",
          version: 1,
          created_by: userId,
        };
      });

      const { data: inserted, error: insErr } = await supabase
        .from("transcript_segments")
        .insert(rowsToInsert)
        .select("*");
      if (insErr) throw insErr;

      const versions = (inserted ?? []).map((r) => ({
        segment_id: r.id,
        version: r.version,
        text: r.text,
        edited_by: userId,
      }));
      if (versions.length > 0) {
        await supabase.from("transcript_versions").insert(versions);
      }

      await supabase
        .from("recordings")
        .update({ status: "transcribed" })
        .eq("id", data.recordingId);

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        session_id: recording.session_id,
        action: "transcript.transcribed",
        detail: { recording_id: data.recordingId, segments: rowsToInsert.length },
      });

      const sorted = ([...(inserted ?? [])] as TranscriptSegmentRow[]).sort(
        (a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0),
      );
      return sorted;
    } catch (err) {
      await supabase
        .from("recordings")
        .update({ status: "failed" })
        .eq("id", data.recordingId);
      throw err;
    }
  });
