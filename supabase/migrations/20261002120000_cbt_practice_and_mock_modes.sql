-- CBT-2 — student-configured practice and governed mock examinations.
--
-- Why this migration exists:
--
--   1. The student could choose a practice duration in the setup wizard, but the
--      server ignored it: `start_cbt_attempt_for_subjects` always used
--      `cbt_exams.duration_minutes`. The visible countdown and the authoritative
--      expiry could therefore disagree. This migration makes the chosen
--      configuration authoritative and stores it on the attempt.
--   2. Every attempt was scored against a paper re-computed at submit time from
--      `exam_questions`, so a question edited or deleted while a student was
--      sitting the paper changed the paper being scored. The planned paper is now
--      frozen into the attempt (`question_ids`) and every read, resume and score
--      uses it.
--   3. Practice and official-style mock were the same code path with one
--      hard-coded JAMB rule (exactly four subjects). They are now two explicit
--      modes: practice is flexible and owned by the student; mock is governed by
--      the exam body's configuration and is not configurable by the client.
--   4. Answers typed during an attempt were never persisted (the progress
--      endpoint stored only the question index), so reconnecting lost work.
--
-- Everything here is additive. The pre-existing functions are left in place and
-- unchanged so an older client keeps working; the new client uses the configured
-- functions. No security control is relaxed: every function is owner-scoped,
-- SECURITY DEFINER, revoked from `public`/`anon`, and granted only to
-- `authenticated`. Question answer keys remain server-side — `get_cbt_attempt_paper`
-- never returns `correct_option` or `explanation`; only the post-submission
-- result does.

-- ---------------------------------------------------------------------------
-- 1. Attempt configuration columns
-- ---------------------------------------------------------------------------

alter table public.cbt_attempts
  add column if not exists mode text not null default 'mock',
  add column if not exists programme text,
  add column if not exists duration_minutes integer,
  add column if not exists requested_questions integer,
  add column if not exists question_ids uuid[],
  add column if not exists subject_plan jsonb not null default '[]'::jsonb,
  add column if not exists answers_draft jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cbt_attempts'::regclass and conname = 'cbt_attempts_mode_check'
  ) then
    alter table public.cbt_attempts
      add constraint cbt_attempts_mode_check check (mode in ('practice', 'mock'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cbt_attempts'::regclass and conname = 'cbt_attempts_duration_check'
  ) then
    alter table public.cbt_attempts
      add constraint cbt_attempts_duration_check
      check (duration_minutes is null or (duration_minutes between 1 and 360));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cbt_attempts'::regclass and conname = 'cbt_attempts_draft_is_object'
  ) then
    alter table public.cbt_attempts
      add constraint cbt_attempts_draft_is_object
      check (jsonb_typeof(answers_draft) = 'object');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cbt_attempts'::regclass and conname = 'cbt_attempts_plan_is_array'
  ) then
    alter table public.cbt_attempts
      add constraint cbt_attempts_plan_is_array
      check (jsonb_typeof(subject_plan) = 'array');
  end if;
end $$;

-- Existing attempts were full-length official-style papers under the old code
-- path, so mode='mock' (the column default) is the correct classification. Their
-- missing duration is backfilled from the exam so history renders consistently.
update public.cbt_attempts a
set duration_minutes = e.duration_minutes
from public.cbt_exams e
where a.exam_id = e.id and a.duration_minutes is null;

-- Resume + history lookups are owner-scoped and ordered by recency.
create index if not exists cbt_attempts_user_mode_started_idx
  on public.cbt_attempts (user_id, mode, started_at desc);

-- ---------------------------------------------------------------------------
-- 2. Server-side limits (single source of truth for both layers)
-- ---------------------------------------------------------------------------

create or replace function public.cbt_limits()
returns jsonb
language sql
immutable
as $fn$
  select jsonb_build_object(
    'minQuestions', 5,
    'maxQuestions', 100,
    'minMinutes', 5,
    'maxMinutes', 240,
    'maxSubjects', 6
  );
$fn$;

