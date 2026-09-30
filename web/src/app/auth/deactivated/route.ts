import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A Route Handler (unlike a Server Component) can clear the session cookies,
// so deactivated users are sent here to be signed out.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?deactivated=1", request.url));
}
