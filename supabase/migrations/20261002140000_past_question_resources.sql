-- PQR-1 — the past-question resource library.
--
-- Before this, `/past-questions` described "PDF / DOC" materials that did not
-- exist: the copy promised documents while the only real content was the CBT
-- practice bank. That is a trust problem on a page whose whole purpose is exam
-- preparation, and it is not fixable in the rendered page — there was nowhere
-- for a real paper to live.
--
-- This migration adds that place. It is deliberately empty of content: no paper
-- is invented, seeded or scraped. A row becomes visible to students only when a
-- member of staff has both published it and recorded when it was verified.
--
-- Hierarchy the table supports (all optional except the exam body):
--   exam_body        JAMB | WAEC | NECO | POST-UTME
--   institution_id   a school in the directory (Post-UTME and diploma papers)
--   subject          e.g. "Physics"
--   course           a programme-specific paper, when one exists
--   paper_year       the examination year, when known
--   storstorage_path a first-party copy in the private `resource-files` bucket
--   source_url       the official source, when the paper is hosted elsewhere

create table if not exists public.past_question_resources (
  id uuid primary key default gen_random_uuid(),
  exam_body text not null check (exam_body in ('JAMB', 'WAEC', 'NECO', 'POST-UTME')),
  institution_id uuid references public.institutions(id) on delete set null,
  subject text,
  course text,
  paper_year integer check (paper_year is null or (paper_year between 1954 and 2100)),
  title text not null,
  description text,
  source_name text,
  source_url text,
  storage_path text,
  access text not null default 'view' check (access in ('view', 'download')),
  published boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A resource is either hosted by EduReach (storage_path) or points at an
-- official source (source_url). A row with neither would be a promise with no
-- document behind it, which is exactly what this table exists to prevent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.past_question_resources'::regclass and conname = 'past_question_resources_has_a_source'
  ) then
    alter table public.past_question_resources
      add constraint past_question_resources_has_a_source
      check (storage_path is not null or source_url is not null);
  end if;
end $$;

alter table public.past_question_resources enable row level security;

-- Students (signed in or not) may read only what staff published *and* verified.
-- An unverified row is invisible rather than presented as confidently available.
drop policy if exists "Verified past-question resources are public" on public.past_question_resources;
create policy "Verified past-question resources are public"
on public.past_question_resources for select
to anon, authenticated
using (published = true and verified_at is not null);

-- Reads only. Publishing is a server-side, staff-capability operation, so no
-- client role is granted insert/update/delete — the same posture as news and
-- opportunities.
revoke all on public.past_question_resources from anon, authenticated;
grant select on public.past_question_resources to anon, authenticated;

create index if not exists past_question_resources_visibility_idx
  on public.past_question_resources (exam_body, subject)
  where published = true and verified_at is not null;

create index if not exists past_question_resources_institution_idx
  on public.past_question_resources (institution_id)
  where published = true and verified_at is not null;

-- Which parts of the library have content, so the page can say "no papers
-- published for this subject yet" instead of rendering an empty list. Counts are
-- of visible rows only, and it is public because the page that asks is public.
create or replace function public.past_question_coverage(
  p_exam_body text default null
)
returns table(
  exam_body text,
  subjects bigint,
  papers bigint,
  institutions bigint,
  latest_year integer
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select r.exam_body,
         count(distinct lower(coalesce(r.subject, ''))) filter (where r.subject is not null),
         count(*),
         count(distinct r.institution_id) filter (where r.institution_id is not null),
         max(r.paper_year)
  from public.past_question_resources r
  where r.published = true
    and r.verified_at is not null
    and (p_exam_body is null or upper(r.exam_body) = upper(p_exam_body))
  group by r.exam_body
  order by r.exam_body;
$fn$;

revoke all on function public.past_question_coverage(text) from public;
grant execute on function public.past_question_coverage(text) to anon, authenticated;
