import type { ReactNode } from "react";
import Link from "next/link";
import { FileBarChart, SearchX } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { defaultReportFilters, getReport, parseReportFilters } from "@/lib/incident-stats";
import { REPORT_SERIES } from "@/lib/report-series";
import { ReportFilters } from "./report-filters";
import { PrintButton, StackedColumns } from "./report-chart";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams);
  const filters = parsed?.filters ?? defaultReportFilters();
  const supabase = await createClient();
  const report = parsed && !parsed.error ? await getReport(supabase, parsed.filters) : null;

  const series = filters.disease === "all" ? REPORT_SERIES : REPORT_SERIES.filter((s) => s.key === filters.disease);
  const diseaseLabel = filters.disease === "all" ? "All suspected diseases" : series[0]?.label;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Summarize recorded field incidents for a period and area, then export them as PDF."
      />

      <Card title="Report filters" className="no-print">
        {/* Keyed by the URL filters so the form resets when they change (e.g. back/forward). */}
        <ReportFilters key={JSON.stringify(filters)} initial={filters} />
      </Card>

      {!parsed && (
        <EmptyBox icon={<FileBarChart className="mx-auto size-8 text-leaf-300" aria-hidden />} title="No report generated yet">
          Choose filters above and select Generate report.
        </EmptyBox>
      )}

      {parsed?.error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {parsed.error}
        </p>
      )}

      {parsed && !parsed.error && !report && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          The report couldn&apos;t be loaded. Check your connection and try again.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Incident summary</h2>
              <p className="text-xs text-muted">
                {filters.from} to {filters.to} · {filters.area === "all" ? "All blocks" : `Row ${filters.area}`} ·{" "}
                {diseaseLabel}
              </p>
            </div>
            {report.total > 0 && <PrintButton />}
          </div>

          {report.total === 0 ? (
            <EmptyBox icon={<SearchX className="mx-auto size-8 text-leaf-300" aria-hidden />} title="No incidents match these filters">
              Try a wider date range or a different area or disease. New incidents are recorded in the{" "}
              <Link href="/incidents" className="font-medium text-leaf-700 hover:text-leaf-900">Incident Log</Link>.
            </EmptyBox>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <Stat label="Total incidents" value={report.total} />
                {series.map((s) => (
                  <Stat key={s.key} label={s.label} value={report.totals[s.key]} swatch={s.color} />
                ))}
              </div>

              <Card title="Incidents per month" description="Stacked by suspected disease, as recorded in the field">
                <StackedColumns data={report.months} series={series} />
              </Card>
            </>
          )}

          <p className="text-[11px] text-muted">
            Source: incidents saved in the Incident Log, counted by incident date. &ldquo;Suspected disease&rdquo; is
            the field team&apos;s observation — not a screening result or a confirmed diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyBox({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="no-print rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      {icon}
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-muted">{children}</p>
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
