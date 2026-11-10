-- LOCAL REVIEW REQUIRED: additive CBT protocol boundary. This migration does
-- not grant v2 creation to authenticated, service_role, anon, or PUBLIC.
-- It does not install an answer writer or change deadlines / submission grace.
-- Trusted database owners can alter roles, functions, triggers and DDL and are
-- outside the SQL-enforced application boundary.

alter table public.cbt_attempts add column protocol text not null default 'legacy'
  check (protocol in ('legacy','v2'));
comment on column public.cbt_attempts.protocol is
  'Immutable database-assigned protocol. Existing and ordinary new attempts are legacy.';

do $role$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname in ('cbt_v2_executor','cbt_v2_client')) then
    raise exception 'CBT protocol role already exists; role ownership/membership must be reviewed';
  end if;
  create role cbt_v2_executor nologin noinherit;
  create role cbt_v2_client nologin noinherit;
end $role$;

-- No member of application roles may assume the internal executor. Granting it
-- to a runtime login or changing ownership is a separate, reviewed rollout.
grant usage on schema public, auth to cbt_v2_executor, cbt_v2_client;
grant execute on function auth.uid() to cbt_v2_executor;
grant execute on function public.cbt_subject_key(text) to cbt_v2_executor;
grant execute on function public.cbt_limits() to cbt_v2_executor;
grant execute on function public.plan_cbt_paper(uuid,text[],integer,jsonb) to cbt_v2_executor;
grant execute on function public.cbt_plan_summary(uuid[]) to cbt_v2_executor;
grant execute on function public.cbt_submit_grace() to cbt_v2_executor;
grant select on public.cbt_exams, public.exam_questions to cbt_v2_executor;
grant select, insert, update, delete on public.cbt_attempts to cbt_v2_executor;
grant select, insert, update, delete on public.cbt_answers to cbt_v2_executor;
create policy cbt_v2_executor_attempts on public.cbt_attempts to cbt_v2_executor using (true) with check (true);
create policy cbt_v2_executor_answers on public.cbt_answers to cbt_v2_executor using (true) with check (true);
create policy cbt_v2_executor_exams on public.cbt_exams for select to cbt_v2_executor using (true);
create policy cbt_v2_executor_questions on public.exam_questions for select to cbt_v2_executor using (true);

create function public.cbt_protocol_attempt_guard() returns trigger
language plpgsql set search_path='' as $guard$
begin
  if tg_op='INSERT' then
    if new.protocol='v2' and current_user <> 'cbt_v2_executor' then
      raise exception 'CBT protocol mismatch.';
    end if;
    return new;
  end if;
  if tg_op='UPDATE' and old.protocol is distinct from new.protocol then
    raise exception 'CBT protocol is immutable.';
  end if;
  if old.protocol='v2' and current_user <> 'cbt_v2_executor' then
    raise exception 'CBT protocol mismatch.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $guard$;
create trigger cbt_protocol_attempt_guard before insert or update or delete on public.cbt_attempts
  for each row execute function public.cbt_protocol_attempt_guard();

-- SECURITY DEFINER lookup is intentionally available only to roles that can
-- write answers or the executor. It avoids RLS hiding another owner's parent.
create function public.cbt_protocol_for_answer(p_attempt uuid) returns text
language sql stable security definer set search_path='' as $lookup$
  select a.protocol from public.cbt_attempts a where a.id=p_attempt
$lookup$;
revoke all on function public.cbt_protocol_for_answer(uuid) from public, anon, authenticated;
grant execute on function public.cbt_protocol_for_answer(uuid) to service_role, cbt_v2_executor;
create function public.cbt_protocol_answer_guard() returns trigger
language plpgsql set search_path='' as $guard$
declare v_old text; v_new text;
begin
  if tg_op <> 'INSERT' then v_old := public.cbt_protocol_for_answer(old.attempt_id); end if;
  if tg_op <> 'DELETE' then v_new := public.cbt_protocol_for_answer(new.attempt_id); end if;
  if (v_old='v2' or v_new='v2') and current_user <> 'cbt_v2_executor' then
    raise exception 'CBT protocol mismatch.';
  end if;
  -- A parent already deleted in a cascade is null; the parent trigger has
  -- already enforced permission. Foreign keys reject invalid new parents.
  if tg_op='DELETE' then return old; end if;
  return new;
