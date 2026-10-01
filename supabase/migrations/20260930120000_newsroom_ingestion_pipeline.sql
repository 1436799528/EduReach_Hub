-- EduReach newsroom ingestion pipeline + content governance.
--
-- Adds the operational layer the platform was missing: a source registry with
-- health tracking, ingestion runs with per-run reporting, an editorial review
-- queue, provenance/freshness columns on news_articles, durable rate limiting
-- for high-risk public endpoints, and a content integrity report.
--
-- Guarded throughout (`to_regclass` / `if not exists`) so it is safe to apply
-- on the live project and safe to re-run. No existing row is deleted or
-- rewritten; all news_articles columns added here are nullable or defaulted.

-- ---------------------------------------------------------------------------
-- 1. Source registry
--    The catalogue of known sources lives in code (src/server/newsroom/
--    sources.ts) and is upserted on each run so the names/tiers stay
--    maintainable in review. Operational state (feed_url, discovery mode,
--    is_active, health) lives here and is never overwritten by that sync.
-- ---------------------------------------------------------------------------
create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  homepage text,
  feed_url text,
  -- Tier 1 = primary official source, 2 = established reporting,
  -- 3 = secondary/aggregator, 4 = social discovery only.
  tier int not null default 2 check (tier between 1 and 4),
  -- 'auto' uses feed_url when configured and falls back to HTML discovery.
  discovery text not null default 'auto' check (discovery in ('auto', 'rss', 'html')),
  category_hint text,
  trust_score numeric not null default 0.5 check (trust_score >= 0 and trust_score <= 1),
  -- Operator-owned: the code catalogue sync never rewrites this row's
  -- feed_url/discovery/is_active/notes when is_managed is false.
  is_managed boolean not null default true,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_status text,
  last_error text,
  consecutive_failures int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_sources_active_idx on public.news_sources (is_active, tier);

-- ---------------------------------------------------------------------------
-- 2. Ingestion runs — one row per pipeline execution, with the daily report.
-- ---------------------------------------------------------------------------
create table if not exists public.news_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  triggered_by text not null default 'schedule'
    check (triggered_by in ('schedule', 'admin', 'cli', 'manual')),
  dry_run boolean not null default false,
  sources_checked int not null default 0,
  sources_failed int not null default 0,
  candidates_found int not null default 0,
  duplicates int not null default 0,
  rejected int not null default 0,
  needs_review int not null default 0,
  published int not null default 0,
  images_repaired int not null default 0,
  expired int not null default 0,
  report jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists news_ingest_runs_started_idx
  on public.news_ingest_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- 3. Candidates — discovery, dedupe and editorial review queue in one table.
-- ---------------------------------------------------------------------------
create table if not exists public.news_ingest_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.news_ingest_runs(id) on delete set null,
  source_key text not null,
  source_name text,
  source_tier int not null default 2,
  source_url text not null,
  canonical_url text not null,
  title text not null,
  excerpt text,
  body text,
  image_url text,
  category text not null default 'general',
  tags text,
  source_published_at timestamptz,
  content_hash text,
  dedupe_key text,
  relevance_score numeric not null default 0,
  quality_score numeric not null default 0,
  quality_flags jsonb not null default '[]'::jsonb,
  review_notes text,
  -- duplicate = collided with an existing article or an earlier candidate in
  -- the same run; rejected = failed the quality/relevance gate outright.
  status text not null default 'new'
    check (status in ('new', 'needs_review', 'approved', 'rejected', 'duplicate', 'published', 'failed')),
  rejection_reason text,
  matched_article_id uuid references public.news_articles(id) on delete set null,
  article_id uuid references public.news_articles(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_ingest_candidates_status_idx
  on public.news_ingest_candidates (status, created_at desc);
create index if not exists news_ingest_candidates_dedupe_idx
  on public.news_ingest_candidates (dedupe_key);
create index if not exists news_ingest_candidates_canonical_idx
  on public.news_ingest_candidates (canonical_url);

-- ---------------------------------------------------------------------------
-- 4. news_articles governance columns (provenance + freshness).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.news_articles') is not null then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'source_key') then
      alter table public.news_articles add column source_key text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'source_tier') then
      alter table public.news_articles add column source_tier int;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'source_published_at') then
      alter table public.news_articles add column source_published_at timestamptz;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'last_verified_at') then
      alter table public.news_articles add column last_verified_at timestamptz;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'verification_status') then
      alter table public.news_articles
        add column verification_status text not null default 'verified'
        check (verification_status in ('verified', 'needs_review', 'expired', 'superseded', 'corrected', 'archived'));
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'expires_at') then
      alter table public.news_articles add column expires_at timestamptz;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'content_hash') then
      alter table public.news_articles add column content_hash text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'dedupe_key') then
      alter table public.news_articles add column dedupe_key text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'ingest_candidate_id') then
      alter table public.news_articles add column ingest_candidate_id uuid;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'news_articles'
                     and column_name = 'review_status') then
      alter table public.news_articles add column review_status text not null default 'editorial';
    end if;
  end if;
