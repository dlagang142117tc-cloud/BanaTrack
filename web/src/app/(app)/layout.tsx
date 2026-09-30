import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, must_change_password, deactivated_at")
    .eq("id", user.id)
    .single();

  // Deactivation also bans the account in Supabase Auth, but an already
  // issued session can outlive that until it expires, so sign it out here.
  if (profile?.deactivated_at) {
    redirect("/auth/deactivated");
  }
  if (profile?.must_change_password) {
    redirect("/change-password");
  }

  return (
    <AppShell
      user={{
        email: user.email ?? "",
        name: profile?.full_name ?? null,
        role: profile?.role ?? null,
      }}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
