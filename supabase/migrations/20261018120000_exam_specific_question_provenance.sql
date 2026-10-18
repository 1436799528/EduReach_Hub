-- Exam-body-specific CBT structure and question provenance.
-- Existing content is deliberately marked unverified: presence in a bank does not
-- prove official provenance, correct answer keys, syllabus alignment, or format fidelity.

alter table public.cbt_exams
  add column if not exists format_status text not null default 'unverified'
    check (format_status in ('verified', 'partially_verified', 'unverified')),
  add column if not exists official_guidance_url text,
  add column if not exists format_notes text,
  add column if not exists guidance_year integer;

alter table public.exam_questions
  add column if not exists response_type text not null default 'single_choice'
    check (response_type in ('single_choice', 'multiple_select', 'short_answer', 'essay', 'calculation', 'practical', 'oral', 'matching', 'other')),
  add column if not exists source_type text not null default 'unverified'
    check (source_type in ('official_past_question', 'adapted_practice', 'original_practice', 'unverified')),
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_year integer,
  add column if not exists syllabus_topic text,
  add column if not exists difficulty text
    check (difficulty is null or difficulty in ('easy', 'moderate', 'difficult')),
  add column if not exists review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'approved', 'rejected')),
  add column if not exists format_verified boolean not null default false;

create index if not exists idx_exam_questions_review_status
  on public.exam_questions (exam_id, review_status, subject);

create index if not exists idx_exam_questions_source_type
  on public.exam_questions (source_type, source_year);

comment on column public.cbt_exams.format_status is
  'Editorial verification of the exam-body and subject paper structure; not a claim that the live examination is universally CBT.';
comment on column public.cbt_exams.official_guidance_url is
  'Official exam-body guidance used to verify paper type, subject structure, marks, or duration.';
comment on column public.exam_questions.source_type is
  'Provenance label. Existing rows default to unverified until an editor verifies their origin.';
comment on column public.exam_questions.review_status is
  'Editorial review workflow. Existing rows default to needs_review and are not automatically certified by this migration.';
comment on column public.exam_questions.format_verified is
  'Whether this item has been reviewed against the selected exam body, subject, paper type, and applicable year.';
