-- Backend alignment for the current CBT exam shell.
-- Enforces expiry in PostgreSQL and evaluates the frozen paper stored on the attempt.

create or replace function public.save_cbt_attempt_draft(p_attempt_id uuid, p_answers jsonb, p_question_index integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := auth.uid(); v_attempt public.cbt_attempts%rowtype;
  v_clean jsonb := '{}'::jsonb; v_total integer; v_key text; v_value jsonb;
  v_index integer; v_int integer; v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  v_total := coalesce(array_length(v_attempt.question_ids,1),v_attempt.total_questions);
  for v_key,v_value in select entry.key,entry.value from jsonb_each(p_answers) entry(key,value) loop
    begin v_index:=v_key::integer; exception when others then continue; end;
    if v_index<1 or v_index>greatest(v_total,1) then continue; end if;
    if jsonb_typeof(v_value)<>'number' or v_value::text !~ '^[0-9]+$' then continue; end if;
    v_int:=(v_value::text)::integer;
    if v_int<0 or v_int>3 then continue; end if;
    v_clean:=v_clean||jsonb_build_object(v_key,v_int);
    if (select count(*) from jsonb_object_keys(v_clean))>=500 then exit; end if;
  end loop;
  update public.cbt_attempts set answers_draft=v_clean,
    current_question=case when p_question_index is not null and p_question_index>=0
      and p_question_index<greatest(v_total,1) then p_question_index else current_question end,
    updated_at=v_now where id=v_attempt.id;
  return jsonb_build_object('answers',v_clean,'questionIndex',coalesce(p_question_index,v_attempt.current_question,0),'expiresAt',v_attempt.expires_at);
end;
$function$;

create or replace function public.get_cbt_attempt_paper(p_attempt_id uuid)
returns table("position" integer, subject text, question_id uuid, question_text text, option_a text, option_b text, option_c text, option_d text)
language plpgsql stable security definer set search_path = ''
as $function$
declare v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status='in_progress' and v_attempt.expires_at is not null and v_attempt.expires_at<=v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  if coalesce(array_length(v_attempt.question_ids,1),0)>0 then
    return query select u.ordinality::int,trim(q.subject),q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d
    from unnest(v_attempt.question_ids) with ordinality u(value,ordinality)
    join public.exam_questions q on q.id=u.value order by u.ordinality;
    return;
  end if;
  return query select p."position",p.subject,p.question_id,p.question_text,p.option_a,p.option_b,p.option_c,p.option_d
  from public.get_cbt_questions_for_subjects(v_attempt.exam_id,v_attempt.selected_subjects) p order by p."position";
end;
$function$;

create or replace function public.submit_cbt_attempt_configured(p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,correct_answers integer,total_questions integer,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_row record;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric;
  v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now(); v_answers jsonb:=coalesce(p_answers,'{}'::jsonb);
  v_explanation text;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(v_answers)<>'object' then raise exception 'Answers must be an object.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status='submitted' then
    return query select v_attempt.id,v_attempt.score,v_attempt.correct_answers,v_attempt.total_questions,coalesce(stored.breakdown,'[]'::jsonb)
    from (
      select jsonb_agg(jsonb_build_object('question',slot.ordinality,'subject',trim(q.subject),
        'selected',case when ans.selected_option is null then null else ascii(ans.selected_option)-ascii('A') end,
        'correct',ascii(q.correct_option)-ascii('A'),'explanation',q.explanation) order by slot.ordinality) breakdown
      from unnest(v_attempt.question_ids) with ordinality slot(value,ordinality)
      join public.exam_questions q on q.id=slot.value
      left join public.cbt_answers ans on ans.attempt_id=v_attempt.id and ans.question_id=q.id
    ) stored;
    return;
  end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been closed.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<=v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  for v_row in select * from public.get_cbt_attempt_paper(v_attempt.id) loop
    v_total:=v_total+1; v_selected:=null;
    if v_answers ? v_row."position"::text then
      begin v_selected:=(v_answers->>v_row."position"::text)::integer;
      exception when others then raise exception 'Invalid answer for question %.',v_row."position"; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_row."position"; end if;
    end if;
    select ascii(q.correct_option)-ascii('A'),q.explanation into v_correct,v_explanation from public.exam_questions q where q.id=v_row.question_id;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_row."position",'subject',v_row.subject,'selected',v_selected,'correct',v_correct,'explanation',v_explanation));
    insert into public.cbt_answers as target_answers(attempt_id,question_id,selected_option,is_correct,answered_at)
    values(v_attempt.id,v_row.question_id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,
      case when v_selected is null then false else v_selected=v_correct end,v_now)
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  if v_total=0 then raise exception 'This CBT attempt has no questions.'; end if;
  select count(*) into v_correct from public.cbt_answers where cbt_answers.attempt_id=v_attempt.id and cbt_answers.is_correct=true;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,answers_draft='{}'::jsonb,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_correct,v_total,v_breakdown;
end;
$function$;

create or replace function public.submit_cbt_attempt_for_subjects(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_row record;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric;
  v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<=v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  for v_row in select * from public.get_cbt_attempt_paper(v_attempt.id) order by "position" loop
    v_total:=v_total+1; v_selected:=null;
    if p_answers ? v_row."position"::text then
      begin v_selected:=(p_answers->>v_row."position"::text)::integer;
      exception when others then raise exception 'Invalid answer for question %.',v_row."position"; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_row."position"; end if;
    end if;
    select ascii(q.correct_option)-ascii('A') into v_correct from public.exam_questions q where q.id=v_row.question_id;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_row."position",'subject',v_row.subject,'selected',v_selected,'correct',v_correct));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct,answered_at)
    values(v_attempt.id,v_row.question_id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end,v_now)
    on conflict on constraint cbt_answers_attempt_id_question_id_key do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  if v_total=0 then raise exception 'This CBT exam has no questions for the selected subjects.'; end if;
  select count(*) into v_correct from public.cbt_answers where public.cbt_answers.attempt_id=v_attempt.id and public.cbt_answers.is_correct=true;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,answers_draft='{}'::jsonb,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_breakdown;
end;
$function$;