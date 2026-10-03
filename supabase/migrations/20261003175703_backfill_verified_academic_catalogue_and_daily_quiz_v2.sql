-- Backfill verified academic reference data and seed the daily quiz from the governed CBT bank.
insert into public.ccmas_disciplines (name, source_url, status)
select trim(cp.discipline),
       coalesce(nullif(trim(cp.source_url), ''), 'https://www.nuc.edu.ng/ccmas/'),
       'active'
from (
  select cp.*, row_number() over (
    partition by lower(trim(cp.discipline))
    order by cp.updated_at desc nulls last, cp.id
  ) rn
  from public.ccmas_programmes cp
  where nullif(trim(cp.discipline), '') is not null
) cp
where cp.rn = 1
on conflict (name) do update
set source_url = coalesce(excluded.source_url, public.ccmas_disciplines.source_url),
    updated_at = now();

update public.ccmas_programmes cp
set discipline_id = d.id, updated_at = now()
from public.ccmas_disciplines d
where lower(d.name) = lower(trim(cp.discipline))
  and cp.discipline_id is distinct from d.id;

insert into public.national_programme_catalogue
  (discipline_id, programme_name, programme_code, source_url, source_type, status)
select d.id, cp.programme_name, cp.programme_code,
       coalesce(nullif(trim(cp.source_url), ''), 'https://www.nuc.edu.ng/ccmas/'),
       'nuc_ccmas', 'catalogued'
from (
  select cp.*, row_number() over (
    partition by lower(trim(cp.programme_name))
    order by cp.updated_at desc nulls last, cp.id
  ) rn
  from public.ccmas_programmes cp
  where nullif(trim(cp.programme_name), '') is not null
) cp
left join public.ccmas_disciplines d on lower(d.name) = lower(trim(cp.discipline))
where cp.rn = 1
  and not exists (
    select 1 from public.national_programme_catalogue npc
    where lower(npc.programme_name) = lower(cp.programme_name)
  );

insert into public.daily_quizzes (quiz_date, discipline, title, status)
select current_date, 'General',
       'EduReach Daily Quiz — ' || to_char(current_date, 'DD Mon YYYY'),
       'published'
where not exists (
  select 1 from public.daily_quizzes
  where quiz_date = current_date and discipline = 'General'
);

with quiz as (
  select id from public.daily_quizzes
  where quiz_date = current_date and discipline = 'General' limit 1
),
picked as (
  select eq.*, row_number() over (order by eq.created_at, eq.id) rn
  from public.exam_questions eq
  join public.cbt_exams ce on ce.id = eq.exam_id
  where ce.is_active
    and nullif(trim(eq.question_text), '') is not null
    and eq.option_a is not null and eq.option_b is not null
    and eq.option_c is not null and eq.option_d is not null
    and eq.correct_option in ('A','B','C','D')
)
insert into public.daily_quiz_questions
  (quiz_id, question_text, option_a, option_b, option_c, option_d,
   correct_option, explanation, position, points)
select q.id, p.question_text, p.option_a, p.option_b, p.option_c, p.option_d,
       p.correct_option, p.explanation, p.rn::smallint, 10
from quiz q join picked p on p.rn <= 10
where not exists (
  select 1 from public.daily_quiz_questions dqq where dqq.quiz_id = q.id
);