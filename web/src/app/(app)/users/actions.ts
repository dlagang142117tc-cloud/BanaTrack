"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordError } from "@/lib/passwords";
import { ROLE_LABELS, isRole, type Role } from "@/lib/roles";

export type ActionState = { ok: boolean; message: string } | undefined;

type AdminAction = "role_change" | "password_reset" | "deactivate" | "reactivate" | "delete";

// Deactivation is a ban of this length; reactivating lifts it with "none".
const BAN_DURATION = "876000h"; // ~100 years

/**
 * Tables that record a user's field work. Accounts with rows in any of these
 * must be deactivated instead of deleted, to keep the audit trail intact.
 * Add each table here once it exists, e.g.
 *   { table: "screenings", column: "submitted_by" },
 *   { table: "review_actions", column: "reviewer_id" },
 */
const ACTIVITY_TABLES: { table: string; column: string }[] = [
  { table: "incidents", column: "reported_by" },
  { table: "incident_photos", column: "uploaded_by" },
];

function fail(message: string): ActionState {
  return { ok: false, message };
}

/**
 * Server actions are callable directly, so every action re-checks that the
 * caller is a signed-in, active admin rather than trusting the page gate.
 */
async function requireAdmin(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; user: User } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Sign in again." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, deactivated_at, must_change_password")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" || me.deactivated_at || me.must_change_password) {
    return { error: "Only active admins can manage users." };
  }
  return { supabase, user };
}

interface Target {
  id: string;
  email: string;
  role: Role;
  deactivatedAt: string | null;
}

async function getTarget(admin: SupabaseClient, userId: string): Promise<Target | null> {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("role, deactivated_at").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (!profile || !authUser.user) return null;
  return { id: userId, email: authUser.user.email ?? "", role: profile.role, deactivatedAt: profile.deactivated_at };
}

async function isLastActiveAdmin(client: SupabaseClient, target: Pick<Target, "role" | "deactivatedAt">) {
  if (target.role !== "admin" || target.deactivatedAt) return false;
  const { count } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("deactivated_at", null);
  return (count ?? 0) <= 1;
}

async function hasActivityRecords(admin: SupabaseClient, userId: string) {
  for (const { table, column } of ACTIVITY_TABLES) {
    const { count, error } = await admin.from(table).select(column, { count: "exact", head: true }).eq(column, userId);
    // fail safe: if we can't tell, don't allow a permanent delete
    if (error || (count ?? 0) > 0) return true;
  }
  return false;
}

/** Audit rows never include passwords. A failed insert doesn't undo the action. */
async function logAction(
  actorId: string,
  action: AdminAction,
  target: { id: string; email?: string },
  details?: Record<string, string>,
) {
  try {
    const admin = createAdminClient();
    const email = target.email ?? (await admin.auth.admin.getUserById(target.id)).data.user?.email ?? null;
    const { error } = await admin.from("admin_actions").insert({
      actor_id: actorId,
      action,
      target_user_id: target.id,
      target_email: email,
      details: details ?? null,
    });
    if (error) console.error(`admin_actions insert failed (${action}): ${error.message}`);
  } catch (e) {
    console.error(`admin_actions insert failed (${action}): ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

/** Runs the service-role part of an action, turning a missing key into a readable error. */
async function withAdminClient(run: (admin: SupabaseClient) => Promise<ActionState>): Promise<ActionState> {
  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Server is missing SUPABASE_SERVICE_ROLE_KEY — see web/.env.local.example.");
  }
  return run(admin);
}

// ------------------------------------------------------------ role change

export async function updateUserRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = formData.get("user_id");
  const role = formData.get("role");
  if (typeof userId !== "string" || !isRole(role)) {
    return fail("Invalid role change request.");
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return fail(ctx.error);
  const { supabase, user } = ctx;

  if (userId === user.id) {
    return fail("You can't change your own role.");
  }

  const { data: target } = await supabase.from("profiles").select("role, deactivated_at").eq("id", userId).single();
  if (!target) {
    return fail("That user no longer exists.");
  }
  if (target.role === role) {
    return { ok: true, message: `Already ${ROLE_LABELS[role]}.` };
  }
  if (role !== "admin" && (await isLastActiveAdmin(supabase, { role: target.role, deactivatedAt: target.deactivated_at }))) {
    return fail("The last active admin can't be demoted.");
  }

  // Role changes go through RLS with the admin's own session; the
  // guard_role_change trigger re-checks both safety rules in the database.
  const { data: updated, error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("id");
  if (error) {
    return fail(error.message);
  }
  // RLS filters rows silently instead of raising, so zero rows means denied.
  if (!updated?.length) {
    return fail("The change wasn't saved — permission denied.");
  }

  await logAction(user.id, "role_change", { id: userId }, { from: target.role, to: role });

  revalidatePath("/users");
  return { ok: true, message: `Role changed to ${ROLE_LABELS[role]}.` };
}

// ------------------------------------------------------------ reset password

export async function resetUserPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = formData.get("user_id");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (typeof userId !== "string") {
    return fail("Invalid request.");
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return fail(ctx.error);
  if (userId === ctx.user.id) {
    return fail("You can't reset your own password here.");
  }

  const invalid = passwordError(password, confirm);
  if (invalid) return fail(invalid);

  return withAdminClient(async (admin) => {
    const target = await getTarget(admin, userId);
    if (!target) return fail("That user no longer exists.");

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return fail(error.message);

    const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    if (flagError) {
      return fail(`Password was set, but the change-password flag wasn't: ${flagError.message}`);
    }

    await logAction(ctx.user.id, "password_reset", target);
    revalidatePath("/users");
    return { ok: true, message: `Temporary password set for ${target.email}. They must change it at next sign-in.` };
  });
}

