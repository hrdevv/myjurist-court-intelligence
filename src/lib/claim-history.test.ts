import { describe, expect, it } from "vitest";
import { buildReviewHistory } from "./claim-history";

describe("buildReviewHistory", () => {
  it("keeps only review entries for the given claim, newest first", () => {
    const logs = [
      { id: "1", actor_id: "u", action: "claim.reviewed", detail: { claim_id: "A", review: "rejected" }, created_at: "2026-01-01T00:00:00Z" },
      { id: "2", actor_id: "u", action: "claim.reviewed", detail: { claim_id: "B", review: "approved" }, created_at: "2026-01-02T00:00:00Z" },
      { id: "3", actor_id: "u", action: "evidence.uploaded", detail: { claim_id: "A" }, created_at: "2026-01-03T00:00:00Z" },
      { id: "4", actor_id: "u", action: "claim.reviewed", detail: { claim_id: "A", review: "approved", reviewer_note: "ok" }, created_at: "2026-01-04T00:00:00Z" },
    ];
    const history = buildReviewHistory(logs, "A");
    expect(history.map((h) => h.id)).toEqual(["4", "1"]);
    expect(history[0].note).toBe("ok");
  });
});
