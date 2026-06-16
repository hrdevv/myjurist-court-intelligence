import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cases } from "@/lib/mock-data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({ meta: [{ title: "Cases — Courtroom Intelligence" }, { name: "description", content: "Manage all active and archived legal cases, track sessions pending review, and open case files scoped to your role and organization." }] }),
  component: CasesIndex,
});

function CasesIndex() {
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Cases"
        title="All cases"
        description="Demo data only. Production cases will be scoped per tenant and role."
        actions={<Button><Plus className="size-4" /> Create case</Button>}
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Title</th>
              <th className="text-left px-5 py-3 font-medium">Reference</th>
              <th className="text-left px-5 py-3 font-medium">Court</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-right px-5 py-3 font-medium">Pending review</th>
              <th className="text-left px-5 py-3 font-medium">Last activity</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map(c => (
              <tr key={c.id} className="hover:bg-accent/30">
                <td className="px-5 py-4 font-medium">{c.title}</td>
                <td className="px-5 py-4 text-muted-foreground">{c.reference}</td>
                <td className="px-5 py-4 text-muted-foreground">{c.court}</td>
                <td className="px-5 py-4"><span className="inline-block px-2 py-0.5 rounded bg-success/10 text-success text-xs border border-success/30 capitalize">{c.status}</span></td>
                <td className="px-5 py-4 text-right font-serif">{c.pendingReview}</td>
                <td className="px-5 py-4 text-muted-foreground">{c.lastActivity}</td>
                <td className="px-5 py-4 text-right"><Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-primary text-sm hover:underline">View case →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
