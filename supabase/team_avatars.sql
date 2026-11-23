-- Run on the dedicated HSA Supabase project. Public thumbnail files: max 512 KB, WebP only.
-- User profile image objects are public; writes are limited to app_roles='admin'.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('team-avatars','team-avatars',true,524288,ARRAY['image/webp']::text[])
on conflict (id) do update set
  public=true,file_size_limit=524288,allowed_mime_types=ARRAY['image/webp']::text[];

drop policy if exists "team_avatar_admin_select" on storage.objects;
create policy "team_avatar_admin_select" on storage.objects for select to authenticated
using(bucket_id='team-avatars' and exists(
 select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'
));
drop policy if exists "team_avatar_admin_insert" on storage.objects;
create policy "team_avatar_admin_insert" on storage.objects for insert to authenticated
with check (
 bucket_id='team-avatars'
 and name ~ '^team/[0-9a-f-]{36}[.]webp$'
 and exists(select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
drop policy if exists "team_avatar_admin_delete" on storage.objects;
create policy "team_avatar_admin_delete" on storage.objects for delete to authenticated
using(bucket_id='team-avatars' and exists(
 select 1 from public.app_roles r where r.user_id=(select auth.uid()) and r.role='admin'
));