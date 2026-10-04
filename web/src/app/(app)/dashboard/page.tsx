import Link from "next/link";
import { AlertTriangle, ArrowRight, Droplets, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WeatherIcon } from "@/components/weather-icon";
import {
  Card,
  ConfidenceMeter,
  PageHeader,
  PriorityBadge,
  SampleTag,
  cx,
} from "@/components/ui";
import { STATS_WINDOW_DAYS, TOP_SEVERITY, getDashboardStats, type DashboardStats } from "@/lib/incident-stats";
import { awaitingReviewSample, modelGovernance, reviewCases } from "@/lib/mock-data";
import { PLANTATION_LOCATION, assessDiseaseRisk, getForecast } from "@/lib/weather";

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

type Tone = "warn" | "good" | "neutral";

function buildStatCards(stats: DashboardStats | null) {
  const value = (n: number | undefined) => (n === undefined ? "—" : n);
  const change = stats ? stats.recent - stats.previous : 0;
  return [
    {
      label: "Incidents",
      value: value(stats?.recent),
      note: !stats
        ? "Unavailable"
        : change === 0
          ? `Same as previous ${STATS_WINDOW_DAYS} days`
          : `${change > 0 ? "+" : "−"}${Math.abs(change)} vs. previous ${STATS_WINDOW_DAYS} days`,
      tone: (change > 0 ? "warn" : change < 0 ? "good" : "neutral") as Tone,
    },
    {
      label: "Blocks affected",
      value: value(stats?.blocksRecent),
      note: stats ? `of ${stats.blocksTotal} blocks` : "Unavailable",
      tone: "neutral" as Tone,
    },
    {
      label: `${TOP_SEVERITY.label} severity`,
      value: value(stats?.topSeverityRecent),
      note: "as recorded in the field",
      tone: (stats?.topSeverityRecent ? "warn" : "neutral") as Tone,
    },
    {
      label: "Awaiting review",
      value: awaitingReviewSample.value,
      note: awaitingReviewSample.note,
      tone: "warn" as Tone,
      sample: true,
    },
  ];
}

