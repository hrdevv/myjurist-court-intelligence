import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { sessions } from "@/lib/mock-data";
import { requireSession } from "@/lib/route-guards";
import { DemoOutputsDisabled } from "@/components/legal/DemoOutputsDisabled";
import { requireDemoLegalOutputs } from "@/lib/demo-mode";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Courtroom Intelligence" }, { name: "description", content: "Preview and export human-reviewed legal session reports, with every claim verified and linked to its supporting evidence." }] }),
  loader: async () => {
    await requireSession();
    return { demoLegalOutputsEnabled: requireDemoLegalOutputs() };
  },
  component: Reports,
});

function Reports() {
  const { demoLegalOutputsEnabled } = Route.useLoaderData();

  if (!demoLegalOutputsEnabled) {
    return (
      <AppLayout>
        <DemoOutputsDisabled surface="Reports" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader eyebrow="Workspace" title="Reports" description="Human-reviewed report previews per session." />
      <div className="grid md:grid-cols-2 gap-4">
        {sessions.map(s => (
          <Card key={s.id} className="p-5">
            <h3 className="font-serif text-lg">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{s.date} · Draft report</p>
            <Link to="/sessions/$sessionId/report" params={{ sessionId: s.id }} className="text-primary text-sm hover:underline mt-3 inline-block">Open preview →</Link>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
