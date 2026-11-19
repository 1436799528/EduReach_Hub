-- Question reports: the student's half of the content-quality loop.
--
-- The working guide asks for this in 5.3 Step I ("each question shows a small
-- Report a problem button … reports go to a triage queue … a question with
-- several reports is auto-flagged") and again in 5.7 (report from the review
-- screen). Until now nothing recorded a student's complaint, so a wrong answer
-- key could only be found by a reviewer reading the bank.
--
-- This migration is additive. It creates one table, two counter columns on
-- `exam_questions`, and the trigger that keeps them correct. It changes no
-- existing row, hides nothing and deletes nothing.
--
-- Deliberate limits, so the behaviour is explainable later:
--
--   * One report per student, per question, per category. A student tapping the
--     button five times is one complaint, not five; the never-dismissed partial
--     unique index is what enforces it. A dismissed report may be filed again,
--     because a dismissed complaint that turns out to be right should be able
--     to come back.
--   * `open_report_count` counts reports that are still `open`. Triaging or
--     resolving a report lowers the count, so a question that has been dealt
--     with stops shouting.
--   * The flag is advisory. It records that a question needs attention; it does
--     NOT remove the question from new papers. Excluding flagged questions from
--     paper selection changes exam-engine behaviour and is a separate, reviewed
--     decision.

-- ---------------------------------------------------------------------------
-- 1. The report itself
-- ---------------------------------------------------------------------------

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  attempt_id uuid references public.cbt_attempts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('wrong_answer', 'typo', 'image', 'other')),
  detail text,
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A free-text complaint is capped so a paste cannot become a payload, and an
  -- empty string is stored as NULL rather than as a value that looks written.
  constraint question_reports_detail_length
    check (detail is null or (char_length(btrim(detail)) between 1 and 500))
);

comment on table public.question_reports is
  'Student reports about a question (wrong answer, typo, image, other) and their triage state.';
comment on column public.question_reports.attempt_id is
  'The attempt the student was sitting, when the report came from an exam. NULL for a report from the review screen after submit.';
comment on column public.question_reports.status is
  'open -> triaged -> resolved | dismissed. Only `open` reports count toward exam_questions.open_report_count.';

-- One open report per student per question per category.
create unique index if not exists question_reports_one_per_student
  on public.question_reports (question_id, user_id, category)
  where status <> 'dismissed';

-- Triage reads newest open first; the question index answers "how many".
create index if not exists question_reports_triage_idx
  on public.question_reports (status, created_at desc);
create index if not exists question_reports_question_idx
  on public.question_reports (question_id);

-- ---------------------------------------------------------------------------
-- 2. The counter and the advisory flag on the question
-- ---------------------------------------------------------------------------

alter table public.exam_questions
  add column if not exists open_report_count integer not null default 0,
  add column if not exists report_flagged_at timestamptz;

comment on column public.exam_questions.open_report_count is
  'Open (untriaged) student reports about this question. Maintained by trigger.';
comment on column public.exam_questions.report_flagged_at is
  'When the open-report count first reached the attention threshold. Advisory: it does not hide the question from papers.';

-- Recomputes the counter and the flag from the reports themselves, so a manual
-- fix of a report row can never leave a stale count behind.
create or replace function public.question_reports_refresh_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question uuid := coalesce(new.question_id, old.question_id);
  v_open integer;
begin
  select count(*) into v_open
    from public.question_reports
   where question_id = v_question
     and status = 'open';

  update public.exam_questions
     set open_report_count = v_open,
         -- Flag at three open reports: one report is an opinion, three are a
         -- pattern. Clearing it when the count falls back under the threshold
         -- keeps the flag honest after triage rather than sticky.
         report_flagged_at = case
           when v_open >= 3 then coalesce(report_flagged_at, now())
           else null
         end
   where id = v_question;

  return null;
end;
$$;

drop trigger if exists question_reports_refresh_flag on public.question_reports;
create trigger question_reports_refresh_flag
  after insert or update of status, question_id or delete on public.question_reports
  for each row execute function public.question_reports_refresh_flag();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
--
-- A student may file a report and read their own. Students may not read other
-- students' reports (a report can quote the question), may not edit a report
-- after filing, and may not triage. Triage runs on the server with a role that
-- bypasses RLS and re-checks the `cbt.read` / `cbt.manage` capability, so no
-- admin policy is needed here — and none is granted.

alter table public.question_reports enable row level security;

drop policy if exists question_reports_owner_read on public.question_reports;
create policy question_reports_owner_read on public.question_reports
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists question_reports_owner_insert on public.question_reports;
create policy question_reports_owner_insert on public.question_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.question_reports from anon;
revoke update, delete on public.question_reports from authenticated;
grant select, insert on public.question_reports to authenticated;

-- The counter columns are maintained by the trigger. A direct write would be a
-- way for a client to hide a flagged question or to make one look clean, so the
-- columns are not writable by a student role; the trigger runs as definer.
revoke update (open_report_count, report_flagged_at) on public.exam_questions from authenticated;
