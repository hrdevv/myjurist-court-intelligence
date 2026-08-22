import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import {
  ClaimTypeBadge,
  ConfidenceBadge,
  ReviewBadge,
} from "@/components/legal/Badges";
import { AnchorBadgeList, anchorStatuses } from "@/lib/claim-rendering";
import { listReviewQueue, type QueueClaimRow } from "@/lib/claims.functions";
import { guardRouteAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Review Queue — Courtroom Intelligence" },
      {
        name: "description",
        content:
          "Work through all AI-assisted draft claims awaiting human review, approve evidence-linked statements, and flag unsupported inferences.",
      },
    ],
  }),
  loader: async () => {
    await guardRouteAccess("reviewQueue");
    return { claims: await listReviewQueue() };
  },
  errorComponent: () => (
    <AppLayout>
      <PageHeader title="Something went wrong" />
    </AppLayout>
  ),
  component: ReviewQueue,
});

function ReviewQueue() {
  const { claims } = Route.useLoaderData();
  const pending = claims.filter((c: QueueClaimRow) => c.review_status === "pending");
  const unanchored = pending.filter(
    (c: QueueClaimRow) =>
      c.anchors.every((a) => a.status === "failed" || a.status === "none"),
  );

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Workspace"
        title="Review queue"
        description="Every AI-assisted draft claim across your sessions. Approve only what is anchored to verifiable evidence."
      />
      <div className="flex flex-wrap gap-2 mb-6 text-xs text-muted-foreground">
        <span className="px-3 py-1.5 rounded-full border border-border bg-background">
          {pending.length} pending review
        </span>
        <span className="px-3 py-1.5 rounded-full border border-border bg-background">
          {unanchored.length} without a verified anchor
        </span>
      </div>
      {claims.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No draft claims yet. Open a session, transcribe its recording, then generate draft claims
          from the review console.
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((c: QueueClaimRow) => (
            <Card
              key={c.id}
              className="p-4 flex flex-wrap items-start gap-4 hover:bg-accent/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <ClaimTypeBadge type={c.type} />
                  <ConfidenceBadge level={c.confidence} />
                  <ReviewBadge status={c.review_status} />
                  <AnchorBadgeList anchors={anchorStatuses(c.anchors)} />
                </div>
                <p className="text-sm">{c.text}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.session_title}</p>
              </div>
              <Link
                to="/sessions/$sessionId/review"
                params={{ sessionId: c.session_id }}
                className="text-sm text-primary hover:underline shrink-0 self-center"
              >
                Open →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
