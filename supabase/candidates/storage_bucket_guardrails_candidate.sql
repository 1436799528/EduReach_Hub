-- storage_bucket_guardrails_candidate.sql
--
-- REVIEW CANDIDATE — not applied by any migration run. The 2026-11-23 platform
-- security audit verified the storage posture read-only and found the buckets
-- correctly separated by purpose:
--
--   avatars            public   profile images, owner-only writes   (public read is intended)
--   admin-content      public   editorial images, staff-only writes (public read is intended;
--                               article images must embed on other sites)
--   resource-files     private  student resource uploads + admin PDF bank, signed URLs only
--   campus-uploads     private  student campus attachments, signed URLs only
--   past-questions     private  question-import documents, staff only, no client policies
--   edureach-resources private  legacy upload bucket, owner/approved-resource reads
--
-- The gap this candidate closes is not visibility — every application write path
-- already validates the declared type against the file's bytes, caps the size and
-- refuses to overwrite an object. The gap is that the *bucket* enforces none of
-- that, so a future route (or a direct service-role call) is unconstrained. Adding
-- the bucket-level guardrail makes the browser's rules the second line rather than
-- the only one.
--
-- Why this is a candidate and not a migration:
--   * `file_size_limit` applies to new uploads only, but it must be larger than
--     every legitimate existing workflow. The question-import path accepts
--     multi-megabyte PDFs, so 25 MB is chosen for those two buckets; the
--     editorial image path caps at 2 MB in code and is set to 10 MB here.
--   * If any existing workflow uploads a larger file, this will start rejecting it
--     with a 413 from Storage. Confirm the limits against real usage before
--     applying, and keep the application-level limits as they are (they are
--     stricter and give a better error message).
--
-- Verification after applying (read-only):
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
--   -- then re-run the upload paths: profile image, resource upload, admin PDF bank,
--   -- question-import document.

begin;

update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic']
 where id = 'avatars';

update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'admin-content';

update storage.buckets
   set file_size_limit = 25 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'image/png',
         'image/jpeg'
       ]
 where id in ('resource-files', 'past-questions');

update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'campus-uploads';

commit;