end $guard$;
create trigger cbt_protocol_answer_guard before insert or update or delete on public.cbt_answers
  for each row execute function public.cbt_protocol_answer_guard();

-- Prevent admin/service edits and question cascades from changing any retained
-- v2 paper/results. Serialize against v2 paper creation at exam scope.
create function public.cbt_protocol_question_guard() returns trigger
language plpgsql security definer set search_path='' as $guard$
begin
  perform pg_advisory_xact_lock(hashtextextended('cbt-paper:' || old.exam_id::text,0));
  if exists (select 1 from public.cbt_attempts a where a.protocol='v2'
      and (old.id=any(a.question_ids) or exists
        (select 1 from public.cbt_answers ans where ans.attempt_id=a.id and ans.question_id=old.id))) then
    raise exception 'Question is referenced by a v2 CBT attempt.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $guard$;
create trigger cbt_protocol_question_guard before update or delete on public.exam_questions
  for each row execute function public.cbt_protocol_question_guard();

-- Row triggers do not fire for TRUNCATE. Protect all four tables whose bulk
-- truncation could remove v2 attempts, their paper, or their stored answers.
create function public.cbt_protocol_truncate_guard() returns trigger
language plpgsql security definer set search_path='' as $guard$
begin
  if exists (select 1 from public.cbt_attempts where protocol='v2') then
    raise exception 'Cannot truncate CBT tables while v2 attempts exist.';
  end if;
  return null;
end $guard$;
create trigger cbt_protocol_truncate_guard before truncate on public.cbt_attempts
  for each statement execute function public.cbt_protocol_truncate_guard();
create trigger cbt_protocol_truncate_guard before truncate on public.cbt_answers
  for each statement execute function public.cbt_protocol_truncate_guard();
create trigger cbt_protocol_truncate_guard before truncate on public.exam_questions
  for each statement execute function public.cbt_protocol_truncate_guard();
create trigger cbt_protocol_truncate_guard before truncate on public.cbt_exams
  for each statement execute function public.cbt_protocol_truncate_guard();

