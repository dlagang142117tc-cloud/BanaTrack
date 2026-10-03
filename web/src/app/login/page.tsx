"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordInput } from "@/components/password-input";
import { buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { deactivated, confirm_error } = use(searchParams);
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to continue. Your account role determines what you can see."
    >
      {deactivated && !state?.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Your account has been deactivated. Contact an admin to restore access.
        </p>
      )}

      {confirm_error && !state?.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          That confirmation link is invalid or has expired. Try signing in, or sign up again to get a new link.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelStyles}>
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputStyles} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={labelStyles}>
            Password
          </label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "mt-2 py-2.5")}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to BanaTrack?{" "}
        <Link href="/signup" className="font-semibold text-leaf-700 hover:text-leaf-900">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  );
}
