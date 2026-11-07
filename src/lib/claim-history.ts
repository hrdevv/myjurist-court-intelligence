export interface ReviewHistoryEntry {
  id: string;
  actorId: string | null;
  review: string;
  note: string | null;
  createdAt: string;
}

export interface AuditLogLike {
  id: string;
  actor_id: string | null;
  action: string;
  detail: unknown;
  created_at: string;
}

/** Review decisions for one claim, newest first. Ignores other claims and actions. */
export function buildReviewHistory(
  logs: readonly AuditLogLike[],
  claimId: string,
): ReviewHistoryEntry[] {
  return logs
    .filter((log) => {
      const d = log.detail as { claim_id?: unknown } | null;
      return log.action === "claim.reviewed" && d?.claim_id === claimId;
    })
    .map((log) => {
      const d = log.detail as { review?: unknown; reviewer_note?: unknown };
      return {
        id: log.id,
        actorId: log.actor_id,
        review: typeof d.review === "string" ? d.review : "unknown",
        note: typeof d.reviewer_note === "string" ? d.reviewer_note : null,
        createdAt: log.created_at,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
