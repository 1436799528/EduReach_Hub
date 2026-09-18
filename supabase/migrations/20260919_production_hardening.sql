begin;

-- Production CBT hardening.
-- Answer keys must never be directly readable from the browser.
revoke all on table public.exam_questions from anon, authenticated;

-- CBT attempts and answers are server-managed. Students may read only their own
-- completed data through the protected result function below.
revoke insert, update, delete on table public.cbt_attempts from authenticated;
revoke insert, update, delete on table public.cbt_answers from authenticated;

drop policy if exists "Users can create own CBT attempts" on public.cbt_attempts;
drop policy if exists "Users can update own CBT attempts" on public.cbt_attempts;
drop policy if exists "Users can create own CBT answers" on public.cbt_answers;
drop policy if exists "Users can update own CBT answers" on public.cbt_answers;

-- Safe result projection. It exposes the answer key only for an attempt owned by
-- the authenticated student, and only after submission.
drop function if exists public.get_cbt_result(uuid);
create or replace function public.get_cbt_result(p_attempt_id uuid)
returns table (
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
  correct_option char(1),
  explanation text,
  selected_option char(1),
  is_correct boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.exam_id,
    a.score,
    a.correct_answers,
    a.total_questions,
    a.submitted_at,
    q.id,
    q.position,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_option,
    q.explanation,
    ca.selected_option,
    ca.is_correct
  from public.cbt_attempts a
  join public.cbt_answers ca on ca.attempt_id = a.id
  join public.exam_questions q on q.id = ca.question_id
  where a.id = p_attempt_id
    and a.user_id = auth.uid()
    and a.status = 'submitted'
  order by q.position;
$$;

revoke all on function public.get_cbt_result(uuid) from public;
grant execute on function public.get_cbt_result(uuid) to authenticated;

-- Service pricing is server-authoritative. The browser must never decide what
-- Paystack should charge for a catalogue service.
alter table public.service_catalog
  add column if not exists amount_kobo integer not null default 0
  check (amount_kobo >= 0);

create index if not exists service_catalog_active_key_idx
  on public.service_catalog (active, service_key);

commit;
