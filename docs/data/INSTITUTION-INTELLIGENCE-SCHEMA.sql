-- EduReach Hub: Institution Intelligence / Admissions Guidance
-- DESIGN DRAFT ONLY. Do not execute on production.
-- Apply only through a reviewed Supabase migration on an authorised development branch.
-- Existing institution, faculty, department, programme, CCMAS, cut-off and CBT tables are preserved.

begin;

-- 1. Institutional profile extension (one profile per canonical institution).
create table if not exists public.institution_profiles (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
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

-- 2. Effective-dated institutional leadership (VC/Rector/Provost/Chancellor/etc.).
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
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists institution_leadership_current_idx
  on public.institution_leadership(institution_id, office_key, is_current);
create unique index if not exists institution_leadership_one_current_office_idx
  on public.institution_leadership(institution_id, office_key, office_title)
  where is_current = true;

-- 3. Physical campuses / locations.
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
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
create index if not exists institution_campuses_institution_idx
  on public.institution_campuses(institution_id, is_active);

-- 4. Hierarchical academic structure. Supports faculty, college, school,
-- institute, centre and department without forcing everything to be a faculty.
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
    references public.institution_academic_units(id, institution_id) on delete set null
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

-- 5. Institution-specific programme offerings. A national/NBU/CCMAS catalogue
-- item is NOT proof that every institution offers that programme.
create table if not exists public.institution_programme_offerings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_unit_id uuid references public.institution_academic_units(id) on delete set null,
  campus_id uuid references public.institution_campuses(id) on delete set null,
  national_programme_id uuid references public.national_programme_catalogue(id) on delete set null,
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
    references public.institution_academic_units(id, institution_id) on delete set null,
  foreign key (campus_id, institution_id)
    references public.institution_campuses(id, institution_id) on delete set null,
  check (duration_years is null or duration_years between 0.5 and 15)
);
create index if not exists institution_programme_offerings_institution_idx
  on public.institution_programme_offerings(institution_id, is_active, publication_status);
create index if not exists institution_programme_offerings_unit_idx
  on public.institution_programme_offerings(academic_unit_id);
create unique index if not exists institution_programme_offerings_code_idx
  on public.institution_programme_offerings(institution_id, programme_code, coalesce(admission_session,''))
  where programme_code is not null;

-- 6. Institution-level admission routes and how screening is performed.
-- Entry mode is not the same as assessment method.
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

-- 7. Programme-specific UTME/DE/O'Level/A'Level requirements.
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
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
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

-- 8. Typed admission benchmarks. Separates national minimums, institution
-- thresholds, programme UTME thresholds and 0-100 screening aggregates.
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
    check (verification_status in ('unresearched','discovered','in_review','verified','disputed','outdated')),
  source_id uuid references public.edureach_sources(id) on delete set null,
  source_url text,
  source_published_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score_scale_max > score_scale_min),
  check (benchmark_value between score_scale_min and score_scale_max)
);
create index if not exists institution_admission_benchmarks_lookup_idx
  on public.institution_admission_benchmarks(institution_id, admission_session, benchmark_type, verification_status);
create index if not exists institution_admission_benchmarks_programme_idx
  on public.institution_admission_benchmarks(programme_offering_id, admission_session);

-- 9. Structured portal guides, versioned by academic session.
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
  step_number integer not null,
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

-- 10. Field-level provenance. One profile is not globally "verified" because
-- one field was checked. Each fact records its own source and review state.
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

-- 11. Student's chosen admission target. One current goal per student; update
-- is permitted, but student identity is always auth.uid(), never client input.
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
  check (student_target_aggregate is null or student_target_aggregate between 0 and 100)
);
create index if not exists student_admission_goals_institution_idx
  on public.student_admission_goals(institution_id, programme_offering_id, admission_session);

