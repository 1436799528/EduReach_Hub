-- Academic reference catalogue (NUC/CCMAS) and the daily quiz, built on the
-- governed CBT bank.
--
-- Why this migration exists (audit P0-1, 2026-10-04): the data backfill in
-- 20261003175703_..._v2.sql writes to these five relations, but no migration
-- ever created them. They were created out-of-band in the production project,
-- so a fresh apply of this repository aborted with
--   relation "public.ccmas_disciplines" does not exist
-- which broke `supabase db reset`, the pglite replay in tests/migrations.test.ts,
-- `npm run rls:audit` and `npm run backup:rehearsal`.
--
-- Every statement is `if not exists`, so applying this to the production project
-- is a no-op: the existing tables (and any data in them) are left exactly as
-- they are. It only comes into being on a fresh database, which is what makes
-- the backfill executable — and therefore testable — there.
--
-- Column sets are derived from what the backfill reads and writes. If the
-- production tables differ (extra columns, different defaults, a different key
-- type), `if not exists` preserves production's shape; reconcile the canonical
-- definition into this file from the live project when convenient.
--
-- Posture: server-only, like every other operational table. RLS is enabled with
-- a deny-client policy and no grant to anon or authenticated, because no
-- browser code reads these tables (see scripts/rls-posture.ts).

create table if not exists public.ccmas_disciplines (
  id uuid primary key default gen_random_uuid(),
  -- unique: the backfill's `on conflict (name) do update` requires a unique
  -- constraint on this column to be a valid conflict target.
  name text not null unique,
  source_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ccmas_programmes (
  id uuid primary key default gen_random_uuid(),
  discipline text,
  programme_name text,
  programme_code text,
  discipline_id uuid references public.ccmas_disciplines(id) on delete set null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ccmas_programmes_discipline_idx
  on public.ccmas_programmes (lower(trim(discipline)));

create index if not exists ccmas_programmes_name_idx
  on public.ccmas_programmes (lower(trim(programme_name)));

create table if not exists public.national_programme_catalogue (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid references public.ccmas_disciplines(id) on delete set null,
  programme_name text not null,
  programme_code text,
  source_url text,
  source_type text not null default 'nuc_ccmas',
  status text not null default 'catalogued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists national_programme_catalogue_name_idx
  on public.national_programme_catalogue (lower(programme_name));

create table if not exists public.daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  quiz_date date not null,
  discipline text not null default 'General',
  title text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one quiz per discipline per day, which is what the backfill's
  -- `where not exists (... quiz_date = current_date and discipline = 'General')`
  -- assumes when it looks the row up again.
  unique (quiz_date, discipline)
);

create table if not exists public.daily_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.daily_quizzes(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  position smallint not null check (position > 0),
  points integer not null default 10 check (points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create index if not exists daily_quiz_questions_quiz_idx
  on public.daily_quiz_questions (quiz_id, position);

-- Server-only posture: RLS on, deny-client policy, no grant to the client roles.
alter table public.ccmas_disciplines enable row level security;
alter table public.ccmas_programmes enable row level security;
alter table public.national_programme_catalogue enable row level security;
alter table public.daily_quizzes enable row level security;
alter table public.daily_quiz_questions enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array[
    'ccmas_disciplines',
    'ccmas_programmes',
    'national_programme_catalogue',
    'daily_quizzes',
    'daily_quiz_questions'
  ] loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', target || '_deny_client', target);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      target || '_deny_client', target
    );
    execute format('revoke all on table public.%I from anon, authenticated, public', target);
    execute format('grant select, insert, update, delete on table public.%I to service_role', target);
  end loop;
end
$$;
