import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { sessions, type AIClaim, type Session } from "@/lib/mock-data";
import { ClaimTypeBadge, ConfidenceBadge, ReviewBadge } from "@/components/legal/Badges";
import { AnchorBadgeList } from "@/lib/claim-rendering";
import { guardRouteAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Review Queue — Courtroom Intelligence" }, { name: "description", content: "All AI-assisted draft claims awaiting human review." }] }),
  loader: async () => {
    await guardRouteAccess("reviewQueue");
  },
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: ReviewQueue,
});

function ReviewQueue() {
  type QueueClaim = AIClaim & { sessionId: string; sessionTitle: string };
  const all: QueueClaim[] = sessions.flatMap((s: Session) =>
    s.claims.map((c: AIClaim) => ({ ...c, sessionId: s.id, sessionTitle: s.title })),
  );
  return (
    <AppLayout>
      <PageHeader eyebrow="Workspace" title="Review queue" description="Every AI-assisted draft claim across sessions. Approve only what is anchored to verifiable evidence." />
      <div className="space-y-3">
        {all.map((c: QueueClaim) => (
          <Card key={c.id} className="p-4 flex flex-wrap items-start gap-4 hover:bg-accent/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                <ClaimTypeBadge type={c.type} />
                <ConfidenceBadge level={c.confidence} />
                <ReviewBadge status={c.review} />
                <AnchorBadgeList anchors={c.anchors.slice(0, 1)} />
              </div>
              <p className="text-sm">{c.text}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.sessionTitle}</p>
            </div>
            <Link to="/sessions/$sessionId/review" params={{ sessionId: c.sessionId }} className="text-sm text-primary hover:underline shrink-0 self-center">Open →</Link>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
