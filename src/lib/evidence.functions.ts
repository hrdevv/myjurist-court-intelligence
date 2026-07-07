import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const EVIDENCE_BUCKET = "evidence";

export interface EvidenceRow {
  id: string;
  session_id: string;
  name: string;
  type: string;
  storage_path: string | null;
  size_bytes: number | null;
  checksum: string | null;
  description: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const evidenceType = z.enum(["audio", "document", "image", "video"]);

/** Evidence files for a session, newest first. RLS scopes to session members. */
export const listEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<EvidenceRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("evidence")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as EvidenceRow[];
  });

/**
 * Records evidence metadata after the client has uploaded the file to the
 * private `evidence` bucket. RLS enforces that the caller is a session member.
 */
export const recordEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sessionId: string;
      name: string;
      type: string;
      storagePath: string;
      sizeBytes: number;
      checksum: string;
      description?: string;
    }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          name: z.string().trim().min(1).max(255),
          type: evidenceType,
          storagePath: z.string().trim().min(1).max(500),
          sizeBytes: z.number().int().nonnegative(),
          checksum: z.string().trim().min(1).max(200),
          description: z.string().trim().max(500).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }): Promise<EvidenceRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("evidence")
      .insert({
        session_id: data.sessionId,
        name: data.name,
        type: data.type,
        storage_path: data.storagePath,
        size_bytes: data.sizeBytes,
        checksum: data.checksum,
        description: data.description ?? null,
        status: "uploaded",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: data.sessionId,
      action: "evidence.uploaded",
      detail: { name: data.name, type: data.type, checksum: data.checksum },
    });

    return row as EvidenceRow;
  });

/** Mints a short-lived signed download URL for a stored evidence file. */
export const getEvidenceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { evidenceId: string }) =>
    z.object({ evidenceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("evidence")
      .select("storage_path")
      .eq("id", data.evidenceId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.storage_path) {
      throw new Error("This evidence item has no downloadable file.");
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(row.storage_path, 300);
    if (signErr || !signed?.signedUrl) {
      throw signErr ?? new Error("Could not create a download link.");
    }
    return { url: signed.signedUrl };
  });

/** Removes an evidence row (and its stored file) for a session member. */
export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { evidenceId: string }) =>
    z.object({ evidenceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("evidence")
      .select("id, session_id, name, storage_path")
      .eq("id", data.evidenceId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { ok: true };

    if (row.storage_path) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove([row.storage_path]);
    }

    const { error: delErr } = await supabase.from("evidence").delete().eq("id", data.evidenceId);
    if (delErr) throw delErr;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: row.session_id,
      action: "evidence.deleted",
      detail: { name: row.name },
    });

    return { ok: true };
  });
