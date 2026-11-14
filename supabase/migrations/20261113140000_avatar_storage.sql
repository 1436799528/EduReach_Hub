-- UX-2 — profile photos live in object storage, not in `profiles.avatar_url`.
--
-- Before this migration the profile page read the chosen file with
-- `FileReader.readAsDataURL` and saved the resulting base64 string into
-- `public.profiles.avatar_url`. A 2 MB photo became a ~2.7 MB row, was copied
-- into every profile query, could not be cached like an object, and made the
-- public profile payload large enough to be a denial-of-service lever.
--
-- The page now uploads to the public `avatars` bucket under the signed-in
-- user's own folder and stores only the resulting public URL. The policies keep
-- writes owner-scoped; public read is intentional because the URL is rendered
-- as a normal <img> on the public profile.
--
-- PGlite replay shims `storage` but not every helper function, so object paths
-- are split with plain `split_part` instead of `storage.foldername`.

do $storage$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do update set public = true;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'avatars_public_read'
    ) then
      execute $policy$
        create policy avatars_public_read on storage.objects
        for select using (bucket_id = 'avatars')
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'avatars_owner_insert'
    ) then
      execute $policy$
        create policy avatars_owner_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'avatars'
          and split_part(name, '/', 1) = auth.uid()::text
        )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'avatars_owner_update'
    ) then
      execute $policy$
        create policy avatars_owner_update on storage.objects
        for update to authenticated
        using (
          bucket_id = 'avatars'
          and split_part(name, '/', 1) = auth.uid()::text
        )
        with check (
          bucket_id = 'avatars'
          and split_part(name, '/', 1) = auth.uid()::text
        )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'avatars_owner_delete'
    ) then
      execute $policy$
        create policy avatars_owner_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'avatars'
          and split_part(name, '/', 1) = auth.uid()::text
        )
      $policy$;
    end if;
  end if;
end;
$storage$;
