"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cx, inputStyles } from "./ui";

/**
 * Password field with a show/hide toggle. Pass the same props as an <input>
 * (id, name, autoComplete, minLength, required…); `type` is managed here.
 */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={cx(inputStyles, "pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted transition-colors hover:text-leaf-700 focus-visible:text-leaf-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leaf-500/40"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
