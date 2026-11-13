create or replace function public.cbt_exams_apply_mock_spec()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if upper(trim(new.exam_body)) = 'JAMB' then
    new.duration_minutes := 120;
    new.mock_question_count := 180;
    new.mock_subject_quota := '{"english": 60, "other": 40}'::jsonb;
  end if;
  return new;
end;
$function$;

drop trigger if exists cbt_exams_apply_mock_spec on public.cbt_exams;
create trigger cbt_exams_apply_mock_spec
  before insert or update of exam_body, duration_minutes, mock_question_count, mock_subject_quota
  on public.cbt_exams
  for each row execute function public.cbt_exams_apply_mock_spec();

-- Normalise existing JAMB rows after installing the enforcing trigger.
update public.cbt_exams
set duration_minutes = 120,
    mock_question_count = 180,
    mock_subject_quota = '{"english": 60, "other": 40}'::jsonb,
    updated_at = now()
where upper(trim(exam_body)) = 'JAMB';
