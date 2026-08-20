import type { ReactElement } from "react";
import { getSegment, type ClaimAnchor, type TranscriptSegment } from "@/lib/mock-data";
import { AnchorBadge } from "@/components/legal/Badges";
import type { ClaimAnchorRow } from "@/lib/claims.functions";
import type { TranscriptSegmentRow } from "@/lib/transcript.functions";

/**
 * Resolves a claim's anchors to their backing transcript segments, dropping any
 * anchor whose segment can't be found. The return type is fully narrowed to
 * `TranscriptSegment[]` (no `undefined`) so call sites get explicit types.
 */
export function resolveAnchorSegments(anchors: readonly ClaimAnchor[]): TranscriptSegment[] {
  return anchors
    .map((anchor: ClaimAnchor) => getSegment(anchor.segmentId))
    .filter((segment): segment is TranscriptSegment => Boolean(segment));
}

/** A transcript segment rendered next to a claim, sourced from the database. */
export interface AnchoredSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  anchorStatus: ClaimAnchorRow["status"];
  quote: string | null;
  matchScore: number | null;
}

/**
 * Resolves database anchors against database transcript rows. Shared by the
 * review console and the report preview so every screen renders anchors with
 * the same explicit types and the same "no anchor" semantics.
 */
export function resolveAnchoredSegments(
  anchors: readonly ClaimAnchorRow[],
  segments: readonly TranscriptSegmentRow[],
): AnchoredSegment[] {
  const byId = new Map<string, TranscriptSegmentRow>(
    segments.map((segment: TranscriptSegmentRow) => [segment.id, segment]),
  );
  return anchors
    .map((anchor: ClaimAnchorRow): AnchoredSegment | null => {
      const segment = anchor.segment_id ? byId.get(anchor.segment_id) : undefined;
      if (!segment) return null;
      return {
        id: segment.id,
        timestamp: segment.timestamp_label ?? "--:--",
        speaker: segment.speaker,
        text: segment.text,
        anchorStatus: anchor.status,
        quote: anchor.quote,
        matchScore: anchor.match_score,
      };
    })
    .filter((segment): segment is AnchoredSegment => segment !== null);
}

/** Anchor badge statuses for a set of database anchors, in stable order. */
export function anchorStatuses(anchors: readonly ClaimAnchorRow[]): ClaimAnchor[] {
  return anchors.map((anchor: ClaimAnchorRow) => ({
    segmentId: anchor.segment_id ?? "",
    status: anchor.status,
  }));
}

/**
 * Renders the set of anchor badges for a claim. Falls back to a single
 * "No Anchor" badge when the claim has no anchors. Centralizes the
 * `anchors.map((a, i) => <AnchorBadge … />)` pattern with one explicit type.
 */
export function AnchorBadgeList({ anchors }: { anchors: readonly ClaimAnchor[] }): ReactElement {
  if (anchors.length === 0) {
    return <AnchorBadge status="none" />;
  }
  return (
    <>
      {anchors.map((anchor: ClaimAnchor, index: number) => (
        <AnchorBadge key={index} status={anchor.status} />
      ))}
    </>
  );
}
