import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { mockUsers } from "@/lib/mock-data";
import { guardRouteAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — Courtroom Intelligence" }, { name: "description", content: "Organization members and roles." }] }),
  loader: async () => {
    await guardRouteAccess("team");
  },
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: Team,
});

function Team() {
  return (
    <AppLayout>
      <PageHeader eyebrow="Demo Legal Practice" title="Team" description="Role-based access will be enforced server-side in production." />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
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
      </Card>
    </AppLayout>
  );
}