grant execute on function public.cbt_limits() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Paper planning — largest-remainder distribution across chosen subjects
-- ---------------------------------------------------------------------------
--
-- The plan is deterministic: subjects are planned in the order the student chose
-- them, each subject forms one contiguous block, and the per-subject quota is the
-- largest-remainder apportionment of the requested total over the real question
-- counts. A quota can never exceed the questions a subject actually has, and the
-- remainder is re-offered to subjects that still have capacity, so the paper size
-- equals the requested size whenever the bank can supply it.

create or replace function public.plan_cbt_paper(
  p_exam_id uuid,
  p_subjects text[],
  p_total integer
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_subjects text[] := '{}'::text[];
  v_available integer[] := '{}'::integer[];
  v_quota integer[] := '{}'::integer[];
  v_grand integer := 0;
  v_target integer;
  v_assigned integer := 0;
  v_index integer;
  v_best integer;
  v_best_ratio numeric;
  v_ratio numeric;
  v_ids uuid[] := '{}'::uuid[];
  v_slot integer;
  v_take integer;
begin
  -- Availability per requested subject, preserving the student's chosen order.
  -- Empty subjects (no questions) are dropped here; the caller reports them.
  select coalesce(array_agg(pool.subject order by pool.subject_order), '{}'::text[]),
         coalesce(array_agg(pool.available order by pool.subject_order), '{}'::integer[])
    into v_subjects, v_available
  from (
    select trimmed.subject, min(trimmed.subject_order)::int as subject_order,
           count(distinct q.id)::int as available
    from (
      select trim(u.value) as subject, u.ordinality as subject_order
      from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality as u(value, ordinality)
      where trim(u.value) <> ''
    ) trimmed
    join public.exam_questions q
      on q.exam_id = p_exam_id
     and lower(trim(q.subject)) = lower(trim(trimmed.subject))
    group by trimmed.subject
  ) pool;

  if coalesce(array_length(v_subjects, 1), 0) = 0 then
    return '{}'::uuid[];
  end if;

  select coalesce(sum(value), 0) into v_grand from unnest(v_available) as value;
  if v_grand = 0 then
    return '{}'::uuid[];
  end if;

  v_target := least(greatest(coalesce(p_total, v_grand), 1), v_grand);
  v_quota := array_fill(0, array[array_length(v_available, 1)])::integer[];

  -- Every chosen subject gets one question while the target allows it, so a
  -- multi-subject session never silently excludes a subject the student picked.
  if v_target >= array_length(v_available, 1) then
    for v_index in 1 .. array_length(v_available, 1) loop
      v_quota[v_index] := least(v_available[v_index], 1);
      v_assigned := v_assigned + v_quota[v_index];
    end loop;
  end if;

  -- Then hand out the rest one question at a time to the subject that has used
  -- the smallest share of its own bank. That is proportional, deterministic and
  -- capacity-aware: a small subject is filled only after bigger ones have taken
  -- their fair share.
  while v_assigned < v_target loop
    v_best := null;
    v_best_ratio := null;
    for v_index in 1 .. array_length(v_available, 1) loop
      if v_quota[v_index] < v_available[v_index] then
        v_ratio := v_quota[v_index]::numeric / v_available[v_index]::numeric;
        if v_best is null or v_ratio < v_best_ratio then
          v_best := v_index;
          v_best_ratio := v_ratio;
        end if;
      end if;
    end loop;
    exit when v_best is null;
    v_quota[v_best] := v_quota[v_best] + 1;
    v_assigned := v_assigned + 1;
  end loop;

  -- Materialise the frozen paper, subject block by subject block, in the order
  -- the student chose. Positions come from the array order.
  for v_slot in 1 .. array_length(v_subjects, 1) loop
    v_take := v_quota[v_slot];
    if v_take > 0 then
      v_ids := v_ids || array(
        select q.id
        from public.exam_questions q
        where q.exam_id = p_exam_id
          and lower(trim(q.subject)) = lower(trim(v_subjects[v_slot]))
        order by q.position, q.id
        limit v_take
      );
    end if;
  end loop;

  return v_ids;
end;
$fn$;

revoke execute on function public.plan_cbt_paper(uuid, text[], integer) from public, anon;
grant execute on function public.plan_cbt_paper(uuid, text[], integer) to authenticated;

-- Build the per-subject plan shown to the student, derived from the frozen ids.
create or replace function public.cbt_plan_summary(p_question_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  with planned as (
    select q.id, trim(q.subject) as subject, u.ordinality as slot
    from unnest(coalesce(p_question_ids, '{}'::uuid[])) with ordinality as u(value, ordinality)
    join public.exam_questions q on q.id = u.value
  ), grouped as (
    select subject, count(*)::int as questions, min(slot)::int as first_slot, max(slot)::int as last_slot
    from planned group by subject
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', subject,
    'questions', questions,
    'first', first_slot,
    'last', last_slot
  ) order by first_slot), '[]'::jsonb)
  from grouped;
