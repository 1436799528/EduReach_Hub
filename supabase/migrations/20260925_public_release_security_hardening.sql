-- Public-release security boundary.
-- Course Finder has no approved data source and must not remain an active
-- catalogue item even though an older seed migration inserted it.
update public.service_catalog
set active = false
where service_key = 'course-finder';

-- Service-request status is a student-dashboard concern, not a public
-- reference-code lookup. The dashboard reads only rows owned by auth.uid().
-- Revoke the legacy reference lookup introduced for the retired public tracker.
revoke all on function public.get_public_service_request(text) from public, anon, authenticated;

-- Profile completion submits session alongside the other academic fields.
-- Restore column-level update permission that was removed by the later profile
-- hardening grant, without granting access to role or other staff-controlled
-- columns.
grant update (session, matric_number) on table public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

-- The authenticated dashboard must be able to read only the current student's
-- own requests. Earlier hardening correctly restricted inserts, but did not
-- define this read policy, which made My Requests appear empty under RLS.
drop policy if exists service_requests_read_own on public.service_requests;
create policy service_requests_read_own on public.service_requests
for select to authenticated
using (user_id = auth.uid());

-- The client must receive CBT questions only after authentication. Correct
-- options remain server-side and are never exposed by this projection.
revoke all on table public.exam_questions from anon, authenticated;

-- Make the intentional server/RPC-only boundary explicit to the RLS advisor.
-- These deny policies do not grant browser access; service_role and the
-- SECURITY DEFINER workflow functions remain the only data paths.
alter table public.exam_questions enable row level security;
drop policy if exists exam_questions_deny_client on public.exam_questions;
create policy exam_questions_deny_client on public.exam_questions
for all to anon, authenticated
using (false)
with check (false);

-- Analytics events are written by the same-origin server with service_role.
-- They are not a browser-readable or browser-writable table.
do $$
begin
  if to_regclass('public.site_analytics_events') is not null then
    execute 'alter table public.site_analytics_events enable row level security';
    execute 'drop policy if exists site_analytics_events_deny_client on public.site_analytics_events';
    execute 'create policy site_analytics_events_deny_client on public.site_analytics_events for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on table public.site_analytics_events from anon, authenticated';
  end if;
end
$$;

-- Content-version records, when present in the deployed project, are
-- administrative/server-only records. Keep their browser boundary explicit
-- without assuming a particular live schema beyond the table name.
do $$
begin
  if to_regclass('public.admin_content_versions') is not null then
    execute 'alter table public.admin_content_versions enable row level security';
    execute 'drop policy if exists admin_content_versions_deny_client on public.admin_content_versions';
    execute 'create policy admin_content_versions_deny_client on public.admin_content_versions for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on table public.admin_content_versions from anon, authenticated';
  end if;
end
$$;

-- Supabase Security Advisor flags SECURITY DEFINER routines when their search
-- path can be changed by a caller. Pin every known routine to an empty path;
-- each routine already schema-qualifies its application objects. The guarded
-- lookups keep this migration compatible with projects that do not have one of
-- the older optional routines.
do $$
declare
  routine_signature text;
  routine_signatures CONSTANT text[] := array[
    'public.get_campus_feed_profiles(uuid[])',
    'public.admin_audit_log(uuid,text,text,uuid,jsonb)',
    'public.handle_new_user()',
    'public.get_cbt_result(uuid)',
    'public.is_staff_user()',
    'public.handle_new_student_profile()',
    'public.start_cbt_attempt(uuid)',
    'public.get_cbt_questions(uuid)',
    'public.submit_cbt_attempt(uuid,uuid,jsonb)',
    'public.credit_wallet_payment(uuid,numeric,text,jsonb)',
    'public.get_public_service_request(text)'
  ];
begin
  foreach routine_signature in array routine_signatures loop
    if to_regprocedure(routine_signature) is not null then
      execute format('alter function %s set search_path = %L', routine_signature, '');
    end if;
  end loop;
end
$$;
