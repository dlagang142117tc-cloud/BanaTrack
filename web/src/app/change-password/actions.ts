"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordError } from "@/lib/passwords";

export async function changePassword(_prevState: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const invalid = passwordError(password, confirm);
  if (invalid) {
    return { error: invalid };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("deactivated_at")
    .eq("id", user.id)
    .single();
  if (profile?.deactivated_at) {
    redirect("/auth/deactivated");
  }

  // Changed with the user's own session, so it only ever affects themselves.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.code === "same_password" ? "Choose a password different from the temporary one." : error.message };
  }

  // Users can't write this column themselves (see supabase/migrations/003_admin_actions.sql),
  // so clear it with the service role, scoped to the verified user's own row.
  try {
    const { error: flagError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (flagError) {
      return { error: `Password changed, but your account couldn't be updated: ${flagError.message}` };
    }
  } catch {
    return { error: "Password changed, but the server is missing SUPABASE_SERVICE_ROLE_KEY. Ask an admin." };
  }

  redirect("/dashboard");
}
