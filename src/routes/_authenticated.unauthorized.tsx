import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { getMyRoles } from "@/lib/permissions.functions";
import {
  ROLE_GROUPS,
  ROLE_GROUP_LABELS,
  ROLE_LABELS,
  type RoleGroup,
} from "@/lib/permissions";

type UnauthorizedSearch = { from?: RoleGroup };

export const Route = createFileRoute("/_authenticated/unauthorized")({
  head: () => ({
    meta: [
      { title: "Access denied — Courtroom Intelligence" },
      { name: "description", content: "You do not have permission to view this page." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): UnauthorizedSearch => {
    const from = search.from;
    if (typeof from === "string" && from in ROLE_GROUP_LABELS) {
      return { from: from as RoleGroup };
    }
    return {};
  },
  component: Unauthorized,
});

function Unauthorized() {
  const { from } = Route.useSearch() as UnauthorizedSearch;
  const fetchRoles = useServerFn(getMyRoles);
  const { data } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
  });

  const myRoles = data?.roles ?? [];
  const requiredRoles = from ? ROLE_GROUPS[from] : [];
  const areaLabel = from ? ROLE_GROUP_LABELS[from] : null;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Access control"
        title="Access denied"
        description={
          areaLabel
            ? `Your role does not grant access to ${areaLabel}.`
            : "Your role does not grant access to this area."
        }
      />

      <div className="grid gap-4 max-w-2xl">
        <Card className="p-6 flex items-start gap-4 border-destructive/30 bg-destructive/5">
          <ShieldAlert className="size-6 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {areaLabel
                ? `The "${areaLabel}" area is restricted to specific roles. Your current account does not include one of them.`
                : "This page is restricted to specific roles."}{" "}
              If you believe you should have access, contact a lawyer or administrator on your team to update your
              permissions.
            </p>
          </div>
        </Card>

        {requiredRoles.length > 0 && (
          <Card className="p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Roles that can access this area</div>
              <div className="flex flex-wrap gap-2">
                {requiredRoles.map((role) => (
                  <Badge key={role} variant={myRoles.includes(role) ? "default" : "secondary"}>
                    {myRoles.includes(role) && <CheckCircle2 className="size-3" />}
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your current roles</div>
              <div className="flex flex-wrap gap-2">
                {myRoles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No roles assigned yet.</span>
                ) : (
                  myRoles.map((role) => (
                    <Badge key={role} variant="outline">{ROLE_LABELS[role]}</Badge>
                  ))
                )}
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">You always have access to your dashboard.</p>
          <Button asChild>
            <Link to="/">Back to dashboard <ArrowRight className="size-4" /></Link>
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
