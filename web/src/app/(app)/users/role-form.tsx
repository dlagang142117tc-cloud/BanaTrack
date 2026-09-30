"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { buttonStyles, cx, inputStyles } from "@/components/ui";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { updateUserRole } from "./actions";

export function RoleForm({ userId, role, isSelf }: { userId: string; role: Role; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(updateUserRole, undefined);
  const [value, setValue] = useState<Role>(role);
  const dirty = value !== role;

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          value={value}
          onChange={(e) => setValue(e.target.value as Role)}
          disabled={isSelf || pending}
          aria-label="Role"
          className={cx(inputStyles, "w-48 py-1.5 disabled:cursor-not-allowed disabled:bg-canvas")}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {dirty && (
          <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "px-3 py-1.5")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Save
          </button>
        )}
      </div>
      {isSelf ? (
        <p className="text-xs text-muted">You can&apos;t change your own role.</p>
      ) : (
        state && (
          <p role="status" className={cx("text-xs", state.ok ? "text-leaf-700" : "text-red-700")}>
            {state.message}
          </p>
        )
      )}
    </form>
  );
}
