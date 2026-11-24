drop policy if exists section_teacher_delete on public.sections;
create policy section_teacher_delete on public.sections for delete to authenticated using (exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='teacher'));
