-- BanaTrack: database checks for migration 007 (Screening and Review Queue)
-- See docs/role-matrix.md §6.2.
--
-- How to run:
-- - Paste and run ONE block at a time in the Supabase SQL editor (from
--   "begin;" to "rollback;"). The editor only shows the last result.
-- - Nothing is saved. Blocks that should succeed end with "rollback". Blocks
--   that should fail stop at the error, and the failed transaction is thrown
--   away.
-- - Checks A–F need a case that is still pending, so each one first creates a
--   temporary pending screening (submitted by Field Personnel, or by Disease
--   In-Charge for B). The rollback or the error removes it again.
-- - Checks G–I use the existing data (SCR-0001 and existing reviews).
-- - "Act as <role>" picks the oldest active account with that role.


-- ============================================================================
-- A. Field Personnel tries to review a screening
--    Tests:    only Disease In-Charge and Supervisors can review.
--    Expected: ERROR "Only Disease In-Charge and Supervisors can review screenings."
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as Field Personnel
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;

insert into public.screening_reviews (screening_id, decision)
  values (current_setting('test.sid')::bigint, 'confirmed');
rollback;


-- ============================================================================
-- B. Disease In-Charge reviews a screening they submitted themselves
--    Tests:    no self-review.
--    Expected: ERROR "You can't review a screening you submitted."
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'disease_in_charge' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as the submitter (that Disease In-Charge)
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select submitted_by from public.screenings where id = current_setting('test.sid')::bigint))::text, true);
set local role authenticated;

insert into public.screening_reviews (screening_id, decision)
  values (current_setting('test.sid')::bigint, 'rejected');
rollback;


-- ============================================================================
-- C. Disease In-Charge escalates a case, then tries to decide it
--    Tests:    only a Supervisor decides an escalated case.
--    Expected: ERROR "This case is escalated; only a Supervisor can decide it."
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as Disease In-Charge
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'disease_in_charge' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;

insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'escalated');
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'confirmed');
rollback;


-- ============================================================================
-- D. Disease In-Charge escalates, a Supervisor corrects it
--    Tests:    Supervisor decides an escalated case; the AI output is never
--              overwritten (human status and AI output stay separate).
--    Expected: 1 ROW: review_status = corrected,
--              human_label = Panama-like (Fusarium) wilt pattern,
--              ai_label = Moko-like wilt pattern (unchanged)
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as Disease In-Charge
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'disease_in_charge' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'escalated');

-- act as Supervisor
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'supervisor' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;
insert into public.screening_reviews (screening_id, decision, corrected_label)
  values (current_setting('test.sid')::bigint, 'corrected', 'Panama-like (Fusarium) wilt pattern');

select review_status, human_label, ai_label from public.screenings where id = current_setting('test.sid')::bigint;
rollback;


-- ============================================================================
-- E. Disease In-Charge acts again on a case that is already closed
--    Tests:    confirm / correct / reject close the case for Disease In-Charge.
--    Expected: ERROR "This case is closed; only a Supervisor can override the decision."
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as Disease In-Charge
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'disease_in_charge' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;

insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'rejected');
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'rejected');
rollback;


-- ============================================================================
-- F. Disease In-Charge rejects, a Supervisor overrides
--    Tests:    Supervisor override adds a new review; history is kept.
--    Expected: 2 ROWS, in order:
--              rejected  (Disease In-Charge)
--              confirmed (Supervisor)
-- ============================================================================
begin;
with s as (
  insert into public.screenings (submitted_by, block, plant_part, storage_path, model_version,
    ai_status, ai_label, ai_confidence, ai_severity_pct, ai_severity, ai_priority)
  select id, 'A1', 'leaf', 'sql-check/' || gen_random_uuid() || '.jpg', 'fusion-v0.0-mock',
    'result', 'Moko-like wilt pattern', 0.87, 34, 'moderate', 'high'
  from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1
  returning id)
select set_config('test.sid', id::text, true) from s;

-- act as Disease In-Charge
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'disease_in_charge' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'rejected');

-- act as Supervisor
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'supervisor' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;
insert into public.screening_reviews (screening_id, decision) values (current_setting('test.sid')::bigint, 'confirmed');

select decision, reviewer_name, reviewer_role from public.screening_reviews
  where screening_id = current_setting('test.sid')::bigint order by id;
rollback;


-- ============================================================================
-- G. Edit a past review (runs as the SQL editor's own admin-level role)
--    Tests:    review records are append-only for every role.
--    Expected: ERROR "screening_reviews is append-only: past records can't be changed or deleted."
-- ============================================================================
begin;
update public.screening_reviews set note = 'edited'
  where id = (select min(id) from public.screening_reviews);
rollback;


-- ============================================================================
-- H. Change the AI output of SCR-0001 (runs as the SQL editor's own admin-level role)
--    Tests:    the screening result (AI output) is never overwritten.
--    Expected: ERROR "Screenings can't be edited directly; add a review or lab result instead."
-- ============================================================================
begin;
update public.screenings set ai_label = 'edited' where id = 1;
rollback;


-- ============================================================================
-- I. Field Personnel records a lab result on SCR-0001
--    Tests:    only Disease In-Charge and Supervisors record lab results.
--    Expected: ERROR "Only Disease In-Charge and Supervisors can record lab results."
-- ============================================================================
begin;
-- act as Field Personnel
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
  (select id from public.profiles where role = 'field_personnel' and deactivated_at is null order by created_at limit 1))::text, true);
set local role authenticated;

insert into public.screening_lab_results (screening_id, lab_result) values (1, 'negative');
rollback;


-- ============================================================================
-- After all checks: confirm nothing was kept
--    Expected: only SCR-0001 to SCR-0004 (ids 1–4), with the same review
--              counts as before you started. No 'sql-check/...' screenings.
-- ============================================================================
select id, review_status, storage_path,
  (select count(*) from public.screening_reviews r where r.screening_id = s.id) as reviews
from public.screenings s
order by id;
