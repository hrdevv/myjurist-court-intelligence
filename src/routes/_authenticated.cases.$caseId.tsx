import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCase, sessions } from "@/lib/mock-data";
import { requireSession } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: ({ params }) => {
    const c = getCase(params.caseId);
    return { meta: [{ title: `${c?.title ?? "Case"} — Courtroom Intelligence` }, { name: "description", content: c?.reference ?? "Case detail" }] };
  },
  loader: async ({ params }) => {
    await requireSession();
    const c = getCase(params.caseId);
    if (!c) throw notFound();
    return { caseData: c };
  },
  notFoundComponent: () => <AppLayout><PageHeader title="Case not found" /></AppLayout>,
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: CaseDetail,
});

function CaseDetail() {
  const { caseData } = Route.useLoaderData();
  const caseSessions = sessions.filter(s => s.caseId === caseData.id);

  return (
    <AppLayout>
      <PageHeader
        eyebrow={caseData.reference}
        title={caseData.title}
        description={`${caseData.court} · ${caseSessions.length} session${caseSessions.length === 1 ? "" : "s"} on record`}
        actions={<>
          <Button variant="outline"><Upload className="size-4" /> Upload evidence</Button>
          <Button><FileText className="size-4" /> New session</Button>
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
              <dt className="text-muted-foreground">Court</dt><dd>{caseData.court}</dd>
              <dt className="text-muted-foreground">Status</dt><dd className="capitalize">{caseData.status}</dd>
              <dt className="text-muted-foreground">Pending review</dt><dd>{caseData.pendingReview}</dd>
              <dt className="text-muted-foreground">Last activity</dt><dd>{caseData.lastActivity}</dd>
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Evidence summary</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>3 evidence files (demo)</li>
              <li>5 transcript segments</li>
              <li>4 AI-assisted draft claims</li>
              <li>1 possible inconsistency candidate</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left px-5 py-3 font-medium">Session</th><th className="text-left px-5 py-3 font-medium">Date</th><th className="text-left px-5 py-3 font-medium">Status</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {caseSessions.map(s => (
                  <tr key={s.id} className="hover:bg-accent/30">
                    <td className="px-5 py-4 font-medium">{s.title}</td>
                    <td className="px-5 py-4 text-muted-foreground">{s.date}</td>
                    <td className="px-5 py-4"><span className="inline-block px-2 py-0.5 rounded bg-warning/15 text-warning-foreground text-xs border border-warning/40">Review pending</span></td>
                    <td className="px-5 py-4 text-right"><Link to="/sessions/$sessionId" params={{ sessionId: s.id }} className="text-primary text-sm hover:underline">Open session →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-6">
          <Card className="p-5"><p className="text-sm text-muted-foreground">Open a session to manage evidence files. Evidence must be stored privately in production.</p></Card>
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <Card className="p-5"><Link to="/sessions/$sessionId/report" params={{ sessionId: "s1" }} className="text-primary hover:underline text-sm">Preview demo report →</Link></Card>
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-5 py-3 font-medium">Name</th><th className="text-left px-5 py-3 font-medium">Role</th><th className="text-left px-5 py-3 font-medium">Email</th></tr></thead>
              <tbody className="divide-y divide-border">
                {caseData.team.map((m: {name:string;role:string;email:string}) => (<tr key={m.email}><td className="px-5 py-3 font-medium">{m.name}</td><td className="px-5 py-3 text-muted-foreground">{m.role}</td><td className="px-5 py-3 text-muted-foreground">{m.email}</td></tr>))}
              </tbody>
            </table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <Card className="p-5"><p className="text-sm text-muted-foreground">Audit log entries will be wired to backend during Laravel handoff.</p></Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
