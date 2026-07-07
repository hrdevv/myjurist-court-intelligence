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
