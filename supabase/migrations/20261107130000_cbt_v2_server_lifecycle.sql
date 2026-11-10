-- Local-only, migration-backed v2 server operations. No role membership or
-- application rollout is granted. The v2 page writer remains blocked.
-- The expected revision accounts for operations accepted by THIS SERVER; it
-- cannot reveal an unregistered offline operation on another device.

alter table public.cbt_attempts
  add column candidate_answer_revision bigint not null default 0 check (candidate_answer_revision >= 0),
  add column v2_result jsonb;

create table public.cbt_v2_operations (
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  operation_key uuid not null,
  request jsonb not null,
  outcome text not null check (outcome in ('accepted','conflict')),
  accepted_revision bigint not null check (accepted_revision >= 0),
  primary key (attempt_id, operation_key)
);
create unique index cbt_v2_one_accepted_answer_per_revision
  on public.cbt_v2_operations(attempt_id,accepted_revision)
  where request->>'kind'='answer' and outcome='accepted';
alter table public.cbt_v2_operations enable row level security;
revoke all on table public.cbt_v2_operations from public, anon, authenticated, service_role;
grant select, insert on public.cbt_v2_operations to cbt_v2_executor;
create policy cbt_v2_executor_operations on public.cbt_v2_operations to cbt_v2_executor
  using (true) with check (true);

-- Internal validation sees the real frozen paper under the executor's RLS
-- policy; callers cannot invoke this helper or bypass the parent RPC checks.
create function public.cbt_v2_draft_valid(p_draft jsonb,p_questions uuid[],p_exam uuid)
returns boolean language sql stable set search_path='' as $valid$
  select case when p_draft is null or jsonb_typeof(p_draft) <> 'object'
                    or coalesce(cardinality(p_questions),0)=0 then false
  else
    (select count(distinct qid)=cardinality(p_questions) from unnest(p_questions) slot(qid))
    and not exists (select 1 from unnest(p_questions) slot(qid)
      left join public.exam_questions q on q.id=slot.qid and q.exam_id=p_exam where q.id is null)
    and not exists (select 1 from jsonb_each(p_draft) entry(k,v)
      where case when k ~ '^[1-9][0-9]{0,8}$' then k::integer > cardinality(p_questions) else true end
        or jsonb_typeof(v)<>'number' or v::text !~ '^[0-3]$')
  end