create or replace function public.cbt_start_configured_internal(
  p_exam_id uuid,
  p_subjects text[],
  p_question_count integer,
  p_duration_minutes integer,
  p_mode text,
  p_programme text,
  p_protocol text
)
returns table(
  attempt_id uuid,
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  total_questions integer,
  mode text,
  duration_minutes integer,
  selected_subjects text[],
  subject_plan jsonb,
  resumed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_mode text := lower(trim(coalesce(p_mode, 'practice')));
  v_subjects text[];
  v_missing text[];
  v_short text[];
  v_ids uuid[];
  v_total integer;
  v_minutes integer;
  v_target integer;
  v_available integer;
  v_required integer;
  v_subject text;
  v_now timestamptz := now();
  v_limits jsonb := public.cbt_limits();
  v_is_jamb boolean;
  v_quota jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_protocol not in ('legacy', 'v2') then raise exception 'Unknown CBT protocol.'; end if;
  if v_mode not in ('practice', 'mock') then raise exception 'Unknown CBT mode.'; end if;

  -- Serialize paper inspection and freezing against admin question edits.
  perform pg_advisory_xact_lock(hashtextextended('cbt-paper:' || p_exam_id::text, 0));
  select * into v_exam from public.cbt_exams where id = p_exam_id and is_active = true;
  if not found then raise exception 'CBT exam not found.'; end if;
  v_is_jamb := upper(trim(v_exam.exam_body)) = 'JAMB';

  v_subjects := array(
    select subject from (
      select (array_agg(trim(pool.value) order by pool.ordinality))[1] as subject,
             min(pool.ordinality) as first_order
      from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality as pool(value, ordinality)
      where trim(pool.value) <> ''
      group by public.cbt_subject_key(pool.value)
    ) ordered order by first_order
  );

  if coalesce(array_length(v_subjects, 1), 0) = 0 then
    raise exception 'Choose at least one subject to practise.';
  end if;
  if array_length(v_subjects, 1) > (v_limits ->> 'maxSubjects')::int then
    raise exception 'A session can include at most % subjects.', v_limits ->> 'maxSubjects';
  end if;
  -- The JAMB combination is Use of English plus three others, in practice as
  -- well as in a mock. The setup wizard caps the picker, but a request built
  -- outside the wizard must meet the same rule.
  if v_is_jamb and array_length(v_subjects, 1) > 4 then
    raise exception 'A JAMB session can include Use of English plus three other subjects.';
  end if;

  select array_agg(s) into v_missing
  from unnest(v_subjects) as s
  where not exists (
    select 1 from public.exam_questions q
    where q.exam_id = p_exam_id
      and public.cbt_subject_key(q.subject) = public.cbt_subject_key(s)
      and q.review_status <> 'rejected'
  );
  if v_missing is not null then
    raise exception 'No questions are available for: %. Remove these subjects or choose a different bank.',
      array_to_string(v_missing, ', ');
  end if;

  if v_mode = 'practice' then
    if p_question_count is not null
       and (p_question_count < (v_limits ->> 'minQuestions')::int
            or p_question_count > (v_limits ->> 'maxQuestions')::int) then
      raise exception 'Choose between % and % questions.',
        v_limits ->> 'minQuestions', v_limits ->> 'maxQuestions';
    end if;
    if v_is_jamb and not exists (
      select 1 from unnest(v_subjects) as s where public.cbt_subject_key(s) = 'english'
    ) then
      raise exception 'Use of English is compulsory for JAMB UTME. Include it in your subject combination.';
    end if;
    v_target := coalesce(p_question_count, (v_limits ->> 'maxQuestions')::int);
  else
    -- A mock is the examination's paper, not a student-sized practice run.
    if v_is_jamb and (
      array_length(v_subjects, 1) <> 4
      or not exists (
        select 1 from unnest(v_subjects) as s where public.cbt_subject_key(s) = 'english'
      )
    ) then
      raise exception 'A JAMB mock paper is Use of English plus three other subjects.';
    end if;
    v_minutes := greatest(coalesce(v_exam.duration_minutes, 120), 1);
    v_quota := coalesce(v_exam.mock_subject_quota, '{}'::jsonb);

    if v_exam.mock_question_count is not null then
      v_target := v_exam.mock_question_count;
    else
      select count(*)::int into v_available
      from public.exam_questions q
      where q.exam_id = p_exam_id
        and public.cbt_subject_key(q.subject) in (select public.cbt_subject_key(s) from unnest(v_subjects) as s)
        and q.review_status <> 'rejected';
      v_target := least(v_available, (v_limits ->> 'maxQuestions')::int);
    end if;

    -- Name the subjects that cannot meet the standard before planning, so the
    -- student is told what the bank lacks instead of receiving a short paper
    -- that silently is not a mock.
    select array_agg(format('%s needs %s questions but this bank has %s', s.subject, s.required, s.available))
      into v_short
    from (
      select s.subject,
             coalesce(
               nullif(v_quota ->> public.cbt_subject_key(s.subject), '')::int,
               nullif(v_quota ->> 'other', '')::int
             ) as required,
             count(q.id)::int as available
      from unnest(v_subjects) as s(subject)
      left join public.exam_questions q
        on q.exam_id = p_exam_id
       and public.cbt_subject_key(q.subject) = public.cbt_subject_key(s.subject)
       and q.review_status <> 'rejected'
      group by s.subject
    ) s
    where s.required is not null and s.available < s.required;
    if v_short is not null then
      raise exception 'This bank cannot fill the %-question mock paper: %.',
        v_target, array_to_string(v_short, '; ');
    end if;
  end if;

  v_ids := public.plan_cbt_paper(p_exam_id, v_subjects, v_target, v_quota);
  v_total := coalesce(array_length(v_ids, 1), 0);

  -- Practice time is derived from the paper the student actually receives, at
  -- the bank's own pace, rather than taken from the request. p_duration_minutes
  -- is still accepted for older clients but cannot shorten or extend the clock:
  -- 20 questions of a 180-in-120 paper are 14 minutes whoever asks.
  if v_mode = 'practice' then
    v_minutes := ceil(
      v_total::numeric * coalesce(v_exam.duration_minutes, 30)
      / greatest(coalesce(v_exam.mock_question_count, (v_limits ->> 'maxQuestions')::int), 1)
    )::int;
    v_minutes := least(
      (v_limits ->> 'maxMinutes')::int,
      greatest((v_limits ->> 'minMinutes')::int, v_minutes)
    );
  end if;

  if v_total = 0 then
    raise exception 'No questions are available for the selected subjects.';
  end if;
  if v_total < (v_limits ->> 'minQuestions')::int then
    raise exception 'This bank has only % questions for the selected subjects; at least % are needed to start a session. Choose different subjects or another bank.',
      v_total, v_limits ->> 'minQuestions';
  end if;
  if v_mode = 'mock' and v_exam.mock_question_count is not null and v_total < v_target then
    raise exception 'This bank can only supply % of the % questions a mock paper requires. Choose a practice session instead.',
      v_total, v_target;
  end if;

  -- The user/exam scope agrees with the unique active-attempt index and all
  -- three reachable start contracts; mode must not partition this lock.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_exam_id::text, 0));
  select a.* into v_existing from public.cbt_attempts a
    where a.user_id=v_user and a.exam_id=p_exam_id and a.status='in_progress'
    order by a.started_at desc limit 1 for update;
  if found and v_existing.protocol <> p_protocol then
    raise exception 'CBT protocol mismatch.' using errcode='P0001';
  end if;
  -- Preserve legacy's timestamp semantics; v2 uses time after waiting for the
  -- shared lock so a stale transaction timestamp cannot resume an expired row.
  if p_protocol='v2' then v_now := clock_timestamp(); end if;

  select a.* into v_existing
  from public.cbt_attempts a
  where a.user_id = v_user
    and a.exam_id = p_exam_id
    and a.mode = v_mode
    and a.status = 'in_progress'
  order by a.started_at desc
  limit 1
  for update;

  if found
     and (v_existing.expires_at is null or v_existing.expires_at > v_now)
     and v_existing.selected_subjects = v_subjects
     and coalesce(v_existing.duration_minutes, v_minutes) = v_minutes
     and coalesce(array_length(v_existing.question_ids, 1), 0) = v_total then
    return query select
      v_existing.id, v_existing.started_at, v_existing.expires_at,
      coalesce(array_length(v_existing.question_ids, 1), v_existing.total_questions),
      v_existing.mode, coalesce(v_existing.duration_minutes, v_minutes),
      v_existing.selected_subjects, v_existing.subject_plan, true;
    return;
  end if;

  update public.cbt_attempts a
  set status = 'cancelled', updated_at = v_now
  where a.user_id = v_user
    and a.exam_id = p_exam_id
    and a.status = 'in_progress';

  insert into public.cbt_attempts(
    user_id, exam_id, status, started_at, expires_at, total_questions,
    selected_subjects, mode, programme, duration_minutes, requested_questions,
    question_ids, subject_plan, answers_draft, protocol
  )
  values (
    v_user, p_exam_id, 'in_progress', v_now,
    v_now + (v_minutes || ' minutes')::interval, v_total,
    v_subjects, v_mode, nullif(trim(coalesce(p_programme, '')), ''), v_minutes,
    v_total, v_ids, public.cbt_plan_summary(v_ids), '{}'::jsonb, p_protocol
  )
  returning * into v_attempt;

  return query select
    v_attempt.id, v_attempt.started_at, v_attempt.expires_at, v_total,
    v_attempt.mode, v_attempt.duration_minutes, v_attempt.selected_subjects,
    v_attempt.subject_plan, false;
