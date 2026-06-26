import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/route-guards";
import {
  CheckCircle2,
  Database,
  Server,
  Plug,
  AlertTriangle,
  BookOpen,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/handoff")({
  head: () => ({
    meta: [
      { title: "Handoff Summary — Courtroom Intelligence" },
      {
        name: "description",
        content:
          "Phase 5 handoff: screens built, mock data used, backend assumptions, components needing Laravel wiring, required API endpoints, and production warnings.",
      },
    ],
  }),
  loader: async () => {
    await requireSession();
  },
  errorComponent: () => (
    <AppLayout>
      <PageHeader title="Something went wrong" />
    </AppLayout>
  ),
  component: Handoff,
});

const screens: { name: string; route: string; status: string }[] = [
  { name: "Dashboard", route: "/", status: "Built" },
  { name: "Cases Index", route: "/cases", status: "Built" },
  { name: "Case Detail (tabs)", route: "/cases/$caseId", status: "Built" },
  { name: "Session Detail (workspace)", route: "/sessions/$sessionId", status: "Built" },
  { name: "Evidence Upload Panel", route: "/sessions/$sessionId", status: "Built (demo)" },
  { name: "Transcript Viewer / Editor", route: "/sessions/$sessionId", status: "Built (demo)" },
  { name: "AI Claims List", route: "/sessions/$sessionId", status: "Built" },
  { name: "Review Queue", route: "/review", status: "Built" },
  { name: "Review Detail (side-by-side)", route: "/sessions/$sessionId/review", status: "Built" },
  { name: "Report Preview", route: "/sessions/$sessionId/report", status: "Built" },
  { name: "Reports", route: "/reports", status: "Built" },
  { name: "Team", route: "/team", status: "Built" },
  { name: "Audit", route: "/audit", status: "Built" },
  { name: "Authentication", route: "/auth", status: "Built (Lovable Cloud)" },
  { name: "Handoff Summary", route: "/handoff", status: "This page" },
];

const mockData: string[] = [
  "Case LDH-2026-001 — \"Land Dispute Hearing\" (active)",
  "5 demo users across Admin, Lawyer, Paralegal, Reviewer, Viewer roles",
  "5 transcript segments (timestamp, speaker, text, confidence, version)",
  "3 evidence files (audio, image, document) with checksum placeholders",
  "4 AI draft claims (key statement, inconsistency candidate, etc.) with anchors, confidence, review status",
  "Dashboard metrics + recent activity feed",
];

const backendAssumptions: string[] = [
  "Laravel 11 application with React/Inertia integration",
  "MySQL migrations and models for cases, sessions, evidence, transcripts, claims, reviews",
  "Role policies + tenant scoping enforced server-side",
  "Private evidence storage (never public) with file checksums",
  "Transcript versioning history",
  "Gemini API service with AI_MODE: disabled / demo / live",
  "Evidence anchor verifier linking claims to transcript/evidence",
  "Review decisions + report inclusion rules engine",
  "Audit logs for all actions",
  "cPanel deployment package",
];

const wiring: string[] = [
  "Auth/session — currently Lovable Cloud; map to Laravel auth + role policies",
  "Evidence upload panel — replace demo upload with private storage + checksum service",
  "Transcript viewer/editor — wire to transcript versioning API",
  "Generate Review Draft button — connect to Gemini service (AI_MODE aware)",
  "AI claims + anchors — populate from anchor verifier output",
  "Review controls (approve/reject/edit) — POST review decisions",
  "Report preview — assemble from approved claims + inclusion rules",
  "Dashboard metrics — replace mock counts with aggregate queries",
];

