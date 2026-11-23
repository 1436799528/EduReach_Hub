-- 20261123150000_security_boundary_hardening.sql
--
-- Closes the SECURITY DEFINER / search_path findings from the 2026-11-23
-- platform security audit. Grants only: no table, policy, column or data change,
-- so this migration cannot alter what a student or an administrator can see.
--
-- Findings addressed
-- ------------------
-- 1. `public.plan_cbt_paper(uuid, text[], integer, jsonb)` was executable by
--    `PUBLIC` *and* by `anon`. It is a paper-planning helper behind
--    `start_cbt_attempt*`; it reads `public.cbt_questions` (the question bank) to
--    decide which questions an attempt gets. Nothing anonymous needs it: every
--    student path reaches it through an authenticated RPC or the server's
--    service-role client, both of which keep their grant below. Anonymous
--    execution was an unauthenticated oracle over the question bank.
--
-- 2. `public.enforce_cbt_subject_combination()` is a trigger function on
--    `public.cbt_attempts` and was executable by `PUBLIC`, `anon` and
--    `authenticated`. A trigger does not check EXECUTE at fire time, so the grant
--    bought nothing and only widened the RPC surface.
--
-- 3. `public.guard_referenced_news_placeholder_delete()` is a trigger function on
--    `public.news_articles` and was executable by `anon`.
--
-- 4. Two helpers had no pinned `search_path` (`cbt_limits`, `cbt_submit_grace`).
--    Both are `immutable`/`stable` constant helpers, and both were already
--    revoked from client roles by earlier migrations; the missing pin is a
--    mutable-search-path finding only. `pg_catalog` is correct for a function that
--    touches no table at all — an earlier migration pinned `cbt_limits` this way
--    and a later `create or replace` reset it, which is exactly why the pin is
--    re-asserted here rather than assumed.
--
-- What deliberately does *not* change
-- -----------------------------------
--   * `authenticated` keeps EXECUTE on every student-facing CBT function
--     (`start_cbt_attempt*`, `save_cbt_attempt_draft`, `submit_cbt_attempt*`,
--     `get_cbt_attempt_paper`, `get_cbt_result`, `abandon_cbt_expire_*`,
--     `delete_cbt_*`). The student exam workflow is unchanged.
--   * `service_role` keeps EXECUTE everywhere it had it; the server calls these
--     functions with the service client.
--   * No policy is added to the tables the Security Advisor lists as "RLS enabled,
--     no policies". Deny-all is the intended posture for those tables (see
--     docs/security/RLS-POLICY-MATRIX.md); adding permissive policies to silence a
--     warning would be the vulnerability, not the fix.
--
-- Apply order: review, then apply to staging, then run
-- `supabase/ci/production-validation.sql` (section 9) against it. Applying this to
-- production is an owner decision, not part of the audit that produced it.

begin;

-- ---------------------------------------------------------------------------
-- 1. Paper planning is not an anonymous operation
-- ---------------------------------------------------------------------------
revoke all on function public.plan_cbt_paper(uuid, text[], integer, jsonb) from public;
revoke all on function public.plan_cbt_paper(uuid, text[], integer, jsonb) from anon;
grant execute on function public.plan_cbt_paper(uuid, text[], integer, jsonb) to authenticated;
grant execute on function public.plan_cbt_paper(uuid, text[], integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Trigger functions are not client-callable RPCs
-- ---------------------------------------------------------------------------
revoke all on function public.enforce_cbt_subject_combination() from public;
revoke all on function public.enforce_cbt_subject_combination() from anon;
revoke all on function public.enforce_cbt_subject_combination() from authenticated;
grant execute on function public.enforce_cbt_subject_combination() to service_role;

revoke all on function public.guard_referenced_news_placeholder_delete() from public;
revoke all on function public.guard_referenced_news_placeholder_delete() from anon;
revoke all on function public.guard_referenced_news_placeholder_delete() from authenticated;
grant execute on function public.guard_referenced_news_placeholder_delete() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Fixed search path for the two unpinned helpers
-- ---------------------------------------------------------------------------
alter function public.cbt_limits() set search_path = pg_catalog;
alter function public.cbt_submit_grace() set search_path = pg_catalog;

commit;
