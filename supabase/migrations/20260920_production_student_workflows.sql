-- Production student-facing data and workflow hardening.
-- Applied to Supabase project gjdfatwcoosyuhakrrhh on 2026-09-20.
-- University seed is sourced from the current NUC Nigerian University System directory.

insert into public.service_catalog (service_key,title,description,application_url,active,amount_kobo)
values
('jamb','JAMB Services','JAMB information, guidance and related student services.',null,true,0),
('jamb-cbt','JAMB CBT','Computer-based practice and examination preparation.',null,true,0),
('past-questions','Past Question Bank','Practice questions organised by examination, year and subject.',null,true,0),
('waec','WAEC Services','WAEC information, preparation and result resources.',null,true,0),
('neco','NECO Services','NECO information, preparation and result resources.',null,true,0),
('nabteb','NABTEB Services','NABTEB examination information and resources.',null,true,0),
('results','WAEC / NECO Result Checking','EduReach-assisted result checking and verification support.',null,true,0),
('scratch-cards','WAEC / NECO Scratch Cards','Request examination result-checking scratch card assistance.',null,true,0),
('jamb-slip','JAMB Slip / Portal Support','Support with JAMB portal and slip-related requests.',null,true,0),
('admission-consultation','Admission Consultation','Structured guidance for admission decisions and applications.',null,true,0),
('admission-letters','Admission Letter Support','Support with admission-letter related requests.',null,true,0),
('school-finder','School Finder','Find institutions and compare admission information.',null,true,0),
('course-finder','Course Finder','Explore courses and admission requirements.',null,true,0),
('admission-requirements','Admission Requirements','Check requirements before starting an application.',null,true,0),
('post-utme','Post-UTME','Post-UTME information and preparation resources.',null,true,0),
('nelfund','NELFUND','NELFUND eligibility, guidance and application information.',null,true,0),
('nelfund-loan','NELFUND Loan Application','Support with NELFUND loan application preparation.',null,true,0),
('scholarships','Scholarships','Find scholarship opportunities and application guidance.',null,true,0),
('school-fees','School Fees','Student fee information and related support.',null,true,0),
('transcript','Transcript Request','Guidance for academic transcript requests.',null,true,0),
('certificate-verification','Certificate Verification','Support for certificate and academic document verification.',null,true,0),
('result-verification','Result Verification','Support for verifying examination or academic results.',null,true,0),
('document-request','Document Request','Structured support for student document requests.',null,true,0),
('support','Student Support','Help with EduReach services and student tasks.',null,true,0)
on conflict (service_key) do update set title=excluded.title,description=excluded.description,active=excluded.active,amount_kobo=excluded.amount_kobo,updated_at=now();

drop policy if exists service_catalog_read_public on public.service_catalog;
create policy service_catalog_read_public on public.service_catalog for select to anon,authenticated using (active=true);

create or replace function public.get_public_service_request(p_reference_code text)
returns table (id uuid,reference_code text,status text,created_at timestamptz,service_title text,service_key text)
language sql security definer set search_path='' stable
as $$ select r.id,r.reference_code,r.status,r.created_at,s.title,s.service_key from public.service_requests r join public.service_catalog s on s.id=r.service_id where upper(r.reference_code)=upper(trim(p_reference_code)) limit 1 $$;

revoke execute on function public.get_public_service_request(text) from public;
grant execute on function public.get_public_service_request(text) to anon,authenticated;

