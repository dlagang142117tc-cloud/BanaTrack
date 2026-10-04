import { PLANTATION_LOCATION } from "./weather";

// en-CA formats as YYYY-MM-DD, the value format of <input type="date">.
// Pinned to the plantation's time zone so server and browser render the same day.
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: PLANTATION_LOCATION.timezone });

/** Today's date at the plantation, as YYYY-MM-DD. */
export function todayIso(): string {
  return isoDateFmt.format(new Date());
}

/** The first day of the month `monthsBack` months before the current one, as YYYY-MM-DD. */
export function monthStartIso(monthsBack: number): string {
  const [year, month] = todayIso().split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** A YYYY-MM-DD date moved by `days` days (negative goes back). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
