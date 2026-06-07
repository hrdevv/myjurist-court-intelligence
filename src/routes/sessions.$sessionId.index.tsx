import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, type AIClaim, type ClaimAnchor, type EvidenceFile, type TranscriptSegment } from "@/lib/mock-data";
import { AIDraftBadge, AnchorBadge, ClaimTypeBadge, ConfidenceBadge, ReviewBadge } from "@/components/legal/Badges";
import { FileText, Sparkles, ClipboardList, FileCheck, Upload, ShieldAlert, History, Pencil } from "lucide-react";

export const Route = createFileRoute("/sessions/$sessionId/")({
  head: ({ params }) => {
    const s = getSession(params.sessionId);
    return { meta: [{ title: `${s?.title ?? "Session"} — Courtroom Intelligence` }, { name: "description", content: "Legal session workspace." }] };
  },
  loader: ({ params }) => {
    const s = getSession(params.sessionId);
    if (!s) throw notFound();
    return { session: s };
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
          <Button asChild><Link to="/sessions/$sessionId/report" params={{ sessionId: session.id }}><FileCheck className="size-4" /> Preview Report</Link></Button>
        </>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Transcript */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Transcript</h2>
            <Button variant="ghost" size="sm"><Pencil className="size-4" /> Paste transcript (demo)</Button>
          </div>
          <ol className="space-y-4">
            {session.transcript.map((seg: TranscriptSegment) => (
              <li key={seg.id} className="grid grid-cols-[80px_1fr_auto] gap-4 items-start text-sm border-l-2 border-border pl-4 hover:border-primary/50">
                <span className="font-mono text-xs text-muted-foreground pt-1">{seg.timestamp}</span>
                <div>
                  <div className="font-medium text-foreground">{seg.speaker}</div>
                  <p className="text-foreground/90 mt-0.5">{seg.text}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <ConfidenceBadge level={seg.confidence} />
                    <span className="inline-flex items-center gap-1"><History className="size-3" /> v{seg.version}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm"><Pencil className="size-3.5" /></Button>
              </li>
            ))}
          </ol>
        </Card>

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

          <EvidencePanel session={session} />
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
                {claim.anchors.length === 0 ? <AnchorBadge status="none" /> : claim.anchors.map((a: {segmentId:string;status:import("@/lib/mock-data").AnchorStatus}, i: number) => <AnchorBadge key={i} status={a.status} />)}
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

function EvidencePanel({ session }: { session: ReturnType<typeof getSession> extends infer T ? NonNullable<T> : never }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">Evidence</h3>
        <Button variant="outline" size="sm"><Upload className="size-4" /> Upload</Button>
      </div>

      <div className="border-2 border-dashed border-border rounded-md p-4 mb-4">
        <div className="text-xs space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground"><Upload className="size-3.5" /> Drop files here (demo only)</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Type</Label>
              <select className="w-full mt-1 border rounded px-2 py-1 bg-background text-xs"><option>Audio</option><option>Document</option><option>Image</option><option>Video</option></select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Description</Label>
              <Input className="mt-1 h-8 text-xs" placeholder="e.g. Hearing recording" />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground italic flex items-start gap-1.5"><ShieldAlert className="size-3 mt-0.5 shrink-0 text-warning-foreground" /> Evidence files must be stored privately in production.</div>
        </div>
      </div>

      <ul className="space-y-2">
        {session.evidence.map((e: import("@/lib/mock-data").EvidenceFile) => (
          <li key={e.id} className="text-sm flex items-start gap-2">
            <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.name}</div>
              <div className="text-[11px] text-muted-foreground font-mono">{e.checksum} · {e.size}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
