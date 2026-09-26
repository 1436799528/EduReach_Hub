-- Fix CBT result RPC column/parameter ambiguity.
-- The live function is already corrected; this migration keeps the fix reproducible.
create or replace function public.get_cbt_result(p_attempt_id uuid)
returns table(
  attempt_id uuid,
  exam_id uuid,
  score numeric,
  correct_answers integer,
  total_questions integer,
  submitted_at timestamptz,
  question_id uuid,
  "position" integer,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option character,
  explanation text,
  selected_option character,
  is_correct boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id as attempt_id,
    a.exam_id as exam_id,
    a.score as score,
    a.correct_answers as correct_answers,
    a.total_questions as total_questions,
    a.submitted_at as submitted_at,
    q.id as question_id,
    q.position as "position",
    q.question_text as question_text,
    q.option_a as option_a,
    q.option_b as option_b,
    q.option_c as option_c,
    q.option_d as option_d,
    q.correct_option as correct_option,
    q.explanation as explanation,
    ca.selected_option as selected_option,
    ca.is_correct as is_correct
  from public.cbt_attempts as a
  join public.cbt_answers as ca on ca.attempt_id = a.id
  join public.exam_questions as q on q.id = ca.question_id
  where a.id = $1
    and a.user_id = auth.uid()
    and a.status = 'submitted'
  order by q.position;
$$;
