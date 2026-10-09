# BanaTrack — Session Notes

Running log of what's been built, what's incomplete, and known issues.
Update this at the end of each session.

---

## Session: 2026-10-09 — Incident Log fixes after testing (branch `feature/incident-log`)

### Added

- **`supabase/migrations/005_incident_status_and_weather.sql`** (Denns runs
  it; 004 is unchanged):
  - `incidents.status` (`open` / `monitoring` / `resolved`, check constraint,
    default `open`; existing rows become `open`) and `resolved_at` (set or
    cleared by a trigger when status changes).
  - `last_edited_by` (restrict), `last_edited_by_name`, `last_edited_at`,
    set by the `track_incident_changes` trigger from the session on every
    user edit. Service-role writes (weather) don't count as edits.
  - `weather_window_start` / `weather_window_end`: the days the snapshot
    covers.
  - Column grants: users may insert only the observation columns
    (date, block, disease, severity, action, notes, reported_by) and update
    only status, block, suspected disease, severity, action and notes.
    `incident_date` is locked so it always matches the weather window.
  - `guard_incident_weather` trigger: any `authenticated`/`anon` insert or
    update that sets or changes a weather column or the date is rejected
    (a second layer behind the grants).
  - `update_incident()` RPC: saves the incident row and replaces its symptoms
    in one transaction. Runs as the caller, so RLS and grants still apply.
- **Edit incident** (pencil button in the history table, for the reporter,
  supervisors and admins): status, block, suspected disease, severity,
  action, symptoms, notes. Server action `updateIncident` validates against
  `incident-options.ts` (new `STATUSES` list) and calls the RPC.
- **History table**: Status column (badge, resolved time); "Edited by X, time"
  under the ID; weather cell shows the date window and source, and hovering
  each label shows exactly what it covers.
- **`web/scripts/recalculate-weather.mts`**: recalculates existing snapshots
  with the service role and prints old → new values
  (`node --env-file=.env.local scripts/recalculate-weather.mts
  [--only-forecast] [--dry-run]`, run from `web/`). `tsconfig.json` now has
  `allowImportingTsExtensions` so the script can import `lib/weather.ts`.
- `users/activity.ts` (server-only): `ACTIVITY_TABLES` moved here, plus
  `incidents.last_edited_by`. `/users` disables Delete upfront for users with
  field records ("Has field records, deactivate instead"); the server action
  still refuses on its own.

### Changed

- **Weather snapshot rule** (`getWeatherSnapshot`), D = incident date,
  Asia/Manila days, inclusive: rain 3d = total D−2…D; rain 7d = total
  D−6…D; humidity and temperature = mean of the daily means D−6…D. Source:
  Open-Meteo historical archive; if the archive doesn't have every day yet
  (it ends yesterday or earlier), the forecast endpoint's `past_days`. Stored
  as `open-meteo-archive` or `open-meteo-forecast-past-days`. (Before, any
  date in the last 60 days came from the forecast API.)
- **Weather is server-only**: `createIncident` inserts the incident with the
  user's session (no weather), then `attachWeather` writes the snapshot with
  the service role client.

### Tested

- Lint, type-check and build pass. `getWeatherSnapshot` checked against live
  Open-Meteo for today, yesterday, last week and March (archive sums match
  the raw API).
- 005 run in Supabase (2026-10-09). Recalculation script run: INC-0001
  (2026-10-07) now uses `open-meteo-archive`, window 2026-10-01…2026-10-07
  (rain 3d 28.9 → 30.0 mm, rain 7d 69.2 → 70.3 mm, humidity 88.6 → 88.3%,
  temp 26.7 → 26.8 °C); its symptoms and photos are unchanged, and the
  recalculation wasn't recorded as a user edit.
