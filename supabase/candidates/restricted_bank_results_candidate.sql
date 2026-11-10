-- INCOMPLETE LOCAL CANDIDATE: DO NOT DEPLOY. Depends on both restricted bank
-- foundation and reader candidates. This covers selected legacy DB result
-- paths only. Service-role routes, aggregate analytics, v2 replay/finalization,
-- policy races, content mutation/imports, and compatible UI remain unresolved.
begin;

-- A whole restricted row is withheld before release, rather than granting a
-- browser direct access to raw score/correct_answers. Existing owner RLS still
-- applies. Public rows remain visible; assignment is required after release.
create policy cbt_restricted_attempt_read_candidate on public.cbt_attempts
as restrictive for select to authenticated
using (public.cbt_bank_corrections_released(exam_id));

alter function public.submit_cbt_attempt_configured(uuid,jsonb) rename to cbt_unchecked_submit_configured_candidate;
revoke all on function public.cbt_unchecked_submit_configured_candidate(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.submit_cbt_attempt_configured(p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,correct_answers integer,total_questions integer,breakdown jsonb)
language plpgsql security definer set search_path='' as $$
declare v_exam uuid; v_released boolean;
begin
  select a.exam_id into v_exam from public.cbt_attempts a where a.id=p_attempt_id and a.user_id=auth.uid();
  if not found or not public.cbt_bank_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  v_released:=public.cbt_bank_corrections_released(v_exam);
  return query select r.attempt_id,case when v_released then r.score else null end,
    case when v_released then r.correct_answers else null end,r.total_questions,
    case when v_released then r.breakdown else '[]'::jsonb end
    from public.cbt_unchecked_submit_configured_candidate(p_attempt_id,p_answers) r;
end $$;
revoke all on function public.submit_cbt_attempt_configured(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.submit_cbt_attempt_configured(uuid,jsonb) to authenticated;

alter function public.submit_cbt_attempt(uuid,uuid,jsonb) rename to cbt_unchecked_submit_legacy_candidate;
-- Repair the legacy scorer's ambiguous ON CONFLICT / attempt_id references.
-- Its full-bank contract is retained only for explicitly public banks below.
create or replace function public.cbt_unchecked_submit_legacy_candidate(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_question public.exam_questions%rowtype;
  v_selected integer; v_correct integer; v_total integer:=0; v_score numeric; v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts a where a.id=p_attempt_id and a.exam_id=p_exam_id and a.user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol <> 'legacy' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at<v_now then update public.cbt_attempts a set status='expired',updated_at=v_now where a.id=v_attempt.id; raise exception 'This CBT attempt has expired.'; end if;
  for v_question in select q.* from public.exam_questions q where q.exam_id=p_exam_id order by q.position loop
    v_total:=v_total+1; v_selected:=null;
    if p_answers ? v_question.position::text then
      begin v_selected:=(p_answers->>v_question.position::text)::integer; exception when others then raise exception 'Invalid answer for question %.',v_question.position; end;
      if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_question.position; end if;
    end if;
    v_correct:=ascii(v_question.correct_option)-ascii('A');
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_question.position,'selected',v_selected,'correct',v_correct,'explanation',v_question.explanation));
    insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct)
      values(v_attempt.id,v_question.id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end)
      on conflict on constraint cbt_answers_attempt_id_question_id_key do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
  end loop;
  select count(*) into v_correct from public.cbt_answers a where a.attempt_id=v_attempt.id and a.is_correct=true;
  if v_total=0 then raise exception 'This CBT exam has no questions yet.'; end if;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  update public.cbt_attempts a set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,updated_at=v_now where a.id=v_attempt.id and a.status='in_progress';
  return query select v_attempt.id,v_score,v_breakdown;
