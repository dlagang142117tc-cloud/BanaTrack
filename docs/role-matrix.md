# BanaTrack — Role Matrix

Status: **Approved by Denns on 2026-10-11** (roadmap task "Role-based access").
Review and lab rules added on 2026-10-11 (roadmap task "Screening and Review
Queue").
Rules marked *team default* are our own choice. They still need to be
**confirmed with the plantation**.

Roles (the `public.user_role` enum in `supabase/migrations/001_schema.sql`):
**Field Personnel**, **Disease In-Charge**, **Supervisor**, **Admin**. New
sign-ups start as Field Personnel, and only an Admin can change a role.

## 1. The matrix

✅ = allowed, 👁 = view only, — = not allowed (the page is hidden and the URL
redirects to the dashboard)

| Page / action | Field Personnel | Disease In-Charge | Supervisor | Admin | Source |
|---|:-:|:-:|:-:|:-:|---|
| Dashboard: view | ✅ | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Dashboard: model governance card | — | — | — | ✅ | Paper §4.8 |
| Dashboard: review-queue widgets | — | ✅ | ✅ | ✅ | Follows Review Queue: view |
| Disease Screening: submit photos | ✅ | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Incident Log: view and record | ✅ | ✅ | ✅ | ✅ | Paper §4.3 ("authorized personnel") |
| Incident Log: edit/delete **own** incidents | ✅ | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Incident Log: **edit** anyone's incident | — | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Incident Log: **delete** anyone's incident | — | — | ✅ | ✅ | Team default, confirm with plantation |
| Review Queue: view | — | ✅ | ✅ | ✅ | Paper §4.5; Admin view is a team default, confirm with plantation |
| Review Queue: confirm / correct / reject / escalate a **pending** case | — | ✅ | ✅ | 👁 (no) | Paper §4.5 |
| Review Queue: decide an **escalated** case | — | — | ✅ | 👁 (no) | Team default, confirm with plantation |
| Review Queue: **override** a closed decision (adds a new review; history kept) | — | — | ✅ | 👁 (no) | Team default, confirm with plantation |
| Review a screening **you submitted yourself** | — | — | — | — | Team default, confirm with plantation |
| Record a **lab result** (§4.9 lab-confirmed status) | — | ✅ | ✅ | 👁 (no) | Team default, confirm with plantation |
| Plantation Map: view | ✅ | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Reports: view and export | — | ✅ | ✅ | ✅ | Team default, confirm with plantation |
| Users: manage accounts and roles | — | — | — | ✅ | Paper §4.9 (role-based access); Admin-only is a team default |

**Changes from before this task:**

- **Disease In-Charge** can now edit anyone's incident. They still delete only
  their own.
- **Field Personnel** lose the Review Queue, Reports and the dashboard's review
  widgets. Before, every role saw every page except Users.
- **Admin** can view the Review Queue but can't act on cases. On the
  sample-data page the action buttons are hidden for Admin, with a
  "View only" note.

## 2. What the paper says, rule by rule

Sections from the panel's technical review paper:

- **§4.5 Human review of AI results.** A screening result is reviewed by the
  "plantation supervisor or designated disease personnel". They can confirm,
  reject, correct or escalate it. The reviewer, model version, timestamp and
  final decision are recorded.
  → Review actions go to **Supervisor** and **Disease In-Charge** only.
  Admin is not named, so Admin can view but not act. Field Personnel have no
  access.
- **§4.3 Structured field observations** are entered by "authorized
  personnel".
  → Every active, signed-in account can record incidents.
- **§4.8 Administrative view of model performance over time.**
  → The model governance card stays **Admin only**.
- **§4.9 Role-based access** is an existing objective. The **screening
  result**, **human-confirmed status** and **lab-confirmed status** must stay
  separate.
  → The three statuses are separate columns, each with one writer: the
  screening result is written once by the server and never changes; the
  human-confirmed status comes only from review records; the lab-confirmed
  status comes only from lab-result records. Review and lab records are
  append-only (migration 007).

## 3. Decisions and open questions

**Decided by the team (team default, confirm with plantation):**

1. Field Personnel have no access to Reports.
2. Admin can view the Review Queue but can't act on cases.
3. Disease In-Charge can edit anyone's incident but can only delete their own.
   Deleting other people's incidents stays with Supervisor and Admin.
4. Every role can use the Dashboard, Disease Screening and the Plantation Map.
5. "Designated disease personnel" (§4.5) is read as the Disease In-Charge
   role.

6. Lab-confirmed status (§4.9) is recorded by Disease In-Charge and
   Supervisor.
7. No self-review: nobody can act on a screening they submitted themselves,
   Supervisors included.
8. Escalated cases go to the Supervisor; only a Supervisor decides an
   escalated case.
9. Confirm / correct / reject close a case for Disease In-Charge. A
   Supervisor can override a closed decision by adding a new review; the
   earlier decision stays in the history.

**Still open (ask the plantation):**

10. **How many Supervisors are there?** Rules 7 and 8 together mean that when
    a Supervisor submits a screening and it gets escalated (or needs an
    override), a *second* Supervisor has to decide it. With only one
    Supervisor, such a case stays open. (A second demo Supervisor account,
    supervisor2, exists for testing.)

## 4. How it is enforced

### 4.1 One central permissions file

`web/src/lib/permissions.ts` lists every rule as one line:

| Permission | Roles |
|---|---|
| `dashboard.governance` | Admin |
| `screening.submit` | everyone |
| `incidents.view`, `incidents.create` | everyone |
| `incidents.editAny` | Disease In-Charge, Supervisor, Admin |
| `incidents.deleteAny` | Supervisor, Admin |
| `review.view` | Disease In-Charge, Supervisor, Admin |
| `review.act` (pending cases) | Disease In-Charge, Supervisor |
| `review.decideEscalated` (escalated cases, overrides) | Supervisor |
| `lab.record` | Disease In-Charge, Supervisor |
| `map.view` | everyone |
| `reports.view` (includes PDF export) | Disease In-Charge, Supervisor, Admin |
| `users.manage` | Admin |

How the file is used:

- **Who checks it:** pages, the sidebar and server actions call
  `can(role, permission)`. Incidents use `canEditIncident()` /
  `canDeleteIncident()`, which also let reporters manage their own. Reviews
  use `screeningReviewProblem()`, which combines `review.act`,
  `review.decideEscalated`, the no-self-review rule and the case's status.
- **Unknown or missing role:** `can()` returns false.
- **The dashboard has no permission.** It is open to every role, because
  blocked pages redirect there.
- **Rules the database also enforces** are marked `DB:` in the file:
  `incidents.editAny`, `incidents.deleteAny`, `review.view`, `review.act`,
  `review.decideEscalated`, `lab.record` and `users.manage`. Changing one of
  them also needs a new migration.

### 4.2 Sidebar and blocked URLs

- **Sidebar:** each entry in `components/app-shell.tsx` comes from `PAGES` in
  the permissions file. It only shows the pages the role is allowed to open.
- **Blocked URLs:** every page except the dashboard calls
  `requirePage("<page>")` from `web/src/lib/auth.ts`. Without permission it
  redirects to `/dashboard?denied=<page>`. The dashboard then shows "Your role
  doesn't have access to <page>."
- **Client pages:** Screening, Map and Review Queue are client components. A
  small server `page.tsx` wraps each one and does the check.
- **Account checks:** `requirePage()` also checks for a deactivated account or
  a forced password change. Layouts and pages render in parallel, so a page
  can't rely on the layout's redirect alone.

### 4.3 Server actions check permissions on the server

- **Incidents** (`incidents/actions.ts`): `createIncident` checks
  `incidents.create`. `updateIncident` checks `canEditIncident`.
  `deleteIncident` checks `canDeleteIncident`. If the UI is bypassed they
  return "You don't have permission to …".
- **Users** (`users/actions.ts`): the actions check `users.manage`.
- **Screening** (`screening/actions.ts`): `submitScreening` checks
  `screening.submit`, creates the mock result on the server and saves it with
  the service role (users can't write screenings at all).
- **Review Queue** (`review/actions.ts`): `reviewScreening` checks
  `screeningReviewProblem()`; `recordLabResult` checks `lab.record`.

### 4.4 Database rules (migration 006)

`supabase/migrations/006_role_based_access.sql` replaces the old
`can_manage_incidents()` (Supervisor and Admin) with two functions:

| Function | Roles | Used by |
|---|---|---|
| `can_edit_any_incident()` | Disease In-Charge, Supervisor, Admin | update an incident; add/remove symptoms; attach photos |
| `can_delete_any_incident()` | Supervisor, Admin | delete an incident; remove photo rows; delete photo files in storage |

Reporters keep full control of their own incidents. Removing photos follows
the *delete* rule because it destroys field evidence. The app has no "remove
photo" button yet; photos only go when their incident is deleted.

**What the database does NOT enforce, and why:**

- **Reports for Field Personnel.** Reports are built from the `incidents`
  table, which Field Personnel must read for the Incident Log. The
  restriction controls the page only, not access to the data. Reports contain
  nothing the Incident Log doesn't already show.

### 4.5 Screenings and reviews (migration 007)

`supabase/migrations/007_screening_review_queue.sql`:

| Rule | Database |
|---|---|
| Who reads screenings, reviews, lab results | `can_view_screenings()` (= `review.view`) |
| Review rules (role, self-review, escalated, closed/override, inconclusive can't be confirmed) | `screening_review_problem()`, used by the insert policy and the `prepare_screening_review` trigger |
| Lab results | `can_record_lab_results()` (= `lab.record`) |
| Screening result never changes | users can't write `screenings`; `guard_screening_change` blocks direct updates and deletes for every role |
| Append-only history | no update/delete policies; `guard_append_only` blocks update, delete and truncate for every role |
| Photos | private `screening-photos` bucket; upload to your own folder; reviewer roles and the uploader can view; the uploader can delete only a photo no screening uses |

## 5. Test plan (demo accounts)

Run this after migration 006, with each demo account: **admin**, **supervisor**,
**disease in-charge**, **field personnel**.

### 5.1 Sidebar and pages

| Check | Field Personnel | Disease In-Charge | Supervisor | Admin |
|---|---|---|---|---|
| Sidebar shows | Dashboard, Screening, Incident Log, Map | + Review Queue, Reports | + Review Queue, Reports | all, incl. Users |
| Open `/review` by URL | → dashboard + notice | opens, buttons shown | opens, buttons shown | opens, **view only** (no buttons, note shown) |
| Open `/reports` by URL | → dashboard + notice | opens | opens | opens |
| Open `/users` by URL | → dashboard + notice | → dashboard + notice | → dashboard + notice | opens |
| Dashboard "Top review priority" + "Awaiting review" | hidden | shown | shown | shown |
| Governance card on dashboard | hidden | hidden | hidden | shown |
| Screening, Incident Log, Map | open | open | open | open |

### 5.2 Incidents

1. As **Field Personnel**, record an incident, then edit and delete it. Both
   work.
2. As **Field Personnel**, look at an incident someone else recorded. There
   are no Edit/Delete buttons.
3. As **Disease In-Charge**, look at an incident recorded by Field Personnel.
   There is an **Edit** button and **no Delete** button. Edit it: it saves,
   and "last edited by" shows the Disease In-Charge.
   *Before migration 006 is run, this edit fails with "could not be saved".
   That shows the database enforces the rule.*
4. As **Disease In-Charge**, delete an incident you recorded yourself. It
   works.
5. As **Supervisor** and **Admin**, edit and delete someone else's incident
   (one with a photo). Both work, and the photo file is removed with no
   "could not be removed" note.

### 5.3 Database check (SQL editor, no UI)

This shows that the database blocks these actions even if the app is
bypassed. Each block acts as the first active user with the given role and
picks an incident reported by someone else. Run the blocks one at a time:
the SQL editor only shows the last result. Nothing is saved, because each
block ends with `rollback`.

| # | Role (`<role>`) | Statement | Expected |
|---|---|---|---|
| A | `field_personnel` | update | **No rows** (blocked) |
| B | `disease_in_charge` | update | **1 row** (allowed) |
| C | `disease_in_charge` | delete | **No rows** (blocked) |
| D | `supervisor` | delete | **1 row** (allowed) |

```sql
-- A and B: edit someone else's incident
begin;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = '<role>' and deactivated_at is null limit 1))::text, true);
set local role authenticated;
update public.incidents set notes = notes
  where id = (select id from public.incidents where reported_by <> auth.uid() limit 1)
  returning id, reported_by;
rollback;

-- C and D: delete someone else's incident
begin;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = '<role>' and deactivated_at is null limit 1))::text, true);
set local role authenticated;
delete from public.incidents
  where id = (select id from public.incidents where reported_by <> auth.uid() limit 1)
  returning id, reported_by;
rollback;
```

### 5.4 Regression

- Deactivated accounts and accounts that must change their password are still
  redirected as before, including when they open a page URL directly.
- The `/users` actions (role change, reset, deactivate, delete) still work for
  Admin.
- `npm run lint`, `npx tsc --noEmit` and `npm run build` pass from `web/`.

## 6. Test plan: Screening and Review Queue (migration 007)

Accounts: **FP** (field personnel), **DIC** (disease in-charge), **SUP**
(supervisor), **SUP2** (supervisor2), **ADMIN**.

### 6.1 Browser

1. **FP** submits a screening (photo, block, plant part, an observation). It
   shows "Saved as SCR-…", the "Mock result" tag, and the observation as
   evidence. FP still has no Review Queue.
2. **DIC**, **SUP** and **ADMIN** each submit one screening too.
3. **DIC** in the Review Queue:
   - FP's case: **Confirm** (or Correct, if it's inconclusive). It moves to
     Reviewed; the history shows DIC, the time and the model version.
   - Own case: no decision buttons; "You can't review a screening you
     submitted."
   - ADMIN's case: **Escalate** with a note. It shows "Escalated — Supervisor
     decision needed", and DIC sees "only a Supervisor can decide it".
   - A closed case: no buttons.
4. **SUP** in the Review Queue:
   - The escalated case is listed first. **Correct** it: the screening result
     is unchanged next to the human review box.
   - DIC's case: **Reject** with a note.
   - FP's case closed by DIC: **Override decision** → choose a decision. The
     history shows both decisions.
   - Own case: no buttons.
5. **SUP2** can decide SUP's own case (escalate it as DIC first).
6. **ADMIN** sees every case and its history, with no decision or lab buttons
   and the "View only" note.
7. **Lab results:** DIC and SUP can record one. The lab box shows it,
   separate from the human review. ADMIN has no button.
8. **Dashboard:** DIC, SUP and ADMIN see the real "Awaiting review" count
   (high priority and escalated) and the top cases; the numbers drop as cases
   are reviewed. FP sees no review widgets. ADMIN's governance card shows
   `fusion-v0.0-mock`, the real abstention rate and the 60% threshold, tagged
   as a mock model.
9. **Inconclusive** screenings show High priority and "Inconclusive — system
   abstained", and can't be confirmed (only corrected or rejected).

### 6.2 Database check (SQL editor, no UI)

Each block works on a pending screening submitted by Field Personnel (or by
Disease In-Charge for B), acts as a role, and ends with the statement being
tested. Run one block at a time; nothing is saved (`rollback`, or the error
aborts the transaction). Run after the browser tests, so data exists.

| # | Test | Expected |
|---|---|---|
| A | FP adds a review | error: "Only Disease In-Charge and Supervisors can review screenings." |
| B | DIC reviews own screening | error: "You can't review a screening you submitted." |
| C | DIC escalates, then decides it | error: "only a Supervisor can decide it" |
| D | DIC escalates, SUP corrects | 1 row; the status columns show `corrected`, the new label and the **unchanged** `ai_label` |
| E | DIC rejects, then DIC acts again | error: "This case is closed …" |
| F | DIC rejects, SUP overrides | 2 reviews in the history for that screening |
| G | Edit a past review (any role) | error: "screening_reviews is append-only …" |
| H | Change a screening result (any role) | error: "Screenings can't be edited directly; add a review or lab result instead." |
| I | FP records a lab result | error: "Only Disease In-Charge and Supervisors can record lab results." |

```sql
-- Setup used by every block (run it at the start of each block):
begin;
select set_config('test.sid', (
  select s.id::text from public.screenings s join public.profiles p on p.id = s.submitted_by
  where p.role = 'field_personnel' and s.review_status = 'pending' and s.ai_status = 'result'
  order by s.id limit 1), true);
-- "act as <role>" = these two lines (use "reset role;" first if you already switched):
--   select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
--     (select id from public.profiles where role = '<role>' and deactivated_at is null order by created_at limit 1))::text, true);
--   set local role authenticated;

-- A: act as field_personnel, then
insert into public.screening_reviews (screening_id, decision)
  values (current_setting('test.sid')::bigint, 'confirmed');

-- B: replace the setup's 'field_personnel' with 'disease_in_charge'; act as that submitter:
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select submitted_by from public.screenings where id = current_setting('test.sid')::bigint))::text, true);
set local role authenticated;
insert into public.screening_reviews (screening_id, decision)
  values (current_setting('test.sid')::bigint, 'rejected');

-- C: act as disease_in_charge, then
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'escalated');
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'confirmed');

-- D: act as disease_in_charge, escalate (first line of C), then reset role; act as supervisor, then
insert into public.screening_reviews (screening_id, decision, corrected_label)
  values (current_setting('test.sid')::bigint, 'corrected', 'Panama-like (Fusarium) wilt pattern');
select review_status, human_label, ai_label from public.screenings where id = current_setting('test.sid')::bigint;

-- E: act as disease_in_charge, then
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'rejected');
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'rejected');

-- F: act as disease_in_charge, reject (first line of E), then reset role; act as supervisor, then
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'confirmed');
select decision, reviewer_name from public.screening_reviews
  where screening_id = current_setting('test.sid')::bigint order by id;

-- G: (no "act as"; runs as the SQL editor's own role)
update public.screening_reviews set note = 'edited' where id = (select min(id) from public.screening_reviews);

-- H: (no "act as")
update public.screenings set ai_label = 'edited' where id = current_setting('test.sid')::bigint;

-- I: act as field_personnel, then
insert into public.screening_lab_results (screening_id, lab_result)
  values (current_setting('test.sid')::bigint, 'negative');

-- End every block with:
rollback;
```
