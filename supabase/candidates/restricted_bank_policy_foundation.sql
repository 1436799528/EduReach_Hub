-- INCOMPLETE LOCAL CANDIDATE: DO NOT DEPLOY. This file defines only the policy
-- inventory and role-checked management primitives. It DOES NOT fence the
-- existing CBT RPCs, service-role routes, scoring, or direct attempt reads.
-- Applying it alone does not protect confidential questions or answer keys.
-- No existing bank is classified by this script.

begin;

-- The replayed baseline gives authenticated a table-wide UPDATE grant on
-- profiles, and its staff RLS permits service_admin to update profiles. That
-- combination allows a service administrator to promote themselves to
-- super_admin. Remove the table-wide grant, then restore the profile-edit
-- columns explicitly granted by the existing profile migrations. Hosted role
-- inheritance and dependent clients still require review; this is part of the
-- non-deployable candidate, not a live policy edit.
revoke update on table public.profiles from public, anon, authenticated;
grant update (first_name,last_name,full_name,phone,account_type,avatar_url,school,
  course_programme,faculty,department,level,admission_year,expected_graduation_year,
  academic_interests,notification_preferences,terms_agreed_at,profile_completed,
  mfa_enabled,session,matric_number) on table public.profiles to authenticated;

create table public.cbt_bank_security (
  exam_id uuid primary key references public.cbt_exams(id) on delete restrict,
  visibility text not null check (visibility in ('public', 'restricted')),
  correction_release_at timestamptz,
  classified_by uuid references auth.users(id) on delete set null,
  classified_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((visibility = 'public' and correction_release_at is null)
      or (visibility = 'restricted' and correction_release_at is not null))
);

create table public.cbt_bank_candidate_assignments (
  exam_id uuid not null references public.cbt_bank_security(exam_id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  primary key (exam_id,user_id),
  check (revoked_by is null or revoked_at is not null)
);

alter table public.cbt_bank_security enable row level security;
alter table public.cbt_bank_candidate_assignments enable row level security;
revoke all on public.cbt_bank_security, public.cbt_bank_candidate_assignments from public, anon, authenticated, service_role;
-- Server-side privileged readers must still enforce the policy before reading
-- question content. This grant is not an authorization decision for callers.
grant select on public.cbt_bank_security, public.cbt_bank_candidate_assignments to service_role;

-- Moving an existing row can carry restricted material into a public bank.
-- This candidate refuses all such moves; reviewed copy/provenance handling is
-- still needed, and this trigger alone cannot detect manually duplicated text.
create function public.cbt_bank_question_move_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.exam_id is distinct from old.exam_id then raise exception 'Question bank movement requires security review.'; end if;
  return new;
end $$;
create trigger cbt_bank_question_move_guard before update of exam_id on public.exam_questions
  for each row execute function public.cbt_bank_question_move_guard();
revoke all on function public.cbt_bank_question_move_guard() from public,anon,authenticated,service_role;

-- Mirrors existing application cbt.manage role mapping. This depends on the
-- existing profiles.role anti-escalation protections and must be reconciled
-- with hosted roles/privileges before any deployment.
create function public.cbt_bank_is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','content_editor','admin','moderator'))
$$;
revoke all on function public.cbt_bank_is_manager() from public, anon, authenticated, service_role;

-- No row means unclassified and therefore false. The predicate is only a
-- building block: existing question-serving functions do not call it yet.
create function public.cbt_bank_candidate_access(p_exam uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.visibility = 'public' or
    (s.visibility = 'restricted' and auth.uid() is not null and exists (
      select 1 from public.cbt_bank_candidate_assignments a
      where a.exam_id = s.exam_id and a.user_id = auth.uid() and a.revoked_at is null))
    from public.cbt_bank_security s where s.exam_id = p_exam),false)
