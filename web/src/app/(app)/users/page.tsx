import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, cx } from "@/components/ui";
import { ROLE_LABELS, isRole, type Role } from "@/lib/roles";
import { RoleForm } from "./role-form";
import { UserActions } from "./user-actions";

interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  created_at: string;
  must_change_password: boolean;
  deactivated_at: string | null;
}

interface AdminActionRow {
  id: number;
  actor_id: string | null;
  action: "role_change" | "password_reset" | "deactivate" | "reactivate" | "delete";
  target_user_id: string;
  target_email: string | null;
  details: { from?: string; to?: string } | null;
  created_at: string;
}

const ACTION_LABELS: Record<AdminActionRow["action"], string> = {
  role_change: "Changed role",
  password_reset: "Reset password",
  deactivate: "Deactivated",
  reactivate: "Reactivated",
  delete: "Deleted account",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

function roleLabel(role: string | undefined) {
  return isRole(role) ? ROLE_LABELS[role] : (role ?? "?");
}

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Checked here too, not only in (app)/layout: layouts and pages render in
  // parallel, so the layout's redirects don't stop this page from running.
  const { data: me } = await supabase
    .from("profiles")
    .select("role, deactivated_at, must_change_password")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" || me.deactivated_at || me.must_change_password) {
    redirect("/dashboard");
  }

  // Both are admin-only in the database: list_users() re-checks is_admin(),
  // and admin_actions has a select policy for admins only.
  const [{ data, error }, { data: logData, error: logError }] = await Promise.all([
    supabase.rpc("list_users"),
    supabase.from("admin_actions").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  const users = (data ?? []) as ManagedUser[];
  const log = (logData ?? []) as AdminActionRow[];
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Assign roles and manage BanaTrack accounts. New sign-ups start as Field Personnel."
      />

      <Card title="All users" description={error ? undefined : `${users.length} account${users.length === 1 ? "" : "s"}`}>
        {error ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t load users: {error.message}. Make sure every file in{" "}
            <code className="font-mono">supabase/migrations/</code> has been run, in order, in the Supabase SQL editor.
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-medium sm:px-6">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const isSelf = u.id === user.id;
                  const deactivated = !!u.deactivated_at;
                  return (
                    <tr key={u.id} className={cx("align-top", deactivated && "bg-canvas/70")}>
                      <td className="px-5 py-3 sm:px-6">
                        <p className={cx("font-medium", deactivated ? "text-muted" : "text-ink")}>
                          {u.full_name || <span className="text-muted">—</span>}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {isSelf && (
                            <span className="rounded bg-leaf-100 px-1.5 text-[10px] font-semibold text-leaf-800">YOU</span>
                          )}
                          {deactivated && (
                            <span className="rounded bg-red-100 px-1.5 text-[10px] font-semibold text-red-800">DEACTIVATED</span>
                          )}
                          {u.must_change_password && (
                            <span className="rounded bg-banana-100 px-1.5 text-[10px] font-semibold text-banana-700">
                              TEMP PASSWORD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink">{u.email}</td>
                      <td className="px-3 py-3">
                        <RoleForm userId={u.id} role={u.role} isSelf={isSelf} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted">{dateFmt.format(new Date(u.created_at))}</td>
                      <td className="px-5 py-3 sm:px-6">
                        {isSelf ? (
                          <span className="text-xs text-muted">Not available for your own account</span>
                        ) : (
                          <UserActions userId={u.id} email={u.email} deactivated={deactivated} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent admin actions" description="Last 20 changes made on this page">
        {logError ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Couldn&apos;t load the audit log: {logError.message}</p>
        ) : log.length === 0 ? (
          <p className="text-sm text-muted">No admin actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {log.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2.5 text-sm first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-xs tabular-nums text-muted">
                  {dateTimeFmt.format(new Date(a.created_at))}
                </span>
                <span className="text-ink">
                  <strong className="font-semibold">
                    {a.actor_id ? (nameById.get(a.actor_id) ?? "Unknown user") : "Deleted account"}
                  </strong>{" "}
                  {ACTION_LABELS[a.action].toLowerCase()}
                  {a.action === "role_change" && a.details && (
                    <> ({roleLabel(a.details.from)} → {roleLabel(a.details.to)})</>
                  )}{" "}
                  for <span className="font-medium">{a.target_email ?? a.target_user_id}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
