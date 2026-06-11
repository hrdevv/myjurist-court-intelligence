import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { ROLE_GROUPS, type AppRole, type RoleGroup } from "@/lib/permissions";

// e2e-style check: drive each guarded route's real loader through the shared
// guard. The backend authorization server fn is mocked to act exactly like the
// real one (authorized when the user holds an allowed role), so we exercise the
// full loader -> guardRouteAccess -> redirect path without a live backend.
const authorizeRouteMock = vi.fn();
vi.mock("@/lib/permissions.functions", () => ({
  authorizeRoute: (args: { data: { allowed: AppRole[]; surface?: RoleGroup } }) =>
    authorizeRouteMock(args),
  getMyRoles: () => Promise.resolve({ roles: [] }),
}));

import { Route as AuditRoute } from "@/routes/_authenticated.audit";
import { Route as TeamRoute } from "@/routes/_authenticated.team";
import { Route as ReviewRoute } from "@/routes/_authenticated.review";
import { Route as SessionReviewRoute } from "@/routes/_authenticated.sessions.$sessionId.review";

function mockBackendForRoles(userRoles: AppRole[]) {
  authorizeRouteMock.mockImplementation(
    async (input: { data: { allowed: AppRole[] } }) => ({
      roles: userRoles,
      authorized: input.data.allowed.some((role) => userRoles.includes(role)),
    }),
  );
}

type GuardedCase = {
  name: string;
  group: RoleGroup;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loader: (...args: any[]) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
};

const guardedRoutes: GuardedCase[] = [
  { name: "/audit", group: "audit", loader: AuditRoute.options.loader as GuardedCase["loader"], args: {} },
  { name: "/team", group: "team", loader: TeamRoute.options.loader as GuardedCase["loader"], args: {} },
  { name: "/review", group: "reviewQueue", loader: ReviewRoute.options.loader as GuardedCase["loader"], args: {} },
  {
    name: "/sessions/$sessionId/review",
    group: "reviewQueue",
    loader: SessionReviewRoute.options.loader as GuardedCase["loader"],
    args: { params: { sessionId: "s1" } },
  },
];

const ALL_ROLES: AppRole[] = ["lawyer", "paralegal", "reviewer", "viewer"];

describe("guarded routes (e2e loader checks)", () => {
  beforeEach(() => authorizeRouteMock.mockReset());

  describe.each(guardedRoutes)("$name", ({ group, loader, args }) => {
    const allowedRoles = ROLE_GROUPS[group] as AppRole[];
    const deniedRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));

    it.each(allowedRoles)("loads normally for allowed role %s", async (role: AppRole) => {
      mockBackendForRoles([role]);
      let thrown: unknown;
      try {
        await loader(args);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeUndefined();
    });

    it.each(deniedRoles)(
      "redirects disallowed role %s to /unauthorized with the blocked surface",
      async (role: AppRole) => {
        mockBackendForRoles([role]);
        try {
          await loader(args);
          throw new Error("expected redirect to /unauthorized");
        } catch (thrown) {
          expect(isRedirect(thrown)).toBe(true);
          const redirect = thrown as { options: { to: string; search: { from: RoleGroup } } };
          expect(redirect.options.to).toBe("/unauthorized");
          expect(redirect.options.search.from).toBe(group);
        }
      },
    );
  });
});
