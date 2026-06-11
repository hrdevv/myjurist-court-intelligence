import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { guardRouteAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit — Courtroom Intelligence" }, { name: "description", content: "Audit trail handoff notes." }] }),
  loader: async () => {
    await guardRouteAccess("audit");
  },
  errorComponent: () => <AppLayout><PageHeader title="Something went wrong" /></AppLayout>,
  component: Audit,
});

const entries = [
  { when: "2026-05-22 14:32", who: "Reviewer User", action: "approved claim c1 (Evidence-linked statement)" },
  { when: "2026-05-22 14:18", who: "Lawyer User", action: "rejected claim c3 (Unsupported inference)" },
  { when: "2026-05-22 13:50", who: "Paralegal User", action: "uploaded evidence: hearing-recording-2026-05-22.mp3" },
  { when: "2026-05-22 13:42", who: "Paralegal User", action: "pasted transcript segment t1" },
];

function Audit() {
  return (
    <AppLayout>
      <PageHeader eyebrow="Compliance" title="Audit trail" description="Prototype data. Production audit logs will be append-only and exportable." />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-5 py-3 font-medium">When</th><th className="text-left px-5 py-3 font-medium">Who</th><th className="text-left px-5 py-3 font-medium">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e, i) => (<tr key={i}><td className="px-5 py-3 font-mono text-xs">{e.when}</td><td className="px-5 py-3">{e.who}</td><td className="px-5 py-3 text-muted-foreground">{e.action}</td></tr>))}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
