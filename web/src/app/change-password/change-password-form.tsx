"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { buttonStyles, cx, labelStyles } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelStyles}>
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <span className="text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm_password" className={labelStyles}>
          Confirm new password
        </label>
        <PasswordInput
          id="confirm_password"
          name="confirm_password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "mt-2 py-2.5")}>
        {pending ? "Saving..." : "Save new password"}
      </button>
    </form>
  );
}
