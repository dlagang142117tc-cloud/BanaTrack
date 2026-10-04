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
