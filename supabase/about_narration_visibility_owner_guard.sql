-- HSA 4 Study: only the platform developer controls the About narration feature.
-- This independent trigger remains protective even if another site-settings
-- owner/delegation guard is replaced by future upgrades.
create or replace function app_private.guard_about_narration_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.content -> 'aboutNarrationEnabled') is distinct from
     (old.content -> 'aboutNarrationEnabled')
     and not app_private.is_site_owner() then
    raise exception 'Only the platform developer can change About narration visibility'
      using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_about_narration_visibility()
  from public, anon, authenticated;

drop trigger if exists guard_about_narration_visibility on public.site_settings;
create trigger guard_about_narration_visibility
before update of content on public.site_settings
for each row
execute function app_private.guard_about_narration_visibility();
