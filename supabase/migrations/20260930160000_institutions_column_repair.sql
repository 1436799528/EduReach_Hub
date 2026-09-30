-- BASE-1 (third part) — institutions columns the application reads.
--
-- public.institutions is created by 20260926200000_admin_control_centre_backend.sql
-- with id, school_name, acronym, state, institution_type, website_url and
-- created_at. The admin API (server.ts) selects five more columns that no
-- migration has ever created:
--
--   slug, admission_portal_url, student_portal_url, is_verified, updated_at
--
-- They exist in production — the console and the School Finder work today — but
-- they were added outside the repository, so a fresh project would return
-- "column does not exist" from `GET /api/admin/institutions`, and the School
-- Finder's slug-based links would have nothing to render. This migration closes
-- that gap.
--
-- On an existing project every statement is a no-op (`add column if not exists`);
-- nothing is dropped, renamed or rewritten and no existing value is touched. On a
-- project that is missing one of them, the column starts empty except
-- is_verified (defaults to false — unverified — the honest default).
--
-- This is a schema repair, not a feature: the columns were already part of the
-- application's contract, and nothing here changes what the application does.

begin;

alter table public.institutions
  add column if not exists slug text,
  add column if not exists admission_portal_url text,
  add column if not exists student_portal_url text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Non-unique: production data is not in scope for a uniqueness guarantee, and a
-- unique index would fail on duplicates this migration cannot see.
create index if not exists institutions_slug_idx on public.institutions (slug);

commit;
