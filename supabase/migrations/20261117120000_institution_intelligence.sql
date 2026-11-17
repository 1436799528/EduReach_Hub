-- Institution intelligence and admissions guidance.
--
-- Additive only. Nothing here drops, renames or rewrites an existing table,
-- column or row. The legacy `institutions.is_verified` flag is untouched and is
-- never treated as evidence of research: verification lives on the new tables,
-- field by field, with a source, a session and a date.
--
-- Prerequisites in the hosted project that this repository has never created
-- (`edureach_sources`, `national_programme_catalogue`, `programmes`,
-- `faculties`, `departments`, `cutoff_marks`) are referenced, not redefined:
-- every constraint that points at them is attached only when the target table
-- exists, so the migration replays on a fresh PostgreSQL (tests, staging) and
-- is a no-op on production where those tables already exist. The one exception
-- is `edureach_sources`, which is created here when absent because every fact in
-- this feature needs a source row and the shape below is the production shape
-- exactly (six columns, verified against the live catalogue on 2026-11-17).
--
-- Score discipline encoded in the schema:
--   * A benchmark carries its own scale (`score_scale_min/max`), so a 400-scale
--     UTME score can never be compared with a 100-scale screening aggregate by
--     accident. `institution_admission_benchmarks` refuses a value outside its
--     declared scale.
--   * National minimums, institution thresholds, programme minimums, screening
--     aggregates, departmental merit, catchment and ELDS are seven distinct
--     `benchmark_type` values. A national minimum is never a departmental
--     cut-off.
--   * "The institution did not publish this" has its own state
--     (`unpublished_by_institution`) instead of a guess or a zero.

-- ---------------------------------------------------------------------------
-- 0. Prerequisite and schema-drift repair
-- ---------------------------------------------------------------------------

do $sources$
begin
  if to_regclass('public.edureach_sources') is null then
    execute $ddl$
create table public.edureach_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  authority text,
  source_type text not null default 'official',
  created_at timestamptz not null default now()
);
$ddl$;
    alter table public.edureach_sources enable row level security;
    create policy edureach_sources_public_read on public.edureach_sources
      for select to anon, authenticated using (true);
    create policy edureach_sources_staff_manage on public.edureach_sources
      for all to authenticated
      using (public.is_staff(auth.uid()))
      with check (public.is_staff(auth.uid()));
    grant select on public.edureach_sources to anon, authenticated;
    grant insert, update, delete on public.edureach_sources to service_role;
    raise notice 'INSTITUTION-1: created edureach_sources (absent in this database).';
  else
    raise notice 'INSTITUTION-1: edureach_sources already exists; left untouched.';
  end if;
end
$sources$;

-- The hosted `institutions` table grew portal and Post-UTME columns outside this
-- repository's migration history. A fresh database (CI, staging) needs the same
-- columns for the intelligence feature to attach a portal guide to the
-- institution it belongs to. Column additions only: no row is read or written.
alter table public.institutions add column if not exists slug text;
alter table public.institutions add column if not exists updated_at timestamptz not null default now();
alter table public.institutions add column if not exists admission_portal_url text;
alter table public.institutions add column if not exists student_portal_url text;
alter table public.institutions add column if not exists is_verified boolean not null default false;
alter table public.institutions add column if not exists post_utme_available boolean not null default false;
alter table public.institutions add column if not exists post_utme_method text;
alter table public.institutions add column if not exists post_utme_source_url text;
alter table public.institutions add column if not exists post_utme_verified boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. Aliases: never merge institution rows implicitly
-- ---------------------------------------------------------------------------

create table if not exists public.institution_aliases (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  alias_name text not null,
  alias_type text not null default 'alternate_name'
    check (alias_type in ('acronym','alternate_name','former_name','official_variant','duplicate_candidate')),
  preferred_display boolean not null default false,
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution_id, alias_name)
);
create index if not exists institution_aliases_search_idx
  on public.institution_aliases(lower(alias_name));

-- ---------------------------------------------------------------------------
-- 2. Profile: identity, ownership, history, imagery. One row per institution.
-- ---------------------------------------------------------------------------

