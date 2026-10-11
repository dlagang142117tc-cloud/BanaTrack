# BanaTrack — Role Matrix

Status: **Approved by Denns on 2026-10-11** (roadmap task "Role-based access").
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
| Review Queue: confirm / correct / reject / escalate | — | ✅ | ✅ | 👁 (no) | Paper §4.5 |
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
  → This task is the role-based access itself. Keeping the three statuses
  separate is a data rule for the "Screening and Review Queue" task.

## 3. Decisions and open questions

**Decided by the team (team default, confirm with plantation):**

1. Field Personnel have no access to Reports.
2. Admin can view the Review Queue but can't act on cases.
3. Disease In-Charge can edit anyone's incident but can only delete their own.
   Deleting other people's incidents stays with Supervisor and Admin.
4. Every role can use the Dashboard, Disease Screening and the Plantation Map.
5. "Designated disease personnel" (§4.5) is read as the Disease In-Charge
   role.

**Still open (to be settled in the "Screening and Review Queue" task):**

6. **Lab-confirmed status (§4.9):** who records it — Disease In-Charge only,
   or Supervisor too?
7. **Self-review:** can a reviewer confirm a screening they submitted
   themselves?
8. **Escalation recipients:** when a case is escalated, who receives it (a
   Supervisor, the Disease In-Charge, an outside lab)?

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
| `review.act` | Disease In-Charge, Supervisor |
| `map.view` | everyone |
| `reports.view` (includes PDF export) | Disease In-Charge, Supervisor, Admin |
| `users.manage` | Admin |

How the file is used:

- **Who checks it:** pages, the sidebar and server actions call
  `can(role, permission)`. Incidents use `canEditIncident()` /
  `canDeleteIncident()`, which also let reporters manage their own.
- **Unknown or missing role:** `can()` returns false.
- **The dashboard has no permission.** It is open to every role, because
  blocked pages redirect there.
- **Rules the database also enforces** are marked `DB:` in the file:
  `incidents.editAny`, `incidents.deleteAny` and `users.manage`. Changing one
  of them also needs a new migration.

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
- **Review Queue.** It is still sample data with no table (see 4.5).

### 4.5 Review Queue (still sample data)

- **Now:** the page is restricted with `review.view`, and the sample action
  buttons only show with `review.act`.
- **"Screening and Review Queue" task:** its server actions must check
  `can(role, "review.act")`. Its migration must add a matching SQL helper
  (e.g. `can_review_screenings()`) for the RLS policies, listing the same
  roles as `review.act`.

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
