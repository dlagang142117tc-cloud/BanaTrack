"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ImageOff, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { Card, Pill, SeverityBadge, buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import {
  ACTIONS,
  BLOCKS,
  MAX_NOTES_LENGTH,
  SEVERITIES,
  STATUSES,
  SUSPECTED_DISEASES,
  incidentCode,
  symptomsProblem,
} from "@/lib/incident-options";
import type { Severity } from "@/lib/mock-data";
import { deleteIncident, updateIncident, type IncidentActionResult } from "./actions";
import { SymptomPicker } from "./symptom-picker";

export interface IncidentRow {
  id: number;
  date: string;
  block: string;
  suspected: string;
  severity: string;
  action: string;
  notes: string;
  personnel: string;
  status: string;
  resolvedAt: string | null;
  lastEdit: { by: string; at: string } | null;
  symptoms: string[];
  photos: { id: string; url: string | null }[];
  weather: {
    rain3dMm: number | null;
    rain7dMm: number | null;
    humidityMeanPct: number | null;
    tempMeanC: number | null;
    windowStart: string | null;
    windowEnd: string | null;
    source: string | null;
  };
  /** Reporter, supervisors and admins — the same rule as the database policies. */
  canEdit: boolean;
}

// Timestamps are shown in plantation time; YYYY-MM-DD dates are formatted at UTC so they don't shift.
const timestampFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function shortDate(iso: string) {
  return shortDateFmt.format(new Date(`${iso}T12:00:00Z`));
}

function shiftIsoDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function IncidentHistory({ rows, loadError, limit }: { rows: IncidentRow[]; loadError: boolean; limit: number }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncidentRow | null>(null);
  const [editTarget, setEditTarget] = useState<IncidentRow | null>(null);
  const [pending, startTransition] = useTransition();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        [
          incidentCode(r.id),
          r.date,
          r.block,
          r.personnel,
          r.suspected,
          r.severity,
          r.action,
          r.notes,
          statusLabel(r.status),
          ...r.symptoms,
        ].some((v) => v.toLowerCase().includes(q)),
      )
    : rows;

  function askDelete(row: IncidentRow) {
    setDeleteTarget(row);
    deleteDialogRef.current?.showModal();
  }

  function openEdit(row: IncidentRow) {
    setEditTarget(row);
    editDialogRef.current?.showModal();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const res = await deleteIncident(id).catch(
        (): IncidentActionResult => ({ ok: false, message: "The incident could not be deleted." }),
      );
      setResult(res);
      deleteDialogRef.current?.close();
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
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas text-xs uppercase tracking-wider text-muted">
              <th className="px-5 py-2.5 font-medium sm:px-6">ID / Date</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Block</th>
              <th className="px-3 py-2.5 font-medium">Symptoms</th>
              <th className="px-3 py-2.5 font-medium">Photos</th>
              <th className="px-3 py-2.5 font-medium">Suspected</th>
              <th className="px-3 py-2.5 font-medium">Severity</th>
              <th className="px-3 py-2.5 font-medium">Personnel</th>
              <th className="px-3 py-2.5 font-medium">Action taken</th>
              <th
                className="px-3 py-2.5 font-medium"
                title="Rain, humidity and temperature for the 7 days up to and including the incident date."
              >
                Weather (7 days before)
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
                  {r.lastEdit && (
                    <p className="mt-1 max-w-40 text-[11px] leading-snug text-muted">
                      Edited by {r.lastEdit.by}, {timestampFmt.format(new Date(r.lastEdit.at))}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={r.status} />
                  {r.status === "resolved" && r.resolvedAt && (
                    <p className="mt-1 whitespace-nowrap text-[11px] text-muted">
                      {timestampFmt.format(new Date(r.resolvedAt))}
                    </p>
                  )}
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
                  {r.canEdit && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        aria-label={`Edit ${incidentCode(r.id)}`}
                        className={cx(buttonStyles.ghost, "px-2 py-1")}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => askDelete(r)}
                        aria-label={`Delete ${incidentCode(r.id)}`}
                        className={cx(buttonStyles.ghost, "px-2 py-1 text-red-700 hover:bg-red-50 hover:text-red-800")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-10 text-center text-sm text-muted">
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
        ref={editDialogRef}
        onClose={() => setEditTarget(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-leaf-950/50"
      >
        {editTarget && (
          // Keyed by incident so the form starts from that incident's values each time.
          <EditIncidentForm
            key={editTarget.id}
            row={editTarget}
            onCancel={() => editDialogRef.current?.close()}
            onSaved={(res) => {
              setResult(res);
              editDialogRef.current?.close();
            }}
          />
        )}
      </dialog>

      <dialog
        ref={deleteDialogRef}
        onClose={() => setDeleteTarget(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-leaf-950/50"
      >
        <div className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Delete incident</h2>
          <p className="text-sm text-muted">
            {deleteTarget && (
              <>
                <strong className="text-ink">{incidentCode(deleteTarget.id)}</strong> ({deleteTarget.block},{" "}
                {deleteTarget.date}) and its photos will be permanently deleted. This cannot be undone.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => deleteDialogRef.current?.close()}
              disabled={pending}
              className={buttonStyles.secondary}
            >
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

function EditIncidentForm({
  row,
  onCancel,
  onSaved,
}: {
  row: IncidentRow;
  onCancel: () => void;
  onSaved: (result: IncidentActionResult) => void;
}) {
  const [symptoms, setSymptoms] = useState(row.symptoms);
  const [symptomError, setSymptomError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeSymptoms(next: string[]) {
    setSymptoms(next);
    setSymptomError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    const symptomProblem = symptomsProblem(symptoms);
    setSymptomError(symptomProblem);
    if (symptomProblem) return;
    startTransition(async () => {
      const res = await updateIncident({
        id: row.id,
        status: String(data.get("status") ?? ""),
        block: String(data.get("block") ?? ""),
        suspected: String(data.get("suspected") ?? ""),
        severity: String(data.get("severity") ?? ""),
        action: String(data.get("action") ?? ""),
        notes: String(data.get("notes") ?? ""),
        symptoms,
      }).catch((): IncidentActionResult => ({ ok: false, message: "The changes could not be saved. Try again." }));
      if (res.ok) onSaved(res);
      else setError(res.message);
    });
  }

  const p = `edit-${row.id}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Edit {incidentCode(row.id)}</h2>
          <p className="text-sm text-muted">
            Recorded {row.date} by {row.personnel}. The date can&apos;t be changed because the weather snapshot is tied
            to it.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-muted hover:bg-leaf-50 hover:text-ink"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor={`${p}-status`}>
            <select id={`${p}-status`} name="status" defaultValue={row.status} className={inputStyles}>
              <OptionList options={STATUSES} current={row.status} />
            </select>
          </Field>
          <Field label="Block / area" htmlFor={`${p}-block`}>
            <select id={`${p}-block`} name="block" defaultValue={row.block} className={inputStyles}>
              <OptionList options={BLOCKS.map((b) => ({ value: b, label: b }))} current={row.block} />
            </select>
          </Field>
          <Field label="Suspected disease" htmlFor={`${p}-suspected`}>
            <select id={`${p}-suspected`} name="suspected" defaultValue={row.suspected} className={inputStyles}>
              <OptionList options={SUSPECTED_DISEASES} current={row.suspected} />
            </select>
          </Field>
          <Field label="Observed severity" htmlFor={`${p}-severity`}>
            <select id={`${p}-severity`} name="severity" defaultValue={row.severity} className={inputStyles}>
              <OptionList options={SEVERITIES} current={row.severity} />
            </select>
          </Field>
          <Field label="Action taken" htmlFor={`${p}-action`}>
            <select id={`${p}-action`} name="action" defaultValue={row.action} className={inputStyles}>
              <OptionList options={ACTIONS.map((a) => ({ value: a, label: a }))} current={row.action} />
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className={labelStyles}>Symptoms observed</legend>
          <SymptomPicker selected={symptoms} onChange={changeSymptoms} error={symptomError} />
        </fieldset>

        <Field label="Notes" htmlFor={`${p}-notes`}>
          <textarea
            id={`${p}-notes`}
            name="notes"
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            defaultValue={row.notes}
            className={inputStyles}
          />
        </Field>
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className={buttonStyles.ghost}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save changes
        </button>
      </div>
    </form>
  );
}

/**
 * The current option list, plus the incident's saved value if it's no longer
 * on the list — shown disabled so the user has to pick a valid one.
 */
function OptionList({ options, current }: { options: { value: string; label: string }[]; current: string }) {
  const missing = !options.some((o) => o.value === current);
  return (
    <>
      {missing && (
        <option value={current} disabled>
          {current} (no longer on the list)
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelStyles}>
        {label}
      </label>
      {children}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  open: "bg-banana-100 text-banana-700 ring-banana-300",
  monitoring: "bg-sky-50 text-sky-800 ring-sky-200",
  resolved: "bg-leaf-100 text-leaf-800 ring-leaf-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status] ?? "bg-canvas text-ink ring-line",
      )}
    >
      {statusLabel(status)}
    </span>
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

const SOURCE_LABELS: Record<string, string> = {
  "open-meteo-archive": "Open-Meteo historical",
  "open-meteo-forecast-past-days": "Open-Meteo recent (forecast past days)",
};

function WeatherCell({ weather }: { weather: IncidentRow["weather"] }) {
  const { rain3dMm, rain7dMm, humidityMeanPct, tempMeanC, windowStart, windowEnd, source } = weather;
  if ([rain3dMm, rain7dMm, humidityMeanPct, tempMeanC].every((v) => v === null)) {
    return <span className="text-xs text-muted">Unavailable</span>;
  }
  const show = (v: number | null, unit: string) => (v === null ? "—" : `${Number(v)}${unit}`);
  // Snapshots saved before migration 005 have no recorded window.
  const range = (from: string) => (windowEnd ? `${shortDate(from)} – ${shortDate(windowEnd)}` : undefined);
  const range7 = windowStart ? range(windowStart) : undefined;
  const range3 = windowEnd ? range(shiftIsoDate(windowEnd, -2)) : undefined;
  return (
    <div className="text-xs">
      <dl className="grid grid-cols-[auto_auto] gap-x-2 whitespace-nowrap">
        <dt className="text-muted" title={range3 && `Total rainfall, ${range3}`}>
          Rain 3d
        </dt>
        <dd className="font-mono tabular-nums">{show(rain3dMm, " mm")}</dd>
        <dt className="text-muted" title={range7 && `Total rainfall, ${range7}`}>
          Rain 7d
        </dt>
        <dd className="font-mono tabular-nums">{show(rain7dMm, " mm")}</dd>
        <dt className="text-muted" title={range7 && `Mean of daily mean relative humidity, ${range7}`}>
          Humidity
        </dt>
        <dd className="font-mono tabular-nums">{show(humidityMeanPct, "%")}</dd>
        <dt className="text-muted" title={range7 && `Mean of daily mean temperature, ${range7}`}>
          Temp
        </dt>
        <dd className="font-mono tabular-nums">{show(tempMeanC, " °C")}</dd>
      </dl>
      {range7 && <p className="mt-1 whitespace-nowrap text-[11px] text-muted">{range7}</p>}
      {source && (
        <p className="max-w-40 text-[11px] leading-snug text-muted">{SOURCE_LABELS[source] ?? source}</p>
      )}
    </div>
  );
}