create table if not exists public.institution_profiles (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  official_name text,
  ownership text
    check (ownership is null or ownership in ('federal','state','private','other','unknown')),
  institution_category text
    check (institution_category is null or institution_category in ('university','polytechnic','monotechnic','college_of_education','college_of_agriculture','college_of_nursing','innovation_enterprise_institute','other')),
  year_established smallint,
  history_summary text,
  overview text,
  mission text,
  vision text,
  mandate text,
  postal_address text,
  city text,
  country text not null default 'Nigeria',
  latitude numeric(9,6),
  longitude numeric(9,6),
  logo_url text,
  hero_image_url text,
  official_website_url text,
  admission_portal_url text,
  student_portal_url text,
  postgraduate_portal_url text,
  profile_status text not null default 'draft'
    check (profile_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','unpublished_by_institution','disputed','outdated')),
  profile_verified_at timestamptz,
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_established is null or year_established between 1800 and 2100),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

-- ---------------------------------------------------------------------------
-- 3. Leadership: effective-dated offices, acting markers, one current holder
-- ---------------------------------------------------------------------------

create table if not exists public.institution_leadership (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  office_key text not null
    check (office_key in ('chancellor','pro_chancellor','vice_chancellor','rector','provost','president','deputy_vice_chancellor','registrar','bursar','university_librarian','other')),
  office_title text not null,
  full_name text not null,
  acting_status text not null default 'substantive'
    check (acting_status in ('substantive','acting','interim','designate','unknown')),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  biography text,
  portrait_url text,
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (not (is_current and ends_on is not null))
);
create index if not exists institution_leadership_current_idx
  on public.institution_leadership(institution_id, office_key, is_current);
-- One current holder per office. A second current record for the same office is
-- a data error, not a hierarchy: the previous holder must be closed first.
create unique index if not exists institution_leadership_one_current_office_idx
  on public.institution_leadership(institution_id, office_key, office_title)
  where is_current = true;

-- ---------------------------------------------------------------------------
-- 4. Campuses
-- ---------------------------------------------------------------------------

create table if not exists public.institution_campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campus_name text not null,
  campus_type text not null default 'campus'
    check (campus_type in ('main','permanent','temporary','satellite','teaching_hospital','study_centre','other')),
  address text,
  city text,
  state text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  description text,
  image_url text,
  is_active boolean not null default true,
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
create index if not exists institution_campuses_institution_idx
  on public.institution_campuses(institution_id, is_active);

-- ---------------------------------------------------------------------------
-- 5. Academic units: faculty, college, school, institute, centre, department
-- ---------------------------------------------------------------------------

create table if not exists public.institution_academic_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  parent_unit_id uuid references public.institution_academic_units(id) on delete set null,
  unit_type text not null
    check (unit_type in ('faculty','college','school','institute','centre','department','division','other')),
  unit_name text not null,
  slug text not null,
  description text,
  website_url text,
  is_active boolean not null default true,
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (parent_unit_id, institution_id)
    references public.institution_academic_units(id, institution_id) on delete cascade
);
create index if not exists institution_academic_units_institution_idx
  on public.institution_academic_units(institution_id, unit_type, is_active);
create index if not exists institution_academic_units_parent_idx
  on public.institution_academic_units(parent_unit_id);
create unique index if not exists institution_academic_units_unique_path_idx
  on public.institution_academic_units(
    institution_id,
    coalesce(parent_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    unit_type,
    slug
  );

-- ---------------------------------------------------------------------------
-- 6. Programme offerings: what this institution actually offers
-- ---------------------------------------------------------------------------

create table if not exists public.institution_programme_offerings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_unit_id uuid references public.institution_academic_units(id) on delete set null,
  campus_id uuid references public.institution_campuses(id) on delete set null,
  national_programme_id uuid,
  programme_code text,
  programme_name text not null,
  degree_title text,
  award_level text,
  duration_years numeric(3,1),
  delivery_mode text,
  admission_session text,
  is_active boolean not null default true,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (academic_unit_id, institution_id)
    references public.institution_academic_units(id, institution_id) on delete restrict,
  foreign key (campus_id, institution_id)
    references public.institution_campuses(id, institution_id) on delete restrict,
  check (duration_years is null or duration_years between 0.5 and 15)
);
create index if not exists institution_programme_offerings_institution_idx
  on public.institution_programme_offerings(institution_id, is_active, publication_status);
