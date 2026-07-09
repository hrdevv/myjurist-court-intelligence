import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const RECORDINGS_BUCKET = "recordings";

export interface RecordingRow {
  id: string;
  session_id: string;
  storage_path: string | null;
  duration_seconds: number | null;
  mime: string | null;
  size_bytes: number | null;
  checksum: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Recordings for a session, newest first. RLS scopes to session members. */
export const listRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<RecordingRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("recordings")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as RecordingRow[];
  });

/**
 * Records recording metadata after the client has uploaded the audio file to
 * the private `recordings` bucket. RLS enforces the caller is a session member.
 */
export const recordRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sessionId: string;
      storagePath: string;
      durationSeconds: number;
      mime: string;
      sizeBytes: number;
      checksum: string;
    }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          storagePath: z.string().trim().min(1).max(500),
          durationSeconds: z.number().nonnegative(),
          mime: z.string().trim().min(1).max(100),
          sizeBytes: z.number().int().positive(),
          checksum: z.string().trim().min(1).max(200),
        })
        .parse(data),
  )
  .handler(async ({ data, context }): Promise<RecordingRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("recordings")
      .insert({
        session_id: data.sessionId,
        storage_path: data.storagePath,
        duration_seconds: data.durationSeconds,
        mime: data.mime,
        size_bytes: data.sizeBytes,
        checksum: data.checksum,
        status: "uploaded",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: data.sessionId,
      action: "recording.created",
      detail: {
        duration_seconds: data.durationSeconds,
        size_bytes: data.sizeBytes,
        checksum: data.checksum,
      },
    });

    return row as RecordingRow;
  });

/** Mints a short-lived signed URL for playback/download of a stored recording. */
export const getRecordingSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { recordingId: string }) =>
    z.object({ recordingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("recordings")
      .select("storage_path")
      .eq("id", data.recordingId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.storage_path) {
      throw new Error("This recording has no stored file.");
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(row.storage_path, 3600);
    if (signErr || !signed?.signedUrl) {
      throw signErr ?? new Error("Could not create a playback link.");
    }
    return { url: signed.signedUrl };
  });

/** Removes a recording row (and its stored file) for a session member. */
export const deleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { recordingId: string }) =>
    z.object({ recordingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("recordings")
      .select("id, session_id, storage_path")
      .eq("id", data.recordingId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { ok: true };

    if (row.storage_path) {
      await supabase.storage.from(RECORDINGS_BUCKET).remove([row.storage_path]);
    }

    const { error: delErr } = await supabase
      .from("recordings")
      .delete()
      .eq("id", data.recordingId);
    if (delErr) throw delErr;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: row.session_id,
      action: "recording.deleted",
      detail: {},
    });

    return { ok: true };
  });