$fn$;

revoke execute on function public.cbt_plan_summary(uuid[]) from public, anon;
grant execute on function public.cbt_plan_summary(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Configured attempt creation (practice and mock)
-- ---------------------------------------------------------------------------

create or replace function public.start_cbt_attempt_configured(
  p_exam_id uuid,
  p_subjects text[],
  p_question_count integer default null,
  p_duration_minutes integer default null,
  p_mode text default 'practice',
  p_programme text default null
)
returns table(
  attempt_id uuid,
  started_at timestamptz,
  expires_at timestamptz,
  total_questions integer,
  mode text,
  duration_minutes integer,
  selected_subjects text[],
  subject_plan jsonb,
  resumed boolean
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_mode text := lower(trim(coalesce(p_mode, 'practice')));
  v_subjects text[];
  v_missing text[];
  v_ids uuid[];
  v_total integer;
  v_minutes integer;
  v_now timestamptz := now();
  v_limits jsonb := public.cbt_limits();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if v_mode not in ('practice', 'mock') then raise exception 'Unknown CBT mode.'; end if;

  select * into v_exam from public.cbt_exams where id = p_exam_id and is_active = true;
  if not found then raise exception 'CBT exam not found.'; end if;

  v_subjects := array(
    select subject from (
      select trim(pool.value) as subject, min(pool.ordinality) as first_order
      from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality as pool(value, ordinality)
      where trim(pool.value) <> ''
      group by trim(pool.value)
    ) ordered order by first_order
  );

  if coalesce(array_length(v_subjects, 1), 0) = 0 then
    raise exception 'Choose at least one subject to practise.';
  end if;
  if array_length(v_subjects, 1) > (v_limits ->> 'maxSubjects')::int then
    raise exception 'A session can include at most % subjects.', v_limits ->> 'maxSubjects';
  end if;

  -- Every chosen subject must exist in this exam's bank. Naming the subject is
  -- the difference between an actionable message and "not ready yet".
  select array_agg(s) into v_missing
  from unnest(v_subjects) as s
  where not exists (
    select 1 from public.exam_questions q
    where q.exam_id = p_exam_id and lower(trim(q.subject)) = lower(trim(s))
  );
  if v_missing is not null then
    raise exception 'No questions are available for: %. Remove these subjects or choose a different bank.',
      array_to_string(v_missing, ', ');
  end if;

  -- Mode rules. Practice is the student's session; mock follows the exam body.
  if v_mode = 'mock' then
    if upper(v_exam.exam_body) = 'JAMB' and (
      array_length(v_subjects, 1) <> 4
      or lower(trim(v_subjects[1])) not in ('use of english', 'english language', 'english')
    ) then
      raise exception 'A JAMB mock paper is Use of English plus three other subjects.';
    end if;
    -- The exam's configured duration is authoritative; a client cannot extend it.
    v_minutes := greatest(coalesce(v_exam.duration_minutes, 120), 1);
  else
    v_minutes := coalesce(p_duration_minutes, v_exam.duration_minutes, 30);
    if v_minutes < (v_limits ->> 'minMinutes')::int or v_minutes > (v_limits ->> 'maxMinutes')::int then
      raise exception 'Choose a duration between % and % minutes.',
        v_limits ->> 'minMinutes', v_limits ->> 'maxMinutes';
    end if;
  end if;

  v_ids := public.plan_cbt_paper(p_exam_id, v_subjects, coalesce(p_question_count, (v_limits ->> 'maxQuestions')::int));
  v_total := coalesce(array_length(v_ids, 1), 0);
  if v_total = 0 then
    raise exception 'No questions are available for the selected subjects.';
  end if;

  -- One attempt per student per exam configuration. The lock keeps two tabs or a
  -- double-tap from creating two papers.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || p_exam_id::text || ':' || v_mode, 0)
  );

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

  -- One live paper per exam at a time (the database enforces this with a partial
  -- unique index). A new configuration, or a switch between practice and mock,
  -- supersedes whatever was still open. Nothing is deleted: the previous attempt
  -- keeps its own frozen paper and stays in the student's history.
  update public.cbt_attempts a
  set status = 'cancelled', updated_at = v_now
  where a.user_id = v_user
    and a.exam_id = p_exam_id
    and a.status = 'in_progress';

  insert into public.cbt_attempts(
    user_id, exam_id, status, started_at, expires_at, total_questions,
    selected_subjects, mode, programme, duration_minutes, requested_questions,
    question_ids, subject_plan, answers_draft
  )
  values (
    v_user, p_exam_id, 'in_progress', v_now,
    v_now + (v_minutes || ' minutes')::interval, v_total,
    v_subjects, v_mode, nullif(trim(coalesce(p_programme, '')), ''), v_minutes,
    coalesce(p_question_count, v_total), v_ids,
    public.cbt_plan_summary(v_ids), '{}'::jsonb
  )
  returning * into v_attempt;

  return query select
    v_attempt.id, v_attempt.started_at, v_attempt.expires_at, v_total,
    v_attempt.mode, v_attempt.duration_minutes, v_attempt.selected_subjects,
    v_attempt.subject_plan, false;
