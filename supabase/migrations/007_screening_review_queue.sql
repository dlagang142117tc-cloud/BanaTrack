-- BanaTrack: Disease Screening + Review Queue (model versions, screenings,
-- append-only review and lab records, private photo bucket)
-- Migration 007. Run this in the Supabase SQL editor after 006_role_based_access.sql.
--
-- Three statuses stay separate (paper §4.9):
-- - Screening result (AI output): the ai_* columns. Written once by the
--   server; a trigger blocks any later change, even with the service role.
-- - Human-confirmed status: review_status / human_label, set only by a
--   trigger from screening_reviews.
-- - Lab-confirmed status: lab_status, set only by a trigger from
--   screening_lab_results.
-- screening_reviews and screening_lab_results are append-only: no one can
-- edit or delete a past decision (paper §4.5, §4.9).
--
-- Review rules (docs/role-matrix.md; keep in step with "review.act",
-- "review.decideEscalated" and "lab.record" in web/src/lib/permissions.ts):
-- - Disease In-Charge and Supervisor review pending cases; Admin views only.
-- - Nobody reviews a screening they submitted themselves.
-- - Escalated cases: only a Supervisor makes the decision.
-- - Confirmed / corrected / rejected close the case; only a Supervisor can
--   override it by adding a new review. The earlier decision stays in history.
-- - An inconclusive (abstained) screening result can't be "confirmed": the
--   reviewer corrects it to a label or rejects it.
-- - Lab results: Disease In-Charge and Supervisor.
--
-- Block, plant part and label values are plain text on purpose, as with the
-- Incident Log: the server validates them against lists in web/src/lib.

begin;

-- ------------------------------------------------------------ model versions

create table public.model_versions (
  id text primary key,
  description text not null,
  is_mock boolean not null default false,
  -- Calibrated confidence below this means the system abstains.
  abstention_threshold numeric(3, 2) not null check (abstention_threshold between 0 and 1),
  is_active boolean not null default false,
  deployed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one active version.
create unique index model_versions_one_active_idx on public.model_versions (is_active) where is_active;

insert into public.model_versions (id, description, is_mock, abstention_threshold, is_active)
values (
  'fusion-v0.0-mock',
  'Mock model: no image analysis. Returns sample screening results for testing the workflow.',
  true,
  0.60,
  true
);

alter table public.model_versions enable row level security;

create policy "Active users can view model versions"
  on public.model_versions for select to authenticated
  using (public.is_active_user());

-- Versions are added in the SQL editor only.
revoke all on public.model_versions from anon, authenticated;
grant select on public.model_versions to authenticated;

-- ------------------------------------------------------------ helpers

-- Roles that may open the Review Queue ("review.view").
create function public.can_view_screenings()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and deactivated_at is null
      and role in ('disease_in_charge', 'supervisor', 'admin')
  );
$$;

-- Roles that may record lab results ("lab.record").
create function public.can_record_lab_results()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and deactivated_at is null
      and role in ('disease_in_charge', 'supervisor')
  );
$$;

revoke execute on function public.can_view_screenings() from public, anon;
grant execute on function public.can_view_screenings() to authenticated;
revoke execute on function public.can_record_lab_results() from public, anon;
grant execute on function public.can_record_lab_results() to authenticated;

-- ------------------------------------------------------------ screenings

