/**
 * Real 7-day forecast from Open-Meteo (https://open-meteo.com) — free, no API
 * key. Fetched server-side and cached for 30 minutes. Also the past-weather
 * snapshot saved with each incident (getWeatherSnapshot, below).
 */

export type WeatherCondition = "sun" | "partly" | "cloud" | "rain" | "storm";

export interface WeatherDay {
  day: string;
  date: string;
  condition: WeatherCondition;
  tempMax: number;
  tempMin: number;
  rainMm: number;
  humidity: number;
}

export interface Forecast {
  location: string;
  days: WeatherDay[];
}

export const PLANTATION_LOCATION = {
  name: "Tagum City, Davao del Norte",
  latitude: 7.4478,
  longitude: 125.8078,
  timezone: "Asia/Manila",
};

const REVALIDATE_SECONDS = 30 * 60;

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  relative_humidity_2m_mean: number[];
}

/** WMO weather interpretation codes → the five icons the UI has. */
function toCondition(code: number): WeatherCondition {
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 2) return "partly";
  if (code <= 1) return "sun";
  return "cloud";
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Returns null when Open-Meteo is unreachable or returns something unexpected. */
export async function getForecast(): Promise<Forecast | null> {
  const { latitude, longitude, timezone, name } = PLANTATION_LOCATION;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    forecast_days: "7",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const { daily } = (await res.json()) as { daily?: OpenMeteoDaily };
    if (!daily?.time?.length) return null;

    const days = daily.time.map((iso, i) => {
      // Open-Meteo dates are already local to the plantation; format at UTC so they don't shift.
      const d = new Date(`${iso}T12:00:00Z`);
      const rain = daily.precipitation_sum[i] ?? 0;
      return {
        day: i === 0 ? "Today" : dayFmt.format(d),
        date: dateFmt.format(d),
        condition: toCondition(daily.weather_code[i]),
        tempMax: Math.round(daily.temperature_2m_max[i]),
        tempMin: Math.round(daily.temperature_2m_min[i]),
        rainMm: rain < 10 ? Math.round(rain * 10) / 10 : Math.round(rain),
        humidity: Math.round(daily.relative_humidity_2m_mean[i]),
      };
    });
    return { location: name, days };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Risk

export type RiskLevel = "Low" | "Moderate" | "Elevated";

export interface DiseaseRisk {
  level: RiskLevel;
  summary: string;
  factors: string[];
}

/**
 * Rule-of-thumb weather indicator for wilt-disease-favorable conditions
 * (Moko / Panama spread with warm, wet, humid weather). Heuristic only —
 * thresholds are not calibrated against plantation incident data.
 */
export function assessDiseaseRisk(days: WeatherDay[]): DiseaseRisk {
  const next3Rain = days.slice(0, 3).reduce((s, d) => s + d.rainMm, 0);
  const humidDays = days.filter((d) => d.humidity >= 85).length;
  const heavyRainDays = days.filter((d) => d.rainMm >= 10).length;
  const minT = Math.min(...days.map((d) => d.tempMin));
  const maxT = Math.max(...days.map((d) => d.tempMax));
  const meanT = days.reduce((s, d) => s + (d.tempMax + d.tempMin) / 2, 0) / days.length;
  const warm = meanT >= 24 && meanT <= 32;

  const rainScore = next3Rain >= 30 || heavyRainDays >= 3 ? 2 : next3Rain >= 10 || heavyRainDays >= 1 ? 1 : 0;
  const humidScore = humidDays >= 4 ? 2 : humidDays >= 2 ? 1 : 0;
  const score = rainScore + humidScore + (warm ? 1 : 0);
  const level: RiskLevel = score >= 4 ? "Elevated" : score >= 2 ? "Moderate" : "Low";

  const drivers: string[] = [];
  if (humidScore) drivers.push(humidScore === 2 ? "persistently high humidity" : "periods of high humidity");
  if (rainScore) drivers.push(rainScore === 2 ? "heavy rainfall" : "some rainfall");
  if (warm && drivers.length) drivers.push("warm temperatures");

  const summary =
    level === "Low"
      ? "The 7-day forecast does not show a sustained run of wet, humid weather. Keep routine monitoring in place."
      : `${level} risk this week due to ${joinList(drivers)}. Warm, wet conditions favor the spread of soil- and water-borne wilt pathogens.`;

  return {
    level,
    summary,
    factors: [
      `${fmt(next3Rain)} mm cumulative rainfall expected over the next 3 days`,
      `Relative humidity ≥ 85% on ${humidDays} of the next ${days.length} days`,
      `Temperature ${minT}–${maxT} °C${warm ? " (within favorable range)" : ""}`,
    ],
  };
}

function fmt(mm: number) {
  return mm < 10 ? mm.toFixed(1) : String(Math.round(mm));
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// ---------------------------------------------------------------- Incident snapshot

export type WeatherSource = "open-meteo-archive" | "open-meteo-forecast-past-days";

export interface WeatherSnapshot {
  /** Total rainfall, windowEnd − 2 days … windowEnd. */
  rain3dMm: number | null;
  /** Total rainfall, windowStart … windowEnd (7 days). */
  rain7dMm: number | null;
  /** Mean of the 7 daily mean relative humidities, windowStart … windowEnd. */
  humidityMeanPct: number | null;
  /** Mean of the 7 daily mean temperatures, windowStart … windowEnd. */
  tempMeanC: number | null;
  /** YYYY-MM-DD, plantation time, inclusive: incident date − 6 days. */
  windowStart: string;
  /** YYYY-MM-DD, plantation time, inclusive: the incident date. */
  windowEnd: string;
  source: WeatherSource;
}

export const SNAPSHOT_DAYS = 7;
// Open-Meteo's forecast endpoint serves at most 92 past days.
const MAX_PAST_DAYS = 92;
const SNAPSHOT_FIELDS = "precipitation_sum,relative_humidity_2m_mean,temperature_2m_mean";

interface SnapshotDaily {
  time: string[];
  precipitation_sum: (number | null)[];
  relative_humidity_2m_mean: (number | null)[];
  temperature_2m_mean: (number | null)[];
}

export function shiftIsoDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

function sum(values: (number | null)[]) {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length ? Math.round(known.reduce((s, v) => s + v, 0) * 10) / 10 : null;
}

function mean(values: (number | null)[]) {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length ? Math.round((known.reduce((s, v) => s + v, 0) / known.length) * 10) / 10 : null;
}

async function fetchDaily(url: string): Promise<SnapshotDaily | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const { daily } = (await res.json()) as { daily?: SnapshotDaily };
    return daily?.time?.length ? daily : null;
  } catch {
    return null;
  }
}

