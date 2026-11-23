-- Harden public views to invoker context; grant anonymous reads by explicit safe columns only.
-- The Postgres row-level security policies still forbid anonymous writes.
alter view public.public_catalog_subjects set (security_invoker=true);
alter view public.public_catalog_lessons set (security_invoker=true);
alter view public.public_catalog_sections set (security_invoker=true);

revoke all on public.subjects,public.lessons,public.sections from anon;
grant select (id,title,description,created_at) on public.subjects to anon;
grant select (id,subject_id,title,position,created_at) on public.lessons to anon;
grant select (
 id,lesson_id,position,source_page,
 content_en,content_ar,explanation_mixed,explanation_en,explanation_ar,
 speech_en,speech_ar,processed_at,reviewed_at,translated_at,translation_reviewed_at
) on public.sections to anon;

drop policy if exists subject_public_read on public.subjects;
create policy subject_public_read on public.subjects for select to anon using(true);
drop policy if exists lesson_public_read on public.lessons;
create policy lesson_public_read on public.lessons for select to anon using(true);
drop policy if exists section_public_read on public.sections;
create policy section_public_read on public.sections for select to anon using(true);