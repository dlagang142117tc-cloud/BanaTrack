# BanaTrack — Project Rules

BanaTrack is a disease screening and decision-support system for a banana
plantation (Moko and Panama disease). It is a triage tool, not a diagnostic
authority: AI output always needs human confirmation.

## Start and end of every session

- **Start:** read `NOTES.md` to see what's built, what's incomplete, and known issues.
- **End:** add a dated entry to `NOTES.md` (what changed, what's left, known issues).

## Wording (UI text, docs, comments, commit messages)

Use these terms:

- "screening result"
- "severity estimate"
- "case-review priority"
- "escalation recommendation"

Never say the system "predicts disease" or gives a "probability of infection".

Don't claim something happens when it doesn't yet. Anything that's sample or
demo behavior (not saved, not sent, no real model) must say so in the UI.

## Git

- One feature per branch (`feature/…`, `chore/…`, `fix/…`); merge through a PR.
- Never commit `.env.local` or any other file with secrets.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` is server-only: use it only in server code
  (`web/src/lib/supabase/admin.ts`, server actions, route handlers). Never
  give it a `NEXT_PUBLIC_` prefix or import it into a client component.

## Where things are

- `docs/` — the build plan (`BanaTrack_ClaudeCode_BuildPrompt.md`) and
  teammate setup guide. Check it before starting a new feature.
- `web/` — Next.js app. Read `web/CLAUDE.md` / `web/AGENTS.md` before writing
  code there (this Next.js version has breaking changes).
- `supabase/migrations/` — SQL, run in numbered order. New ones go in as the
  next number.
- `ml-service/` — Python ML service (placeholder; no model yet).
