"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { KeyRound, Loader2, Trash2, UserCheck, UserX, X } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { deleteUserAccount, resetUserPassword, setUserActive, type ActionState } from "./actions";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function UserActions({ userId, email, deactivated }: { userId: string; email: string; deactivated: boolean }) {
  const [result, setResult] = useState<ActionState>(undefined);
  const [typedEmail, setTypedEmail] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <ActionDialog
          userId={userId}
          action={resetUserPassword}
          onSuccess={setResult}
          trigger={<><KeyRound className="size-3.5" aria-hidden /> Reset password</>}
          title="Set a temporary password"
          description={
            <>
              <strong className="text-ink">{email}</strong> will have to choose a new password the next time they sign in.
              Share the temporary password with them directly.
            </>
          }
          submitLabel="Set temporary password"
        >
          <PasswordField id={`pw-${userId}`} name="password" label="Temporary password" />
          <PasswordField id={`pwc-${userId}`} name="confirm_password" label="Confirm password" />
        </ActionDialog>

        {deactivated ? (
          <ActionDialog
            userId={userId}
            action={setUserActive}
            onSuccess={setResult}
            trigger={<><UserCheck className="size-3.5" aria-hidden /> Reactivate</>}
            title="Reactivate account"
            description={<><strong className="text-ink">{email}</strong> will be able to sign in again.</>}
            submitLabel="Reactivate"
          >
            <input type="hidden" name="active" value="true" />
          </ActionDialog>
        ) : (
          <ActionDialog
            userId={userId}
            action={setUserActive}
            onSuccess={setResult}
            trigger={<><UserX className="size-3.5" aria-hidden /> Deactivate</>}
            title="Deactivate account"
            description={
              <>
                <strong className="text-ink">{email}</strong> won&apos;t be able to sign in. Their account and all their
                records are kept, and you can reactivate them at any time.
              </>
            }
            submitLabel="Deactivate"
            danger
          >
            <input type="hidden" name="active" value="false" />
          </ActionDialog>
        )}

        <ActionDialog
          userId={userId}
          action={deleteUserAccount}
          onSuccess={setResult}
          onClose={() => setTypedEmail("")}
          trigger={<><Trash2 className="size-3.5" aria-hidden /> Delete</>}
          title="Permanently delete account"
          description={
            <>
              This removes <strong className="text-ink">{email}</strong> and cannot be undone. To keep their history, deactivate
              the account instead.
            </>
          }
          submitLabel="Delete permanently"
          danger
          canSubmit={typedEmail.trim().toLowerCase() === email.toLowerCase()}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`del-${userId}`} className={labelStyles}>
              Type <span className="font-mono">{email}</span> to confirm
            </label>
            <input
              id={`del-${userId}`}
              name="confirm_email"
              autoComplete="off"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              className={inputStyles}
            />
          </div>
        </ActionDialog>
      </div>

      {result && (
        <p role="status" className={cx("text-xs", result.ok ? "text-leaf-700" : "text-red-700")}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function ActionDialog({
  userId,
  action,
  onSuccess,
  onClose,
  trigger,
  title,
  description,
  submitLabel,
  danger = false,
  canSubmit = true,
  children,
}: {
  userId: string;
  action: ServerAction;
  onSuccess: (state: ActionState) => void;
  onClose?: () => void;
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  submitLabel: string;
  danger?: boolean;
  canSubmit?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped on every close so the form remounts: typed values, the last error,
  // and PasswordInput toggles are all reset the next time the dialog opens.
  const [formKey, setFormKey] = useState(0);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={cx(
          buttonStyles.secondary,
          "px-2.5 py-1 text-xs",
          danger && "border-red-200 text-red-700 hover:bg-red-50",
        )}
      >
        {trigger}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => {
          setFormKey((k) => k + 1);
          onClose?.();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-leaf-950/50"
      >
        <DialogForm
          key={formKey}
          userId={userId}
          action={action}
          onSuccess={(next) => {
            close();
            onSuccess(next);
          }}
          onCancel={close}
          title={title}
          description={description}
          submitLabel={submitLabel}
          danger={danger}
          canSubmit={canSubmit}
        >
          {children}
        </DialogForm>
      </dialog>
    </>
  );
}

function DialogForm({
  userId,
  action,
  onSuccess,
  onCancel,
  title,
  description,
  submitLabel,
  danger,
  canSubmit,
  children,
}: {
  userId: string;
  action: ServerAction;
  onSuccess: (state: ActionState) => void;
  onCancel: () => void;
  title: string;
  description: ReactNode;
  submitLabel: string;
  danger: boolean;
  canSubmit: boolean;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next?.ok) onSuccess(next);
    return next;
  }, undefined);

  return (
    <form action={formAction} className="space-y-4 p-5 sm:p-6">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-muted hover:bg-leaf-50 hover:text-ink"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="text-sm text-muted">{description}</p>

      {children}

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={buttonStyles.ghost}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className={cx(buttonStyles.primary, danger && "bg-red-600 hover:bg-red-700")}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function PasswordField({ id, name, label }: { id: string; name: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelStyles}>
        {label}
      </label>
      <PasswordInput id={id} name={name} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      <span className="text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</span>
    </div>
  );
}
