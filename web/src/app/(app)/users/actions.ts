"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, isRole } from "@/lib/roles";

export type RoleUpdateState = { ok: boolean; message: string } | undefined;

export async function updateUserRole(_prevState: RoleUpdateState, formData: FormData): Promise<RoleUpdateState> {
  const userId = formData.get("user_id");
  const role = formData.get("role");
  if (typeof userId !== "string" || !isRole(role)) {
    return { ok: false, message: "Invalid role change request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Your session has expired. Sign in again." };
  }

  // Server actions are callable directly, so re-check admin here rather than
  // trusting that the page was only shown to admins.
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return { ok: false, message: "Only admins can change roles." };
  }

  if (userId === user.id) {
    return { ok: false, message: "You can't change your own role." };
  }

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target) {
    return { ok: false, message: "That user no longer exists." };
  }
  if (target.role === role) {
    return { ok: true, message: `Already ${ROLE_LABELS[role]}.` };
  }

  if (target.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, message: "The last remaining admin can't be demoted." };
    }
  }

  // The guard_role_change trigger re-checks both safety rules in the database.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  // RLS filters rows silently instead of raising, so zero rows means denied.
  if (!updated?.length) {
    return { ok: false, message: "The change wasn't saved — permission denied." };
  }

  revalidatePath("/users");
  return { ok: true, message: `Role changed to ${ROLE_LABELS[role]}.` };
}
