import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { ScrollableTable, stickyTableHeaderClass } from "@/components/ui/scrollable-table";
import { mockUsers } from "@/lib/mock-data";
import { guardRouteAccess } from "@/lib/route-guards";
import { DemoOutputsDisabled } from "@/components/legal/DemoOutputsDisabled";
import { requireDemoLegalOutputs } from "@/lib/demo-mode";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — Courtroom Intelligence" }, { name: "description", content: "View organization members and their roles, and manage role-based access for viewers, reviewers, and lawyers in your workspace." }] }),
  loader: async () => {
    await guardRouteAccess("team");
    return { demoLegalOutputsEnabled: requireDemoLegalOutputs() };
  },
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: Team,
});

function Team() {
  const { demoLegalOutputsEnabled } = Route.useLoaderData();

  if (!demoLegalOutputsEnabled) {
    return (
      <AppLayout>
        <DemoOutputsDisabled surface="Team" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader eyebrow="Demo Legal Practice" title="Team" description="Role-based access will be enforced server-side in production." />
      <Card className="p-0 overflow-hidden">
        <ScrollableTable>
        <table className="w-full text-sm min-w-[480px]">
          <thead className={`bg-muted text-xs uppercase tracking-wider text-muted-foreground ${stickyTableHeaderClass}`}>
            <tr><th className="text-left px-5 py-3 font-medium">Name</th><th className="text-left px-5 py-3 font-medium">Role</th><th className="text-left px-5 py-3 font-medium">Email</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockUsers.map(u => (
              <tr key={u.email}>
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{u.role}</td>
                <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollableTable>
      </Card>
    </AppLayout>
  );
}
