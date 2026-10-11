"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  ArrowUpCircle,
  Check,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  ImageOff,
  Loader2,
  PencilLine,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import {
  ConfidenceMeter,
  PageHeader,
  PriorityBadge,
  SampleTag,
  SeverityBadge,
  buttonStyles,
  cx,
  inputStyles,
  labelStyles,
} from "@/components/ui";
import { EvidenceList } from "@/components/screening-result";
import { todayIso } from "@/lib/dates";
import { ROLE_LABELS, isRole } from "@/lib/roles";
import {
  CORRECTION_LABELS,
  DECISION_LABELS,
  LAB_RESULTS,
  MAX_LAB_REFERENCE_LENGTH,
  MAX_NOTE_LENGTH,
  PRIORITY_LABELS,
  REVIEW_STATUS_LABELS,
  labResultLabel,
  plantPartLabel,
  type ReviewDecision,
  type ReviewStatus,
} from "@/lib/screening-options";
import type { ReviewCase } from "@/lib/screenings";
import { recordLabResult, reviewScreening, type ReviewActionResult } from "./actions";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: "bg-canvas text-muted ring-1 ring-inset ring-line",
  confirmed: "bg-leaf-100 text-leaf-800",
  corrected: "bg-sky-100 text-sky-800",
  rejected: "bg-zinc-100 text-zinc-700",
  escalated: "bg-red-100 text-red-800",
};

const DECISION_BUTTONS: Record<ReviewDecision, { label: string; icon: typeof Check; className: string }> = {
  confirmed: { label: "Confirm", icon: Check, className: buttonStyles.primary },
  corrected: { label: "Correct", icon: PencilLine, className: buttonStyles.secondary },
  rejected: { label: "Reject", icon: XCircle, className: buttonStyles.secondary },
  escalated: {
    label: "Escalate",
    icon: ArrowUpCircle,
    className: cx(buttonStyles.secondary, "border-red-200 text-red-700 hover:bg-red-50"),
  },
};

const TABS = ["pending", "reviewed", "all"] as const;
type Tab = (typeof TABS)[number];

const isOpen = (c: ReviewCase) => c.reviewStatus === "pending" || c.reviewStatus === "escalated";

function roleLabel(role: string) {
  return isRole(role) ? ROLE_LABELS[role] : role;
}

export function ReviewQueue({
  cases,
  loadError,
  limit,
  canAct,
  isSupervisor,
}: {
  cases: ReviewCase[];
  loadError: boolean;
  limit: number;
  canAct: boolean;
  isSupervisor: boolean;
}) {
  const [tab, setTab] = useState<Tab>("pending");

  // Open cases by case-review priority, oldest first; escalated cases lead for
  // Supervisors, who decide them. Reviewed cases: most recent decision first.
  const byPriority = (a: ReviewCase, b: ReviewCase) =>
    (isSupervisor ? Number(b.reviewStatus === "escalated") - Number(a.reviewStatus === "escalated") : 0) ||
    PRIORITY_RANK[a.result.priority] - PRIORITY_RANK[b.result.priority] ||
    a.submittedIso.localeCompare(b.submittedIso);
  const byLastReview = (a: ReviewCase, b: ReviewCase) =>
    (b.lastReviewedIso ?? "").localeCompare(a.lastReviewedIso ?? "");

  const open = cases.filter(isOpen).sort(byPriority);
  const reviewed = cases.filter((c) => !isOpen(c)).sort(byLastReview);
  const visible = tab === "pending" ? open : tab === "reviewed" ? reviewed : [...open, ...reviewed];
  const escalatedCount = open.filter((c) => c.reviewStatus === "escalated").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Screenings sorted by case-review priority. Each decision is saved with the reviewer, time and model version, and the screening result itself is never changed."
        actions={<SampleTag label="Screening results from a mock model" />}
      />

      {!canAct && (
        <p className="rounded-xl border border-line bg-white p-3 text-sm text-muted">
          View only: your role can see cases but can&apos;t confirm, correct, reject or escalate them.
        </p>
      )}
      {isSupervisor && escalatedCount > 0 && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {escalatedCount} escalated {escalatedCount === 1 ? "case needs" : "cases need"} a Supervisor decision. They are
          listed first.
        </p>
      )}
      {loadError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Screenings couldn&apos;t be loaded. Try refreshing the page.
        </p>
      )}

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
            <span
              className={cx("ml-1.5 rounded-full px-1.5 text-xs", tab === t ? "bg-white/20" : "bg-leaf-100 text-leaf-800")}
            >
              {t === "pending" ? open.length : t === "reviewed" ? reviewed.length : cases.length}
            </span>
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((c) => (
          <CaseCard key={c.id} item={c} />
        ))}
        {visible.length === 0 && !loadError && (
          <li className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
            {tab === "pending"
              ? "All caught up — no screenings waiting for review."
              : tab === "reviewed"
                ? "No reviewed screenings yet."
                : "No screenings yet. They appear here once someone submits a photo on Disease Screening."}
          </li>
        )}
      </ul>
      {cases.length >= limit && (
        <p className="text-xs text-muted">Showing the {limit} most recent screenings.</p>
      )}
    </div>
  );
}

