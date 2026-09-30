import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS and can call the Auth Admin API.
 * `server-only` makes the build fail if a Client Component ever imports this.
 * Only use it after the caller has been verified as an active admin (or, for
 * the change-password flow, as the signed-in user acting on their own row).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in web/.env.local.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
