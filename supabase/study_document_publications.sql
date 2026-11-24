-- Existing original PDF files remain private until explicitly approved by an administrator.
create table if not exists public.study_document_publications (
 lesson_id uuid primary key references public.lessons(id) on delete cascade,
 source_path text not null check (source_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/source[.]pdf$'),
 published_at timestamptz not null default now()
);
alter table public.study_document_publications enable row level security;
revoke all on public.study_document_publications from public, anon, authenticated;
grant select on public.study_document_publications to anon, authenticated;
grant insert,delete on public.study_document_publications to authenticated;
drop policy if exists document_public_read on public.study_document_publications;
create policy document_public_read on public.study_document_publications for select to anon, authenticated using (true);
drop policy if exists document_admin_publish on public.study_document_publications;
create policy document_admin_publish on public.study_document_publications for insert to authenticated with check (
 exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')
 and exists(select 1 from public.lessons l where l.id=lesson_id and l.source_path=study_document_publications.source_path)
);
drop policy if exists document_admin_unpublish on public.study_document_publications;
create policy document_admin_unpublish on public.study_document_publications for delete to authenticated using (
 exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
create index if not exists study_document_publications_path on public.study_document_publications(source_path);
drop policy if exists approved_study_pdf_read on storage.objects;
create policy approved_study_pdf_read on storage.objects for select to anon using (
 bucket_id='study-source' and exists(select 1 from public.study_document_publications d where d.source_path=objects.name)
);
