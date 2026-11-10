-- INCOMPLETE LOCAL CANDIDATE: DO NOT DEPLOY. Depends on
-- restricted_bank_policy_foundation.sql. These guards cover selected database
-- readers and starts only; they do not protect guest/service-role HTTP routes,
-- submissions, results, attempt table reads, history, aggregate score oracles,
-- all concurrency/revocation races, or v2 rehearsal. No security claim follows.
begin;

alter function public.get_cbt_questions(uuid) rename to cbt_unchecked_questions_candidate;
revoke all on function public.cbt_unchecked_questions_candidate(uuid) from public, anon, authenticated, service_role;
create function public.get_cbt_questions(p_exam_id uuid)
returns table("position" integer,question_text text,option_a text,option_b text,option_c text,option_d text)
language sql stable security definer set search_path='' as $$
  select q.* from public.cbt_unchecked_questions_candidate(p_exam_id) q
  where public.cbt_bank_candidate_access(p_exam_id)
$$;
revoke all on function public.get_cbt_questions(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_cbt_questions(uuid) to authenticated;

alter function public.get_cbt_questions_for_subjects(uuid,text[]) rename to cbt_unchecked_subject_questions_candidate;
revoke all on function public.cbt_unchecked_subject_questions_candidate(uuid,text[]) from public,anon,authenticated,service_role;
create function public.get_cbt_questions_for_subjects(p_exam_id uuid,p_subjects text[])
returns table(question_id uuid,"position" integer,subject text,question_text text,option_a text,option_b text,option_c text,option_d text)
language sql stable security definer set search_path='' as $$
  select q.* from public.cbt_unchecked_subject_questions_candidate(p_exam_id,p_subjects) q
  where public.cbt_bank_candidate_access(p_exam_id)
$$;
revoke all on function public.get_cbt_questions_for_subjects(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.get_cbt_questions_for_subjects(uuid,text[]) to authenticated;

alter function public.cbt_subject_availability(uuid) rename to cbt_unchecked_subject_availability_candidate;
revoke all on function public.cbt_unchecked_subject_availability_candidate(uuid) from public,anon,authenticated,service_role;
create function public.cbt_subject_availability(p_exam_id uuid)
returns table(subject text,question_count integer)
language sql stable security definer set search_path='' as $$
  select q.* from public.cbt_unchecked_subject_availability_candidate(p_exam_id) q
  where public.cbt_bank_candidate_access(p_exam_id)
$$;
revoke all on function public.cbt_subject_availability(uuid) from public,anon,authenticated,service_role;
-- The public metadata HTTP path invokes this with the server client. With no
-- user identity the candidate access predicate permits public banks only.
grant execute on function public.cbt_subject_availability(uuid) to authenticated, service_role;

-- Internal planning functions disclose IDs/counts and are not client APIs.
-- Their owner and the pre-existing v2 executor retain the privileges needed by
-- internal execution. The v2 client is NOT granted creation.
revoke all on function public.plan_cbt_paper(uuid,text[],integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.cbt_plan_summary(uuid[]) from public,anon,authenticated,service_role;

alter function public.start_cbt_attempt(uuid) rename to cbt_unchecked_start_candidate;
revoke all on function public.cbt_unchecked_start_candidate(uuid) from public,anon,authenticated,service_role;
create function public.start_cbt_attempt(p_exam_id uuid)
returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer)
language plpgsql security definer set search_path='' as $$
begin
  if not public.cbt_bank_lock_candidate_access(p_exam_id) then raise exception 'CBT bank not available.'; end if;
  return query select * from public.cbt_unchecked_start_candidate(p_exam_id);
end $$;
revoke all on function public.start_cbt_attempt(uuid) from public,anon,authenticated,service_role;
grant execute on function public.start_cbt_attempt(uuid) to authenticated;

alter function public.start_cbt_attempt_configured(uuid,text[],integer,integer,text,text) rename to cbt_unchecked_start_configured_candidate;
revoke all on function public.cbt_unchecked_start_configured_candidate(uuid,text[],integer,integer,text,text) from public,anon,authenticated,service_role;
create function public.start_cbt_attempt_configured(p_exam_id uuid,p_subjects text[],p_question_count integer default null,p_duration_minutes integer default null,p_mode text default 'practice',p_programme text default null)
returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer,mode text,duration_minutes integer,selected_subjects text[],subject_plan jsonb,resumed boolean)
language plpgsql security definer set search_path='' as $$
begin
  if not public.cbt_bank_lock_candidate_access(p_exam_id) then raise exception 'CBT bank not available.'; end if;
  return query select * from public.cbt_unchecked_start_configured_candidate(p_exam_id,p_subjects,p_question_count,p_duration_minutes,p_mode,p_programme);
end $$;
revoke all on function public.start_cbt_attempt_configured(uuid,text[],integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.start_cbt_attempt_configured(uuid,text[],integer,integer,text,text) to authenticated;

alter function public.get_cbt_attempt_paper(uuid) rename to cbt_unchecked_attempt_paper_candidate;
revoke all on function public.cbt_unchecked_attempt_paper_candidate(uuid) from public,anon,authenticated,service_role;
create function public.get_cbt_attempt_paper(p_attempt_id uuid)
returns table("position" integer,subject text,question_id uuid,question_text text,option_a text,option_b text,option_c text,option_d text)
language plpgsql security definer set search_path='' as $$
declare v_exam uuid;
begin
  select a.exam_id into v_exam from public.cbt_attempts a where a.id=p_attempt_id and a.user_id=auth.uid();
  if not found or not public.cbt_bank_lock_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  return query select * from public.cbt_unchecked_attempt_paper_candidate(p_attempt_id);
end $$;
revoke all on function public.get_cbt_attempt_paper(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_cbt_attempt_paper(uuid) to authenticated;

alter function public.save_cbt_attempt_draft(uuid,jsonb,integer) rename to cbt_unchecked_save_draft_candidate;
revoke all on function public.cbt_unchecked_save_draft_candidate(uuid,jsonb,integer) from public,anon,authenticated,service_role;
create function public.save_cbt_attempt_draft(p_attempt_id uuid,p_answers jsonb,p_question_index integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_exam uuid;
begin
  select a.exam_id into v_exam from public.cbt_attempts a where a.id=p_attempt_id and a.user_id=auth.uid();
  if not found or not public.cbt_bank_lock_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  return public.cbt_unchecked_save_draft_candidate(p_attempt_id,p_answers,p_question_index);
end $$;
revoke all on function public.save_cbt_attempt_draft(uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.save_cbt_attempt_draft(uuid,jsonb,integer) to authenticated;

-- Restricted v2 keeps only the writing protocol. Access uses the same
-- fail-closed assignment predicate as v1 (unclassified fails closed), and the
-- writing responses carry a draft revision, never a score or correctness.
-- Finalization has no application-role gateway and is intentionally excluded;
-- the scorer stays revoked and must not be exposed before a release gate.
alter function public.cbt_v2_session_gateway(uuid,uuid,boolean) rename to cbt_unchecked_v2_session_candidate;
revoke all on function public.cbt_unchecked_v2_session_candidate(uuid,uuid,boolean) from public,anon,authenticated,service_role;
create function public.cbt_v2_session_gateway(p_attempt uuid,p_request_key uuid,p_takeover boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_exam uuid;
begin
  select a.exam_id into v_exam from public.cbt_attempts a
    where a.id=p_attempt and a.user_id=auth.uid() and a.protocol='v2';
  if not found or not public.cbt_bank_lock_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  return public.cbt_unchecked_v2_session_candidate(p_attempt,p_request_key,p_takeover);
end $$;
revoke all on function public.cbt_v2_session_gateway(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.cbt_v2_session_gateway(uuid,uuid,boolean) to authenticated;

alter function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) rename to cbt_unchecked_v2_answer_candidate;
revoke all on function public.cbt_unchecked_v2_answer_candidate(uuid,uuid,integer,bigint,uuid,uuid,bigint) from public,anon,authenticated,service_role;
create function public.cbt_v2_answer_gateway(p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,p_operation_key uuid,p_session uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_exam uuid;
begin
  select a.exam_id into v_exam from public.cbt_attempts a
    where a.id=p_attempt and a.user_id=auth.uid() and a.protocol='v2';
  if not found or not public.cbt_bank_lock_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  return public.cbt_unchecked_v2_answer_candidate(p_attempt,p_question,p_selected,p_expected_revision,p_operation_key,p_session,p_generation);
end $$;
revoke all on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) to authenticated;

commit;
