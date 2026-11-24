create table if not exists public.study_document_attachments (
 lesson_id uuid primary key references public.lessons(id) on delete cascade,
 source_path text unique not null check (source_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/source[.]pdf$'),
 created_at timestamptz not null default now()
);
alter table public.study_document_attachments enable row level security;
revoke all on public.study_document_attachments from public, anon, authenticated;
grant select,insert on public.study_document_attachments to authenticated;
drop policy if exists document_attachment_staff_read on public.study_document_attachments;
create policy document_attachment_staff_read on public.study_document_attachments for select to authenticated using (
 exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role in ('admin','teacher'))
);
drop policy if exists document_attachment_admin_insert on public.study_document_attachments;
create policy document_attachment_admin_insert on public.study_document_attachments for insert to authenticated with check (
 exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')
 and split_part(source_path,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.lessons l where l.id=study_document_attachments.lesson_id)
 and exists(select 1 from storage.objects o where o.bucket_id='study-source' and o.name=study_document_attachments.source_path)
);
drop policy if exists document_admin_publish on public.study_document_publications;
create policy document_admin_publish on public.study_document_publications for insert to authenticated with check (
 exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')
 and (exists(select 1 from public.lessons l where l.id=study_document_publications.lesson_id and l.source_path=study_document_publications.source_path)
 or exists(select 1 from public.study_document_attachments a where a.lesson_id=study_document_publications.lesson_id and a.source_path=study_document_publications.source_path))
);