end $$;

-- Dedupe key uniqueness is the hard backstop: even a concurrent run cannot
-- insert the same story twice, and it is safe while legacy rows have null keys.
do $$
begin
  if to_regclass('public.news_articles') is not null then
    execute 'create unique index if not exists news_articles_dedupe_key_idx
               on public.news_articles (dedupe_key) where dedupe_key is not null';
    execute 'create index if not exists news_articles_verification_idx
               on public.news_articles (published, verification_status, published_at desc)';
    execute 'create index if not exists news_articles_expiry_idx
               on public.news_articles (expires_at) where expires_at is not null';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RLS: pipeline tables are server-only. RLS on with no policy for
--    anon/authenticated is a deny-all for the browser keys, and the explicit
--    revokes document that intent for future migrations.
-- ---------------------------------------------------------------------------
alter table public.news_sources enable row level security;
alter table public.news_ingest_runs enable row level security;
alter table public.news_ingest_candidates enable row level security;

revoke all on table public.news_sources from public, anon, authenticated;
revoke all on table public.news_ingest_runs from public, anon, authenticated;
revoke all on table public.news_ingest_candidates from public, anon, authenticated;
grant all on table public.news_sources to service_role;
grant all on table public.news_ingest_runs to service_role;
grant all on table public.news_ingest_candidates to service_role;

-- ---------------------------------------------------------------------------
-- 6. Content freshness: expire time-sensitive articles explicitly rather than
--    leaving them published-but-stale.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_news()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
begin
  if to_regclass('public.news_articles') is null then
    return 0;
  end if;

  update public.news_articles
     set verification_status = 'expired',
         updated_at = now()
   where expires_at is not null
     and expires_at < now()
     and verification_status in ('verified', 'needs_review')
     and published is true;

  get diagnostics v_expired = row_count;
  return v_expired;
end $$;

revoke all on function public.expire_stale_news() from public, anon, authenticated;
grant execute on function public.expire_stale_news() to service_role;

-- ---------------------------------------------------------------------------
-- 7. Durable rate limiting.
--    Serverless instances cannot share memory, so the high-risk endpoints
--    (admin bootstrap, guest CBT scoring, content import, uploads, analytics,
--    newsroom runs) count hits in the database instead.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  window_start timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (bucket, window_start desc);

alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from public, anon, authenticated;
grant all on table public.rate_limit_hits to service_role;

-- Returns true when the caller is still within the allowance. Fails closed
-- only on unexpected errors; the caller treats a missing function as "no
-- durable limiter" and keeps the in-process limiter active.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
  v_count integer;
begin
  if p_limit is null or p_limit <= 0 then
    return false;
  end if;

  -- Opportunistic cleanup keeps the table small without a separate cron job.
  delete from public.rate_limit_hits
   where window_start < now() - interval '1 day';

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and window_start >= v_window_start;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end $$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Content integrity report (audit §43).
--    Repository state is not production state; this is how the running
--    database reports on itself. Read-only, service-role only.
-- ---------------------------------------------------------------------------
create or replace function public.content_integrity_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_news jsonb := '{}'::jsonb;
  v_cbt jsonb := '{}'::jsonb;
  v_opportunities jsonb := '{}'::jsonb;
  v_institutions jsonb := '{}'::jsonb;
