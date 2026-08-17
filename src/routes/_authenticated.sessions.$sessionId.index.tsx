import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type AIClaim } from "@/lib/mock-data";
import { getSessionById } from "@/lib/sessions.functions";
import { buildSessionView } from "@/lib/session-content";
import { TranscriptPanel } from "@/components/sessions/TranscriptPanel";
import { EvidencePanel } from "@/components/sessions/EvidencePanel";
import { RecordingPanel } from "@/components/sessions/RecordingPanel";
import { AIDraftBadge, ClaimTypeBadge, ConfidenceBadge, ReviewBadge } from "@/components/legal/Badges";
import { AnchorBadgeList } from "@/lib/claim-rendering";
import { requireSession } from "@/lib/route-guards";
import { Sparkles, ClipboardList, FileCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/")({
  head: () => ({ meta: [{ title: "Session — Courtroom Intelligence" }, { name: "description", content: "Session workspace: review the transcript, AI-assisted draft claims, linked evidence, and prepare the human-reviewed report." }] }),
  loader: async ({ params }) => {
    await requireSession();
    const row = await getSessionById({ data: { id: params.sessionId } });
    if (!row) throw notFound();
    return { session: buildSessionView(row) };
  },
  notFoundComponent: () => <AppLayout><PageHeader title="Session not found" /></AppLayout>,
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: SessionDetail,
});

function SessionDetail() {
  const { session } = Route.useLoaderData();

  return (
    <AppLayout>
      <PageHeader
        eyebrow={`Session · ${session.date}`}
        title={session.title}
        description="Review transcript, evidence and AI-assisted draft claims. Approved claims enter the report; unsupported claims are excluded by default."
        actions={<>
          <Button variant="outline"><Sparkles className="size-4" /> Generate Review Draft</Button>
          <Button variant="outline" asChild><Link to="/sessions/$sessionId/review" params={{ sessionId: session.id }}><ClipboardList className="size-4" /> Open Review Console</Link></Button>
          <ExportBundleDialog sessionId={session.id} />
          <Button asChild><Link to="/sessions/$sessionId/report" params={{ sessionId: session.id }}><FileCheck className="size-4" /> Preview Report</Link></Button>
        </>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Transcript */}
        <TranscriptPanel sessionId={session.id} />

        {/* Right column */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Session status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>Review pending</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Claims</span><span>{session.claims.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span>{session.claims.filter((c: AIClaim) => c.review === "pending").length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Approved</span><span>{session.claims.filter((c: AIClaim) => c.review === "approved").length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rejected</span><span>{session.claims.filter((c: AIClaim) => c.review === "rejected").length}</span></div>
            </div>
          </Card>

          <RecordingPanel sessionId={session.id} />

          <EvidencePanel sessionId={session.id} />
        </div>
      </div>


      {/* AI Claims */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl">AI-assisted draft claims</h2>
          <AIDraftBadge />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {session.claims.map((claim: AIClaim) => (
            <Card key={claim.id} className="p-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <ClaimTypeBadge type={claim.type} />
                <ConfidenceBadge level={claim.confidence} />
                <ReviewBadge status={claim.review} />
              </div>
              <p className="text-sm">{claim.text}</p>
              <div className="flex flex-wrap gap-2">
                <AnchorBadgeList anchors={claim.anchors} />
              </div>
              {claim.warning && (
                <div className="text-xs flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2">
                  <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />{claim.warning}
                </div>
              )}
              <Link to="/sessions/$sessionId/review" params={{ sessionId: session.id }} className="text-xs text-primary hover:underline">Open in Review Console →</Link>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}


