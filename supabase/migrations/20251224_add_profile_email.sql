-- Add email column to profiles so member lists can display a stable identifier.
alter table public.profiles
  add column if not exists email text;

-- Backfill emails from auth.users for existing profiles.
update public.profiles p
set email = au.email
from auth.users au
where p.id = au.id
  and p.email is null;