create table public.screenings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Context, entered by the submitter.
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  -- Name at the time of submission (set by trigger), readable without profile access.
  submitter_name text not null,
  block text not null,
  plant_part text not null,
  observations text not null default '' check (char_length(observations) <= 2000),
  -- "<submitter id>/<uuid>.<ext>" in the screening-photos bucket.
  storage_path text not null unique,
  model_version text not null references public.model_versions (id) on delete restrict,

  -- Screening result (AI output). Never changes after insert.
  ai_status text not null check (ai_status in ('result', 'abstained')),
  ai_label text not null,
  ai_confidence numeric(4, 3) not null check (ai_confidence between 0 and 1),
  ai_severity_pct smallint check (ai_severity_pct between 0 and 100),
  ai_severity text check (ai_severity in ('low', 'moderate', 'high')),
  ai_priority text not null check (ai_priority in ('high', 'medium', 'low')),
  ai_evidence jsonb not null default '[]' check (jsonb_typeof(ai_evidence) = 'array'),
  ai_abstain_reason text,
  -- Sort key for case-review priority (0 = high).
  priority_rank smallint generated always as (
    case ai_priority when 'high' then 0 when 'medium' then 1 else 2 end
  ) stored,

  -- Human-confirmed status. Set only by apply_screening_review().
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'corrected', 'rejected', 'escalated')),
  human_label text,
  last_reviewed_at timestamptz,
  last_reviewed_by_name text,

  -- Lab-confirmed status. Set only by apply_lab_result().
  lab_status text not null default 'none'
    check (lab_status in ('none', 'moko', 'panama', 'negative', 'inconclusive')),
  lab_recorded_at timestamptz,

  -- An abstained result has a reason and no severity estimate; a result has a severity estimate.
  check (
    (ai_status = 'abstained' and ai_abstain_reason is not null and ai_severity_pct is null and ai_severity is null)
    or (ai_status = 'result' and ai_abstain_reason is null and ai_severity_pct is not null and ai_severity is not null)
  )
);

create index screenings_queue_idx on public.screenings (review_status, priority_rank, created_at);
create index screenings_submitted_by_idx on public.screenings (submitted_by);
create index screenings_model_version_idx on public.screenings (model_version);

-- New screenings always start pending, with no lab result, whatever the caller sends.
create function public.prepare_screening()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(trim(p.full_name), ''), u.email, 'Unknown')
    into new.submitter_name
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = new.submitted_by;
  if new.submitter_name is null then
    raise exception 'No profile for the submitter';
  end if;
  new.created_at := now();
  new.review_status := 'pending';
  new.human_label := null;
  new.last_reviewed_at := null;
  new.last_reviewed_by_name := null;
  new.lab_status := 'none';
  new.lab_recorded_at := null;
  return new;
end;
$$;

create trigger prepare_screening
  before insert on public.screenings
  for each row execute function public.prepare_screening();

-- Only the review and lab-result triggers below may change a screening, and
-- only its status columns. pg_trigger_depth() is 1 for a direct UPDATE and 2
-- when the update comes from those triggers. Applies to every role, including
-- the service role and the SQL editor.
create function public.guard_screening_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Screenings are part of the audit trail and can''t be deleted.' using errcode = '42501';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'Screenings can''t be edited directly; add a review or lab result instead.' using errcode = '42501';
  end if;
  if (new.submitted_by, new.submitter_name, new.block, new.plant_part, new.observations,
      new.storage_path, new.model_version, new.created_at,
      new.ai_status, new.ai_label, new.ai_confidence, new.ai_severity_pct, new.ai_severity,
      new.ai_priority, new.ai_evidence, new.ai_abstain_reason)
     is distinct from
     (old.submitted_by, old.submitter_name, old.block, old.plant_part, old.observations,
      old.storage_path, old.model_version, old.created_at,
      old.ai_status, old.ai_label, old.ai_confidence, old.ai_severity_pct, old.ai_severity,
      old.ai_priority, old.ai_evidence, old.ai_abstain_reason) then
    raise exception 'The screening result and its context can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_screening_change
  before update or delete on public.screenings
  for each row execute function public.guard_screening_change();

alter table public.screenings enable row level security;

create policy "Reviewer roles can view screenings"
  on public.screenings for select to authenticated
  using (public.can_view_screenings());

-- Users never write screenings: the server inserts them with the service role,
-- so the screening result can't be forged through the API.
revoke all on public.screenings from anon, authenticated;
grant select on public.screenings to authenticated;

-- ------------------------------------------------------------ reviews (append-only)

create table public.screening_reviews (
  id bigint generated always as identity primary key,
  screening_id bigint not null references public.screenings (id) on delete restrict,
  reviewer_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  -- Snapshots at the time of the decision (set by trigger).
  reviewer_name text not null,
  reviewer_role public.user_role not null,
  model_version text not null references public.model_versions (id) on delete restrict,
  decision text not null check (decision in ('confirmed', 'corrected', 'rejected', 'escalated')),
  corrected_label text,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  check ((decision = 'corrected') = (corrected_label is not null))
);

