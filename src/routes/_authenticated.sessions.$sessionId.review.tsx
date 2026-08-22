import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSessionById } from "@/lib/sessions.functions";
import { listTranscript } from "@/lib/transcript.functions";
import {
  generateClaims,
  listClaims,
  reverifyClaims,
  reviewClaim,
  type ClaimAnchorRow,
  type ClaimWithAnchors,
} from "@/lib/claims.functions";
import type { ReviewStatus } from "@/lib/mock-data";
import {
  AIDraftBadge,
  ClaimTypeBadge,
  ConfidenceBadge,
  ReviewBadge,
} from "@/components/legal/Badges";
import {
  AnchorBadgeList,
  anchorStatuses,
  resolveAnchoredSegments,
  type AnchoredSegment,
} from "@/lib/claim-rendering";
import { guardRouteAccess } from "@/lib/route-guards";
import { Check, X, Pencil, HelpCircle, FileQuestion, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/review")({
  head: () => ({
    meta: [
      { title: "Review Console — Courtroom Intelligence" },
      {
        name: "description",
        content:
          "Side-by-side review of AI-assisted draft claims against transcript evidence, with controls to approve, edit, or reject each claim.",
      },
    ],
  }),
  loader: async ({ params }) => {
    await guardRouteAccess("reviewQueue");
    const row = await getSessionById({ data: { id: params.sessionId } });
    if (!row) throw notFound();
    const [transcript, claims] = await Promise.all([
      listTranscript({ data: { sessionId: params.sessionId } }),
      listClaims({ data: { sessionId: params.sessionId } }),
    ]);
    return { session: row, transcript, claims };
  },
  notFoundComponent: () => (
    <AppLayout>
      <PageHeader title="Session not found" />
    </AppLayout>
  ),
  errorComponent: () => (
    <AppLayout>
      <PageHeader title="Something went wrong" />
    </AppLayout>
  ),
  component: ReviewDetail,
});

const filters: { key: string; label: string; match: (c: ClaimWithAnchors) => boolean }[] = [
  { key: "pending", label: "Pending review", match: (c) => c.review_status === "pending" },
  { key: "unsupported", label: "Unsupported", match: (c) => c.support === "unsupported" },
  {
    key: "low",
    label: "Low confidence",
    match: (c) => c.confidence === "low" || c.confidence === "unsupported",
  },
  {
    key: "inconsistency",
    label: "Possible inconsistency candidates",
    match: (c) => c.type === "inconsistency_candidate",
  },
  { key: "approved", label: "Approved", match: (c) => c.review_status === "approved" },
  { key: "rejected", label: "Rejected", match: (c) => c.review_status === "rejected" },
  { key: "all", label: "All", match: () => true },
];

