-- Post-merge data control (2026-09-27).
--
-- Purpose: enforce the real-data policy on the production database.
--
--  1. Remove the prototype news rows seeded by
--     20260915_application_integration_seed.sql ("This is seeded prototype
--     content…"). Those rows were local-integration fixtures; they must not
--     be presented as real news on the public site. Every published article
--     after this point is created through the Admin Newsroom CMS.
--  2. Deactivate seeded/demo CBT exams so prototype question banks no longer
--     appear as production question banks.
--  3. Purge any third-party Scribd URLs from content-bearing records.
--  4. Add the news CMS columns required by the upgraded Newsroom.

-- 1. Prototype news cleanup -------------------------------------------------
delete from public.news_articles
 where slug in ('jamb-update', 'admission-watch', 'funding-alerts')
    or body ilike '%seeded prototype content%';

-- 2. Prototype/demo CBT exam deactivation ----------------------------------
-- Match the actual seeded records ("JAMB UTME Demo Practice",
-- "Post-UTME Demo Practice") as well as future demo-labelled variants.
update public.cbt_exams
   set is_active = false,
       updated_at = now()
 where is_active = true
   and (
     lower(title) like '%practice demo%'
     or lower(title) like '%demo%'
     or lower(coalesce(subject, '')) like '%demo%'
   );

-- 3. Scribd URL purge --------------------------------------------------------
do $$
begin
  if to_regclass('public.news_articles') is not null then
    update public.news_articles set source_url = null
      where source_url ilike '%scribd.com%';
    update public.news_articles set image_url = null
      where image_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.service_catalog') is not null then
    update public.service_catalog set application_url = null
      where application_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.opportunities') is not null then
    update public.opportunities set link_url = null
      where link_url ilike '%scribd.com%';
  end if;

  if to_regclass('public.institutions') is not null then
    update public.institutions set website_url = null
      where website_url ilike '%scribd.com%';
  end if;
end $$;

-- 4. News CMS upgrades -------------------------------------------------------
do $$
begin
  if to_regclass('public.news_articles') is not null then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'news_articles'
         and column_name = 'featured'
    ) then
      alter table public.news_articles add column featured boolean not null default false;
    end if;

    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'news_articles'
         and column_name = 'tags'
    ) then
      alter table public.news_articles add column tags text;
    end if;
  end if;
end $$;

create index if not exists news_articles_featured_idx
  on public.news_articles (published, featured desc, published_at desc);
