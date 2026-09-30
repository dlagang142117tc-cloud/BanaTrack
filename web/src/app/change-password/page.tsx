import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthFrame } from "@/components/auth-frame";
import { logout } from "../login/actions";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password, deactivated_at")
    .eq("id", user.id)
    .single();
  if (profile?.deactivated_at) {
    redirect("/auth/deactivated");
  }
  if (!profile?.must_change_password) {
    redirect("/dashboard");
  }

  return (
    <AuthFrame
      title="Set a new password"
      subtitle="An admin gave you a temporary password. Choose your own password to continue."
    >
      <ChangePasswordForm />
      <form action={logout} className="mt-6 text-center">
        <button type="submit" className="text-sm font-semibold text-leaf-700 hover:text-leaf-900">
          Sign out instead
        </button>
      </form>
    </AuthFrame>
  );
}