create index if not exists institution_programme_offerings_unit_idx
  on public.institution_programme_offerings(academic_unit_id);
create unique index if not exists institution_programme_offerings_name_session_idx
  on public.institution_programme_offerings(institution_id, lower(programme_name), coalesce(admission_session,''));
create unique index if not exists institution_programme_offerings_code_idx
  on public.institution_programme_offerings(institution_id, programme_code, coalesce(admission_session,''))
  where programme_code is not null;

-- ---------------------------------------------------------------------------
-- 7. Admission routes: entry mode is not assessment method
-- ---------------------------------------------------------------------------

create table if not exists public.institution_admission_routes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  admission_session text not null,
  entry_mode text not null
    check (entry_mode in ('UTME','DIRECT_ENTRY','JUPEB','IJMB','PRE_DEGREE','DIPLOMA','ND','HND','TRANSFER','OTHER')),
  assessment_methods text[] not null default '{}',
  first_choice_required boolean,
  change_of_institution_allowed boolean,
  application_url text,
  opens_on date,
  closes_on date,
  eligibility_notes text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  source_published_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_on is null or opens_on is null or closes_on >= opens_on),
  unique (institution_id, admission_session, entry_mode)
);

-- ---------------------------------------------------------------------------
-- 8. Programme requirements: subjects, O'Level, A'Level, minimum score
-- ---------------------------------------------------------------------------

create table if not exists public.institution_programme_requirements (
  id uuid primary key default gen_random_uuid(),
  programme_offering_id uuid not null references public.institution_programme_offerings(id) on delete cascade,
  admission_route_id uuid references public.institution_admission_routes(id) on delete set null,
  admission_session text not null,
  entry_mode text not null
    check (entry_mode in ('UTME','DIRECT_ENTRY','JUPEB','IJMB','PRE_DEGREE','DIPLOMA','ND','HND','TRANSFER','OTHER')),
  utme_subjects text[] not null default '{}',
  o_level_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(o_level_requirements) = 'object'),
  a_level_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(a_level_requirements) = 'object'),
  other_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(other_requirements) = 'object'),
  minimum_utme_score numeric(7,2),
  minimum_utme_scale numeric(7,2) not null default 400,
  first_choice_required boolean,
  notes text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','unpublished_by_institution','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  source_published_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minimum_utme_score is null or minimum_utme_score >= 0),
  check (minimum_utme_scale > 0),
  check (minimum_utme_score is null or minimum_utme_score <= minimum_utme_scale),
  unique (programme_offering_id, admission_session, entry_mode)
);
create index if not exists institution_programme_requirements_route_idx
  on public.institution_programme_requirements(admission_route_id, admission_session);

-- ---------------------------------------------------------------------------
-- 9. National policy: kept apart from institution and programme thresholds
-- ---------------------------------------------------------------------------

create table if not exists public.national_admission_policies (
  id uuid primary key default gen_random_uuid(),
  authority text not null,
  admission_session text not null,
  institution_category text not null
    check (institution_category in ('university','college_of_nursing','polytechnic','monotechnic','college_of_education','college_of_agriculture','innovation_enterprise_institute','other')),
  entry_mode text not null default 'UTME',
  policy_type text not null
    check (policy_type in ('minimum_tolerable_utme_score','minimum_admission_age','other')),
  numeric_value numeric(8,3),
  value_unit text not null,
  notes text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text not null,
  source_published_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (authority, admission_session, institution_category, entry_mode, policy_type)
);

-- ---------------------------------------------------------------------------
-- 10. Typed benchmarks with an explicit scale
-- ---------------------------------------------------------------------------

