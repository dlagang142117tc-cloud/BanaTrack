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
import {
  diseaseRisk,
  incidentStats,
  modelGovernance,
  reviewCases,
  weatherForecast,
  weatherLocation,
} from "@/lib/mock-data";

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0];
  const today = weatherForecast[0];
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
      <div className="relative overflow-hidden rounded-2xl border border-banana-300 bg-banana-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-banana-400 text-ink">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold text-ink">
                Disease-favorable conditions: {diseaseRisk.level}
              </h2>
              <SampleTag label="Placeholder forecast" />
            </div>
            <p className="mt-1 text-sm text-ink/80">{diseaseRisk.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {diseaseRisk.factors.map((f) => (
                <li key={f} className="rounded-full bg-white/80 px-3 py-1 text-xs text-ink/80 ring-1 ring-banana-200">
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Contextual indicator only — this is not a diagnosis of any block or plant.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">Incidents</h2>
          <SampleTag />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {incidentStats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-muted sm:text-sm">{s.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{s.value}</p>
              <p
                className={cx(
                  "mt-1 text-xs",
                  s.tone === "warn" && "text-banana-700",
                  s.tone === "good" && "text-leaf-600",
                  s.tone === "neutral" && "text-muted",
                )}
              >
                {s.delta}
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
              <MapPin className="size-3" aria-hidden /> {weatherLocation}
            </span>
          }
          action={<SampleTag label="Placeholder forecast" />}
        >
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
              {weatherForecast.map((d) => (
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
