-- Widen the submission delivery window from 30 to 120 seconds, and record
-- how late each accepted submission actually arrived.
--
-- 20261022093000 introduced cbt_submit_grace() = 30 seconds so an honest
-- auto-submit at countdown zero is graded instead of refused. Thirty seconds
-- covers the page's own one-second tick; it does not cover a phone that loses
-- signal just before the deadline and reconnects a minute later, which is the
-- network profile of the students this serves. The window is now 120 seconds
-- (docs/audit/PRODUCTION-SCALE-AUDIT-2026-10.md, owner decision 2026-10-21).
--
-- The rule that matters is unchanged: draft saves still stop at expires_at,
-- so the window delivers a submission; it does not extend answering time.
--
-- submission_late_ms records the margin on every accepted submission (0 when
-- on time), so the window can be tightened later from evidence.

alter table public.cbt_attempts
  add column if not exists submission_late_ms integer;

comment on column public.cbt_attempts.submission_late_ms is
  'How far past expires_at the accepted submission arrived, in milliseconds (0 = on time). Null until submitted.';

create or replace function public.cbt_submit_grace()
returns interval
language sql
immutable
as $function$
  select interval '120 seconds';
$function$;

revoke execute on function public.cbt_submit_grace() from public, anon, authenticated;

create or replace function public.submit_cbt_attempt_configured(p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,correct_answers integer,total_questions integer,breakdown jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_row record;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric;
  v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now(); v_answers jsonb:=coalesce(p_answers,'{}'::jsonb);
  v_explanation text; v_late_ms integer:=0;
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
  -- Arriving a moment after the countdown reaches zero is normal; arriving a
  -- window later means the paper really is over.
  if v_attempt.expires_at is not null and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id and status='in_progress';
    raise exception 'This CBT attempt has expired.';
  end if;
  -- How late this accepted submission arrived (0 = on time), so the window
  -- can later be tightened from evidence instead of opinion.
  if v_attempt.expires_at is not null and v_now>v_attempt.expires_at then
    v_late_ms:=floor(extract(epoch from (v_now-v_attempt.expires_at))*1000)::integer;
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
  update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,answers_draft='{}'::jsonb,submission_late_ms=v_late_ms,updated_at=v_now where id=v_attempt.id and status='in_progress';
  return query select v_attempt.id,v_score,v_correct,v_total,v_breakdown;
end;
$function$;
