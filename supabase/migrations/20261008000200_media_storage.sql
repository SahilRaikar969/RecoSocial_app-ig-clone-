begin;
-- CLEAN INSTALL ONLY. Preserve public media; do not apply to an existing project.
-- Object reads through the public bucket URL remain public, as in the current app.
-- Listing/mutation API access is owner-scoped. No UPDATE policy: uploads use upsert=false.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'media')
     or exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects') then
    raise exception 'Existing storage configuration: STOP and follow LIVE-SUPABASE-VERIFICATION.md';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array[
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime','video/x-m4v',
  'video/3gpp','video/3gpp2','video/ogg'
]);

create policy media_owner_select on storage.objects for select to authenticated
using (bucket_id = 'media' and owner_id = (select auth.uid())::text);

create policy media_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and (select auth.uid()) is not null
  and owner_id = (select auth.uid())::text
  and array_length(string_to_array(name, '/'), 1) = 3
  and split_part(name, '/', 1) = any(array[
    'images','videos','thumbnails','avatars',
    'story-images','story-videos','story-thumbnails',
    'camera-story-images','camera-story-videos','camera-post-images','camera-post-videos'
  ])
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
);

create policy media_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'media'
  and owner_id = (select auth.uid())::text
  and split_part(name, '/', 2) = (select auth.uid())::text
);

commit;
