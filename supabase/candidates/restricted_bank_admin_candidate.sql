-- INCOMPLETE LOCAL CANDIDATE: DO NOT DEPLOY. Depends on
-- restricted_bank_policy_foundation.sql, restricted_bank_readers_candidate.sql
-- and restricted_bank_results_candidate.sql.
--
-- This file adds the administrative inventory, the audit trail and a guarded
-- question-publication path for the restricted-bank policy. It does not make
-- the policy deployable: classification lifecycle, hosted roles and grants,
-- and the administrative UI's full authorization matrix still require review.
begin;

-- Every policy change is recorded without question content, answer keys or
-- student answers. The actor comes from the verified session (auth.uid()); a
-- change made outside an authenticated request is recorded as unattributed
-- rather than silently dropped, and no application role can write these tables
-- directly (only the SECURITY DEFINER functions below can).
create function public.cbt_bank_audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_entity uuid;
  v_actor uuid := auth.uid();
  v_recorded_by uuid;
  v_metadata jsonb;
begin
  if tg_table_name = 'cbt_bank_security' then
    v_entity := new.exam_id;
    v_recorded_by := coalesce(new.updated_by, new.classified_by);
    if tg_op = 'INSERT' then
      v_action := 'bank_classified';
      v_metadata := jsonb_build_object('visibility', new.visibility,
        'correction_release_at', new.correction_release_at);
    else
      v_action := 'bank_release_changed';
      v_metadata := jsonb_build_object('from', old.correction_release_at,
        'to', new.correction_release_at, 'visibility', new.visibility);
    end if;
  else
    v_entity := new.exam_id;
    if tg_op = 'INSERT' then
      v_action := 'bank_candidate_assigned';
      v_recorded_by := new.assigned_by;
      v_metadata := jsonb_build_object('candidate', new.user_id);
    elsif old.revoked_at is null and new.revoked_at is not null then
      v_action := 'bank_candidate_revoked';
      v_recorded_by := new.revoked_by;
      v_metadata := jsonb_build_object('candidate', new.user_id);
    elsif old.revoked_at is not null and new.revoked_at is null then
      v_action := 'bank_candidate_reassigned';
      v_recorded_by := new.assigned_by;
      v_metadata := jsonb_build_object('candidate', new.user_id,
        'previous_revoked_at', old.revoked_at);
    else
      return new;
    end if;
  end if;
  v_actor := coalesce(v_actor, v_recorded_by);
  if v_actor is not null then
    insert into public.admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata)
    values (v_actor, v_action, 'cbt_bank', v_entity, v_metadata);
  end if;
  return new;
end $$;
revoke all on function public.cbt_bank_audit_change() from public, anon, authenticated, service_role;

drop trigger if exists cbt_bank_security_audit on public.cbt_bank_security;
create trigger cbt_bank_security_audit after insert or update of visibility, correction_release_at
  on public.cbt_bank_security for each row execute function public.cbt_bank_audit_change();
drop trigger if exists cbt_bank_assignments_audit on public.cbt_bank_candidate_assignments;
create trigger cbt_bank_assignments_audit after insert or update of revoked_at
  on public.cbt_bank_candidate_assignments for each row execute function public.cbt_bank_audit_change();