create or replace function public.start_cbt_attempt(p_exam_id uuid)
returns table (attempt_id uuid,started_at timestamptz,expires_at timestamptz,total_questions integer)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_exam public.cbt_exams%rowtype; v_count integer; v_existing public.cbt_attempts%rowtype; v_attempt public.cbt_attempts%rowtype; v_now timestamptz:=now();
begin
if v_user is null then raise exception 'Authentication required.'; end if;
select * into v_exam from public.cbt_exams where id=p_exam_id and is_active=true;
if not found then raise exception 'CBT exam not found.'; end if;
select count(*) into v_count from public.exam_questions where exam_id=p_exam_id;
if v_count=0 then raise exception 'This CBT exam has no questions yet.'; end if;
select * into v_existing from public.cbt_attempts where user_id=v_user and exam_id=p_exam_id and status='in_progress' order by started_at desc limit 1;
if found and (v_existing.expires_at is null or v_existing.expires_at>v_now) then return query select v_existing.id,v_existing.started_at,v_existing.expires_at,v_existing.total_questions; return; end if;
if found then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_existing.id and status='in_progress'; end if;
insert into public.cbt_attempts(user_id,exam_id,status,started_at,expires_at,total_questions) values(v_user,p_exam_id,'in_progress',v_now,v_now+(v_exam.duration_minutes||' minutes')::interval,v_count) returning * into v_attempt;
return query select v_attempt.id,v_attempt.started_at,v_attempt.expires_at,v_attempt.total_questions;
end; $$;
revoke execute on function public.start_cbt_attempt(uuid) from public,anon;
grant execute on function public.start_cbt_attempt(uuid) to authenticated;

create or replace function public.get_cbt_questions(p_exam_id uuid)
returns table ("position" integer,question_text text,option_a text,option_b text,option_c text,option_d text)
language sql security definer set search_path='' stable
as $$ select q.position,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d from public.exam_questions q join public.cbt_exams e on e.id=q.exam_id where q.exam_id=p_exam_id and e.is_active=true order by q.position $$;
revoke execute on function public.get_cbt_questions(uuid) from public,anon;
grant execute on function public.get_cbt_questions(uuid) to authenticated;

create or replace function public.submit_cbt_attempt(p_attempt_id uuid,p_exam_id uuid,p_answers jsonb)
returns table (attempt_id uuid,score numeric,breakdown jsonb)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_question public.exam_questions%rowtype; v_selected integer; v_correct integer; v_total integer:=0; v_score numeric; v_breakdown jsonb:='[]'::jsonb; v_now timestamptz:=now();
begin
if v_user is null then raise exception 'Authentication required.'; end if;
select * into v_attempt from public.cbt_attempts where id=p_attempt_id and exam_id=p_exam_id and user_id=v_user;
if not found then raise exception 'CBT attempt not found.'; end if;
if v_attempt.status<>'in_progress' then raise exception 'This CBT attempt has already been submitted.'; end if;
if v_attempt.expires_at is not null and v_attempt.expires_at<v_now then update public.cbt_attempts set status='expired',updated_at=v_now where id=v_attempt.id; raise exception 'This CBT attempt has expired.'; end if;
for v_question in select * from public.exam_questions where exam_id=p_exam_id order by position loop
v_total:=v_total+1; v_selected:=null;
if p_answers ? v_question.position::text then v_selected:=(p_answers->>v_question.position::text)::integer; if v_selected<0 or v_selected>3 then raise exception 'Invalid answer for question %.',v_question.position; end if; end if;
v_correct:=ascii(v_question.correct_option)-ascii('A');
v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object('question',v_question.position,'selected',v_selected,'correct',v_correct,'explanation',v_question.explanation));
insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct) values(v_attempt.id,v_question.id,case when v_selected is null then null else chr(ascii('A')+v_selected) end,case when v_selected is null then false else v_selected=v_correct end)
on conflict (attempt_id,question_id) do update set selected_option=excluded.selected_option,is_correct=excluded.is_correct,answered_at=now();
end loop;
select count(*) into v_correct from public.cbt_answers where attempt_id=v_attempt.id and is_correct=true;
if v_total=0 then raise exception 'This CBT exam has no questions yet.'; end if;
v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
update public.cbt_attempts set status='submitted',submitted_at=v_now,score=v_score,correct_answers=v_correct,total_questions=v_total,updated_at=v_now where id=v_attempt.id and status='in_progress';
return query select v_attempt.id,v_score,v_breakdown;
end; $$;
revoke execute on function public.submit_cbt_attempt(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_cbt_attempt(uuid,uuid,jsonb) to authenticated;
