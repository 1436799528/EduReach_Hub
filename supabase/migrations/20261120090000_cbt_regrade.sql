-- Regrade after an answer-key correction (working guide 5.5 Step 7:
-- "Regrade tool: for a given question (after a fixed answer key), find attempts
-- that included it, recompute their results, and record what changed").
--
-- The engine already stores everything a regrade needs, so this migration adds
-- no table and no column. The existing representation is:
--
--   * `cbt_answers(attempt_id, question_id, selected_option, is_correct)` — one
--     row per question in a frozen paper, written at submit. `selected_option`
--     is what the student actually chose; `is_correct` is the derived verdict.
--   * `cbt_attempts(score, correct_answers, total_questions)` — the aggregates
--     the student's result page reads.
--   * `cbt_attempts.v2_result` — the JSON snapshot the v2 finalise replay
--     returns; it carries the same verdicts.
--
-- A regrade is therefore a RECOMPUTE, not a delta: take `selected_option` from
-- the answer row (never from a request body), compare it with the question's
-- current `correct_option`, rewrite the derived verdict, then re-derive the
-- aggregates from the answers. That is what makes the operation idempotent —
-- running it twice writes the same values the second time and reports zero
-- changes. Nothing is incremented, so nothing can be double-applied.
--
-- What is preserved:
--   * the student's answer (`selected_option`) is never touched;
--   * `total_questions` (the denominator the paper was graded out of) is kept,
--     so a question deleted later cannot silently move a student's percentage;
--   * `submitted_at`, `submission_late_ms` and the attempt status are untouched.
--
-- What the caller cannot do:
--   * a student or the browser role cannot execute this function — it is
--     revoked from public/anon/authenticated and granted to service_role only,
--     so the admin API (capability `cbt.manage`) is the only way in;
--   * a wrong question id is refused before any row is locked.
--
-- The function is owned by cbt_v2_executor because the protocol fence allows
-- only that role to rewrite answers or attempts that belong to a v2 paper. A
-- v2 key cannot currently be corrected at all (the fence refuses any edit to a
-- question a v2 attempt references), but if that changes the regrade stays the
-- one path that can re-grade either protocol.

create or replace function public.cbt_regrade_question(p_question uuid, p_apply boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $regrade$
declare
  v_question public.exam_questions%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_answer public.cbt_answers%rowtype;
  v_total integer;
  v_correct integer;
  v_score numeric;
  v_before_correct boolean;
  v_after_correct boolean;
  v_before_score numeric;
  v_before_correct_answers integer;
  v_flipped boolean;
  v_moved boolean;
  v_scanned integer := 0;
  v_changed integer := 0;
  v_unchanged integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_breakdown jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_question is null then raise exception 'CBT question not found.'; end if;
  select * into v_question from public.exam_questions where id = p_question;
  if not found then raise exception 'CBT question not found.'; end if;

  -- Only submitted attempts can be regraded: an in-progress paper has no result
  -- yet and will be graded with the corrected key when it is handed in. The
  -- join to cbt_answers is what proves the question was actually in the paper —
  -- it is the answer row, not a date range or a subject guess, that identifies
  -- an affected attempt.
  for v_attempt in
    select a.* from public.cbt_attempts a
    where a.status = 'submitted'
      and exists (select 1 from public.cbt_answers ans
                  where ans.attempt_id = a.id and ans.question_id = p_question)
    order by a.id
    for update
  loop
    v_scanned := v_scanned + 1;

    select * into v_answer from public.cbt_answers ans
      where ans.attempt_id = v_attempt.id and ans.question_id = p_question;
    if not found then continue; end if;

    v_before_correct := coalesce(v_answer.is_correct, false);
    v_after_correct := v_answer.selected_option is not null
      and v_answer.selected_option = v_question.correct_option;
    v_flipped := v_before_correct is distinct from v_after_correct;

    -- The denominator stays what the student was graded out of.
    v_total := coalesce(v_attempt.total_questions, 0);
    if v_total <= 0 then
      select count(*) into v_total from public.cbt_answers ans where ans.attempt_id = v_attempt.id;
    end if;
    if v_total <= 0 then
      -- No answer rows and no recorded total: nothing can be recomputed. Leave
      -- the attempt as it is and let the operator see it as untouched.
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    v_before_score := v_attempt.score;
    v_before_correct_answers := v_attempt.correct_answers;

    -- Compute the new tally without depending on whether the write happens, so
    -- a preview and an apply report the same numbers.
    select count(*) into v_correct from public.cbt_answers ans
      where ans.attempt_id = v_attempt.id and ans.is_correct is true;
    if v_before_correct and not v_after_correct then v_correct := v_correct - 1; end if;
    if (not v_before_correct) and v_after_correct then v_correct := v_correct + 1; end if;
    if v_correct < 0 then v_correct := 0; end if;
    if v_correct > v_total then v_correct := v_total; end if;

    v_score := round((v_correct::numeric / v_total::numeric) * 100, 2);
    v_moved := v_flipped
      or v_score is distinct from v_before_score
      or v_correct is distinct from v_before_correct_answers;

    if not v_moved then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    v_changed := v_changed + 1;

    if p_apply then
      if v_flipped then
        update public.cbt_answers set is_correct = v_after_correct where id = v_answer.id;
      end if;
      update public.cbt_attempts
        set score = v_score, correct_answers = v_correct, updated_at = v_now
        where id = v_attempt.id;
      -- The v2 replay payload carries its own copy of the verdicts; keep it in
      -- step with the answer rows it was built from.
      if v_attempt.protocol = 'v2' and v_attempt.v2_result is not null then
        select jsonb_agg(jsonb_build_object(
            'question', slot.ordinality,
            'subject', trim(q.subject),
            'selected', case when ans.selected_option is null then null
                             else ascii(ans.selected_option) - ascii('A') end,
            'correct', ascii(q.correct_option) - ascii('A'),
            'explanation', q.explanation) order by slot.ordinality)
          into v_breakdown
        from unnest(v_attempt.question_ids) with ordinality slot(value, ordinality)
        join public.exam_questions q on q.id = slot.value
        left join public.cbt_answers ans
          on ans.attempt_id = v_attempt.id and ans.question_id = q.id;
        update public.cbt_attempts
          set v2_result = jsonb_set(
                jsonb_set(
                  jsonb_set(v2_result, '{score}', to_jsonb(v_score)),
                  '{correct_answers}', to_jsonb(v_correct)),
                '{breakdown}', coalesce(v_breakdown, '[]'::jsonb))
          where id = v_attempt.id;
      end if;
    end if;

    if jsonb_array_length(v_rows) < 500 then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'attemptId', v_attempt.id,
        'userId', v_attempt.user_id,
        'protocol', v_attempt.protocol,
        'changed', true,
        'before', jsonb_build_object('score', v_before_score,
                                     'correctAnswers', v_before_correct_answers,
                                     'isCorrect', v_before_correct),
        'after', jsonb_build_object('score', v_score,
                                    'correctAnswers', v_correct,
                                    'isCorrect', v_after_correct)));
    end if;
  end loop;

  return jsonb_build_object(
    'applied', coalesce(p_apply, true),
    'questionId', v_question.id,
    'examId', v_question.exam_id,
    'correctOption', v_question.correct_option,
    'grader', 'regrade-1',
    'scanned', v_scanned,
    'changed', v_changed,
    'unchanged', v_unchanged,
    'truncated', v_changed > jsonb_array_length(v_rows),
    'attempts', v_rows);
end
$regrade$;

-- The protocol fence lets only the internal executor rewrite v2 answers; owning
-- the function as that role is what allows a v2 attempt to be re-graded at all.
alter function public.cbt_regrade_question(uuid, boolean) owner to cbt_v2_executor;
revoke all on function public.cbt_regrade_question(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cbt_regrade_question(uuid, boolean) to service_role;

comment on function public.cbt_regrade_question(uuid, boolean) is
  'Recompute submitted attempts that contain a question after its answer key was corrected. Idempotent; p_apply=false previews. service_role only.';
