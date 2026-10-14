import { SUSPECTED_DISEASES } from "./incident-options";

// Validated categorical palette (dataviz validator, light surface). The order
// here is the stacking order in the Reports chart.
const SERIES_COLORS: Record<string, string> = {
  Moko: "#2f8a4f",
  Panama: "#d9a011",
  Unconfirmed: "#5b7fc0",
};
const FALLBACK_COLOR = "#8a8f98";
const COLOR_ORDER = Object.keys(SERIES_COLORS);

export interface ReportSeries {
  /** The suspected_disease value stored on incidents. */
  key: string;
  label: string;
  color: string;
}

/** One chart series per suspected disease in the Incident Log options. */
export const REPORT_SERIES: ReportSeries[] = [...SUSPECTED_DISEASES]
  .sort((a, b) => rank(a.value) - rank(b.value))
  .map((d) => ({ key: d.value, label: d.label, color: SERIES_COLORS[d.value] ?? FALLBACK_COLOR }));

/**
 * Incidents whose suspected_disease is no longer in the options list (renamed
 * or removed) are counted here instead of being dropped. Shown only when
 * there are any. The key can't collide with a stored value from the list.
 */
export const OTHER_SERIES: ReportSeries = {
  key: "__other",
  label: "Other (no longer in the list)",
  color: FALLBACK_COLOR,
};

function rank(value: string) {
  const i = COLOR_ORDER.indexOf(value);
  return i === -1 ? COLOR_ORDER.length : i;
}

/** One column of the Reports chart: incidents per suspected disease in a month. */
export interface MonthlyCount {
  /** YYYY-MM */
  month: string;
  label: string;
  counts: Record<string, number>;
}

/** Incidents in one month across the shown series. */
export function monthTotal(month: MonthlyCount, series: ReportSeries[]): number {
  return series.reduce((n, s) => n + month.counts[s.key], 0);
}

/**
 * The y axis of the Reports chart: a round maximum and its ticks, highest
 * first. Shared by the page chart and the PDF so both draw the same scale.
 */
export function chartScale(totals: number[]): { max: number; ticks: number[] } {
  const rawMax = Math.max(...totals, 1);
  const step = rawMax > 50 ? Math.ceil(rawMax / 50) * 10 : rawMax > 20 ? 10 : rawMax > 5 ? 5 : 1;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step).reverse();
  return { max, ticks };
}
