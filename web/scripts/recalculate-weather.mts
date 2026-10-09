/**
 * Recalculates the weather snapshot of existing incidents with the current
 * rule (lib/weather.ts getWeatherSnapshot: the 7 days before and including the
 * incident date, historical archive first) and prints old → new values.
 *
 * Run from web/ (Node 24+ runs TypeScript directly):
 *   node --env-file=.env.local scripts/recalculate-weather.mts [--only-forecast] [--dry-run]
 *
 *   --only-forecast  only incidents without an archive snapshot (e.g. same-day
 *                    incidents saved with forecast hours; re-run a few days later)
 *   --dry-run        print the new values without saving them
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY: the service role is the only role allowed to
 * write the weather columns. These writes are not recorded as user edits.
 */
import { createClient } from "@supabase/supabase-js";
import { PLANTATION_LOCATION, getWeatherSnapshot } from "../src/lib/weather.ts";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const onlyForecast = args.has("--only-forecast");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run with --env-file=.env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: PLANTATION_LOCATION.timezone }).format(new Date());

let query = supabase
  .from("incidents")
  .select(
    `id, incident_date, weather_rain_3d_mm, weather_rain_7d_mm, weather_humidity_mean_pct, weather_temp_mean_c,
     weather_source, weather_window_start, weather_window_end`,
  )
  .order("id");
if (onlyForecast) query = query.or("weather_source.is.null,weather_source.neq.open-meteo-archive");
const { data: incidents, error } = await query;
if (error) {
  console.error(`Could not load incidents: ${error.message}`);
  process.exit(1);
}

console.log(`${incidents.length} incident(s) · today ${today} (Asia/Manila)${dryRun ? " · DRY RUN, nothing saved" : ""}\n`);

const v = (x: unknown) => (x === null || x === undefined ? "—" : String(Number(x)));
let saved = 0;
let failed = 0;

for (const i of incidents) {
  const code = `INC-${String(i.id).padStart(4, "0")}`;
  const snap = await getWeatherSnapshot(i.incident_date, today);
  console.log(`${code}  incident date ${i.incident_date}`);
  console.log(
    `  old: window ${i.weather_window_start ?? "?"} … ${i.weather_window_end ?? "?"}  source ${i.weather_source ?? "—"}\n` +
      `       rain 3d ${v(i.weather_rain_3d_mm)} mm · rain 7d ${v(i.weather_rain_7d_mm)} mm · ` +
      `humidity ${v(i.weather_humidity_mean_pct)}% · temp ${v(i.weather_temp_mean_c)} °C`,
  );
  if (!snap) {
    console.log("  new: weather unavailable from Open-Meteo, old values kept\n");
    failed++;
    continue;
  }
  console.log(
    `  new: window ${snap.windowStart} … ${snap.windowEnd}  source ${snap.source}\n` +
      `       rain 3d ${v(snap.rain3dMm)} mm · rain 7d ${v(snap.rain7dMm)} mm · ` +
      `humidity ${v(snap.humidityMeanPct)}% · temp ${v(snap.tempMeanC)} °C`,
  );
  if (dryRun) {
    console.log("");
    continue;
  }

  const { error: updateError } = await supabase
    .from("incidents")
    .update({
      weather_rain_3d_mm: snap.rain3dMm,
      weather_rain_7d_mm: snap.rain7dMm,
      weather_humidity_mean_pct: snap.humidityMeanPct,
      weather_temp_mean_c: snap.tempMeanC,
      weather_window_start: snap.windowStart,
      weather_window_end: snap.windowEnd,
      weather_source: snap.source,
      weather_fetched_at: new Date().toISOString(),
    })
    .eq("id", i.id);
  if (updateError) {
    console.log(`  NOT SAVED: ${updateError.message}\n`);
    failed++;
  } else {
    console.log("  saved\n");
    saved++;
  }
}

console.log(dryRun ? "Dry run finished." : `Done: ${saved} saved, ${failed} not updated.`);
