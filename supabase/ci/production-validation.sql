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
    ('student_profiles'),('profiles'),('cbt_exams'),('cbt_subject_catalog'),('exam_questions'),
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
from (values ('admin-content', true), ('resource-files', false), ('campus-uploads', false), ('past-questions', false)) as expected(name, should_be_public)
left join storage.buckets b on b.id = expected.name
where b.id is null or b.public is distinct from expected.should_be_public;

-- 8. Every migration is accounted for in the live ledger ----------------------
--
-- One statement, three verdicts, because one rule cannot answer this question
-- for every file:
--
--   `every uniquely versioned migration is recorded` — a ledger row with this
--       version, or a row whose name (prefix stripped) matches, is evidence for
--       the file. The live ledger recorded several of these under a later
--       timestamp; the reconciliation document lists them file by file.
--   `every migration sharing a legacy version is individually recorded` — six
--       files share the legacy version `20260903`. A version match is NOT
--       evidence for any of them: one ledger row would make all six look applied,
--       which is the false pass this split removes. These match by name only.
--   `migrations with no ledger evidence are never reported as applied` — a file
--       the reconciliation document could not match to any ledger row is
--       `unresolved` while that evidence is missing, and becomes `pass` only once
--       a ledger row for the file itself exists.
--
-- The rows between the markers are generated from `supabase/migrations/*.sql` by
-- `npm run migrations:checklist -- --write`; the fourth column (`kind`) selects
-- the rule. `npm run migrations:checklist` (a stage of `npm run ci`) fails when a
-- migration is added, renamed or deleted without regenerating this block, or when
-- a file's kind no longer matches its evidence.
--
-- Read-only: nothing here writes to `supabase_migrations.schema_migrations`. A
-- missing row is information for the operator, not an instruction to edit the
-- ledger (docs/operations/SUPABASE_MIGRATION_HISTORY_RECONCILIATION.md).
--
-- A gate must treat anything that is not `pass` — including `unresolved` — as not
-- verified.
with repo_migrations(version, name, filename, kind) as (
  values
-- BEGIN GENERATED MIGRATION CHECKLIST
    ('20260830000000', 'baseline_core_schema', '20260830000000_baseline_core_schema.sql', 'unique'),
    ('20260831', 'add_production_query_indexes', '20260831_add_production_query_indexes.sql', 'unique'),
    ('20260902', 'create_material_notes', '20260902_create_material_notes.sql', 'unique'),
    ('20260903', 'enable_staff_service_request_moderation', '20260903_enable_staff_service_request_moderation.sql', 'shared'),
    ('20260903', 'harden_profile_and_submission_rls', '20260903_harden_profile_and_submission_rls.sql', 'shared'),
    ('20260903', 'production_security_hardening', '20260903_production_security_hardening.sql', 'unresolved'),
    ('20260903', 'restrict_notification_creation_to_staff', '20260903_restrict_notification_creation_to_staff.sql', 'shared'),
    ('20260903', 'restrict_profile_client_columns', '20260903_restrict_profile_client_columns.sql', 'shared'),
    ('20260903', 'scope_past_questions_to_student_programme', '20260903_scope_past_questions_to_student_programme.sql', 'shared'),
    ('20260915', 'cbt_news_tables', '20260915_cbt_news_tables.sql', 'unique'),
    ('20260916000000', 'application_integration_seed', '20260916000000_application_integration_seed.sql', 'unique'),
    ('20260916010000', 'cbt_news_rls', '20260916010000_cbt_news_rls.sql', 'unique'),
    ('20260919', 'admin_cbt_production_hardening', '20260919_admin_cbt_production_hardening.sql', 'shared'),
    ('20260919', 'auth_cbt_consistency_hardening', '20260919_auth_cbt_consistency_hardening.sql', 'shared'),
    ('20260919', 'payment_idempotency', '20260919_payment_idempotency.sql', 'shared'),
    ('20260919', 'production_hardening', '20260919_production_hardening.sql', 'shared'),
    ('20260919', 'remove_redundant_auth_trigger', '20260919_remove_redundant_auth_trigger.sql', 'shared'),
    ('20260920', 'auth_and_profile_completion', '20260920_auth_and_profile_completion.sql', 'shared'),
    ('20260920', 'production_student_workflows', '20260920_production_student_workflows.sql', 'shared'),
    ('20260920', 'student_portal_data_backbone', '20260920_student_portal_data_backbone.sql', 'shared'),
    ('20260924', 'retire_legacy_scratch_service', '20260924_retire_legacy_scratch_service.sql', 'unique'),
    ('20260925210000', 'restrict_unused_public_security_definer', '20260925210000_restrict_unused_public_security_definer.sql', 'unique'),
    ('20260925213000', 'cbt_attempt_question_position', '20260925213000_cbt_attempt_question_position.sql', 'unique'),
    ('20260925214000', 'service_request_statuses', '20260925214000_service_request_statuses.sql', 'unique'),
    ('20260925', 'public_release_security_hardening', '20260925_public_release_security_hardening.sql', 'unique'),
    ('20260926000000', 'backfill_missing_server_dependencies', '20260926000000_backfill_missing_server_dependencies.sql', 'unique'),
    ('20260926200000', 'admin_control_centre_backend', '20260926200000_admin_control_centre_backend.sql', 'unique'),
    ('20260926220000', 'admin_full_catalogue_opportunities', '20260926220000_admin_full_catalogue_opportunities.sql', 'unique'),
    ('20260926230000', 'fix_cbt_result_ambiguity', '20260926230000_fix_cbt_result_ambiguity.sql', 'unique'),
    ('20260926231000', 'cbt_concurrency_hardening', '20260926231000_cbt_concurrency_hardening.sql', 'unique'),
    ('20260927000000', 'postmerge_data_control', '20260927000000_postmerge_data_control.sql', 'unique'),
    ('20260928190000', 'cbt_subject_aware_papers', '20260928190000_cbt_subject_aware_papers.sql', 'unique'),
    ('20260929222000', 'reconcile_cbt_subject_backend_state', '20260929222000_reconcile_cbt_subject_backend_state.sql', 'unique'),
    ('20260929223000', 'normalize_cbt_english_subject_aliases', '20260929223000_normalize_cbt_english_subject_aliases.sql', 'unique'),
    ('20260930120000', 'newsroom_ingestion_pipeline', '20260930120000_newsroom_ingestion_pipeline.sql', 'unique'),
    ('20260930140000', 'capability_role_alignment', '20260930140000_capability_role_alignment.sql', 'unique'),
    ('20260930150000', 'auth_signup_trigger_repair', '20260930150000_auth_signup_trigger_repair.sql', 'unique'),
    ('20260930160000', 'institutions_column_repair', '20260930160000_institutions_column_repair.sql', 'unique'),
    ('20260930200000', 'rls_posture', '20260930200000_rls_posture.sql', 'unique'),
    ('20261001120000', 'analytics_retention', '20261001120000_analytics_retention.sql', 'unique'),
    ('20261001140000', 'cbt_bank_readiness', '20261001140000_cbt_bank_readiness.sql', 'unique'),
    ('20261001160000', 'scheduled_job_observability', '20261001160000_scheduled_job_observability.sql', 'unique'),
    ('20261002120000', 'cbt_practice_and_mock_modes', '20261002120000_cbt_practice_and_mock_modes.sql', 'unique'),
    ('20261002130000', 'news_category_contract', '20261002130000_news_category_contract.sql', 'unique'),
    ('20261002140000', 'past_question_resources', '20261002140000_past_question_resources.sql', 'unique'),
    ('20261002150000', 'opportunity_eligibility', '20261002150000_opportunity_eligibility.sql', 'unique'),
    ('20261003080000', 'backend_security_hardening', '20261003080000_backend_security_hardening.sql', 'unique'),
    ('20261003090000', 'verify_opportunity_data', '20261003090000_verify_opportunity_data.sql', 'unique'),
    ('20261003100000', 'cbt_server_authority_alignment', '20261003100000_cbt_server_authority_alignment.sql', 'unique'),
    ('20261003101000', 'expire_stale_cbt_attempts', '20261003101000_expire_stale_cbt_attempts.sql', 'unique'),
    ('20261003102000', 'normalize_published_news_category_labels', '20261003102000_normalize_published_news_category_labels.sql', 'unique'),
    ('20261003103000', 'cbt_paper_expiry_volatility', '20261003103000_cbt_paper_expiry_volatility.sql', 'unique'),
    ('20261003170000', 'create_academic_catalogue_and_daily_quiz', '20261003170000_create_academic_catalogue_and_daily_quiz.sql', 'unique'),
    ('20261003175703', 'backfill_verified_academic_catalogue_and_daily_quiz_v2', '20261003175703_backfill_verified_academic_catalogue_and_daily_quiz_v2.sql', 'unique'),
    ('20261003190000', 'opportunity_discovery_engine', '20261003190000_opportunity_discovery_engine.sql', 'unique'),
    ('20261016160000', 'reconcile_live_catalogue_and_service_request_contract', '20261016160000_reconcile_live_catalogue_and_service_request_contract.sql', 'unique'),
    ('20261017123909', 'cbt_result_retention', '20261017123909_cbt_result_retention.sql', 'unique'),
    ('20261018120000', 'exam_specific_question_provenance', '20261018120000_exam_specific_question_provenance.sql', 'unique'),
    ('20261018172307', 'post_utme_school_modes_and_pdf_bank', '20261018172307_post_utme_school_modes_and_pdf_bank.sql', 'unique'),
    ('20261018172404', 'post_utme_pdf_bank_registry_replay', '20261018172404_post_utme_pdf_bank_registry_replay.sql', 'unique'),
    ('20261018172823', 'pdf_bank_explicit_source_verification', '20261018172823_pdf_bank_explicit_source_verification.sql', 'unique'),
    ('20261018174207', 'pdf_bank_destination_links', '20261018174207_pdf_bank_destination_links.sql', 'unique'),
    ('20261020100000', 'safe_verified_question_banks', '20261020100000_safe_verified_question_banks.sql', 'unique'),
    ('20261020110000', 'deduplicate_exact_duplicates', '20261020110000_deduplicate_exact_duplicates.sql', 'unique'),
    ('20261020120000', 'copy_legacy_questions_to_practice_banks', '20261020120000_copy_legacy_questions_to_practice_banks.sql', 'unique'),
    ('20261021120000', 'cbt_subject_selection_rules', '20261021120000_cbt_subject_selection_rules.sql', 'unique'),
    ('20261022090000', 'cbt_question_serving_rules', '20261022090000_cbt_question_serving_rules.sql', 'unique'),
    ('20261022091500', 'cbt_mock_paper_spec', '20261022091500_cbt_mock_paper_spec.sql', 'unique'),
    ('20261022093000', 'cbt_deadline_grace', '20261022093000_cbt_deadline_grace.sql', 'unique'),
    ('20261023120000', 'question_import_pipeline', '20261023120000_question_import_pipeline.sql', 'unique'),
    ('20261024120000', 'site_content_and_legal_pages', '20261024120000_site_content_and_legal_pages.sql', 'unique'),
    ('20261025120000', 'cbt_submit_grace_120', '20261025120000_cbt_submit_grace_120.sql', 'unique'),
    ('20261026120000', 'service_guides', '20261026120000_service_guides.sql', 'unique'),
    ('20261027120000', 'cbt_subject_catalog_and_mock_rules', '20261027120000_cbt_subject_catalog_and_mock_rules.sql', 'unique')
-- END GENERATED MIGRATION CHECKLIST
),
normalized as (
  select version, filename, kind, regexp_replace(name, '^[0-9]{8,14}_', '') as base_name
  from repo_migrations
),
recorded as (
  select version, coalesce(name, '') as name from supabase_migrations.schema_migrations
),
-- A unique version may be matched by version (the ledger renumbered some of
-- these) or by name (the ledger prefixes some names with a different date).
missing_unique as (
  select n.filename
  from normalized n
  where n.kind = 'unique'
    and not exists (select 1 from recorded r where r.version = n.version)
    and not exists (select 1 from recorded r where regexp_replace(r.name, '^[0-9]{8,14}_', '') = n.base_name)
),
-- A shared legacy version is never evidence: only the file's own name is.
missing_shared as (
  select n.filename
  from normalized n
  where n.kind = 'shared'
    and not exists (select 1 from recorded r where regexp_replace(r.name, '^[0-9]{8,14}_', '') = n.base_name)
),
-- Not matched by any ledger row: `unresolved`, not `fail` (missing is not
-- established) and not `pass` (the evidence is not there).
missing_unresolved as (
  select n.filename
  from normalized n
  where n.kind = 'unresolved'
    and not exists (select 1 from recorded r where regexp_replace(r.name, '^[0-9]{8,14}_', '') = n.base_name)
)
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every uniquely versioned migration is recorded in the migration ledger' as check_name,
  count(*)::text || ' of ' || (select count(*) from normalized where kind = 'unique')::text
    || ' uniquely versioned repository migrations are not recorded in supabase_migrations.schema_migrations'
    || coalesce(': ' || string_agg(filename, ', ' order by filename), '') as detail
