-- TEST-1 — post-replay assertions against the scratch database.
--
-- Runs after every migration has been applied to an empty PostgreSQL. It asserts
-- the objects the application actually uses exist, so a migration that silently
-- stops short (or a repair that was dropped) fails the job instead of passing
-- quietly. Table and function names are the ones `npm run schema:audit` derives
-- from the code and the history.
--
-- See docs/features/TEST-1.md for what this does and does not prove.

do $verify$
declare
  missing text[] := array[]::text[];
  missing_functions text[] := array[]::text[];
  rls_disabled text[] := array[]::text[];
  missing_columns text[] := array[]::text[];
  item text;
  column_spec text;
  signup_triggers integer;
begin
  foreach item in array array[
    'profiles', 'service_catalog', 'service_requests', 'student_wallets', 'courses',
    'resources', 'past_questions', 'campus_posts', 'campus_post_comments',
    'campus_post_likes', 'edureach_notifications', 'student_notifications',
    'student_saved_items', 'student_cgpa_terms', 'student_cgpa_courses',
    'student_wallet_transactions', 'student_security_events', 'cbt_exams',
    'exam_questions', 'cbt_attempts', 'cbt_answers', 'news_articles', 'news_sources',
    'news_ingest_runs', 'news_ingest_candidates', 'opportunities', 'institutions',
    'admin_audit_logs', 'site_analytics_events', 'rate_limit_hits', 'payment_events',
    'edureach_material_notes', 'edureach_audit_logs', 'edureach_deadlines', 'edureach_exams'
  ] loop
    if to_regclass('public.' || item) is null then
      missing := missing || item;
    end if;
  end loop;

  foreach item in array array[
    'is_staff', 'is_staff_user', 'handle_new_user', 'admin_audit_log',
    'admin_activity_breakdown', 'admin_bootstrap_first_admin', 'admin_dashboard_metrics',
    'check_rate_limit', 'close_expired_opportunities', 'content_integrity_report',
    'credit_wallet_payment', 'expire_stale_news', 'get_campus_feed_profiles',
    'get_cbt_questions', 'get_cbt_questions_for_subjects', 'get_cbt_result',
    'get_public_service_request', 'set_service_reference_code',
    'set_student_portal_updated_at', 'start_cbt_attempt', 'start_cbt_attempt_for_subjects',
    'submit_cbt_attempt', 'submit_cbt_attempt_for_subjects'
  ] loop
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = item
    ) then
      missing_functions := missing_functions || (item || '()');
    end if;
  end loop;

  -- The tables whose policies the history defines must actually have RLS on,
  -- otherwise the policies would never run (BASE-1's third drift finding).
  foreach item in array array['profiles', 'service_catalog', 'service_requests', 'campus_posts', 'past_questions'] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = item and c.relrowsecurity
    ) then
      rls_disabled := rls_disabled || item;
    end if;
  end loop;

  -- Columns the application reads or the history grants on.
  foreach column_spec in array array[
    'profiles.role', 'profiles.full_name', 'profiles.school', 'profiles.matric_number',
    'profiles.jamb_reg_no', 'profiles.mfa_enabled', 'profiles.account_type',
    'service_catalog.service_key', 'service_catalog.active', 'service_catalog.amount_kobo',
    'service_requests.user_id', 'service_requests.status', 'service_requests.reference_code',
    'service_requests.form_data', 'institutions.slug', 'institutions.is_verified',
    'institutions.updated_at', 'student_notifications.notification_type',
    'student_notifications.metadata', 'student_notifications.read_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(column_spec, '.', 1)
        and column_name = split_part(column_spec, '.', 2)
    ) then
      missing_columns := missing_columns || column_spec;
    end if;
  end loop;

  -- BASE-1's signup trigger: without it a fresh signup has no profile row.
  select count(*) into signup_triggers
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
  where n.nspname = 'auth' and c.relname = 'users'
    and pn.nspname = 'public' and p.proname = 'handle_new_user'
    and not t.tgisinternal;

  if array_length(missing, 1) > 0 then
    raise exception 'replay verification: % table(s) missing: %', array_length(missing, 1), array_to_string(missing, ', ');
  end if;
  if array_length(missing_functions, 1) > 0 then
    raise exception 'replay verification: % function(s) missing: %', array_length(missing_functions, 1), array_to_string(missing_functions, ', ');
  end if;
  if array_length(rls_disabled, 1) > 0 then
    raise exception 'replay verification: row-level security is not enabled on: %', array_to_string(rls_disabled, ', ');
  end if;
  if array_length(missing_columns, 1) > 0 then
    raise exception 'replay verification: % column(s) missing: %', array_length(missing_columns, 1), array_to_string(missing_columns, ', ');
  end if;
  if signup_triggers < 1 then
    raise exception 'replay verification: no trigger on auth.users executes public.handle_new_user()';
  end if;

  raise notice 'replay verification: 35 tables, 23 functions, 5 RLS-enabled core tables, 20 columns and the signup trigger all present.';
end
$verify$;
