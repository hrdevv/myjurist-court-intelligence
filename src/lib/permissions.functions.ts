import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_ROLES, hasAnyRole, type AppRole } from "@/lib/permissions";

const roleSchema = z.enum(ALL_ROLES as [AppRole, ...AppRole[]]);

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
  .inputValidator((data: { allowed: AppRole[] }) =>
    z.object({ allowed: z.array(roleSchema).min(1).max(ALL_ROLES.length) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ roles: AppRole[]; authorized: boolean }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = error ? [] : (rows ?? []).map((row) => row.role as AppRole);
    return { roles, authorized: hasAnyRole(roles, data.allowed) };
  });
