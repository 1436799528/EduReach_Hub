-- CBT bank readiness: make the "not ready yet" failure visible before a student
-- finds it.
--
-- The observed error ("This CBT is not ready yet. Please choose another available
-- question bank.") is the user-facing mapping of "No questions are available for
-- the selected subjects", raised by start_cbt_attempt_for_subjects when
-- get_cbt_questions_for_subjects returns no rows. That function inner-joins on
-- subject, so a bank with hundreds of questions still returns nothing for a
-- subject it does not cover -- and content_integrity_report() only ever counted
-- exams with no questions at all, so such a bank reported as healthy.
--
-- This extends the existing report rather than adding a second one: two places
-- answering "is this bank healthy" is how the two drift apart. It adds the count
-- of active exams holding a subject with fewer than five questions, and the
-- per-subject coverage itself, so an operator can see exactly which subject a
-- student would be refused on.
--
-- Nothing here changes which exams are active, and no question data is touched.
-- Deciding what to do about a gap (add questions, or deactivate the exam) stays a
-- human editorial decision.

create or replace function public.content_integrity_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_news jsonb := '{}'::jsonb;
  v_cbt jsonb := '{}'::jsonb;
  v_opportunities jsonb := '{}'::jsonb;
  v_institutions jsonb := '{}'::jsonb;
begin
  if to_regclass('public.news_articles') is not null then
    execute $q$
      select jsonb_build_object(
        'published_total', count(*) filter (where published is true),
        'published_missing_source', count(*) filter (where published is true and coalesce(source_url, '') = ''),
        'published_non_https_source', count(*) filter (where published is true and source_url is not null and source_url <> '' and source_url not like 'https://%'),
        'published_expired', count(*) filter (where published is true and verification_status = 'expired'),
        'published_expiring_soon', count(*) filter (where published is true and expires_at is not null and expires_at between now() and now() + interval '7 days'),
        'duplicate_dedupe_keys', coalesce((select count(*) from (
            select dedupe_key from public.news_articles
             where dedupe_key is not null group by dedupe_key having count(*) > 1
          ) d), 0),
        'unknown_categories', count(*) filter (where published is true and category not in (
            'jamb','waec','neco','nabteb','admissions','admission','universities','polytechnics',
            'colleges-of-education','scholarships','funding','nelfund','post-utme','school-updates',
            'campus','examination-updates','results','academic-calendar','general'))
      ) from public.news_articles
    $q$ into v_news;
  end if;

  if to_regclass('public.cbt_exams') is not null and to_regclass('public.exam_questions') is not null then
    execute $q$
      select jsonb_build_object(
        'active_exams', (select count(*) from public.cbt_exams where is_active is true),
        'active_exams_without_questions', (
          select count(*) from public.cbt_exams e
           where e.is_active is true
             and not exists (select 1 from public.exam_questions q where q.exam_id = e.id)
        ),
        'questions_missing_options', (
          select count(*) from public.exam_questions q
           where coalesce(q.option_a,'') = '' or coalesce(q.option_b,'') = ''
              or coalesce(q.option_c,'') = '' or coalesce(q.option_d,'') = ''
        ),
        'questions_with_invalid_answer', (
          select count(*) from public.exam_questions q
           where q.correct_option is null or q.correct_option not in ('A','B','C','D')
        ),
        'questions_without_explanation', (
          select count(*) from public.exam_questions q where coalesce(q.explanation,'') = ''
        ),
        'duplicate_positions', coalesce((
          select count(*) from (
            select exam_id, coalesce(subject,''), position
              from public.exam_questions
             group by exam_id, coalesce(subject,''), position
            having count(*) > 1
          ) d
        ), 0),
        'active_exams_below_minimum', coalesce((
          select count(*) from (
            select e.id, count(q.id) as n
              from public.cbt_exams e
              left join public.exam_questions q on q.exam_id = e.id
             where e.is_active is true
             group by e.id
            having count(q.id) < 10
          ) d
        ), 0),
        -- A bank can be healthy in total and still fail a student: the paper is
        -- assembled per selected subject, so a subject the bank does not cover
        -- contributes nothing, and if every selected subject is uncovered the
        -- attempt is refused with "No questions are available for the selected
        -- subjects" -- which the student sees as "This CBT is not ready yet",
        -- after finishing the whole setup wizard. These two numbers make that
        -- visible to operations before a student finds it.
        'active_exams_with_thin_subjects', coalesce((
          select count(distinct exam_id) from (
            select q.exam_id, lower(trim(coalesce(q.subject, ''))) as subject, count(*) as n
              from public.exam_questions q
              join public.cbt_exams e on e.id = q.exam_id and e.is_active is true
             where trim(coalesce(q.subject, '')) <> ''
             group by q.exam_id, lower(trim(coalesce(q.subject, '')))
            having count(*) < 5
          ) thin
        ), 0),
        'subject_coverage', coalesce((
          select jsonb_agg(row_to_json(c) order by c.exam_title, c.subject) from (
            select e.title as exam_title,
                   lower(trim(coalesce(q.subject, ''))) as subject,
                   count(*)::int as questions
              from public.cbt_exams e
              join public.exam_questions q on q.exam_id = e.id
             where e.is_active is true and trim(coalesce(q.subject, '')) <> ''
             group by e.title, lower(trim(coalesce(q.subject, '')))
          ) c
        ), '[]'::jsonb)
      )
    $q$ into v_cbt;
  end if;

  if to_regclass('public.opportunities') is not null then
    execute $q$
      select jsonb_build_object(
        'active_total', count(*) filter (where is_active is true),
        'active_expired', count(*) filter (where is_active is true and deadline is not null and deadline < current_date),
        'active_without_deadline', count(*) filter (where is_active is true and deadline is null),
        'active_without_link', count(*) filter (where is_active is true and coalesce(link_url, '') = ''),
        'active_non_https_link', count(*) filter (where is_active is true and link_url is not null and link_url <> '' and link_url not like 'https://%'),
        'never_verified', count(*) filter (where is_active is true and last_verified_at is null)
      ) from public.opportunities
    $q$ into v_opportunities;
  end if;

  if to_regclass('public.institutions') is not null then
    -- school_name is the canonical column; guard the optional ones so this
    -- report also runs on a database that predates them.
    execute $q$
      select jsonb_build_object(
        'total', count(*),
        'missing_name', count(*) filter (where coalesce(school_name, '') = ''),
        'duplicate_names', coalesce((
          select count(*) from (
            select lower(trim(school_name)) from public.institutions
             group by lower(trim(school_name)) having count(*) > 1
          ) d
        ), 0),
        'missing_website', count(*) filter (where coalesce(website_url, '') = ''),
        'missing_state', count(*) filter (where coalesce(state, '') = ''),
        'non_https_website', count(*) filter (where website_url is not null and website_url <> '' and website_url not like 'https://%')
      ) from public.institutions
    $q$ into v_institutions;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'news', v_news,
    'cbt', v_cbt,
    'opportunities', v_opportunities,
    'institutions', v_institutions
  );
end $$;

revoke all on function public.content_integrity_report() from public, anon, authenticated;
grant execute on function public.content_integrity_report() to service_role;
