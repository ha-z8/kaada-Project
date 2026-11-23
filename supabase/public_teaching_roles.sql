-- Public classroom + independent teacher role. Apply via Supabase migration.
alter table public.app_roles drop constraint if exists app_roles_role_check;
alter table public.app_roles add constraint app_roles_role_check check(role in ('admin','teacher','user'));

-- Public catalog views deliberately omit authorship UUIDs and private file/audio paths.
-- Views run with their owner's privileges; only the explicitly selected academic columns are exposed.
create or replace view public.public_catalog_subjects with (security_barrier=true)
as select id,title,description,created_at from public.subjects;
create or replace view public.public_catalog_lessons with (security_barrier=true)
as select id,subject_id,title,position,created_at from public.lessons;
create or replace view public.public_catalog_sections with (security_barrier=true)
as select id,lesson_id,position,source_page,
  content_en,content_ar,explanation_mixed,explanation_en,explanation_ar,
  speech_en,speech_ar,processed_at,reviewed_at,translated_at,translation_reviewed_at
  from public.sections;
revoke all on public.public_catalog_subjects,public.public_catalog_lessons,public.public_catalog_sections from public;
grant select on public.public_catalog_subjects,public.public_catalog_lessons,public.public_catalog_sections to anon,authenticated;

create or replace function app_private.teacher_academic_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 r text;
 allowed text[]:=array[
 'content_en','content_ar','explanation_ar','explanation_en','explanation_mixed',
 'speech_ar','speech_en','translated_at','translation_reviewed_at','processed_at','reviewed_at'
 ];
begin
 select role into r from public.app_roles where user_id=auth.uid();
 if r='admin' then return new; end if;
 if r <> 'teacher' then
  raise exception 'Only academic editors can modify paragraphs' using errcode='42501';
 end if;
 if (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then
  raise exception 'Teaching members may only edit academic paragraphs and translations' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function app_private.teacher_academic_guard() from public,anon,authenticated;
drop trigger if exists teacher_academic_guard on public.sections;
create trigger teacher_academic_guard before update on public.sections
for each row execute function app_private.teacher_academic_guard();
drop policy if exists section_teacher_update on public.sections;
create policy section_teacher_update on public.sections for update to authenticated
using (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'))
with check (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'));
