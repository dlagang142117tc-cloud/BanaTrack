import { isRole, type Role } from "./roles";

// The role matrix from docs/role-matrix.md. Every page, sidebar link and
// server action checks these with can(); nothing else compares role names.
// Rules marked "DB:" are also enforced by the database, so changing one also
// needs a new migration.

const EVERYONE = ["field_personnel", "disease_in_charge", "supervisor", "admin"] as const;

export const PERMISSIONS = {
  // The dashboard itself is open to every role: blocked pages redirect there.
  "dashboard.governance": ["admin"],
  "screening.submit": EVERYONE,
  "incidents.view": EVERYONE,
  "incidents.create": EVERYONE,
  // Reporters can always edit and delete their own incidents.
  // DB: can_edit_any_incident() in 006_role_based_access.sql
  "incidents.editAny": ["disease_in_charge", "supervisor", "admin"],
  // DB: can_delete_any_incident() in 006_role_based_access.sql
  "incidents.deleteAny": ["supervisor", "admin"],
  "review.view": ["disease_in_charge", "supervisor", "admin"],
  // Not enforced anywhere yet: the Review Queue is still sample data.
  "review.act": ["disease_in_charge", "supervisor"],
  "map.view": EVERYONE,
  // Viewing includes PDF export.
  "reports.view": ["disease_in_charge", "supervisor", "admin"],
  // DB: is_admin() in 003_admin_actions.sql
  "users.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** False for an unknown or missing role. */
export function can(role: string | null | undefined, permission: Permission): boolean {
  return isRole(role) && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canEditIncident(role: string | null | undefined, userId: string, reportedBy: string) {
  return reportedBy === userId || can(role, "incidents.editAny");
}

export function canDeleteIncident(role: string | null | undefined, userId: string, reportedBy: string) {
  return reportedBy === userId || can(role, "incidents.deleteAny");
}

/** Pages behind a permission. Opening one without it redirects to /dashboard?denied=<key>. */
export const PAGES = {
  screening: { href: "/screening", label: "Disease Screening", permission: "screening.submit" },
  incidents: { href: "/incidents", label: "Incident Log", permission: "incidents.view" },
  review: { href: "/review", label: "Review Queue", permission: "review.view" },
  map: { href: "/map", label: "Plantation Map", permission: "map.view" },
  reports: { href: "/reports", label: "Reports", permission: "reports.view" },
  users: { href: "/users", label: "Users", permission: "users.manage" },
} as const satisfies Record<string, { href: string; label: string; permission: Permission }>;

export type PageKey = keyof typeof PAGES;

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === "string" && Object.hasOwn(PAGES, value);
}
