import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tables that record a user's field work. Accounts with rows in any of these
 * must be deactivated instead of deleted, to keep the audit trail intact.
 * Add each table here once it exists, e.g.
 *   { table: "screenings", column: "submitted_by" },
 *   { table: "review_actions", column: "reviewer_id" },
 */
const ACTIVITY_TABLES: { table: string; column: string }[] = [
  { table: "incidents", column: "reported_by" },
  { table: "incidents", column: "last_edited_by" },
  { table: "incident_photos", column: "uploaded_by" },
];

/** "unknown" when a lookup failed. Pass the service-role client so every table is visible. */
export async function activityStatus(admin: SupabaseClient, userId: string): Promise<"yes" | "no" | "unknown"> {
  const results = await Promise.all(
    ACTIVITY_TABLES.map(({ table, column }) =>
      admin.from(table).select(column, { count: "exact", head: true }).eq(column, userId),
    ),
  );
  if (results.some((r) => (r.count ?? 0) > 0)) return "yes";
  if (results.some((r) => r.error)) return "unknown";
  return "no";
}
