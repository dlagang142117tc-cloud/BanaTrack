"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui";
import type { MonthlyCount, ReportSeries } from "@/lib/report-series";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={cx(buttonStyles.primary, "no-print")}>
      <FileDown className="size-4" aria-hidden /> Export PDF
    </button>
  );
}

const COLUMN_MIN_WIDTH = 44;

export function StackedColumns({ data, series }: { data: MonthlyCount[]; series: ReportSeries[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const totals = data.map((d) => series.reduce((n, s) => n + d.counts[s.key], 0));
  const rawMax = Math.max(...totals, 1);
  const step = rawMax > 50 ? Math.ceil(rawMax / 50) * 10 : rawMax > 20 ? 10 : rawMax > 5 ? 5 : 1;
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

      {/* Scrolls sideways on narrow screens; the top padding keeps hover tooltips from being clipped. */}
      <div className="-mx-1 -mt-28 overflow-x-auto px-1 pt-28">
        <div className="flex gap-3" style={{ minWidth: data.length * COLUMN_MIN_WIDTH + 36 }}>
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
                // Only non-zero segments are drawn, so an empty series adds no gap
                // and the top visible segment always gets the rounded cap.
                const segments = series.filter((s) => d.counts[s.key] > 0);
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
                      {segments.map((s, si) => (
                        <div
                          key={s.key}
                          className={cx(si === segments.length - 1 && "rounded-t")}
                          style={{ background: s.color, flexGrow: d.counts[s.key], flexBasis: 0 }}
                        />
                      ))}
                    </div>
                    {active && (
                      <div className="absolute bottom-full z-10 mb-1 w-40 rounded-lg border border-line bg-white p-2.5 text-xs shadow-lg">
                        <p className="mb-1 font-semibold text-ink">{d.label} · {totals[i]} total</p>
                        {series.map((s) => (
                          <p key={s.key} className="flex items-center justify-between gap-2 text-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-2 rounded-sm" style={{ background: s.color }} />
                              {s.label}
                            </span>
                            <span className="tabular-nums text-ink">{d.counts[s.key]}</span>
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
                <span key={d.month} className="flex-1 text-center">{d.label}</span>
              ))}
            </div>
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
                  <td className="py-1.5">{d.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 text-right">{d.counts[s.key]}</td>
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
