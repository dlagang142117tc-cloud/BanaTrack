import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the link in Supabase confirmation emails (only sent when "Confirm
// email" is on). The default template sends ?code= (PKCE); a custom template
// using {{ .TokenHash }} sends ?token_hash=&type= instead.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only allow same-site paths so the link can't be used as an open redirect.
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const supabase = await createClient();
  let error: unknown = new Error("Missing confirmation code");

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  }

  if (error) {
    return NextResponse.redirect(new URL("/login?confirm_error=1", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
