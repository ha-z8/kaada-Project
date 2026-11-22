-- KAADA Pro username-only accounts; already applied to existing kaada Project.
-- Supabase Auth remains the password authority. Auth users are created ONLY
-- via account-control Edge Function; clients cannot edit this profile table.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,23}$'),
  constraint user_profiles_display_name_limit check (char_length(display_name) <= 100)
);
create unique index if not exists user_profiles_username_unique on public.user_profiles (lower(username));
alter table public.user_profiles enable row level security;
drop policy if exists user_profiles_read_self on public.user_profiles;
create policy user_profiles_read_self on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.user_profiles to authenticated;
revoke all on public.user_profiles from anon;
revoke insert,update,delete on public.user_profiles from authenticated,public;

-- Self-signup throttling metadata has no client access (service role only).
create table if not exists public.account_signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists account_signup_attempts_ip_time on public.account_signup_attempts(ip_hash,attempted_at desc);
alter table public.account_signup_attempts enable row level security;
revoke all on public.account_signup_attempts from anon,authenticated,public;
drop policy if exists account_signup_attempts_closed on public.account_signup_attempts;
create policy account_signup_attempts_closed on public.account_signup_attempts
  for all to anon,authenticated using (false) with check (false);

-- Promote only a username that has actually been registered and independently verified
-- by the database owner. NEVER auto-assign admin to the first signup.
-- replace YOUR_USERNAME below and run only after reviewing the profile:
-- select user_id, username, display_name from public.user_profiles;
-- insert into public.app_roles (user_id,role)
-- select user_id,'admin' from public.user_profiles where username='YOUR_USERNAME'
-- on conflict(user_id) do update set role='admin';
