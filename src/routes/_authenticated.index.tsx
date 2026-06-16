import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cases, dashboardMetrics, recentActivity } from "@/lib/mock-data";
import { Plus, ClipboardList, ArrowRight, Briefcase, AlertTriangle, FileCheck, Hourglass } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Courtroom Intelligence" },
      { name: "description", content: "Reliability-first legal-session intelligence workspace." },
    ],
  }),
  component: Dashboard,
});

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Briefcase; label: string; value: number; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-serif text-3xl mt-2">{value}</div>
        </div>
        <div className={`size-10 rounded-md flex items-center justify-center ${tone}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Workspace"
        title="Legal Session Intelligence Workspace"
        description="Track active cases, review AI-assisted draft claims, and prepare human-reviewed reports."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/review"><ClipboardList className="size-4" /> Open Review Queue</Link></Button>
            <Button asChild><Link to="/cases"><Plus className="size-4" /> Create Case</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={Briefcase} label="Active cases" value={dashboardMetrics.activeCases} tone="bg-primary/10 text-primary" />
        <Metric icon={Hourglass} label="Sessions pending review" value={dashboardMetrics.sessionsPendingReview} tone="bg-warning/15 text-warning-foreground" />
        <Metric icon={AlertTriangle} label="Unsupported claims" value={dashboardMetrics.unsupportedClaims} tone="bg-destructive/10 text-destructive" />
        <Metric icon={FileCheck} label="Reports ready" value={dashboardMetrics.reportsReady} tone="bg-success/10 text-success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Active cases</h2>
            <Link to="/cases" className="text-sm text-primary hover:underline inline-flex items-center gap-1">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <div className="divide-y divide-border">
            {cases.map(c => (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="flex items-center justify-between py-4 hover:bg-accent/40 -mx-2 px-2 rounded-md">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.reference} · {c.court}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending review</div>
                  <div className="font-serif text-lg">{c.pendingReview}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-xl mb-4">Recent activity</h2>
          <ul className="space-y-4">
            {recentActivity.map(a => (
              <li key={a.id} className="text-sm">
                <div><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.case} · {a.when}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppLayout>
  );
}
