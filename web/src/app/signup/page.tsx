"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <AuthFrame
      title="Create your account"
      subtitle="New accounts start as Field Personnel. An admin can assign a different role after you sign up."
    >
      {state && "message" in state ? (
        <div className="rounded-xl border border-leaf-200 bg-leaf-50 p-4 text-sm text-leaf-800">{state.message}</div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="full_name" className={labelStyles}>
              Full name
            </label>
            <input id="full_name" name="full_name" autoComplete="name" required className={inputStyles} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={labelStyles}>
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className={inputStyles} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={labelStyles}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                className={inputStyles}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm_password" className={labelStyles}>
                Confirm
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                className={inputStyles}
              />
            </div>
          </div>

          {state && "error" in state && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "mt-2 py-2.5")}>
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-leaf-700 hover:text-leaf-900">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
