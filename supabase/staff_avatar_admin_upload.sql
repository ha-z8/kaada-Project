-- Admins can upload a new avatar for a managed staff account.
-- Only the account-control service decides whether a profile may be changed.
drop policy if exists staff_avatar_admin_upload on storage.objects;
create policy staff_avatar_admin_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'team-avatars'
  and name ~ '^staff/[a-f0-9-]{36}/[a-f0-9-]{36}[.]webp$'
  and exists (
    select 1 from public.app_roles actor
    where actor.user_id = (select auth.uid()) and actor.role = 'admin'
  )
  and exists (
    select 1 from public.app_roles target
    where target.user_id::text = (storage.foldername(name))[2]
      and target.role in ('admin','teacher')
  )
);