$valid$;
revoke all on function public.cbt_v2_draft_valid(jsonb,uuid[],uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_draft_valid(jsonb,uuid[],uuid) to cbt_v2_executor;

-- Names match the existing local-only HTTP rehearsal contract. These are real
-- functions, but ordinary authenticated and service roles cannot execute them.
create function public.cbt_candidate_answer(
  p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,
  p_operation_key uuid,p_expected_user uuid
) returns jsonb language plpgsql security definer set search_path='' as $answer$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype;
  v_prior public.cbt_v2_operations%rowtype; v_request jsonb; v_position integer; v_answers jsonb;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user<>v_user then raise exception 'Account changed.'; end if;
  if p_attempt is null or p_question is null or p_operation_key is null or p_expected_revision is null
      or p_expected_revision<0 or p_expected_revision>9007199254740991 then raise exception 'Invalid operation.'; end if;
  if p_selected is not null and (p_selected<0 or p_selected>3) then raise exception 'Invalid answer.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol<>'v2' then raise exception 'CBT protocol mismatch.'; end if;
  v_request:=jsonb_build_object('kind','answer','question',p_question,'selected',p_selected,'expected',p_expected_revision);
  select * into v_prior from public.cbt_v2_operations where attempt_id=p_attempt and operation_key=p_operation_key;
  if found then
    if v_prior.request<>v_request then raise exception 'Operation key used for different input.'; end if;
    return jsonb_build_object('outcome',case when v_prior.outcome='accepted' then 'replayed' else 'conflict' end,
      'acceptedRevision',case when v_prior.outcome='accepted' then v_prior.accepted_revision else null end,
      'revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_attempt.status<>'in_progress' then
    return jsonb_build_object('outcome','closed','revision',v_attempt.candidate_answer_revision,'status',v_attempt.status);
  end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<=clock_timestamp() then
    return jsonb_build_object('outcome','expired','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if not public.cbt_v2_draft_valid(v_attempt.answers_draft,v_attempt.question_ids,v_attempt.exam_id) then
    raise exception 'CBT draft or frozen paper requires review.';
  end if;
  select u.ordinality::integer into v_position from unnest(v_attempt.question_ids) with ordinality u(id,ordinality) where u.id=p_question;
  if v_position is null then raise exception 'Question is not in this paper.'; end if;
  if p_expected_revision<>v_attempt.candidate_answer_revision then
    insert into public.cbt_v2_operations values(p_attempt,p_operation_key,v_request,'conflict',v_attempt.candidate_answer_revision);
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_attempt.candidate_answer_revision>=9007199254740991 then raise exception 'CBT revision exhausted.'; end if;
  v_answers:=case when p_selected is null then v_attempt.answers_draft-v_position::text
    else jsonb_set(v_attempt.answers_draft,array[v_position::text],to_jsonb(p_selected),true) end;
  update public.cbt_attempts set answers_draft=v_answers,candidate_answer_revision=candidate_answer_revision+1,updated_at=clock_timestamp()
    where id=p_attempt returning * into v_attempt;
  insert into public.cbt_v2_operations values(p_attempt,p_operation_key,v_request,'accepted',v_attempt.candidate_answer_revision);
  return jsonb_build_object('outcome','accepted','acceptedRevision',v_attempt.candidate_answer_revision,
    'revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
end $answer$;
alter function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) to cbt_v2_client;

create function public.cbt_candidate_finalize(p_attempt uuid,p_expected_revision bigint,p_operation_key uuid,p_expected_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $finish$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_prior public.cbt_v2_operations%rowtype;
  v_request jsonb; v_now timestamptz; v_count bigint; v_min bigint; v_max bigint;
  v_row record; v_selected integer; v_correct integer:=0; v_total integer:=0;
  v_breakdown jsonb:='[]'::jsonb; v_score numeric; v_result jsonb; v_late_ms integer:=0;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user<>v_user then raise exception 'Account changed.'; end if;
  if p_attempt is null or p_operation_key is null or p_expected_revision is null
     or p_expected_revision<0 or p_expected_revision>9007199254740991 then raise exception 'Invalid operation.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol<>'v2' then raise exception 'CBT protocol mismatch.'; end if;
  v_request:=jsonb_build_object('kind','finalize','expected',p_expected_revision);
  select * into v_prior from public.cbt_v2_operations where attempt_id=p_attempt and operation_key=p_operation_key;
  if found and v_prior.request<>v_request then raise exception 'Operation key used for different input.'; end if;
  if v_prior.outcome='conflict' then
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_attempt.status='submitted' then
    if v_attempt.v2_result is null then raise exception 'CBT result requires review.'; end if;
    return jsonb_build_object('outcome',case when v_prior.operation_key is null then 'already_submitted' else 'replayed' end,
      'revision',v_attempt.candidate_answer_revision,'result',v_attempt.v2_result);
  end if;
  if v_attempt.status<>'in_progress' then
    return jsonb_build_object('outcome','closed','revision',v_attempt.candidate_answer_revision,'status',v_attempt.status);
  end if;
  v_now:=clock_timestamp();
  if v_attempt.expires_at is not null and v_attempt.expires_at+public.cbt_submit_grace()<=v_now then
    raise exception 'This CBT attempt has expired.';
  end if;
  if not public.cbt_v2_draft_valid(v_attempt.answers_draft,v_attempt.question_ids,v_attempt.exam_id) then
    raise exception 'CBT draft or frozen paper requires review.';
  end if;
  if p_expected_revision<>v_attempt.candidate_answer_revision then
    insert into public.cbt_v2_operations values(p_attempt,p_operation_key,v_request,'conflict',v_attempt.candidate_answer_revision);
    return jsonb_build_object('outcome','conflict','revision',v_attempt.candidate_answer_revision,'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  select count(*),min(accepted_revision),max(accepted_revision) into v_count,v_min,v_max
    from public.cbt_v2_operations where attempt_id=p_attempt and outcome='accepted' and request->>'kind'='answer';
  if v_count<>v_attempt.candidate_answer_revision or
     (v_count>0 and (v_min<>1 or v_max<>v_attempt.candidate_answer_revision)) then
    raise exception 'CBT accepted operation history requires review.';
  end if;
  if v_attempt.expires_at is not null and v_now>v_attempt.expires_at then
    v_late_ms:=floor(extract(epoch from (v_now-v_attempt.expires_at))*1000)::integer;
  end if;
  for v_row in select slot.ordinality::integer as position,q.id,q.subject,q.correct_option,q.explanation
    from unnest(v_attempt.question_ids) with ordinality slot(value,ordinality)
    join public.exam_questions q on q.id=slot.value order by slot.ordinality loop
    v_total:=v_total+1;
    v_selected:=case when v_attempt.answers_draft ? v_row.position::text then (v_attempt.answers_draft->>v_row.position::text)::integer else null end;
    if v_selected is not null and v_selected=ascii(v_row.correct_option)-ascii('A') then v_correct:=v_correct+1; end if;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_row.position,'subject',trim(v_row.subject),
      'selected',v_selected,'correct',ascii(v_row.correct_option)-ascii('A'),'explanation',v_row.explanation));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct,answered_at)
      values(p_attempt,v_row.id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,
        coalesce(v_selected=ascii(v_row.correct_option)-ascii('A'),false),v_now);
  end loop;
  if v_total=0 or v_total<>cardinality(v_attempt.question_ids) then raise exception 'CBT paper requires review.'; end if;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  v_result:=jsonb_build_object('attempt_id',p_attempt,'score',v_score,'correct_answers',v_correct,'total_questions',v_total,'breakdown',v_breakdown);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,
    submission_late_ms=v_late_ms,updated_at=v_now,v2_result=v_result where id=p_attempt;
  insert into public.cbt_v2_operations values(p_attempt,p_operation_key,v_request,'accepted',v_attempt.candidate_answer_revision);
  return jsonb_build_object('outcome','submitted','revision',v_attempt.candidate_answer_revision,'result',v_result);
end $finish$;
alter function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) to cbt_v2_client;