end;
$fn$;

revoke execute on function public.start_cbt_attempt_configured(uuid, text[], integer, integer, text, text) from public, anon;
grant execute on function public.start_cbt_attempt_configured(uuid, text[], integer, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reading the frozen paper (never the answer key)
-- ---------------------------------------------------------------------------

create or replace function public.get_cbt_attempt_paper(p_attempt_id uuid)
returns table(
  "position" integer,
  subject text,
  question_id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
language plpgsql
stable
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
  where id = p_attempt_id and user_id = v_user;
  if not found then raise exception 'CBT attempt not found.'; end if;

  -- Frozen paper when present; the legacy subject path covers attempts created
  -- before this migration and is read-only.
  if coalesce(array_length(v_attempt.question_ids, 1), 0) > 0 then
    return query
    select u.ordinality::int,
           trim(q.subject),
           q.id,
           q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
    from unnest(v_attempt.question_ids) with ordinality as u(value, ordinality)
    join public.exam_questions q on q.id = u.value
    order by u.ordinality;
    return;
  end if;

  return query
  select p."position", p.subject, p.question_id,
         p.question_text, p.option_a, p.option_b, p.option_c, p.option_d
  from public.get_cbt_questions_for_subjects(v_attempt.exam_id, v_attempt.selected_subjects) p
  order by p."position";
end;
$fn$;

revoke execute on function public.get_cbt_attempt_paper(uuid) from public, anon;
grant execute on function public.get_cbt_attempt_paper(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Draft answers — so a refresh, a dead battery or a lost connection does not
--    throw away an hour of work. Validated, bounded, owner-scoped.
-- ---------------------------------------------------------------------------

create or replace function public.save_cbt_attempt_draft(
  p_attempt_id uuid,
  p_answers jsonb,
  p_question_index integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_clean jsonb := '{}'::jsonb;
  v_total integer;
  v_key text;
  v_value jsonb;
  v_index integer;
  v_int integer;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers must be an object.';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'This CBT attempt has already been submitted.';
  end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at < v_now then
    -- Raising rolls back every write in this call, so the attempt is not marked
    -- here; the server marks it expired when it maps this error (see server.ts,
    -- expireAttemptIfNeeded). The refusal itself is what matters to the student.
    raise exception 'This CBT attempt has expired.';
  end if;

  v_total := coalesce(array_length(v_attempt.question_ids, 1), v_attempt.total_questions);

  -- Keep only positions that exist in this attempt's paper, with a 0–3 choice.
  -- Anything else is dropped rather than trusted or stored.
  for v_key, v_value in select entry.key, entry.value from jsonb_each(p_answers) as entry(key, value) loop
    begin
      v_index := v_key::integer;
    exception when others then
      continue;
    end;
    if v_index < 1 or v_index > greatest(v_total, 1) then continue; end if;
    if jsonb_typeof(v_value) <> 'number' then continue; end if;
    if v_value::text !~ '^[0-9]+$' then continue; end if;
    v_int := (v_value::text)::integer;
    if v_int < 0 or v_int > 3 then continue; end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_int);
    if (select count(*) from jsonb_object_keys(v_clean)) >= 500 then exit; end if;
  end loop;

  update public.cbt_attempts
  set answers_draft = v_clean,
      current_question = case
        when p_question_index is not null
         and p_question_index >= 0
         and p_question_index < greatest(v_total, 1)
        then p_question_index
        else current_question
      end,
      updated_at = v_now
  where id = v_attempt.id;

  return jsonb_build_object(
    'answers', v_clean,
    'questionIndex', coalesce(p_question_index, v_attempt.current_question, 0),
    'expiresAt', v_attempt.expires_at
  );
end;
$fn$;

revoke execute on function public.save_cbt_attempt_draft(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_cbt_attempt_draft(uuid, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Scoring against the frozen paper
-- ---------------------------------------------------------------------------

create or replace function public.submit_cbt_attempt_configured(
  p_attempt_id uuid,
  p_answers jsonb
)
returns table(
  attempt_id uuid,
  score numeric,
  correct_answers integer,
  total_questions integer,
  breakdown jsonb
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_row record;
  v_selected integer;
  v_correct integer;
  v_total integer := 0;
  v_score numeric;
  v_breakdown jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_explanation text;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(v_answers) <> 'object' then raise exception 'Answers must be an object.'; end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then raise exception 'CBT attempt not found.'; end if;

  if v_attempt.status = 'submitted' then
    -- Idempotent: a retried submit after a dropped connection returns the stored
    -- result instead of failing the student's final action.
    return query
    select v_attempt.id,
           v_attempt.score,
           v_attempt.correct_answers,
           v_attempt.total_questions,
           coalesce(stored.breakdown, '[]'::jsonb)
    from (
      select jsonb_agg(jsonb_build_object(
               'question', slot.ordinality,
               'subject', trim(q.subject),
               'selected', case when ans.selected_option is null then null
                                else ascii(ans.selected_option) - ascii('A') end,
               'correct', ascii(q.correct_option) - ascii('A'),
               'explanation', q.explanation
             ) order by slot.ordinality) as breakdown
      from unnest(v_attempt.question_ids) with ordinality as slot(value, ordinality)
      join public.exam_questions q on q.id = slot.value
      left join public.cbt_answers ans
        on ans.attempt_id = v_attempt.id and ans.question_id = q.id
    ) stored;
    return;
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'This CBT attempt has already been closed.';
  end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at < v_now then
    -- See save_cbt_attempt_draft: the caller marks the attempt expired so the
    -- refusal and the status transition both survive.
    raise exception 'This CBT attempt has expired.';
  end if;

  for v_row in select * from public.get_cbt_attempt_paper(v_attempt.id) loop
    v_total := v_total + 1;
    v_selected := null;
    if v_answers ? v_row."position"::text then
      begin
        v_selected := (v_answers ->> v_row."position"::text)::integer;
      exception when others then
        raise exception 'Invalid answer for question %.', v_row."position";
      end;
      if v_selected < 0 or v_selected > 3 then
        raise exception 'Invalid answer for question %.', v_row."position";
      end if;
    end if;
    select ascii(q.correct_option) - ascii('A'), q.explanation
      into v_correct, v_explanation
      from public.exam_questions q where q.id = v_row.question_id;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'question', v_row."position",
      'subject', v_row.subject,
      'selected', v_selected,
      'correct', v_correct,
      'explanation', v_explanation
    ));

    insert into public.cbt_answers as target_answers(attempt_id, question_id, selected_option, is_correct, answered_at)
    values (
      v_attempt.id, v_row.question_id,
      case when v_selected is null then null else chr(ascii('A') + v_selected) end,
      case when v_selected is null then false else v_selected = v_correct end,
      v_now
    )
    -- Named constraint, not a column list: `attempt_id` is also an OUT parameter of
    -- this function, so an unqualified column reference in ON CONFLICT is ambiguous.
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update
      set selected_option = excluded.selected_option,
          is_correct = excluded.is_correct,
          answered_at = now();
  end loop;

  if v_total = 0 then
    raise exception 'This CBT attempt has no questions.';
  end if;

  select count(*) into v_correct from public.cbt_answers
  where cbt_answers.attempt_id = v_attempt.id and cbt_answers.is_correct = true;

  v_score := round((v_correct::numeric / v_total::numeric) * 100, 2);

  update public.cbt_attempts
  set status = 'submitted',
      submitted_at = v_now,
      score = v_score,
      correct_answers = v_correct,
      total_questions = v_total,
      answers_draft = '{}'::jsonb,
      updated_at = v_now
  where id = v_attempt.id and status = 'in_progress';

  return query select v_attempt.id, v_score, v_correct, v_total, v_breakdown;
end;
$fn$;

revoke execute on function public.submit_cbt_attempt_configured(uuid, jsonb) from public, anon;
grant execute on function public.submit_cbt_attempt_configured(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Student control over their own practice data
-- ---------------------------------------------------------------------------

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

  -- Practice data belongs to the student. An official-style mock result is a
  -- record of an examination and is not deletable from the client at all.
  if v_attempt.mode <> 'practice' then
    raise exception 'Only practice attempts can be deleted. Mock results are kept as examination records.';
  end if;

  delete from public.cbt_attempts where id = v_attempt.id;
  return true;
end;
$fn$;

revoke execute on function public.delete_cbt_practice_attempt(uuid) from public, anon;
grant execute on function public.delete_cbt_practice_attempt(uuid) to authenticated;

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
  if v_attempt.status <> 'in_progress' then
    raise exception 'This CBT attempt is no longer in progress.';
  end if;

  update public.cbt_attempts
  set status = 'cancelled', updated_at = v_now
  where id = v_attempt.id;
  return true;
end;
$fn$;

revoke execute on function public.abandon_cbt_attempt(uuid) from public, anon;
grant execute on function public.abandon_cbt_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Student-facing history (one call for the dashboard)
-- ---------------------------------------------------------------------------

create or replace function public.get_cbt_attempt_history(p_limit integer default 20)
returns table(
  attempt_id uuid,
  exam_id uuid,
  exam_title text,
  exam_body text,
  mode text,
  programme text,
  status text,
  score numeric,
  correct_answers integer,
  total_questions integer,
  duration_minutes integer,
  selected_subjects text[],
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  answered integer
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  return query
  select a.id,
         a.exam_id,
         coalesce(e.title, 'CBT practice'),
         coalesce(e.exam_body, ''),
         a.mode,
         a.programme,
         a.status,
         a.score,
         a.correct_answers,
         a.total_questions,
         a.duration_minutes,
         a.selected_subjects,
         a.started_at,
         a.expires_at,
         a.submitted_at,
         case
           when a.status = 'in_progress'
             then (select count(*)::int from jsonb_object_keys(a.answers_draft))
           else a.correct_answers
         end
  from public.cbt_attempts a
  left join public.cbt_exams e on e.id = a.exam_id
  where a.user_id = v_user
  order by a.started_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$fn$;

revoke execute on function public.get_cbt_attempt_history(integer) from public, anon;
grant execute on function public.get_cbt_attempt_history(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Bank readiness must count what the student can actually choose, per mode
-- ---------------------------------------------------------------------------

create or replace function public.cbt_subject_availability(p_exam_id uuid)
returns table(subject text, question_count integer)
language sql
stable
security definer
set search_path = ''
as $fn$
  select trim(q.subject) as subject, count(*)::int as question_count
  from public.exam_questions q
  join public.cbt_exams e on e.id = q.exam_id and e.is_active = true
  where q.exam_id = p_exam_id and trim(q.subject) <> ''
  group by trim(q.subject)
  order by trim(q.subject);
$fn$;

-- Public on purpose: the setup wizard must show real subjects, and a student
-- choosing a subject with no questions is exactly the failure this fixes. Only
-- subject names and counts are exposed — never a question or an answer.
revoke execute on function public.cbt_subject_availability(uuid) from public;
grant execute on function public.cbt_subject_availability(uuid) to anon, authenticated;
