import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_ROLES, ROLE_GROUP_LABELS, hasAnyRole, type AppRole, type RoleGroup } from "@/lib/permissions";

const roleSchema = z.enum(ALL_ROLES as [AppRole, ...AppRole[]]);
const surfaceSchema = z.enum(
  Object.keys(ROLE_GROUP_LABELS) as [RoleGroup, ...RoleGroup[]],
);

/**
 * Reads the authenticated user's roles from the backend. RLS scopes the
 * `user_roles` query to the current user, so this is a trustworthy
 * server-side source of truth (never client-supplied role claims).
 */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ roles: AppRole[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) {
      // Fail closed: no confirmed roles means lowest privilege.
      return { roles: [] };
    }
    return { roles: (data ?? []).map((row) => row.role as AppRole) };
  });

/**
 * Backend authorization guard. Computes the access decision server-side from
 * the user's real roles and returns it to the caller (a route loader), which
 * redirects on `authorized === false`. The decision itself is never trusted to
 * the client.
 */
export const authorizeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { allowed: AppRole[]; surface?: RoleGroup }) =>
    z
      .object({
        allowed: z.array(roleSchema).min(1).max(ALL_ROLES.length),
        surface: surfaceSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ roles: AppRole[]; authorized: boolean }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = error ? [] : (rows ?? []).map((row) => row.role as AppRole);
    const authorized = hasAnyRole(roles, data.allowed);

    if (!authorized) {
      // Server-side audit log so permission issues can be troubleshooted.
      // Includes the blocked surface/route, the roles required to access it,
      // and the caller's actual roles. Never trusts client-supplied claims.
      const surfaceLabel = data.surface ? ROLE_GROUP_LABELS[data.surface] : "unknown surface";
      console.warn(
        `[authz] access denied -> /unauthorized | surface=${data.surface ?? "unknown"} (${surfaceLabel}) | requiredRoles=[${data.allowed.join(", ")}] | userId=${userId} | userRoles=[${roles.join(", ") || "none"}]`,
      );
    }

    return { roles, authorized };
  });

/**
 * Lightweight server-side authentication guard. Forces a real, server-validated
 * bearer-token check (via `requireSupabaseAuth`) for any route loader that
 * fetches data but does not require a specific role. This backs the browser-only
 * `_authenticated` layout gate with genuine server-side enforcement, so the
 * redirect cannot be bypassed once real data is wired in.
 */
export const requireAuthenticated = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ userId: string }> => {
    return { userId: context.userId };
  });
