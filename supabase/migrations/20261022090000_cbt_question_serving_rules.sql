-- CBT serving rules: only usable questions reach a student.
--
-- `exam_questions.review_status` has existed since 20261018120000 with three
-- values: needs_review, approved, rejected. Nothing in the serving path read it,
-- so an item an editor had explicitly rejected could still be counted in the
-- setup wizard and drawn onto a paper. This migration makes "rejected" mean what
-- it says in every place that plans or counts a paper:
--
--   * cbt_subject_availability()  - the subject list and counts in the wizard
--   * plan_cbt_paper()            - the frozen paper
--   * get_cbt_questions_for_subjects() - the legacy reader
--   * start_cbt_attempt_configured()  - the "subject has questions" check
--
-- needs_review items remain usable. They are original practice questions whose
-- provenance is stated as unverified; hiding them would leave every bank empty,
-- and approving them automatically would be a claim nobody made. Rejected items
-- are the only ones removed.
--
-- It also drops the subject-ORDER requirement from the JAMB mock rule. A JAMB
-- mock is four subjects including Use of English; which of the four the student
-- picked first is presentation, not policy.

-- 1. Subject availability ignores rejected items -----------------------------
create or replace function public.cbt_subject_availability(p_exam_id uuid)
returns table(subject text, question_count integer)
language sql
stable security definer
set search_path to ''
as $function$
  select (mode() within group (order by trim(q.subject))) as subject,
         count(*)::int as question_count
  from public.exam_questions q
  join public.cbt_exams e on e.id = q.exam_id and e.is_active = true
  where q.exam_id = p_exam_id
    and trim(q.subject) <> ''
    and q.review_status <> 'rejected'
  group by public.cbt_subject_key(q.subject)
  order by 1;
$function$;

