-- BanaTrack: promote the first admin.
-- Run once in the Supabase SQL editor. The account must already exist
-- (sign up in the app or add it under Authentication > Users first).
-- The SQL editor runs as the postgres role, so RLS doesn't block this.

-- Upsert in case the profile row is missing (e.g. the account was created
-- before the handle_new_user trigger existed).
insert into public.profiles (id, full_name, role)
select id, raw_user_meta_data ->> 'full_name', 'admin'
from auth.users
where email = 'test@banatrack.com'
on conflict (id) do update set role = 'admin';

-- Check: should return exactly one row with role = admin.
select u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'test@banatrack.com';