$$;
revoke all on function public.cbt_bank_candidate_access(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_candidate_access(uuid) to anon, authenticated;

-- Locking form of the predicate, used by write paths so authorization cannot be
-- overtaken while the operation is in flight. The share lock on the policy row
-- conflicts with cbt_bank_assign's update lock, so a revocation either commits
-- before this statement (and is seen) or waits for this transaction to finish.
-- The guarantee is therefore: revocation never commits between an operation's
-- authorization check and that operation's commit. An operation that began
-- before a revocation may finish; every later operation is denied. Without this
-- lock the predicate is checked in an earlier snapshot than the write, and a
-- revocation committed in between still allowed the write.
create function public.cbt_bank_lock_candidate_access(p_exam uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_visibility text;
begin
  select s.visibility into v_visibility from public.cbt_bank_security s
    where s.exam_id = p_exam for share;
  if not found or v_visibility is null then return false; end if;
  if v_visibility = 'public' then return true; end if;
  if auth.uid() is null then return false; end if;
  perform 1 from public.cbt_bank_candidate_assignments a
    where a.exam_id = p_exam and a.user_id = auth.uid() and a.revoked_at is null for share;
  return found;
end $$;
revoke all on function public.cbt_bank_lock_candidate_access(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_lock_candidate_access(uuid) to authenticated, service_role;

create function public.cbt_bank_corrections_released(p_exam uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when s.visibility = 'public' then true
    when s.visibility = 'restricted' then public.cbt_bank_candidate_access(p_exam)
      and s.correction_release_at <= now()
    else false end from public.cbt_bank_security s where s.exam_id = p_exam), false)
$$;
revoke all on function public.cbt_bank_corrections_released(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_corrections_released(uuid) to anon, authenticated;

-- Classification is explicitly chosen by staff; it is immutable in this
-- candidate to avoid silently making restricted content public or treating
-- previously public content as newly secret. Policy transitions and question
-- duplication require a separate, reviewed lifecycle before production.
create function public.cbt_bank_classify(p_exam uuid, p_visibility text, p_release_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  if p_visibility is null or p_visibility not in ('public','restricted') then raise exception 'Invalid bank classification.'; end if;
  if p_visibility='public' and p_release_at is not null then raise exception 'Public banks have no correction release time.'; end if;
  if p_visibility='restricted' and (p_release_at is null or p_release_at <= now()) then raise exception 'Restricted banks require a future correction release time.'; end if;
  perform 1 from public.cbt_exams e where e.id=p_exam for update;
  if not found then raise exception 'CBT bank not found.'; end if;
  if exists(select 1 from public.cbt_bank_security s where s.exam_id=p_exam) then raise exception 'Bank is already classified.'; end if;
  insert into public.cbt_bank_security(exam_id,visibility,correction_release_at,classified_by,updated_by)
    values(p_exam,p_visibility,p_release_at,auth.uid(),auth.uid());
end $$;
revoke all on function public.cbt_bank_classify(uuid,text,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_classify(uuid,text,timestamptz) to authenticated;

create function public.cbt_bank_set_release(p_exam uuid,p_release_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_policy public.cbt_bank_security%rowtype;
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  select * into v_policy from public.cbt_bank_security where exam_id=p_exam for update;
  if not found or v_policy.visibility <> 'restricted' then raise exception 'Restricted bank not found.'; end if;
  if v_policy.correction_release_at <= now() then raise exception 'Already released; release cannot be undone.'; end if;
  if p_release_at is null or p_release_at <= now() then raise exception 'Correction release must be in the future.'; end if;
  update public.cbt_bank_security set correction_release_at=p_release_at,updated_by=auth.uid(),updated_at=now() where exam_id=p_exam;
end $$;
revoke all on function public.cbt_bank_set_release(uuid,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_set_release(uuid,timestamptz) to authenticated;

create function public.cbt_bank_assign(p_exam uuid,p_candidate uuid,p_assign boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  if p_candidate is null or p_assign is null then raise exception 'Invalid candidate assignment.'; end if;
  perform 1 from public.cbt_bank_security s where s.exam_id=p_exam and s.visibility='restricted' for update;
  if not found then raise exception 'Restricted bank not found.'; end if;
  if p_assign then
    insert into public.cbt_bank_candidate_assignments(exam_id,user_id,assigned_by,assigned_at,revoked_by,revoked_at)
      values(p_exam,p_candidate,auth.uid(),now(),null,null)
      on conflict(exam_id,user_id) do update set assigned_by=excluded.assigned_by,assigned_at=now(),revoked_by=null,revoked_at=null;
  else
    update public.cbt_bank_candidate_assignments set revoked_by=auth.uid(),revoked_at=now()
      where exam_id=p_exam and user_id=p_candidate and revoked_at is null;
  end if;
end $$;
revoke all on function public.cbt_bank_assign(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_assign(uuid,uuid,boolean) to authenticated;

-- Read-only staff inventory; visibility NULL means unclassified, not public.
-- Counts are for review only and provide no evidence of previous guest exposure.
create function public.cbt_bank_inventory()
returns table(exam_id uuid,title text,is_active boolean,visibility text,correction_release_at timestamptz,question_count bigint,attempt_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  return query select e.id,e.title,e.is_active,s.visibility,s.correction_release_at,
    (select count(*) from public.exam_questions q where q.exam_id=e.id),
    (select count(*) from public.cbt_attempts a where a.exam_id=e.id)
  from public.cbt_exams e left join public.cbt_bank_security s on s.exam_id=e.id order by e.title,e.id;
end $$;
revoke all on function public.cbt_bank_inventory() from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_inventory() to authenticated;

commit;
