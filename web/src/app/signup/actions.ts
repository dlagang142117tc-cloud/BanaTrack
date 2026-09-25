"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(_prevState: unknown, formData: FormData) {
  const fullName = (formData.get("full_name") as string).trim();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  // full_name is copied into public.profiles by the handle_new_user trigger;
  // role always starts as field_personnel and is assigned by an admin.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  // No session means the project requires email confirmation first.
  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }

  redirect("/dashboard");
}
