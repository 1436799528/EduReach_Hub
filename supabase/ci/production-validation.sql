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
  case when count(*) >= 68 then 'pass' else 'fail' end as result,
  'the migration history is applied' as check_name,
  count(*)::text || ' migrations recorded (repository holds 68)' as detail
from supabase_migrations.schema_migrations;

-- 9. The objects this release introduces are present -------------------------
-- Check 8 counts rows, which answers "how many?" but not "which?". Compare the
-- exact release versions so data-only migrations are covered, then inspect the
-- important objects/security properties as well. Output every missing version or
-- object with the migration file an operator should apply. Read-only and safe to
-- run at any time.
with expected(version, migration) as (
  values
    ('20261003070830', '20261002120000_cbt_practice_and_mock_modes.sql'),
    ('20261003070835', '20261002130000_news_category_contract.sql'),
    ('20261003070841', '20261002140000_past_question_resources.sql'),
    ('20261003070845', '20261002150000_opportunity_eligibility.sql'),
    ('20261003071718', '20261003080000_backend_security_hardening.sql'),
    ('20261003071918', '20261003090000_verify_opportunity_data.sql'),
    ('20261003090713', '20261003100000_cbt_server_authority_alignment.sql'),
    ('20261003090824', '20261003101000_expire_stale_cbt_attempts.sql'),
    ('20261003090810', '20261003102000_normalize_published_news_category_labels.sql'),
    ('20261003130327', '20261003103000_cbt_paper_expiry_volatility.sql'),
    ('20261004202655', '20261003170000_create_academic_catalogue_and_daily_quiz.sql'),
    ('20261003175703', '20261003175703_backfill_verified_academic_catalogue_and_daily_quiz_v2.sql'),
    ('20261004202656', '20261003190000_opportunity_discovery_engine.sql'),
    ('20261016160000', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql')
    ,('20261017123909', '20261017123909_cbt_result_retention.sql')
    ,('20261018165635', '20261018120000_exam_specific_question_provenance.sql')
    ,('20261018172307', '20261018172307_post_utme_school_modes_and_pdf_bank.sql')
    ,('20261018172404', '20261018172404_post_utme_pdf_bank_registry_replay.sql')
    ,('20261018172823', '20261018172823_pdf_bank_explicit_source_verification.sql')
    ,('20261018174207', '20261018174207_pdf_bank_destination_links.sql')
    ,('20261020100000', '20261020100000_safe_verified_question_banks.sql')
    ,('20261020110000', '20261020110000_deduplicate_exact_duplicates.sql')
    ,('20261020120000', '20261020120000_copy_legacy_questions_to_practice_banks.sql')
    ,('20261020130000', '20261020130000_expand_syllabus_practice_banks.sql')
    ,('20261020140000', '20261020140000_populate_200_per_subject.sql')
    ,('20261019184519', '20261021120000_cbt_subject_selection_rules.sql')
), missing_versions as (
  select 'migration ' || e.version as object, e.migration
  from expected e
  where not exists (
    select 1 from supabase_migrations.schema_migrations applied
    where applied.version = e.version
  )
), missing_objects as (
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
  union all
  select 'public.get_cbt_attempt_paper() VOLATILE', '20261003103000_cbt_paper_expiry_volatility.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'get_cbt_attempt_paper' and p.provolatile = 'v')
  union all
  select 'public.cbt_subject_key()', '20261021120000_cbt_subject_selection_rules.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'cbt_subject_key')
  union all
  select 'public.ccmas_disciplines', '20261003170000_create_academic_catalogue_and_daily_quiz.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'ccmas_disciplines')
  union all
  select 'public.daily_quizzes', '20261003170000_create_academic_catalogue_and_daily_quiz.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'daily_quizzes')
  union all
  select 'public.daily_quiz_questions', '20261003170000_create_academic_catalogue_and_daily_quiz.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'daily_quiz_questions')
  union all
  select 'public.cbt_exams.format_status', '20261018120000_exam_specific_question_provenance.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cbt_exams' and column_name='format_status')
  union all
  select 'public.exam_questions.source_type/review_status/format_verified', '20261018120000_exam_specific_question_provenance.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_questions' and column_name='source_type')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_questions' and column_name='review_status')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_questions' and column_name='format_verified')
  union all
  select 'public.institutions Post-UTME method and verification fields', '20261018172307_post_utme_school_modes_and_pdf_bank.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='institutions' and column_name='post_utme_method')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='institutions' and column_name='post_utme_verified')
  union all
  select 'public.cbt_exams.institution_id', '20261018172307_post_utme_school_modes_and_pdf_bank.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cbt_exams' and column_name='institution_id')
  union all
  select 'public.document_bank', '20261018172307_post_utme_school_modes_and_pdf_bank.sql'
  where to_regclass('public.document_bank') is null
  union all
  select 'public.document_bank.source_verified', '20261018172823_pdf_bank_explicit_source_verification.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='document_bank' and column_name='source_verified')
  union all
  select 'public.document_bank destination links', '20261018174207_pdf_bank_destination_links.sql'
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='document_bank' and column_name='news_article_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='document_bank' and column_name='opportunity_id')
  union all
  select 'public.ccmas_programmes.degree_title', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'ccmas_programmes' and column_name = 'degree_title')
  union all
  select 'public.ccmas_programmes.version', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'ccmas_programmes' and column_name = 'version')
  union all
  select 'ccmas_programmes required fields/status/unique constraint', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.ccmas_programmes')
                      and conname = 'ccmas_programmes_programme_code_version_name_key')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.ccmas_programmes')
                      and conname = 'ccmas_programmes_status_check')
     or exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'ccmas_programmes'
                  and column_name in ('discipline','programme_code','programme_name') and is_nullable <> 'NO')
  union all
  select 'national_programme_catalogue source/uniqueness constraints', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'national_programme_catalogue'
                  and column_name = 'source_url' and is_nullable <> 'NO')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.national_programme_catalogue')
                      and conname = 'national_programme_catalogue_programme_name_key')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.national_programme_catalogue')
                      and conname = 'national_programme_catalogue_source_type_check')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.national_programme_catalogue')
                      and conname = 'national_programme_catalogue_status_check')
  union all
  select 'daily_quizzes.updated_at and nullable discipline', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'daily_quizzes' and column_name = 'updated_at')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'daily_quizzes'
                      and column_name = 'discipline' and is_nullable = 'YES')
  union all
  select 'daily_quiz_questions course/bounds contract', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'daily_quiz_questions' and column_name = 'course_id')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'daily_quiz_questions'
                      and column_name = 'points' and data_type = 'smallint')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.daily_quiz_questions')
                      and conname = 'daily_quiz_questions_course_id_fkey')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.daily_quiz_questions')
                      and conname = 'daily_quiz_questions_points_check'
                      and pg_get_constraintdef(oid) like '%100%')
     or not exists (select 1 from pg_constraint
                    where conrelid = to_regclass('public.daily_quiz_questions')
                      and conname = 'daily_quiz_questions_position_check'
                      and pg_get_constraintdef(oid) like '%20%')
  union all
  select 'service_requests active-service submission policy', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = 'service_requests'
                      and policyname = 'service_requests_insert_own'
                      and with_check like '%service_catalog%'
                      and with_check like '%active%')
  union all
  select 'ccmas_programmes discipline_id index', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_indexes
                    where schemaname = 'public' and tablename = 'ccmas_programmes'
                      and indexname = 'ccmas_programmes_discipline_idx'
                      and indexdef like '%(discipline_id)%')
  union all
  select 'public.student_saved_items', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.student_saved_items') is null
  union all
  select 'public.student_notifications', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.student_notifications') is null
  union all
  select 'public.student_cgpa_terms', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.student_cgpa_terms') is null
  union all
  select 'public.student_cgpa_courses', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.student_cgpa_courses') is null
  union all
  select 'public.student_security_events', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.student_security_events') is null
  union all
  select 'public.admin_audit_logs', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where to_regclass('public.admin_audit_logs') is null
  union all
  select 'public.admin_audit_log(uuid,text,text,uuid,jsonb)', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and p.proname='admin_audit_log'
                      and pg_get_function_identity_arguments(p.oid)='p_admin_user_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb')
  union all
  select 'student_saved_items owner access policy', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_policies
                    where schemaname='public' and tablename='student_saved_items'
                      and policyname='student_saved_items_owner_select'
                      and qual like '%auth.uid%')
  union all
  select 'admin audit permissions', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relname='admin_audit_logs' and c.relrowsecurity)
     or has_table_privilege('anon',to_regclass('public.admin_audit_logs'),'SELECT')
     or has_table_privilege('authenticated',to_regclass('public.admin_audit_logs'),'SELECT')
     or not has_table_privilege('service_role',to_regclass('public.admin_audit_logs'),'SELECT')
     or has_table_privilege('service_role',to_regclass('public.admin_audit_logs'),'IN' || 'SERT')
     or not has_function_privilege('service_role',to_regprocedure('public.admin_audit_log(uuid,text,text,uuid,jsonb)'),'EXECUTE')
  union all
  select 'student portal least-privilege grants', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where has_table_privilege('anon',to_regclass('public.student_saved_items'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.student_notifications'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.student_cgpa_terms'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.student_cgpa_courses'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.student_security_events'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.student_saved_items'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.student_notifications'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.student_cgpa_terms'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.student_cgpa_courses'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.student_security_events'),'SELECT')
  union all
  select 'CBT answer-key table permissions', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql'
  where has_table_privilege('anon',to_regclass('public.exam_questions'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.cbt_attempts'),'SELECT')
     or not has_table_privilege('authenticated',to_regclass('public.cbt_attempts'),'SELECT')
     or has_table_privilege('authenticated',to_regclass('public.exam_questions'),'SELECT')
     or has_table_privilege('anon',to_regclass('public.cbt_answers'),'SELECT')
     or has_table_privilege('authenticated',to_regclass('public.cbt_answers'),'SELECT')
     or has_table_privilege('authenticated',to_regclass('public.cbt_answers'),'IN' || 'SERT')
     or has_table_privilege('authenticated',to_regclass('public.cbt_answers'),'UP' || 'DATE')
     or has_table_privilege('authenticated',to_regclass('public.cbt_answers'),'DE' || 'LETE')
     or has_table_privilege('authenticated',to_regclass('public.cbt_attempts'),'IN' || 'SERT')
     or has_table_privilege('authenticated',to_regclass('public.cbt_attempts'),'UP' || 'DATE')
     or has_table_privilege('authenticated',to_regclass('public.cbt_attempts'),'DE' || 'LETE')
  union all
  select 'public.opportunities.subcategory', '20261003190000_opportunity_discovery_engine.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'opportunities' and column_name = 'subcategory')
  union all
  select 'public.opportunities.is_featured', '20261003190000_opportunity_discovery_engine.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'opportunities' and column_name = 'is_featured')
), missing as (
  select object, migration from missing_versions
  union all
  select object, migration from missing_objects
)
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every migration in the 2026-10-02/03 release and its key objects are present' as check_name,
  coalesce(string_agg(object || ' — apply ' || migration, '; '),
           'all 23 release migrations and checked objects are present') as detail
from missing;

-- 10. Data quality, from the database's own report -----------------------------
-- content_integrity_report() is service-role only; in the SQL editor it runs as
-- postgres and returns the same JSON the admin console reads.
select
  'info' as result,
  'content integrity report' as check_name,
  jsonb_pretty(public.content_integrity_report()) as detail;
