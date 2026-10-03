-- NEWS-1 — one canonical category for every article.
--
-- The defect this fixes, seen in production: `/news?category=scholarships`
-- returned "No announcements found matching this category" while a live
-- Scholarships & Funding article existed. The editor writes a *label*
-- ("Scholarships & Funding", "NABTEB") into `news_articles.category`, the page
-- filters by *slug* ("scholarships", "nabteb"), and the two only matched when
-- they happened to be spelled the same. There is no CHECK on the column, so
-- both spellings coexist in real data.
--
-- The fix is at the data-contract level, not in the rendered page: a derived,
-- indexed `category_slug` column computed by one immutable function that both
-- the database and the application use. Existing rows get the right slug at
-- read time without a backfill, new rows cannot avoid it, and the client keeps
-- working against an older payload because it applies the same rule.

create or replace function public.news_category_slug(p_category text)
returns text
language sql
immutable
as $fn$
  select case
    -- Known labels whose canonical slug is not just "lowercase with dashes".
    -- Keys are the normalised form (lowercase, punctuation collapsed to dashes),
    -- because that is what the expression above produces.
    when slug in ('scholarships-funding', 'scholarship-funding', 'scholarships-and-funding', 'funding', 'grant', 'grants', 'scholarship', 'scholarships') then 'scholarships'
    when slug in ('admission', 'admissions') then 'admissions'
    when slug in ('campus', 'campus-updates', 'school-updates', 'school-update') then 'school-updates'
    when slug in ('results', 'result', 'exam-updates', 'exam-update', 'examination-updates', 'examination-update') then 'examination-updates'
    when slug in ('utme', 'jamb-utme', 'jamb-and-utme', 'jamb') then 'jamb'
    when slug in ('post-utme', 'postutme') then 'post-utme'
    when slug in ('college-of-education', 'colleges-of-education') then 'colleges-of-education'
    when slug in ('university', 'universities') then 'universities'
    when slug in ('polytechnic', 'polytechnics') then 'polytechnics'
    when slug in ('general', 'general-education', 'education') then 'general'
    when slug = '' then 'general'
    else slug
  end
  from (
    select coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(coalesce(p_category, '')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'general'
    ) as slug
  ) normalized;
$fn$;

comment on function public.news_category_slug(text) is
  'Canonical news category slug. Immutable on purpose: it is used by a generated column.';

-- Derived, so it can never drift from the stored label, and indexed, so the
-- public filter is an index lookup rather than a scan over every article.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'news_articles' and column_name = 'category_slug'
  ) then
    alter table public.news_articles
      add column category_slug text generated always as (public.news_category_slug(category)) stored;
  end if;
end $$;

create index if not exists news_articles_category_slug_idx
  on public.news_articles (category_slug);

-- The public read policy already governs the table; the derived column adds no
-- new surface. Nothing else in the RLS posture changes.
