"use client";

import { useRef, useState } from "react";
import {
  CircleHelp,
  CloudRain,
  Eye,
  History,
  ImageUp,
  Loader2,
  NotebookPen,
  RotateCcw,
  ScanSearch,
  X,
} from "lucide-react";
import {
  Card,
  PageHeader,
  PriorityBadge,
  SampleTag,
  SeverityBadge,
  buttonStyles,
  cx,
  inputStyles,
  labelStyles,
} from "@/components/ui";
import {
  blockCols,
  blockRows,
  sampleAbstainedResult,
  sampleScreeningResults,
  type EvidenceItem,
  type ScreeningResult,
} from "@/lib/mock-data";

const BLOCKS = blockRows.flatMap((r) => blockCols.map((c) => `${r}${c}`));

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

export default function ScreeningPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [runCount, setRunCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (f && f.type.startsWith("image/")) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  }

  function runScreening() {
    // Mock inference: cycles through the canned sample results.
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult(sampleScreeningResults[runCount % sampleScreeningResults.length]);
      setRunCount((n) => n + 1);
      setRunning(false);
    }, 1200);
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disease Screening"
        description="Upload a field photo to get a screening result, severity estimate, and case-review priority. Results are triage support only and always go to a human reviewer."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload */}
        <Card title="1. Field photo & context">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files[0]);
            }}
            className={cx(
              "relative overflow-hidden rounded-xl border-2 border-dashed transition-colors",
              dragging ? "border-leaf-500 bg-leaf-50" : "border-leaf-200 bg-leaf-50/40",
            )}
          >
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={preview} alt="Uploaded field photo" className="aspect-[4/3] w-full object-cover" />
                {result?.box && (
                  <div
                    className="absolute rounded-md border-2 border-banana-400 shadow-[0_0_0_9999px_rgba(13,34,23,0.25)]"
                    style={{
                      left: `${result.box[0] * 100}%`,
                      top: `${result.box[1] * 100}%`,
                      width: `${result.box[2] * 100}%`,
                      height: `${result.box[3] * 100}%`,
                    }}
                  >
                    <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-banana-400 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                      Sample overlay · {result.severityPct}%
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink shadow hover:bg-white"
                  aria-label="Remove photo"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-white text-leaf-600 shadow-sm">
                  <ImageUp className="size-7" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">Drop a photo here, or tap to browse</span>
                <span className="text-xs text-muted">JPG or PNG · leaf, pseudostem, or bunch · good lighting helps</span>
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="block" className={labelStyles}>Block</label>
              <select id="block" className={inputStyles} defaultValue="B3">
                {BLOCKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="part" className={labelStyles}>Plant part</label>
              <select id="part" className={inputStyles}>
                <option>Leaf</option>
                <option>Pseudostem</option>
                <option>Bunch / fruit</option>
                <option>Whole plant</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="obs" className={labelStyles}>
                Field observations <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="obs"
                rows={2}
                className={inputStyles}
                placeholder="e.g. ooze on cut stem, yellowing from older leaves…"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={runScreening}
            disabled={!preview || running}
            className={cx(buttonStyles.accent, "mt-5 w-full py-2.5")}
          >
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanSearch className="size-4" aria-hidden />}
            {running ? "Screening…" : "Run screening"}
          </button>
        </Card>

        {/* Results */}
        <Card
          title="2. Screening result"
          action={<SampleTag label="Mock result — no AI model yet" />}
        >
          {running ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-muted">
              <Loader2 className="size-8 animate-spin text-leaf-500" aria-hidden />
              Analyzing image, weather, and field context…
            </div>
          ) : result ? (
            <ResultPanel result={result} />
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-xl bg-leaf-50/50 p-6 text-center">
              <ScanSearch className="size-8 text-leaf-300" aria-hidden />
              <p className="text-sm font-medium text-ink">No result yet</p>
              <p className="max-w-xs text-xs text-muted">
                Upload a photo and run screening. Results appear here with confidence, severity, and the evidence behind them.
              </p>
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-medium text-muted">Preview result states</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sampleScreeningResults.map((r) => (
                <button key={r.label} type="button" onClick={() => setResult(r)} className={cx(buttonStyles.secondary, "px-3 py-1.5 text-xs")}>
                  {r.label.split(" ")[0]} sample
                </button>
              ))}
              <button type="button" onClick={() => setResult(sampleAbstainedResult)} className={cx(buttonStyles.secondary, "px-3 py-1.5 text-xs")}>
                Inconclusive sample
              </button>
              {result && (
                <button type="button" onClick={() => setResult(null)} className={cx(buttonStyles.ghost, "px-3 py-1.5 text-xs")}>
                  <RotateCcw className="size-3.5" aria-hidden /> Clear
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: ScreeningResult }) {
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
          <p className="mt-3 text-xs text-muted">
            Try retaking the photo closer, in steady light, with the affected area in focus.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Screening result</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{result.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <PriorityBadge priority={result.priority} />
            <SeverityBadge severity={result.severity} />
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
            {abstained ? "—" : `${result.severityPct}%`}
          </p>
          <p className="mt-1 text-[11px] text-muted">{abstained ? "Not estimated" : "of visible tissue affected"}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Contributing evidence</p>
        <ul className="space-y-2">
          {result.evidence.map((e, i) => {
            const Icon = SOURCE_ICONS[e.source];
            return (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-line p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted">{e.source}</p>
                  <p className="text-sm text-ink">{e.detail}</p>
                </div>
                <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", WEIGHT_STYLES[e.weight])}>
                  {e.weight}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[11px] text-muted">
        Model <span className="font-mono">{result.modelVersion}</span> · Sent to review queue for confirmation.
      </p>
    </div>
  );
}
