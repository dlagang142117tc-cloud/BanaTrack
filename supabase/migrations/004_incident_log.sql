-- BanaTrack: Incident Log (incidents, symptoms, photos, weather snapshot)
-- Migration 004. Run this in the Supabase SQL editor after 003_admin_actions.sql.
--
-- Block, symptom, severity, suspected-disease and action values are plain text
-- on purpose: the lists live in web/src/lib/incident-options.ts and the server
-- validates against them, so they can change without a new migration.

-- ------------------------------------------------------------ helpers

-- Signed in and not deactivated.
create function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and deactivated_at is null
  );
$$;

-- Active supervisors and admins may edit or delete anyone's incidents.
create function public.can_manage_incidents()
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
      and role in ('supervisor', 'admin')
  );
$$;

revoke execute on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;
revoke execute on function public.can_manage_incidents() from public, anon;
grant execute on function public.can_manage_incidents() to authenticated;

-- ------------------------------------------------------------ incidents

create table public.incidents (
  id bigint generated always as identity primary key,
  incident_date date not null,
  block text not null,
  suspected_disease text not null,
  severity text not null,
  action_taken text not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Set by the set_incident_reporter trigger; never trusted from the client.
  -- "restrict" keeps the audit trail: a reporter's account can't be deleted
  -- while they have incidents (the /users delete action checks this too).
  reported_by uuid not null references public.profiles (id) on delete restrict,
  -- Name at the time of reporting, so every active user can see who reported
  -- an incident without being able to read other users' profiles.
  reporter_name text not null,
  -- Weather snapshot from Open-Meteo for the 7 days up to incident_date.
  -- All null when Open-Meteo could not be reached.
  weather_rain_3d_mm numeric(6, 1),
  weather_rain_7d_mm numeric(6, 1),
  weather_humidity_mean_pct numeric(4, 1),
  weather_temp_mean_c numeric(4, 1),
  weather_source text,
  weather_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incidents_date_idx on public.incidents (incident_date desc, created_at desc);
create index incidents_reported_by_idx on public.incidents (reported_by);

create function public.set_incident_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reported_by := auth.uid();
  select coalesce(nullif(trim(p.full_name), ''), u.email, 'Unknown')
    into new.reporter_name
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = auth.uid();
  if new.reporter_name is null then
    raise exception 'No profile for the current user';
  end if;
  return new;
end;
$$;

create trigger set_incident_reporter
  before insert on public.incidents
  for each row execute function public.set_incident_reporter();

create trigger set_incidents_updated_at
  before update on public.incidents
  for each row execute function public.handle_updated_at();

alter table public.incidents enable row level security;

create policy "Active users can view incidents"
  on public.incidents for select to authenticated
  using (public.is_active_user());

create policy "Active users can create their own incidents"
  on public.incidents for insert to authenticated
  with check (public.is_active_user() and reported_by = auth.uid());

create policy "Reporters, supervisors and admins can update incidents"
  on public.incidents for update to authenticated
  using (public.is_active_user() and (reported_by = auth.uid() or public.can_manage_incidents()))
  with check (public.is_active_user() and (reported_by = auth.uid() or public.can_manage_incidents()));

create policy "Reporters, supervisors and admins can delete incidents"
  on public.incidents for delete to authenticated
  using (public.is_active_user() and (reported_by = auth.uid() or public.can_manage_incidents()));

-- Edits may only change the observation itself, never who reported it, when,
-- or the weather snapshot.
revoke update on public.incidents from anon, authenticated;
grant update (incident_date, block, suspected_disease, severity, action_taken, notes)
  on public.incidents to authenticated;

-- ------------------------------------------------------------ symptoms (one row each)

create table public.incident_symptoms (
  incident_id bigint not null references public.incidents (id) on delete cascade,
  symptom text not null,
  primary key (incident_id, symptom)
);

alter table public.incident_symptoms enable row level security;

create policy "Active users can view incident symptoms"
  on public.incident_symptoms for select to authenticated
  using (public.is_active_user());

create policy "Incident editors can add symptoms"
  on public.incident_symptoms for insert to authenticated
  with check (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_manage_incidents())
    )
  );

create policy "Incident editors can remove symptoms"
  on public.incident_symptoms for delete to authenticated
  using (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_manage_incidents())
    )
  );

-- ------------------------------------------------------------ photos

create table public.incident_photos (
  id uuid primary key default gen_random_uuid(),
  incident_id bigint not null references public.incidents (id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index incident_photos_incident_idx on public.incident_photos (incident_id);

alter table public.incident_photos enable row level security;

create policy "Active users can view incident photos"
  on public.incident_photos for select to authenticated
  using (public.is_active_user());

-- Photos are stored under "<uploader id>/..." so a user can only link files
-- they uploaded themselves.
create policy "Incident editors can add their own photos"
  on public.incident_photos for insert to authenticated
  with check (
    public.is_active_user()
    and uploaded_by = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_manage_incidents())
    )
  );

create policy "Incident editors can remove photos"
  on public.incident_photos for delete to authenticated
  using (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_manage_incidents())
    )
  );

revoke update on public.incident_photos from anon, authenticated;

-- ------------------------------------------------------------ storage bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-photos',
  'incident-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

create policy "Active users can view incident photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'incident-photos' and public.is_active_user());

create policy "Active users can upload incident photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'incident-photos'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Uploaders, supervisors and admins can delete incident photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'incident-photos'
    and public.is_active_user()
    and (owner_id = auth.uid()::text or public.can_manage_incidents())
  );
