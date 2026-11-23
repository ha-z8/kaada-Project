-- Teaching team: correct existing subject/lesson headings and descriptions,
-- but cannot create/delete courses or mutate ownership/order/private paths.
create or replace function app_private.teacher_subject_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text;
begin
 select role into r from public.app_roles where user_id=auth.uid();
 if r='admin' then return new; end if;
 if r<>'teacher' or (to_jsonb(new)-array['title','description'])
      is distinct from (to_jsonb(old)-array['title','description']) then
  raise exception 'Teaching role can only revise subject titles and descriptions' using errcode='42501';
 end if;
 return new;
end
$$;
revoke all on function app_private.teacher_subject_guard() from public,anon,authenticated;
drop trigger if exists teacher_subject_guard on public.subjects;
create trigger teacher_subject_guard before update on public.subjects
for each row execute function app_private.teacher_subject_guard();
drop policy if exists subject_teacher_update on public.subjects;
create policy subject_teacher_update on public.subjects for update to authenticated
using (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'))
with check (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'));

create or replace function app_private.teacher_lesson_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text;
begin
 select role into r from public.app_roles where user_id=auth.uid();
 if r='admin' then return new; end if;
 if r<>'teacher' or (to_jsonb(new)-array['title'])
      is distinct from (to_jsonb(old)-array['title']) then
  raise exception 'Teaching role can only revise existing lesson titles' using errcode='42501';
 end if;
 return new;
end
$$;
revoke all on function app_private.teacher_lesson_guard() from public,anon,authenticated;
drop trigger if exists teacher_lesson_guard on public.lessons;
create trigger teacher_lesson_guard before update on public.lessons
for each row execute function app_private.teacher_lesson_guard();
drop policy if exists lesson_teacher_update on public.lessons;
create policy lesson_teacher_update on public.lessons for update to authenticated
using (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'))
with check (exists(select 1 from public.app_roles where user_id=auth.uid() and role='teacher'));