function CaseCard({ item }: { item: ReviewCase }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ReviewDecision | "lab" | "override" | null>(null);
  const [result, setResult] = useState<ReviewActionResult | null>(null);
  const abstained = item.result.status === "abstained";
  const escalated = item.reviewStatus === "escalated";
  const closed = !isOpen(item);
  const decisionsShown = panel === "override" || !closed;

  return (
    <li className={cx("overflow-hidden rounded-2xl border bg-white", escalated ? "border-red-300" : "border-line")}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        {/* Photo */}
        <div className="shrink-0">
          {item.photoUrl ? (
            <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" title="Open the full photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img
                src={item.photoUrl}
                alt={`Field photo for ${item.code}`}
                className="aspect-[4/3] w-full rounded-xl object-cover sm:w-40"
              />
            </a>
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-canvas text-muted sm:w-40">
              <ImageOff className="size-6" aria-label="Photo unavailable" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{item.code}</span>
            <PriorityBadge priority={PRIORITY_LABELS[item.result.priority]} />
            <span className={cx("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS_STYLES[item.reviewStatus])}>
              {REVIEW_STATUS_LABELS[item.reviewStatus]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              Block <strong className="text-ink">{item.block}</strong>
            </span>
            <span>{plantPartLabel(item.plantPart)}</span>
            <span className="inline-flex items-center gap-1">
              <User className="size-3" aria-hidden />
              {item.submitterName}
            </span>
            <span>{item.submittedAt}</span>
          </div>

          {/* Three separate statuses (paper §4.9) */}
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-xl bg-leaf-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Screening result</p>
                <span className="text-[10px] font-semibold uppercase text-banana-700">Mock result</span>
              </div>
              <p className={cx("mt-1 text-sm font-semibold", abstained ? "text-muted" : "text-ink")}>
                {abstained ? (
                  <span className="inline-flex items-center gap-1">
                    <CircleHelp className="size-4" aria-hidden /> Inconclusive — system abstained
                  </span>
                ) : (
                  item.result.label
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ConfidenceMeter value={item.result.confidence} />
                {item.result.severity && <SeverityBadge severity={item.result.severity} />}
                {item.result.severityPct !== null && (
                  <span className="font-mono text-xs tabular-nums text-muted">{item.result.severityPct}% severity</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Human review</p>
              {item.reviewStatus === "pending" ? (
                <p className="mt-1 text-sm text-muted">Not reviewed yet</p>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {escalated ? "Escalated to a Supervisor" : (item.humanLabel ?? DECISION_LABELS[item.reviewStatus])}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {DECISION_LABELS[item.reviewStatus]} by {item.lastReviewedByName} · {item.lastReviewedAt}
                  </p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Lab result</p>
              <p className={cx("mt-1 text-sm", item.labStatus === "none" ? "text-muted" : "font-semibold text-ink")}>
                {item.labStatus === "none" ? "No lab result recorded" : labResultLabel(item.labStatus)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 border-t border-line bg-canvas/60 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {decisionsShown &&
            item.allowedDecisions.map((d) => {
              const b = DECISION_BUTTONS[d];
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setPanel(d);
                    setResult(null);
                  }}
                  aria-pressed={panel === d}
                  className={cx(b.className, "py-1.5")}
                >
                  <b.icon className="size-4" aria-hidden /> {b.label}
                </button>
              );
            })}
          {closed && item.allowedDecisions.length > 0 && panel === null && (
            <button type="button" onClick={() => setPanel("override")} className={cx(buttonStyles.secondary, "py-1.5")}>
              <ShieldCheck className="size-4" aria-hidden /> Override decision
            </button>
          )}
          {item.canRecordLab && (
            <button
              type="button"
              onClick={() => {
                setPanel("lab");
                setResult(null);
              }}
              aria-pressed={panel === "lab"}
              className={cx(buttonStyles.ghost, "py-1.5")}
            >
              <FlaskConical className="size-4" aria-hidden /> Record lab result
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cx(buttonStyles.ghost, "ml-auto py-1.5")}
          >
            Evidence &amp; history
            <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>

        {item.blockedReason && <p className="text-xs text-muted">{item.blockedReason}</p>}
        {panel === "override" && (
          <p className="text-xs text-muted">
            Choose a new decision. The earlier decision stays in the history.{" "}
            <button type="button" onClick={() => setPanel(null)} className="font-medium text-leaf-700 hover:underline">
              Cancel
            </button>
          </p>
        )}

        {panel && panel !== "lab" && panel !== "override" && (
          <DecisionForm
            item={item}
            decision={panel}
            onDone={(res) => {
              setResult(res);
              if (res.ok) setPanel(null);
            }}
            onCancel={() => setPanel(closed ? "override" : null)}
          />
        )}
        {panel === "lab" && (
          <LabForm
            item={item}
            onDone={(res) => {
              setResult(res);
              if (res.ok) setPanel(null);
            }}
            onCancel={() => setPanel(null)}
          />
        )}
        {result && (
          <p role="status" className={cx("text-sm", result.ok ? "text-leaf-700" : "text-red-700")}>
            {result.message}
          </p>
        )}
      </div>

      {open && <CaseDetails item={item} />}
    </li>
  );
}

function DecisionForm({
  item,
  decision,
  onDone,
  onCancel,
}: {
  item: ReviewCase;
  decision: ReviewDecision;
  onDone: (res: ReviewActionResult) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await reviewScreening({
        screeningId: item.id,
        decision,
        correctedLabel: String(data.get("correctedLabel") ?? ""),
        note: String(data.get("note") ?? ""),
      }).catch(() => ({ ok: false, message: "The decision could not be saved. Try again." }));
      onDone(res);
    });
  }

  const b = DECISION_BUTTONS[decision];
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-3">
      <p className="text-sm font-semibold text-ink">
        {decision === "escalated" ? "Escalate to a Supervisor" : `${b.label} ${item.code}`}
      </p>
      {decision === "corrected" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`label-${item.id}`} className={labelStyles}>
            Corrected label
          </label>
          <select id={`label-${item.id}`} name="correctedLabel" className={cx(inputStyles, "sm:max-w-sm")} required>
            {CORRECTION_LABELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`note-${item.id}`} className={labelStyles}>
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`note-${item.id}`}
          name="note"
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          className={inputStyles}
          placeholder={decision === "escalated" ? "Why does this need a Supervisor?" : "Anything the next reviewer should know"}
        />
      </div>
      <p className="text-xs text-muted">Decisions can&apos;t be edited or deleted once saved.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={cx(b.className, "py-1.5")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <b.icon className="size-4" aria-hidden />}
          Save decision
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={cx(buttonStyles.ghost, "py-1.5")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LabForm({
  item,
  onDone,
  onCancel,
}: {
  item: ReviewCase;
  onDone: (res: ReviewActionResult) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordLabResult({
        screeningId: item.id,
        labResult: String(data.get("labResult") ?? ""),
        labReference: String(data.get("labReference") ?? ""),
        sampleDate: String(data.get("sampleDate") ?? ""),
        note: String(data.get("note") ?? ""),
      }).catch(() => ({ ok: false, message: "The lab result could not be saved. Try again." }));
      onDone(res);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-3">
      <p className="text-sm font-semibold text-ink">Record lab result for {item.code}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`lab-${item.id}`} className={labelStyles}>
            Lab result
          </label>
          <select id={`lab-${item.id}`} name="labResult" className={inputStyles} defaultValue="" required>
            <option value="" disabled>
              Choose a result
            </option>
            {LAB_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`ref-${item.id}`} className={labelStyles}>
            Lab / report no. <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={`ref-${item.id}`} name="labReference" maxLength={MAX_LAB_REFERENCE_LENGTH} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`date-${item.id}`} className={labelStyles}>
            Sample date <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={`date-${item.id}`} name="sampleDate" type="date" max={todayIso()} className={inputStyles} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`labnote-${item.id}`} className={labelStyles}>
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id={`labnote-${item.id}`} name="note" rows={2} maxLength={MAX_NOTE_LENGTH} className={inputStyles} />
      </div>
      <p className="text-xs text-muted">
        Kept separate from the review decision. Lab results can&apos;t be edited or deleted once saved.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "py-1.5")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FlaskConical className="size-4" aria-hidden />}
          Save lab result
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={cx(buttonStyles.ghost, "py-1.5")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CaseDetails({ item }: { item: ReviewCase }) {
  return (
    <div className="grid gap-5 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-2">
      <div className="space-y-4">
        {item.result.abstainReason && (
          <p className="rounded-xl bg-canvas p-3 text-sm text-ink/80">{item.result.abstainReason}</p>
        )}
        <EvidenceList evidence={item.result.evidence} />
        <p className="text-[11px] text-muted">
          Model <span className="font-mono">{item.modelVersion}</span> · Mock result: the photo was not analyzed.
          Grad-CAM / SHAP explanations will appear here once the model service is connected.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Review history</p>
          {item.reviews.length === 0 ? (
            <p className="text-sm text-muted">No decisions yet.</p>
          ) : (
            <ol className="space-y-2">
              {item.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-medium text-ink">
                    {DECISION_LABELS[r.decision]}
                    {r.correctedLabel && <> to &ldquo;{r.correctedLabel}&rdquo;</>}
                  </p>
                  <p className="text-xs text-muted">
                    {r.reviewerName} ({roleLabel(r.reviewerRole)}) · {r.at} · model{" "}
                    <span className="font-mono">{r.modelVersion}</span>
                  </p>
                  {r.note && <p className="mt-1 whitespace-pre-line break-words text-ink/80">{r.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Lab results</p>
          {item.labResults.length === 0 ? (
            <p className="text-sm text-muted">None recorded.</p>
          ) : (
            <ol className="space-y-2">
              {item.labResults.map((l) => (
                <li key={l.id} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-medium text-ink">{labResultLabel(l.result)}</p>
                  <p className="text-xs text-muted">
                    Recorded by {l.recorderName} · {l.at}
                    {l.sampleDate && <> · sampled {l.sampleDate}</>}
                    {l.reference && <> · {l.reference}</>}
                  </p>
                  {l.note && <p className="mt-1 whitespace-pre-line break-words text-ink/80">{l.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
