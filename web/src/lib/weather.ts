/**
 * Real 7-day forecast from Open-Meteo (https://open-meteo.com) — free, no API
 * key. Fetched server-side and cached for 30 minutes.
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

export interface WeatherSnapshot {
  rain3dMm: number | null;
  rain7dMm: number | null;
  humidityMeanPct: number | null;
  tempMeanC: number | null;
  /** Which Open-Meteo API the numbers came from. */
  source: "open-meteo-forecast" | "open-meteo-archive";
}

const SNAPSHOT_DAYS = 7;
// The forecast API also serves recent past days (up to ~3 months back); older
// dates come from the historical archive, which lags a few days behind.
const FORECAST_API_DAYS_BACK = 60;

function shiftIsoDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sum(values: (number | null)[]) {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length ? Math.round(known.reduce((s, v) => s + v, 0) * 10) / 10 : null;
}

function mean(values: (number | null)[]) {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length ? Math.round((known.reduce((s, v) => s + v, 0) / known.length) * 10) / 10 : null;
}

/**
 * Weather at the plantation for the 7 days up to and including `dateIso`
 * (YYYY-MM-DD): 3-day and 7-day rainfall totals, mean relative humidity and
 * mean temperature. Saved with each incident as context for later review.
 * Returns null when Open-Meteo is unreachable or has no data for those days.
 */
export async function getWeatherSnapshot(dateIso: string, todayIso: string): Promise<WeatherSnapshot | null> {
  const { latitude, longitude, timezone } = PLANTATION_LOCATION;
  const useForecastApi = dateIso >= shiftIsoDate(todayIso, -FORECAST_API_DAYS_BACK);
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    start_date: shiftIsoDate(dateIso, -(SNAPSHOT_DAYS - 1)),
    end_date: dateIso,
    daily: "precipitation_sum,relative_humidity_2m_mean,temperature_2m_mean",
  });
  const base = useForecastApi
    ? "https://api.open-meteo.com/v1/forecast"
    : "https://archive-api.open-meteo.com/v1/archive";

  try {
    const res = await fetch(`${base}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const { daily } = (await res.json()) as {
      daily?: {
        time: string[];
        precipitation_sum: (number | null)[];
        relative_humidity_2m_mean: (number | null)[];
        temperature_2m_mean: (number | null)[];
      };
    };
    if (!daily?.time?.length) return null;

    const snapshot: WeatherSnapshot = {
      rain3dMm: sum(daily.precipitation_sum.slice(-3)),
      rain7dMm: sum(daily.precipitation_sum),
      humidityMeanPct: mean(daily.relative_humidity_2m_mean),
      tempMeanC: mean(daily.temperature_2m_mean),
      source: useForecastApi ? "open-meteo-forecast" : "open-meteo-archive",
    };
    const empty = [snapshot.rain3dMm, snapshot.rain7dMm, snapshot.humidityMeanPct, snapshot.tempMeanC].every(
      (v) => v === null,
    );
    return empty ? null : snapshot;
  } catch {
    return null;
  }
}
