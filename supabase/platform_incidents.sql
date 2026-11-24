create table if not exists public.platform_incidents (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 source text not null check(source in ('database','hosting','accounts','audio','network','frontend','storage','ai')),
 kind text not null check(kind in ('http','network','runtime','operation','health')),
 status integer check(status between 100 and 599),
 page text not null check(page in ('home','reader','about','accounts','site-settings','my-account','incidents','unknown'))
);
alter table public.platform_incidents enable row level security;
revoke all on public.platform_incidents from anon, authenticated;
grant select on public.platform_incidents to authenticated;
grant insert(source,kind,status,page) on public.platform_incidents to authenticated;
drop policy if exists platform_incidents_admin_read on public.platform_incidents;
drop policy if exists platform_incidents_admin_insert on public.platform_incidents;
create policy platform_incidents_admin_read on public.platform_incidents for select to authenticated using (exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy platform_incidents_admin_insert on public.platform_incidents for insert to authenticated with check (exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create index if not exists platform_incidents_created_idx on public.platform_incidents(created_at desc);
