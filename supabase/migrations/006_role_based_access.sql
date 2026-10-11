-- BanaTrack: role-based access for incidents (docs/role-matrix.md)
-- Migration 006. Run this in the Supabase SQL editor after 005_incident_status_and_weather.sql.
--
-- Splits "manage anyone's incident" into two rules:
-- - Edit anyone's incident:   Disease In-Charge, Supervisor, Admin
-- - Delete anyone's incident: Supervisor, Admin
-- Reporters can still edit and delete their own incidents, whatever their role.
--
-- Keep these in step with "incidents.editAny" / "incidents.deleteAny" in
-- web/src/lib/permissions.ts.
--
-- No tables or data change: only two helper functions and the policies that
-- used can_manage_incidents(), which is dropped at the end.

begin;

-- ------------------------------------------------------------ helpers

create function public.can_edit_any_incident()
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

create function public.can_delete_any_incident()
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

revoke execute on function public.can_edit_any_incident() from public, anon;
grant execute on function public.can_edit_any_incident() to authenticated;
revoke execute on function public.can_delete_any_incident() from public, anon;
grant execute on function public.can_delete_any_incident() to authenticated;

-- ------------------------------------------------------------ incidents

drop policy "Reporters, supervisors and admins can update incidents" on public.incidents;
create policy "Reporters and incident editors can update incidents"
  on public.incidents for update to authenticated
  using (public.is_active_user() and (reported_by = auth.uid() or public.can_edit_any_incident()))
  with check (public.is_active_user() and (reported_by = auth.uid() or public.can_edit_any_incident()));

drop policy "Reporters, supervisors and admins can delete incidents" on public.incidents;
create policy "Reporters, supervisors and admins can delete incidents"
  on public.incidents for delete to authenticated
  using (public.is_active_user() and (reported_by = auth.uid() or public.can_delete_any_incident()));

-- ------------------------------------------------------------ symptoms (part of an edit)

drop policy "Incident editors can add symptoms" on public.incident_symptoms;
create policy "Incident editors can add symptoms"
  on public.incident_symptoms for insert to authenticated
  with check (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_edit_any_incident())
    )
  );

drop policy "Incident editors can remove symptoms" on public.incident_symptoms;
create policy "Incident editors can remove symptoms"
  on public.incident_symptoms for delete to authenticated
  using (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_edit_any_incident())
    )
  );

-- ------------------------------------------------------------ photos

-- Attaching a photo is an edit. The uploader must still own the file.
drop policy "Incident editors can add their own photos" on public.incident_photos;
create policy "Incident editors can add their own photos"
  on public.incident_photos for insert to authenticated
  with check (
    public.is_active_user()
    and uploaded_by = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_edit_any_incident())
    )
  );

-- Removing photos destroys field evidence, so it follows the delete rule.
drop policy "Incident editors can remove photos" on public.incident_photos;
create policy "Reporters, supervisors and admins can remove photos"
  on public.incident_photos for delete to authenticated
  using (
    public.is_active_user() and exists (
      select 1 from public.incidents i
      where i.id = incident_id and (i.reported_by = auth.uid() or public.can_delete_any_incident())
    )
  );

drop policy "Uploaders, supervisors and admins can delete incident photo files" on storage.objects;
create policy "Uploaders, supervisors and admins can delete incident photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'incident-photos'
    and public.is_active_user()
    and (owner_id = auth.uid()::text or public.can_delete_any_incident())
  );

-- ------------------------------------------------------------ cleanup

-- Nothing uses it any more; it fails here (and rolls back) if something does.
drop function public.can_manage_incidents();

commit;
