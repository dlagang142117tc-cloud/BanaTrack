"use client";

import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { NO_VISIBLE_SYMPTOMS, SYMPTOMS } from "@/lib/incident-options";

/**
 * Toggle chips for the symptom list, shared by the new-incident form and the
 * edit dialog. "No visible symptoms" is exclusive: ticking it clears the
 * symptoms, and ticking a symptom clears it.
 */
export function SymptomPicker({
  selected,
  onChange,
  error,
}: {
  selected: string[];
  onChange: (symptoms: string[]) => void;
  error?: string | null;
}) {
  function toggle(s: string) {
    if (selected.includes(s)) return onChange(selected.filter((x) => x !== s));
    if (s === NO_VISIBLE_SYMPTOMS) return onChange([s]);
    onChange([...selected.filter((x) => x !== NO_VISIBLE_SYMPTOMS), s]);
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {SYMPTOMS.map((s) => (
          <Chip key={s} label={s} on={selected.includes(s)} onClick={() => toggle(s)} />
        ))}
        <span className="mx-1 text-xs text-muted">or</span>
        <Chip
          label={NO_VISIBLE_SYMPTOMS}
          on={selected.includes(NO_VISIBLE_SYMPTOMS)}
          onClick={() => toggle(NO_VISIBLE_SYMPTOMS)}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        on ? "border-leaf-600 bg-leaf-600 text-white" : "border-line bg-white text-ink hover:border-leaf-300 hover:bg-leaf-50",
      )}
    >
      {on && <Check className="size-3" aria-hidden />}
      {label}
    </button>
  );
}
