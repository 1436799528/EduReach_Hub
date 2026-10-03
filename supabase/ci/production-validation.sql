-- D5 — production schema / RLS / storage validation.
--
-- This is the half of `npm run prod:validate` that a service-role PostgREST client
-- cannot perform: `information_schema` and `pg_catalog` need a real SQL connection.
-- Run it in the Supabase SQL editor (or any psql session against the project) and
-- compare the output with the expectations below. It is strictly read-only: every
-- statement is a SELECT, nothing is created, altered, or deleted.
--
-- The script prints a row per check with `pass` / `fail` in the first column, so a
-- human can scan it and a deploy gate can grep for `fail`.
--
-- Expectations are generated from the same source the rest of the repository uses:
-- the table list and access classification in `scripts/rls-posture.ts`, the
-- function list in `scripts/prod-validate.ts` (EXPECTED_FUNCTIONS), and the bucket
-- list in EXPECTED_BUCKETS.

\set ON_ERROR_STOP on

-- 1. Every classified table exists -------------------------------------------
with expected(table_name) as (
  values
    ('institutions'),('service_catalog'),('service_requests'),('past_questions'),
    ('courses'),('resources'),('campus_posts'),('campus_post_comments'),
    ('campus_post_likes'),('edureach_notifications'),('student_notifications'),
    ('student_saved_items'),('student_cgpa_terms'),('student_cgpa_courses'),
    ('student_wallets'),('student_wallet_transactions'),('student_security_events'),
    ('student_profiles'),('profiles'),('cbt_exams'),('exam_questions'),
    ('cbt_attempts'),('cbt_answers'),('news_articles'),('news_sources'),
    ('news_ingest_runs'),('news_ingest_candidates'),('opportunities'),
    ('admin_audit_logs'),('site_analytics_events'),('rate_limit_hits'),
    ('payment_events'),('edureach_material_notes'),('edureach_audit_logs'),
    ('edureach_deadlines')
)
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every classified table exists' as check_name,
  coalesce(string_agg(table_name, ', '), 'all present') as detail
from expected
where table_name not in (
  select table_name from information_schema.tables where table_schema = 'public'
);

-- 2. RLS is enabled on every table -------------------------------------------
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'row level security is enabled on every public table' as check_name,
  coalesce(string_agg(c.relname, ', '), 'all enabled') as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;

-- 3. No application function is executable by a client role -------------------
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'no application function is granted to anon or authenticated' as check_name,
  coalesce(string_agg(distinct p.proname, ', '), 'none granted') as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles g on g.oid = a.grantee
where n.nspname = 'public'
  and g.rolname in ('anon', 'authenticated')
  and a.privilege_type = 'EXECUTE'
  and p.proname in (
    'handle_new_user','admin_audit_log','admin_dashboard_metrics',
    'admin_activity_breakdown','admin_bootstrap_first_admin','check_rate_limit',
    'close_expired_opportunities','content_integrity_report','expire_stale_news',
    'get_cbt_questions','get_cbt_questions_for_subjects','get_cbt_result',
    'get_public_service_request','is_staff','is_staff_user',
    'prune_site_analytics_events','set_service_reference_code',
    'start_cbt_attempt_for_subjects'
  );

-- 4. Every function the application calls exists -----------------------------
with expected(fn) as (
  values
    ('handle_new_user'),('admin_audit_log'),('admin_dashboard_metrics'),
    ('admin_activity_breakdown'),('admin_bootstrap_first_admin'),('check_rate_limit'),
    ('close_expired_opportunities'),('content_integrity_report'),('expire_stale_news'),
    ('get_cbt_questions'),('get_cbt_questions_for_subjects'),('get_cbt_result'),
    ('get_public_service_request'),('is_staff'),('is_staff_user'),
    ('prune_site_analytics_events'),('set_service_reference_code'),
    ('start_cbt_attempt_for_subjects')
)
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every function the application calls exists' as check_name,
  coalesce(string_agg(fn, ', '), 'all present') as detail
from expected
where not exists (
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = expected.fn
);

-- 5. Server-only tables expose no client-facing policy -----------------------
with server_only(table_name) as (
  values ('site_analytics_events'),('admin_audit_logs'),('edureach_audit_logs'),
         ('student_wallets'),('payment_events'),('rate_limit_hits'),
         ('news_ingest_runs'),('news_ingest_candidates')
)
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'server-only tables expose no client-facing policy' as check_name,
  coalesce(string_agg(distinct s.table_name, ', '), 'none exposed') as detail
