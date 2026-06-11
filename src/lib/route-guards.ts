import { redirect } from "@tanstack/react-router";
import { authorizeRoute } from "@/lib/permissions.functions";
import { ROLE_GROUPS, type AppRole, type RoleGroup } from "@/lib/permissions";

/**
 * Single shared permission/redirect guard for route loaders.
 *
 * Computes the access decision server-side (via `authorizeRoute`, which reads
 * the caller's real roles under RLS) and redirects unauthorized users to the
 * `/unauthorized` page, passing the blocked surface as a search param so the
 * page can render role-based guidance. Returns the caller's roles on success
 * so loaders can reuse them without an extra round-trip.
 */
export async function guardRouteAccess(group: RoleGroup): Promise<{ roles: AppRole[] }> {
  const { authorized, roles } = await authorizeRoute({ data: { allowed: ROLE_GROUPS[group] } });
  if (!authorized) {
    throw redirect({ to: "/unauthorized", search: { from: group } });
  }
  return { roles };
}
