import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/unauthorized")({
  head: () => ({
    meta: [
      { title: "Access denied — Courtroom Intelligence" },
      { name: "description", content: "You do not have permission to view this page." },
    ],
  }),
  component: Unauthorized,
});

function Unauthorized() {
  return (
    <AppLayout>
      <PageHeader eyebrow="Access control" title="Access denied" description="Your role does not grant access to this area." />
      <Card className="p-6 max-w-xl flex items-start gap-4 border-destructive/30 bg-destructive/5">
        <ShieldAlert className="size-6 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This page is restricted to specific roles. If you believe you should have access, contact a lawyer or
            administrator on your team to update your permissions.
          </p>
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
}
