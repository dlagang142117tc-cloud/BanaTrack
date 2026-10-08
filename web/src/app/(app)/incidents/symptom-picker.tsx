"use client";

import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { SYMPTOMS } from "@/lib/incident-options";

/** Toggle chips for the symptom list, shared by the new-incident form and the edit dialog. */
export function SymptomPicker({ selected, onToggle }: { selected: string[]; onToggle: (symptom: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {SYMPTOMS.map((s) => {
        const on = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            aria-pressed={on}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              on ? "border-leaf-600 bg-leaf-600 text-white" : "border-line bg-white text-ink hover:border-leaf-300 hover:bg-leaf-50",
            )}
          >
            {on && <Check className="size-3" aria-hidden />}
            {s}
          </button>
        );
      })}
    </div>
  );
}
