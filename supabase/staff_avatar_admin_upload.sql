-- Supervisors may upload a new unique avatar for a staff account they manage.
-- The existing account-control endpoint alone decides if a target user may be edited,
-- so uploads cannot change any profile (including the protected owner) without authorization.
-- Avoid querying another user's app_roles row here: RLS only allows reading one's own role.
drop policy if exists staff_avatar_admin_upload on storage.objects;
create policy staff_avatar_admin_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'team-avatars'
  and name ~ '^staff/[a-f0-9-]{36}/[a-f0-9-]{36}[.]webp$'
  and exists (
    select 1 from public.app_roles actor
    where actor.user_id = (select auth.uid()) and actor.role = 'admin'
  )
);