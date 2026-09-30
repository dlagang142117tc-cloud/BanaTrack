import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { RoleForm } from "./role-form";

interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  created_at: string;
}

const joinedFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    redirect("/dashboard");
  }

  // list_users() is security definer and re-checks is_admin() in the database.
  const { data, error } = await supabase.rpc("list_users");
  const users = (data ?? []) as ManagedUser[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Assign roles to BanaTrack accounts. New sign-ups start as Field Personnel."
      />

      <Card title="All users" description={error ? undefined : `${users.length} account${users.length === 1 ? "" : "s"}`}>
        {error ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t load users: {error.message}. Make sure <code className="font-mono">supabase/user-management.sql</code>{" "}
            has been run in the Supabase SQL editor.
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-medium sm:px-6">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id} className="align-top">
                      <td className="px-5 py-3 font-medium text-ink sm:px-6">
                        {u.full_name || <span className="text-muted">—</span>}
                        {isSelf && (
                          <span className="ml-2 rounded bg-leaf-100 px-1.5 text-[10px] font-semibold text-leaf-800">YOU</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink">{u.email}</td>
                      <td className="px-3 py-3">
                        <RoleForm userId={u.id} role={u.role} isSelf={isSelf} />
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted sm:px-6">
                        {joinedFmt.format(new Date(u.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
