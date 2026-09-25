# BanaTrack — Session Notes

Running log of what's been built, what's incomplete, and known issues.
Update this at the end of each session.

---

## Session: 2026-09-25 — Full frontend (mock data)

### Added

- **Design system** — banana-plant palette in `web/src/app/globals.css`
  (`leaf-*` greens as primary, `banana-*` gold as accent, `canvas`/`ink`/`muted`/`line`
  neutrals). Fonts: Bricolage Grotesque (headings) + Plus Jakarta Sans (body) +
  Geist Mono (IDs/numbers), loaded in `web/src/app/layout.tsx`.
- **App shell** — `web/src/components/app-shell.tsx`: dark-green sidebar with
  active-item highlight, user/role card, sign out; slide-out drawer on mobile/tablet
  (< `lg`). Authenticated pages live under the `web/src/app/(app)/` route group,
  whose `layout.tsx` does the auth check and loads the profile.
- **Shared UI** — `web/src/components/ui.tsx` (Card, PageHeader, SampleTag,
  Severity/Priority badges, ConfidenceMeter, button/input styles),
  `weather-icon.tsx`, `auth-frame.tsx` (split-screen auth layout).
- **Screens** (all reachable from the sidebar):
  - `/login` — restyled to match.
  - `/signup` — **new**. Full name / email / password + confirm. Uses
    `supabase.auth.signUp` with `full_name` metadata (the `handle_new_user`
    trigger copies it to `profiles`; role defaults to `field_personnel`). Shows a
    "check your email" message when email confirmation is enabled.
  - `/dashboard` — risk banner, incident stats, 7-day weather, top review
    priority list, admin-only model governance card.
  - `/screening` — photo upload (drag/drop, tap, camera capture on phones),
    context fields, mock "Run screening", result panel (screening result,
    calibrated confidence, severity estimate, contributing evidence, sample
    localization box), preview buttons for Moko / Panama / Inconclusive states.
  - `/incidents` — recording form (date, block, personnel, action, suspected
    disease, severity, symptom chips, notes) + searchable history table.
  - `/review` — priority-sorted cases, Pending/Reviewed/All tabs,
    Confirm / Correct (label picker) / Reject / Escalate with undo,
    expandable evidence.
  - `/map` — 4×6 block grid (A1–D6) colored by severity, click for block details.
  - `/reports` — filters + Generate → summary stats, stacked monthly chart with
    hover tooltips + data table, Export PDF (browser print).
- **Mock data** — all placeholder data is in `web/src/lib/mock-data.ts`. Every UI
  section that uses it shows a gold dashed `<SampleTag />` ("Sample data — not
  real", "Placeholder forecast", "Mock result — no AI model yet", etc.).
- **Proxy** — `/signup` added to public routes; signed-in users visiting
  `/login` or `/signup` are redirected to `/dashboard`.
- **Dependency** — `lucide-react` (icons).

### Still missing / incomplete

- **Not visually verified yet** (need a manual click-through in a real browser):
  - Mobile slide-out menu (open/close, closing on navigation).
  - Screening result drawn over a *real* uploaded photo (the sample
    localization box position/label).
  - True phone width (~390px): headless screenshots were only possible down to
    500px. Dashboard, Incident Log, and Review Queue looked right at 500px.
- **No persistence anywhere** — new incidents and review decisions live in page
  state and vanish on refresh. Needs Supabase tables: incidents (+ photo
  storage), review actions (logged with model version + timestamp), screening
  submissions.
- **No real weather** — Open-Meteo integration not started; forecast + risk
  banner are hard-coded.
- **No AI/ML** — screening results are canned; FastAPI service, calibration,
  abstention threshold, Grad-CAM/SHAP not started. Photos are never uploaded.
- **Reports filters are cosmetic** — date range and area are ignored; the
  disease filter only changes which chart series show (stat tiles always show
  all). PDF export is `window.print()`, not react-pdf/jsPDF as planned.
- **Role-based visibility is minimal** — only the dashboard governance card is
  admin-gated. The sidebar and all screens show to every role. No admin
  screen for assigning roles yet.
- **Block layout is invented** — A–D × 1–6 grid with made-up areas/supervisors;
  replace with the plantation's real block list.
- **Dark mode removed** — the app is light-only for now.

### Known issues

- **Email-confirmation sign-up flow is incomplete** — there's no
  `/auth/callback` (or `/auth/confirm`) route and `signUp` doesn't pass
  `emailRedirectTo`, so confirmation links rely on the Supabase project's
  Site URL setting and won't create a session in the app. Either add the
  callback route or disable email confirmation for testing.
- **`web/.env.local.example` is not tracked** — `web/.gitignore` has `.env*`,
  which also ignores the example file that the README tells people to copy.
  Add `!.env.local.example` to `.gitignore` and commit it.
- **Hard-coded "today"** — mock data and form defaults assume 2026-09-25
  (incident form date, report date range, forecast days).
- **Dashboard assumes a user** — `dashboard/page.tsx` uses `user!.id`, relying on
  the `(app)/layout.tsx` redirect. Fine now, but fragile if the layout changes.
- **Chart edge case** — in the Reports stacked chart, a month whose top series
  is 0 loses its rounded cap, and zero-value segments still add a 2px gap.
- **Line endings** — git warns LF → CRLF on Windows; consider adding a
  `.gitattributes` (`* text=auto eol=lf`) to keep diffs clean.
