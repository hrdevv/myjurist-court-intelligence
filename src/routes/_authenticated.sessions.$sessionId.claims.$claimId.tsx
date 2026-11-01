import { createFileRoute, Link, notFound, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AIDraftBadge, AnchorBadge, ClaimTypeBadge, ConfidenceBadge, ReviewBadge } from "@/components/legal/Badges";
import { EvidencePanel } from "@/components/sessions/EvidencePanel";
import { getClaimDetail, updateClaimReview } from "@/lib/claims.functions";
import { listTranscript, type TranscriptSegmentRow } from "@/lib/transcript.functions";
import { guardRouteAccess } from "@/lib/route-guards";
import type { ReviewStatus } from "@/lib/mock-data";
import { Check, X, HelpCircle, FileQuestion, ArrowLeft, History } from "lucide-react";

const detailQuery = (sessionId: string, claimId: string) =>
  queryOptions({
    queryKey: ["claim-detail", sessionId, claimId],
    queryFn: async () => {
      const d = await getClaimDetail({ data: { sessionId, claimId } });
      if (!d) throw notFound();
      return d;
    },
  });

const transcriptQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["transcript", sessionId],
    queryFn: () => listTranscript({ data: { sessionId } }),
  });

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/claims/$claimId")({
  head: () => ({
    meta: [
      { title: "Claim detail — Courtroom Intelligence" },
      { name: "description", content: "Claim detail with transcript anchors, evidence and the full human review history." },
      { property: "og:title", content: "Claim detail — Courtroom Intelligence" },
      { property: "og:description", content: "Review one AI-assisted claim against its transcript anchors and evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ params, context }) => {
    await guardRouteAccess("reviewQueue");
    await Promise.all([
      context.queryClient.ensureQueryData(detailQuery(params.sessionId, params.claimId)),
      context.queryClient.ensureQueryData(transcriptQuery(params.sessionId)),
    ]);
  },
  pendingComponent: () => (
    <AppLayout><PageHeader title="Loading claim…" /></AppLayout>
  ),
  notFoundComponent: () => {
    const { sessionId } = Route.useParams();
    return (
      <AppLayout>
        <PageHeader title="Claim not found" description="This claim doesn't exist or you no longer have access." />
        <Button asChild variant="outline">
          <Link to="/sessions/$sessionId/review" params={{ sessionId }}>Back to review queue</Link>
        </Button>
      </AppLayout>
    );
  },
  errorComponent: ClaimError,
  component: ClaimDetailPage,
});

function ClaimError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <AppLayout>
      <PageHeader title="Could not load claim" description={error instanceof Error ? error.message : "Something went wrong."} />
      <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
    </AppLayout>
  );
}

const decisions: { status: ReviewStatus; label: string; icon: typeof Check; variant: "default" | "outline" | "destructive" }[] = [
  { status: "approved", label: "Approve", icon: Check, variant: "default" },
  { status: "uncertain", label: "Uncertain", icon: HelpCircle, variant: "outline" },
  { status: "needs_more_evidence", label: "Needs more evidence", icon: FileQuestion, variant: "outline" },
  { status: "rejected", label: "Reject", icon: X, variant: "destructive" },
];

