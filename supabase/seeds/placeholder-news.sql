-- OPTIONAL, MANUAL SEED. Never run automatically in a migration or deploy.
-- Review the proposed row and target project first. Production requires explicit
-- owner approval. Re-running preserves rows matching either the stable ID or
-- the slug, even if an editor changed the slug; deletion permits reseeding.
-- This is a single unpublished editorial prompt, not a real announcement.
begin;

insert into public.news_articles
  (id, slug, title, excerpt, body, category, published, featured, is_placeholder, placeholder_note)
values
  ('c1e1aedc-8c48-4a6a-a3ea-431ac7856918', 'edureach-placeholder-news-draft',
   '[PLACEHOLDER] Verified education update required',
   '[PLACEHOLDER: Add a verified student-relevant update and its source.]',
   '<p>[PLACEHOLDER: Replace this draft with a genuine education update, verify the details and provide the source before publication.]</p>',
   'general', false, false, true,
   'A genuine student-relevant update, verified details and source are required.')
on conflict do nothing;

commit;
