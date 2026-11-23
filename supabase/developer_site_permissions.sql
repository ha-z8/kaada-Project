-- HSA: developer-owned delegation of platform identity and team editing.
-- The developer identity uses the immutable site_owners.auth user id, never a username.
-- Defaults are locked and existing site settings are untouched.

create table if not exists public.site_edit_permissions (
 id smallint primary key default 1 check (id=1),
 allow_admin_identity boolean not null default false,
 allow_admin_team boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_edit_permissions(id,allow_admin_identity,allow_admin_team)
values (1,false,false) on conflict (id) do nothing;

alter table public.site_edit_permissions enable row level security;
revoke all on public.site_edit_permissions from public,anon,authenticated;
grant select on public.site_edit_permissions to authenticated;
grant update(allow_admin_identity,allow_admin_team) on public.site_edit_permissions to authenticated;

drop policy if exists site_edit_permissions_admin_read on public.site_edit_permissions;
create policy site_edit_permissions_admin_read on public.site_edit_permissions
for select to authenticated
using (exists (
 select 1 from public.app_roles r
 where r.user_id=(select auth.uid()) and r.role='admin'
));

drop policy if exists site_edit_permissions_developer_write on public.site_edit_permissions;
create policy site_edit_permissions_developer_write on public.site_edit_permissions
for update to authenticated
using ((select public.is_site_owner()))
with check ((select public.is_site_owner()));

create or replace function app_private.stamp_site_edit_permissions()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 new.updated_at:=now();
 new.updated_by:=auth.uid();
 return new;
end;
$$;
drop trigger if exists stamp_site_edit_permissions on public.site_edit_permissions;
create trigger stamp_site_edit_permissions
before update on public.site_edit_permissions
for each row execute function app_private.stamp_site_edit_permissions();

-- Permission used by Storage also checks admin role, so teaching users never inherit it.
create or replace function public.can_edit_site_team()
returns boolean language sql stable security invoker set search_path=''
as $$
 select exists (
  select 1 from public.app_roles r
  cross join public.site_edit_permissions p
  where p.id=1 and r.user_id=(select auth.uid()) and r.role='admin'
   and ((select public.is_site_owner()) or p.allow_admin_team)
 );
$$;
revoke all on function public.can_edit_site_team() from public,anon;
grant execute on function public.can_edit_site_team() to authenticated;

-- The settings trigger is authoritative even when clients forge or replay JSON.
create or replace function app_private.site_settings_owner_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 field_name text;
 allow_identity boolean:=false;
 allow_team boolean:=false;
 is_admin boolean:=false;
 identity_fields constant text[]:=array[
  'siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote'
 ];
 team_fields constant text[]:=array[
  'team','teamKicker','teamTitle','teamIntro','teamEmpty'
 ];
begin
 if app_private.is_site_owner() then return new; end if;
 if tg_op='INSERT' then
  raise exception 'Only the platform developer can initialize site settings'
   using errcode='42501';
 end if;

 select exists(
  select 1 from public.app_roles r
  where r.user_id=auth.uid() and r.role='admin'
 ) into is_admin;
 select p.allow_admin_identity,p.allow_admin_team
  into allow_identity,allow_team from public.site_edit_permissions p where p.id=1;
 allow_identity:=is_admin and coalesce(allow_identity,false);
 allow_team:=is_admin and coalesce(allow_team,false);

 foreach field_name in array identity_fields loop
  if (new.content -> field_name) is distinct from (old.content -> field_name)
     and not allow_identity then
   raise exception 'Platform developer disabled supervisor edits to identity'
    using errcode='42501';
  end if;
 end loop;
 foreach field_name in array team_fields loop
  if (new.content -> field_name) is distinct from (old.content -> field_name)
     and not allow_team then
   raise exception 'Platform developer disabled supervisor edits to team'
    using errcode='42501';
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function app_private.site_settings_owner_guard() from public,anon,authenticated;

-- Keep team image upload/delete governed by the same developer toggle.
-- The staff/<uid>/ avatar upload policies are separate and unaffected.
drop policy if exists team_avatar_admin_select on storage.objects;
create policy team_avatar_admin_select on storage.objects
for select to authenticated
using(bucket_id='team-avatars' and (select public.can_edit_site_team()));

drop policy if exists team_avatar_admin_insert on storage.objects;
create policy team_avatar_admin_insert on storage.objects
for insert to authenticated
with check(
 bucket_id='team-avatars'
 and name ~ '^team/[0-9a-f-]{36}[.]webp$'
 and (select public.can_edit_site_team())
);

drop policy if exists team_avatar_admin_delete on storage.objects;
create policy team_avatar_admin_delete on storage.objects
for delete to authenticated
using(bucket_id='team-avatars' and (select public.can_edit_site_team()));