- **Manual tests, 2026-10-09 (partly done):** passed: status, editing,
  resolve/reopen, search. **Left:** other roles (field user can't edit
  others' incidents; supervisor/admin can), new incidents dated today and a
  week ago (weather source/window), Users page Delete button. Also not yet
  run: weather/date changes via the API rejected, and saving without
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Later on 2026-10-09:** Denns passed all the manual tests left above
  (except saving without the service role key). API permission check run
  with a temporary Field Personnel user
  signed in with the anon key, on an incident they reported: updating
  `weather_rain_7d_mm`, updating `incident_date`, and inserting with a weather
  value were all rejected (HTTP 403, `42501 permission denied for table
  incidents`, from the column grants; the trigger layer is never reached).
  The row was unchanged. The temp user and its incident (id 5) were deleted,
  so incident ids skip 5 (the next one is INC-0006).
- **"No visible symptoms" and weather header** (Denns tested both,
  2026-10-09, all passed):
  - `incident-options.ts`: `NO_VISIBLE_SYMPTOMS` ("No visible symptoms") and
    `symptomsProblem()`, the shared rule: at least one symptom or "No visible
    symptoms", never both. Stored as an ordinary `incident_symptoms` row, so
    no migration.
  - `SymptomPicker` now takes `onChange` and handles the exclusivity itself
    (ticking "No visible symptoms" clears the symptoms; ticking a symptom
    clears it), and shows an `error` under the chips. Used by the new-incident
    form and the edit dialog; both block saving with the error if nothing is
    ticked. `createIncident` / `updateIncident` check the same rule on the
    server.
  - Existing incidents are unchanged; editing one that has no symptoms now
    requires choosing a symptom or "No visible symptoms".
  - History header renamed to "Weather (7 days before)" with the tooltip "Rain,
    humidity and temperature for the 7 days up to and including the incident
    date."
  - Lint, type-check and build pass.
  - **Left for later:** the symptom rule isn't enforced in the database; a
    direct call to `update_incident()` (or inserts into `incident_symptoms`)
    can still leave an incident with no symptoms. Would need a migration
    (e.g. a deferred constraint trigger).
  - **Left for later:** the incident history table is wide and needs
    sideways scrolling on phones.

### Known issues / left to do

- **Weather snapshots need `SUPABASE_SERVICE_ROLE_KEY`** in `web/.env.local`
  (and in production). Without it, incidents still save but with no weather
  snapshot; the success message says so.
- **Same-day incidents** use forecast hours for the rest of that day
  (`open-meteo-forecast-past-days`). Re-run
  `scripts/recalculate-weather.mts --only-forecast` a few days later to
  replace them with archive data.
- Edits don't keep a history, only the last editor and time.
- The script prints a harmless Node warning (`MODULE_TYPELESS_PACKAGE_JSON`).

---

## Session: 2026-10-04 — Dashboard and Reports use real incidents (branch `feature/dashboard-reports-real-data`)

Built on top of `feature/incident-log` (not yet merged when this started), so
**the Incident Log PR must be merged first**. No new migration.

### Added

- **`web/src/lib/incident-stats.ts`** (server-only) — all incident counting:
  - `getDashboardStats()` — last 30 days by incident date (today included):
    incident count, change vs. the 30 days before, distinct blocks affected,
    count at the top severity step, plus an all-time count for the empty state.
  - `parseReportFilters()` / `getReport()` — validates `from`, `to`, `area`
    (block row) and `disease` from the URL, filters in the database, counts
    per month (every month in the range, zeros included). Max 24 months.
  - Rows are read in pages of 1000 (Supabase's default row cap).
- **`web/src/lib/report-series.ts`** — chart series built from
  `SUSPECTED_DISEASES` in `incident-options.ts`, with the existing palette.
- **Reports** is now a server page driven by the URL
  (`/reports?from=&to=&area=&disease=`), so a report can be bookmarked or
  shared. `report-filters.tsx` (form, pushes the URL) and `report-chart.tsx`
  (stacked chart + data table, Export PDF button) are client components.

### Changed

- Dashboard stat cards: **Incidents**, **Blocks affected**, **High severity**
  (all last 30 days, real) and **Awaiting review** (still sample, tagged).
  "Open" / "Resolved" cards were dropped: incidents have no status column.
- Reports: summary tiles follow the disease filter; labels say "suspected
  disease, as recorded in the field" (not "screened pattern"); the fake model
  footer is replaced by a source note. Empty states for "no report yet",
  "no matching incidents", invalid filters and load errors.
- Chart fix: zero-value segments are no longer drawn, so no stray 2px gaps
  and the top segment always keeps its rounded cap (old known issue).
- `mock-data.ts`: removed `incidentStats` and `monthlyIncidents`; kept
  `awaitingReviewSample`. The Map still uses the sample incidents.

### Tested

- Lint, type-check and build pass.
- **Not tested against Supabase yet** — needs `004_incident_log.sql` run and
  a few saved incidents.

### Known issues / left to do

- Incidents whose `suspected_disease` is no longer in the options list are
  left out of report counts.
- Area filter is by placeholder block row (A–D); change it with the real
  block list.
- Export is still `window.print()` (Reports PDF export is its own task).

---

## Session: 2026-10-04 — Incident Log saves real data (branch `feature/incident-log`)

### Added

- **`supabase/migrations/004_incident_log.sql`** (Denns runs it):
  - `incidents` — date, block, suspected disease, severity, action, notes,
    `reported_by` + `reporter_name` (set by a trigger from the session, never
    from the client), and the weather snapshot columns (3-day / 7-day rain,
    mean humidity, mean temperature, source, fetched-at).
  - `incident_symptoms` (one row per symptom) and `incident_photos` (one row
    per file, `uploaded_by`).
  - Private storage bucket `incident-photos` (10 MB, JPEG/PNG/WebP/HEIC);
    files live under `<user id>/<uuid>.<ext>`.
  - Helpers `is_active_user()` and `can_manage_incidents()` (active
    supervisor/admin). RLS: active users read and create (as themselves);
    update/delete only for the reporter, supervisors and admins; deactivated
    users get nothing. Same rules on the bucket. Updates are limited by column
    grants to the observation fields (not reporter, dates, or weather).
  - Values (block, symptom, severity…) are plain text — no DB constraints.
- **`web/src/lib/incident-options.ts`** — the single place for the block list
  (placeholder A1–D6; `mock-data.ts` re-exports it for the Map/Screening/
  Reports previews), symptoms, severity scale, suspected diseases, actions and
  photo limits. The server action validates against these lists.
- **`getWeatherSnapshot()`** in `lib/weather.ts` — Open-Meteo daily data for
  the 7 days up to the incident date (forecast API for the last 60 days,
  archive API before that). Returns null on failure; the incident still saves.
- **`/incidents`** rebuilt: server page loads real incidents (newest first,
  latest 500) with signed thumbnail URLs (1 hour); `incident-form.tsx`
  (personnel = signed-in user, read-only; up to 6 photos uploaded from the
  browser straight to the bucket, then `createIncident` links them; uploads
  are removed again if saving fails); `incident-history.tsx` (search, photo
  thumbnails, weather column, delete with confirmation for permitted users).
- `users/actions.ts` `ACTIVITY_TABLES` now lists `incidents.reported_by` and
  `incident_photos.uploaded_by`, so accounts with incidents must be
  deactivated instead of deleted.

### Changed

- Sample data / "Not saved" tags removed from the Incident Log only. Dashboard,
  Map and Reports still use mock incidents (separate roadmap tasks).

### Tested

- Lint, type-check and build pass. Both Open-Meteo endpoints checked by hand.
- **Not yet tested against Supabase** — needs `004_incident_log.sql` run first.

### Known issues / left to do

- ~~No edit screen yet (the database already allows edits for the reporter,
  supervisors and admins).~~ **Resolved 2026-10-09:** edit dialog + status.
- ~~The weather snapshot is fetched by the server but inserted with the user's
  session, so a user calling the API directly could insert their own weather
  numbers. Acceptable for now; move the insert to the service role if it
  matters.~~ **Resolved 2026-10-09:** written by the service role only (005).
- If a photo file can't be removed after a failed save or delete, it stays in
  the bucket as an orphan.
- Thumbnails are the full-size images (no resizing); signed URLs expire after
  1 hour, so a long-open page needs a refresh.
- History search is client-side over the latest 500 incidents.

---

## Session: 2026-10-03 — Team rules and web roadmap (branch `chore/team-rules`)

### Added

- **`docs/web-roadmap.md`** — the remaining web tasks that need neither
  plantation data nor the ML model, each with a "Done means" checklist:
  Incident Log → Dashboard and Reports → Role-based access → Screening and
  Review Queue → Reports PDF export → Weather risk banner → Plantation Map
  (last). One roadmap task per branch.
- **"Team workflow rules" in root `CLAUDE.md`** — never commit/push to `main`
  or merge PRs (only Denns merges); start from a fresh `main` on a
  `feature/`, `fix/` or `chore/<short-description>` branch (roadmap task, bug
  fix, setup/cleanup — the "Git" section says the same); tell Denns before any SQL migration;
  explain the plan and wait for approval; finish with lint/type-check/build,
  push, PR, summary and test checklist.

### Next

- Start on the roadmap's **Incident Log** task (needs a new migration — tell
  Denns first).

---

## Session: 2026-10-03 — Phase 0 housekeeping (branch `chore/phase-0-housekeeping`)

### Added

- **`/auth/callback` route** (`web/src/app/auth/callback/route.ts`) — target of
  Supabase confirmation emails. Accepts `?code=` (default template, PKCE) or
  `?token_hash=&type=` (custom template); redirects to `next` (same-site paths
  only, default `/dashboard`). Failures go to `/login?confirm_error=1`, which
  shows an "invalid or expired link" message.
- `signUp` now passes `emailRedirectTo: <origin>/auth/callback` (falls back to
  `NEXT_PUBLIC_SITE_URL`, then `http://localhost:3000`). Ignored by Supabase
  while "Confirm email" is off, so current behavior is unchanged.
- `proxy.ts` lets `/auth/callback` through whether signed in or out.
- **`web/src/lib/dates.ts`** — `todayIso()` / `monthStartIso(n)`, pinned to
  Asia/Manila so server and browser render the same day.
- **Root `CLAUDE.md`** — project rules: wording, one feature per branch, no
  `.env.local` commits, service role key server-only, read/update `NOTES.md`
  each session, build plan in `docs/`.

### Changed

- Incident form date defaults to today; report range defaults to the 1st of
  the month five months back → today (was fixed 2026-04-01 → 2026-09-25).
- Review Queue header no longer claims decisions are logged; Screening header
  and result footer no longer claim results are sent to the review queue. Both
  now say it's demo behavior.

### Tested

- Lint, type-check and build pass.
- Manually: confirmation-OFF sign-up, auth redirects, new wording, date
  defaults, no hydration warnings.

### Pending tests

- **Confirmation-ON sign-up not tested** — the demo accounts don't use real
  inboxes. To test: add `<site>/auth/callback` to Supabase → Authentication →
  URL Configuration → Redirect URLs, turn on "Confirm email", sign up with a
  real inbox, and open the link **in the same browser** (the default PKCE link
  fails in a different browser). Also check an expired/reused link lands on
  `/login` with the error message.
- When deployed, add the production `/auth/callback` URL to Supabase's
  Redirect URLs (and optionally set `NEXT_PUBLIC_SITE_URL`).

---

## Session: 2026-09-30 — Project cleanup (branch `feature/user-admin-actions`)

### Changed

- **SQL moved into a numbered run order** (older entries below use the old
  paths):
  - `supabase/schema.sql` → `supabase/migrations/001_schema.sql`
  - `supabase/user-management.sql` → `supabase/migrations/002_user_management.sql`
  - `supabase/admin-actions.sql` → `supabase/migrations/003_admin_actions.sql`
  - `supabase/make-admin.sql` → `supabase/scripts/make-admin.sql` (one-off,
    not a migration)
  - New migrations go in `supabase/migrations/` as `004_…`, `005_…`.
- **Planning docs moved to `docs/`** — `BanaTrack_ClaudeCode_BuildPrompt.md`,
  `BanaTrack_Groupmate_Setup_Prompt.md` (the setup guide now mentions the
  service role key).
- **README** — setup steps list the three migrations in order, all three env
  variables (including `SUPABASE_SERVICE_ROLE_KEY`), and the make-admin script.

### Removed

- Unused create-next-app files: `web/public/*.svg` (5 files, no references;
  `web/public/` is now gone) and the boilerplate `web/README.md`.
- Unused `macroF1` / `reviewerAgreement` fields from `modelGovernance` in
  `mock-data.ts`.

---

## Session: 2026-09-30 — Admin account actions (branch `feature/user-admin-actions`)

### Added

- **`supabase/admin-actions.sql`** — run after `user-management.sql`:
  - `profiles.must_change_password` (bool) and `profiles.deactivated_at`.
  - Signed-in users can now only UPDATE `full_name` and `role` (column
    grants), so nobody can clear their own flags via the API. Existing RLS
    policies unchanged.
  - `is_admin()` now also requires the admin to be active.
  - `list_users()` also returns the two new columns.
  - `guard_role_change` counts only *active* admins and also fires on
    `deactivated_at`; new `guard_profiles_delete` trigger blocks deleting the
    last active admin (also covers Auth Admin API deletes via the cascade).
  - `admin_actions` audit table (actor, action, target id + email snapshot,
    non-sensitive details, timestamp). Admin-only SELECT policy; no write
    policies — only the server (service role) inserts. No passwords stored.
- **Service role client** — `web/src/lib/supabase/admin.ts`, marked
  `server-only`, reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_`). Verified
  the variable name doesn't appear in `.next/static` after build.
- **`/users` account actions** (`users/actions.ts`, `users/user-actions.tsx`),
  each in a dialog, each re-checking on the server that the caller is an
  active admin, and each logged to `admin_actions` (role changes too):
  - **Reset password** — admin sets a temporary password (+ confirm, min 8
    chars, `lib/passwords.ts`); sets `must_change_password`.
  - **Deactivate / Reactivate** — sets `deactivated_at` and bans/unbans the
    user in Supabase Auth. Account and records are kept. "DEACTIVATED" and
    "TEMP PASSWORD" badges in the table.
  - **Delete** — admin must type the user's email; the server re-checks it.
    `ACTIVITY_TABLES` in `users/actions.ts` is an empty list today — add
    incidents / screenings / review tables there and delete will refuse users
    with records (deactivate instead).
  - Safety: no self reset/deactivate/delete; the last active admin can't be
    deactivated or deleted (checked in the action and again in the database).
- **Forced password change** — `/change-password` (outside the app shell).
  `(app)/layout.tsx` redirects flagged users there; the flag is cleared with
  the service role after `auth.updateUser` succeeds.
- **Deactivated sessions** — `(app)/layout.tsx` sends deactivated users to
  `/auth/deactivated` (route handler that signs out) → `/login?deactivated=1`.
  Login shows a friendly message for banned accounts.
- **`.env.local.example`** is now tracked (`!.env.local.example` in
  `web/.gitignore`) and lists `SUPABASE_SERVICE_ROLE_KEY`.
- **Recent admin actions** card on `/users` (last 20, read through RLS).

### Still missing / incomplete

- Not yet tested against the live Supabase project — needs `admin-actions.sql`
  run and the service role key in `web/.env.local`.
- Until `admin-actions.sql` is run, the app layout's profile query fails
  (unknown columns), so the sidebar shows "No role assigned".
- A reset password doesn't revoke the user's existing sessions.

---

## Session: 2026-09-30 — Admin user management (branch `feature/user-management`)

### Added

- **`supabase/make-admin.sql`** — promotes `test@banatrack.com` to admin
  (upsert, so it also works if the profile row is missing). Run once in the
  SQL editor after that account has signed up.
- **`supabase/user-management.sql`** — must be run after `schema.sql`:
  - `list_users()` — security-definer function returning id, full name,
    email (from `auth.users`), role, created_at. Raises unless the caller is
    an admin; execute revoked from `anon`/`public`.
  - `guard_role_change` trigger on `profiles` — blocks changing your own role
    and demoting the last remaining admin, even via direct API calls. SQL
    editor changes (no `auth.uid()`) skip the self rule so an admin can
    always be restored there.
  - No RLS policies were added or changed.
- **`/users` page** — `web/src/app/(app)/users/`: server-side admin check
  (non-admins are redirected to `/dashboard`), table of name / email / role /
  joined date, per-row role dropdown + Save that calls the `updateUserRole`
  server action. The action re-checks admin, blocks self-changes and
  last-admin demotion, updates through RLS with the user's own session (no
  service role key), and shows a success/error message under the row.
- **Sidebar** — "Users" link shown only to admins (`adminOnly` in
  `app-shell.tsx`).
- **`web/src/lib/roles.ts`** — shared role list, labels, and `isRole()`
  (the sidebar's role labels moved here).

### Still missing / incomplete

- ~~Not yet tested against the live Supabase project — both SQL files need to
  be run in the dashboard first.~~ **Resolved 2026-09-30:** SQL run on the
  live project; admin and non-admin tests all passed.
- Other screens are still visible to every role; only `/users` and the
  dashboard governance card are admin-gated.
- ~~No invite / delete / deactivate user; admins can only change roles.~~
  **Partly resolved 2026-09-30:** reset password, deactivate/reactivate, and
  delete added (see the admin account actions session above). Invites are
  still not supported.

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
  (The "Placeholder forecast" tag is gone — weather became real on 2026-09-27.)
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
- **Weather is real (Phase 1.5)** — `web/src/lib/weather.ts` pulls a 7-day
  Open-Meteo forecast for Tagum City (cached 30 min) and derives the dashboard
  risk banner from it. Location is a hard-coded constant, not per-plantation;
  risk thresholds are rules of thumb, not calibrated against incident data.
- **No AI/ML** — screening results are canned; FastAPI service, calibration,
  abstention threshold, Grad-CAM/SHAP not started. Photos are never uploaded.
- **Reports filters are cosmetic** — date range and area are ignored; the
  disease filter only changes which chart series show (stat tiles always show
  all). PDF export is `window.print()`, not react-pdf/jsPDF as planned.
- **Role-based visibility is minimal** — only the dashboard governance card is
  admin-gated. The sidebar and all screens show to every role. ~~No admin
  screen for assigning roles yet.~~ **Resolved 2026-09-30:** admin-only
  `/users` page assigns roles.
- **Block layout is invented** — A–D × 1–6 grid with made-up areas/supervisors;
  replace with the plantation's real block list.
- **Dark mode removed** — the app is light-only for now.

### Known issues

- ~~**Email-confirmation sign-up flow is incomplete** — there's no
  `/auth/callback` (or `/auth/confirm`) route and `signUp` doesn't pass
  `emailRedirectTo`, so confirmation links rely on the Supabase project's
  Site URL setting and won't create a session in the app. Either add the
  callback route or disable email confirmation for testing.~~ **Resolved
  2026-10-03:** `/auth/callback` added and `signUp` passes `emailRedirectTo`
  (confirmation-ON flow still untested).
- ~~**`web/.env.local.example` is not tracked** — `web/.gitignore` has `.env*`,
  which also ignores the example file that the README tells people to copy.
  Add `!.env.local.example` to `.gitignore` and commit it.~~ **Resolved
  2026-09-30:** `!.env.local.example` added to `web/.gitignore`; the file is
  tracked.
- **Hard-coded "today"** — mock data and form defaults assume 2026-09-25
  (incident form date, report date range, forecast days). **Partly resolved
  2026-10-03:** the incident form and report range now default from today;
  sample records in `mock-data.ts` still use fixed Sep dates.
- **Dashboard assumes a user** — `dashboard/page.tsx` uses `user!.id`, relying on
  the `(app)/layout.tsx` redirect. Fine now, but fragile if the layout changes.
- **Chart edge case** — in the Reports stacked chart, a month whose top series
  is 0 loses its rounded cap, and zero-value segments still add a 2px gap.
- **Line endings** — git warns LF → CRLF on Windows; consider adding a
  `.gitattributes` (`* text=auto eol=lf`) to keep diffs clean.