/** The window's days only, in order; null unless every day is present. */
function pickWindow(daily: SnapshotDaily, start: string, end: string) {
  const rows = daily.time
    .map((date, i) => ({
      date,
      rain: daily.precipitation_sum[i] ?? null,
      humidity: daily.relative_humidity_2m_mean[i] ?? null,
      temp: daily.temperature_2m_mean[i] ?? null,
    }))
    .filter((r) => r.date >= start && r.date <= end);
  return rows.length === SNAPSHOT_DAYS ? rows : null;
}

/**
 * Weather at the plantation for the 7 days BEFORE AND INCLUDING `dateIso`
 * (YYYY-MM-DD, plantation time): 3-day and 7-day rainfall totals, mean
 * relative humidity and mean temperature. Saved with each incident as context
 * for later review — never forecast days after the incident.
 *
 * Source: Open-Meteo's historical archive. When the archive doesn't have every
 * day of the window yet (it lags behind by a day or more), the forecast
 * endpoint's `past_days` data is used instead. For an incident dated today,
 * that day's values include forecast hours that haven't happened yet; re-run
 * `web/scripts/recalculate-weather.mts` later to replace them.
 *
 * Returns null when Open-Meteo is unreachable or has no data for those days.
 */
export async function getWeatherSnapshot(dateIso: string, todayIso: string): Promise<WeatherSnapshot | null> {
  const { latitude, longitude, timezone } = PLANTATION_LOCATION;
  const windowStart = shiftIsoDate(dateIso, -(SNAPSHOT_DAYS - 1));
  const windowEnd = dateIso;
  const base = { latitude: String(latitude), longitude: String(longitude), timezone, daily: SNAPSHOT_FIELDS };

  let source: WeatherSource = "open-meteo-archive";
  let rows = null;
  if (windowEnd < todayIso) {
    const archive = await fetchDaily(
      `https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({ ...base, start_date: windowStart, end_date: windowEnd })}`,
    );
    rows = archive && pickWindow(archive, windowStart, windowEnd);
    // Recent days can be missing (null) until the archive catches up.
    if (rows?.some((r) => r.rain === null || r.humidity === null || r.temp === null)) rows = null;
  }

  if (!rows) {
    const pastDays = daysBetween(windowStart, todayIso);
    if (pastDays > MAX_PAST_DAYS) return null;
    source = "open-meteo-forecast-past-days";
    const recent = await fetchDaily(
      `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ ...base, past_days: String(pastDays), forecast_days: "1" })}`,
    );
    rows = recent && pickWindow(recent, windowStart, windowEnd);
  }
  if (!rows) return null;

  const snapshot: WeatherSnapshot = {
    rain3dMm: sum(rows.slice(-3).map((r) => r.rain)),
    rain7dMm: sum(rows.map((r) => r.rain)),
    humidityMeanPct: mean(rows.map((r) => r.humidity)),
    tempMeanC: mean(rows.map((r) => r.temp)),
    windowStart,
    windowEnd,
    source,
  };
  const empty = [snapshot.rain3dMm, snapshot.rain7dMm, snapshot.humidityMeanPct, snapshot.tempMeanC].every(
    (v) => v === null,
  );
  return empty ? null : snapshot;
}