begin
  if to_regclass('public.news_articles') is not null then
    execute $q$
      select jsonb_build_object(
        'published_total', count(*) filter (where published is true),
        'published_missing_source', count(*) filter (where published is true and coalesce(source_url, '') = ''),
        'published_non_https_source', count(*) filter (where published is true and source_url is not null and source_url <> '' and source_url not like 'https://%'),
        'published_expired', count(*) filter (where published is true and verification_status = 'expired'),
        'published_expiring_soon', count(*) filter (where published is true and expires_at is not null and expires_at between now() and now() + interval '7 days'),
        'duplicate_dedupe_keys', coalesce((select count(*) from (
            select dedupe_key from public.news_articles
             where dedupe_key is not null group by dedupe_key having count(*) > 1
          ) d), 0),
        'unknown_categories', count(*) filter (where published is true and category not in (
            'jamb','waec','neco','nabteb','admissions','admission','universities','polytechnics',
            'colleges-of-education','scholarships','funding','nelfund','post-utme','school-updates',
            'campus','examination-updates','results','academic-calendar','general'))
      ) from public.news_articles
    $q$ into v_news;
  end if;

  if to_regclass('public.cbt_exams') is not null and to_regclass('public.exam_questions') is not null then
    execute $q$
      select jsonb_build_object(
        'active_exams', (select count(*) from public.cbt_exams where is_active is true),
        'active_exams_without_questions', (
          select count(*) from public.cbt_exams e
           where e.is_active is true
             and not exists (select 1 from public.exam_questions q where q.exam_id = e.id)
        ),
        'questions_missing_options', (
          select count(*) from public.exam_questions q
           where coalesce(q.option_a,'') = '' or coalesce(q.option_b,'') = ''
              or coalesce(q.option_c,'') = '' or coalesce(q.option_d,'') = ''
        ),
        'questions_with_invalid_answer', (
          select count(*) from public.exam_questions q
           where q.correct_option is null or q.correct_option not in ('A','B','C','D')
        ),
        'questions_without_explanation', (
          select count(*) from public.exam_questions q where coalesce(q.explanation,'') = ''
        ),
        'duplicate_positions', coalesce((
          select count(*) from (
            select exam_id, coalesce(subject,''), position
              from public.exam_questions
             group by exam_id, coalesce(subject,''), position
            having count(*) > 1
          ) d
        ), 0),
        'active_exams_below_minimum', coalesce((
          select count(*) from (
            select e.id, count(q.id) as n
              from public.cbt_exams e
              left join public.exam_questions q on q.exam_id = e.id
             where e.is_active is true
             group by e.id
            having count(q.id) < 10
          ) d
        ), 0)
      )
    $q$ into v_cbt;
  end if;

  if to_regclass('public.opportunities') is not null then
    execute $q$
      select jsonb_build_object(
        'active_total', count(*) filter (where is_active is true),
        'active_expired', count(*) filter (where is_active is true and deadline is not null and deadline < current_date),
        'active_without_deadline', count(*) filter (where is_active is true and deadline is null),
        'active_without_link', count(*) filter (where is_active is true and coalesce(link_url, '') = ''),
        'active_non_https_link', count(*) filter (where is_active is true and link_url is not null and link_url <> '' and link_url not like 'https://%'),
        'never_verified', count(*) filter (where is_active is true and last_verified_at is null)
      ) from public.opportunities
    $q$ into v_opportunities;
  end if;

  if to_regclass('public.institutions') is not null then
    -- school_name is the canonical column; guard the optional ones so this
    -- report also runs on a database that predates them.
    execute $q$
      select jsonb_build_object(
        'total', count(*),
        'missing_name', count(*) filter (where coalesce(school_name, '') = ''),
        'duplicate_names', coalesce((
          select count(*) from (
            select lower(trim(school_name)) from public.institutions
             group by lower(trim(school_name)) having count(*) > 1
          ) d
        ), 0),
        'missing_website', count(*) filter (where coalesce(website_url, '') = ''),
        'missing_state', count(*) filter (where coalesce(state, '') = ''),
        'non_https_website', count(*) filter (where website_url is not null and website_url <> '' and website_url not like 'https://%')
      ) from public.institutions
    $q$ into v_institutions;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'news', v_news,
    'cbt', v_cbt,
    'opportunities', v_opportunities,
    'institutions', v_institutions
  );
end $$;

revoke all on function public.content_integrity_report() from public, anon, authenticated;
grant execute on function public.content_integrity_report() to service_role;

-- ---------------------------------------------------------------------------
-- 9. Opportunity freshness: columns the admin console can surface, plus an
--    expiry sweep so students never see a closed scholarship as open.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.opportunities') is not null then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'opportunities'
                     and column_name = 'last_verified_at') then
      alter table public.opportunities add column last_verified_at timestamptz;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'opportunities'
                     and column_name = 'source_name') then
      alter table public.opportunities add column source_name text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'opportunities'
                     and column_name = 'closed_at') then
      alter table public.opportunities add column closed_at timestamptz;
    end if;
  end if;
end $$;

create or replace function public.close_expired_opportunities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
begin
  if to_regclass('public.opportunities') is null then
    return 0;
  end if;

  update public.opportunities
     set is_active = false,
         closed_at = coalesce(closed_at, now()),
         updated_at = now()
   where is_active is true
     and deadline is not null
     and deadline < current_date;

  get diagnostics v_closed = row_count;
  return v_closed;
end $$;

revoke all on function public.close_expired_opportunities() from public, anon, authenticated;
grant execute on function public.close_expired_opportunities() to service_role;
