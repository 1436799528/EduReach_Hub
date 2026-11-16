begin;




-- Fresh-test and fresh-project compatibility. The live EduReach schema already
-- has these catalogue tables; IF NOT EXISTS leaves those definitions and data
-- untouched. The frontend's canonical schema snapshot predates them.
create table if not exists public.faculties (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  institution_id uuid references public.institutions(id) on delete set null,
  ccmas_discipline text,
  ccmas_source_url text,
  ccmas_verified_at timestamptz
);
create index if not exists faculties_institution_idx
  on public.faculties(institution_id, name);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now()
);
create index if not exists departments_faculty_idx
  on public.departments(faculty_id, name);

-- The production catalogue already has this table, but the canonical test
-- schema did not include it. Create the compatible base only when absent.
create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  faculty_id uuid references public.faculties(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  ccmas_programme_id uuid,
  programme_code text,
  programme_name text not null check (length(btrim(programme_name)) > 1),
  degree_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists programmes_institution_active_idx
  on public.programmes(institution_id, is_active, programme_name);
create index if not exists programmes_department_active_idx
  on public.programmes(department_id, is_active, programme_name);

-- Institution detail records are separate from the compact directory row.
-- Existing institutions remain untouched; a profile is not "verified" merely
-- because the legacy institutions.is_verified flag is true.
create table if not exists public.institution_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null unique references public.institutions(id) on delete cascade,
  ownership_type text check (ownership_type in ('federal','state','private','other')),
  established_year integer check (established_year between 1800 and 2200),
  city text,
  postal_address text,
  physical_address text,
  motto text,
  overview text,
  history text,
  mission text,
  vision text,
  campus_count integer check (campus_count is null or campus_count >= 0),
  accreditation_status text not null default 'unknown'
    check (accreditation_status in ('unknown','licensed','provisional','under_review','suspended','not_applicable')),
  profile_status text not null default 'unverified'
    check (profile_status in ('unverified','partial','verified','needs_review','archived')),
  source_url text,
  source_authority text,
  source_checked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institution_profiles_status_idx
  on public.institution_profiles(profile_status, institution_id);

create table if not exists public.institution_leadership (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role_key text not null check (role_key in (
    'chancellor','pro_chancellor','vice_chancellor','deputy_vice_chancellor',
    'registrar','bursar','librarian','other'
  )),
  person_name text not null check (length(btrim(person_name)) > 1),
  role_title text,
  tenure_start date,
  tenure_end date,
  is_current boolean not null default false,
  source_url text not null,
  source_authority text,
  source_published_at timestamptz,
  source_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_status text not null default 'source_listed'
    check (verification_status in ('source_listed','verified','needs_review','stale','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenure_end is null or tenure_start is null or tenure_end >= tenure_start)
);
create index if not exists institution_leadership_institution_idx
  on public.institution_leadership(institution_id, role_key, is_current);
create unique index if not exists institution_leadership_one_current_role_uidx
  on public.institution_leadership(institution_id, role_key)
  where is_current = true;

create table if not exists public.institution_campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campus_name text not null,
  campus_type text not null default 'campus'
    check (campus_type in ('main','campus','study_centre','teaching_hospital','research_centre','other')),
  state text,
  city text,
  address text,
  is_primary boolean not null default false,
  source_url text not null,
  source_authority text,
  source_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_status text not null default 'source_listed'
    check (verification_status in ('source_listed','verified','needs_review','stale','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institution_campuses_institution_idx
  on public.institution_campuses(institution_id, is_primary desc, campus_name);

create table if not exists public.institution_admission_modes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  admission_session text not null,
  entry_mode text not null check (entry_mode in ('UTME','DIRECT_ENTRY','JUPEB','IJMB','TRANSFER','OTHER')),
  screening_method text not null default 'unknown'
    check (screening_method in (
      'post_utme_exam','online_screening','physical_screening','interview',
      'direct_entry_screening','no_separate_screening','unknown'
    )),
  caps_processing_required boolean not null default true,
  application_channel text not null default 'institution_portal'
    check (application_channel in ('jamb_caps','institution_portal','both','other')),
  application_url text,
  procedure_summary text,
  requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requirements) = 'object'),
  source_url text not null,
  source_authority text,
  source_published_at timestamptz,
  source_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_status text not null default 'source_listed'
    check (verification_status in ('source_listed','verified','needs_review','stale','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, admission_session, entry_mode)
);
create index if not exists institution_admission_modes_session_idx
  on public.institution_admission_modes(admission_session, institution_id, verification_status);

create table if not exists public.institution_portal_guides (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  portal_type text not null check (portal_type in (
    'official_website','admission_portal','student_portal','post_utme_portal','jamb_caps','other'
  )),
  title text not null,
  destination_url text not null,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  required_items jsonb not null default '[]'::jsonb check (jsonb_typeof(required_items) = 'array'),
  safety_note text,
  source_url text not null,
  source_authority text,
  source_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_status text not null default 'source_listed'
    check (verification_status in ('source_listed','verified','needs_review','stale','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institution_portal_guides_institution_idx
  on public.institution_portal_guides(institution_id, portal_type, verification_status);

create table if not exists public.programme_entry_requirements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  programme_name text not null check (length(btrim(programme_name)) > 1),
  admission_session text not null,
  entry_mode text not null check (entry_mode in ('UTME','DIRECT_ENTRY','JUPEB','IJMB','TRANSFER','OTHER')),
  utme_subjects text[] not null default '{}',
  o_level_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(o_level_requirements) = 'object'),
  a_level_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(a_level_requirements) = 'object'),
  other_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(other_requirements) = 'object'),
  jamb_ibass_url text,
  institution_source_url text,
  source_authority text,
  source_published_at timestamptz,
  source_checked_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','source_listed','verified','needs_review','stale','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_mode <> 'UTME' or cardinality(utme_subjects) = 4)
);
create index if not exists programme_entry_requirements_lookup_idx
  on public.programme_entry_requirements(institution_id, lower(programme_name), admission_session, entry_mode);
create index if not exists programme_entry_requirements_programme_idx
  on public.programme_entry_requirements(programme_id, admission_session);


-- The legacy cutoff table is present in production but absent from the pinned
-- backend test snapshot. Create a compatible base only when it does not exist.
create table if not exists public.cutoff_marks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  programme_name text not null,
  utme_cutoff numeric(7,2),
  departmental_cutoff numeric(7,2),
  admission_session text not null,
  category text not null default 'general',
  source_id uuid,
  source_url text,
  published_at timestamptz,
  verified_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','verified','reported','unverified','outdated','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  session_id uuid
);
create index if not exists cutoff_marks_institution_session_idx
  on public.cutoff_marks(institution_id, admission_session, status);
create index if not exists cutoff_marks_programme_idx
  on public.cutoff_marks(programme_id, admission_session, status);

-- Cutoffs are typed. The existing UTME and departmental columns are retained
-- for compatibility; score_scale_max identifies whether the figure is /400,
-- /100 or another explicitly declared scale.
alter table public.cutoff_marks
  add column if not exists cutoff_type text,
  add column if not exists score_scale_max numeric(7,2),
  add column if not exists source_authority text,
  add column if not exists source_checked_at timestamptz;
alter table public.cutoff_marks
  drop constraint if exists cutoff_marks_cutoff_type_check;
alter table public.cutoff_marks
  add constraint cutoff_marks_cutoff_type_check
  check (cutoff_type is null or cutoff_type in (
    'institution_utme_minimum','programme_utme_minimum','departmental',
    'post_utme','aggregate','direct_entry'
  ));
alter table public.cutoff_marks
  drop constraint if exists cutoff_marks_score_scale_max_check;
alter table public.cutoff_marks
  add constraint cutoff_marks_score_scale_max_check
  check (score_scale_max is null or score_scale_max > 0);

create table if not exists public.student_admission_targets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  programme_id uuid references public.programmes(id) on delete set null,
  programme_name text not null check (length(btrim(programme_name)) > 1),
  entry_mode text not null check (entry_mode in ('UTME','DIRECT_ENTRY')),
  admission_session text not null,
  cutoff_mark_id uuid references public.cutoff_marks(id) on delete set null,
  target_utme_score integer check (target_utme_score between 0 and 400),
  target_post_utme_score numeric(5,2) check (target_post_utme_score between 0 and 100),
  target_aggregate_score numeric(5,2) check (target_aggregate_score between 0 and 100),
  practice_target_percent numeric(5,2) check (practice_target_percent between 0 and 100),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, institution_id, programme_name, admission_session, entry_mode)
);
create index if not exists student_admission_targets_student_idx
  on public.student_admission_targets(student_id, is_primary desc, updated_at desc);
