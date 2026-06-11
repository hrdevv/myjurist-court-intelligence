// Client-safe shared permission types and helpers.
// No server-only imports here so this module can be used in components,
// route loaders, hooks, and server functions alike.

export type AppRole = "lawyer" | "paralegal" | "reviewer" | "viewer";

export const ALL_ROLES: readonly AppRole[] = ["lawyer", "paralegal", "reviewer", "viewer"];

/**
 * Role groups that gate access to specific screens. Each value is the set of
 * roles allowed to view/act on that surface. `viewer` is intentionally the
 * lowest privilege and is excluded from review/team/audit surfaces.
 */
export const ROLE_GROUPS = {
  reviewQueue: ["lawyer", "paralegal", "reviewer"],
  team: ["lawyer", "paralegal"],
  audit: ["lawyer", "reviewer"],
} satisfies Record<string, AppRole[]>;

export type RoleGroup = keyof typeof ROLE_GROUPS;

/** Human-readable labels for each role, used in UI guidance. */
export const ROLE_LABELS: Record<AppRole, string> = {
  lawyer: "Lawyer",
  paralegal: "Paralegal",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

/** Human-readable labels for each gated surface, used in UI guidance. */
export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  reviewQueue: "Review queue",
  team: "Team management",
  audit: "Audit trail",
};

/** Returns true when `roles` contains at least one of `allowed`. */
export function hasAnyRole(roles: readonly AppRole[], allowed: readonly AppRole[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

/** Returns true when `roles` contains the exact `role`. */
export function hasRole(roles: readonly AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}
