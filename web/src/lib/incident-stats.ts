import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { addDaysIso, isIsoDate, monthStartIso, plantationDayStart, todayIso } from "./dates";
import { BLOCKS, SEVERITIES, STATUSES, blockCols, blockRows } from "./incident-options";
import { OTHER_SERIES, REPORT_SERIES, type MonthlyCount } from "./report-series";

/**
 * Incident counts for the Dashboard and Reports, read from the incidents table
 * with the signed-in user's session (RLS: active users can read incidents).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Supabase returns at most 1000 rows per request by default, so longer
// results are read in pages of this size.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// ---------------------------------------------------------------- Dashboard

export const STATS_WINDOW_DAYS = 30;
/** The highest step of the placeholder severity scale. */
export const TOP_SEVERITY = SEVERITIES[SEVERITIES.length - 1];
/** Statuses that count as still open on the Dashboard. */
export const OPEN_STATUSES = ["open", "monitoring"];

export interface DashboardStats {
  totalEver: number;
  recent: number;
  previous: number;
  topSeverityRecent: number;
  /** Open or monitoring now, any incident date. */
  openNow: number;
  /** Set to resolved within the last 30 days (by resolved_at, plantation days). */
  resolvedRecent: number;
  blocksRecent: number;
  blocksTotal: number;
}

/** Counts for the last 30 days (by incident date, today included), or null if a query failed. */
export async function getDashboardStats(supabase: Supabase): Promise<DashboardStats | null> {
  const today = todayIso();
  const start = addDaysIso(today, -(STATS_WINDOW_DAYS - 1));
  const previousStart = addDaysIso(start, -STATS_WINDOW_DAYS);
  const count = () => supabase.from("incidents").select("id", { count: "exact", head: true });

  const [all, recent, previous, topSeverity, open, resolved, blocks] = await Promise.all([
    count(),
    count().gte("incident_date", start).lte("incident_date", today),
    count().gte("incident_date", previousStart).lt("incident_date", start),
    count().gte("incident_date", start).lte("incident_date", today).eq("severity", TOP_SEVERITY.value),
    count().in("status", OPEN_STATUSES),
    // resolved_at is cleared by a trigger when an incident is reopened.
    count()
      .gte("resolved_at", plantationDayStart(start))
      .lt("resolved_at", plantationDayStart(addDaysIso(today, 1))),
    fetchAllRows<{ block: string }>((from, to) =>
      supabase
        .from("incidents")
        .select("block")
        .gte("incident_date", start)
        .lte("incident_date", today)
        .order("id")
        .range(from, to),
    ),
  ]);

  if (all.error || recent.error || previous.error || topSeverity.error || open.error || resolved.error || !blocks) {
    return null;
  }

  return {
    totalEver: all.count ?? 0,
    recent: recent.count ?? 0,
    previous: previous.count ?? 0,
    topSeverityRecent: topSeverity.count ?? 0,
    openNow: open.count ?? 0,
    resolvedRecent: resolved.count ?? 0,
    blocksRecent: new Set(blocks.map((b) => b.block)).size,
    blocksTotal: BLOCKS.length,
  };
}

// ---------------------------------------------------------------- Reports

export const MAX_REPORT_MONTHS = 24;

export interface ReportFilters {
  from: string;
  to: string;
  /** "all" or a block row letter from the placeholder grid. */
  area: string;
  /** "all", a suspected_disease value, or OTHER_SERIES.key. */
  disease: string;
  /** "all" or a status value (the incident's current status). */
  status: string;
}

export function defaultReportFilters(): ReportFilters {
  return { from: monthStartIso(5), to: todayIso(), area: "all", disease: "all", status: "all" };
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Reads report filters from the URL. Returns null when no report was requested
 * (no from/to in the URL); `error` is set when the filters are invalid.
 */
export function parseReportFilters(
  params: SearchParams,
): { filters: ReportFilters; error: string | null } | null {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  if (!get("from") && !get("to")) return null;

  const defaults = defaultReportFilters();
  const filters: ReportFilters = {
    from: get("from") || defaults.from,
    to: get("to") || defaults.to,
    area: get("area") || "all",
    disease: get("disease") || "all",
    status: get("status") || "all",
  };

  let error: string | null = null;
  if (!isIsoDate(filters.from) || !isIsoDate(filters.to)) error = "Enter valid From and To dates.";
  else if (filters.from > filters.to) error = "The From date must be on or before the To date.";
  else if (monthKeys(filters.from, filters.to).length > MAX_REPORT_MONTHS)
    error = `Choose a range of ${MAX_REPORT_MONTHS} months or less.`;
  else if (filters.area !== "all" && !blockRows.includes(filters.area)) error = "Unknown area.";
  else if (filters.disease !== "all" && ![...REPORT_SERIES, OTHER_SERIES].some((s) => s.key === filters.disease))
    error = "Unknown disease.";
  else if (filters.status !== "all" && !STATUSES.some((s) => s.value === filters.status)) error = "Unknown status.";

  return { filters, error };
}

export interface Report {
  months: MonthlyCount[];
  totals: Record<string, number>;
  total: number;
}

/** Incidents matching the filters, counted per month and suspected disease. Null if the query failed. */
export async function getReport(supabase: Supabase, filters: ReportFilters): Promise<Report | null> {
  const rows = await fetchAllRows<{ incident_date: string; suspected_disease: string }>((from, to) => {
    let q = supabase
      .from("incidents")
      .select("incident_date, suspected_disease")
      .gte("incident_date", filters.from)
      .lte("incident_date", filters.to);
    if (filters.area !== "all") q = q.in("block", blockCols.map((c) => `${filters.area}${c}`));
    if (filters.status !== "all") q = q.eq("status", filters.status);
    // "Other" is filtered below, after reading.
    if (filters.disease !== "all" && filters.disease !== OTHER_SERIES.key) {
      q = q.eq("suspected_disease", filters.disease);
    }
    return q.order("id").range(from, to);
  });
  if (!rows) return null;

  const keys = monthKeys(filters.from, filters.to);
  const multiYear = keys[0].slice(0, 4) !== keys[keys.length - 1].slice(0, 4);
  const months: MonthlyCount[] = keys.map((month) => ({
    month,
    label: monthLabel(month, multiYear),
    counts: Object.fromEntries([...REPORT_SERIES, OTHER_SERIES].map((s) => [s.key, 0])),
  }));
  const byMonth = new Map(months.map((m) => [m.month, m]));

  // Values no longer in the options list are counted under "Other", so every
  // incident in the range shows up in the chart and the totals.
  const known = new Set(REPORT_SERIES.map((s) => s.key));
  for (const r of rows) {
    const key = known.has(r.suspected_disease) ? r.suspected_disease : OTHER_SERIES.key;
    if (filters.disease === OTHER_SERIES.key && key !== OTHER_SERIES.key) continue;
    const m = byMonth.get(r.incident_date.slice(0, 7));
    if (m) m.counts[key] += 1;
  }

  const totals = Object.fromEntries(
    [...REPORT_SERIES, OTHER_SERIES].map((s) => [s.key, months.reduce((n, m) => n + m.counts[s.key], 0)]),
  );
  const total = Object.values(totals).reduce((n, v) => n + v, 0);
  return { months, totals, total };
}

/** Every YYYY-MM from the month of `from` to the month of `to`. */
function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [endY, endM] = to.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function monthLabel(key: string, withYear: boolean) {
  const label = monthFmt.format(new Date(`${key}-01T00:00:00Z`));
  return withYear ? `${label} ’${key.slice(2, 4)}` : label;
}
