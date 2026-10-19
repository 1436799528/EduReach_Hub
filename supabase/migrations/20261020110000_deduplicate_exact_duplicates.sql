-- Deduplicate exact full duplicates (question_text + options + correct_option identical)
-- Production had 1620 rows with 447 unique normalized texts; 18 groups with 40 rows total
-- and 22 deletable if unreferenced. Of those, 12 were unreferenced and safe to delete
-- (verified via cbt_answers check). This migration preserves student data (never deletes
-- referenced questions) and does not delete on text similarity alone (only exact full match).
-- Applied manually on prod 2026-10-18 via execute_query (12 rows deleted), recorded here
-- for repo sync. Idempotent.

with ranked as (
  select id,
         row_number() over (
           partition by lower(trim(question_text)),
                        lower(trim(option_a)),
                        lower(trim(option_b)),
                        lower(trim(option_c)),
                        lower(trim(option_d)),
                        correct_option
           order by created_at, id
         ) as rn
  from public.exam_questions
),
to_delete as (
  select id from ranked
  where rn > 1
    and not exists (select 1 from public.cbt_answers a where a.question_id = ranked.id)
)
delete from public.exam_questions
where id in (select id from to_delete);
