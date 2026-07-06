import {
  transcript as demoTranscript,
  evidence as demoEvidence,
  claims as demoClaims,
  mockUsers,
  type Session,
} from "@/lib/mock-data";
import type { SessionRow, CaseRow } from "@/lib/cases.functions";

/**
 * Bridges a real database session row to the UI's `Session` shape.
 *
 * Transcript, evidence and AI claims move to their own tables in later phases.
 * Until then, the demo session shows the seeded demo content so the prototype
 * experience is preserved, while freshly created sessions start empty.
 */
export function buildSessionView(row: SessionRow): Session {
  const content = row.is_demo
    ? { transcript: demoTranscript, evidence: demoEvidence, claims: demoClaims }
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
