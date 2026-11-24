-- Lesson visibility and independent academic approval.
-- Existing lessons retain their previous visibility, new imports start hidden.
alter table public.lessons add column if not exists is_published boolean not null default true;
alter table public.lessons alter column is_published set default false;
alter table public.sections add column if not exists english_reviewed_at timestamptz;
grant select (is_published) on public.lessons to anon;
drop policy if exists lesson_public_read on public.lessons;
create policy lesson_public_read on public.lessons for select to anon using(is_published);
drop policy if exists lesson_read on public.lessons;
create policy lesson_read on public.lessons for select to authenticated using(is_published or exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role in ('admin','teacher')));
drop policy if exists section_public_read on public.sections;
create policy section_public_read on public.sections for select to anon using(exists(select 1 from public.lessons l where l.id=sections.lesson_id and l.is_published));
drop policy if exists section_read on public.sections;
create policy section_read on public.sections for select to authenticated using(exists(select 1 from public.lessons l where l.id=sections.lesson_id));
drop policy if exists subject_public_read on public.subjects;
create policy subject_public_read on public.subjects for select to anon using(exists(select 1 from public.lessons l where l.subject_id=subjects.id and l.is_published));
-- Avoid policy recursion with lesson_admin_update's subject lookup.
drop policy if exists subject_read on public.subjects;
create policy subject_read on public.subjects for select to authenticated using(true);
drop policy if exists document_public_read on public.study_document_publications;
create policy document_public_read on public.study_document_publications for select to anon,authenticated using(exists(select 1 from public.lessons l where l.id=study_document_publications.lesson_id));
drop policy if exists study_course_read on storage.objects;
create policy study_course_read on storage.objects for select to authenticated using(bucket_id in ('study-source','study-audio') and exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role in ('admin','teacher')));
drop policy if exists approved_study_pdf_read on storage.objects;
create policy approved_study_pdf_read on storage.objects for select to anon,authenticated using(bucket_id='study-source' and exists(select 1 from public.study_document_publications d where d.source_path=objects.name));
create or replace function app_private.teacher_academic_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r text; allowed text[]:=array['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en','translated_at','translation_reviewed_at','processed_at','reviewed_at','english_reviewed_at'];
begin
 select role into r from public.app_roles where user_id=auth.uid();
 if r is null or r not in ('admin','teacher') then raise exception 'Academic editors only' using errcode='42501'; end if;
 if r='teacher' and (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then raise exception 'Teaching members may only edit academic paragraphs and translations' using errcode='42501'; end if;
 if new.content_en is distinct from old.content_en then new.english_reviewed_at:=null;new.translation_reviewed_at:=null;end if;
 if new.content_ar is distinct from old.content_ar and new.translation_reviewed_at is not distinct from old.translation_reviewed_at then new.translation_reviewed_at:=null;end if;
 if nullif(trim(new.content_ar),'') is null then new.translation_reviewed_at:=null;end if;
 if (new.explanation_ar,new.speech_ar,new.content_ar) is distinct from (old.explanation_ar,old.speech_ar,old.content_ar) then new.audio_ar_path:=null;end if;
 if (new.explanation_en,new.speech_en,new.content_en) is distinct from (old.explanation_en,old.speech_en,old.content_en) then new.audio_en_path:=null;end if;
 if (new.explanation_mixed,new.explanation_ar,new.explanation_en) is distinct from (old.explanation_mixed,old.explanation_ar,old.explanation_en) then new.audio_mixed_path:=null;end if;
 return new;
end $$;
revoke all on function app_private.teacher_academic_guard() from public,anon,authenticated;
