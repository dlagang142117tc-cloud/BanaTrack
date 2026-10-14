import type { Report, ReportFilters } from "./incident-stats";
import { STATUSES } from "./incident-options";
import { OTHER_SERIES, REPORT_SERIES, type ReportSeries } from "./report-series";

/**
 * What the Reports page and the PDF export show for a set of filters: the
 * series, the filter labels and the source note. Both read from here so the
 * page and the PDF can't disagree.
 */

/** The chart series to show. "Other" only appears when some incidents have a value no longer in the list. */
export function reportSeries(filters: ReportFilters, report: Report | null): ReportSeries[] {
  if (filters.disease !== "all") return [...REPORT_SERIES, OTHER_SERIES].filter((s) => s.key === filters.disease);
  return report?.totals[OTHER_SERIES.key] ? [...REPORT_SERIES, OTHER_SERIES] : REPORT_SERIES;
}

export interface FilterLabels {
  range: string;
  area: string;
  disease: string;
  status: string;
}

export function filterLabels(filters: ReportFilters): FilterLabels {
  const disease =
    filters.disease === "all"
      ? "All suspected diseases"
      : ([...REPORT_SERIES, OTHER_SERIES].find((s) => s.key === filters.disease)?.label ?? filters.disease);
  const status =
    filters.status === "all"
      ? "Any status"
      : `${STATUSES.find((s) => s.value === filters.status)?.label ?? filters.status} now`;
  return {
    range: `${filters.from} to ${filters.to}`,
    area: filters.area === "all" ? "All blocks" : `Row ${filters.area}`,
    disease,
    status,
  };
}

export const REPORT_SOURCE_NOTE =
  "Source: incidents saved in the Incident Log, counted by incident date. Status is each incident's " +
  "current status, not its status during the period. “Suspected disease” is the field team's " +
  "observation — not a screening result or a confirmed diagnosis. “Other” counts " +
  "suspected-disease values that are no longer in the Incident Log list.";

/** For example banatrack-report-2026-05-01-to-2026-10-14.pdf */
export function reportFileName(filters: ReportFilters): string {
  return `banatrack-report-${filters.from}-to-${filters.to}.pdf`;
}

/** The report filters as URL query parameters (same shape the Reports page reads). */
export function reportQuery(filters: ReportFilters): string {
  const { from, to, area, disease, status } = filters;
  return new URLSearchParams({ from, to, area, disease, status }).toString();
}