end;
$function$;

alter function public.cbt_start_configured_internal(uuid,text[],integer,integer,text,text,text) owner to cbt_v2_executor;
revoke all on function public.cbt_start_configured_internal(uuid,text[],integer,integer,text,text,text) from public, anon, authenticated, service_role;

-- Keep the legacy public signature and return shape unchanged.
create or replace function public.start_cbt_attempt_configured(
 p_exam_id uuid, p_subjects text[], p_question_count integer default null,
 p_duration_minutes integer default null, p_mode text default 'practice', p_programme text default null
) returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer,
 mode text,duration_minutes integer,selected_subjects text[],subject_plan jsonb,resumed boolean)
language sql security definer set search_path='' as $wrapper$
 select * from public.cbt_start_configured_internal(p_exam_id,p_subjects,p_question_count,p_duration_minutes,p_mode,p_programme,'legacy')
$wrapper$;

-- An additive legacy contract exposes the stored discriminator without
-- changing the return shape expected by already-deployed legacy clients.
create function public.cbt_start_attempt_legacy(
 p_exam_id uuid, p_subjects text[], p_question_count integer default null,
 p_duration_minutes integer default null, p_mode text default 'practice', p_programme text default null
) returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer,
 mode text,duration_minutes integer,selected_subjects text[],subject_plan jsonb,resumed boolean,protocol text)
