-- KAADA Study — run ONLY on a NEW dedicated Supabase project.
-- Everything is private per account. Never place restricted course PDFs in GitHub.
create extension if not exists pgcrypto;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  position integer not null default 0,
  source_filename text,
  source_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position integer not null default 0,
  source_page integer,
  content_en text not null,
  content_ar text not null default '',
  explanation_mixed text not null default '',
  explanation_en text not null default '',
  explanation_ar text not null default '',
  speech_en text not null default '',
  speech_ar text not null default '',
  audio_mixed_path text,
  audio_en_path text,
  audio_ar_path text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.study_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  audio_track text not null default 'mixed' check (audio_track in ('mixed','ar','en')),
  speed numeric(3,2) not null default 1.00 check (speed between 0.75 and 2.00),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create index if not exists lessons_by_subject on public.lessons(subject_id, position);
create index if not exists sections_by_lesson on public.sections(lesson_id, position);
create index if not exists progress_by_user on public.study_progress(user_id, updated_at desc);

alter table public.subjects enable row level security;
alter table public.lessons enable row level security;
alter table public.sections enable row level security;
alter table public.study_progress enable row level security;

-- Existing policies are not modified if this script is executed twice.
drop policy if exists "subject_owner" on public.subjects;
create policy "subject_owner" on public.subjects for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "lesson_owner" on public.lessons;
create policy "lesson_owner" on public.lessons for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

drop policy if exists "section_owner" on public.sections;
create policy "section_owner" on public.sections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = (select auth.uid()))
  );

drop policy if exists "progress_owner" on public.study_progress;
create policy "progress_owner" on public.study_progress for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = (select auth.uid()))
    and (section_id is null or exists (
      select 1 from public.sections s where s.id = section_id and s.lesson_id = study_progress.lesson_id and s.user_id = (select auth.uid())
    ))
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.subjects, public.lessons, public.sections, public.study_progress to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('study-source','study-source',false,31457280),
       ('study-audio','study-audio',false,31457280)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Both private buckets require first path component = current authenticated user UUID.
drop policy if exists "study_assets_read" on storage.objects;
create policy "study_assets_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "study_assets_insert" on storage.objects;
create policy "study_assets_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "study_assets_update" on storage.objects;
create policy "study_assets_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "study_assets_delete" on storage.objects;
create policy "study_assets_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('study-source','study-audio') and (storage.foldername(name))[1] = (select auth.uid())::text);