create unique index if not exists student_admission_targets_one_primary_uidx
  on public.student_admission_targets(student_id)
  where is_primary = true;

-- Imports are staged as untrusted source captures. They cannot write directly
-- into the public institution catalogue until staff have reconciled the match.
create table if not exists public.institution_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  source_authority text not null,
  source_kind text not null check (source_kind in (
    'nuc_directory','institution_website','admission_notice','jamb_ibass',
    'nuc_accreditation','manual_official_submission','other'
  )),
  expected_rows integer check (expected_rows is null or expected_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  batch_status text not null default 'captured'
    check (batch_status in ('captured','reviewing','approved','rejected','failed')),
  retrieved_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.institution_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.institution_import_batches(id) on delete cascade,
  source_row_key text,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  raw_institution_name text,
  normalized_institution_name text,
  candidate_institution_id uuid references public.institutions(id) on delete set null,
  match_confidence numeric(5,2) check (match_confidence between 0 and 100),
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched','matched','ambiguous','approved','rejected')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institution_import_rows_batch_idx
  on public.institution_import_rows(batch_id, match_status);
create index if not exists institution_import_rows_normalized_name_idx
  on public.institution_import_rows(normalized_institution_name);


-- Preserve the established catalogue access boundaries when these tables are
-- first created on a clean schema. Existing production policies with these
-- names are retained; policies are created only when absent.
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.programmes enable row level security;
alter table public.cutoff_marks enable row level security;

do $
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='faculties' and policyname='public users can read faculties') then
    create policy "public users can read faculties" on public.faculties
      for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='faculties' and policyname='authenticated users can read faculties') then
    create policy "authenticated users can read faculties" on public.faculties
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='departments' and policyname='public users can read departments') then
    create policy "public users can read departments" on public.departments
      for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='departments' and policyname='authenticated users can read departments') then
    create policy "authenticated users can read departments" on public.departments
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='programmes' and policyname='programmes readable by authenticated users') then
    create policy "programmes readable by authenticated users" on public.programmes
      for select to authenticated using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cutoff_marks' and policyname='Public cutoff marks') then
    create policy "Public cutoff marks" on public.cutoff_marks
      for select to anon, authenticated using (status in ('verified','reported'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cutoff_marks' and policyname='Staff manage cutoff marks') then
    create policy "Staff manage cutoff marks" on public.cutoff_marks
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
        and p.role in ('admin','super_admin','moderator','contributor')))
      with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
        and p.role in ('admin','super_admin','moderator','contributor')));
  end if;
