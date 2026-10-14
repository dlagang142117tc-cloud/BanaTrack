import type { ReactNode } from "react";
import Link from "next/link";
import { FileBarChart, SearchX } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { defaultReportFilters, getReport, parseReportFilters } from "@/lib/incident-stats";
import { REPORT_SOURCE_NOTE, filterLabels, reportFileName, reportQuery, reportSeries } from "@/lib/report-view";
import { ReportFilters } from "./report-filters";
import { DownloadPdfButton, StackedColumns } from "./report-chart";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requirePage("reports");
  const parsed = parseReportFilters(await searchParams);
  const filters = parsed?.filters ?? defaultReportFilters();
  const report = parsed && !parsed.error ? await getReport(supabase, parsed.filters) : null;

  const series = reportSeries(filters, report);
  const labels = filterLabels(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Summarize recorded field incidents for a period and area, then download them as a PDF."
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
                {labels.range} · {labels.area} · {labels.disease} · {labels.status}
              </p>
            </div>
            {report.total > 0 && (
              <DownloadPdfButton href={`/reports/export?${reportQuery(filters)}`} fileName={reportFileName(filters)} />
            )}
          </div>

          {report.total === 0 ? (
            <EmptyBox icon={<SearchX className="mx-auto size-8 text-leaf-300" aria-hidden />} title="No incidents match these filters">
              Try a wider date range or a different area, disease or status. New incidents are recorded in the{" "}
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

              <Card
                title="Incidents per month"
                className="break-inside-avoid"
                description="Stacked by suspected disease, as recorded in the field"
              >
                <StackedColumns data={report.months} series={series} />
              </Card>
            </>
          )}

          <p className="text-[11px] text-muted">{REPORT_SOURCE_NOTE}</p>
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
        {swatch && <span className="print-colors size-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
