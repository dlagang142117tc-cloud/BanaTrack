# BanaTrack

Multimodal, uncertainty-aware disease screening and decision-support system
for a banana plantation (Moko and Panama disease). See
`BanaTrack_ClaudeCode_BuildPrompt.md` for the full project plan.

## Layout

- `web/` — Next.js + Supabase app (dashboards, forms, review queue, map, reports)
- `ml-service/` — Python: YOLOv8/PyTorch training + FastAPI inference endpoint (not started)
- `supabase/schema.sql` — database schema (run in the Supabase SQL editor)

## Setup

1. Create a Supabase project at https://supabase.com
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. Copy `web/.env.local.example` to `web/.env.local` and fill in your project URL + anon key
4. `cd web && npm run dev`

Roles (Admin, Supervisor, Disease In-Charge, Field Personnel) live on the
`profiles` table and are assigned by an admin after signup — new users
default to `field_personnel`.
