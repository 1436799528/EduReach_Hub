-- Institution intelligence: the publication gate, review fields and the indexes
-- the admin review centre needs.
--
-- This migration is additive. It does not change a single status value and it
-- deliberately imports, publishes or deletes nothing: the researched batch stays
-- exactly as it was (draft / in_review, unverified), and every unverified
-- programme offering remains readable by administrators.
--
-- Two rules are made structural here rather than left to the API:
--
--   1. A row may not be `published` unless its `verification_status` is
--      `verified`. Verification and publication are separate editorial acts, and
--      publication can never be used as a shortcut around review.
--   2. Every reviewed row records who checked it, when, and why — so a later
--      editor can see the evidence trail without reading the API logs.
--
-- The trigger is used rather than a CHECK constraint for one reason: a CHECK is
-- validated against existing rows, and a hosted database may already hold a row
-- that predates this rule. The trigger refuses new writes that would publish
-- unverified data without destroying or refusing to load the existing record.

-- ---------------------------------------------------------------------------
-- 1. Review columns: reviewer, last checked, note
-- ---------------------------------------------------------------------------

alter table public.institution_profiles
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_academic_units
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_programme_offerings
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_admission_routes
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_programme_requirements
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_admission_benchmarks
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

alter table public.institution_portal_guides
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists last_checked_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. The publication gate
-- ---------------------------------------------------------------------------

-- The body reads the row as jsonb rather than as a typed field on purpose: the
-- same function is attached to tables that have no `publication_status` column at
-- all (academic units, for one). A typed reference would raise "record new has no
-- field publication_status" on every write to those tables, which would break the
-- editable-but-unverified path this whole change exists to protect. A missing
-- column reads as null, and null is not 'published', so the gate stays a no-op
-- exactly where it should.
create or replace function public.enforce_institution_publication_gate()
returns trigger
language plpgsql
set search_path = pg_catalog
as $gate$
declare
  row_json jsonb := to_jsonb(new);
  publication text := row_json ->> 'publication_status';
  verification text := coalesce(row_json ->> 'verification_status', 'unresearched');
begin
  if publication = 'published' and verification <> 'verified' then
    raise exception
      'This record cannot be published while its verification status is %. Verify the facts and their source first.',
      verification
      using errcode = 'check_violation';
  end if;
  return new;
end
$gate$;

comment on function public.enforce_institution_publication_gate() is
  'Refuses publication_status = published unless verification_status = verified. Verification is not implied by publication.';

do $gates$
declare
  t text;
begin
  -- Only tables that can be published carry the gate. Academic units, leadership,
  -- campuses and aliases have no publication axis: they are public precisely when
  -- they are verified, so a gate there would be dead weight (and, as noted above,
  -- a trap for a typed trigger body).
  foreach t in array array[
    'institution_profiles',
    'institution_programme_offerings',
    'institution_admission_routes',
    'institution_programme_requirements',
    'institution_admission_benchmarks',
    'institution_portal_guides',
    'national_admission_policies'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_publication_gate', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.enforce_institution_publication_gate()',
      t || '_publication_gate', t
    );
  end loop;
end
$gates$;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the review centre
-- ---------------------------------------------------------------------------

create index if not exists institution_profiles_status_idx
  on public.institution_profiles(publication_status, verification_status);

create index if not exists institution_programme_offerings_review_idx
  on public.institution_programme_offerings(institution_id, verification_status, publication_status);

create index if not exists institution_academic_units_review_idx
  on public.institution_academic_units(institution_id, verification_status);

create index if not exists institution_admission_routes_review_idx
  on public.institution_admission_routes(institution_id, verification_status, publication_status);

create index if not exists institution_programme_requirements_review_idx
  on public.institution_programme_requirements(programme_offering_id, verification_status, publication_status);

create index if not exists institution_fact_evidence_checked_idx
  on public.institution_fact_evidence(institution_id, verification_status, checked_at desc);

-- ---------------------------------------------------------------------------
-- 4. The admin queue, aggregated in the database
-- ---------------------------------------------------------------------------
--
-- The review centre needs one row per institution with identity, both statuses,
-- the counts an editor acts on and the dates of the last research activity. The
-- view is security_invoker so staff policies still apply, and it is read by the
-- service-role API only after a capability check.