language plpgsql security definer set search_path='' as $wrapper$
declare v_result record;
begin
 select * into v_result from public.start_cbt_attempt_configured(p_exam_id,p_subjects,p_question_count,p_duration_minutes,p_mode,p_programme);
 return query select v_result.attempt_id,v_result.started_at,v_result.expires_at,v_result.total_questions,
   v_result.mode,v_result.duration_minutes,v_result.selected_subjects,v_result.subject_plan,v_result.resumed,a.protocol
   from public.cbt_attempts a where a.id=v_result.attempt_id and a.user_id=auth.uid();
end $wrapper$;
revoke all on function public.cbt_start_attempt_legacy(uuid,text[],integer,integer,text,text) from public, anon, authenticated, service_role;
grant execute on function public.cbt_start_attempt_legacy(uuid,text[],integer,integer,text,text) to authenticated;

-- Narrow entry point: it is NOT executable by application roles until a
-- separately approved rollout grants access. The DB chooses protocol v2.
create function public.cbt_start_attempt_v2(
 p_exam_id uuid, p_subjects text[], p_question_count integer default null,
 p_duration_minutes integer default null, p_mode text default 'practice', p_programme text default null
) returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer,
 mode text,duration_minutes integer,selected_subjects text[],subject_plan jsonb,resumed boolean,protocol text)
language plpgsql security definer set search_path='' as $wrapper$
declare v_result record;
begin
 select * into v_result from public.cbt_start_configured_internal(p_exam_id,p_subjects,p_question_count,p_duration_minutes,p_mode,p_programme,'v2');
 return query select v_result.attempt_id,v_result.started_at,v_result.expires_at,v_result.total_questions,
   v_result.mode,v_result.duration_minutes,v_result.selected_subjects,v_result.subject_plan,v_result.resumed,a.protocol
   from public.cbt_attempts a where a.id=v_result.attempt_id and a.user_id=auth.uid();
end $wrapper$;
alter function public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text) owner to cbt_v2_executor;
revoke all on function public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text) from public, anon, authenticated, service_role;
grant execute on function public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text) to cbt_v2_client;

-- Version-specific transitions. They deliberately do not implement an answer
-- writer or submit: those require the separately reviewed v2 revision protocol.
create function public.cbt_v2_transition(p_attempt uuid, p_action text) returns text
language plpgsql security definer set search_path='' as $transition$
declare v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_now timestamptz;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'v2' then raise exception 'CBT protocol mismatch.'; end if;
  v_now := clock_timestamp();
  if p_action='abandon' then
    if v_attempt.status <> 'in_progress' then raise exception 'This CBT attempt is no longer in progress.'; end if;
    update public.cbt_attempts set status='cancelled', updated_at=v_now where id=p_attempt;
    return 'cancelled';
  elsif p_action='expire' then
    if v_attempt.status='in_progress' and v_attempt.expires_at is not null
       and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
      update public.cbt_attempts set status='expired',updated_at=v_now where id=p_attempt;
      return 'expired';
    end if;
    return v_attempt.status;
  elsif p_action='delete' then
    delete from public.cbt_attempts where id=p_attempt;
    return 'deleted';
  end if;
  raise exception 'Unknown CBT action.';
