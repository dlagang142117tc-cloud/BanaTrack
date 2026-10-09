# BanaTrack

Multimodal, uncertainty-aware disease screening and decision-support system
for a banana plantation (Moko and Panama disease). See
[`docs/BanaTrack_ClaudeCode_BuildPrompt.md`](docs/BanaTrack_ClaudeCode_BuildPrompt.md)
for the full project plan.

## Layout

- `web/` — Next.js + Supabase app (dashboards, forms, review queue, map, reports)
- `ml-service/` — Python: YOLOv8/PyTorch training + FastAPI inference endpoint (not started)
- `supabase/migrations/` — database schema, as numbered SQL files run in order
- `supabase/scripts/` — one-off SQL scripts (e.g. promoting the first admin)
- `docs/` — project plan and groupmate setup guide
- `NOTES.md` — running log of what's been built and known issues

## Setup

1. Create a Supabase project at https://supabase.com
2. In the Supabase SQL editor, run each file in `supabase/migrations/` **in order**:
   - `001_schema.sql` — profiles table, roles, RLS
   - `002_user_management.sql` — admin user list + role-change safety rules
   - `003_admin_actions.sql` — account flags, deactivation/last-admin rules, audit log
   - `004_incident_log.sql` — incidents, symptoms, photos (private `incident-photos` bucket), weather snapshot
   - `005_incident_status_and_weather.sql` — incident status and editing, edit tracking, server-only weather
3. Copy `web/.env.local.example` to `web/.env.local` and fill in all three values from
   Supabase **Project Settings > API Keys**:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` (secret) key. Server-only: never
     commit it, share it publicly, or give it a `NEXT_PUBLIC_` prefix.
4. `cd web && npm install && npm run dev`
5. Sign up in the app, then run `supabase/scripts/make-admin.sql` in the SQL editor
   (edit the email first if needed) to create the first admin

Roles (Admin, Supervisor, Disease In-Charge, Field Personnel) live on the
`profiles` table and are assigned by an admin on the Users page — new users
default to `field_personnel`.
