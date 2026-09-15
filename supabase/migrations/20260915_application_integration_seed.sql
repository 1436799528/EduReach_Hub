alter table public.service_requests
  add column if not exists reference_code text;

create unique index if not exists service_requests_reference_code_uidx
  on public.service_requests(reference_code)
  where reference_code is not null;

create or replace function public.set_service_reference_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference_code is null or btrim(new.reference_code) = '' then
    new.reference_code := 'ER-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  new.form_data := jsonb_set(
    coalesce(new.form_data, '{}'::jsonb),
    '{reference_code}',
    to_jsonb(new.reference_code),
    true
  );
  return new;
end;
$$;

drop trigger if exists service_requests_set_reference_code on public.service_requests;
create trigger service_requests_set_reference_code
before insert on public.service_requests
for each row execute function public.set_service_reference_code();

insert into public.cbt_exams (title, exam_body, subject, description, duration_minutes, is_active)
select 'EduReach General Practice Demo', 'EduReach', 'Mixed',
       'Local prototype question bank for CBT flow testing.', 30, true
where not exists (
  select 1 from public.cbt_exams where title = 'EduReach General Practice Demo'
);

with exam as (
  select id from public.cbt_exams where title = 'EduReach General Practice Demo' limit 1
)
insert into public.exam_questions (
  exam_id, question_text, option_a, option_b, option_c, option_d,
  correct_option, explanation, marks, position
)
select exam.id, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d,
       x.correct_option, x.explanation, 1, x.position
from exam
cross join (values
  (1,'Choose the word nearest in meaning to "rapid".','Slow','Fast','Late','Weak','B','Rapid means fast or quick.'),
  (2,'What is 15% of 200?','20','25','30','35','C','15 percent of 200 is 30.'),
  (3,'Which quantity is measured in newtons?','Power','Force','Energy','Pressure','B','Force is measured in newtons.'),
  (4,'What is the chemical symbol for sodium?','S','So','Na','Sn','C','Na is the chemical symbol for sodium.'),
  (5,'Choose the correctly spelled word.','Accomodate','Acommodate','Accommodate','Accomoddate','C','Accommodate is the correct spelling.'),
  (6,'Solve: 3x = 21.','5','6','7','8','C','Divide both sides by 3 to get x = 7.'),
  (7,'Which organelle is commonly called the powerhouse of the cell?','Nucleus','Ribosome','Mitochondrion','Golgi body','C','Mitochondria are commonly called the powerhouse of the cell.'),
  (8,'What is the SI unit of electric current?','Volt','Ohm','Ampere','Watt','C','Electric current is measured in amperes.'),
  (9,'What is the next prime number after 11?','12','13','14','15','B','13 is the next prime number after 11.'),
  (10,'Nigeria is located on which continent?','Asia','Africa','Europe','South America','B','Nigeria is in Africa.')
) as x(position,question_text,option_a,option_b,option_c,option_d,correct_option,explanation)
where not exists (
  select 1
  from public.exam_questions q
  where q.exam_id = exam.id and q.position = x.position
);

insert into public.news_articles (
  slug, title, excerpt, body, category, source_name, published, published_at
)
values
  (
    'jamb-update',
    'JAMB update desk',
    'A prototype space for verified JAMB notices, slip updates and candidate guidance.',
    'This is seeded prototype content. Replace with verified editorial content before publishing real-world updates.',
    'JAMB', 'EduReach Editorial Desk', true, now()
  ),
  (
    'admission-watch',
    'Admission watch',
    'Track admission lists, supplementary opportunities and application reminders.',
    'This is seeded prototype content. Use official institution sources for every live admission notice.',
    'Admissions', 'EduReach Editorial Desk', true, now()
  ),
  (
    'funding-alerts',
    'Student funding alerts',
    'Follow funding and student-support information as it is published.',
    'This is seeded prototype content for the local integration test. Live funding updates should carry their official source.',
    'Funding', 'EduReach Editorial Desk', true, now()
  )
on conflict (slug) do update
set title = excluded.title,
    excerpt = excluded.excerpt,
    body = excluded.body,
    category = excluded.category,
    source_name = excluded.source_name,
    published = excluded.published,
    published_at = excluded.published_at,
    updated_at = now();