end $transition$;
alter function public.cbt_v2_transition(uuid,text) owner to cbt_v2_executor;
revoke all on function public.cbt_v2_transition(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_transition(uuid,text) to cbt_v2_client;

create or replace function public.start_cbt_attempt(p_exam_id uuid)
returns table(attempt_id uuid, started_at timestamptz, expires_at timestamptz, total_questions integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_count integer;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_exam_id::text, 0));
  select * into v_exam from public.cbt_exams where id=p_exam_id and is_active=true;
  if not found then raise exception 'CBT exam not found.'; end if;
  select count(*) into v_count from public.exam_questions where exam_id=p_exam_id;
  if v_count=0 then raise exception 'This CBT exam has no questions yet.'; end if;
  select * into v_existing from public.cbt_attempts
    where user_id=v_user and exam_id=p_exam_id and status='in_progress'
    order by started_at desc limit 1 for update;
  if found and v_existing.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if found and (v_existing.expires_at is null or v_existing.expires_at>v_now) then
    return query select v_existing.id,v_existing.started_at,v_existing.expires_at,v_existing.total_questions; return;
  end if;
  if found then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_existing.id and status='in_progress'; end if;
  insert into public.cbt_attempts(user_id,exam_id,status,started_at,expires_at,total_questions)
    values(v_user,p_exam_id,'in_progress',v_now,v_now+(v_exam.duration_minutes||' minutes')::interval,v_count)
    returning * into v_attempt;
  return query select v_attempt.id,v_attempt.started_at,v_attempt.expires_at,v_attempt.total_questions;
end;
$$;
create or replace function public.start_cbt_attempt_for_subjects(
  p_exam_id uuid,
  p_subjects text[]
)
returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_total integer;
  v_now timestamptz:=now();
  v_subjects text[];
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_exam from public.cbt_exams where id=p_exam_id and is_active=true;
  if not found then raise exception 'CBT exam not found.'; end if;

  v_subjects:=array(
    select subject from (
      select trim(u.value) as subject,min(u.ordinality) as first_order
      from unnest(coalesce(p_subjects,'{}'::text[])) with ordinality as u(value,ordinality)
      where trim(u.value)<>'' group by trim(u.value)
    ) ordered order by first_order
  );

  if coalesce(array_length(v_subjects,1),0)=0 then
    raise exception 'At least one subject is required.';
  end if;

  if upper(v_exam.exam_body)='JAMB' then
    if array_length(v_subjects,1)<>4
       or lower(trim(v_subjects[1])) not in ('use of english','english language','english') then
      raise exception 'JAMB practice requires Use of English plus three other subjects.';
    end if;
  end if;

  select count(*) into v_total
  from public.get_cbt_questions_for_subjects(p_exam_id,v_subjects);
  if v_total=0 then raise exception 'No questions are available for the selected subjects.'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || p_exam_id::text, 0)
  );

  select * into v_existing from public.cbt_attempts
  where user_id=v_user and exam_id=p_exam_id and status='in_progress'
  order by started_at desc limit 1 for update;
  if found and v_existing.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;

  select * into v_existing
  from public.cbt_attempts
  where user_id=v_user and exam_id=p_exam_id and status='in_progress'
    and selected_subjects=v_subjects
  order by started_at desc limit 1 for update;

  if found and (v_existing.expires_at is null or v_existing.expires_at>v_now) then
    return query select v_existing.id,v_existing.started_at,v_existing.expires_at,v_existing.total_questions;
    return;
  end if;

  if found then
    update public.cbt_attempts set status='expired',updated_at=v_now
    where id=v_existing.id and status='in_progress';
  end if;

  insert into public.cbt_attempts(user_id,exam_id,status,started_at,expires_at,total_questions,selected_subjects)
  values(v_user,p_exam_id,'in_progress',v_now,
         v_now+(v_exam.duration_minutes||' minutes')::interval,v_total,v_subjects)
  returning * into v_attempt;

  return query select v_attempt.id,v_attempt.started_at,v_attempt.expires_at,v_attempt.total_questions;
end;
$function$;
create or replace function public.get_cbt_attempt_paper(p_attempt_id uuid)
returns table("position" integer, subject text, question_id uuid, question_text text, option_a text, option_b text, option_c text, option_d text)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status='in_progress'
     and v_attempt.expires_at is not null
     and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  if coalesce(array_length(v_attempt.question_ids,1),0)>0 then
    return query select u.ordinality::int,trim(q.subject),q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d
    from unnest(v_attempt.question_ids) with ordinality u(value,ordinality)
    join public.exam_questions q on q.id=u.value order by u.ordinality;
    return;
  end if;
  return query select p."position",p.subject,p.question_id,p.question_text,p.option_a,p.option_b,p.option_c,p.option_d
  from public.get_cbt_questions_for_subjects(v_attempt.exam_id,v_attempt.selected_subjects) p order by p."position";
