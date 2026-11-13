-- ISOLATED PROOF OF CONCEPT ONLY. NOT A DEPLOYABLE MIGRATION.
-- Current legacy RPCs and direct/privileged writers bypass this protocol. Do
-- not apply to staging/production until every writer, rollout and rollback has
-- been reconciled and the complete client/submit flow has been reviewed.

-- Isolated privilege rehearsal only. This is deliberately incompatible with
-- current/legacy clients and must not be used as a migration. Rename the
-- existing scorer so only the candidate's SECURITY DEFINER finalizer can call
-- it; leave the old signature as a fail-closed compatibility stub.
-- This cannot constrain a database owner/superuser or unknown privileged
-- functions, and service-role revocation needs a complete writer audit.
alter function public.submit_cbt_attempt_configured(uuid,jsonb) rename to cbt_candidate_internal_score;
revoke all on function public.cbt_candidate_internal_score(uuid,jsonb) from public, anon, authenticated, service_role;
create function public.submit_cbt_attempt_configured(p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,correct_answers integer,total_questions integer,breakdown jsonb)
language plpgsql security definer set search_path = '' as $fn$
begin
  raise exception 'CBT protocol upgrade required.';
end;
$fn$;
revoke all on function public.submit_cbt_attempt_configured(uuid,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.save_cbt_attempt_draft(uuid,jsonb,integer) from public, anon, authenticated, service_role;
revoke all on function public.submit_cbt_attempt(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.submit_cbt_attempt_for_subjects(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
revoke insert, update, delete on public.cbt_attempts, public.cbt_answers from public, anon, authenticated, service_role;

alter table public.cbt_attempts add column candidate_answer_revision bigint not null default 0;

create table public.cbt_candidate_operations (
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  operation_key uuid not null,
  request jsonb not null,
  outcome text not null check (outcome in ('accepted','conflict')),
  accepted_revision bigint not null,
  primary key (attempt_id, operation_key)
);
alter table public.cbt_candidate_operations enable row level security;
revoke all on public.cbt_candidate_operations from public, anon, authenticated, service_role;

-- Old attempts may have malformed JSON values or no frozen paper. Never
-- rewrite or score them through the candidate; require explicit review.
create function public.cbt_candidate_draft_valid(p_draft jsonb,p_questions uuid[],p_exam uuid)
returns boolean language sql stable set search_path = '' as $fn$
  select case when p_draft is null or jsonb_typeof(p_draft) <> 'object'
                    or coalesce(cardinality(p_questions),0) = 0 then false
  else
    (select count(distinct qid) = cardinality(p_questions)
       from unnest(p_questions) as slot(qid))
    and not exists (
      select 1 from unnest(p_questions) as slot(qid)
      left join public.exam_questions q on q.id=slot.qid and q.exam_id=p_exam
      where q.id is null
    )
    and not exists (
      select 1 from jsonb_each(p_draft) as entry(k,v)
      where case when k ~ '^[1-9][0-9]{0,8}$' then k::integer > cardinality(p_questions) else true end
         or jsonb_typeof(v) <> 'number' or v::text !~ '^[0-3]$'
    )
  end;
$fn$;
revoke all on function public.cbt_candidate_draft_valid(jsonb,uuid[],uuid) from public, anon, authenticated, service_role;

create function public.cbt_candidate_answer(
  p_attempt uuid, p_question uuid, p_selected integer, p_expected_revision bigint,
  p_operation_key uuid, p_expected_user uuid
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_request jsonb;
  v_prior public.cbt_candidate_operations%rowtype;
  v_position integer;
  v_new_answers jsonb;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user <> v_user then raise exception 'Account changed.'; end if;
  if p_attempt is null or p_question is null or p_operation_key is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid operation.';
  end if;
  if p_selected is not null and (p_selected < 0 or p_selected > 3) then raise exception 'Invalid answer.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  v_request := jsonb_build_object('kind','answer','question',p_question,'selected',p_selected,'expected',p_expected_revision);
  select * into v_prior from public.cbt_candidate_operations where attempt_id=p_attempt and operation_key=p_operation_key;
  if found then
    if v_prior.request <> v_request then raise exception 'Operation key used for different input.'; end if;
    return jsonb_build_object('outcome',case when v_prior.outcome='accepted' then 'replayed' else 'conflict' end,
      'acceptedRevision',case when v_prior.outcome='accepted' then v_prior.accepted_revision else null end,
      'revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object('outcome','closed','revision',v_attempt.candidate_answer_revision,'status',v_attempt.status);
  end if;
  -- now() is transaction-start time: a transaction can wait on the row lock
  -- across the deadline. Check wall-clock time *after* acquiring that lock.
  if v_attempt.expires_at is not null and v_attempt.expires_at <= clock_timestamp() then
    return jsonb_build_object('outcome','expired','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if not public.cbt_candidate_draft_valid(v_attempt.answers_draft,v_attempt.question_ids,v_attempt.exam_id) then
    raise exception 'CBT draft or frozen paper requires review.';
  end if;
  select u.ordinality::integer into v_position from unnest(v_attempt.question_ids) with ordinality u(id, ordinality) where u.id=p_question;
  if v_position is null then raise exception 'Question is not in this paper.'; end if;
  if p_expected_revision <> v_attempt.candidate_answer_revision then
    insert into public.cbt_candidate_operations values (p_attempt,p_operation_key,v_request,'conflict',v_attempt.candidate_answer_revision);
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  v_new_answers := case when p_selected is null then v_attempt.answers_draft - v_position::text
    else jsonb_set(v_attempt.answers_draft,array[v_position::text],to_jsonb(p_selected),true) end;
  update public.cbt_attempts set answers_draft=v_new_answers, candidate_answer_revision=candidate_answer_revision+1, updated_at=now()
    where id=p_attempt returning * into v_attempt;
  insert into public.cbt_candidate_operations values (p_attempt,p_operation_key,v_request,'accepted',v_attempt.candidate_answer_revision);
  return jsonb_build_object('outcome','accepted','acceptedRevision',v_attempt.candidate_answer_revision,
    'revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
end;
$fn$;
revoke all on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) to authenticated;

create function public.cbt_candidate_finalize(p_attempt uuid, p_expected_revision bigint, p_operation_key uuid, p_expected_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_request jsonb;
  v_prior public.cbt_candidate_operations%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user <> v_user then raise exception 'Account changed.'; end if;
  if p_attempt is null or p_expected_revision is null or p_expected_revision < 0 or p_operation_key is null then raise exception 'Invalid operation.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  v_request := jsonb_build_object('kind','finalize','expected',p_expected_revision);
  select * into v_prior from public.cbt_candidate_operations where attempt_id=p_attempt and operation_key=p_operation_key;
  if found and v_prior.request <> v_request then raise exception 'Operation key used for different input.'; end if;
  if v_prior.outcome = 'conflict' then
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_attempt.status = 'submitted' then
    select to_jsonb(r) into v_result from public.cbt_candidate_internal_score(p_attempt,'{}'::jsonb) r;
    return jsonb_build_object('outcome',case when v_prior.operation_key is null then 'already_submitted' else 'replayed' end,
      'revision',v_attempt.candidate_answer_revision,'result',v_result);
  end if;
  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object('outcome','closed','revision',v_attempt.candidate_answer_revision,'status',v_attempt.status);
  end if;
  -- A waiting transaction's now() predates its lock acquisition. Do not let a
  -- blocked finalization extend the existing 120-second delivery window.
  if v_attempt.expires_at is not null and v_attempt.expires_at + public.cbt_submit_grace() <= clock_timestamp() then
    raise exception 'This CBT attempt has expired.';
  end if;
  if not public.cbt_candidate_draft_valid(v_attempt.answers_draft,v_attempt.question_ids,v_attempt.exam_id) then
    raise exception 'CBT draft or frozen paper requires review.';
  end if;
  if p_expected_revision <> v_attempt.candidate_answer_revision then
    insert into public.cbt_candidate_operations values (p_attempt,p_operation_key,v_request,'conflict',v_attempt.candidate_answer_revision);
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  -- The existing scorer retains its deadline and 120-second delivery grace.
  -- The row lock makes its input exactly the last accepted authoritative draft.
  select to_jsonb(r) into v_result from public.cbt_candidate_internal_score(p_attempt,v_attempt.answers_draft) r;
  insert into public.cbt_candidate_operations values (p_attempt,p_operation_key,v_request,'accepted',v_attempt.candidate_answer_revision);
  return jsonb_build_object('outcome','submitted','revision',v_attempt.candidate_answer_revision,'result',v_result);
end;
$fn$;
revoke all on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) to authenticated;