// ------------------------------------------------------------ deactivate / reactivate

export async function setUserActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = formData.get("user_id");
  const active = formData.get("active") === "true";
  if (typeof userId !== "string") {
    return fail("Invalid request.");
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return fail(ctx.error);
  if (userId === ctx.user.id) {
    return fail(active ? "You can't reactivate yourself." : "You can't deactivate yourself.");
  }

  return withAdminClient(async (admin) => {
    const target = await getTarget(admin, userId);
    if (!target) return fail("That user no longer exists.");

    if (active) {
      if (!target.deactivatedAt) return { ok: true, message: `${target.email} is already active.` };

      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) return fail(error.message);
      const { error: profileError } = await admin.from("profiles").update({ deactivated_at: null }).eq("id", userId);
      if (profileError) return fail(profileError.message);

      await logAction(ctx.user.id, "reactivate", target);
      revalidatePath("/users");
      return { ok: true, message: `${target.email} can sign in again.` };
    }

    if (target.deactivatedAt) return { ok: true, message: `${target.email} is already deactivated.` };
    if (await isLastActiveAdmin(admin, target)) {
      return fail("The last active admin can't be deactivated.");
    }

    // Profile first so the database trigger gets the final say on the
    // last-admin rule, then ban so Supabase Auth refuses sign-in and refresh.
    const { error: profileError } = await admin
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) return fail(profileError.message);

    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION });
    if (error) {
      await admin.from("profiles").update({ deactivated_at: null }).eq("id", userId);
      return fail(error.message);
    }

    await logAction(ctx.user.id, "deactivate", target);
    revalidatePath("/users");
    return { ok: true, message: `${target.email} has been deactivated.` };
  });
}

// ------------------------------------------------------------ delete

export async function deleteUserAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = formData.get("user_id");
  const typedEmail = String(formData.get("confirm_email") ?? "").trim().toLowerCase();
  if (typeof userId !== "string") {
    return fail("Invalid request.");
  }

  const ctx = await requireAdmin();
  if ("error" in ctx) return fail(ctx.error);
  if (userId === ctx.user.id) {
    return fail("You can't delete your own account.");
  }

  return withAdminClient(async (admin) => {
    const target = await getTarget(admin, userId);
    if (!target) return fail("That user no longer exists.");

    if (!typedEmail || typedEmail !== target.email.toLowerCase()) {
      return fail("The email you typed doesn't match this account.");
    }
    if (await isLastActiveAdmin(admin, target)) {
      return fail("The last active admin can't be deleted.");
    }
    if (await hasActivityRecords(admin, userId)) {
      return fail("This user has recorded field activity. Deactivate the account instead of deleting it.");
    }

    // Cascades to public.profiles; guard_profiles_delete re-checks the last-admin rule.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return fail(error.message);

    await logAction(ctx.user.id, "delete", target);
    revalidatePath("/users");
    return { ok: true, message: `${target.email} was permanently deleted.` };
  });
}
