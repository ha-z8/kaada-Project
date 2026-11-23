-- HSA 4 Study: protected owner capabilities. Owner is the existing verified @hazzaa account,
-- anchored to auth.users.id, not an editable username or a front-end flag.
-- All other administrators can still manage non-sensitive About page content.
create table if not exists public.site_owners (
  id smallint primary key default 1 check (id=1),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.site_owners enable row level security;
revoke all on public.site_owners from public, anon, authenticated;

do $$
begin
  if not exists(select 1 from public.site_owners where id=1) then
    insert into public.site_owners (id,user_id)
    select 1,p.user_id from public.user_profiles p
    join public.app_roles r on r.user_id=p.user_id and r.role='admin'
    where p.username='hazzaa';
    if not found then
      raise exception 'Owner account @hazzaa must exist and be an administrator';
    end if;
  end if;
end;
$$;

create or replace function public.is_site_owner()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.site_owners o
    join public.app_roles r on r.user_id=o.user_id and r.role='admin'
    where o.id=1 and o.user_id=(select auth.uid())
  )
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

-- Row-level admin permissions remain, but the trigger prevents non-owners
-- from replacing JSONB fields or sending a forged complete settings object.
create or replace function public.site_settings_owner_guard()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  key_name text;
  owner_fields constant text[] := array[
    'team','teamKicker','teamTitle','teamIntro','teamEmpty',
    'siteName','shortName','tagline','heroLead','heroAccent',
    'footerText','footerNote','sectionOrder','hiddenSections'
  ];
begin
  if public.is_site_owner() then
    return new;
  end if;

  if tg_op='INSERT' then
    raise exception 'Only the site owner can initialize protected site settings'
      using errcode='42501';
  end if;

  foreach key_name in array owner_fields loop
    if (new.content -> key_name) is distinct from (old.content -> key_name) then
      raise exception 'Only @hazzaa can edit protected team, identity, or layout settings'
        using errcode='42501';
    end if;
  end loop;
  return new;
end
$$;

drop trigger if exists guard_protected_site_settings on public.site_settings;
create trigger guard_protected_site_settings
  before insert or update on public.site_settings
  for each row execute function public.site_settings_owner_guard();

-- Team-photo uploads, deletions and storage metadata reads are owner-only.
-- Public image delivery is unaffected because team-avatars is a public bucket.
drop policy if exists team_avatar_admin_select on storage.objects;
create policy team_avatar_admin_select on storage.objects for select to authenticated
using (bucket_id='team-avatars' and (select public.is_site_owner()));
drop policy if exists team_avatar_admin_insert on storage.objects;
create policy team_avatar_admin_insert on storage.objects for insert to authenticated
with check (
  bucket_id='team-avatars'
  and name ~ '^team/[0-9a-f-]{36}[.]webp$'
  and (select public.is_site_owner())
);
drop policy if exists team_avatar_admin_delete on storage.objects;
create policy team_avatar_admin_delete on storage.objects for delete to authenticated
using (bucket_id='team-avatars' and (select public.is_site_owner()));
