-- Post-merge data control (2026-09-27).
--
-- Purpose: enforce the real-data policy on the production database.
--
--  1. Remove the prototype news rows seeded by
--     20260915_application_integration_seed.sql ("This is seeded prototype
--     content…"). Those rows were local-integration fixtures; they must not
--     be presented as real news on the public site. Every published article
--     after this point is created through the Admin Newsroom CMS.
--  2. Deactivate the seeded "EduReach General Practice Demo" CBT exam so a
--     prototype question bank no longer appears as a production question
--     bank. It is deactivated (not deleted) so an administrator can inspect
--     or remove it from the CBT Manager.
--  3. Purge any third-party Scribd URLs from content-bearing records. The
--     EduReach past-question experience no longer depends on Scribd.
--  4. Add the news CMS columns required by the upgraded Newsroom:
--     featured (editorial feature control) and tags.

-- 1. Prototype news cleanup -------------------------------------------------
-- The seed used fixed slugs and an explicit prototype marker in the body.
-- Match both so clones of the seed are removed as well.
delete from public.news_articles
 where slug in ('jamb-update', 'admission-watch', 'funding-alerts')
    or body ilike '%seeded prototype content%';

-- 2. Prototype CBT exam deactivation ---------------------------------------
update public.cbt_exams
   set is_active = false,
       updated_at = now()
 where lower(title) like '%practice demo%'
   and is_active = true;

-- 3. Scribd URL purge --------------------------------------------------------
-- No migration ever seeded Scribd URLs, but live rows are edited through the
-- admin console and may pre-date this policy. Neutralise any stored Scribd
-- reference instead of sending students to a third-party reading platform.
do $$
begin
  if to_regclass('public.news_articles') is not null then
    update public.news_articles
       set source_url = null
     where source_url ilike '%scribd.com%';
    update public.news_articles
       set image_url = null
     where image_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.service_catalog') is not null then
    update public.service_catalog
       set application_url = null
     where application_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.opportunities') is not null then
    update public.opportunities
       set link_url = null
     where link_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.institutions') is not null then
    update public.institutions
       set website_url = null
     where website_url ilike '%scribd.com%';
  end if;
end $$;

-- 4. News CMS upgrades -------------------------------------------------------
-- Guarded column adds: additive + nullable/defaulted, so a live table keeps
-- working unchanged.
do $$
begin
  if to_regclass('public.news_articles') is not null then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'news_articles' and column_name = 'featured'
    ) then
      alter table public.news_articles add column featured boolean not null default false;
    end if;

    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'news_articles' and column_name = 'tags'
    ) then
      alter table public.news_articles add column tags text;
    end if;
  end if;
end $$;

-- Support admin ordering/feature queries without changing existing reads.
create index if not exists news_articles_featured_idx
  on public.news_articles (published, featured desc, published_at desc);
