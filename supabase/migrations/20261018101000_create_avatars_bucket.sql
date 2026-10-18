-- ============================================================
-- Avatars bucket used by onboarding + profile edit.
-- Files are stored at the root as "<user id>.<ext>".
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Public bucket: files are served by public URL without a SELECT policy.
-- The owner SELECT policy is only there so upsert can see the existing file.
create policy "avatars_owner_select" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

create policy "avatars_owner_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

create policy "avatars_owner_update" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

create policy "avatars_owner_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
