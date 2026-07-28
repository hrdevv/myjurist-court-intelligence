import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AIClaim, ClaimAnchor, ClaimType, ConfidenceLevel, ReviewStatus } from "@/lib/mock-data";

type SupabaseLike = {
  // The generated Supabase types are updated separately from migrations in this
  // repo; use a narrow compatibility shim for newly-added claim tables.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type ClaimRow = {
  id: string;
  session_id: string;
  type: string;
  text: string;
  confidence: string;
  support: string;
  review: string;
  reviewer_note: string | null;
  warning: string | null;
};

type AnchorRow = {
  claim_id: string;
  segment_id: string | null;
  status: string;
};

type SegmentRow = {
  id: string;
  timestamp_label: string | null;
  speaker: string;
  text: string;
  confidence: "high" | "medium" | "low" | string;
  version: number;
};

const sessionSchema = z.object({ sessionId: z.string().uuid() });
const updateReviewSchema = z.object({
  claimId: z.string().uuid(),
  review: z.enum(["pending", "approved", "rejected", "uncertain", "needs_more_evidence"]),
  reviewerNote: z.string().max(4000).optional(),
});

function asClaim(row: ClaimRow, anchors: ClaimAnchor[]): AIClaim {
  return {
    id: row.id,
    type: row.type as ClaimType,
    text: row.text,
    confidence: row.confidence as ConfidenceLevel,
    support: row.support as AIClaim["support"],
    anchors,
    review: row.review as ReviewStatus,
    reviewerNote: row.reviewer_note ?? undefined,
    warning: row.warning ?? undefined,
  };
}

async function loadAnchors(db: SupabaseLike, claimIds: string[]): Promise<Map<string, ClaimAnchor[]>> {
  const byClaim = new Map<string, ClaimAnchor[]>();
  if (claimIds.length === 0) return byClaim;

  const { data: anchors, error } = await db
    .from("claim_anchors")
    .select("claim_id, segment_id, status")
    .in("claim_id", claimIds)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (anchors ?? []) as AnchorRow[];
  const segmentIds = [...new Set(rows.map((a) => a.segment_id).filter(Boolean))] as string[];
  const segmentsById = new Map<string, SegmentRow>();

  if (segmentIds.length > 0) {
    const { data: segments, error: segmentError } = await db
      .from("transcript_segments")
      .select("id, timestamp_label, speaker, text, confidence, version")
      .in("id", segmentIds);
    if (segmentError) throw segmentError;
    for (const segment of (segments ?? []) as SegmentRow[]) {
      segmentsById.set(segment.id, segment);
    }
  }

  for (const anchor of rows) {
    const segment = anchor.segment_id ? segmentsById.get(anchor.segment_id) : undefined;
    const item: ClaimAnchor = {
      segmentId: anchor.segment_id ?? "",
      status: anchor.status as ClaimAnchor["status"],
      transcript: segment
        ? {
            id: segment.id,
            timestamp: segment.timestamp_label ?? "",
            speaker: segment.speaker,
            text: segment.text,
            confidence: segment.confidence as "high" | "medium" | "low",
            version: segment.version,
          }
        : undefined,
    };
    byClaim.set(anchor.claim_id, [...(byClaim.get(anchor.claim_id) ?? []), item]);
  }

  return byClaim;
}

export const listClaimsBySession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => sessionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseLike;
    const { data: rows, error } = await db
      .from("ai_claims")
      .select("id, session_id, type, text, confidence, support, review, reviewer_note, warning")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const claimRows = (rows ?? []) as ClaimRow[];
    const anchorsByClaim = await loadAnchors(db, claimRows.map((row) => row.id));
    return claimRows.map((row) => asClaim(row, anchorsByClaim.get(row.id) ?? []));
  });

export const listReviewClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as SupabaseLike;
    const { data: rows, error } = await db
      .from("ai_claims")
      .select("id, session_id, type, text, confidence, support, review, reviewer_note, warning, sessions!inner(title)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const claimRows = (rows ?? []) as (ClaimRow & { sessions?: { title?: string } })[];
    const anchorsByClaim = await loadAnchors(db, claimRows.map((row) => row.id));
    return claimRows.map((row) => ({
      ...asClaim(row, anchorsByClaim.get(row.id) ?? []),
      sessionId: row.session_id,
      sessionTitle: row.sessions?.title ?? "Session",
    }));
  });

export const updateClaimReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { claimId: string; review: ReviewStatus; reviewerNote?: string }) =>
    updateReviewSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseLike;
    const { data: existing, error: loadError } = await db
      .from("ai_claims")
      .select("id, session_id")
      .eq("id", data.claimId)
      .single();
    if (loadError) throw loadError;

    const { data: updated, error } = await db
      .from("ai_claims")
      .update({
        review: data.review,
        reviewer_note: data.reviewerNote ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.claimId)
      .select("id, session_id, type, text, confidence, support, review, reviewer_note, warning")
      .single();
    if (error) throw error;

    await db.from("audit_logs").insert({
      actor_id: context.userId,
      session_id: existing.session_id,
      action: "claim.reviewed",
      detail: { claim_id: data.claimId, review: data.review },
    });

    const anchorsByClaim = await loadAnchors(db, [data.claimId]);
    return asClaim(updated as ClaimRow, anchorsByClaim.get(data.claimId) ?? []);
  });
