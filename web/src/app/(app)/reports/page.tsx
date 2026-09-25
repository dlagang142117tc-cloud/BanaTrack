"use client";

import { useState, type FormEvent } from "react";
import { FileBarChart, FileDown, Loader2 } from "lucide-react";
import {
  Card,
  PageHeader,
  SampleTag,
  buttonStyles,
  cx,
  inputStyles,
  labelStyles,
} from "@/components/ui";
import { blockRows, modelGovernance, monthlyIncidents, type MonthlyCount } from "@/lib/mock-data";

// Validated categorical palette (dataviz validator, light surface): fixed order.
const SERIES: { key: keyof Omit<MonthlyCount, "month">; label: string; color: string }[] = [
  { key: "moko", label: "Moko-like", color: "#2f8a4f" },
  { key: "panama", label: "Panama-like", color: "#d9a011" },
  { key: "unconfirmed", label: "Unconfirmed", color: "#5b7fc0" },
];

interface Filters {
  from: string;
  to: string;
  area: string;
  disease: string;
}

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<Filters | null>(null);

  function generate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Filters;
    setGenerating(true);
    setTimeout(() => {
      setReport(data);
      setGenerating(false);
    }, 700);
  }

  const series = report && report.disease !== "all" ? SERIES.filter((s) => s.key === report.disease) : SERIES;
  const totals = SERIES.map((s) => ({ ...s, total: monthlyIncidents.reduce((n, m) => n + m[s.key], 0) }));
  const grand = totals.reduce((n, t) => n + t.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate incident and screening summaries for a period and area, then export them as PDF."
      />

      <Card title="Report filters" className="no-print">
        <form onSubmit={generate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className={labelStyles}>From</label>
            <input id="from" name="from" type="date" defaultValue="2026-04-01" className={inputStyles} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className={labelStyles}>To</label>
            <input id="to" name="to" type="date" defaultValue="2026-09-25" className={inputStyles} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="area" className={labelStyles}>Area</label>
            <select id="area" name="area" className={inputStyles}>
              <option value="all">All blocks</option>
              {blockRows.map((r) => (
                <option key={r} value={r}>Row {r} (blocks {r}1–{r}6)</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="disease" className={labelStyles}>Disease pattern</label>
            <select id="disease" name="disease" className={inputStyles}>
              <option value="all">All</option>
              {SERIES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={generating} className={cx(buttonStyles.accent, "py-2.5")}>
            {generating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileBarChart className="size-4" aria-hidden />}
            Generate report
          </button>
        </form>
      </Card>

      {!report && !generating && (
        <div className="no-print rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <FileBarChart className="mx-auto size-8 text-leaf-300" aria-hidden />
          <p className="mt-2 text-sm font-medium text-ink">No report generated yet</p>
          <p className="mt-1 text-xs text-muted">Choose filters above and select Generate report.</p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Incident summary</h2>
              <p className="text-xs text-muted">
                {report.from} to {report.to} · {report.area === "all" ? "All blocks" : `Row ${report.area}`} ·{" "}
                {report.disease === "all" ? "All patterns" : SERIES.find((s) => s.key === report.disease)?.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SampleTag />
              <button type="button" onClick={() => window.print()} className={cx(buttonStyles.primary, "no-print")}>
                <FileDown className="size-4" aria-hidden /> Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat label="Total incidents" value={grand} />
            {totals.map((t) => (
              <Stat key={t.key} label={t.label} value={t.total} swatch={t.color} />
            ))}
          </div>

          <Card
            title="Incidents per month"
            description="Stacked by screened disease pattern"
            action={<SampleTag />}
          >
            <StackedColumns data={monthlyIncidents} series={series} />
          </Card>

          <p className="text-[11px] text-muted">
            Generated with model <span className="font-mono">{modelGovernance.activeVersion}</span> · Accuracy: not yet
            measured (no trained model) · Placeholder footer.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, swatch }: { label: string; value: number; swatch?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <p className="inline-flex items-center gap-2 text-xs font-medium text-muted sm:text-sm">
        {swatch && <span className="size-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function StackedColumns({ data, series }: { data: MonthlyCount[]; series: typeof SERIES }) {
  const [hover, setHover] = useState<string | null>(null);
  const totals = data.map((d) => series.reduce((n, s) => n + d[s.key], 0));
  const rawMax = Math.max(...totals, 1);
  const step = rawMax > 20 ? 10 : 5;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step).reverse();
  const height = 220;

  return (
    <div>
      {/* Legend */}
      <ul className="mb-4 flex flex-wrap gap-4">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-2 text-xs text-muted">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        {/* Y axis */}
        <div className="relative w-6 shrink-0 text-right text-[11px] tabular-nums text-muted" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-line/70" style={{ top: `${(1 - t / max) * 100}%` }} />
            ))}
          </div>

          <div className="relative flex items-end justify-around" style={{ height }}>
            {data.map((d, i) => {
              const active = hover === d.month;
              return (
                <div
                  key={d.month}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(d.month)}
                  onMouseLeave={() => setHover(null)}
                >
                  {active && <div className="absolute inset-y-0 inset-x-1 rounded-lg bg-leaf-50" aria-hidden />}
                  <div
                    className="relative flex w-7 flex-col-reverse gap-[2px]"
                    style={{ height: `${(totals[i] / max) * 100}%` }}
                  >
                    {series.map((s, si) => (
                      <div
                        key={s.key}
                        className={cx(si === series.length - 1 && "rounded-t")}
                        style={{ background: s.color, flexGrow: d[s.key], flexBasis: 0 }}
                      />
                    ))}
                  </div>
                  {active && (
                    <div className="absolute bottom-full z-10 mb-1 w-36 rounded-lg border border-line bg-white p-2.5 text-xs shadow-lg">
                      <p className="mb-1 font-semibold text-ink">{d.month} · {totals[i]} total</p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center justify-between gap-2 text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-sm" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="tabular-nums text-ink">{d[s.key]}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-around text-xs text-muted">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center">{d.month}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Table view */}
      <details className="mt-5 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">Show data table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1.5 font-medium">Month</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1.5 text-right font-medium">{s.label}</th>
                ))}
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {data.map((d, i) => (
                <tr key={d.month}>
                  <td className="py-1.5">{d.month}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 text-right">{d[s.key]}</td>
                  ))}
                  <td className="py-1.5 text-right font-semibold">{totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
