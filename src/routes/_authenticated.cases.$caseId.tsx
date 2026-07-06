import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { ScrollableTable, stickyTableHeaderClass } from "@/components/ui/scrollable-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreateSessionDialog } from "@/components/cases/CreateSessionDialog";
import { getCaseDetail, type SessionRow } from "@/lib/cases.functions";
import { teamForCase } from "@/lib/session-content";
import { requireSession } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({ meta: [{ title: "Case — Courtroom Intelligence" }, { name: "description", content: "Case detail: sessions, evidence, reports, team, and audit trail." }] }),
  loader: async ({ params }) => {
    await requireSession();
    const result = await getCaseDetail({ data: { id: params.caseId } });
    if (!result) throw notFound();
    return result;
  },
  notFoundComponent: () => <AppLayout><PageHeader title="Case not found" /></AppLayout>,
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: CaseDetail,
});

function sessionStatusLabel(status: string) {
  switch (status) {
    case "review_pending":
      return { text: "Review pending", cls: "bg-warning/15 text-warning-foreground border-warning/40" };
    case "report_ready":
      return { text: "Report ready", cls: "bg-success/10 text-success border-success/30" };
    case "in_review":
      return { text: "In review", cls: "bg-primary/10 text-primary border-primary/30" };
    default:
      return { text: "Draft", cls: "bg-muted text-muted-foreground border-border" };
  }
}

function CaseDetail() {
  const { caseData, sessions } = Route.useLoaderData();
  const team = teamForCase(caseData);
  const pendingCount = sessions.filter((s) => s.status === "review_pending").length;

  return (
    <AppLayout>
      <PageHeader
        eyebrow={caseData.reference}
        title={caseData.title}
        description={`${caseData.court ?? "Court not set"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"} on record`}
        actions={<>
          <Button variant="outline"><Upload className="size-4" /> Upload evidence</Button>
          <CreateSessionDialog caseId={caseData.id} />
        </>}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid lg:grid-cols-3 gap-6">
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-serif text-lg mb-3">Case metadata</h3>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Reference</dt><dd>{caseData.reference}</dd>
              <dt className="text-muted-foreground">Court</dt><dd>{caseData.court ?? "—"}</dd>
              <dt className="text-muted-foreground">Status</dt><dd className="capitalize">{caseData.status}</dd>
              <dt className="text-muted-foreground">Sessions pending review</dt><dd>{pendingCount}</dd>
              <dt className="text-muted-foreground">Last activity</dt><dd>{new Date(caseData.updated_at).toLocaleDateString()}</dd>
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Session summary</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>{sessions.length} session{sessions.length === 1 ? "" : "s"} on record</li>
              <li>{pendingCount} pending review</li>
              <li>{team.length} team member{team.length === 1 ? "" : "s"}</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          {sessions.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">No sessions yet.</p>
              <CreateSessionDialog caseId={caseData.id} />
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <ScrollableTable>
                <table className="w-full text-sm min-w-[560px]">
                  <thead className={`bg-muted text-xs uppercase tracking-wider text-muted-foreground ${stickyTableHeaderClass}`}>
                    <tr><th className="text-left px-5 py-3 font-medium">Session</th><th className="text-left px-5 py-3 font-medium">Date</th><th className="text-left px-5 py-3 font-medium">Status</th><th className="px-5 py-3"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sessions.map((s: SessionRow) => {
                      const badge = sessionStatusLabel(s.status);
                      return (
                        <tr key={s.id} className="hover:bg-accent/30">
                          <td className="px-5 py-4 font-medium">{s.title}</td>
                          <td className="px-5 py-4 text-muted-foreground">{s.date ?? "—"}</td>
                          <td className="px-5 py-4"><span className={`inline-block px-2 py-0.5 rounded text-xs border ${badge.cls}`}>{badge.text}</span></td>
                          <td className="px-5 py-4 text-right"><Link to="/sessions/$sessionId" params={{ sessionId: s.id }} className="text-primary text-sm hover:underline">Open session →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="mt-6">
          <Card className="p-5"><p className="text-sm text-muted-foreground">Open a session to manage evidence files. Evidence must be stored privately in production.</p></Card>
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          {sessions.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-muted-foreground">Create a session to generate a report.</p></Card>
          ) : (
            <Card className="p-5">
              <ul className="space-y-2 text-sm">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link to="/sessions/$sessionId/report" params={{ sessionId: s.id }} className="text-primary hover:underline">Preview report — {s.title} →</Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          {team.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-muted-foreground">No team members yet. Team management arrives in a later phase.</p></Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <ScrollableTable>
                <table className="w-full text-sm min-w-[480px]">
                  <thead className={`bg-muted text-xs uppercase tracking-wider text-muted-foreground ${stickyTableHeaderClass}`}><tr><th className="text-left px-5 py-3 font-medium">Name</th><th className="text-left px-5 py-3 font-medium">Role</th><th className="text-left px-5 py-3 font-medium">Email</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {team.map((m) => (<tr key={m.email}><td className="px-5 py-3 font-medium">{m.name}</td><td className="px-5 py-3 text-muted-foreground">{m.role}</td><td className="px-5 py-3 text-muted-foreground">{m.email}</td></tr>))}
                  </tbody>
                </table>
              </ScrollableTable>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <Card className="p-5"><p className="text-sm text-muted-foreground">Audit entries are recorded on every action and surfaced here in the audit phase.</p></Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
