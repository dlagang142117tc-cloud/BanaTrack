import type { ReactNode } from "react";
import { Leaf, ScanSearch, ShieldCheck, Map } from "lucide-react";

const POINTS = [
  { icon: ScanSearch, text: "Photo-based screening for Moko and Panama wilt patterns" },
  { icon: ShieldCheck, text: "Every AI result goes through human review" },
  { icon: Map, text: "Block-level incident tracking across the plantation" },
];

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-leaf-950 p-12 text-leaf-100 lg:flex lg:flex-col">
        {/* Decorative leaf shapes */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-[60%_0] bg-leaf-800/60" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-[28rem] rounded-[0_60%] bg-leaf-900" aria-hidden />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-banana-400 text-leaf-950">
            <Leaf className="size-5" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="font-display text-xl font-semibold text-white">BanaTrack</span>
        </div>

        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Healthier blocks start with <span className="text-banana-300">earlier signals.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-leaf-200">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4 text-banana-300" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-leaf-400">Disease screening & decision support · Tagum City, Davao del Norte</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-banana-400 text-leaf-950">
              <Leaf className="size-5" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="font-display text-lg font-semibold text-ink">BanaTrack</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
