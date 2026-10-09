-- BanaTrack: incident status, editing, edit tracking and server-only weather
-- Migration 005. Run this in the Supabase SQL editor after 004_incident_log.sql.
--
-- - Incidents get a status (open / monitoring / resolved) and resolved_at.
-- - Who last edited an incident, and when, is recorded by a trigger.
-- - The weather snapshot records the exact days it covers.
-- - Users can no longer write any weather column: only the server (service
--   role) can. Enforced by column grants and, as a second layer, a trigger.
-- - update_incident() saves an edit and its symptoms in one transaction.

-- ------------------------------------------------------------ new columns

alter table public.incidents
  add column status text not null default 'open'
    check (status in ('open', 'monitoring', 'resolved')),
  add column resolved_at timestamptz,
  -- Set by track_incident_changes from the session; never trusted from the client.
  -- "restrict" keeps the audit trail (the /users delete action checks this too).
  add column last_edited_by uuid references public.profiles (id) on delete restrict,
  -- Name at the time of the edit, readable by every active user (like reporter_name).
  add column last_edited_by_name text,
  add column last_edited_at timestamptz,
  -- First and last day (plantation time, inclusive) the weather snapshot covers.
  add column weather_window_start date,
  add column weather_window_end date;

create index incidents_last_edited_by_idx on public.incidents (last_edited_by);

-- ------------------------------------------------------------ status + edit tracking

-- Runs as the owner so it can read the editor's name; auth.uid() is still the
-- caller. Server-side writes with the service role have no auth.uid() and are
-- not counted as edits (e.g. a weather snapshot being filled in).
create function public.track_incident_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.last_edited_by := null;
    new.last_edited_by_name := null;
    new.last_edited_at := null;
    new.resolved_at := case when new.status = 'resolved' then now() end;
    return new;
  end if;

  if new.status = 'resolved' then
    if old.status is distinct from 'resolved' then
      new.resolved_at := now();
    else
      new.resolved_at := old.resolved_at;
    end if;
  else
    new.resolved_at := null;
  end if;

  if auth.uid() is not null then
    new.last_edited_by := auth.uid();
    new.last_edited_at := now();
    select coalesce(nullif(trim(p.full_name), ''), u.email, 'Unknown')
      into new.last_edited_by_name
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.id = auth.uid();
  else
    new.last_edited_by := old.last_edited_by;
    new.last_edited_by_name := old.last_edited_by_name;
    new.last_edited_at := old.last_edited_at;
  end if;
  return new;
end;
$$;

create trigger track_incident_changes
  before insert or update on public.incidents
  for each row execute function public.track_incident_changes();

-- ------------------------------------------------------------ weather is server-only

-- Second layer behind the column grants below. Runs as the caller (no security
-- definer), so current_user is the API role: "authenticated"/"anon" for users,
-- "service_role" for the server, "postgres" in the SQL editor.
create function public.guard_incident_weather()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if num_nonnulls(
      new.weather_rain_3d_mm, new.weather_rain_7d_mm, new.weather_humidity_mean_pct, new.weather_temp_mean_c,
      new.weather_source, new.weather_fetched_at, new.weather_window_start, new.weather_window_end
    ) > 0 then
      raise exception 'Weather fields can only be set by the server' using errcode = '42501';
    end if;
  elsif (new.weather_rain_3d_mm, new.weather_rain_7d_mm, new.weather_humidity_mean_pct, new.weather_temp_mean_c,
         new.weather_source, new.weather_fetched_at, new.weather_window_start, new.weather_window_end)
        is distinct from
        (old.weather_rain_3d_mm, old.weather_rain_7d_mm, old.weather_humidity_mean_pct, old.weather_temp_mean_c,
         old.weather_source, old.weather_fetched_at, old.weather_window_start, old.weather_window_end)
     or new.incident_date is distinct from old.incident_date then
    raise exception 'Weather fields and the incident date can only be changed by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_incident_weather
  before insert or update on public.incidents
  for each row execute function public.guard_incident_weather();

-- ------------------------------------------------------------ column grants

-- Users insert only the observation (status starts as 'open'; reporter, edit
-- tracking and resolved_at are set by triggers; weather by the server).
revoke insert, update on public.incidents from anon, authenticated;
grant insert (incident_date, block, suspected_disease, severity, action_taken, notes, reported_by)
  on public.incidents to authenticated;
-- incident_date stays locked so it always matches the weather window.
grant update (status, block, suspected_disease, severity, action_taken, notes)
  on public.incidents to authenticated;

-- ------------------------------------------------------------ edit in one transaction

-- Runs as the caller, so RLS and the column grants above still apply. The
-- server action validates values against web/src/lib/incident-options.ts first.
create function public.update_incident(
  p_id bigint,
  p_status text,
  p_block text,
  p_suspected_disease text,
  p_severity text,
  p_action_taken text,
  p_notes text,
  p_symptoms text[]
)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.incidents
     set status = p_status,
         block = p_block,
         suspected_disease = p_suspected_disease,
         severity = p_severity,
         action_taken = p_action_taken,
         notes = p_notes
   where id = p_id;
  -- RLS hides rows silently, so no row means missing or not permitted.
  if not found then
    raise exception 'Incident not found or you are not allowed to edit it' using errcode = '42501';
  end if;

  delete from public.incident_symptoms
   where incident_id = p_id
     and not (symptom = any (coalesce(p_symptoms, '{}')));

  insert into public.incident_symptoms (incident_id, symptom)
  select distinct p_id, s
    from unnest(coalesce(p_symptoms, '{}')) as s
   where not exists (
     select 1 from public.incident_symptoms x where x.incident_id = p_id and x.symptom = s
   );
end;
$$;

revoke execute on function public.update_incident(bigint, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.update_incident(bigint, text, text, text, text, text, text, text[]) to authenticated;
