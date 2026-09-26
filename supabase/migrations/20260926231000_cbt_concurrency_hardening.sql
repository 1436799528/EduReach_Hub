-- CBT concurrency hardening.
-- Lock owned attempt rows so duplicate starts/submissions cannot race.

create or replace function public.start_cbt_attempt(p_exam_id uuid)
returns table(attempt_id uuid, started_at timestamptz, expires_at timestamptz, total_questions integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_exam public.cbt_exams%rowtype;
  v_count integer;
  v_existing public.cbt_attempts%rowtype;
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_exam_id::text, 0));
  select * into v_exam from public.cbt_exams where id=p_exam_id and is_active=true;
  if not found then raise exception 'CBT exam not found.'; end if;
  select count(*) into v_count from public.exam_questions where exam_id=p_exam_id;
  if v_count=0 then raise exception 'This CBT exam has no questions yet.'; end if;
  select * into v_existing from public.cbt_attempts
    where user_id=v_user and exam_id=p_exam_id and status='in_progress'
    order by started_at desc limit 1 for update;
  if found and (v_existing.expires_at is null or v_existing.expires_at>v_now) then
    return query select v_existing.id,v_existing.started_at,v_existing.expires_at,v_existing.total_questions; return;
  end if;
  if found then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_existing.id and status='in_progress'; end if;
  insert into public.cbt_attempts(user_id,exam_id,status,started_at,expires_at,total_questions)
    values(v_user,p_exam_id,'in_progress',v_now,v_now+(v_exam.duration_minutes||' minutes')::interval,v_count)
    returning * into v_attempt;
  return query select v_attempt.id,v_attempt.started_at,v_attempt.expires_at,v_attempt.total_questions;
end;
$$;

create or replace function public.submit_cbt_attempt(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_question public.exam_questions%rowtype;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric; v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<v_now then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id; raise exception 'This CBT attempt has expired.'; end if;
  for v_question in select * from public.exam_questions where exam_id=p_exam_id order by position loop
    v_total:=v_total+1; v_selected:=null;
    if p_answers ? v_question.position::text then
      begin v_selected:=(p_answers->>v_question.position::text)::integer; exception when others then raise exception 'Invalid answer for question %.',v_question.position; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_question.position; end if;
    end if;
    v_correct:=ascii(v_question.correct_option)-ascii('A');
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_question.position,'selected',v_selected,'correct',v_correct,'explanation',v_question.explanation));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct)
      values(v_attempt.id,v_question.id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end)
      on conflict (attempt_id,question_id) do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  select count(*) into v_correct from public.cbt_answers where attempt_id=v_attempt.id and is_correct=true;
  if v_total=0 then raise exception 'This CBT exam has no questions yet.'; end if;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_breakdown;
end;
$$;
