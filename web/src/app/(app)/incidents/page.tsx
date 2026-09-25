"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus, Search } from "lucide-react";
import {
  Card,
  PageHeader,
  Pill,
  SampleTag,
  SeverityBadge,
  buttonStyles,
  cx,
  inputStyles,
  labelStyles,
} from "@/components/ui";
import {
  actionOptions,
  blockCols,
  blockRows,
  incidents as sampleIncidents,
  personnelOptions,
  symptomOptions,
  type Incident,
} from "@/lib/mock-data";

const BLOCKS = blockRows.flatMap((r) => blockCols.map((c) => `${r}${c}`));

export default function IncidentsPage() {
  const [records, setRecords] = useState<(Incident & { local?: boolean })[]>(sampleIncidents);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleSymptom(s: string) {
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // Not persisted — held in page state until the Supabase incidents table exists.
    const record: Incident & { local: boolean } = {
      id: `INC-${String(143 + records.length - sampleIncidents.length).padStart(4, "0")}`,
      date: String(data.get("date")),
      block: String(data.get("block")),
      symptoms,
      suspected: data.get("suspected") as Incident["suspected"],
      severity: data.get("severity") as Incident["severity"],
      personnel: String(data.get("personnel")),
      action: String(data.get("action")),
      notes: String(data.get("notes") ?? ""),
      local: true,
    };
    setRecords((cur) => [record, ...cur]);
    setSymptoms([]);
    form.reset();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? records.filter((r) =>
        [r.id, r.block, r.personnel, r.suspected, r.action, ...r.symptoms].some((v) => v.toLowerCase().includes(q)),
      )
    : records;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Log"
        description="Record field incidents by block and review the history of past reports."
      />

      <Card
        title="Record a new incident"
        action={<SampleTag label="Not saved — preview only" />}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date" htmlFor="date">
              <input id="date" name="date" type="date" required defaultValue="2026-09-25" className={inputStyles} />
            </Field>
            <Field label="Block / area" htmlFor="block">
              <select id="block" name="block" required className={inputStyles}>
                {BLOCKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field label="Personnel" htmlFor="personnel">
              <select id="personnel" name="personnel" required className={inputStyles}>
                {personnelOptions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Action taken" htmlFor="action">
              <select id="action" name="action" required className={inputStyles}>
                {actionOptions.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Suspected disease" htmlFor="suspected">
              <select id="suspected" name="suspected" className={inputStyles}>
                <option value="Unconfirmed">Unconfirmed</option>
                <option value="Moko">Moko (bacterial wilt)</option>
                <option value="Panama">Panama (Fusarium wilt)</option>
              </select>
            </Field>
            <Field label="Observed severity" htmlFor="severity">
              <select id="severity" name="severity" className={inputStyles} defaultValue="moderate">
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className={labelStyles}>Symptoms observed</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {symptomOptions.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    aria-pressed={on}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-leaf-600 bg-leaf-600 text-white"
                        : "border-line bg-white text-ink hover:border-leaf-300 hover:bg-leaf-50",
                    )}
                  >
                    {on && <Check className="size-3" aria-hidden />}
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className={inputStyles}
              placeholder="Location details, number of mats affected, anything unusual…"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-leaf-700">
                <Check className="size-4" aria-hidden /> Added to the table below (not saved)
              </span>
            )}
            <button type="submit" className={buttonStyles.accent}>
              <Plus className="size-4" aria-hidden /> Record incident
            </button>
          </div>
        </form>
      </Card>

      <Card
        title="Incident history"
        description={`${visible.length} record${visible.length === 1 ? "" : "s"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SampleTag />
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search incidents"
                className={cx(inputStyles, "w-48 py-1.5 pl-8")}
              />
            </div>
          </div>
        }
      >
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-canvas text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-2.5 font-medium sm:px-6">ID / Date</th>
                <th className="px-3 py-2.5 font-medium">Block</th>
                <th className="px-3 py-2.5 font-medium">Symptoms</th>
                <th className="px-3 py-2.5 font-medium">Suspected</th>
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="px-3 py-2.5 font-medium">Personnel</th>
                <th className="px-5 py-2.5 font-medium sm:px-6">Action taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id} className="align-top hover:bg-leaf-50/50">
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap font-mono text-xs text-ink">{r.id}</span>
                      {r.local && (
                        <span className="rounded bg-banana-100 px-1.5 text-[10px] font-semibold text-banana-700">NEW</span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{r.date}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold">{r.block}</td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {r.symptoms.length ? r.symptoms.map((s) => <Pill key={s}>{s}</Pill>) : <span className="text-muted">—</span>}
                    </div>
                    {r.notes && <p className="mt-1 max-w-64 text-xs text-muted">{r.notes}</p>}
                  </td>
                  <td className="px-3 py-3">{r.suspected}</td>
                  <td className="px-3 py-3">
                    <SeverityBadge severity={r.severity} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.personnel}</td>
                  <td className="px-5 py-3 sm:px-6">{r.action}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted">
                    No incidents match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
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
