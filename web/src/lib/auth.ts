import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PAGES, can, type PageKey } from "@/lib/permissions";

/**
 * The signed-in user and their profile, loaded once per request and shared by
 * the (app) layout and the page. Null when nobody is signed in.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, must_change_password, deactivated_at")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
});

/**
 * Signed-in, active user (redirects otherwise). Layouts and pages render in
 * parallel, so pages call this instead of relying on the layout's redirects.
 */
export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  // Deactivation also bans the account in Supabase Auth, but an already
  // issued session can outlive that until it expires, so sign it out here.
  if (me.profile?.deactivated_at) redirect("/auth/deactivated");
  if (me.profile?.must_change_password) redirect("/change-password");
  return me;
}

/** Like requireUser(), and redirects to the dashboard when the role may not open the page. */
export async function requirePage(page: PageKey) {
  const me = await requireUser();
  if (!can(me.profile?.role, PAGES[page].permission)) redirect(`/dashboard?denied=${page}`);
  return me;
}

/**
 * For server actions, which can be called directly: the signed-in user when
 * the account is active and needs no password change, otherwise null.
 */
export async function getActiveUser() {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.deactivated_at || me.profile.must_change_password) return null;
  return { supabase: me.supabase, user: me.user, profile: me.profile, role: me.profile.role as string };
}