from server_only s
join pg_policies p on p.schemaname = 'public' and p.tablename = s.table_name;

-- 6. The analytics table is closed to client roles ---------------------------
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'site_analytics_events grants nothing to anon or authenticated' as check_name,
  coalesce(string_agg(distinct g.rolname, ', '), 'no client grants') as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
join pg_roles g on g.oid = a.grantee
where n.nspname = 'public'
  and c.relname = 'site_analytics_events'
  and g.rolname in ('anon', 'authenticated');

-- 7. Storage buckets exist, and each has the read access the app needs --------
-- Intent comes from scripts/prod-validate.ts (PUBLIC_BUCKETS / PRIVATE_BUCKETS).
-- `admin-content` is public *by design*: the admin upload route returns
-- getPublicUrl(...) and the URL is stored on the published article row, so a
-- private bucket would 404 every published news image. `resource-files` and
-- `campus-uploads` hold gated content and must stay private.
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'application buckets exist and match their declared read access' as check_name,
  coalesce(string_agg(expected.name || ' (' || coalesce(b.public::text, 'missing') || ')', ', '),
           'all present, admin-content public by design, the rest private') as detail
from (values ('admin-content', true), ('resource-files', false), ('campus-uploads', false)) as expected(name, should_be_public)
left join storage.buckets b on b.id = expected.name
where b.id is null or b.public is distinct from expected.should_be_public;

-- 8. The migration history is fully applied ----------------------------------
-- Keep the number in step with `ls supabase/migrations/*.sql | wc -l`.
select
  case when count(*) >= 46 then 'pass' else 'fail' end as result,
  'the migration history is applied' as check_name,
  count(*)::text || ' migrations recorded (repository holds 46)' as detail
from supabase_migrations.schema_migrations;

-- 9. The objects this release introduces are present -------------------------
-- Check 8 counts rows in the migration history, which answers "how many?" but not
-- "which?". This is the sync check: it names each object the 2026-10-02/03 release
-- adds, so a partially applied production database is visible in one query. It is
-- read-only and safe to run at any time.
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every object added by the 2026-10-02/03 release exists' as check_name,
  coalesce(string_agg(missing.object || ' — apply ' || missing.migration, '; '),
           'CBT modes, news category slug, past-question library and opportunity eligibility all present') as detail
from (
  select 'public.cbt_attempts.mode' as object, '20261002120000_cbt_practice_and_mock_modes.sql' as migration
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'cbt_attempts' and column_name = 'mode')
  union all
  select 'public.plan_cbt_paper()', '20261002120000_cbt_practice_and_mock_modes.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'plan_cbt_paper')
  union all
  select 'public.get_cbt_attempt_history()', '20261002120000_cbt_practice_and_mock_modes.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'get_cbt_attempt_history')
  union all
  select 'public.news_category_slug()', '20261002130000_news_category_contract.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'news_category_slug')
  union all
  select 'public.news_articles.category_slug', '20261002130000_news_category_contract.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'news_articles' and column_name = 'category_slug')
  union all
  select 'public.past_question_resources', '20261002140000_past_question_resources.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'past_question_resources')
  union all
  select 'public.past_question_coverage()', '20261002140000_past_question_resources.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'past_question_coverage')
  union all
  -- The live API drops back to a legacy field set when these two are missing,
  -- which silently removes provenance from every public listing.
  select 'public.opportunities.last_verified_at', '20260930120000_newsroom_ingestion_pipeline.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'opportunities' and column_name = 'last_verified_at')
  union all
  select 'public.opportunities.source_name', '20260930120000_newsroom_ingestion_pipeline.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'opportunities' and column_name = 'source_name')
  union all
  select 'public.opportunities.eligibility', '20261002150000_opportunity_eligibility.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'opportunities' and column_name = 'eligibility')
) as missing;

-- 10. Data quality, from the database's own report -----------------------------
-- content_integrity_report() is service-role only; in the SQL editor it runs as
-- postgres and returns the same JSON the admin console reads.
select
  'info' as result,
  'content integrity report' as check_name,
  jsonb_pretty(public.content_integrity_report()) as detail;
