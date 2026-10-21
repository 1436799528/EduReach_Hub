-- Mock paper specification.
--
-- A JAMB mock was previously a generic proportional paper capped by
-- cbt_limits().maxQuestions (100), which cannot express the UTME paper:
-- Use of English 60 questions plus 40 from each of the three other subjects,
-- 180 in total, 120 minutes. The bank description has always stated that rule
-- ("every other subject is capped at 40 as in the real UTME"), and the legacy
-- question reader encoded it, so it is the project's intended standard rather
-- than an outside assumption.
--
-- The standard belongs to the exam row, not to the browser: the setup wizard,
-- the API and this database must agree on how many questions a mock contains
-- and how they are split. `mock_question_count` is null for banks with no
-- fixed standard (WAEC, NECO, Post-UTME), where a mock is the bank's own paper
-- at its configured duration.

alter table public.cbt_exams
  add column if not exists mock_question_count integer
    check (mock_question_count is null or mock_question_count > 0),
  add column if not exists mock_subject_quota jsonb not null default '{}'::jsonb;

update public.cbt_exams
set mock_question_count = 180,
    mock_subject_quota = '{"english": 60, "other": 40}'::jsonb,
    updated_at = now()
where is_active = true
  and upper(trim(exam_body)) = 'JAMB';

-- Every JAMB bank carries the standard, including banks created later.
-- Without this, a new JAMB row would have no mock paper and the API would
-- quietly fall back to a generic 100-question paper under the mock label.
create or replace function public.cbt_exams_apply_mock_spec()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if upper(trim(new.exam_body)) = 'JAMB' then
    new.mock_question_count := coalesce(new.mock_question_count, 180);
    if new.mock_subject_quota is null or new.mock_subject_quota = '{}'::jsonb then
      new.mock_subject_quota := '{"english": 60, "other": 40}'::jsonb;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists cbt_exams_apply_mock_spec on public.cbt_exams;
create trigger cbt_exams_apply_mock_spec
  before insert or update of exam_body, mock_question_count, mock_subject_quota
  on public.cbt_exams
  for each row execute function public.cbt_exams_apply_mock_spec();

-- Planning with an optional per-subject quota -------------------------------
-- p_quota maps canonical subject keys to a required number of questions; the
-- key "other" applies to every subject without an explicit entry. Quotas are
-- clamped to what the bank holds, then any shortfall between the quota total
-- and p_total is filled proportionally, so the function still returns exactly
-- the requested paper whenever the bank can serve it.
create or replace function public.plan_cbt_paper(
  p_exam_id uuid,
  p_subjects text[],
  p_total integer,
  p_quota jsonb default '{}'::jsonb
)
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
  v_desired integer;
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

  v_target := least(greatest(coalesce(p_total, v_grand), 0), v_grand);
  v_quota := array_fill(0, array[array_length(v_available, 1)])::integer[];

  -- Explicit quotas first.
  if p_quota is not null and p_quota <> '{}'::jsonb then
    for v_index in 1 .. array_length(v_subjects, 1) loop
      v_desired := coalesce(
        nullif(p_quota ->> v_subjects[v_index], '')::int,
        nullif(p_quota ->> 'other', '')::int,
        0
      );
      v_quota[v_index] := least(greatest(v_desired, 0), v_available[v_index], v_target);
    end loop;
    select coalesce(sum(value), 0) into v_assigned from unnest(v_quota) as value;
    -- A quota map larger than the requested paper is trimmed from the end so
    -- the result never exceeds p_total.
    if v_assigned > v_target then
      for v_index in reverse array_length(v_quota, 1) .. 1 loop
        exit when v_assigned <= v_target;
        v_take := least(v_quota[v_index], v_assigned - v_target);
        v_quota[v_index] := v_quota[v_index] - v_take;
        v_assigned := v_assigned - v_take;
      end loop;
    end if;
  end if;

  -- One question per selected subject before any subject takes a second, so a
  -- small paper still covers the student's whole combination.
  if v_assigned = 0 and v_target >= array_length(v_available, 1) then
    for v_index in 1 .. array_length(v_available, 1) loop
      v_quota[v_index] := least(v_available[v_index], 1);
      v_assigned := v_assigned + v_quota[v_index];
    end loop;
  end if;

  -- Fill the remainder by lowest quota-to-pool ratio, as before.
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

-- The three-argument form is superseded by the defaulted four-argument one.
drop function if exists public.plan_cbt_paper(uuid, text[], integer);

-- Start a configured attempt, with a real mock paper ------------------------
create or replace function public.start_cbt_attempt_configured(
  p_exam_id uuid,
  p_subjects text[],
  p_question_count integer default null::integer,
  p_duration_minutes integer default null::integer,
  p_mode text default 'practice'::text,
  p_programme text default null::text
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
    v_total, v_ids, public.cbt_plan_summary(v_ids), '{}'::jsonb
  )
  returning * into v_attempt;

  return query select
    v_attempt.id, v_attempt.started_at, v_attempt.expires_at, v_total,
    v_attempt.mode, v_attempt.duration_minutes, v_attempt.selected_subjects,
    v_attempt.subject_plan, false;
end;
$function$;

comment on column public.cbt_exams.mock_question_count is
  'Questions in this bank''s mock paper. Null means the bank has no fixed standard and a mock uses its usable questions up to cbt_limits().maxQuestions.';
comment on column public.cbt_exams.mock_subject_quota is
  'Per-subject question quota for a mock paper, keyed by cbt_subject_key. The "other" key applies to subjects without an explicit entry.';