create table if not exists public.institution_admission_benchmarks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  programme_offering_id uuid references public.institution_programme_offerings(id) on delete cascade,
  admission_session text not null,
  benchmark_type text not null
    check (benchmark_type in (
      'national_minimum','institution_utme_eligibility','programme_utme_minimum',
      'screening_aggregate','departmental_merit','catchment','elds',
      'post_utme_test','other'
    )),
  benchmark_label text not null,
  benchmark_value numeric(8,3) not null,
  score_scale_min numeric(8,3) not null default 0,
  score_scale_max numeric(8,3) not null,
  category_key text not null default 'general',
  state_category text,
  is_eligibility_floor boolean not null default false,
  calculation_method text,
  calculation_weights jsonb not null default '{}'::jsonb
    check (jsonb_typeof(calculation_weights) = 'object'),
  notes text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','unpublished_by_institution','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  source_published_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score_scale_max > score_scale_min),
  -- A national minimum is a policy floor, never a programme cut-off.
  constraint institution_admission_benchmarks_national_minimum_scope
    check (benchmark_type <> 'national_minimum' or programme_offering_id is null),
  constraint institution_admission_benchmarks_scale_value
    check (benchmark_value between score_scale_min and score_scale_max)
);
create index if not exists institution_admission_benchmarks_lookup_idx
  on public.institution_admission_benchmarks(institution_id, admission_session, benchmark_type, verification_status);
create index if not exists institution_admission_benchmarks_programme_idx
  on public.institution_admission_benchmarks(programme_offering_id, admission_session);
create unique index if not exists institution_admission_benchmarks_fact_idx
  on public.institution_admission_benchmarks(
    institution_id,
    coalesce(programme_offering_id, '00000000-0000-0000-0000-000000000000'::uuid),
    admission_session,
    benchmark_type,
    category_key,
    coalesce(state_category, ''),
    benchmark_label
  );

-- ---------------------------------------------------------------------------
-- 11. Portal guides: ordered, sourced, session-scoped instructions
-- ---------------------------------------------------------------------------

