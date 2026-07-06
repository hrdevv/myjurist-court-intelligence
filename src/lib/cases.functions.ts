import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CaseRow {
  id: string;
  title: string;
  reference: string;
  court: string | null;
  status: string;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  case_id: string;
  title: string;
  date: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  activeCases: number;
  sessionsPendingReview: number;
  unsupportedClaims: number;
  reportsReady: number;
}

/** All cases the signed-in user may see (demo + owned + member-of), newest first. */
export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaseRow[]> => {
    const { data, error } = await context.supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CaseRow[];
  });

/** A single case plus its sessions, or null if not visible to the caller. */
export const getCaseDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(
    async ({ data, context }): Promise<{ caseData: CaseRow; sessions: SessionRow[] } | null> => {
      const { supabase } = context;
      const { data: caseData, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw error;
      if (!caseData) return null;

      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("case_id", data.id)
        .order("date", { ascending: false });
      if (sErr) throw sErr;

      return { caseData: caseData as CaseRow, sessions: (sessions ?? []) as SessionRow[] };
    },
  );

/** Create a case, add the creator as a member, and record an audit entry. */
export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; reference: string; court?: string }) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        reference: z.string().trim().min(1).max(100),
        court: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<CaseRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cases")
      .insert({
        title: data.title,
        reference: data.reference,
        court: data.court ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("case_members")
      .insert({ case_id: row.id, user_id: userId, role: "lawyer" });

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      case_id: row.id,
      action: "case.created",
      detail: { title: data.title, reference: data.reference },
    });

    return row as CaseRow;
  });

/** Aggregate counts for the dashboard, scoped by RLS to the caller's cases. */
export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardMetrics> => {
    const { supabase } = context;

    const [{ count: activeCases }, { count: sessionsPendingReview }] = await Promise.all([
      supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "review_pending"),
    ]);

    return {
      activeCases: activeCases ?? 0,
      sessionsPendingReview: sessionsPendingReview ?? 0,
      // Claim/report metrics are wired in later phases (claims & reports tables).
      unsupportedClaims: 0,
      reportsReady: 0,
    };
  });
