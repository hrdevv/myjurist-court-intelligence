import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SessionRow } from "@/lib/cases.functions";

/** Sessions belonging to a case, newest first. */
export const listSessionsByCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string }) =>
    z.object({ caseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SessionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("case_id", data.caseId)
      .order("date", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as SessionRow[];
  });

/** A single session's metadata, or null if not visible to the caller. */
export const getSessionById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<SessionRow | null> => {
    const { data: row, error } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return (row ?? null) as SessionRow | null;
  });

/** Create a session under a case and record an audit entry. */
export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; title: string; date?: string }) =>
    z
      .object({
        caseId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SessionRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("sessions")
      .insert({
        case_id: data.caseId,
        title: data.title,
        date: data.date ?? null,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      case_id: data.caseId,
      session_id: row.id,
      action: "session.created",
      detail: { title: data.title },
    });

    return row as SessionRow;
  });
