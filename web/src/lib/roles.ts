/** Mirrors the public.user_role enum in supabase/migrations/001_schema.sql. */
export const ROLES = ["admin", "supervisor", "disease_in_charge", "field_personnel"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  disease_in_charge: "Disease In-Charge",
  field_personnel: "Field Personnel",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