function ClaimDetailPage() {
  const { sessionId, claimId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(sessionId, claimId));
  const { data: segments } = useSuspenseQuery(transcriptQuery(sessionId));
  const queryClient = useQueryClient();
  const router = useRouter();
  const review = useServerFn(updateClaimReview);
  const [note, setNote] = useState("");
  const firstAnchorRef = useRef<HTMLLIElement | null>(null);

  const { claim, anchors, history, currentUserId } = data;
  const anchorBySegment = new Map(anchors.filter((a) => a.segment_id).map((a) => [a.segment_id as string, a]));
  const hasAnchor = anchors.some((a) => a.status === "verified" || a.status === "manual");
  const firstAnchoredId = segments.find((s: TranscriptSegmentRow) => anchorBySegment.has(s.id))?.id;

  useEffect(() => {
    firstAnchorRef.current?.scrollIntoView({ block: "center" });
  }, [firstAnchoredId]);

  const mutation = useMutation({
    mutationFn: (status: ReviewStatus) =>
      review({ data: { claimId, review: status, reviewerNote: note.trim() || undefined } }),
    onSuccess: async (_d, status) => {
      toast.success(`Claim marked ${status.replace(/_/g, " ")}.`);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["claim-detail", sessionId, claimId] });
      router.invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save review."),
  });

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Claim detail"
        title="AI-assisted claim"
        description={claim.text}
        actions={
          <Button variant="outline" asChild>
            <Link to="/sessions/$sessionId/review" params={{ sessionId }}><ArrowLeft className="size-4" /> Review queue</Link>
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-wrap gap-2">
                <ClaimTypeBadge type={claim.type} />
                <ConfidenceBadge level={claim.confidence} />
                <ReviewBadge status={claim.review} />
              </div>
              <AIDraftBadge />
            </div>
            <p className="text-sm">{claim.text}</p>
            {claim.warning && (
              <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 mt-3">{claim.warning}</div>
            )}
            {claim.reviewerNote && (
              <div className="text-xs bg-muted rounded-md p-2 mt-3"><span className="font-medium">Latest reviewer note:</span> {claim.reviewerNote}</div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg mb-3">Anchors</h2>
            {anchors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No anchors. This claim can't be verified against the transcript.</p>
            ) : (
              <ul className="space-y-3">
                {anchors.map((a, i) => (
                  <li key={i} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AnchorBadge status={a.status} />
                      {a.match_score !== null && (
                        <span className="text-xs text-muted-foreground">Match {Math.round(Number(a.match_score) * 100)}%</span>
                      )}
                    </div>
                    {a.quote && <p className="italic">“{a.quote}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg mb-3">Transcript</h2>
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No transcript for this session yet.</p>
            ) : (
              <ol className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {segments.map((seg: TranscriptSegmentRow) => {
                  const anchored = anchorBySegment.has(seg.id);
                  return (
                    <li
                      key={seg.id}
                      ref={seg.id === firstAnchoredId ? firstAnchorRef : undefined}
                      className={`grid grid-cols-[72px_1fr] gap-3 text-sm pl-3 border-l-2 ${anchored ? "border-primary bg-accent/60 rounded-r-md py-2" : "border-border"}`}
                    >
                      <span className="font-mono text-xs text-muted-foreground pt-0.5">{seg.timestamp_label ?? "—"}</span>
                      <div>
                        <div className="font-medium">{seg.speaker}</div>
                        <p>{seg.text}</p>
                        {anchored && <p className="text-[11px] text-primary mt-1">Anchored to this claim</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-serif text-lg mb-3">Submit review</h2>
            <label htmlFor="claim-note" className="text-xs uppercase tracking-wider text-muted-foreground">Reviewer note</label>
            <Textarea id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 mb-3" placeholder="Add human-reviewed note…" />
            <div className="grid grid-cols-2 gap-2">
              {decisions.map(({ status, label, icon: Icon, variant }) => (
                <Button
                  key={status}
                  variant={variant}
                  disabled={mutation.isPending || (status === "approved" && !hasAnchor)}
                  onClick={() => mutation.mutate(status)}
                >
                  <Icon className="size-4" /> {label}
                </Button>
              ))}
            </div>
            {!hasAnchor && (
              <p className="text-[11px] text-muted-foreground italic mt-3">Approval disabled: no verified anchor.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg mb-3 flex items-center gap-2"><History className="size-4" /> Review history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="text-sm border-l-2 border-border pl-3">
                    <div className="flex items-center gap-2">
                      <ReviewBadge status={h.review as ReviewStatus} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {h.actorId === currentUserId ? "You" : "Reviewer"} · {new Date(h.createdAt).toLocaleString()}
                    </div>
                    {h.note && <p className="mt-1">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <EvidencePanel sessionId={sessionId} />
        </div>
      </div>
    </AppLayout>
  );
}
