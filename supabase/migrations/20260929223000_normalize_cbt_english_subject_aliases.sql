-- Normalize the English subject aliases used by WAEC/NECO/Post-UTME
-- while preserving the JAMB paper rule.
create or replace function public.get_cbt_questions_for_subjects(
  p_exam_id uuid,
  p_subjects text[]
)
returns table(
  question_id uuid,
  "position" integer,
  subject text,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
language sql
stable
security definer
set search_path=''
as $function$
with requested as (
  select distinct trim(u.value) as subject,min(u.ordinality)::int as subject_order
  from unnest(coalesce(p_subjects,'{}'::text[])) with ordinality u(value,ordinality)
  where trim(u.value)<>'' group by trim(u.value)
), ranked as (
  select q.id,q.subject,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,
         r.subject_order,e.exam_body,
         row_number() over (
           partition by case
             when lower(trim(q.subject)) in ('use of english','english language','english') then 'english'
             else lower(trim(q.subject))
           end
           order by q.position,q.id
         ) subject_position
  from public.exam_questions q
  join requested r on (
    lower(trim(r.subject))=lower(trim(q.subject))
    or (
      lower(trim(r.subject)) in ('use of english','english language','english')
      and lower(trim(q.subject)) in ('use of english','english language','english')
    )
  )
  join public.cbt_exams e on e.id=q.exam_id and e.is_active=true
  where q.exam_id=p_exam_id
), limited as (
  select * from ranked
  where subject_position <= case
    when upper(exam_body)='JAMB'
      and lower(trim(subject)) in ('use of english','english language','english') then 60
    else 40
  end
)
select id,row_number() over(order by subject_order,subject_position)::int,
       subject,question_text,option_a,option_b,option_c,option_d
from limited
order by subject_order,subject_position;
$function$;

revoke execute on function public.get_cbt_questions_for_subjects(uuid,text[]) from public,anon;
grant execute on function public.get_cbt_questions_for_subjects(uuid,text[]) to authenticated;
