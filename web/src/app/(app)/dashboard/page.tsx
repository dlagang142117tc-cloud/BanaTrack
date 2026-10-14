import Link from "next/link";
import { ArrowRight, CloudRain, Droplets, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PAGES, can, isPageKey } from "@/lib/permissions";
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
import { PRIORITY_LABELS } from "@/lib/screening-options";
import { getAwaitingReview, getModelGovernance, type AwaitingReview } from "@/lib/screenings";
import { PLANTATION_LOCATION, forecastRainTotal, getForecast } from "@/lib/weather";

type Tone = "warn" | "good" | "neutral";

function buildStatCards(stats: DashboardStats | null, awaiting: AwaitingReview | null | undefined) {
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
      label: "Open now",
      value: value(stats?.openNow),
      note: stats ? "open or monitoring, any date" : "Unavailable",
      tone: (stats?.openNow ? "warn" : "neutral") as Tone,
    },
    {
      label: `Resolved (${STATS_WINDOW_DAYS} days)`,
      value: value(stats?.resolvedRecent),
      note: stats ? "marked resolved in this period" : "Unavailable",
      tone: (stats?.resolvedRecent ? "good" : "neutral") as Tone,
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
    // undefined: the role can't see reviews, so the card is left out.
    ...(awaiting === undefined
      ? []
      : [
          {
            label: "Awaiting review",
            value: value(awaiting?.total),
            note: !awaiting
              ? "Unavailable"
              : [`${awaiting.high} high priority`, awaiting.escalated ? `${awaiting.escalated} escalated` : null]
                  .filter(Boolean)
                  .join(" · "),
            tone: (awaiting?.total ? "warn" : "neutral") as Tone,
          },
        ]),
  ];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireUser();
  const showReview = can(profile?.role, "review.view");
  const showGovernance = can(profile?.role, "dashboard.governance");
  const [{ denied }, forecast, stats, awaiting, governance] = await Promise.all([
    searchParams,
    getForecast(),
    getDashboardStats(supabase),
    showReview ? getAwaitingReview(supabase) : undefined,
    showGovernance ? getModelGovernance(supabase) : null,
  ]);
  // Set by requirePage() when the role may not open a page.
  const deniedPage = isPageKey(denied) ? PAGES[denied] : null;
  const statCards = buildStatCards(stats, awaiting);

  const firstName = profile?.full_name?.split(" ")[0];
  const today = forecast?.days[0];
  const rainTotals = forecast
    ? [3, 7].filter((n) => n <= forecast.days.length).map((n) => ({ days: n, mm: forecastRainTotal(forecast.days, n) }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Good day, ${firstName}` : "Dashboard"}
        description={
          showReview
            ? "Plantation overview: field conditions, open incidents, and cases waiting on a reviewer."
            : "Plantation overview: field conditions and open incidents."
        }
      />

      {deniedPage && (
        <p role="alert" className="rounded-xl border border-banana-300 bg-banana-50 p-3 text-sm text-ink">
          Your role doesn&apos;t have access to {deniedPage.label}. Ask an admin if you think this is wrong.
        </p>
      )}

      {/* Weather context: placeholder until the weather link is reviewed with the adviser (docs/weather-sources.md). */}
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
            <CloudRain className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-base font-semibold text-ink">Weather context</h2>
            {rainTotals.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {rainTotals.map((r) => (
                  <li key={r.days} className="rounded-full bg-canvas px-3 py-1 text-xs text-ink/80 ring-1 ring-line">
                    Forecast rain, next {r.days} days: <span className="font-semibold tabular-nums">{r.mm} mm</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink/80">The weather forecast couldn&apos;t be loaded right now.</p>
            )}
            <p className="mt-3 text-xs text-muted">
              Shown for context only. The link between weather and Moko/Panama disease in BanaTrack has not been
              validated yet; this panel will be updated after consultation.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">Incidents</h2>
          <p className="text-xs text-muted">
            Last {STATS_WINDOW_DAYS} days by incident date (Resolved: by resolved date; Open now: all dates)
          </p>
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
        {/* Six cards: 2 or 3 per row. Five cards: the last one is full width on
            phones, and the desktop rows are 3 + 2 so neither row has a gap. */}
        <div
          className={cx(
            "grid grid-cols-2 gap-3 lg:gap-4",
            statCards.length === 5 ? "lg:grid-cols-6" : "lg:grid-cols-3",
          )}
        >
          {statCards.map((s, i) => (
            <div
              key={s.label}
              className={cx(
                "rounded-2xl border border-line bg-white p-4 sm:p-5",
                statCards.length === 5 && (i < 3 ? "lg:col-span-2" : "lg:col-span-3"),
                statCards.length === 5 && i === 4 && "col-span-2",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted sm:text-sm">{s.label}</p>
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
          className={showReview ? "xl:col-span-3" : "xl:col-span-5"}
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
        {showReview && (
          <Card
            className="xl:col-span-2"
            title="Top review priority"
            description="Screenings waiting on a reviewer, by case-review priority"
            action={<SampleTag label="Mock results" />}
          >
            {!awaiting ? (
              <p className="rounded-xl bg-canvas p-4 text-sm text-muted">
                Screenings couldn&apos;t be loaded. Try refreshing the page.
              </p>
            ) : awaiting.top.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                No screenings waiting for review.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {awaiting.top.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">{c.code}</span>
                        <PriorityBadge priority={PRIORITY_LABELS[c.result.priority]} />
                        {c.escalated && (
                          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                            Escalated
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-ink">
                        {c.result.status === "abstained" ? "Inconclusive — system abstained" : c.result.label}
                      </p>
                      <p className="text-xs text-muted">Block {c.block} · {c.submittedAt}</p>
                    </div>
                    <ConfidenceMeter value={c.result.confidence} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/review"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-leaf-700 hover:text-leaf-900"
            >
              Open review queue <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Card>
        )}
      </div>

      {showGovernance && (
        <Card
          title="Model governance"
          description="Visible to admins only"
          action={governance?.isMock ? <SampleTag label="Mock model — no real model deployed" /> : undefined}
        >
          {!governance ? (
            <p className="rounded-xl bg-canvas p-4 text-sm text-muted">
              Model information couldn&apos;t be loaded. Try refreshing the page.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Active version", governance.activeVersion ?? "None active"],
                ["Deployed", governance.deployedAt ?? "Not deployed"],
                [
                  "Abstention rate",
                  governance.abstentionRate === null
                    ? "No screenings yet"
                    : `${Math.round(governance.abstentionRate * 100)}% of ${governance.screenings}`,
                ],
                [
                  "Abstention threshold",
                  governance.abstentionThreshold === null ? "—" : `${Math.round(governance.abstentionThreshold * 100)}%`,
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 font-mono text-sm text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}
    </div>
  );
}
