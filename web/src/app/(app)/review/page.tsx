"use client";

import { useState } from "react";
import {
  ArrowUpCircle,
  Check,
  ChevronDown,
  CloudRain,
  Eye,
  History,
  NotebookPen,
  PencilLine,
  Undo2,
  User,
  XCircle,
} from "lucide-react";
import {
  ConfidenceMeter,
  PageHeader,
  PriorityBadge,
  SampleTag,
  buttonStyles,
  cx,
  inputStyles,
} from "@/components/ui";
import { reviewCases, type EvidenceItem, type ReviewCase, type ReviewStatus } from "@/lib/mock-data";

type Decision = { status: Exclude<ReviewStatus, "pending">; at: string; correctedTo?: string };

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

const SOURCE_ICONS: Record<EvidenceItem["source"], typeof Eye> = {
  Image: Eye,
  Weather: CloudRain,
  "Field observation": NotebookPen,
  "Incident history": History,
};

const DECISION_STYLES: Record<Decision["status"], { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-leaf-100 text-leaf-800" },
  corrected: { label: "Corrected", className: "bg-sky-100 text-sky-800" },
  rejected: { label: "Rejected", className: "bg-zinc-100 text-zinc-700" },
  escalated: { label: "Escalated", className: "bg-red-100 text-red-800" },
};

const CORRECTION_OPTIONS = [
  "Moko-like wilt pattern",
  "Panama-like (Fusarium) wilt pattern",
  "Other disorder (not Moko/Panama)",
  "No disease pattern",
];

const TABS = ["pending", "reviewed", "all"] as const;

export default function ReviewQueuePage() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");

  const sorted = [...reviewCases].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.confidence - a.confidence,
  );
  const pendingCount = sorted.filter((c) => !decisions[c.id]).length;
  const visible = sorted.filter((c) =>
    tab === "all" ? true : tab === "pending" ? !decisions[c.id] : !!decisions[c.id],
  );

  function decide(id: string, d: Omit<Decision, "at"> | null) {
    setDecisions((cur) => {
      const next = { ...cur };
      if (d) next[id] = { ...d, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      else delete next[id];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="AI-flagged cases sorted by case-review priority. Every decision is logged with the model version and a timestamp."
        actions={<SampleTag label="Sample cases — not real" />}
      />

      <div className="flex gap-1 rounded-xl border border-line bg-white p-1 sm:w-fit" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(
              "flex-1 rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors sm:flex-none",
              tab === t ? "bg-leaf-700 text-white" : "text-muted hover:text-ink",
            )}
          >
            {t}
            {t === "pending" && (
              <span className={cx("ml-1.5 rounded-full px-1.5 text-xs", tab === t ? "bg-white/20" : "bg-leaf-100 text-leaf-800")}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((c) => (
          <CaseCard key={c.id} item={c} decision={decisions[c.id]} onDecide={(d) => decide(c.id, d)} />
        ))}
        {visible.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
            {tab === "pending" ? "All caught up — no cases waiting for review." : "No reviewed cases yet."}
          </li>
        )}
      </ul>
    </div>
  );
}

function CaseCard({
  item,
  decision,
  onDecide,
}: {
  item: ReviewCase;
  decision?: Decision;
  onDecide: (d: Omit<Decision, "at"> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(CORRECTION_OPTIONS[0]);
  const abstained = item.label.startsWith("Inconclusive");

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{item.id}</span>
            <PriorityBadge priority={item.priority} />
            {decision && (
              <span className={cx("rounded-md px-2 py-0.5 text-xs font-semibold", DECISION_STYLES[decision.status].className)}>
                {DECISION_STYLES[decision.status].label} · {decision.at}
              </span>
            )}
          </div>
          <p className={cx("mt-1.5 font-display text-lg font-semibold", abstained ? "text-muted" : "text-ink")}>
            {item.label}
          </p>
          {decision?.correctedTo && (
            <p className="text-sm text-sky-800">Corrected to: {decision.correctedTo}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>Block <strong className="text-ink">{item.block}</strong></span>
            <span className="inline-flex items-center gap-1"><User className="size-3" aria-hidden />{item.submittedBy}</span>
            <span>{item.submittedAt}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 md:justify-end">
          <div>
            <p className="text-[11px] text-muted">Confidence</p>
            <ConfidenceMeter value={item.confidence} />
          </div>
          <div>
            <p className="text-[11px] text-muted">Severity</p>
            <p className="font-mono text-xs tabular-nums">{abstained ? "—" : `${item.severityPct}%`}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-4 py-3 sm:px-5">
        {decision ? (
          <button type="button" onClick={() => onDecide(null)} className={cx(buttonStyles.ghost, "py-1.5")}>
            <Undo2 className="size-4" aria-hidden /> Undo decision
          </button>
        ) : correcting ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <select
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              className={cx(inputStyles, "w-auto flex-1 py-1.5 sm:max-w-xs")}
              aria-label="Corrected label"
            >
              {CORRECTION_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                onDecide({ status: "corrected", correctedTo: correction });
                setCorrecting(false);
              }}
              className={cx(buttonStyles.primary, "py-1.5")}
            >
              Save correction
            </button>
            <button type="button" onClick={() => setCorrecting(false)} className={cx(buttonStyles.ghost, "py-1.5")}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => onDecide({ status: "confirmed" })} className={cx(buttonStyles.primary, "py-1.5")}>
              <Check className="size-4" aria-hidden /> Confirm
            </button>
            <button type="button" onClick={() => setCorrecting(true)} className={cx(buttonStyles.secondary, "py-1.5")}>
              <PencilLine className="size-4" aria-hidden /> Correct
            </button>
            <button type="button" onClick={() => onDecide({ status: "rejected" })} className={cx(buttonStyles.secondary, "py-1.5")}>
              <XCircle className="size-4" aria-hidden /> Reject
            </button>
            <button
              type="button"
              onClick={() => onDecide({ status: "escalated" })}
              className={cx(buttonStyles.secondary, "border-red-200 py-1.5 text-red-700 hover:bg-red-50")}
            >
              <ArrowUpCircle className="size-4" aria-hidden /> Escalate
            </button>
          </>
        )}

        {!correcting && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cx(buttonStyles.ghost, "ml-auto py-1.5")}
          >
            Evidence
            <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <ul className="grid gap-2 md:grid-cols-2">
            {item.evidence.map((e, i) => {
              const Icon = SOURCE_ICONS[e.source];
              return (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-leaf-50/60 p-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden />
                  <div>
                    <p className="text-xs font-medium text-muted">
                      {e.source} · <span className="capitalize">{e.weight}</span>
                    </p>
                    <p className="text-sm text-ink">{e.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            Model <span className="font-mono">{item.modelVersion}</span> · Grad-CAM / SHAP explanations will appear here once the model service is connected.
          </p>
        </div>
      )}
    </li>
  );
}
