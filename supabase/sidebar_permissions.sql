-- The owner keeps exclusive access only to identity and Team.
-- Educational About section ordering + all navigation groups/pages are editor-accessible
-- to any admin; the database RLS on site_settings still requires admin role.
create or replace function app_private.site_settings_owner_guard()
returns trigger language plpgsql security definer
set search_path=''
as $$
declare
  key_name text;
  owner_fields constant text[] := array[
   'team','teamKicker','teamTitle','teamIntro','teamEmpty',
   'siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote'
  ];
begin
 if app_private.is_site_owner() then return new; end if;
 if tg_op='INSERT' then
  raise exception 'Only the owner can initialize protected site settings' using errcode='42501';
 end if;
 foreach key_name in array owner_fields loop
  if (new.content -> key_name) is distinct from (old.content -> key_name) then
   raise exception 'Only the site owner can edit the identity and team' using errcode='42501';
  end if;
 end loop;
 return new;
end
$$;
revoke all on function app_private.site_settings_owner_guard() from public,anon,authenticated;