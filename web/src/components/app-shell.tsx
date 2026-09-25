"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  Menu,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import { cx } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/screening", label: "Disease Screening", icon: ScanSearch },
  { href: "/incidents", label: "Incident Log", icon: ClipboardList },
  { href: "/review", label: "Review Queue", icon: ShieldCheck },
  { href: "/map", label: "Plantation Map", icon: Map },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  disease_in_charge: "Disease In-Charge",
  field_personnel: "Field Personnel",
};

export function AppShell({
  user,
  logoutAction,
  children,
}: {
  user: { email: string; name: string | null; role: string | null };
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const displayName = user.name || user.email;
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  const sidebar = (
    <div className="flex h-full flex-col bg-leaf-950 text-leaf-100">
      <div className="flex items-center justify-between px-5 pt-6 pb-8">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-9 place-items-center rounded-xl bg-banana-400 text-leaf-950">
            <Leaf className="size-5" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            BanaTrack
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-leaf-300 hover:bg-white/10 lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-leaf-800 text-white"
                  : "text-leaf-200/80 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-banana-400" aria-hidden />
              )}
              <Icon
                className={cx("size-[18px]", active ? "text-banana-300" : "text-leaf-300/70 group-hover:text-leaf-200")}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-700 text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-leaf-300">
              {user.role ? ROLE_LABELS[user.role] ?? user.role : "No role assigned"}
            </p>
          </div>
        </div>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-leaf-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-3.5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  const current = NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  return (
    <div className="flex min-h-screen flex-1">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-leaf-950/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-ink hover:bg-leaf-100"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold text-ink">{current?.label ?? "BanaTrack"}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
