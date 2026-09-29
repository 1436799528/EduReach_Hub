-- Reconcile the production CBT subject-aware backend state with the canonical
-- subject-aware paper migration. This migration is intentionally idempotent.
-- It records the final runtime contract so fresh environments reproduce the
-- same RPC signatures, security model, and paper limits used by the frontend.

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
set search_path = ''
as $function$
  with requested as (
    select distinct trim(u.value) as subject, min(u.ordinality)::int as subject_order
    from unnest(coalesce(p_subjects, '{}'::text[])) with ordinality as u(value, ordinality)
    where trim(u.value) <> ''
    group by trim(u.value)
  ),
  ranked as (
    select q.id,q.subject,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,
           r.subject_order,e.exam_body,
           row_number() over (partition by q.subject order by q.position,q.id) as subject_position
    from public.exam_questions q
    join requested r on lower(trim(r.subject))=lower(trim(q.subject))
    join public.cbt_exams e on e.id=q.exam_id and e.is_active=true
    where q.exam_id=p_exam_id
  ),
  limited as (
    select *
    from ranked
    where subject_position <= case
      when upper(exam_body)='JAMB'
       and lower(trim(subject)) in ('use of english','english language','english') then 60
      else 40
    end
  )
  select id as question_id,
         row_number() over(order by subject_order,subject_position)::int as "position",
         subject,question_text,option_a,option_b,option_c,option_d
  from limited
  order by subject_order,subject_position;
$function$;

create or replace function public.start_cbt_attempt_for_subjects(
  p_exam_id uuid,
  p_subjects text[]
)
returns table(attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_total integer;
  v_now timestamptz:=now();
  v_subjects text[];
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_exam from public.cbt_exams where id=p_exam_id and is_active=true;
  if not found then raise exception 'CBT exam not found.'; end if;

  v_subjects:=array(
    select subject from (
      select trim(u.value) as subject,min(u.ordinality) as first_order
      from unnest(coalesce(p_subjects,'{}'::text[])) with ordinality as u(value,ordinality)
      where trim(u.value)<>'' group by trim(u.value)
    ) ordered order by first_order
  );

  if coalesce(array_length(v_subjects,1),0)=0 then
    raise exception 'At least one subject is required.';
  end if;

  if upper(v_exam.exam_body)='JAMB' then
    if array_length(v_subjects,1)<>4
       or lower(trim(v_subjects[1])) not in ('use of english','english language','english') then
      raise exception 'JAMB practice requires Use of English plus three other subjects.';
    end if;
  end if;

  select count(*) into v_total
  from public.get_cbt_questions_for_subjects(p_exam_id,v_subjects);
  if v_total=0 then raise exception 'No questions are available for the selected subjects.'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text||':'||p_exam_id::text||':'||array_to_string(v_subjects,'|'),0)
  );

  select * into v_existing
  from public.cbt_attempts
  where user_id=v_user and exam_id=p_exam_id and status='in_progress'
    and selected_subjects=v_subjects
  order by started_at desc limit 1 for update;

  if found and (v_existing.expires_at is null or v_existing.expires_at>v_now) then
    return query select v_existing.id,v_existing.started_at,v_existing.expires_at,v_existing.total_questions;
    return;
  end if;

  if found then
    update public.cbt_attempts set status='expired',updated_at=v_now
    where id=v_existing.id and status='in_progress';
  end if;

  insert into public.cbt_attempts(user_id,exam_id,status,started_at,expires_at,total_questions,selected_subjects)
  values(v_user,p_exam_id,'in_progress',v_now,
         v_now+(v_exam.duration_minutes||' minutes')::interval,v_total,v_subjects)
  returning * into v_attempt;

  return query select v_attempt.id,v_attempt.started_at,v_attempt.expires_at,v_attempt.total_questions;
end;
$function$;

create or replace function public.submit_cbt_attempt_for_subjects(
  p_attempt_id uuid,
  p_exam_id uuid,
  p_answers jsonb
)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_question record;
  v_selected integer;
  v_correct integer;
  v_total integer:=0;
  v_score numeric;
  v_breakdown jsonb:='[]'::jsonb;
  v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;

  select * into v_attempt
  from public.cbt_attempts
  where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user
  for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;

  if v_attempt.expires_at is not null and v_attempt.expires_at<v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id;
    raise exception 'This CBT attempt has expired.';
  end if;

  for v_question in
    select * from public.get_cbt_questions_for_subjects(p_exam_id,v_attempt.selected_subjects)
    order by "position"
  loop
    v_total:=v_total+1;
    v_selected:=null;

    if p_answers ? v_question.position::text then
      begin
        v_selected:=(p_answers->>v_question.position::text)::integer;
      exception when others then
        raise exception 'Invalid answer for question %.',v_question.position;
      end;
      if v_selected<0 or v_selected>3 then
        raise exception 'Invalid answer for question %.',v_question.position;
      end if;
    end if;

    select ascii(q.correct_option)-ascii('A') into v_correct
    from public.exam_questions q where q.id=v_question.question_id;

    v_breakdown:=v_breakdown||jsonb_build_array(
      jsonb_build_object('question',v_question.position,'selected',v_selected,'correct',v_correct)
    );

    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct)
    values(v_attempt.id,v_question.question_id,
           case when v_selected is null then null else chr(ascii('A')+v_selected) end,
           case when v_selected is null then false else v_selected=v_correct end)
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update
      set selected_option=excluded.selected_option,
          is_correct=excluded.is_correct,
          answered_at=now();
  end loop;

  select count(*) into v_correct
  from public.cbt_answers
  where public.cbt_answers.attempt_id=v_attempt.id
    and public.cbt_answers.is_correct=true;

  if v_total=0 then
    raise exception 'This CBT exam has no questions for the selected subjects.';
  end if;

  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);

  update public.cbt_attempts
  set status='submitted',submitted_at=v_now,score=v_score,
      correct_answers=v_correct,total_questions=v_total,updated_at=v_now
  where id=v_attempt.id and status='in_progress';

  return query select v_attempt.id,v_score,v_breakdown;
end;
$function$;

revoke execute on function public.get_cbt_questions_for_subjects(uuid,text[]) from public,anon;
grant execute on function public.get_cbt_questions_for_subjects(uuid,text[]) to authenticated;

revoke execute on function public.start_cbt_attempt_for_subjects(uuid,text[]) from public,anon;
grant execute on function public.start_cbt_attempt_for_subjects(uuid,text[]) to authenticated;

revoke execute on function public.submit_cbt_attempt_for_subjects(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_cbt_attempt_for_subjects(uuid,uuid,jsonb) to authenticated;