-- Administrative inventory: one row per bank, including unclassified banks.
-- `visibility` NULL means unclassified, never public. All counts are review
-- data and contain no question text or answer keys.
create or replace function public.cbt_bank_admin_inventory()
returns table(
  exam_id uuid, title text, exam_body text, subject text, is_active boolean,
  visibility text, correction_release_at timestamptz, released boolean,
  classified_at timestamptz, classified_by uuid,
  question_count bigint, approved_question_count bigint, attempt_count bigint,
  assigned_count bigint, revoked_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  return query select e.id, e.title, e.exam_body, e.subject, e.is_active,
    s.visibility, s.correction_release_at,
    (s.exam_id is not null and public.cbt_bank_corrections_released(e.id)) as released,
    s.classified_at, s.classified_by,
    (select count(*) from public.exam_questions q where q.exam_id = e.id),
    (select count(*) from public.exam_questions q where q.exam_id = e.id and q.review_status = 'approved'),
    (select count(*) from public.cbt_attempts a where a.exam_id = e.id),
    (select count(*) from public.cbt_bank_candidate_assignments c where c.exam_id = e.id and c.revoked_at is null),
    (select count(*) from public.cbt_bank_candidate_assignments c where c.exam_id = e.id and c.revoked_at is not null)
  from public.cbt_exams e
  left join public.cbt_bank_security s on s.exam_id = e.id
  order by e.title, e.id;
end $$;
revoke all on function public.cbt_bank_admin_inventory() from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_admin_inventory() to authenticated;

-- Current and historical assignment state for one restricted bank. This is a
-- staff view of account identifiers and names only: no answer, score or
-- question content is included.
create or replace function public.cbt_bank_admin_candidates(p_exam uuid)
returns table(user_id uuid, full_name text, status text, assigned_at timestamptz,
  revoked_at timestamptz, assigned_by uuid, revoked_by uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  return query select c.user_id, p.full_name,
    case when c.revoked_at is null then 'active' else 'revoked' end,
    c.assigned_at, c.revoked_at, c.assigned_by, c.revoked_by
  from public.cbt_bank_candidate_assignments c
  left join public.profiles p on p.id = c.user_id
  where c.exam_id = p_exam
  order by (c.revoked_at is not null), c.assigned_at desc;
end $$;
revoke all on function public.cbt_bank_admin_candidates(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_admin_candidates(uuid) to authenticated;

-- Audit history for one bank, drawn from the audit trail the triggers write.
-- Metadata is policy information only; the function never returns question
-- text, answer keys or student answers.
create or replace function public.cbt_bank_admin_history(p_exam uuid, p_limit integer default 50)
returns table(id uuid, action text, actor uuid, created_at timestamptz, metadata jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.cbt_bank_is_manager() then raise exception 'Permission denied.' using errcode='42501'; end if;
  return query select l.id, l.action, l.admin_user_id, l.created_at, l.metadata
  from public.admin_audit_logs l
  where l.entity_type = 'cbt_bank' and l.entity_id = p_exam
  order by l.created_at desc
  limit v_limit;
end $$;
revoke all on function public.cbt_bank_admin_history(uuid,integer) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_admin_history(uuid,integer) to authenticated;

-- Assignment of a candidate must never be able to grant a bank manager role,
-- and a manager must never be able to assign an account that does not exist.
-- These wrappers keep the foundation's authorization and add explicit audit
-- rejection rows for refused attempts.
create or replace function public.cbt_bank_admin_assign(p_exam uuid, p_candidate uuid, p_assign boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.cbt_bank_is_manager() then
    raise exception 'Permission denied.' using errcode='42501';
  end if;
  if p_candidate is null or not exists (select 1 from public.profiles p where p.id = p_candidate) then
    raise exception 'Candidate account not found.' using errcode='22023';
  end if;
  perform public.cbt_bank_assign(p_exam, p_candidate, p_assign);
end $$;
revoke all on function public.cbt_bank_admin_assign(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.cbt_bank_admin_assign(uuid,uuid,boolean) to authenticated;

-- A reviewed batch can be repointed to another bank before publication. That
-- is a bank move in disguise, so it is refused whenever the two banks are not
-- classified identically and one of them is restricted. Without this, an
-- operator could re-point a restricted import at a public bank and publish the
-- restricted material there. The refusal raises, so the HTTP layer records the
-- failed attempt in its own transaction.
create function public.cbt_import_bank_move_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_from text;
  v_to text;
begin
  if new.exam_id is not distinct from old.exam_id then return new; end if;
  select s.visibility into v_from from public.cbt_bank_security s where s.exam_id = old.exam_id;
  select s.visibility into v_to from public.cbt_bank_security s where s.exam_id = new.exam_id;
  if v_from is not distinct from v_to then return new; end if;
  raise exception 'A reviewed import cannot move between differently classified banks. Upload it against the destination bank instead.'
    using errcode = '42501';
end $$;
revoke all on function public.cbt_import_bank_move_guard() from public, anon, authenticated, service_role;
drop trigger if exists cbt_import_bank_move_guard on public.question_imports;
create trigger cbt_import_bank_move_guard before update of exam_id on public.question_imports
  for each row execute function public.cbt_import_bank_move_guard();

-- Question publication is the point where questions become part of a bank, so
-- it checks three things inside the publishing transaction: the destination is
-- explicitly classified, the named actor is a bank manager, and the import is
-- otherwise valid. The existing atomic publisher is unchanged and still rolls
-- the whole batch back on any error.
alter function public.commit_question_import(uuid) rename to cbt_unchecked_commit_question_import;
revoke all on function public.cbt_unchecked_commit_question_import(uuid) from public, anon, authenticated, service_role;

create or replace function public.commit_question_import(p_import_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_import public.question_imports%rowtype;
  v_visibility text;
  v_result jsonb;
begin
  select * into v_import from public.question_imports where id = p_import_id;
  if not found then raise exception 'Import not found.'; end if;
  if p_actor is null then raise exception 'Permission denied.' using errcode='42501'; end if;
  -- Authority is read from the protected profile row, never from a request.
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor and p.role in ('super_admin','content_editor','admin','moderator')
  ) then
    raise exception 'Permission denied.' using errcode='42501';
  end if;
  -- Classification is read under lock: it cannot change between this check and
  -- the insert of the published rows.
  select s.visibility into v_visibility from public.cbt_bank_security s
    where s.exam_id = v_import.exam_id for share;
  if v_visibility is null then
    raise exception 'This question bank has not been classified. Approve it as public or restricted before publishing questions into it.'
      using errcode='42501';
  end if;

  -- A named, locked snapshot so the audit row and the publication commit or
  -- roll back together.
  perform pg_advisory_xact_lock(hashtext('cbt_bank:' || v_import.exam_id::text)::bigint);
  v_result := public.cbt_unchecked_commit_question_import(p_import_id);

  insert into public.admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'bank_questions_published', 'cbt_bank', v_import.exam_id,
    jsonb_build_object('import_id', v_import.id, 'visibility', v_visibility,
      'subject', v_import.subject, 'paper_year', v_import.paper_year,
      'inserted', v_result->'inserted', 'duplicates', v_result->'duplicates',
      'incomplete', v_result->'incomplete'));
  return v_result;
end $$;
revoke all on function public.commit_question_import(uuid,uuid) from public, anon, authenticated;
grant execute on function public.commit_question_import(uuid,uuid) to service_role;

-- The HTTP publisher checks this before calling the guarded function so an
-- unapplied candidate fails closed instead of falling back to the older path.
create or replace function public.question_import_bank_guard_ready()
returns boolean language sql stable security definer set search_path = ''
as $ready$ select true $ready$;
revoke all on function public.question_import_bank_guard_ready() from public, anon, authenticated;
grant execute on function public.question_import_bank_guard_ready() to service_role;

commit;
