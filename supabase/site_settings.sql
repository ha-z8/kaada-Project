-- HSA 4 Study public website presentation / credits.
-- Run on the existing KAADA project after app_roles has been created.
-- The only writable row is id=1. Public read does not expose private course data.
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id=1),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content)='object' and pg_column_size(content)<=45000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.site_settings enable row level security;

revoke all on table public.site_settings from public, anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
 for select to anon, authenticated using (true);

drop policy if exists site_settings_admin_insert on public.site_settings;
create policy site_settings_admin_insert on public.site_settings
 for insert to authenticated
 with check (id=1 and updated_by=(select auth.uid())
  and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

drop policy if exists site_settings_admin_update on public.site_settings;
create policy site_settings_admin_update on public.site_settings
 for update to authenticated
 using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
 with check (id=1 and updated_by=(select auth.uid())
  and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