create or replace view public.institution_review_overview
with (security_invoker = true) as
select
  i.id as institution_id,
  i.school_name,
  i.acronym,
  i.state,
  i.institution_type,
  i.website_url as directory_website_url,
  p.official_name,
  p.ownership,
  p.institution_category,
  p.publication_status,
  coalesce(p.verification_status, 'unresearched') as verification_status,
  p.last_checked_at,
  p.reviewed_by,
  p.logo_url,
  p.hero_image_url,
  p.overview,
  p.official_website_url,
  p.admission_portal_url,
  p.student_portal_url,
  p.postgraduate_portal_url,
  coalesce(u.units, 0) as academic_units,
  coalesce(u.units_unverified, 0) as academic_units_unverified,
  coalesce(o.offerings, 0) as programme_offerings,
  coalesce(o.offerings_unverified, 0) as programme_offerings_unverified,
  coalesce(o.published_offerings, 0) as published_offerings,
  coalesce(r.routes, 0) as admission_routes,
  coalesce(r.routes_with_dates, 0) as admission_routes_with_dates,
  coalesce(q.requirements, 0) as programme_requirements,
  coalesce(q.requirements_with_subjects, 0) as programme_requirements_with_subjects,
  coalesce(s.sources, 0) as source_records,
  coalesce(e.evidence, 0) as evidence_rows,
  coalesce(e.awaiting_review, 0) as evidence_awaiting_review,
  e.last_checked_at as evidence_last_checked_at,
  coalesce(x.sessions, '{}'::text[]) as admission_sessions,
  x.latest_session,
  (p.official_website_url is not null or i.website_url is not null) as has_official_website,
  (p.logo_url is not null) as has_logo,
  (p.hero_image_url is not null) as has_hero_image,
  (coalesce(p.admission_portal_url, p.student_portal_url, p.postgraduate_portal_url,
            i.admission_portal_url, i.student_portal_url) is not null) as has_portal
from public.institutions i
left join public.institution_profiles p on p.institution_id = i.id
left join lateral (
  select
    count(*)::int as units,
    count(*) filter (where uu.verification_status <> 'verified')::int as units_unverified
  from public.institution_academic_units uu
  where uu.institution_id = i.id and uu.is_active
) u on true
left join lateral (
  select
    count(*)::int as offerings,
    count(*) filter (where oo.verification_status <> 'verified')::int as offerings_unverified,
    count(*) filter (where oo.publication_status = 'published')::int as published_offerings
  from public.institution_programme_offerings oo
  where oo.institution_id = i.id and oo.is_active
) o on true
left join lateral (
  select
    count(*)::int as routes,
    count(*) filter (where rr.opens_on is not null or rr.closes_on is not null)::int as routes_with_dates
  from public.institution_admission_routes rr
  where rr.institution_id = i.id
) r on true
left join lateral (
  select
    count(*)::int as requirements,
    count(*) filter (where coalesce(array_length(qq.utme_subjects, 1), 0) > 0)::int as requirements_with_subjects
  from public.institution_programme_requirements qq
  join public.institution_programme_offerings oo on oo.id = qq.programme_offering_id
  where oo.institution_id = i.id
) q on true
left join lateral (
  select count(*)::int as sources
  from public.edureach_sources ss
  where ss.id in (
    select pp.source_id from public.institution_profiles pp
      where pp.institution_id = i.id and pp.source_id is not null
    union
    select oo.source_id from public.institution_programme_offerings oo
      where oo.institution_id = i.id and oo.source_id is not null
    union
    select rr.source_id from public.institution_admission_routes rr
      where rr.institution_id = i.id and rr.source_id is not null
    union
    select ee.source_id from public.institution_fact_evidence ee
      where ee.institution_id = i.id and ee.source_id is not null
  )
) s on true
left join lateral (
  select
    count(*)::int as evidence,
    count(*) filter (where ee.verification_status in ('discovered', 'in_review'))::int as awaiting_review,
    max(ee.checked_at) as last_checked_at
  from public.institution_fact_evidence ee
  where ee.institution_id = i.id
) e on true
left join lateral (
  select
    array_agg(distinct sessions.session order by sessions.session) filter (where sessions.session is not null) as sessions,
    max(sessions.session) as latest_session
  from (
    select oo.admission_session as session from public.institution_programme_offerings oo where oo.institution_id = i.id
    union
    select rr.admission_session as session from public.institution_admission_routes rr where rr.institution_id = i.id
  ) sessions
) x on true;

comment on view public.institution_review_overview is
  'One row per institution for the admin review centre: identity, verification/publication state, review activity and the counts an editor acts on. Counts describe records, never a quality score.';

grant select on public.institution_review_overview to service_role;
