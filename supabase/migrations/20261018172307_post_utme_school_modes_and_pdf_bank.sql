-- School-specific Post-UTME methods and central PDF intake/routing registry.
-- Participating schools remain hidden from students until their method and official
-- source have been verified by an editor. Existing institutions are not opted in.

alter table public.institutions
  add column if not exists post_utme_available boolean not null default false,
  add column if not exists post_utme_method text
    check (post_utme_method is null or post_utme_method in ('cbt', 'handwritten')),
  add column if not exists post_utme_source_url text,
  add column if not exists post_utme_verified boolean not null default false;

alter table public.institutions
  drop constraint if exists institutions_post_utme_configuration_check;
alter table public.institutions
  add constraint institutions_post_utme_configuration_check
  check (
    (post_utme_available = false)
    or (post_utme_method is not null)
  );

create index if not exists institutions_post_utme_available_idx
  on public.institutions (school_name)
  where post_utme_available = true and post_utme_verified = true;

alter table public.cbt_exams
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;
create index if not exists cbt_exams_institution_id_idx
  on public.cbt_exams (institution_id, exam_body, is_active);

create table if not exists public.document_bank (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_filename text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  file_bytes bigint not null check (file_bytes > 0 and file_bytes <= 10485760),
  storage_path text not null unique,
  destination text not null default 'inbox'
    check (destination in ('inbox', 'past_questions', 'admission_guides', 'scholarships', 'news_attachments', 'school_resources', 'other')),
  exam_body text check (exam_body is null or exam_body in ('JAMB', 'WAEC', 'NECO', 'POST-UTME')),
  institution_id uuid references public.institutions(id) on delete set null,
  subject text,
  course text,
  paper_year integer check (paper_year is null or paper_year between 1954 and 2100),
  description text,
  source_name text,
  source_url text,
  status text not null default 'inbox' check (status in ('inbox', 'routed', 'rejected')),
  routed_resource_id uuid references public.past_question_resources(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  routed_by uuid references auth.users(id) on delete set null,
  routed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (destination <> 'past_questions' or exam_body is not null),
  check (destination <> 'past_questions' or exam_body <> 'POST-UTME' or institution_id is not null)
);

alter table public.document_bank enable row level security;
revoke all on public.document_bank from anon, authenticated;
grant select, insert, update, delete on public.document_bank to service_role;
create index if not exists document_bank_inbox_idx on public.document_bank (status, created_at desc);
create index if not exists document_bank_destination_idx on public.document_bank (destination, status, exam_body, institution_id);

comment on table public.document_bank is
  'Central private PDF intake registry. Staff review and route uploads to their destination; student visibility is provided by the destination module, not this inbox.';
comment on column public.institutions.post_utme_available is
  'Only institutions explicitly confirmed to conduct Post-UTME are listed in student Post-UTME setup.';
comment on column public.institutions.post_utme_method is
  'School-specific Post-UTME delivery: CBT or handwritten/paper-based.';
comment on column public.institutions.post_utme_verified is
  'Must be true, with a method and official source URL, before this school is offered to students.';
