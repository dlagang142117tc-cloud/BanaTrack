"use client";

import { useRef, useState, useTransition } from "react";
import { ImageOff, Loader2, Search, Trash2 } from "lucide-react";
import { Card, Pill, SeverityBadge, buttonStyles, cx, inputStyles } from "@/components/ui";
import { SEVERITIES, incidentCode } from "@/lib/incident-options";
import type { Severity } from "@/lib/mock-data";
import { deleteIncident, type IncidentActionResult } from "./actions";

export interface IncidentRow {
  id: number;
  date: string;
  block: string;
  suspected: string;
  severity: string;
  action: string;
  notes: string;
  personnel: string;
  symptoms: string[];
  photos: { id: string; url: string | null }[];
  weather: {
    rain3dMm: number | null;
    rain7dMm: number | null;
    humidityMeanPct: number | null;
    tempMeanC: number | null;
  };
  canDelete: boolean;
}

export function IncidentHistory({ rows, loadError, limit }: { rows: IncidentRow[]; loadError: boolean; limit: number }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [target, setTarget] = useState<IncidentRow | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        [incidentCode(r.id), r.date, r.block, r.personnel, r.suspected, r.severity, r.action, r.notes, ...r.symptoms].some(
          (v) => v.toLowerCase().includes(q),
        ),
      )
    : rows;

  function askDelete(row: IncidentRow) {
    setTarget(row);
    dialogRef.current?.showModal();
  }

  function confirmDelete() {
    if (!target) return;
    const id = target.id;
    startTransition(async () => {
      const res = await deleteIncident(id).catch(
        (): IncidentActionResult => ({ ok: false, message: "The incident could not be deleted." }),
      );
      setResult(res);
      dialogRef.current?.close();
    });
  }

  const count = `${visible.length} record${visible.length === 1 ? "" : "s"}`;

  return (
    <Card
      title="Incident history"
      description={rows.length >= limit ? `${count} · showing the latest ${limit}` : count}
      action={
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search incidents"
            aria-label="Search incidents"
            className={cx(inputStyles, "w-48 py-1.5 pl-8")}
          />
        </div>
      }
    >
      {result && (
        <p role="status" className={cx("mb-3 text-sm", result.ok ? "text-leaf-700" : "text-red-700")}>
          {result.message}
        </p>
      )}
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas text-xs uppercase tracking-wider text-muted">
              <th className="px-5 py-2.5 font-medium sm:px-6">ID / Date</th>
              <th className="px-3 py-2.5 font-medium">Block</th>
              <th className="px-3 py-2.5 font-medium">Symptoms</th>
              <th className="px-3 py-2.5 font-medium">Photos</th>
              <th className="px-3 py-2.5 font-medium">Suspected</th>
              <th className="px-3 py-2.5 font-medium">Severity</th>
              <th className="px-3 py-2.5 font-medium">Personnel</th>
              <th className="px-3 py-2.5 font-medium">Action taken</th>
              <th className="px-3 py-2.5 font-medium" title="Open-Meteo, 7 days up to the incident date">
                Weather (7 days)
              </th>
              <th className="px-5 py-2.5 sm:px-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.id} className="align-top hover:bg-leaf-50/50">
                <td className="px-5 py-3 sm:px-6">
                  <span className="whitespace-nowrap font-mono text-xs text-ink">{incidentCode(r.id)}</span>
                  <p className="whitespace-nowrap text-xs text-muted">{r.date}</p>
                </td>
                <td className="px-3 py-3 font-semibold">{r.block}</td>
                <td className="px-3 py-3">
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {r.symptoms.length ? r.symptoms.map((s) => <Pill key={s}>{s}</Pill>) : <span className="text-muted">—</span>}
                  </div>
                  {r.notes && <p className="mt-1 max-w-64 whitespace-pre-line text-xs text-muted">{r.notes}</p>}
                </td>
                <td className="px-3 py-3">
                  <Thumbnails photos={r.photos} code={incidentCode(r.id)} />
                </td>
                <td className="px-3 py-3">{r.suspected}</td>
                <td className="px-3 py-3">
                  <SeverityCell value={r.severity} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">{r.personnel}</td>
                <td className="px-3 py-3">{r.action}</td>
                <td className="px-3 py-3">
                  <WeatherCell weather={r.weather} />
                </td>
                <td className="px-5 py-3 text-right sm:px-6">
                  {r.canDelete && (
                    <button
                      type="button"
                      onClick={() => askDelete(r)}
                      aria-label={`Delete ${incidentCode(r.id)}`}
                      className={cx(buttonStyles.ghost, "px-2 py-1 text-red-700 hover:bg-red-50 hover:text-red-800")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-muted">
                  {loadError
                    ? "Incidents could not be loaded. Refresh the page to try again."
                    : q
                      ? `No incidents match “${query}”.`
                      : "No incidents recorded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setTarget(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-leaf-950/50"
      >
        <div className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Delete incident</h2>
          <p className="text-sm text-muted">
            {target && (
              <>
                <strong className="text-ink">{incidentCode(target.id)}</strong> ({target.block}, {target.date}) and its
                photos will be permanently deleted. This cannot be undone.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className={cx(buttonStyles.primary, "bg-red-700 hover:bg-red-800")}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Delete permanently
            </button>
          </div>
        </div>
      </dialog>
    </Card>
  );
}

function Thumbnails({ photos, code }: { photos: IncidentRow["photos"]; code: string }) {
  if (!photos.length) return <span className="text-muted">—</span>;
  return (
    <div className="flex max-w-40 flex-wrap gap-1">
      {photos.map((p, i) =>
        p.url ? (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block size-11 overflow-hidden rounded-md border border-line bg-canvas hover:ring-2 hover:ring-leaf-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
            <img src={p.url} alt={`${code} photo ${i + 1}`} loading="lazy" className="size-full object-cover" />
          </a>
        ) : (
          <span
            key={p.id}
            title="Photo unavailable"
            className="flex size-11 items-center justify-center rounded-md border border-line bg-canvas text-muted"
          >
            <ImageOff className="size-4" aria-hidden />
          </span>
        ),
      )}
    </div>
  );
}

const BADGE_SEVERITIES = ["low", "moderate", "high"];

function SeverityCell({ value }: { value: string }) {
  // SeverityBadge has colors for low/moderate/high; any other value (e.g. after
  // the scale changes) shows its label from SEVERITIES, or the raw value.
  if (BADGE_SEVERITIES.includes(value)) return <SeverityBadge severity={value as Severity} />;
  return <Pill>{SEVERITIES.find((s) => s.value === value)?.label ?? value}</Pill>;
}

function WeatherCell({ weather }: { weather: IncidentRow["weather"] }) {
  const { rain3dMm, rain7dMm, humidityMeanPct, tempMeanC } = weather;
  if ([rain3dMm, rain7dMm, humidityMeanPct, tempMeanC].every((v) => v === null)) {
    return <span className="text-xs text-muted">Unavailable</span>;
  }
  const show = (v: number | null, unit: string) => (v === null ? "—" : `${Number(v)}${unit}`);
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-2 whitespace-nowrap text-xs">
      <dt className="text-muted">Rain 3d</dt>
      <dd className="font-mono tabular-nums">{show(rain3dMm, " mm")}</dd>
      <dt className="text-muted">Rain 7d</dt>
      <dd className="font-mono tabular-nums">{show(rain7dMm, " mm")}</dd>
      <dt className="text-muted">Humidity</dt>
      <dd className="font-mono tabular-nums">{show(humidityMeanPct, "%")}</dd>
      <dt className="text-muted">Temp</dt>
      <dd className="font-mono tabular-nums">{show(tempMeanC, " °C")}</dd>
    </dl>
  );
}