end;
$function$;

create or replace function public.save_cbt_attempt_draft(p_attempt_id uuid, p_answers jsonb, p_question_index integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := auth.uid(); v_attempt public.cbt_attempts%rowtype;
  v_clean jsonb := '{}'::jsonb; v_total integer; v_key text; v_value jsonb;
  v_index integer; v_int integer; v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  -- Strict deadline: answers cannot be added after the examination ends. The
  -- submit window below exists for delivery only.
  if v_attempt.expires_at is not null and v_attempt.expires_at <= v_now then
    raise exception 'This CBT attempt has expired.';
  end if;
  v_total := coalesce(array_length(v_attempt.question_ids,1),v_attempt.total_questions);
  for v_key,v_value in select entry.key,entry.value from jsonb_each(p_answers) entry(key,value) loop
    begin v_index:=v_key::integer; exception when others then continue; end;
    if v_index<1 or v_index>greatest(v_total,1) then continue; end if;
    if jsonb_typeof(v_value)<>'number' or v_value::text !~ '^[0-9]+$' then continue; end if;
    v_int:=(v_value::text)::integer;
    if v_int<0 or v_int>3 then continue; end if;
    v_clean:=v_clean||jsonb_build_object(v_key,v_int);
    if (select count(*) from jsonb_object_keys(v_clean))>=500 then exit; end if;
  end loop;
  update public.cbt_attempts set answers_draft=v_clean,
    current_question=case when p_question_index is not null and p_question_index>=0
      and p_question_index<greatest(v_total,1) then p_question_index else current_question end,
    updated_at=v_now where id=v_attempt.id;
  return jsonb_build_object('answers',v_clean,'questionIndex',coalesce(p_question_index,v_attempt.current_question,0),'expiresAt',v_attempt.expires_at);
end;
$function$;

create or replace function public.submit_cbt_attempt_configured(p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,correct_answers integer,total_questions integer,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_row record;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric;
  v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now(); v_answers jsonb:=coalesce(p_answers,'{}'::jsonb);
  v_explanation text; v_late_ms integer:=0;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(v_answers)<>'object' then raise exception 'Answers must be an object.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status='submitted' then
    return query select v_attempt.id,v_attempt.score,v_attempt.correct_answers,v_attempt.total_questions,coalesce(stored.breakdown,'[]'::jsonb)
    from (
      select jsonb_agg(jsonb_build_object('question',slot.ordinality,'subject',trim(q.subject),
        'selected',case when ans.selected_option is null then null else ascii(ans.selected_option)-ascii('A') end,
        'correct',ascii(q.correct_option)-ascii('A'),'explanation',q.explanation) order by slot.ordinality) breakdown
      from unnest(v_attempt.question_ids) with ordinality slot(value,ordinality)
      join public.exam_questions q on q.id=slot.value
      left join public.cbt_answers ans on ans.attempt_id=v_attempt.id and ans.question_id=q.id
    ) stored;
    return;
  end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been closed.'; end if;
  -- Arriving a moment after the countdown reaches zero is normal; arriving a
  -- window later means the paper really is over.
  if v_attempt.expires_at is not null and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  -- How late this accepted submission arrived (0 = on time), so the window
  -- can later be tightened from evidence instead of opinion.
  if v_attempt.expires_at is not null and v_now>v_attempt.expires_at then
    v_late_ms:=floor(extract(epoch from (v_now-v_attempt.expires_at))*1000)::integer;
  end if;
  for v_row in select * from public.get_cbt_attempt_paper(v_attempt.id) loop
    v_total:=v_total+1; v_selected:=null;
    if v_answers ? v_row."position"::text then
      begin v_selected:=(v_answers->>v_row."position"::text)::integer;
      exception when others then raise exception 'Invalid answer for question %.',v_row."position"; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_row."position"; end if;
    end if;
    select ascii(q.correct_option)-ascii('A'),q.explanation into v_correct,v_explanation from public.exam_questions q where q.id=v_row.question_id;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_row."position",'subject',v_row.subject,'selected',v_selected,'correct',v_correct,'explanation',v_explanation));
    insert into public.cbt_answers as target_answers(attempt_id,question_id,selected_option,is_correct,answered_at)
    values(v_attempt.id,v_row.question_id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,
      case when v_selected is null then false else v_selected=v_correct end,v_now)
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  if v_total=0 then raise exception 'This CBT attempt has no questions.'; end if;
  select count(*) into v_correct from public.cbt_answers where cbt_answers.attempt_id=v_attempt.id and cbt_answers.is_correct=true;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,answers_draft='{}'::jsonb,submission_late_ms=v_late_ms,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_correct,v_total,v_breakdown;
