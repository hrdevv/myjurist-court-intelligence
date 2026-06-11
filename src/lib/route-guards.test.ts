import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { ROLE_GROUPS, type AppRole, type RoleGroup } from "@/lib/permissions";

// Mock the server function so the guard's logic can be tested in isolation
// without loading Supabase auth middleware or hitting the backend.
const authorizeRouteMock = vi.fn();
vi.mock("@/lib/permissions.functions", () => ({
  authorizeRoute: (args: { data: { allowed: AppRole[]; surface?: RoleGroup } }) =>
    authorizeRouteMock(args),
}));

import { guardRouteAccess } from "@/lib/route-guards";

/**
 * Make the mocked backend behave like the real one: a user is authorized for a
 * surface when they hold at least one of the roles allowed for it.
 */
function mockBackendForRoles(userRoles: AppRole[]) {
  authorizeRouteMock.mockImplementation(
    async ({ data }: { data: { allowed: AppRole[] } }) => ({
      roles: userRoles,
      authorized: data.allowed.some((role) => userRoles.includes(role)),
    }),
  );
}

const GROUPS = Object.keys(ROLE_GROUPS) as RoleGroup[];
const ALL_ROLES: AppRole[] = ["lawyer", "paralegal", "reviewer", "viewer"];

describe("guardRouteAccess", () => {
  beforeEach(() => {
    authorizeRouteMock.mockReset();
  });

  it("passes the correct allowed roles and surface for each group", async () => {
    for (const group of GROUPS) {
      mockBackendForRoles(["lawyer"]);
      await guardRouteAccess(group);
      expect(authorizeRouteMock).toHaveBeenCalledWith({
        data: { allowed: ROLE_GROUPS[group], surface: group },
      });
      authorizeRouteMock.mockReset();
    }
  });

  describe.each(GROUPS)("group %s", (group) => {
    const allowedRoles = ROLE_GROUPS[group] as AppRole[];
    const deniedRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));

    it.each(allowedRoles)("allows role %s and returns roles", async (role: AppRole) => {
      mockBackendForRoles([role]);
      const result = await guardRouteAccess(group);
      expect(result).toEqual({ roles: [role] });
    });

    it.each(deniedRoles)("redirects role %s to /unauthorized", async (role: AppRole) => {
      mockBackendForRoles([role]);
      try {
        await guardRouteAccess(group);
        throw new Error("expected guardRouteAccess to redirect");
      } catch (thrown) {
        expect(isRedirect(thrown)).toBe(true);
        const redirect = thrown as { options: { to: string; search: { from: RoleGroup } } };
        expect(redirect.options.to).toBe("/unauthorized");
        expect(redirect.options.search.from).toBe(group);
      }
    });
  });

  it("redirects a user with no roles for every guarded surface", async () => {
    for (const group of GROUPS) {
      mockBackendForRoles([]);
      await expect(guardRouteAccess(group)).rejects.toSatisfy(isRedirect);
      authorizeRouteMock.mockReset();
    }
  });
});