create index screening_reviews_screening_idx on public.screening_reviews (screening_id, created_at);
create index screening_reviews_reviewer_idx on public.screening_reviews (reviewer_id);

-- Why the current user may not add this decision, or null when they may.
-- One place for the rules, used by the insert policy and the trigger.
create function public.screening_review_problem(p_screening_id bigint, p_decision text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role public.user_role;
  v_screening public.screenings;
begin
  select role into v_role from public.profiles where id = auth.uid() and deactivated_at is null;
  if v_role is null or v_role not in ('disease_in_charge', 'supervisor') then
    return 'Only Disease In-Charge and Supervisors can review screenings.';
  end if;

  select * into v_screening from public.screenings where id = p_screening_id;
  if not found then
    return 'That screening no longer exists.';
  end if;
  if v_screening.submitted_by = auth.uid() then
    return 'You can''t review a screening you submitted.';
  end if;
  if p_decision = 'confirmed' and v_screening.ai_status = 'abstained' then
    return 'An inconclusive screening result can''t be confirmed; correct it or reject it.';
  end if;

  if v_screening.review_status = 'escalated' then
    if v_role <> 'supervisor' then
      return 'This case is escalated; only a Supervisor can decide it.';
    end if;
    if p_decision = 'escalated' then
      return 'This case is already escalated.';
    end if;
  elsif v_screening.review_status <> 'pending' then
    if v_role <> 'supervisor' then
      return 'This case is closed; only a Supervisor can override the decision.';
    end if;
    if p_decision = 'escalated' then
      return 'A closed case can''t be escalated; a Supervisor can override the decision instead.';
    end if;
  end if;

  return null;
end;
$$;

create function public.can_review_screening(p_screening_id bigint, p_decision text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.screening_review_problem(p_screening_id, p_decision) is null;
$$;

revoke execute on function public.screening_review_problem(bigint, text) from public, anon;
grant execute on function public.screening_review_problem(bigint, text) to authenticated;
revoke execute on function public.can_review_screening(bigint, text) from public, anon;
grant execute on function public.can_review_screening(bigint, text) to authenticated;

-- Locks the screening (two reviewers can't decide at once), re-checks the
-- rules with a readable error, and fills in the snapshots.
create function public.prepare_screening_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_problem text;
  v_model_version text;
begin
  if auth.uid() is null then
    raise exception 'Reviews must be made by a signed-in reviewer.' using errcode = '42501';
  end if;

  select model_version into v_model_version
    from public.screenings where id = new.screening_id for update;

  v_problem := public.screening_review_problem(new.screening_id, new.decision);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '42501';
  end if;

  new.reviewer_id := auth.uid();
  select p.role, coalesce(nullif(trim(p.full_name), ''), u.email, 'Unknown')
    into new.reviewer_role, new.reviewer_name
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = auth.uid();
  new.model_version := v_model_version;
  new.created_at := now();
  return new;
end;
$$;

create trigger prepare_screening_review
  before insert on public.screening_reviews
  for each row execute function public.prepare_screening_review();

-- Copies the latest decision onto the screening's human-confirmed status.
create function public.apply_screening_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.screenings s
     set review_status = new.decision,
         human_label = case new.decision
                         when 'confirmed' then s.ai_label
                         when 'corrected' then new.corrected_label
                         else null
                       end,
         last_reviewed_at = new.created_at,
         last_reviewed_by_name = new.reviewer_name
   where s.id = new.screening_id;
  return null;
end;
$$;

create trigger apply_screening_review
  after insert on public.screening_reviews
  for each row execute function public.apply_screening_review();

alter table public.screening_reviews enable row level security;

create policy "Reviewer roles can view screening reviews"
  on public.screening_reviews for select to authenticated
  using (public.can_view_screenings());

create policy "Reviewers can add a review they are allowed to make"
  on public.screening_reviews for insert to authenticated
  with check (
    public.is_active_user()
    and reviewer_id = auth.uid()
    and public.can_review_screening(screening_id, decision)
  );

-- No update or delete policies. Only these columns come from the client;
-- the rest are set by the trigger.
revoke all on public.screening_reviews from anon, authenticated;
grant select on public.screening_reviews to authenticated;
grant insert (screening_id, decision, corrected_label, note) on public.screening_reviews to authenticated;

-- ------------------------------------------------------------ lab results (append-only)

create table public.screening_lab_results (
  id bigint generated always as identity primary key,
  screening_id bigint not null references public.screenings (id) on delete restrict,
  recorded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  recorder_name text not null,
  lab_result text not null check (lab_result in ('moko', 'panama', 'negative', 'inconclusive')),
  -- Lab name or sample/report number.
  lab_reference text not null default '' check (char_length(lab_reference) <= 200),
  sample_date date,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index screening_lab_results_screening_idx on public.screening_lab_results (screening_id, created_at);
create index screening_lab_results_recorded_by_idx on public.screening_lab_results (recorded_by);

create function public.prepare_lab_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_record_lab_results() then
    raise exception 'Only Disease In-Charge and Supervisors can record lab results.' using errcode = '42501';
  end if;
  perform 1 from public.screenings where id = new.screening_id for update;
  new.recorded_by := auth.uid();
  select coalesce(nullif(trim(p.full_name), ''), u.email, 'Unknown')
    into new.recorder_name
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger prepare_lab_result
  before insert on public.screening_lab_results
  for each row execute function public.prepare_lab_result();

-- Copies the latest lab result onto the screening's lab-confirmed status.
create function public.apply_lab_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.screenings
     set lab_status = new.lab_result,
         lab_recorded_at = new.created_at
   where id = new.screening_id;
  return null;
end;
$$;

create trigger apply_lab_result
  after insert on public.screening_lab_results
  for each row execute function public.apply_lab_result();

alter table public.screening_lab_results enable row level security;

create policy "Reviewer roles can view lab results"
  on public.screening_lab_results for select to authenticated
  using (public.can_view_screenings());

create policy "Disease In-Charge and Supervisors can add lab results"
  on public.screening_lab_results for insert to authenticated
  with check (
    public.is_active_user()
    and recorded_by = auth.uid()
    and public.can_record_lab_results()
  );

revoke all on public.screening_lab_results from anon, authenticated;
grant select on public.screening_lab_results to authenticated;
grant insert (screening_id, lab_result, lab_reference, sample_date, note)
  on public.screening_lab_results to authenticated;

-- ------------------------------------------------------------ append-only guard

-- Blocks edits and deletes for every role, including the service role and
-- the SQL editor.
create function public.guard_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% is append-only: past records can''t be changed or deleted.', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger guard_screening_reviews_append_only
  before update or delete on public.screening_reviews
  for each row execute function public.guard_append_only();

create trigger guard_screening_reviews_no_truncate
  before truncate on public.screening_reviews
  for each statement execute function public.guard_append_only();

create trigger guard_screening_lab_results_append_only
  before update or delete on public.screening_lab_results
  for each row execute function public.guard_append_only();

create trigger guard_screening_lab_results_no_truncate
  before truncate on public.screening_lab_results
  for each statement execute function public.guard_append_only();

create trigger guard_screenings_no_truncate
  before truncate on public.screenings
  for each statement execute function public.guard_append_only();

-- ------------------------------------------------------------ photo bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screening-photos',
  'screening-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- Security definer: Field Personnel can't read screenings, but must not be
-- able to delete a photo that a saved screening uses.
create function public.screening_photo_in_use(p_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.screenings where storage_path = p_path);
$$;

revoke execute on function public.screening_photo_in_use(text) from public, anon;
grant execute on function public.screening_photo_in_use(text) to authenticated;

create policy "Reviewer roles and uploaders can view screening photo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'screening-photos'
    and public.is_active_user()
    and (public.can_view_screenings() or owner_id = auth.uid()::text)
  );

create policy "Active users can upload screening photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'screening-photos'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only to clean up after a failed submit: once a screening uses the photo,
-- it is evidence and stays.
create policy "Uploaders can delete their unused screening photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'screening-photos'
    and public.is_active_user()
    and owner_id = auth.uid()::text
    and not public.screening_photo_in_use(name)
  );

commit;
