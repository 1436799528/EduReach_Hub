# Supabase Production Security Checklist

Use this checklist after applying `supabase/migrations/20260925_public_release_security_hardening.sql` to the staging or production project. It is intentionally separate from the application runtime: the repository cannot enable Supabase Dashboard Auth settings or verify the live project's migration history without a connected Supabase project.

## Migration and RLS

- [ ] Confirm the public-release hardening migration is applied.
- [ ] Confirm `service_requests` returns only rows where `user_id = auth.uid()` to an authenticated student.
- [ ] Confirm `profiles` own-row reads and profile-completion updates work without allowing a student to change `role`.
- [ ] Confirm `get_public_service_request(text)` is not executable by `anon` or `authenticated`.
- [ ] Confirm `exam_questions` has no browser grants and its deny policy does not expose answer keys.
- [ ] Confirm `site_analytics_events` and `admin_content_versions`, when present, have RLS enabled, no `anon`/`authenticated` table grants, and the explicit deny policies from the release migration.
- [ ] Confirm the server/RPC path still works with `service_role` after the deny policies are applied.

Read-only checks for the Supabase SQL editor:

```sql
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('service_requests', 'profiles', 'exam_questions',
                    'site_analytics_events', 'admin_content_versions')
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('service_requests', 'profiles', 'exam_questions',
                    'site_analytics_events', 'admin_content_versions')
order by tablename, policyname;

select table_schema, table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('service_requests', 'profiles', 'exam_questions',
                     'site_analytics_events', 'admin_content_versions')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

## SECURITY DEFINER review

The release migration pins the known application SECURITY DEFINER routines to an empty `search_path`. Verify the live result rather than treating the migration file as proof of application:

```sql
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

select
  routine_schema,
  routine_name,
  specific_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_campus_feed_profiles', 'admin_audit_log', 'handle_new_user',
    'get_cbt_result', 'is_staff_user', 'handle_new_student_profile',
    'start_cbt_attempt', 'get_cbt_questions', 'submit_cbt_attempt',
    'credit_wallet_payment', 'get_public_service_request'
  )
order by routine_name, grantee, privilege_type;
```

Expected principles:

- Student result/question RPCs are callable only by `authenticated` and enforce `auth.uid()` ownership where applicable.
- Admin audit and payment-credit functions are callable only through the server-side role.
- The retired public request lookup is not callable by browser roles.
- The unused `get_campus_feed_profiles(uuid[])` RPC is not callable by browser roles.
- No SECURITY DEFINER routine relies on a mutable non-empty search path.
- Function owners and grants are reviewed against the intended server/RPC boundary, not accepted solely because a function exists.

## Supabase Auth dashboard settings

- [ ] Enable **Leaked password protection** under Authentication → Password Security.
- [ ] Set the production Site URL.
- [ ] Add only the intended production and staging redirect URLs.
- [ ] Verify email confirmation and password reset links from the deployed hostname.
- [ ] Verify MFA/security settings and recovery behavior with a staging student account.

## Application verification

- [ ] Student A cannot read Student B's service requests, profile, CBT attempts or results.
- [ ] An unauthenticated user cannot fetch CBT questions or submit an attempt.
- [ ] A student cannot change their own role or access admin APIs.
- [ ] Admin queue, news, CBT and user operations still work after RLS hardening.
- [ ] Analytics events are accepted only through the same-origin server endpoint and fail closed without leaking table data.
