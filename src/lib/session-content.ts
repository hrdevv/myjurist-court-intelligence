import {
  transcript as demoTranscript,
  evidence as demoEvidence,
  mockUsers,
  type Session,
} from "@/lib/mock-data";
import type { SessionRow, CaseRow } from "@/lib/cases.functions";

/**
 * Bridges a real database session row to the UI's `Session` shape.
 *
 * Transcript and evidence move through their own tables in later phases. Claims
 * are loaded from persisted `ai_claims` rows by the route loaders that need
 * legal-output data.
 */
export function buildSessionView(row: SessionRow): Session {
  const content = row.is_demo
    ? { transcript: demoTranscript, evidence: demoEvidence, claims: [] }
    : { transcript: [], evidence: [], claims: [] };

  return {
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    date: row.date ?? "",
    status: (row.status as Session["status"]) ?? "draft",
    ...content,
  };
}

/** Team members shown on the case detail Team tab (real membership arrives with team management). */
export function teamForCase(caseData: Pick<CaseRow, "is_demo">) {
  if (caseData.is_demo) {
    return mockUsers.slice(0, 4).map((u) => ({ name: u.name, role: u.role, email: u.email }));
  }
  return [] as { name: string; role: string; email: string }[];
}
