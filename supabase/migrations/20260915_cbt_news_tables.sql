create table if not exists public.cbt_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_body text not null,
  subject text not null,
  description text,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 180),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.cbt_exams(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('A','B','C','D')),
  explanation text,
  marks integer not null default 1 check (marks > 0),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, position)
);

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.cbt_exams(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired','cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  score numeric(8,2),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cbt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  selected_option char(1) check (selected_option in ('A','B','C','D')),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  category text not null default 'general',
  image_url text,
  source_name text,
  source_url text,
  author_id uuid references auth.users(id),
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cbt_exams_active_idx on public.cbt_exams (is_active, exam_body, subject);
create index if not exists exam_questions_exam_position_idx on public.exam_questions (exam_id, position);
create index if not exists cbt_attempts_user_created_idx on public.cbt_attempts (user_id, created_at desc);
create index if not exists cbt_answers_attempt_idx on public.cbt_answers (attempt_id);
create index if not exists news_articles_published_idx on public.news_articles (published, published_at desc);
