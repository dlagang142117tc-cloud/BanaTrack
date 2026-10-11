import { CircleHelp, CloudRain, Eye, History, NotebookPen } from "lucide-react";
import { PriorityBadge, SeverityBadge, cx } from "@/components/ui";
import { PRIORITY_LABELS, type EvidenceItem, type ScreeningResult } from "@/lib/screening-options";

// The screening result (AI output) as shown on Disease Screening and in the
// Review Queue. Callers show the "Mock result" tag next to it.

const SOURCE_ICONS: Record<EvidenceItem["source"], typeof Eye> = {
  Image: Eye,
  Weather: CloudRain,
  "Field observation": NotebookPen,
  "Incident history": History,
};

const WEIGHT_STYLES: Record<EvidenceItem["weight"], string> = {
  strong: "bg-leaf-700 text-white",
  moderate: "bg-leaf-200 text-leaf-900",
  weak: "bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-200",
};

export function ResultPanel({ result, modelVersion }: { result: ScreeningResult; modelVersion: string }) {
  const abstained = result.status === "abstained";
  const pct = Math.round(result.confidence * 100);

  return (
    <div className="space-y-5">
      {abstained ? (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="size-5 text-muted" aria-hidden />
            <p className="font-display text-lg font-semibold text-ink">Inconclusive — system abstained</p>
          </div>
          <p className="mt-2 text-sm text-ink/80">{result.abstainReason}</p>
          <div className="mt-3">
            <PriorityBadge priority={PRIORITY_LABELS[result.priority]} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Try retaking the photo closer, in steady light, with the affected area in focus.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Screening result</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{result.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <PriorityBadge priority={PRIORITY_LABELS[result.priority]} />
            {result.severity && <SeverityBadge severity={result.severity} />}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-leaf-50 p-4">
          <p className="text-xs text-muted">Calibrated confidence</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{pct}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className={cx("h-full rounded-full", pct >= 60 ? "bg-leaf-500" : "bg-red-400")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl bg-leaf-50 p-4">
          <p className="text-xs text-muted">Severity estimate</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {result.severityPct === null ? "—" : `${result.severityPct}%`}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {result.severityPct === null ? "Not estimated" : "of visible tissue affected"}
          </p>
        </div>
      </div>

      <EvidenceList evidence={result.evidence} />

      <p className="text-[11px] text-muted">
        Model <span className="font-mono">{modelVersion}</span> · Mock result: the photo was not analyzed.
      </p>
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">Contributing evidence</p>
      <ul className="space-y-2">
        {evidence.map((e, i) => {
          const Icon = SOURCE_ICONS[e.source] ?? Eye;
          return (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-line p-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted">{e.source}</p>
                <p className="whitespace-pre-line break-words text-sm text-ink">{e.detail}</p>
              </div>
              <span
                className={cx(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                  WEIGHT_STYLES[e.weight],
                )}
              >
                {e.weight}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
