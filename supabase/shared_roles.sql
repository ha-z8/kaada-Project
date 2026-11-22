-- KAADA Pro shared curriculum and two roles (admin/student).
-- Apply AFTER supabase/schema.sql to an existing installation.
-- Run in the project's SQL editor with database-owner privileges only.
-- NEVER implement role assignment based on client user_metadata.
create table if not exists public.app_roles (user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'user' check (role in ('user','admin')),assigned_at timestamptz not null default now());
alter table public.app_roles enable row level security;
drop policy if exists app_roles_read_own on public.app_roles;
create policy app_roles_read_own on public.app_roles for select to authenticated using (user_id=(select auth.uid()));
grant select on public.app_roles to authenticated;
revoke all on public.app_roles from anon;
revoke insert,update,delete on public.app_roles from authenticated,public;
drop policy if exists subject_owner on public.subjects;
drop policy if exists subject_read on public.subjects;
drop policy if exists subject_admin_insert on public.subjects;
drop policy if exists subject_admin_update on public.subjects;
drop policy if exists subject_admin_delete on public.subjects;
create policy subject_read on public.subjects for select to authenticated using (true);
create policy subject_admin_insert on public.subjects for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') );
create policy subject_admin_update on public.subjects for update to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') );
create policy subject_admin_delete on public.subjects for delete to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
drop policy if exists lesson_owner on public.lessons;
drop policy if exists lesson_read on public.lessons;
drop policy if exists lesson_admin_insert on public.lessons;
drop policy if exists lesson_admin_update on public.lessons;
drop policy if exists lesson_admin_delete on public.lessons;
create policy lesson_read on public.lessons for select to authenticated using (true);
create policy lesson_admin_insert on public.lessons for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') and exists (select 1 from public.subjects s where s.id=subject_id));
create policy lesson_admin_update on public.lessons for update to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') and exists (select 1 from public.subjects s where s.id=subject_id));
create policy lesson_admin_delete on public.lessons for delete to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
drop policy if exists section_owner on public.sections;
drop policy if exists section_read on public.sections;
drop policy if exists section_admin_insert on public.sections;
drop policy if exists section_admin_update on public.sections;
drop policy if exists section_admin_delete on public.sections;
create policy section_read on public.sections for select to authenticated using (true);
create policy section_admin_insert on public.sections for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') and exists (select 1 from public.lessons l where l.id=lesson_id));
create policy section_admin_update on public.sections for update to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin') and exists (select 1 from public.lessons l where l.id=lesson_id));
create policy section_admin_delete on public.sections for delete to authenticated using (exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
drop policy if exists progress_owner on public.study_progress;
drop policy if exists progress_read_self on public.study_progress;
drop policy if exists progress_insert_self on public.study_progress;
drop policy if exists progress_update_self on public.study_progress;
drop policy if exists progress_delete_self on public.study_progress;
create policy progress_read_self on public.study_progress for select to authenticated using (user_id=(select auth.uid()));
create policy progress_insert_self on public.study_progress for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.lessons l where l.id=lesson_id) and (section_id is null or exists(select 1 from public.sections s where s.id=section_id and s.lesson_id=study_progress.lesson_id)));
create policy progress_update_self on public.study_progress for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and exists(select 1 from public.lessons l where l.id=lesson_id) and (section_id is null or exists(select 1 from public.sections s where s.id=section_id and s.lesson_id=study_progress.lesson_id)));
create policy progress_delete_self on public.study_progress for delete to authenticated using (user_id=(select auth.uid()));
drop policy if exists study_assets_read on storage.objects;
drop policy if exists study_assets_insert on storage.objects;
drop policy if exists study_assets_update on storage.objects;
drop policy if exists study_assets_delete on storage.objects;
drop policy if exists study_course_read on storage.objects;
drop policy if exists study_course_insert_admin on storage.objects;
drop policy if exists study_course_update_admin on storage.objects;
drop policy if exists study_course_delete_admin on storage.objects;
create policy study_course_read on storage.objects for select to authenticated using (bucket_id in ('study-source','study-audio'));
create policy study_course_insert_admin on storage.objects for insert to authenticated with check (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1]=(select auth.uid())::text and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy study_course_update_admin on storage.objects for update to authenticated using (bucket_id in ('study-source','study-audio') and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1]=(select auth.uid())::text and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy study_course_delete_admin on storage.objects for delete to authenticated using (bucket_id in ('study-source','study-audio') and exists (select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

-- After the intended supervisor signs up AND verifies their email, a database owner can assign admin:
-- select id,email from auth.users order by created_at desc;
-- insert into public.app_roles (user_id,role)
-- values ('<VERIFIED_SUPERVISOR_UUID>'::uuid,'admin')
-- on conflict (user_id) do update set role='admin';
-- Until this explicit grant, every account has student/read-only privileges.

