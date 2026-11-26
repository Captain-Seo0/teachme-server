-- profiles: add student_type and avatar_url; create the public `avatars` bucket.
--
-- ROLLBACK (run manually, in this order):
--   drop policy if exists avatars_select_own on storage.objects;
--   drop policy if exists avatars_insert_own on storage.objects;
--   drop policy if exists avatars_update_own on storage.objects;
--   drop policy if exists avatars_delete_own on storage.objects;
--   -- Empty the bucket first via the Storage API or Dashboard (Storage > avatars).
--   -- Do not delete rows from storage.objects with SQL: the files would stay in
--   -- the underlying object store.
--   delete from storage.buckets where id = 'avatars';
--   alter table public.profiles drop column avatar_url, drop column student_type;
--   drop type public.student_type;

-- ---------------------------------------------------------------------------
-- student_type
-- ---------------------------------------------------------------------------

create type public.student_type as enum (
  'middle_school',     -- 중학생
  'high_school',       -- 고등학생
  'repeat_exam_taker', -- N수생
  'general'            -- 일반인
);

-- Nullable because rows already exist; the client requires it for new sign-ups.
alter table public.profiles
  add column student_type public.student_type;

-- ---------------------------------------------------------------------------
-- avatar_url
-- ---------------------------------------------------------------------------

-- Profile photo URL. `avatar` (color identifier, NOT NULL) stays as the
-- fallback shown when avatar_url is null.
alter table public.profiles
  add column avatar_url text;

-- ---------------------------------------------------------------------------
-- avatars bucket
-- Path rule: {user_id}/avatar.jpg
-- Public bucket: files are readable by URL without a policy.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Write access is limited to the caller's own folder ({auth.uid()}/...).
-- There is deliberately no select policy for anon: that would allow listing
-- every user's folder (user ids) through the Storage API. The own-folder
-- select policy below is what upsert needs.

create policy avatars_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