from missing_unique
union all
select
  case when count(*) = 0 then 'pass' else 'fail' end as result,
  'every migration sharing a legacy version is individually recorded in the migration ledger' as check_name,
  count(*)::text || ' of ' || (select count(*) from normalized where kind = 'shared')::text
    || ' migrations that share a legacy version have no ledger row of their own (a version match is not evidence for a shared version)'
    || coalesce(': ' || string_agg(filename, ', ' order by filename), '') as detail
from missing_shared
union all
select
  case when count(*) = 0 then 'pass' else 'unresolved' end as result,
  'migrations with no ledger evidence are never reported as applied' as check_name,
  count(*)::text || ' of ' || (select count(*) from normalized where kind = 'unresolved')::text
    || ' migrations have no ledger record that distinguishes them; they are unresolved, not applied'
    || coalesce(': ' || string_agg(filename, ', ' order by filename), '')
    || ' — reconcile on a disposable branch (docs/operations/SUPABASE_MIGRATION_HISTORY_RECONCILIATION.md)' as detail
from missing_unresolved;

-- 9. The objects this release introduces are present -------------------------
-- Check 8 answers "is every migration in this repository recorded?"; it cannot
-- answer "did this release's objects actually get created?" — a ledger row proves
-- a file ran, not that the objects survived a later edit. So this check compares
-- the release's exact versions and then inspects the important objects and
-- security properties. Output every missing version or object with the migration
-- file an operator should apply. Read-only and safe to run at any time.
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
    ,('20261019184519', '20261021120000_cbt_subject_selection_rules.sql')
    ,('20261022090000', '20261022090000_cbt_question_serving_rules.sql')
    ,('20261022091500', '20261022091500_cbt_mock_paper_spec.sql')
    ,('20261022093000', '20261022093000_cbt_deadline_grace.sql')
    ,('20261023120000', '20261023120000_question_import_pipeline.sql')
    ,('20261024120000', '20261024120000_site_content_and_legal_pages.sql')
    ,('20261025120000', '20261025120000_cbt_submit_grace_120.sql')
    ,('20261026120000', '20261026120000_service_guides.sql')
    ,('20261027120000', '20261027120000_cbt_subject_catalog_and_mock_rules.sql')
), missing_versions as (
  select 'migration ' || e.version as object, e.migration
  from expected e
  where not exists (
    select 1 from supabase_migrations.schema_migrations applied
    where applied.version = e.version
       or (e.migration = '20261027120000_cbt_subject_catalog_and_mock_rules.sql'
           and applied.name = 'cbt_subject_catalog_and_mock_rules')
  )
), missing_objects as (
  select 'public.cbt_attempts.mode' as object, '20261002120000_cbt_practice_and_mock_modes.sql' as migration
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'cbt_attempts' and column_name = 'mode')
  union all
  select 'public.cbt_attempts.submission_late_ms', '20261025120000_cbt_submit_grace_120.sql'
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'cbt_attempts' and column_name = 'submission_late_ms')
  union all
  select 'public.plan_cbt_paper()', '20261002120000_cbt_practice_and_mock_modes.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'plan_cbt_paper')
  union all
  select 'public.service_guides', '20261026120000_service_guides.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'service_guides')
  union all
  select 'public.cbt_subject_catalog', '20261027120000_cbt_subject_catalog_and_mock_rules.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'cbt_subject_catalog')
  union all
  select 'public.site_pages', '20261024120000_site_content_and_legal_pages.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'site_pages')
  union all
  select 'public.site_settings', '20261024120000_site_content_and_legal_pages.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'site_settings')
  union all
  select 'public.site_page_revisions', '20261024120000_site_content_and_legal_pages.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'site_page_revisions')
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
  select 'public.question_imports', '20261023120000_question_import_pipeline.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'question_imports')
  union all
  select 'public.question_import_items', '20261023120000_question_import_pipeline.sql'
  where not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = 'question_import_items')
  union all
  select 'public.commit_question_import()', '20261023120000_question_import_pipeline.sql'
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'commit_question_import')
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
