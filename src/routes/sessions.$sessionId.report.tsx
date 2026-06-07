import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSession, getSegment, LEGAL_DISCLAIMER, type AIClaim, type ClaimAnchor } from "@/lib/mock-data";
import { AnchorBadge, ConfidenceBadge } from "@/components/legal/Badges";
import { AlertTriangle, Download, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/sessions/$sessionId/report")({
  head: () => ({ meta: [{ title: "Report Preview — Courtroom Intelligence" }, { name: "description", content: "Human-reviewed report preview." }] }),
  loader: ({ params }) => {
    const s = getSession(params.sessionId);
    if (!s) throw notFound();
    return { session: s };
  },
  notFoundComponent: () => <AppLayout><PageHeader title="Session not found" /></AppLayout>,
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: ReportPreview,
});

function ReportPreview() {
  const { session } = Route.useLoaderData();
  const approved = session.claims.filter((c: AIClaim) => c.review === "approved");
  const inconsistencies = session.claims.filter((c: AIClaim) => c.type === "inconsistency_candidate");
  const followUps = session.claims.filter((c: AIClaim) => c.review === "needs_more_evidence");
  const excluded = session.claims.filter((c: AIClaim) => c.review === "rejected" || c.support === "unsupported");

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Report preview · Draft"
        title={`${session.title} — Report`}
        description="Approved claims only. Unsupported and rejected claims are excluded by default."
        actions={<>
          <Button variant="outline" asChild><Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>Back to session</Link></Button>
          <Button><Download className="size-4" /> Export (demo)</Button>
        </>}
      />

      <Card className="p-4 border-warning/40 bg-warning/10 mb-6">
        <div className="flex items-start gap-3 text-sm">
          <ShieldAlert className="size-5 text-warning-foreground shrink-0 mt-0.5" />
          <p className="text-warning-foreground">{LEGAL_DISCLAIMER}</p>
        </div>
      </Card>

      <article className="space-y-8 max-w-3xl">
        <Section title="1. Approved summary points">
          {approved.length === 0 ? (
            <Empty>No approved claims yet. Approve claims in the Review Console to populate this section.</Empty>
          ) : (
            <ul className="space-y-4">
              {approved.map((c: AIClaim) => (
                <li key={c.id} className="border-l-2 border-success/50 pl-4">
                  <p className="text-sm">{c.text}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <ConfidenceBadge level={c.confidence} />
                    {c.anchors.map((a: ClaimAnchor, i: number) => <AnchorBadge key={i} status={a.status} />)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="2. Evidence references">
          <ul className="text-sm space-y-2">
            {approved.flatMap((c: AIClaim) => c.anchors).map((a: ClaimAnchor, i: number) => {
              const seg = getSegment(a.segmentId);
              if (!seg) return null;
              return <li key={i} className="font-mono text-xs">[{seg.timestamp}] {seg.speaker}: "{seg.text}"</li>;
            })}
          </ul>
        </Section>

        <Section title="3. Possible inconsistency candidates">
          {inconsistencies.length === 0 ? <Empty>None recorded.</Empty> : (
            <ul className="space-y-3">
              {inconsistencies.map((c: AIClaim) => (
                <li key={c.id} className="text-sm border-l-2 border-warning/50 pl-4">
                  <p>{c.text}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">Flagged as a possible inconsistency candidate. Requires human professional review.</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="4. Unresolved issues / Follow-ups">
          {followUps.length === 0 ? <Empty>None recorded.</Empty> : (
            <ul className="space-y-2 text-sm">
              {followUps.map((c: AIClaim) => <li key={c.id} className="border-l-2 border-info/50 pl-4">{c.text}</li>)}
            </ul>
          )}
        </Section>

        <Section title="5. Reviewer notes">
          <Empty>No reviewer notes have been added to approved claims yet.</Empty>
        </Section>

        <Section title="6. Excluded claims" tone="destructive">
          <p className="text-xs text-muted-foreground mb-3">These claims were rejected or had no verifiable evidence anchor. They are excluded from the body of the report.</p>
          {excluded.length === 0 ? <Empty>None.</Empty> : (
            <ul className="space-y-3">
              {excluded.map((c: AIClaim) => (
                <li key={c.id} className="text-sm border-l-2 border-destructive/50 pl-4">
                  <p className="line-through text-muted-foreground">{c.text}</p>
                  {c.warning && <p className="text-xs text-destructive mt-1 flex items-start gap-1.5"><AlertTriangle className="size-3.5 mt-0.5" />{c.warning}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </article>
    </AppLayout>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "destructive" }) {
  return (
    <section>
      <h2 className={`font-serif text-xl mb-3 ${tone === "destructive" ? "text-destructive" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}
