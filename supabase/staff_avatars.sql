-- Staff avatars use the existing public image bucket; publishing is intentional.
-- Team pictures remain exclusively writable by the platform owner.
alter table public.user_profiles
  add column if not exists avatar_path text not null default '';

alter table public.user_profiles
  drop constraint if exists user_profiles_avatar_path_valid;
alter table public.user_profiles
  add constraint user_profiles_avatar_path_valid check (
    avatar_path = ''
    or avatar_path ~ '^team/[a-f0-9-]{36}[.]webp$'
    or avatar_path ~ ('^staff/' || user_id::text || '/[a-f0-9-]{36}[.]webp$')
  );

-- No general UPDATE grant: only the avatar_path column is editable by staff themselves.
grant update (avatar_path) on public.user_profiles to authenticated;
drop policy if exists user_profiles_self_avatar_update on public.user_profiles;
create policy user_profiles_self_avatar_update on public.user_profiles
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_roles r
      where r.user_id = (select auth.uid()) and r.role in ('admin','teacher')
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_roles r
      where r.user_id = (select auth.uid()) and r.role in ('admin','teacher')
    )
  );

-- Unique per-upload paths. Staff may upload only to a folder owned by their auth UID.
-- No UPDATE/DELETE permission for team assets is granted here.
drop policy if exists staff_avatar_upload on storage.objects;
create policy staff_avatar_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'team-avatars'
    and name ~ '^staff/[a-f0-9-]{36}/[a-f0-9-]{36}[.]webp$'
    and (storage.foldername(name))[1] = 'staff'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.app_roles r
      where r.user_id = (select auth.uid()) and r.role in ('admin','teacher')
    )
  );