function ReviewDetail() {
  const { session, transcript, claims } = Route.useLoaderData();
  const router = useRouter();
  const runGenerate = useServerFn(generateClaims);
  const runReverify = useServerFn(reverifyClaims);
  const runReview = useServerFn(reviewClaim);

  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState<string>(
    claims.find((c: ClaimWithAnchors) => c.review_status === "pending")?.id ?? claims[0]?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [editText, setEditText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(
    () => claims.filter(filters.find((f) => f.key === filter)!.match),
    [claims, filter],
  );
  const selected =
    claims.find((c: ClaimWithAnchors) => c.id === selectedId) ?? filtered[0] ?? claims[0];
  const sourceSegments: AnchoredSegment[] = selected
    ? resolveAnchoredSegments(selected.anchors, transcript)
    : [];
  const hasAnchor = Boolean(
    selected?.anchors.some((a: ClaimAnchorRow) => a.status === "verified" || a.status === "manual"),
  );

  async function withBusy(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await fn();
      await router.invalidate();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const generate = () =>
    withBusy(
      "generate",
      () => runGenerate({ data: { sessionId: session.id } }),
      "Draft claims generated and anchored against the transcript.",
    );

  const reverify = () =>
    withBusy(
      "reverify",
      () => runReverify({ data: { sessionId: session.id } }),
      "Anchors re-verified against the current transcript.",
    );

  const decide = (status: ReviewStatus, options?: { text?: string; manualOverride?: boolean }) => {
    if (!selected) return;
    return withBusy(
      status,
      async () => {
        await runReview({
          data: {
            claimId: selected.id,
            status,
            note: note.trim() ? note.trim() : undefined,
            text: options?.text,
            manualOverride: options?.manualOverride,
          },
        });
        setNote("");
        setEditText(null);
      },
      `Claim marked ${status.replace(/_/g, " ")}.`,
    );
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={generate} disabled={busy !== null}>
        <Sparkles className="size-4" />
        {busy === "generate" ? "Generating…" : "Generate draft claims"}
      </Button>
      {claims.length > 0 && (
        <Button variant="outline" onClick={reverify} disabled={busy !== null}>
          <ShieldCheck className="size-4" />
          {busy === "reverify" ? "Verifying…" : "Re-verify anchors"}
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
          Back to session
        </Link>
      </Button>
    </div>
  );

  if (claims.length === 0 || !selected) {
    return (
      <AppLayout>
        <PageHeader
          eyebrow={`Review Console · ${session.title}`}
          title="Review queue"
          description="No AI-assisted draft claims yet. Generate a review draft from the session transcript to populate the queue."
          actions={actions}
        />
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {transcript.length === 0
            ? "This session has no transcript yet. Record and transcribe the hearing first, then generate draft claims."
            : "Draft claims will appear here once generated. Every claim is anchored to the transcript by a deterministic verifier before a reviewer sees it."}
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow={`Review Console · ${session.title}`}
        title="Review queue"
        description="Approve, reject, or refine AI-assisted draft claims. No anchor, no authority."
        actions={actions}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-accent"}`}
          >
            {f.label}{" "}
            <span className="ml-1 opacity-60">
              {claims.filter((c: ClaimWithAnchors) => f.match(c)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Queue */}
        <Card className="p-2 h-fit lg:sticky lg:top-6">
          <ul className="space-y-1">
            {filtered.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">No claims match this filter.</li>
            )}
            {filtered.map((c: ClaimWithAnchors) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedId(c.id);
                    setNote("");
                    setEditText(null);
                  }}
                  className={`w-full text-left p-3 rounded-md transition-colors ${selected.id === c.id ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <ClaimTypeBadge type={c.type} />
                  </div>
                  <p className="text-sm line-clamp-2">{c.text}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <ConfidenceBadge level={c.confidence} />
                    <ReviewBadge status={c.review_status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Side-by-side */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Transcript &amp; evidence source
            </div>
            {sourceSegments.length === 0 ? (
              <div className="text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 flex items-start gap-2">
                <FileQuestion className="size-4 mt-0.5" />
                <div>
                  No anchor available. This claim cannot be verified against the transcript and must
                  be excluded from the report unless manually confirmed by a human reviewer.
                </div>
              </div>
            ) : (
              <ol className="space-y-3">
                {sourceSegments.map((seg: AnchoredSegment) => (
                  <li key={seg.id} className="border-l-2 border-primary/40 pl-3">
                    <div className="font-mono text-xs text-muted-foreground">{seg.timestamp}</div>
                    <div className="text-sm font-medium">{seg.speaker}</div>
                    <p className="text-sm">{seg.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Anchor: {seg.anchorStatus}
                      {seg.matchScore != null && ` · match ${(seg.matchScore * 100).toFixed(0)}%`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                AI-assisted claim
              </div>
              <AIDraftBadge />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <ClaimTypeBadge type={selected.type} />
              <ConfidenceBadge level={selected.confidence} />
              <ReviewBadge status={selected.review_status} />
            </div>
            {editText === null ? (
              <p className="text-sm mb-3">{selected.text}</p>
            ) : (
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="mb-3"
                aria-label="Edit claim text"
              />
            )}
            <div className="flex flex-wrap gap-2 mb-4">
              <AnchorBadgeList anchors={anchorStatuses(selected.anchors)} />
            </div>

            {selected.warning && (
              <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 mb-4">
                {selected.warning}
              </div>
            )}

            {selected.reviewer_note && (
              <div className="text-xs bg-muted rounded-md p-2 mb-4">
                <span className="font-medium">Reviewer note:</span> {selected.reviewer_note}
              </div>
            )}

            <div className="mb-4">
              <label
                className="text-xs uppercase tracking-wider text-muted-foreground"
                htmlFor="reviewer-note"
              >
                Reviewer note
              </label>
              <Textarea
                id="reviewer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add human-reviewed note…"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full"
                disabled={busy !== null || !hasAnchor}
                onClick={() => decide("approved")}
              >
                <Check className="size-4" /> Approve for Report
              </Button>
              {editText === null ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy !== null}
                  onClick={() => setEditText(selected.text)}
                >
                  <Pencil className="size-4" /> Edit and Approve
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy !== null || !editText.trim()}
                  onClick={() =>
                    decide("approved", {
                      text: editText.trim(),
                      manualOverride: !hasAnchor,
                    })
                  }
                >
                  <Check className="size-4" /> Save and approve
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={() => decide("uncertain")}
              >
                <HelpCircle className="size-4" /> Mark Uncertain
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={() => decide("needs_more_evidence")}
              >
                <FileQuestion className="size-4" /> Needs More Evidence
              </Button>
              <Button
                variant="destructive"
                className="col-span-2 w-full"
                disabled={busy !== null}
                onClick={() => decide("rejected")}
              >
                <X className="size-4" /> Reject
              </Button>
              {!hasAnchor && (
                <Button
                  variant="outline"
                  className="col-span-2 w-full"
                  disabled={busy !== null || !note.trim()}
                  onClick={() => decide("approved", { manualOverride: true })}
                >
                  <ShieldCheck className="size-4" /> Manually confirm and approve
                </Button>
              )}
            </div>
            {!hasAnchor && (
              <p className="text-[11px] text-muted-foreground italic mt-3">
                Approval disabled: no verified anchor. Add a reviewer note and manually confirm to
                override — the override is recorded in the audit trail.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
