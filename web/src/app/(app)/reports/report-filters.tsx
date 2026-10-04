"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileBarChart, Loader2 } from "lucide-react";
import { buttonStyles, cx, inputStyles, labelStyles } from "@/components/ui";
import { blockCols, blockRows } from "@/lib/incident-options";
import { REPORT_SERIES } from "@/lib/report-series";

interface Filters {
  from: string;
  to: string;
  area: string;
  disease: string;
}

/** Puts the filters in the URL; the server page reads them and loads the report. */
export function ReportFilters({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function generate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const k of ["from", "to", "area", "disease"]) params.set(k, String(data.get(k) ?? ""));
    startTransition(() => router.push(`/reports?${params}`));
  }

  const lastCol = blockCols[blockCols.length - 1];

  return (
    <form onSubmit={generate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="from" className={labelStyles}>From</label>
        <input id="from" name="from" type="date" required defaultValue={initial.from} className={inputStyles} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="to" className={labelStyles}>To</label>
        <input id="to" name="to" type="date" required defaultValue={initial.to} className={inputStyles} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="area" className={labelStyles}>Area</label>
        <select id="area" name="area" defaultValue={initial.area} className={inputStyles}>
          <option value="all">All blocks</option>
          {blockRows.map((r) => (
            <option key={r} value={r}>Row {r} (blocks {r}{blockCols[0]}–{r}{lastCol})</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="disease" className={labelStyles}>Suspected disease</label>
        <select id="disease" name="disease" defaultValue={initial.disease} className={inputStyles}>
          <option value="all">All</option>
          {REPORT_SERIES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={cx(buttonStyles.accent, "py-2.5")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileBarChart className="size-4" aria-hidden />}
        Generate report
      </button>
    </form>
  );
}
