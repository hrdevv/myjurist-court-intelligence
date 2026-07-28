import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppLayout";

export function DemoOutputsDisabled({ surface }: { surface: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Demo boundary"
        title={`${surface} disabled`}
        description="This surface uses mock/demo legal outputs and is disabled unless demo mode is explicitly enabled."
      />
      <Card className="p-6 border-warning/40 bg-warning/10">
        <div className="flex items-start gap-3 text-sm text-warning-foreground">
          <ShieldAlert className="size-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>
              Set <span className="font-mono">VITE_DEMO_LEGAL_OUTPUTS=enabled</span> only in demo or
              prototype environments where mock AI claims, report previews, and demo team data are expected.
            </p>
            <p>
              Production environments must keep this disabled until persisted claims, review decisions,
              report generation, and team-management APIs replace the mock data paths.
            </p>
            <Link to="/" className="inline-block text-primary hover:underline">
              Return to dashboard →
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
