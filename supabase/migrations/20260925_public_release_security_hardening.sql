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
