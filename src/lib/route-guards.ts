import { redirect } from "@tanstack/react-router";
import { authorizeRoute, requireAuthenticated } from "@/lib/permissions.functions";
import { ROLE_GROUPS, type AppRole, type RoleGroup } from "@/lib/permissions";

/**
 * Server-side authentication guard for authenticated route loaders that need
 * data but no specific role. Calls a `requireSupabaseAuth`-protected server fn,
 * so the access decision is enforced on the server (validated bearer token) and
 * cannot be bypassed by tampering with the client-only `_authenticated` gate.
 * Redirects unauthenticated callers to `/auth`.
 */
export async function requireSession(): Promise<{ userId: string }> {
  try {
    return await requireAuthenticated();
  } catch {
    throw redirect({ to: "/auth" });
  }
}

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
  const { authorized, roles } = await authorizeRoute({
    data: { allowed: ROLE_GROUPS[group], surface: group },
  });
  if (!authorized) {
    throw redirect({ to: "/unauthorized", search: { from: group } });
  }
  return { roles };
}