end;
$function$;

create or replace function public.submit_cbt_attempt(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_question public.exam_questions%rowtype;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric; v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<v_now then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id; raise exception 'This CBT attempt has expired.'; end if;
  for v_question in select * from public.exam_questions where exam_id=p_exam_id order by position loop
    v_total:=v_total+1; v_selected:=null;
    if p_answers ? v_question.position::text then
      begin v_selected:=(p_answers->>v_question.position::text)::integer; exception when others then raise exception 'Invalid answer for question %.',v_question.position; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_question.position; end if;
    end if;
    v_correct:=ascii(v_question.correct_option)-ascii('A');
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_question.position,'selected',v_selected,'correct',v_correct,'explanation',v_question.explanation));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct)
      values(v_attempt.id,v_question.id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end)
      on conflict (attempt_id,question_id) do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  select count(*) into v_correct from public.cbt_answers where attempt_id=v_attempt.id and is_correct=true;
  if v_total=0 then raise exception 'This CBT exam has no questions yet.'; end if;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_breakdown;
end;
$$;

create or replace function public.submit_cbt_attempt_for_subjects(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_row record;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric;
  v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<=v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  for v_row in select * from public.get_cbt_attempt_paper(v_attempt.id) order by "position" loop
    v_total:=v_total+1; v_selected:=null;
    if p_answers ? v_row."position"::text then
      begin v_selected:=(p_answers->>v_row."position"::text)::integer;
      exception when others then raise exception 'Invalid answer for question %.',v_row."position"; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_row."position"; end if;
    end if;
    select ascii(q.correct_option)-ascii('A') into v_correct from public.exam_questions q where q.id=v_row.question_id;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_row."position",'subject',v_row.subject,'selected',v_selected,'correct',v_correct));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct,answered_at)
    values(v_attempt.id,v_row.question_id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end,v_now)
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  if v_total=0 then raise exception 'This CBT exam has no questions for the selected subjects.'; end if;
  select count(*) into v_correct from public.cbt_answers where public.cbt_answers.attempt_id=v_attempt.id and public.cbt_answers.is_correct=true;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,answers_draft='{}'::jsonb,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_breakdown;
end;
$function$;

create or replace function public.delete_cbt_practice_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;

  -- Practice data belongs to the student. An official-style mock result is a
  -- record of an examination and is not deletable from the client at all.
  if v_attempt.mode <> 'practice' then
    raise exception 'Only practice attempts can be deleted. Mock results are kept as examination records.';
  end if;

  delete from public.cbt_attempts where id = v_attempt.id;
  return true;
end;
$fn$;

create or replace function public.abandon_cbt_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'This CBT attempt is no longer in progress.';
  end if;

  update public.cbt_attempts
  set status = 'cancelled', updated_at = v_now
  where id = v_attempt.id;
  return true;
end;
$fn$;

create or replace function public.delete_cbt_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;

  if not found then
    raise exception 'CBT attempt not found.';
  end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;

  delete from public.cbt_attempts where id = v_attempt.id;
  return true;
end;
$fn$;

create or replace function public.cbt_expire_owned_attempt(p_attempt_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts
    where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;

  -- Obtain actual time after acquiring the lock. Grace is for delivery of a
  -- submission only; this function neither extends answering time nor accepts
  -- answers. Existing non-active attempts remain unchanged.
  v_now := clock_timestamp();
  if v_attempt.status = 'in_progress' and v_attempt.expires_at is not null
     and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now
      where id=v_attempt.id and status='in_progress';
    return 'expired';
  end if;
  return v_attempt.status;
end;
$fn$;
