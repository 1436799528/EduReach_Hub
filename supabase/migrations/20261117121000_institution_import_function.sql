-- Institution research import: one transactional, editorial-safe entry point.
--
-- Why a database function rather than a sequence of REST writes from a script:
-- the REST client cannot span a transaction. A batch that failed on row 40 of 80
-- would leave half a review queue behind, and "inserted/skipped/rejected" could
-- never be trusted. This function validates and writes in one transaction, and a
-- sentinel exception rolls the whole body back for a dry run while still
-- returning the exact summary the apply would have produced.
--
-- Rules enforced here, not in the caller:
--   * nothing is written as published: new research lands in_review;
--   * a verified row is never overwritten by an older or equal-dated batch;
--   * every row resolves its source URL to an edureach_sources row;
--   * a benchmark must carry the scale its institution published;
--   * counts are returned per entity, plus rejected rows with reasons.
--
-- Executable only by service_role: anon and authenticated have no EXECUTE.

create or replace function public.institution_import_bump(p_summary jsonb, p_bucket text, p_entity text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $bump$
  select jsonb_set(
    p_summary,
    array[p_bucket, p_entity],
    to_jsonb(coalesce((p_summary->p_bucket->>p_entity)::int, 0) + 1),
    true
  )
$bump$;

revoke all on function public.institution_import_bump(jsonb, text, text) from public, anon, authenticated;

create or replace function public.institution_import_apply(
  p_payload jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $import$
declare
  v_summary jsonb;
  v_item jsonb;
  v_source jsonb;
  v_source_id uuid;
  v_id uuid;
  v_existing uuid;
  v_status text;
  v_verified timestamptz;
  v_batch_date timestamptz;
  v_institution uuid;
  v_session text;
  v_scale_max numeric;
  v_value numeric;
  v_detail text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'import payload must be a JSON object';
  end if;

  v_batch_date := coalesce(nullif(p_payload->>'researchDate','')::timestamptz, now());
  v_summary := jsonb_build_object(
    'dryRun', p_dry_run,
    'batchId', coalesce(p_payload->>'batchId', 'unlabelled'),
    'researchDate', v_batch_date,
    'inserted', '{}'::jsonb,
    'updated', '{}'::jsonb,
    'skipped', '{}'::jsonb,
    'skipped_verified', '{}'::jsonb,
    'rejected', '[]'::jsonb
  );

  begin  -- sentinel block: rolls back on a dry run, keeps the summary
    -- ---------------------------------------------------------------- sources
    for v_source in select * from jsonb_array_elements(coalesce(p_payload->'sources', '[]'::jsonb)) loop
      if coalesce(v_source->>'url','') = '' then
        v_summary := jsonb_set(v_summary, '{rejected}',
          (v_summary->'rejected') || jsonb_build_object('entity','edureach_sources','key',coalesce(v_source->>'sourceKey','?'),'reason','source has no url'));
        continue;
      end if;
      select id into v_source_id from public.edureach_sources where lower(url) = lower(v_source->>'url') limit 1;
      if v_source_id is null then
        insert into public.edureach_sources (name, url, authority, source_type)
        values (coalesce(nullif(v_source->>'name',''), v_source->>'url'), v_source->>'url',
                v_source->>'authority', coalesce(nullif(v_source->>'sourceType',''), 'official'))
        returning id into v_source_id;
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'edureach_sources');
      end if;
    end loop;

    -- --------------------------------------------------------------- profiles
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'profiles','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      if v_institution is null then
        v_summary := jsonb_set(v_summary, '{rejected}',
          (v_summary->'rejected') || jsonb_build_object('entity','institution_profiles','key','?','reason','missing institutionId'));
        continue;
      end if;

      select institution_id, verification_status, profile_verified_at into v_existing, v_status, v_verified
        from public.institution_profiles where institution_id = v_institution;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_profiles');
        continue;
      end if;

      insert into public.institution_profiles (
        institution_id, official_name, ownership, institution_category, year_established,
        history_summary, overview, mission, vision, mandate, postal_address, city,
        official_website_url, admission_portal_url, student_portal_url, postgraduate_portal_url,
        logo_url, hero_image_url, publication_status, verification_status, source_id, source_url
      ) values (
        v_institution, v_item->>'officialName', nullif(v_item->>'ownership',''),
        nullif(v_item->>'institutionCategory',''), nullif(v_item->>'yearEstablished','')::smallint,
        v_item->>'historySummary', v_item->>'overview', v_item->>'mission', v_item->>'vision', v_item->>'mandate',
        v_item->>'postalAddress', v_item->>'city',
        v_item->>'officialWebsiteUrl', v_item->>'admissionPortalUrl', v_item->>'studentPortalUrl', v_item->>'postgraduatePortalUrl',
        v_item->>'logoUrl', v_item->>'heroImageUrl',
        'in_review', 'in_review',
        (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
        v_item->>'sourceUrl'
      )
      on conflict (institution_id) do update set
        official_name = excluded.official_name,
        ownership = excluded.ownership,
        institution_category = excluded.institution_category,
        year_established = excluded.year_established,
        history_summary = excluded.history_summary,
        overview = excluded.overview,
        mission = excluded.mission,
        vision = excluded.vision,
        mandate = excluded.mandate,
        postal_address = excluded.postal_address,
        city = excluded.city,
        official_website_url = excluded.official_website_url,
        admission_portal_url = excluded.admission_portal_url,
        student_portal_url = excluded.student_portal_url,
        postgraduate_portal_url = excluded.postgraduate_portal_url,
        logo_url = excluded.logo_url,
        hero_image_url = excluded.hero_image_url,
        publication_status = 'in_review',
        verification_status = 'in_review',
        source_id = excluded.source_id,
        source_url = excluded.source_url;

      v_summary := public.institution_import_bump(v_summary,
        case when v_existing is null then 'inserted' else 'updated' end, 'institution_profiles');
    end loop;

    -- ------------------------------------------------------------- leadership
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'leadership','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_leadership
        where institution_id = v_institution
          and office_key = v_item->>'officeKey'
          and lower(full_name) = lower(coalesce(v_item->>'fullName',''))
        limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_leadership');
        continue;
      end if;

      if v_existing is null then
        -- A newly reported current holder closes the previous current holder of
        -- the same office at the new appointment date.
        if coalesce((v_item->>'isCurrent')::boolean, false) and nullif(v_item->>'startsOn','') is not null then
          update public.institution_leadership
            set is_current = false, ends_on = coalesce(ends_on, (v_item->>'startsOn')::date)
            where institution_id = v_institution and office_key = v_item->>'officeKey' and is_current;
        end if;
        insert into public.institution_leadership (
          institution_id, office_key, office_title, full_name, acting_status, starts_on, ends_on,
          is_current, biography, portrait_url, verification_status, source_id, source_url
        ) values (
          v_institution, v_item->>'officeKey', v_item->>'officeTitle', v_item->>'fullName',
          coalesce(nullif(v_item->>'actingStatus',''), 'substantive'),
          nullif(v_item->>'startsOn','')::date, nullif(v_item->>'endsOn','')::date,
          coalesce((v_item->>'isCurrent')::boolean, false), v_item->>'biography', v_item->>'portraitUrl',
          'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        );
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_leadership');
      else
        update public.institution_leadership set
          office_title = v_item->>'officeTitle',
          acting_status = coalesce(nullif(v_item->>'actingStatus',''), 'substantive'),
          starts_on = nullif(v_item->>'startsOn','')::date,
          ends_on = nullif(v_item->>'endsOn','')::date,
          is_current = coalesce((v_item->>'isCurrent')::boolean, false),
          biography = v_item->>'biography',
          portrait_url = v_item->>'portraitUrl',
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_existing;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_leadership');
      end if;
    end loop;

    -- --------------------------------------------------------------- campuses
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'campuses','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_campuses
        where institution_id = v_institution and lower(campus_name) = lower(coalesce(v_item->>'campusName','')) limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_campuses');
        continue;
      end if;

      if v_existing is null then
        insert into public.institution_campuses (
          institution_id, campus_name, campus_type, address, city, state, description, is_active,
          verification_status, source_id, source_url
        ) values (
          v_institution, v_item->>'campusName', coalesce(nullif(v_item->>'campusType',''), 'campus'),
          v_item->>'address', v_item->>'city', v_item->>'state', v_item->>'description',
          coalesce((v_item->>'isActive')::boolean, true), 'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        );
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_campuses');
      else
        update public.institution_campuses set
          campus_type = coalesce(nullif(v_item->>'campusType',''), campus_type),
          address = coalesce(v_item->>'address', address),
          city = coalesce(v_item->>'city', city),
          state = coalesce(v_item->>'state', state),
          description = coalesce(v_item->>'description', description),
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_existing;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_campuses');
      end if;
    end loop;

    -- ---------------------------------------------------------- academicUnits
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'academicUnits','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_academic_units
        where institution_id = v_institution
          and unit_type = v_item->>'unitType'
          and lower(unit_name) = lower(coalesce(v_item->>'unitName','')) limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_academic_units');
        continue;
      end if;

      if v_existing is null then
        insert into public.institution_academic_units (
          institution_id, parent_unit_id, unit_type, unit_name, slug, description, website_url, is_active,
          verification_status, source_id, source_url
        ) values (
          v_institution,
          (select id from public.institution_academic_units
             where institution_id = v_institution
               and lower(unit_name) = lower(coalesce(v_item->>'parentUnitName','')) limit 1),
          v_item->>'unitType', v_item->>'unitName',
          coalesce(nullif(v_item->>'slug',''),
            trim(both '-' from regexp_replace(lower(v_item->>'unitName'), '[^a-z0-9]+', '-', 'g'))),
          v_item->>'description', v_item->>'websiteUrl', coalesce((v_item->>'isActive')::boolean, true),
          'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        );
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_academic_units');
      else
        update public.institution_academic_units set
          description = coalesce(v_item->>'description', description),
          website_url = coalesce(v_item->>'websiteUrl', website_url),
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_existing;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_academic_units');
      end if;
    end loop;

    -- -------------------------------------------------------------- offerings
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'offerings','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      v_session := coalesce(v_item->>'admissionSession','');
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_programme_offerings
        where institution_id = v_institution
          and lower(programme_name) = lower(coalesce(v_item->>'programmeName',''))
          and coalesce(admission_session,'') = v_session limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_programme_offerings');
        continue;
      end if;

      if v_existing is null then
        insert into public.institution_programme_offerings (
          institution_id, academic_unit_id, programme_name, programme_code, degree_title, award_level,
          duration_years, delivery_mode, admission_session, is_active, publication_status,
          verification_status, source_id, source_url
        ) values (
          v_institution,
          (select id from public.institution_academic_units
             where institution_id = v_institution
               and lower(unit_name) = lower(coalesce(v_item->>'academicUnitName','')) limit 1),
          v_item->>'programmeName', v_item->>'programmeCode', v_item->>'degreeTitle', v_item->>'awardLevel',
          nullif(v_item->>'durationYears','')::numeric, v_item->>'deliveryMode', v_item->>'admissionSession',
          coalesce((v_item->>'isActive')::boolean, true), 'in_review', 'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        );
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_programme_offerings');
      else
        update public.institution_programme_offerings set
          degree_title = coalesce(v_item->>'degreeTitle', degree_title),
          programme_code = coalesce(v_item->>'programmeCode', programme_code),
          award_level = coalesce(v_item->>'awardLevel', award_level),
          duration_years = coalesce(nullif(v_item->>'durationYears','')::numeric, duration_years),
          publication_status = 'in_review',
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_existing;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_programme_offerings');
      end if;
    end loop;

    -- ---------------------------------------------------------------- routes
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'routes','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_admission_routes
        where institution_id = v_institution
          and admission_session = coalesce(v_item->>'admissionSession','')
          and entry_mode = v_item->>'entryMode' limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_admission_routes');
        continue;
      end if;

      insert into public.institution_admission_routes (
        institution_id, admission_session, entry_mode, assessment_methods, first_choice_required,
        change_of_institution_allowed, application_url, opens_on, closes_on, eligibility_notes,
        publication_status, verification_status, source_id, source_url
      ) values (
        v_institution, coalesce(v_item->>'admissionSession',''), v_item->>'entryMode',
        coalesce(array(select jsonb_array_elements_text(coalesce(v_item->'assessmentMethods','[]'::jsonb))), '{}'),
        (v_item->>'firstChoiceRequired')::boolean,
        (v_item->>'changeOfInstitutionAllowed')::boolean,
        v_item->>'applicationUrl', nullif(v_item->>'opensOn','')::date, nullif(v_item->>'closesOn','')::date,
        v_item->>'eligibilityNotes', 'in_review', 'in_review',
        (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
        v_item->>'sourceUrl'
      )
      on conflict (institution_id, admission_session, entry_mode) do update set
        assessment_methods = excluded.assessment_methods,
        first_choice_required = excluded.first_choice_required,
        change_of_institution_allowed = excluded.change_of_institution_allowed,
        application_url = excluded.application_url,
        opens_on = excluded.opens_on,
        closes_on = excluded.closes_on,
        eligibility_notes = excluded.eligibility_notes,
        publication_status = 'in_review',
        verification_status = 'in_review',
        source_url = excluded.source_url;

      v_summary := public.institution_import_bump(v_summary,
        case when v_existing is null then 'inserted' else 'updated' end, 'institution_admission_routes');
    end loop;

    -- ----------------------------------------------------------- requirements
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'requirements','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      v_session := coalesce(v_item->>'admissionSession','');

      select o.id into v_id from public.institution_programme_offerings o
        where o.institution_id = v_institution
          and lower(o.programme_name) = lower(coalesce(v_item->>'programmeName',''))
          and coalesce(o.admission_session,'') = v_session limit 1;

      if v_id is null then
        v_summary := jsonb_set(v_summary, '{rejected}',
          (v_summary->'rejected') || jsonb_build_object(
            'entity','institution_programme_requirements',
            'key', coalesce(v_item->>'programmeName','?'),
            'reason','no offering for this institution and session'));
        continue;
      end if;

      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_programme_requirements
        where programme_offering_id = v_id
          and admission_session = v_session
          and entry_mode = v_item->>'entryMode' limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_programme_requirements');
        continue;
      end if;

      insert into public.institution_programme_requirements (
        programme_offering_id, admission_route_id, admission_session, entry_mode,
        utme_subjects, o_level_requirements, a_level_requirements, other_requirements,
        minimum_utme_score, minimum_utme_scale, first_choice_required, notes,
        publication_status, verification_status, source_id, source_url
      ) values (
        v_id,
        (select id from public.institution_admission_routes
           where institution_id = v_institution and admission_session = v_session
             and entry_mode = v_item->>'entryMode' limit 1),
        v_session, v_item->>'entryMode',
        coalesce(array(select jsonb_array_elements_text(coalesce(v_item->'utmeSubjects','[]'::jsonb))), '{}'),
        coalesce(v_item->'oLevelRequirements','{}'::jsonb),
        coalesce(v_item->'aLevelRequirements','{}'::jsonb),
        coalesce(v_item->'otherRequirements','{}'::jsonb),
        nullif(v_item->>'minimumUtmeScore','')::numeric,
        coalesce(nullif(v_item->>'minimumUtmeScale','')::numeric, 400),
        (v_item->>'firstChoiceRequired')::boolean, v_item->>'notes',
        'in_review', 'in_review',
        (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
        v_item->>'sourceUrl'
      )
      on conflict (programme_offering_id, admission_session, entry_mode) do update set
        utme_subjects = excluded.utme_subjects,
        o_level_requirements = excluded.o_level_requirements,
        a_level_requirements = excluded.a_level_requirements,
        other_requirements = excluded.other_requirements,
        minimum_utme_score = excluded.minimum_utme_score,
        minimum_utme_scale = excluded.minimum_utme_scale,
        first_choice_required = excluded.first_choice_required,
        notes = excluded.notes,
        publication_status = 'in_review',
        verification_status = 'in_review',
        source_url = excluded.source_url;

      v_summary := public.institution_import_bump(v_summary,
        case when v_existing is null then 'inserted' else 'updated' end, 'institution_programme_requirements');
    end loop;

    -- ------------------------------------------------------------- benchmarks
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'benchmarks','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      v_session := coalesce(v_item->>'admissionSession','');
      v_value := (v_item->>'benchmarkValue')::numeric;
      v_scale_max := (v_item->>'scoreScaleMax')::numeric;

      v_id := null;
      if nullif(v_item->>'programmeName','') is not null then
        select o.id into v_id from public.institution_programme_offerings o
          where o.institution_id = v_institution
            and lower(o.programme_name) = lower(v_item->>'programmeName')
            and coalesce(o.admission_session,'') = v_session limit 1;
        if v_id is null then
          v_summary := jsonb_set(v_summary, '{rejected}',
            (v_summary->'rejected') || jsonb_build_object(
              'entity','institution_admission_benchmarks',
              'key', v_item->>'programmeName',
              'reason','benchmark names a programme this institution has no offering for'));
          continue;
        end if;
      end if;

      -- A published scale is part of the fact: refuse an impossible value here
      -- with a readable reason instead of a constraint error for the whole batch.
      if v_scale_max is null or v_value > v_scale_max or v_value < coalesce(nullif(v_item->>'scoreScaleMin','')::numeric, 0) then
        v_summary := jsonb_set(v_summary, '{rejected}',
          (v_summary->'rejected') || jsonb_build_object(
            'entity','institution_admission_benchmarks',
            'key', coalesce(v_item->>'benchmarkLabel', v_item->>'programmeName', '?'),
            'reason','value outside its declared score scale'));
        continue;
      end if;

      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_admission_benchmarks
        where institution_id = v_institution
          and coalesce(programme_offering_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = coalesce(v_id, '00000000-0000-0000-0000-000000000000'::uuid)
          and admission_session = v_session
          and benchmark_type = v_item->>'benchmarkType'
          and category_key = coalesce(nullif(v_item->>'categoryKey',''), 'general')
          and coalesce(state_category,'') = coalesce(v_item->>'stateCategory','')
          and benchmark_label = v_item->>'benchmarkLabel' limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_admission_benchmarks');
        continue;
      end if;

      if v_existing is null then
        insert into public.institution_admission_benchmarks (
          institution_id, programme_offering_id, admission_session, benchmark_type, benchmark_label,
          benchmark_value, score_scale_min, score_scale_max, category_key, state_category,
          is_eligibility_floor, calculation_method, calculation_weights, notes,
          publication_status, verification_status, source_id, source_url
        ) values (
          v_institution, v_id, v_session, v_item->>'benchmarkType', v_item->>'benchmarkLabel',
          v_value, coalesce(nullif(v_item->>'scoreScaleMin','')::numeric, 0), v_scale_max,
          coalesce(nullif(v_item->>'categoryKey',''), 'general'), nullif(v_item->>'stateCategory',''),
          coalesce((v_item->>'isEligibilityFloor')::boolean, false),
          v_item->>'calculationMethod', coalesce(v_item->'calculationWeights','{}'::jsonb), v_item->>'notes',
          'in_review', 'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        );
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_admission_benchmarks');
      else
        update public.institution_admission_benchmarks set
          benchmark_value = v_value,
          score_scale_min = coalesce(nullif(v_item->>'scoreScaleMin','')::numeric, 0),
          score_scale_max = v_scale_max,
          notes = coalesce(v_item->>'notes', notes),
          publication_status = 'in_review',
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_existing;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_admission_benchmarks');
      end if;
    end loop;

    -- ---------------------------------------------------------------- guides
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'guides','[]'::jsonb)) loop
      v_institution := nullif(v_item->>'institutionId','')::uuid;
      v_session := coalesce(v_item->>'admissionSession','');

      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.institution_portal_guides
        where institution_id = v_institution
          and guide_type = v_item->>'guideType'
          and coalesce(admission_session,'') = v_session
          and lower(title) = lower(coalesce(v_item->>'title','')) limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'institution_portal_guides');
        continue;
      end if;

      if v_existing is null then
        insert into public.institution_portal_guides (
          institution_id, guide_type, title, admission_session, portal_url, summary, safety_note,
          publication_status, verification_status, source_id, source_url
        ) values (
          v_institution, v_item->>'guideType', v_item->>'title', nullif(v_item->>'admissionSession',''),
          v_item->>'portalUrl', v_item->>'summary', v_item->>'safetyNote',
          'in_review', 'in_review',
          (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
          v_item->>'sourceUrl'
        ) returning id into v_id;
        v_summary := public.institution_import_bump(v_summary, 'inserted', 'institution_portal_guides');
      else
        v_id := v_existing;
        update public.institution_portal_guides set
          portal_url = coalesce(v_item->>'portalUrl', portal_url),
          summary = coalesce(v_item->>'summary', summary),
          safety_note = coalesce(v_item->>'safetyNote', safety_note),
          publication_status = 'in_review',
          verification_status = 'in_review',
          source_url = v_item->>'sourceUrl'
        where id = v_id;
        v_summary := public.institution_import_bump(v_summary, 'updated', 'institution_portal_guides');
      end if;

      -- Steps are replaced wholesale: a guide with new steps is a new version,
      -- and a half-updated step list would be worse than none.
      delete from public.institution_portal_guide_steps where guide_id = v_id;
      insert into public.institution_portal_guide_steps (guide_id, step_number, title, instruction, official_url, required_documents, warning)
      select v_id,
             ord::int,
             coalesce(nullif(step->>'title',''), 'Step ' || ord::text),
             coalesce(nullif(step->>'instruction',''), step#>>'{}'),
             step->>'officialUrl',
             coalesce(step->'requiredDocuments', '[]'::jsonb),
             step->>'warning'
      from jsonb_array_elements(coalesce(v_item->'steps','[]'::jsonb)) with ordinality as s(step, ord);
    end loop;

    -- ----------------------------------------------------- nationalPolicies
    for v_item in select * from jsonb_array_elements(coalesce(p_payload->'nationalPolicies','[]'::jsonb)) loop
      select id, verification_status, verified_at into v_existing, v_status, v_verified
        from public.national_admission_policies
        where authority = v_item->>'authority'
          and admission_session = coalesce(v_item->>'admissionSession','')
          and institution_category = v_item->>'institutionCategory'
          and entry_mode = coalesce(nullif(v_item->>'entryMode',''), 'UTME')
          and policy_type = v_item->>'policyType' limit 1;

      if v_existing is not null and v_status = 'verified' and v_verified is not null and v_verified >= v_batch_date then
        v_summary := public.institution_import_bump(v_summary, 'skipped_verified', 'national_admission_policies');
        continue;
      end if;

      insert into public.national_admission_policies (
        authority, admission_session, institution_category, entry_mode, policy_type,
        numeric_value, value_unit, notes, publication_status, verification_status, source_id, source_url
      ) values (
        v_item->>'authority', coalesce(v_item->>'admissionSession',''), v_item->>'institutionCategory',
        coalesce(nullif(v_item->>'entryMode',''), 'UTME'), v_item->>'policyType',
        nullif(v_item->>'numericValue','')::numeric, v_item->>'valueUnit', v_item->>'notes',
        'in_review', 'in_review',
        (select id from public.edureach_sources where lower(url) = lower(v_item->>'sourceUrl') limit 1),
        v_item->>'sourceUrl'
      )
      on conflict (authority, admission_session, institution_category, entry_mode, policy_type) do update set
        numeric_value = excluded.numeric_value,
        value_unit = excluded.value_unit,
        notes = excluded.notes,
        publication_status = 'in_review',
        verification_status = 'in_review',
        source_url = excluded.source_url;

      v_summary := public.institution_import_bump(v_summary,
        case when v_existing is null then 'inserted' else 'updated' end, 'national_admission_policies');
    end loop;

    if p_dry_run then
      raise exception using errcode = 'P0001',
        message = '__INSTITUTION_IMPORT_DRY_RUN__',
        detail = v_summary::text;
    end if;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_detail = pg_exception_detail;
    if sqlerrm = '__INSTITUTION_IMPORT_DRY_RUN__' then
      return coalesce(nullif(v_detail, ''), '{}')::jsonb;
    end if;
    raise;
  end;

  return v_summary;
end
$import$;

comment on function public.institution_import_apply(jsonb, boolean) is
  'Applies one research batch in a single transaction. Defaults to a dry run, which writes inside a sentinel block and rolls it back while returning the same summary. New research is always in_review.';

revoke all on function public.institution_import_apply(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.institution_import_apply(jsonb, boolean) to service_role;
