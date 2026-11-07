import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type AIClaim, type ReviewStatus } from "@/lib/mock-data";
import { getSessionById } from "@/lib/sessions.functions";
import { listClaimsBySession, updateClaimReview } from "@/lib/claims.functions";
import { buildSessionView } from "@/lib/session-content";
import {
  AIDraftBadge,
  ClaimTypeBadge,
  ConfidenceBadge,
  ReviewBadge,
} from "@/components/legal/Badges";
import { AnchorBadgeList, resolveAnchorSegments } from "@/lib/claim-rendering";
import { guardRouteAccess } from "@/lib/route-guards";
import {
  Check,
  X,
  HelpCircle,
  FileQuestion,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

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
    const claims = await listClaimsBySession({ data: { sessionId: params.sessionId } });
    return { session: { ...buildSessionView(row), claims } };
  },
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: ReviewPending,
  notFoundComponent: ReviewNotFound,
  errorComponent: ReviewError,
  component: ReviewDetail,
});

const filters: { key: string; label: string; match: (c: AIClaim) => boolean }[] = [
  { key: "pending", label: "Pending review", match: (c) => c.review === "pending" },
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
  { key: "approved", label: "Approved", match: (c) => c.review === "approved" },
  { key: "rejected", label: "Rejected", match: (c) => c.review === "rejected" },
  { key: "all", label: "All", match: () => true },
];

function ReviewPending() {
  return (
    <AppLayout>
      <div className="mb-8 animate-pulse">
        <div className="h-3 w-44 rounded bg-muted mb-3" />
        <div className="h-8 w-64 max-w-full rounded bg-muted mb-2" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
      </div>
      <div className="flex flex-wrap gap-2 mb-6 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full bg-muted" />
        ))}
      </div>
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 animate-pulse">
        <Card className="p-2 h-fit space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 space-y-2">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
            </div>
          ))}
        </Card>
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-9 w-full rounded bg-muted" />
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function ReviewNotFound() {
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Review Console"
        title="Session not found"
        description="This session does not exist, was removed, or you don't have access to it."
      />
      <Card className="p-10 md:p-14 text-center">
        <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileQuestion className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          Check that you opened the review console from an existing session, or browse your cases to
          find the right one.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/cases">Browse cases</Link>
          </Button>
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
}

function ReviewError({ error }: { error: unknown }) {
  const router = useRouter();
  const { sessionId } = Route.useParams();
  const message =
    error instanceof Error && error.message
      ? error.message
      : "An unexpected error occurred while loading the review queue.";
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Review Console"
        title="Unable to load the review queue"
        description="The session, transcript, or draft claims could not be loaded. You can retry or return to the session workspace."
      />
      <Card className="p-10 md:p-14 text-center">
        <div className="mx-auto size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertTriangle className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.invalidate()}>
            <RefreshCw className="size-4" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sessions/$sessionId" params={{ sessionId }}>
              Back to session
            </Link>
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
}

function ReviewDetail() {
  const { session } = Route.useLoaderData();
  const { claims, transcript } = session;
  const [filter, setFilter] = useState("pending");
  const activeFilter = filters.find((f) => f.key === filter) ?? filters[0];
  const filtered = useMemo(() => claims.filter(activeFilter.match), [activeFilter, claims]);

  if (claims.length === 0) {
    const hasTranscript = transcript.length > 0;
    return (
      <AppLayout>
        <PageHeader
          eyebrow={`Review Console · ${session.title}`}
          title="Review queue"
          description="No AI-assisted draft claims yet. Generate a review draft from the session transcript to populate the queue."
          actions={
            <Button variant="outline" asChild>
              <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
                Back to session
              </Link>
            </Button>
          }
        />
        <Card className="p-10 md:p-14 text-center">
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            {hasTranscript ? (
              <Sparkles className="size-6 text-muted-foreground" />
            ) : (
              <FileQuestion className="size-6 text-muted-foreground" />
            )}
          </div>
          <h2 className="font-serif text-lg mb-2">
            {hasTranscript ? "No draft claims yet" : "No transcript yet"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {hasTranscript
              ? "Generate a review draft from this session's transcript. Every claim is anchored to the transcript by a deterministic verifier before a reviewer sees it."
              : "This session has no transcript yet. Record and transcribe the hearing first, then generate draft claims."}
          </p>
          <Button asChild>
            <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
              {hasTranscript ? "Return to session workspace" : "Go to session workspace"}
            </Link>
          </Button>
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
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
                Back to session
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/sessions/$sessionId/report" params={{ sessionId: session.id }}>
                Preview report
              </Link>
            </Button>
          </>
        }
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
              {claims.filter((claim: AIClaim) => f.match(claim)).length}
            </span>
          </button>
        ))}
      </div>

      <Card className="p-2">
        <ul className="space-y-1">
          {filtered.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No claims match this filter.</li>
          )}
          {filtered.map((c: AIClaim) => (
            <li key={c.id}>
              <Link
                to="/sessions/$sessionId/claims/$claimId"
                params={{ sessionId: session.id, claimId: c.id }}
                className="block p-3 rounded-md transition-colors hover:bg-accent/50"
              >
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  <ClaimTypeBadge type={c.type} />
                  <ConfidenceBadge level={c.confidence} />
                  <ReviewBadge status={c.review} />
                  <AnchorBadgeList anchors={c.anchors} />
                </div>
                <p className="text-sm">{c.text}</p>
                <span className="text-xs text-primary">Open claim detail →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </AppLayout>
  );
}
