import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSession, getSegment, AIClaim, ReviewStatus } from "@/lib/mock-data";
import { AIDraftBadge, AnchorBadge, ClaimTypeBadge, ConfidenceBadge, ReviewBadge } from "@/components/legal/Badges";
import { Check, X, Pencil, HelpCircle, FileQuestion } from "lucide-react";

export const Route = createFileRoute("/sessions/$sessionId/review")({
  head: () => ({ meta: [{ title: "Review Console — Courtroom Intelligence" }, { name: "description", content: "Side-by-side review of AI-assisted draft claims." }] }),
  loader: ({ params }) => {
    const s = getSession(params.sessionId);
    if (!s) throw notFound();
    return { session: s };
  },
  notFoundComponent: () => <AppLayout><PageHeader title="Session not found" /></AppLayout>,
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: ReviewDetail,
});

const filters: { key: string; label: string; match: (c: AIClaim) => boolean }[] = [
  { key: "pending", label: "Pending review", match: c => c.review === "pending" },
  { key: "unsupported", label: "Unsupported", match: c => c.support === "unsupported" },
  { key: "low", label: "Low confidence", match: c => c.confidence === "low" || c.confidence === "unsupported" },
  { key: "inconsistency", label: "Possible inconsistency candidates", match: c => c.type === "inconsistency_candidate" },
  { key: "approved", label: "Approved", match: c => c.review === "approved" },
  { key: "rejected", label: "Rejected", match: c => c.review === "rejected" },
  { key: "all", label: "All", match: () => true },
];

function ReviewDetail() {
  const { session } = Route.useLoaderData();
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState(session.claims.find((c: import("@/lib/mock-data").AIClaim) => c.review === "pending")?.id ?? session.claims[0].id);
  const [note, setNote] = useState("");

  const filtered = useMemo(() => session.claims.filter(filters.find(f => f.key === filter)!.match), [session.claims, filter]);
  const selected = session.claims.find((c: import("@/lib/mock-data").AIClaim) => c.id === selectedId) ?? filtered[0] ?? session.claims[0];
  const sourceSegments = selected.anchors.map((a: {segmentId:string;status:import("@/lib/mock-data").AnchorStatus}) => getSegment(a.segmentId)).filter(Boolean);

  return (
    <AppLayout>
      <PageHeader
        eyebrow={`Review Console · ${session.title}`}
        title="Review queue"
        description="Approve, reject, or refine AI-assisted draft claims. No anchor, no authority."
        actions={<Button variant="outline" asChild><Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>Back to session</Link></Button>}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-accent"}`}>
            {f.label} <span className="ml-1 opacity-60">{session.claims.filter((c: import("@/lib/mock-data").AIClaim) => f.match(c)).length}</span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Queue */}
        <Card className="p-2 h-fit lg:sticky lg:top-6">
          <ul className="space-y-1">
            {filtered.length === 0 && <li className="p-4 text-sm text-muted-foreground">No claims match this filter.</li>}
            {filtered.map((c: import("@/lib/mock-data").AIClaim) => (
              <li key={c.id}>
                <button onClick={() => setSelectedId(c.id)} className={`w-full text-left p-3 rounded-md transition-colors ${selected.id === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                  <div className="flex flex-wrap gap-1.5 mb-1.5"><ClaimTypeBadge type={c.type} /></div>
                  <p className="text-sm line-clamp-2">{c.text}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap"><ConfidenceBadge level={c.confidence} /><ReviewBadge status={c.review} /></div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Side-by-side */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Transcript & evidence source</div>
            {sourceSegments.length === 0 ? (
              <div className="text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 flex items-start gap-2">
                <FileQuestion className="size-4 mt-0.5" />
                <div>No anchor available. This claim cannot be verified against the transcript and must be excluded from the report unless manually confirmed by a human reviewer.</div>
              </div>
            ) : (
              <ol className="space-y-3">
                {sourceSegments.map((seg: ReturnType<typeof getSegment>) => seg && (
                  <li key={seg.id} className="border-l-2 border-primary/40 pl-3">
                    <div className="font-mono text-xs text-muted-foreground">{seg.timestamp}</div>
                    <div className="text-sm font-medium">{seg.speaker}</div>
                    <p className="text-sm">{seg.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AI-assisted claim</div>
              <AIDraftBadge />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <ClaimTypeBadge type={selected.type} />
              <ConfidenceBadge level={selected.confidence} />
              <ReviewBadge status={selected.review} />
            </div>
            <p className="text-sm mb-3">{selected.text}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {selected.anchors.length === 0 ? <AnchorBadge status="none" /> : selected.anchors.map((a: {segmentId:string;status:import("@/lib/mock-data").AnchorStatus}, i: number) => <AnchorBadge key={i} status={a.status} />)}
            </div>

            {selected.warning && (
              <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 mb-4">{selected.warning}</div>
            )}

            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Reviewer note</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add human-reviewed note…" className="mt-1.5" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full" disabled={selected.anchors.length === 0}><Check className="size-4" /> Approve for Report</Button>
              <Button variant="outline" className="w-full"><Pencil className="size-4" /> Edit and Approve</Button>
              <Button variant="outline" className="w-full"><HelpCircle className="size-4" /> Mark Uncertain</Button>
              <Button variant="outline" className="w-full"><FileQuestion className="size-4" /> Needs More Evidence</Button>
              <Button variant="destructive" className="col-span-2 w-full"><X className="size-4" /> Reject</Button>
            </div>
            {selected.anchors.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic mt-3">Approval disabled: no evidence anchor. Confirm manually to override.</p>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
