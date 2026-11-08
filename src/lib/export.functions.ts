import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TranscriptSegmentRow } from "@/lib/transcript.functions";

export interface ExportRecording {
  id: string;
  createdAt: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  mime: string | null;
  checksum: string | null;
  status: string;
  downloadable: boolean;
}

export interface SessionExportManifest {
  session: {
    id: string;
    title: string;
    date: string | null;
    status: string;
    caseId: string;
    caseTitle: string | null;
    caseReference: string | null;
  };
  transcript: TranscriptSegmentRow[];
  recordings: ExportRecording[];
  exportedAt: string;
  exportedBy: string;
  notice: string;
}

export const EXPORT_NOTICE =
  "AI-assisted output. This bundle is a working record, not a certified court transcript. Verify all content against the source audio before legal use.";

/**
 * Collects everything needed to build a session export bundle in the browser:
 * session/case metadata and ordered transcript segments. RLS scopes every read
 * to session members; audio is fetched separately through the authenticated
 * media route so no reusable storage URL leaves the server.
 */
export const getSessionExportManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SessionExportManifest> => {
    const { supabase, userId } = context;

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, title, date, status, case_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sessionErr) throw sessionErr;
    if (!session) throw new Error("Session not found or not accessible.");

    const [{ data: caseRow }, { data: segments, error: segErr }, { data: recordings, error: recErr }] =
      await Promise.all([
        supabase.from("cases").select("title, reference").eq("id", session.case_id).maybeSingle(),
        supabase
          .from("transcript_segments")
          .select("*")
          .eq("session_id", data.sessionId)
          .order("start_ms", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("recordings")
          .select("id, created_at, duration_seconds, size_bytes, mime, checksum, status, storage_path")
          .eq("session_id", data.sessionId)
          .order("created_at", { ascending: true }),
      ]);
    if (segErr) throw segErr;
    if (recErr) throw recErr;

    const exported: ExportRecording[] = (recordings ?? []).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        durationSeconds: r.duration_seconds,
        sizeBytes: r.size_bytes,
        mime: r.mime,
        checksum: r.checksum,
        status: r.status,
        downloadable: Boolean(r.storage_path),
      }));

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      case_id: session.case_id,
      session_id: session.id,
      action: "session.exported",
      detail: { recordings: exported.length, segments: (segments ?? []).length },
    });

    return {
      session: {
        id: session.id,
        title: session.title,
        date: session.date,
        status: session.status,
        caseId: session.case_id,
        caseTitle: caseRow?.title ?? null,
        caseReference: caseRow?.reference ?? null,
      },
      transcript: (segments ?? []) as TranscriptSegmentRow[],
      recordings: exported,
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      notice: EXPORT_NOTICE,
    };
  });
