-- Manual, traffic-quiesced rollback. Refuse to erase any session history.
-- Run before the answer-gateway rollback, only after independent authorization.
begin;
lock table public.cbt_attempts, public.cbt_v2_writing_sessions in access exclusive mode;
do $check$
begin
  if exists (select 1 from public.cbt_v2_writing_sessions) then
    raise exception 'Rollback refused: writing session history still exists.';
  end if;
  if exists (select 1 from public.cbt_attempts where protocol='v2') then
    raise exception 'Rollback refused: v2 attempts still exist.';
  end if;
end $check$;
drop function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint);
drop function public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid);
drop function public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid);
drop function public.cbt_v2_session_gateway(uuid,uuid,boolean);
drop function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid);
drop function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid);
alter function public.cbt_candidate_answer_core(uuid,uuid,integer,bigint,uuid,uuid) rename to cbt_candidate_answer;
alter function public.cbt_candidate_finalize_core(uuid,bigint,uuid,uuid) rename to cbt_candidate_finalize;
grant execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) to cbt_v2_client, cbt_v2_answer_gateway;
grant execute on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) to cbt_v2_client;
create function public.cbt_v2_answer_gateway(
  p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,p_operation_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $gateway$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  return public.cbt_candidate_answer(p_attempt,p_question,p_selected,p_expected_revision,p_operation_key,v_user);
end $gateway$;
alter function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) owner to cbt_v2_answer_gateway;
revoke all on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) to authenticated;
drop table public.cbt_v2_writing_sessions;
commit;