end $$;
revoke all on function public.cbt_unchecked_submit_legacy_candidate(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.submit_cbt_attempt(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table(attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path='' as $$
declare v_exam uuid; v_released boolean;
begin
  select a.exam_id into v_exam from public.cbt_attempts a where a.id=p_attempt_id and a.user_id=auth.uid();
  if not found or v_exam is distinct from p_exam_id or not public.cbt_bank_candidate_access(v_exam) then raise exception 'CBT attempt not found.'; end if;
  -- This old scorer reads the whole current bank rather than a frozen paper.
  -- Restricted use is intentionally unsupported; use the configured scorer.
  if not exists (select 1 from public.cbt_bank_security s where s.exam_id=v_exam and s.visibility='public') then
    raise exception 'Legacy submission is unavailable for this bank.';
  end if;
  v_released:=public.cbt_bank_corrections_released(v_exam);
  return query select r.attempt_id,case when v_released then r.score else null end,
    case when v_released then r.breakdown else '[]'::jsonb end
    from public.cbt_unchecked_submit_legacy_candidate(p_attempt_id,p_exam_id,p_answers) r;
end $$;
revoke all on function public.submit_cbt_attempt(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.submit_cbt_attempt(uuid,uuid,jsonb) to authenticated;
-- The older subject-submit RPC is not a supported authenticated entry point.
revoke all on function public.submit_cbt_attempt_for_subjects(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

alter function public.get_cbt_result(uuid) rename to cbt_unchecked_result_candidate;
revoke all on function public.cbt_unchecked_result_candidate(uuid) from public,anon,authenticated,service_role;
create function public.get_cbt_result(p_attempt_id uuid)
returns table(attempt_id uuid,exam_id uuid,score numeric,correct_answers integer,total_questions integer,submitted_at timestamptz,
  question_id uuid,"position" integer,question_text text,option_a text,option_b text,option_c text,option_d text,
  correct_option character,explanation text,selected_option character,is_correct boolean)
language sql stable security definer set search_path='' as $$
  select r.* from public.cbt_unchecked_result_candidate(p_attempt_id) r
  where public.cbt_bank_candidate_access(r.exam_id) and public.cbt_bank_corrections_released(r.exam_id)
$$;
revoke all on function public.get_cbt_result(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_cbt_result(uuid) to authenticated;

alter function public.get_cbt_attempt_history(integer) rename to cbt_unchecked_history_candidate;
revoke all on function public.cbt_unchecked_history_candidate(integer) from public,anon,authenticated,service_role;
create function public.get_cbt_attempt_history(p_limit integer default 20)
returns table(attempt_id uuid,exam_id uuid,exam_title text,exam_body text,mode text,programme text,status text,score numeric,
  correct_answers integer,total_questions integer,duration_minutes integer,selected_subjects text[],started_at timestamptz,
  expires_at timestamptz,submitted_at timestamptz,answered integer)
language sql stable security definer set search_path='' as $$
  select r.attempt_id,r.exam_id,r.exam_title,r.exam_body,r.mode,r.programme,r.status,
    case when public.cbt_bank_corrections_released(r.exam_id) then r.score else null end,
    case when public.cbt_bank_corrections_released(r.exam_id) then r.correct_answers else null end,
    r.total_questions,r.duration_minutes,r.selected_subjects,r.started_at,r.expires_at,r.submitted_at,
    case when r.status='in_progress' or public.cbt_bank_corrections_released(r.exam_id) then r.answered else null end
  from public.cbt_unchecked_history_candidate(p_limit) r where public.cbt_bank_candidate_access(r.exam_id)
$$;
revoke all on function public.get_cbt_attempt_history(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_cbt_attempt_history(integer) to authenticated;

-- Global dashboard averages must never incorporate restricted or unclassified
-- results: repeated differences could otherwise serve as a score oracle. This
-- helper is service-only; Express separately checks analytics capability.
create function public.cbt_public_score_average() returns numeric
language sql stable security definer set search_path='' as $$
  select round(avg(a.score),2) from public.cbt_attempts a
  join public.cbt_bank_security s on s.exam_id=a.exam_id and s.visibility='public'
  where a.status='submitted'
$$;
revoke all on function public.cbt_public_score_average() from public,anon,authenticated,service_role;
grant execute on function public.cbt_public_score_average() to service_role;

commit;
