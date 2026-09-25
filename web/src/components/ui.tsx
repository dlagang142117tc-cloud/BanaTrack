import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import type { Priority, Severity } from "@/lib/mock-data";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Marks anything backed by placeholder/mock data. Every mock-driven section
 * must carry one of these until it is wired to a real source.
 */
export function SampleTag({ label = "Sample data — not real" }: { label?: string }) {
  return (
    <span
      title="This content is placeholder data for layout preview only."
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-banana-500/60 bg-banana-50 px-2 py-0.5 text-[11px] font-medium text-banana-700"
    >
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(22,36,27,0.04)] sm:p-6",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const severityStyles: Record<Severity, string> = {
  none: "bg-leaf-50 text-leaf-700 ring-leaf-200",
  low: "bg-leaf-100 text-leaf-800 ring-leaf-300",
  moderate: "bg-banana-100 text-banana-700 ring-banana-300",
  high: "bg-red-50 text-red-700 ring-red-200",
};

const severityLabels: Record<Severity, string> = {
  none: "No incidents",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        severityStyles[severity],
      )}
    >
      {severityLabels[severity]}
    </span>
  );
}

const priorityStyles: Record<Priority, string> = {
  High: "bg-red-600 text-white",
  Medium: "bg-banana-400 text-ink",
  Low: "bg-leaf-100 text-leaf-800",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        priorityStyles[priority],
      )}
    >
      {priority} priority
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-800 ring-1 ring-inset ring-leaf-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 80 ? "bg-leaf-500" : pct >= 60 ? "bg-banana-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-leaf-100">
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-ink">{pct}%</span>
    </div>
  );
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-leaf-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 disabled:cursor-not-allowed disabled:opacity-60",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-banana-400 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-banana-300 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-leaf-50 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-leaf-50 hover:text-ink",
};

export const inputStyles =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/20";

export const labelStyles = "text-sm font-medium text-ink";
