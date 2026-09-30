-- BanaTrack: admin user management (Tier 1, feature #1)
-- Run this in the Supabase SQL editor after schema.sql.
-- Adds no new RLS policies; role updates still go through the existing
-- "Admins can update any profile" policy.

-- Emails live in auth.users, which the anon/authenticated roles can't read.
-- security definer lets this read them, so it must check is_admin() itself.
create function public.list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  created_at timestamptz
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
    select p.id, p.full_name, u.email::text, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

revoke execute on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- Safety rules for role changes, enforced in the database so they hold even
-- for direct API calls. Changes made from the SQL editor (auth.uid() is null)
-- skip the self-change rule, so an admin can always be restored here.
create function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if old.id = auth.uid() then
      raise exception 'You can''t change your own role.' using errcode = '42501';
    end if;

    if old.role = 'admin' then
      -- lock admin rows so two concurrent demotions can't both pass the check
      perform 1 from public.profiles where role = 'admin' for update;
      if not exists (
        select 1 from public.profiles where role = 'admin' and id <> old.id
      ) then
        raise exception 'The last remaining admin can''t be demoted.' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_profiles_role_change
  before update of role on public.profiles
  for each row execute function public.guard_role_change();
