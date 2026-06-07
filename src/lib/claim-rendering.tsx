import type { ReactElement } from "react";
import { getSegment, type ClaimAnchor, type TranscriptSegment } from "@/lib/mock-data";
import { AnchorBadge } from "@/components/legal/Badges";

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
