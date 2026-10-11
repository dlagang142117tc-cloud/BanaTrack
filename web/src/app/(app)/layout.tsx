import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireUser();

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
