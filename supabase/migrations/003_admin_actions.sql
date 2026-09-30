-- BanaTrack: admin account actions (reset password, deactivate, delete) + audit log
-- Migration 003. Run this in the Supabase SQL editor after 002_user_management.sql.

-- ------------------------------------------------------------ profile flags

alter table public.profiles
  add column must_change_password boolean not null default false,
  add column deactivated_at timestamptz;

-- Signed-in users may only write full_name and role (role is still limited by
-- RLS + guard_role_change). The new flags are written only by the server with
-- the service role, so a user can't clear their own deactivation or
-- forced password change through the API.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, role) on public.profiles to authenticated;

-- A deactivated admin loses admin rights everywhere is_admin() is used.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deactivated_at is null
  );
$$;

-- list_users() gains the two new columns (return type changes, so recreate).
drop function public.list_users();

create function public.list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  created_at timestamptz,
  must_change_password boolean,
  deactivated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Only admins can list users' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, u.email::text, p.role, p.created_at,
           p.must_change_password, p.deactivated_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

revoke execute on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- ------------------------------------------------------------ safety rules

-- Locks active-admin rows so two concurrent changes can't both pass the check.
create function public.other_active_admin_exists(excluded uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.profiles
  where role = 'admin' and deactivated_at is null
  for update;

  return exists (
    select 1 from public.profiles
    where role = 'admin' and deactivated_at is null and id <> excluded
  );
end;
$$;

revoke execute on function public.other_active_admin_exists(uuid) from public, anon, authenticated;

create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_active_admin boolean := old.role = 'admin' and old.deactivated_at is null;
  is_active_admin boolean := new.role = 'admin' and new.deactivated_at is null;
begin
  if new.role is distinct from old.role and old.id = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;

  if was_active_admin and not is_active_admin
     and not public.other_active_admin_exists(old.id) then
    raise exception 'The last active admin can''t be demoted or deactivated.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger guard_profiles_role_change on public.profiles;

create trigger guard_profiles_role_change
  before update of role, deactivated_at on public.profiles
  for each row execute function public.guard_role_change();

-- Deleting an auth user cascades here, so this also blocks deleting the last
-- active admin through the Admin API.
create function public.guard_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and old.deactivated_at is null
     and not public.other_active_admin_exists(old.id) then
    raise exception 'The last active admin can''t be deleted.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger guard_profiles_delete
  before delete on public.profiles
  for each row execute function public.guard_profile_delete();

-- ------------------------------------------------------------ audit log

create table public.admin_actions (
  id bigint generated always as identity primary key,
  -- null once the acting admin's account is deleted
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (
    action in ('role_change', 'password_reset', 'deactivate', 'reactivate', 'delete')
  ),
  -- no foreign key: the row must survive the target user being deleted
  target_user_id uuid not null,
  target_email text,
  -- non-sensitive context only (e.g. role from/to); never passwords
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

-- Read-only for admins. No insert/update/delete policies: rows are written
-- only by the server with the service role, which bypasses RLS.
create policy "Admins can view admin actions"
  on public.admin_actions for select
  using (public.is_admin());

revoke insert, update, delete on public.admin_actions from anon, authenticated;
