"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { Card, PageHeader, SampleTag, SeverityBadge, cx } from "@/components/ui";
import {
  blockCols,
  blockRows,
  incidents,
  plantationBlocks,
  type Severity,
} from "@/lib/mock-data";

const TILE_STYLES: Record<Severity, string> = {
  none: "bg-leaf-100 text-leaf-800 hover:bg-leaf-200",
  low: "bg-leaf-300 text-leaf-950 hover:bg-leaf-400",
  moderate: "bg-banana-300 text-ink hover:bg-banana-400",
  high: "bg-red-500 text-white hover:bg-red-600",
};

const LEGEND: { severity: Severity; label: string }[] = [
  { severity: "none", label: "No incidents" },
  { severity: "low", label: "Low" },
  { severity: "moderate", label: "Moderate" },
  { severity: "high", label: "High" },
];

const byId = Object.fromEntries(plantationBlocks.map((b) => [b.id, b]));

export default function MapPage() {
  const [selectedId, setSelectedId] = useState("B3");
  const selected = byId[selectedId];
  const blockIncidents = incidents.filter((i) => i.block === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantation Map"
        description="Block-level view of incident severity. Select a block to see its details."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Blocks A–D"
          action={<SampleTag label="Sample layout & data" />}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-[1.5rem_repeat(6,minmax(0,1fr))] gap-2">
                <span />
                {blockCols.map((c) => (
                  <span key={c} className="text-center text-xs font-medium text-muted">{c}</span>
                ))}
                {blockRows.map((r) => (
                  <Row key={r} row={r} selectedId={selectedId} onSelect={setSelectedId} />
                ))}
              </div>
              <div className="mt-2 ml-8 rounded-md bg-sky-100 py-1 text-center text-[11px] font-medium text-sky-800">
                Drainage canal
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
            {LEGEND.map((l) => (
              <span key={l.severity} className="inline-flex items-center gap-2 text-xs text-muted">
                <span className={cx("size-3.5 rounded", TILE_STYLES[l.severity].split(" ")[0])} />
                {l.label}
              </span>
            ))}
          </div>
        </Card>

        <Card title={selected ? `Block ${selected.id}` : "Block details"} action={<SampleTag />}>
          {selected ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selected.severity} />
                {selected.dominant && (
                  <span className="text-xs text-muted">Mostly {selected.dominant}-like reports</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Active incidents", selected.activeIncidents],
                  ["Area", `${selected.areaHa} ha`],
                  ["Last inspected", selected.lastInspected],
                  ["Supervisor", selected.supervisor],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-leaf-50 p-3">
                    <dt className="text-[11px] text-muted">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Recent incidents</p>
                {blockIncidents.length ? (
                  <ul className="space-y-2">
                    {blockIncidents.map((i) => (
                      <li key={i.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">{i.id}</span>
                          <span className="text-xs text-muted">{i.date}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink">{i.symptoms.join(", ")}</p>
                        <p className="text-xs text-muted">{i.action}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No incidents logged for this block recently.</p>
                )}
              </div>

              <Link
                href="/incidents"
                className="inline-flex items-center gap-1 text-sm font-semibold text-leaf-700 hover:text-leaf-900"
              >
                Open incident log <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <MousePointerClick className="size-4" aria-hidden /> Select a block on the map.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({
  row,
  selectedId,
  onSelect,
}: {
  row: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <span className="self-center text-xs font-medium text-muted">{row}</span>
      {blockCols.map((c) => {
        const b = byId[`${row}${c}`];
        const active = b.id === selectedId;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id)}
            aria-pressed={active}
            aria-label={`Block ${b.id}, ${b.severity} severity, ${b.activeIncidents} active incidents`}
            className={cx(
              "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all",
              TILE_STYLES[b.severity],
              active && "ring-4 ring-leaf-800 ring-offset-2",
            )}
          >
            {b.id}
            {b.activeIncidents > 0 && (
              <span className="mt-0.5 text-[10px] font-medium opacity-80">{b.activeIncidents} open</span>
            )}
          </button>
        );
      })}
    </>
  );
}