-- 12. Link only owner-scoped CBT attempts to a goal. "matched" means its exam
-- body and selected subjects match the verified goal requirements; mismatches
-- may be retained for history but must not count toward goal readiness.
create table if not exists public.student_admission_goal_attempts (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.student_admission_goals(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  match_status text not null
    check (match_status in ('matched','subject_mismatch','exam_mismatch','requirements_unavailable','excluded')),
  practice_score numeric(8,3),
  practice_score_scale numeric(8,3),
  projection_model text,
  projection_value numeric(8,3),
  linked_at timestamptz not null default now(),
  unique (goal_id, attempt_id)
);
create index if not exists student_admission_goal_attempts_student_idx
  on public.student_admission_goal_attempts(student_id, goal_id, linked_at desc);

-- 13. RLS: public institution intelligence is visible only when both published
-- and verified. Fact-level evidence is not exposed to public clients.
alter table public.institution_profiles enable row level security;
alter table public.institution_leadership enable row level security;
alter table public.institution_campuses enable row level security;
alter table public.institution_academic_units enable row level security;
alter table public.institution_programme_offerings enable row level security;
alter table public.institution_admission_routes enable row level security;
alter table public.institution_programme_requirements enable row level security;
alter table public.institution_admission_benchmarks enable row level security;
alter table public.institution_portal_guides enable row level security;
alter table public.institution_portal_guide_steps enable row level security;
alter table public.institution_fact_evidence enable row level security;
alter table public.student_admission_goals enable row level security;
alter table public.student_admission_goal_attempts enable row level security;

-- Public readers only see verified/published institution profile facts.
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
  for select to anon, authenticated using (is_active = true and verification_status = 'verified');
drop policy if exists institution_academic_units_public_read on public.institution_academic_units;
create policy institution_academic_units_public_read on public.institution_academic_units
  for select to anon, authenticated using (is_active = true and verification_status = 'verified');
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

drop policy if exists institution_profiles_staff_manage on public.institution_profiles;
create policy institution_profiles_staff_manage on public.institution_profiles
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_leadership_staff_manage on public.institution_leadership;
create policy institution_leadership_staff_manage on public.institution_leadership
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_campuses_staff_manage on public.institution_campuses;
create policy institution_campuses_staff_manage on public.institution_campuses
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_academic_units_staff_manage on public.institution_academic_units;
create policy institution_academic_units_staff_manage on public.institution_academic_units
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_programme_offerings_staff_manage on public.institution_programme_offerings;
create policy institution_programme_offerings_staff_manage on public.institution_programme_offerings
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_admission_routes_staff_manage on public.institution_admission_routes;
create policy institution_admission_routes_staff_manage on public.institution_admission_routes
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_programme_requirements_staff_manage on public.institution_programme_requirements;
create policy institution_programme_requirements_staff_manage on public.institution_programme_requirements
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_admission_benchmarks_staff_manage on public.institution_admission_benchmarks;
create policy institution_admission_benchmarks_staff_manage on public.institution_admission_benchmarks
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_portal_guides_staff_manage on public.institution_portal_guides;
create policy institution_portal_guides_staff_manage on public.institution_portal_guides
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists institution_portal_guide_steps_staff_manage on public.institution_portal_guide_steps;
create policy institution_portal_guide_steps_staff_manage on public.institution_portal_guide_steps
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Private evidence is staff-only. No anonymous/authenticated public SELECT.
drop policy if exists institution_fact_evidence_staff_manage on public.institution_fact_evidence;
create policy institution_fact_evidence_staff_manage on public.institution_fact_evidence
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Only the owner can read/write their own goal.
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
drop policy if exists student_admission_goals_staff_manage on public.student_admission_goals;
create policy student_admission_goals_staff_manage on public.student_admission_goals
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists student_admission_goal_attempts_owner_read on public.student_admission_goal_attempts;
create policy student_admission_goal_attempts_owner_read on public.student_admission_goal_attempts
  for select to authenticated using (student_id = (select auth.uid()));
drop policy if exists student_admission_goal_attempts_staff_manage on public.student_admission_goal_attempts;
create policy student_admission_goal_attempts_staff_manage on public.student_admission_goal_attempts
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Table grants are separate from RLS; readers get SELECT only on published data.
grant select on public.institution_profiles,
  public.institution_leadership,
  public.institution_campuses,
  public.institution_academic_units,
  public.institution_programme_offerings,
  public.institution_admission_routes,
  public.institution_programme_requirements,
  public.institution_admission_benchmarks,
  public.institution_portal_guides,
  public.institution_portal_guide_steps
to anon, authenticated;

grant select, insert, update on public.student_admission_goals to authenticated;
grant select on public.student_admission_goal_attempts to authenticated;
grant select, insert, update, delete on public.institution_fact_evidence to authenticated;

-- Authenticated staff write grants are intentionally governed by the staff RLS policies.
grant insert, update, delete on public.institution_profiles,
  public.institution_leadership,
  public.institution_campuses,
  public.institution_academic_units,
  public.institution_programme_offerings,
  public.institution_admission_routes,
  public.institution_programme_requirements,
  public.institution_admission_benchmarks,
  public.institution_portal_guides,
  public.institution_portal_guide_steps
to authenticated;

commit;
