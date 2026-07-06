import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { ScrollableTable, stickyTableHeaderClass } from "@/components/ui/scrollable-table";
import { CreateCaseDialog } from "@/components/cases/CreateCaseDialog";
import { listCases, type CaseRow } from "@/lib/cases.functions";
import { requireSession } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({ meta: [{ title: "Cases — Courtroom Intelligence" }, { name: "description", content: "Manage all active and archived legal cases, track sessions pending review, and open case files scoped to your role and organization." }] }),
  loader: async () => {
    await requireSession();
    const cases = await listCases();
    return { cases };
  },
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: CasesIndex,
});

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-success/10 text-success border-success/30";
    case "archived":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-warning/15 text-warning-foreground border-warning/40";
  }
}

function CasesIndex() {
  const { cases } = Route.useLoaderData();

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Cases"
        title="All cases"
        description="Cases are scoped to you and the members you add. The demo case is shared for reference."
        actions={<CreateCaseDialog />}
      />
      {cases.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">You have no cases yet.</p>
          <CreateCaseDialog />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ScrollableTable>
            <table className="w-full text-sm min-w-[760px]">
              <thead className={`bg-muted text-xs uppercase tracking-wider text-muted-foreground ${stickyTableHeaderClass}`}>
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Title</th>
                  <th className="text-left px-5 py-3 font-medium">Reference</th>
                  <th className="text-left px-5 py-3 font-medium">Court</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Last activity</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cases.map((c: CaseRow) => (
                  <tr key={c.id} className="hover:bg-accent/30">
                    <td className="px-5 py-4 font-medium">
                      {c.title}
                      {c.is_demo && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">Demo</span>}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{c.reference}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.court ?? "—"}</td>
                    <td className="px-5 py-4"><span className={`inline-block px-2 py-0.5 rounded text-xs border capitalize ${statusClass(c.status)}`}>{c.status}</span></td>
                    <td className="px-5 py-4 text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right"><Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-primary text-sm hover:underline">View case →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      )}
    </AppLayout>
  );
}