const endpoints: { method: string; path: string; purpose: string }[] = [
  { method: "GET", path: "/dashboard", purpose: "Dashboard metrics & activity" },
  { method: "GET", path: "/cases", purpose: "List cases (tenant/role scoped)" },
  { method: "POST", path: "/cases", purpose: "Create case" },
  { method: "GET", path: "/cases/{case}", purpose: "Case detail" },
  { method: "POST", path: "/cases/{case}/sessions", purpose: "Create session" },
  { method: "GET", path: "/sessions/{session}", purpose: "Session workspace data" },
  { method: "POST", path: "/sessions/{session}/evidence", purpose: "Upload evidence (private)" },
  { method: "POST", path: "/sessions/{session}/transcript", purpose: "Add/update transcript" },
  { method: "POST", path: "/sessions/{session}/ai/generate-review-draft", purpose: "Generate AI draft claims" },
  { method: "GET", path: "/sessions/{session}/claims", purpose: "List AI claims" },
  { method: "POST", path: "/claims/{claim}/review", purpose: "Submit review decision" },
  { method: "GET", path: "/sessions/{session}/report", purpose: "Report preview data" },
  { method: "POST", path: "/sessions/{session}/export", purpose: "Export report" },
];

const warnings: string[] = [
  "This is a frontend prototype — no production AI, no real evidence storage.",
  "Evidence files must be stored privately in production (never public buckets).",
  "AI output is a draft only; every claim requires human review before report inclusion.",
  "Use \"Generate Review Draft\" / \"Possible inconsistency candidate\" language — never \"legal advice\" or \"contradiction\".",
  "The mandatory legal disclaimer must remain visible on every report.",
  "Role checks must be enforced server-side in Laravel, mirroring the demo RBAC groups.",
];

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="size-5 text-primary" />
        <h2 className="font-serif text-xl">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Handoff() {
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Phase 5"
        title="Handoff Summary"
        description="Everything the Laravel/Codex team needs to take this prototype to production: screens built, mock data, backend assumptions, components needing wiring, required API endpoints, and production warnings."
      />

      <div className="grid gap-6">
        <Section icon={CheckCircle2} title="Screens built">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Screen</th>
                  <th className="py-2 pr-4 font-medium">Route</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {screens.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{s.route}</td>
                    <td className="py-2">
                      <Badge variant="secondary">{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid lg:grid-cols-2 gap-6">
          <Section icon={Database} title="Mock data used">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              {mockData.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Section>

          <Section icon={Server} title="Backend assumptions">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              {backendAssumptions.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Section>
        </div>

        <Section icon={Plug} title="Components needing Laravel wiring">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            {wiring.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>

        <Section icon={Server} title="Required API endpoints (from spec 06)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Method</th>
                  <th className="py-2 pr-4 font-medium">Endpoint</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {endpoints.map((e) => (
                  <tr key={e.path + e.method}>
                    <td className="py-2 pr-4">
                      <Badge variant={e.method === "GET" ? "secondary" : "default"}>{e.method}</Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{e.path}</td>
                    <td className="py-2 text-muted-foreground">{e.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Card className="p-6 border-warning/40 bg-warning/5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-5 text-warning-foreground" />
            <h2 className="font-serif text-xl">Production warnings</h2>
          </div>
          <ul className="space-y-2 text-sm list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>

        <Section icon={ShieldCheck} title="Security posture">
          <p className="text-sm text-muted-foreground">
            Authenticated routes live under the <span className="font-mono text-xs">/_authenticated</span> layout.
            Beyond the browser-side redirect, every authenticated loader now calls a server-validated guard
            (<span className="font-mono text-xs">requireSession</span> / <span className="font-mono text-xs">guardRouteAccess</span>),
            so access is enforced on the server via the authenticated bearer token. Role-gated areas (Review, Team, Audit)
            additionally verify the caller's roles server-side before loading.
          </p>
        </Section>

        <Section icon={BookOpen} title="App overview">
          <p className="text-sm text-muted-foreground">
            A full product overview — features, AI capabilities, access-control model, what's done, and what remains
            before deployment — is documented in <span className="font-mono text-xs">PROJECT_OVERVIEW.md</span> at the
            repository root, and summarized in the warnings and assumptions above.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/" className="text-sm text-primary hover:underline">
              Back to dashboard
            </Link>
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}