create table if not exists public.institution_portal_guides (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  guide_type text not null
    check (guide_type in ('website_navigation','admissions','post_utme','direct_entry','jamb_caps','acceptance','clearance','fees','student_portal','course_registration','results','other')),
  title text not null,
  admission_session text,
  portal_url text,
  summary text,
  safety_note text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','in_review','published','archived')),
  verification_status text not null default 'unresearched'
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.institution_portal_guide_steps (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.institution_portal_guides(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  title text not null,
  instruction text not null,
  official_url text,
  required_documents jsonb not null default '[]'::jsonb
    check (jsonb_typeof(required_documents) = 'array'),
  warning text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (guide_id, step_number)
);
create index if not exists institution_portal_guides_public_idx
  on public.institution_portal_guides(institution_id, guide_type, admission_session, publication_status);
create unique index if not exists institution_portal_guides_session_idx
  on public.institution_portal_guides(institution_id, guide_type, coalesce(admission_session,''), title);

-- ---------------------------------------------------------------------------
-- 12. Field-level evidence and review trail
-- ---------------------------------------------------------------------------

create table if not exists public.institution_fact_evidence (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('institution','profile','leadership','campus','academic_unit','programme','admission_route','programme_requirement','benchmark','portal_guide')),
  entity_id uuid,
  field_key text not null,
  claimed_value jsonb,
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text not null,
  source_published_at timestamptz,
  applicable_session text,
  verification_status text not null default 'discovered'
    check (verification_status in ('discovered','in_review','verified','unpublished_by_institution','disputed','outdated')),
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists institution_fact_evidence_lookup_idx
  on public.institution_fact_evidence(institution_id, entity_type, entity_id, field_key, verification_status);
create index if not exists institution_fact_evidence_review_idx
  on public.institution_fact_evidence(verification_status, created_at desc);

-- ---------------------------------------------------------------------------
-- 13. Student admission goal and its matched CBT attempts
-- ---------------------------------------------------------------------------

create table if not exists public.student_admission_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  programme_offering_id uuid not null references public.institution_programme_offerings(id) on delete restrict,
  target_exam text not null
    check (target_exam in ('JAMB_UTME','WAEC','NECO','POST_UTME','OTHER')),
  entry_mode text not null
    check (entry_mode in ('UTME','DIRECT_ENTRY','JUPEB','IJMB','PRE_DEGREE','DIPLOMA','ND','HND','TRANSFER','OTHER')),
  admission_session text not null,
  student_target_utme_score numeric(7,2),
  student_target_aggregate numeric(7,2),
  target_score_note text,
  status text not null default 'active'
    check (status in ('active','paused','achieved','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (programme_offering_id, institution_id)
    references public.institution_programme_offerings(id, institution_id) on delete restrict,
  check (student_target_utme_score is null or student_target_utme_score between 0 and 400),
  check (student_target_aggregate is null or student_target_aggregate between 0 and 100),
  unique (id, student_id)
);
create index if not exists student_admission_goals_institution_idx
  on public.student_admission_goals(institution_id, programme_offering_id, admission_session);

create unique index if not exists cbt_attempts_id_user_id_unique
  on public.cbt_attempts(id, user_id);

create table if not exists public.student_admission_goal_attempts (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.student_admission_goals(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  match_status text not null
    check (match_status in ('matched','subject_mismatch','exam_mismatch','requirements_unavailable','excluded')),
  practice_score numeric(8,3),
  practice_score_scale numeric(8,3),
  -- A projection is only ever written by a documented, tested model. The column
  -- exists so such a model can record itself; the API refuses to write one
  -- without a matching model identifier.
  projection_model text,
  projection_value numeric(8,3),
  linked_at timestamptz not null default now(),
  unique (goal_id, attempt_id),
  constraint student_admission_goal_attempts_projection_requires_model
    check ((projection_value is null) = (projection_model is null)),
  foreign key (goal_id, student_id)
    references public.student_admission_goals(id, student_id) on delete cascade,
  foreign key (attempt_id, student_id)
    references public.cbt_attempts(id, user_id) on delete cascade
);
create index if not exists student_admission_goal_attempts_student_idx
  on public.student_admission_goal_attempts(student_id, goal_id, linked_at desc);

-- ---------------------------------------------------------------------------
-- 14. Conditional foreign keys into tables this repository does not own
-- ---------------------------------------------------------------------------

do $conditional$
begin
  if to_regclass('public.national_programme_catalogue') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'institution_programme_offerings_national_programme_fkey'
         and conrelid = 'public.institution_programme_offerings'::regclass
     ) then
    alter table public.institution_programme_offerings
      add constraint institution_programme_offerings_national_programme_fkey
      foreign key (national_programme_id)
      references public.national_programme_catalogue(id) on delete set null;
  end if;

  -- Link an offering to the legacy `programmes` row once research reconciles the
  -- institution's own programme list with the CCMAS catalogue.
  if to_regclass('public.programmes') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'institution_programme_offerings'
        and column_name = 'programme_id'
    ) then
      alter table public.institution_programme_offerings add column programme_id uuid;
    end if;
    -- No foreign key is attached here: `programmes` belongs to a migration
    -- history this repository does not contain, and a constraint that only
    -- exists in some environments is worse than a documented nullable link.
    -- Reconciliation writes programme_id only after checking the row exists.
    null;
  end if;
end
$conditional$;

-- ---------------------------------------------------------------------------
-- 15. updated_at triggers
-- ---------------------------------------------------------------------------

do $touch$
begin
  if to_regprocedure('public.set_institution_intelligence_updated_at()') is null then
    execute $fn$
      create function public.set_institution_intelligence_updated_at()
      returns trigger
      language plpgsql
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$;
    $fn$;
  end if;
end
$touch$;

do $triggers$
declare
  t text;
begin
  foreach t in array array[
    'institution_profiles','institution_leadership','institution_campuses',
    'institution_academic_units','institution_programme_offerings',
    'institution_admission_routes','institution_programme_requirements',
    'institution_admission_benchmarks','institution_portal_guides',
    'student_admission_goals'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_institution_intelligence_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end
$triggers$;

-- ---------------------------------------------------------------------------
-- 16. Row level security
-- ---------------------------------------------------------------------------

alter table public.institution_aliases enable row level security;
alter table public.institution_profiles enable row level security;
alter table public.institution_leadership enable row level security;
alter table public.institution_campuses enable row level security;
alter table public.institution_academic_units enable row level security;
alter table public.institution_programme_offerings enable row level security;
alter table public.institution_admission_routes enable row level security;
alter table public.institution_programme_requirements enable row level security;
alter table public.national_admission_policies enable row level security;
alter table public.institution_admission_benchmarks enable row level security;
alter table public.institution_portal_guides enable row level security;
alter table public.institution_portal_guide_steps enable row level security;
alter table public.institution_fact_evidence enable row level security;
alter table public.student_admission_goals enable row level security;
alter table public.student_admission_goal_attempts enable row level security;

-- Public reads: verified AND published, never a draft or an unreviewed fact.
drop policy if exists institution_aliases_public_read on public.institution_aliases;
create policy institution_aliases_public_read on public.institution_aliases
  for select to anon, authenticated using (verification_status = 'verified');

drop policy if exists institution_profiles_public_read on public.institution_profiles;
create policy institution_profiles_public_read on public.institution_profiles
  for select to anon, authenticated
  using (profile_status = 'published' and verification_status = 'verified');

drop policy if exists institution_leadership_public_read on public.institution_leadership;
create policy institution_leadership_public_read on public.institution_leadership
  for select to anon, authenticated
  using (is_current = true and verification_status = 'verified');

drop policy if exists institution_campuses_public_read on public.institution_campuses;
create policy institution_campuses_public_read on public.institution_campuses
  for select to anon, authenticated
  using (is_active = true and verification_status = 'verified');

drop policy if exists institution_academic_units_public_read on public.institution_academic_units;
create policy institution_academic_units_public_read on public.institution_academic_units
  for select to anon, authenticated
  using (is_active = true and verification_status = 'verified');

drop policy if exists institution_programme_offerings_public_read on public.institution_programme_offerings;
create policy institution_programme_offerings_public_read on public.institution_programme_offerings
  for select to anon, authenticated
  using (is_active = true and publication_status = 'published' and verification_status = 'verified');

drop policy if exists institution_admission_routes_public_read on public.institution_admission_routes;
create policy institution_admission_routes_public_read on public.institution_admission_routes
  for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

drop policy if exists institution_programme_requirements_public_read on public.institution_programme_requirements;
create policy institution_programme_requirements_public_read on public.institution_programme_requirements
  for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

drop policy if exists national_admission_policies_public_read on public.national_admission_policies;
create policy national_admission_policies_public_read on public.national_admission_policies
  for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

drop policy if exists institution_admission_benchmarks_public_read on public.institution_admission_benchmarks;
create policy institution_admission_benchmarks_public_read on public.institution_admission_benchmarks
  for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

drop policy if exists institution_portal_guides_public_read on public.institution_portal_guides;
create policy institution_portal_guides_public_read on public.institution_portal_guides
  for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

drop policy if exists institution_portal_guide_steps_public_read on public.institution_portal_guide_steps;
create policy institution_portal_guide_steps_public_read on public.institution_portal_guide_steps
  for select to anon, authenticated
  using (exists (
    select 1 from public.institution_portal_guides g
    where g.id = guide_id
      and g.publication_status = 'published'
      and g.verification_status = 'verified'
  ));

-- Staff manage: every table above, including the unreviewed rows.
do $staff$
declare
  t text;
begin
  foreach t in array array[
    'institution_aliases','institution_profiles','institution_leadership',
    'institution_campuses','institution_academic_units',
    'institution_programme_offerings','institution_admission_routes',
    'institution_programme_requirements','national_admission_policies',
    'institution_admission_benchmarks','institution_portal_guides',
    'institution_portal_guide_steps','institution_fact_evidence',
    'student_admission_goals','student_admission_goal_attempts'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))',
      t || '_staff_manage', t
    );
  end loop;
end
$staff$;

-- Evidence is staff-only: no public read policy exists, so clients never see the
-- internal working notes or unreviewed claims behind a published fact.
drop policy if exists institution_fact_evidence_no_public_read on public.institution_fact_evidence;
revoke all on table public.institution_fact_evidence from anon;

-- A student owns exactly one goal and can read/update only that row.
drop policy if exists student_admission_goals_owner_read on public.student_admission_goals;
create policy student_admission_goals_owner_read on public.student_admission_goals
  for select to authenticated using (student_id = (select auth.uid()));

drop policy if exists student_admission_goals_owner_insert on public.student_admission_goals;
create policy student_admission_goals_owner_insert on public.student_admission_goals
  for insert to authenticated with check (student_id = (select auth.uid()));

drop policy if exists student_admission_goals_owner_update on public.student_admission_goals;
create policy student_admission_goals_owner_update on public.student_admission_goals
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists student_admission_goals_owner_delete on public.student_admission_goals;
create policy student_admission_goals_owner_delete on public.student_admission_goals
  for delete to authenticated using (student_id = (select auth.uid()));

drop policy if exists student_admission_goal_attempts_owner_read on public.student_admission_goal_attempts;
create policy student_admission_goal_attempts_owner_read on public.student_admission_goal_attempts
  for select to authenticated using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 17. Grants
-- ---------------------------------------------------------------------------

grant select on public.institution_aliases, public.institution_profiles,
  public.institution_leadership, public.institution_campuses,
  public.institution_academic_units, public.institution_programme_offerings,
  public.institution_admission_routes, public.institution_programme_requirements,
  public.national_admission_policies, public.institution_admission_benchmarks,
  public.institution_portal_guides, public.institution_portal_guide_steps
to anon, authenticated;

-- Research, review and publication are server-side operations: the API checks
-- a capability, then writes with the service role. `authenticated` therefore
-- gets SELECT only on the intelligence tables, exactly like news and the
-- service catalogue. The staff RLS policies above are the second line of
-- defence if a future staff client is ever granted writes; they are not the
-- mechanism used today.
grant select, insert, update, delete on public.student_admission_goals to authenticated;
grant select on public.student_admission_goal_attempts to authenticated;

grant all on public.institution_aliases, public.institution_profiles,
  public.institution_leadership, public.institution_campuses,
  public.institution_academic_units, public.institution_programme_offerings,
  public.institution_admission_routes, public.institution_programme_requirements,
  public.national_admission_policies, public.institution_admission_benchmarks,
  public.institution_portal_guides, public.institution_portal_guide_steps,
  public.institution_fact_evidence, public.student_admission_goals,
  public.student_admission_goal_attempts
to service_role;

-- ---------------------------------------------------------------------------
-- 18. Admin completeness view: what is researched, what is awaiting review
-- ---------------------------------------------------------------------------

create or replace view public.institution_intelligence_completeness
with (security_invoker = true) as
select
  i.id as institution_id,
  i.school_name,
  i.state,
  p.verification_status as profile_status,
  coalesce(l.current_offices, 0) as current_offices,
  coalesce(c.campuses, 0) as verified_campuses,
  coalesce(u.units, 0) as verified_units,
  coalesce(o.offerings, 0) as published_offerings,
  coalesce(o.offerings_in_review, 0) as offerings_in_review,
  coalesce(b.benchmarks, 0) as published_benchmarks,
  coalesce(g.guides, 0) as published_guides,
  coalesce(e.awaiting_review, 0) as facts_awaiting_review
from public.institutions i
left join public.institution_profiles p on p.institution_id = i.id
left join lateral (
  select count(*)::int as current_offices from public.institution_leadership l
  where l.institution_id = i.id and l.is_current and l.verification_status = 'verified'
) l on true
left join lateral (
  select count(*)::int as campuses from public.institution_campuses cc
  where cc.institution_id = i.id and cc.is_active and cc.verification_status = 'verified'
) c on true
left join lateral (
  select count(*)::int as units from public.institution_academic_units uu
  where uu.institution_id = i.id and uu.is_active and uu.verification_status = 'verified'
) u on true
left join lateral (
  select
    count(*) filter (where oo.publication_status = 'published' and oo.verification_status = 'verified')::int as offerings,
    count(*) filter (where oo.publication_status = 'in_review')::int as offerings_in_review
  from public.institution_programme_offerings oo where oo.institution_id = i.id
) o on true
left join lateral (
  select count(*)::int as benchmarks from public.institution_admission_benchmarks bb
  where bb.institution_id = i.id and bb.publication_status = 'published' and bb.verification_status = 'verified'
) b on true
left join lateral (
  select count(*)::int as guides from public.institution_portal_guides gg
  where gg.institution_id = i.id and gg.publication_status = 'published' and gg.verification_status = 'verified'
) g on true
left join lateral (
  select count(*)::int as awaiting_review from public.institution_fact_evidence ee
  where ee.institution_id = i.id and ee.verification_status in ('discovered','in_review')
) e on true;

comment on view public.institution_intelligence_completeness is
  'Per-institution research coverage for the admin data-review console. Counts are of verified or published rows only; zero means "not yet researched", never "does not exist".';
