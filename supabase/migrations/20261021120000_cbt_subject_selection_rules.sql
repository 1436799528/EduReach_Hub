-- CBT subject-selection remediation (Phase 2A/2B, approved 2026-10-19).
--
-- Context (Phase 1 audit, verified against production gjdfatwcoosyuhakrrhh):
--   * The default JAMB route resolved to "JAMB UTME Practice Bank"
--     (33075e1c-8798-4ccc-858b-120d17b37bcd), an active bank holding only two
--     placeholder test questions and no English, because catalogue order was
--     newest-first. The 400-question comprehensive bank was never selected.
--   * Subject matching was case/trim-based in some paths and alias-aware in
--     others, so case variants could double-allocate one subject pool and
--     "Literature-in-English" never matched "Literature in English".
--   * start_cbt_attempt_configured never enforced cbt_limits().minQuestions /
--     maxQuestions on an explicit p_question_count, and enforced compulsory
--     Use of English only for JAMB mocks, not JAMB practice.
--
-- This migration:
--   1. Deactivates the two-question test bank (rows and history preserved;
--      reversible with a single UPDATE ... SET is_active = true).
--   2. Adds one canonical subject-key function and uses it in subject
--      availability, paper planning and attempt start, so counts, plans and
--      frozen papers can never disagree about what a subject is.
--   3. Enforces question-count limits and compulsory Use of English for
--      JAMB (practice and mock) in the database, not only in React/Express.
--      WAEC, NECO and Post-UTME get no imposed compulsory subject.
--
-- It deliberately does NOT touch question content, review status or any
-- student attempt/answer. The placeholder-expansion files
-- 20261020130000_expand_syllabus_practice_banks.sql and
-- 20261020140000_populate_200_per_subject.sql remain DO-NOT-APPLY (see the
-- Phase 1 audit); this file does not depend on them.

-- 1. Retire the test bank from the active catalogue ---------------------------
update public.cbt_exams
set is_active = false, updated_at = now()
where id = '33075e1c-8798-4ccc-858b-120d17b37bcd'::uuid
  and title = 'JAMB UTME Practice Bank'
  and is_active = true;

-- 2. One canonical subject key -----------------------------------------------
create or replace function public.cbt_subject_key(p_subject text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case
    when k in ('use of english', 'english language', 'english') then 'english'
    else k
  end
  from (
    select lower(regexp_replace(regexp_replace(trim(coalesce(p_subject, '')), '[-_]+', ' ', 'g'), '\s+', ' ', 'g')) as k
  ) normalized;
$function$;

revoke all on function public.cbt_subject_key(text) from public;

-- 3. Subject availability, grouped canonically --------------------------------
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
  where q.exam_id = p_exam_id and trim(q.subject) <> ''
  group by public.cbt_subject_key(q.subject)
  order by 1;
$function$;

-- 4. Paper planning, canonical subject pools ----------------------------------
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
  -- Availability per requested subject, preserving the student's chosen order.
  -- Subjects are grouped by canonical key, so 'Physics' and 'physics' (or an
  -- English alias) are one pool and can never be allocated twice. Empty
  -- subjects (no questions) are dropped here; the caller reports them.
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

  -- Every chosen subject gets one question while the target allows it, so a
  -- multi-subject session never silently excludes a subject the student picked.
  if v_target >= array_length(v_available, 1) then
    for v_index in 1 .. array_length(v_available, 1) loop
      v_quota[v_index] := least(v_available[v_index], 1);
      v_assigned := v_assigned + v_quota[v_index];
    end loop;
  end if;

  -- Then hand out the rest one question at a time to the subject that has used
  -- the smallest share of its own bank (proportional, capacity-aware).
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

  -- Materialise the frozen paper, subject block by subject block, in the
  -- order the student chose. Positions come from the array order.
  for v_slot in 1 .. array_length(v_subjects, 1) loop
    v_take := v_quota[v_slot];
    if v_take > 0 then
      v_ids := v_ids || array(
        select q.id
        from public.exam_questions q
        where q.exam_id = p_exam_id
          and public.cbt_subject_key(q.subject) = v_subjects[v_slot]
        order by q.position, q.id
        limit v_take
      );
    end if;
  end loop;

  return v_ids;
end;
$function$;

-- 5. Configured attempt start: limits + JAMB compulsory English ---------------
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

  -- De-duplicate by canonical key (case/alias variants of one subject count
  -- once), keeping the first display spelling the student sent.
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

  -- Every chosen subject must exist in this exam's bank. Naming the subject is
  -- the difference between an actionable message and "not ready yet".
  select array_agg(s) into v_missing
  from unnest(v_subjects) as s
  where not exists (
    select 1 from public.exam_questions q
    where q.exam_id = p_exam_id and public.cbt_subject_key(q.subject) = public.cbt_subject_key(s)
  );
  if v_missing is not null then
    raise exception 'No questions are available for: %. Remove these subjects or choose a different bank.',
      array_to_string(v_missing, ', ');
  end if;

  -- An explicit paper size must sit inside the server limits in both modes;
  -- only an omitted count may default to the maximum.
  if p_question_count is not null
     and (p_question_count < (v_limits ->> 'minQuestions')::int
          or p_question_count > (v_limits ->> 'maxQuestions')::int) then
    raise exception 'Choose between % and % questions.',
      v_limits ->> 'minQuestions', v_limits ->> 'maxQuestions';
  end if;

  -- Mode rules. Practice is the student's session; mock follows the exam body.
  if v_mode = 'mock' then
    if v_is_jamb and (
      array_length(v_subjects, 1) <> 4
      or public.cbt_subject_key(v_subjects[1]) <> 'english'
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
    -- Use of English is compulsory for JAMB UTME practice as well as mock.
    -- No other body has an EduReach-imposed compulsory subject.
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

  -- One live paper per exam at a time (enforced by a partial unique index).
  -- A new configuration supersedes whatever was still open; nothing is deleted.
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
