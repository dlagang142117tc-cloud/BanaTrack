import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">BanaTrack Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {user.email}
            {profile?.role ? ` · role: ${profile.role}` : ""}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.15]"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-dashed border-black/[.12] p-6 text-sm text-zinc-600 dark:border-white/[.15] dark:text-zinc-400">
        Weather, incident, review-queue, and map modules land in the next
        build steps.
      </div>
    </div>
  );
}