-- 2. Paper planning ignores rejected items -----------------------------------
create or replace function public.plan_cbt_paper(p_exam_id uuid, p_subjects text[], p_total integer)
returns uuid[]
language plpgsql
stable security definer
set search_path to ''
as $function$
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
  select coalesce(array_agg(pool.subject_key order by pool.subject_order), '{}'::text[]),
         coalesce(array_agg(pool.available order by pool.subject_order), '{}'::integer[])
    into v_subjects, v_available
  from (
    select requested.subject_key, min(requested.subject_order)::int as subject_order,
           count(distinct q.id)::int as available
    from (
      select public.cbt_subject_key(u.value) as subject_key, u.ordinality as subject_order
      from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality as u(value, ordinality)
      where trim(u.value) <> ''
    ) requested
    join public.exam_questions q
      on q.exam_id = p_exam_id
     and public.cbt_subject_key(q.subject) = requested.subject_key
     and q.review_status <> 'rejected'
    group by requested.subject_key
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

  if v_target >= array_length(v_available, 1) then
    for v_index in 1 .. array_length(v_available, 1) loop
      v_quota[v_index] := least(v_available[v_index], 1);
      v_assigned := v_assigned + v_quota[v_index];
    end loop;
  end if;

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

  for v_slot in 1 .. array_length(v_subjects, 1) loop
    v_take := v_quota[v_slot];
    if v_take > 0 then
      v_ids := v_ids || array(
        select q.id
        from public.exam_questions q
        where q.exam_id = p_exam_id
          and public.cbt_subject_key(q.subject) = v_subjects[v_slot]
          and q.review_status <> 'rejected'
        order by q.position, q.id
        limit v_take
      );
    end if;
  end loop;

  return v_ids;
end;
$function$;

-- 3. The legacy reader ignores rejected items --------------------------------
create or replace function public.get_cbt_questions_for_subjects(
  p_exam_id uuid,
  p_subjects text[]
)
returns table(
  question_id uuid,
  "position" integer,
  subject text,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
language sql
stable
security definer
set search_path = ''
as $function$
with requested as (
  select distinct trim(u.value) as subject, min(u.ordinality)::int as subject_order
  from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality u(value, ordinality)
  where trim(u.value) <> '' group by trim(u.value)
), ranked as (
  select q.id, q.subject, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         r.subject_order, e.exam_body,
         row_number() over (
           partition by case
             when lower(trim(q.subject)) in ('use of english', 'english language', 'english') then 'english'
             else lower(trim(q.subject))
           end
           order by q.position, q.id
         ) subject_position
  from public.exam_questions q
  join requested r on (
    lower(trim(r.subject)) = lower(trim(q.subject))
    or (
      lower(trim(r.subject)) in ('use of english', 'english language', 'english')
      and lower(trim(q.subject)) in ('use of english', 'english language', 'english')
    )
  )
  join public.cbt_exams e on e.id = q.exam_id and e.is_active = true
  where q.exam_id = p_exam_id
    and q.review_status <> 'rejected'
), limited as (
  select * from ranked
  where subject_position <= case
    when upper(exam_body) = 'JAMB'
      and lower(trim(subject)) in ('use of english', 'english language', 'english') then 60
    else 40
  end
)
select id, row_number() over (order by subject_order, subject_position)::int,
       subject, question_text, option_a, option_b, option_c, option_d
from limited
order by subject_order, subject_position;
$function$;

revoke execute on function public.get_cbt_questions_for_subjects(uuid, text[]) from public, anon;
grant execute on function public.get_cbt_questions_for_subjects(uuid, text[]) to authenticated;

-- 4. Configured start: usable questions, order-independent JAMB mock --------
create or replace function public.start_cbt_attempt_configured(p_exam_id uuid, p_subjects text[], p_question_count integer default null::integer, p_duration_minutes integer default null::integer, p_mode text default 'practice'::text, p_programme text default null::text)
returns table(attempt_id uuid, started_at timestamp with time zone, expires_at timestamp with time zone, total_questions integer, mode text, duration_minutes integer, selected_subjects text[], subject_plan jsonb, resumed boolean)
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
  v_ids uuid[];
  v_total integer;
  v_minutes integer;
  v_now timestamptz := now();
  v_limits jsonb := public.cbt_limits();
  v_is_jamb boolean;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if v_mode not in ('practice', 'mock') then raise exception 'Unknown CBT mode.'; end if;

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

  if p_question_count is not null
     and (p_question_count < (v_limits ->> 'minQuestions')::int
          or p_question_count > (v_limits ->> 'maxQuestions')::int) then
    raise exception 'Choose between % and % questions.',
      v_limits ->> 'minQuestions', v_limits ->> 'maxQuestions';
  end if;

  if v_mode = 'mock' then
    -- Four subjects including Use of English. The order the student picked them
    -- in decides the paper's order, not whether the paper is allowed.
    if v_is_jamb and (
      array_length(v_subjects, 1) <> 4
      or not exists (
        select 1 from unnest(v_subjects) as s where public.cbt_subject_key(s) = 'english'
      )
    ) then
      raise exception 'A JAMB mock paper is Use of English plus three other subjects.';
    end if;
    v_minutes := greatest(coalesce(v_exam.duration_minutes, 120), 1);
  else
    v_minutes := coalesce(p_duration_minutes, v_exam.duration_minutes, 30);
    if v_minutes < (v_limits ->> 'minMinutes')::int or v_minutes > (v_limits ->> 'maxMinutes')::int then
      raise exception 'Choose a duration between % and % minutes.',
        v_limits ->> 'minMinutes', v_limits ->> 'maxMinutes';
    end if;
    if v_is_jamb and not exists (
      select 1 from unnest(v_subjects) as s where public.cbt_subject_key(s) = 'english'
    ) then
      raise exception 'Use of English is compulsory for JAMB UTME. Include it in your subject combination.';
    end if;
  end if;

  v_ids := public.plan_cbt_paper(p_exam_id, v_subjects, coalesce(p_question_count, (v_limits ->> 'maxQuestions')::int));
  v_total := coalesce(array_length(v_ids, 1), 0);
  if v_total = 0 then
    raise exception 'No questions are available for the selected subjects.';
  end if;
  if v_total < (v_limits ->> 'minQuestions')::int then
    raise exception 'This bank has only % questions for the selected subjects; at least % are needed to start a session. Choose different subjects or another bank.',
      v_total, v_limits ->> 'minQuestions';
  end if;

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
$function$;

-- 5. Retire the duplicate start path ----------------------------------------
-- start_cbt_attempt_for_subjects encoded its own (stricter) JAMB rule and its
-- own planner. The Express endpoint now calls start_cbt_attempt_configured, and
-- no shipped client calls this RPC, so it is closed to client roles rather than
-- left as a second, divergent way to begin a paper.
revoke execute on function public.start_cbt_attempt_for_subjects(uuid, text[]) from public, anon, authenticated;

-- submit_cbt_attempt_for_subjects was the second scorer: it returned a
-- different breakdown shape from submit_cbt_attempt_configured and is no longer
-- called by the API, which now delegates the legacy /api/cbt/submit endpoint to
-- the configured function. Closing it to client roles removes the duplicate
-- grading path; the function stays in place for database-side callers.
revoke execute on function public.submit_cbt_attempt_for_subjects(uuid, uuid, jsonb) from public, anon, authenticated;

comment on column public.exam_questions.review_status is
  'Editorial review workflow. Rejected items are excluded from availability, planning and every paper. needs_review items are served as unverified practice material.';