end
$;

-- Least-privilege client grants. Cutoff writes remain available only to
-- authenticated staff through the existing/created staff-only RLS policy.
revoke all on public.faculties, public.departments, public.programmes, public.cutoff_marks
  from public, anon, authenticated;
grant select on public.faculties, public.departments to anon, authenticated;
grant select on public.programmes to authenticated;
grant select on public.cutoff_marks to anon, authenticated;
grant insert, update, delete on public.cutoff_marks to authenticated;

-- RLS: verified public facts only; all unpublished and import data remains
-- inaccessible to unauthenticated students.
do $$
declare
  target text;
begin
  foreach target in array array[
    'institution_profiles','institution_leadership','institution_campuses',
    'institution_admission_modes','institution_portal_guides','programme_entry_requirements',
    'student_admission_targets','institution_import_batches','institution_import_rows'
  ] loop
    execute format('alter table public.%I enable row level security', target);
  end loop;
end
$$;

drop policy if exists institution_profiles_public_verified on public.institution_profiles;
create policy institution_profiles_public_verified on public.institution_profiles
  for select to anon, authenticated using (profile_status = 'verified');
drop policy if exists institution_profiles_staff_manage on public.institution_profiles;
create policy institution_profiles_staff_manage on public.institution_profiles
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists institution_leadership_public_verified on public.institution_leadership;
create policy institution_leadership_public_verified on public.institution_leadership
  for select to anon, authenticated using (verification_status = 'verified');
drop policy if exists institution_leadership_staff_manage on public.institution_leadership;
create policy institution_leadership_staff_manage on public.institution_leadership
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists institution_campuses_public_verified on public.institution_campuses;
create policy institution_campuses_public_verified on public.institution_campuses
  for select to anon, authenticated using (verification_status = 'verified');
drop policy if exists institution_campuses_staff_manage on public.institution_campuses;
create policy institution_campuses_staff_manage on public.institution_campuses
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists institution_admission_modes_public_verified on public.institution_admission_modes;
create policy institution_admission_modes_public_verified on public.institution_admission_modes
  for select to anon, authenticated using (verification_status = 'verified');
drop policy if exists institution_admission_modes_staff_manage on public.institution_admission_modes;
create policy institution_admission_modes_staff_manage on public.institution_admission_modes
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists institution_portal_guides_public_verified on public.institution_portal_guides;
create policy institution_portal_guides_public_verified on public.institution_portal_guides
  for select to anon, authenticated using (verification_status = 'verified');
drop policy if exists institution_portal_guides_staff_manage on public.institution_portal_guides;
create policy institution_portal_guides_staff_manage on public.institution_portal_guides
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists programme_entry_requirements_public_verified on public.programme_entry_requirements;
create policy programme_entry_requirements_public_verified on public.programme_entry_requirements
  for select to anon, authenticated using (verification_status = 'verified');
drop policy if exists programme_entry_requirements_staff_manage on public.programme_entry_requirements;
create policy programme_entry_requirements_staff_manage on public.programme_entry_requirements
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin','super_admin','moderator','contributor')));

drop policy if exists student_admission_targets_owner_manage on public.student_admission_targets;
create policy student_admission_targets_owner_manage on public.student_admission_targets
  for all to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- Import staging is server/service-role only. No browser access is granted.
revoke all on public.institution_import_batches, public.institution_import_rows
  from anon, authenticated, public;
grant all on public.institution_import_batches, public.institution_import_rows to service_role;

grant select on public.institution_profiles, public.institution_leadership,
  public.institution_campuses, public.institution_admission_modes,
  public.institution_portal_guides, public.programme_entry_requirements
  to anon, authenticated;
grant select, insert, update, delete on public.institution_profiles,
  public.institution_leadership, public.institution_campuses,
  public.institution_admission_modes, public.institution_portal_guides,
  public.programme_entry_requirements
  to authenticated;
grant select, insert, update, delete on public.student_admission_targets to authenticated;
grant all on public.institution_profiles, public.institution_leadership,
  public.institution_campuses, public.institution_admission_modes,
  public.institution_portal_guides, public.programme_entry_requirements,
  public.student_admission_targets to service_role;

commit;