const RISK_TONE = {
  Low: { box: "border-leaf-200 bg-leaf-50", icon: "bg-leaf-500 text-white", chip: "ring-leaf-200" },
  Moderate: { box: "border-banana-300 bg-banana-50", icon: "bg-banana-400 text-ink", chip: "ring-banana-200" },
  Elevated: { box: "border-banana-500 bg-banana-100", icon: "bg-banana-500 text-ink", chip: "ring-banana-300" },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, forecast, stats] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user!.id).single(),
    getForecast(),
    getDashboardStats(supabase),
  ]);
  const statCards = buildStatCards(stats);

  const firstName = profile?.full_name?.split(" ")[0];
  const today = forecast?.days[0];
  const risk = forecast ? assessDiseaseRisk(forecast.days) : null;
  const tone = RISK_TONE[risk?.level ?? "Moderate"];
  const topCases = [...reviewCases]
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.confidence - a.confidence)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Good day, ${firstName}` : "Dashboard"}
        description="Plantation overview: field conditions, open incidents, and cases waiting on a reviewer."
      />

      {/* Disease-favorable conditions banner */}
      <div
        className={cx(
          "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
          risk ? tone.box : "border-line bg-white",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span
            className={cx(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              risk ? tone.icon : "bg-canvas text-muted",
            )}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-base font-semibold text-ink">
              Disease-favorable conditions: {risk?.level ?? "Unavailable"}
            </h2>
            {risk ? (
              <>
                <p className="mt-1 text-sm text-ink/80">{risk.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {risk.factors.map((f) => (
                    <li key={f} className={cx("rounded-full bg-white/80 px-3 py-1 text-xs text-ink/80 ring-1", tone.chip)}>
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink/80">
                The weather forecast couldn&apos;t be loaded, so conditions can&apos;t be assessed right now.
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              Contextual indicator based on the Open-Meteo forecast — this is not a diagnosis of any block or plant.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">Incidents</h2>
          <p className="text-xs text-muted">Last {STATS_WINDOW_DAYS} days, by incident date</p>
        </div>
        {!stats && (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Incident numbers couldn&apos;t be loaded. Try refreshing the page.
          </p>
        )}
        {stats?.totalEver === 0 && (
          <p className="mb-3 rounded-xl border border-dashed border-line bg-white p-3 text-sm text-muted">
            No incidents recorded yet. These numbers fill in as incidents are saved in the{" "}
            <Link href="/incidents" className="font-medium text-leaf-700 hover:text-leaf-900">Incident Log</Link>.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted sm:text-sm">{s.label}</p>
                {s.sample && <SampleTag />}
              </div>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{s.value}</p>
              <p
                className={cx(
                  "mt-1 text-xs",
                  s.tone === "warn" && "text-banana-700",
                  s.tone === "good" && "text-leaf-600",
                  s.tone === "neutral" && "text-muted",
                )}
              >
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5 xl:items-start">
        {/* Weather */}
        <Card
          className="xl:col-span-3"
          title="7-day weather"
          description={
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden /> {PLANTATION_LOCATION.name}
            </span>
          }
          action={
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted hover:text-ink"
            >
              Weather data by Open-Meteo
            </a>
          }
        >
          {!forecast || !today ? (
            <p className="rounded-xl bg-canvas p-4 text-sm text-muted">
              Forecast unavailable — couldn&apos;t reach Open-Meteo. Try refreshing in a few minutes.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-xl bg-leaf-50 p-4">
                <WeatherIcon condition={today.condition} className="size-10" />
                <div>
                  <p className="font-display text-3xl font-semibold tabular-nums">{today.tempMax}°</p>
                  <p className="text-xs text-muted">Low {today.tempMin}° · Humidity {today.humidity}%</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="inline-flex items-center gap-1 text-sm font-medium text-sky-700">
                    <Droplets className="size-4" aria-hidden /> {today.rainMm} mm
                  </p>
                  <p className="text-xs text-muted">expected rainfall</p>
                </div>
              </div>
              <div className="-mx-1 mt-4 overflow-x-auto pb-1">
                <ol className="grid min-w-[520px] grid-cols-7 gap-1 px-1">
                  {forecast.days.map((d) => (
                    <li key={d.date} className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-center hover:bg-leaf-50">
                      <span className="text-xs font-semibold text-ink">{d.day}</span>
                      <WeatherIcon condition={d.condition} className="size-6" />
                      <span className="text-sm font-medium tabular-nums">{d.tempMax}°</span>
                      <span className="text-xs tabular-nums text-muted">{d.tempMin}°</span>
                      <span className="text-[11px] tabular-nums text-sky-700">{d.rainMm} mm</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </Card>

        {/* Top review priority */}
        <Card
          className="xl:col-span-2"
          title="Top review priority"
          description="AI-flagged cases waiting on a reviewer"
          action={<SampleTag />}
        >
          <ul className="divide-y divide-line">
            {topCases.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">{c.id}</span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-ink">{c.label}</p>
                  <p className="text-xs text-muted">Block {c.block} · {c.submittedAt}</p>
                </div>
                <ConfidenceMeter value={c.confidence} />
              </li>
            ))}
          </ul>
          <Link
            href="/review"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-leaf-700 hover:text-leaf-900"
          >
            Open review queue <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Card>
      </div>

      {profile?.role === "admin" && (
        <Card
          title="Model governance"
          description="Visible to admins only"
          action={<SampleTag label="Placeholder — no model deployed" />}
        >
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Active version", modelGovernance.activeVersion],
              ["Deployed", modelGovernance.deployedOn],
              ["Abstention rate", `${Math.round(modelGovernance.abstentionRate * 100)}%`],
              ["Reviewer agreement", "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 font-mono text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
