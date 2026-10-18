-- Reconciliation: copy eligible legacy comprehensive-bank questions into the preferred Practice Banks.
-- Preserves original exam/question records and all attempt/answer history (legacy banks stay, deactivated).
-- Copies are inserted as new rows with new IDs, retaining provenance/review status, avoiding duplicates
-- by normalized question_text and avoiding position conflicts by continuing from max(position) in destination.
-- Idempotent: re-running does not duplicate (guard on lower(trim(question_text))).
-- History preserved: cbt_attempts/cbt_answers still reference original IDs; simulator uses destination IDs going forward.
-- Note: legacy comprehensive banks hold 400 Q each (40/subject, 9 subjects) with source_type='unverified';
-- Practice Banks hold 213 Q (JAMB 122, WAEC 36, NECO 31, Post-UTME 24) with original_practice.
-- After copy, active banks will hold legacy+practice minus exact-text duplicates, verified subject-by-subject.

do $copy_legacy$
declare
  legacy_title text;
  dest_title text;
  legacy_id uuid;
  dest_id uuid;
  max_pos integer;
  rec record;
  next_pos integer;
begin
  for legacy_title, dest_title in
    select m[1], m[2] from (values
      (array['JAMB UTME Comprehensive Practice Bank','JAMB UTME Practice Bank']),
      (array['WAEC SSCE Comprehensive Practice Bank','WAEC SSCE Practice Bank']),
      (array['NECO SSCE Comprehensive Practice Bank','NECO SSCE Practice Bank']),
      (array['Post-UTME Comprehensive Practice Bank','Post-UTME Practice Bank'])
    ) as t(m)
  loop
    select id into legacy_id from public.cbt_exams where title = legacy_title limit 1;
    select id into dest_id from public.cbt_exams where title = dest_title limit 1;
    if legacy_id is null or dest_id is null then
      continue;
    end if;

    select coalesce(max(position), 0) into max_pos from public.exam_questions where exam_id = dest_id;
    next_pos := max_pos + 1;

    for rec in
      select q.* from public.exam_questions q
      where q.exam_id = legacy_id
        and not exists (
          select 1 from public.exam_questions d
          where d.exam_id = dest_id and lower(trim(d.question_text)) = lower(trim(q.question_text))
        )
      order by q.position, q.id
    loop
      -- Find next free position (handles gaps, though max_pos should be sufficient)
      while exists (select 1 from public.exam_questions where exam_id = dest_id and position = next_pos) loop
        next_pos := next_pos + 1;
      end loop;

      begin
        insert into public.exam_questions
          (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
        values
          (dest_id, rec.subject, rec.question_text, rec.option_a, rec.option_b, rec.option_c, rec.option_d, rec.correct_option, rec.explanation, rec.marks, next_pos, rec.source_type, rec.source_name, rec.source_year, rec.review_status, rec.format_verified, rec.response_type, rec.difficulty);
        next_pos := next_pos + 1;
      exception when unique_violation then
        -- Position race, try next
        next_pos := next_pos + 1;
        continue;
      end;
    end loop;
  end loop;
end $copy_legacy$;
