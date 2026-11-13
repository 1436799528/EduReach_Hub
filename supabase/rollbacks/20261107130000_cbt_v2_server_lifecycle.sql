-- Manual destructive rollback; never run on a hosted database without approval.
-- Disable v2 creation and drain/retain all v2 attempts before removing its
-- server lifecycle. Transactionally refuse to destroy existing v2 data.
begin;
revoke execute on function public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text) from cbt_v2_client;
lock table public.cbt_attempts in access exclusive mode;
do $check$
begin
  if exists (select 1 from public.cbt_attempts where protocol='v2') then
    raise exception 'Rollback refused: v2 attempts still exist.';
  end if;
end $check$;
drop function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid);
drop function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid);
drop function public.cbt_v2_draft_valid(jsonb,uuid[],uuid);
drop table public.cbt_v2_operations;
alter table public.cbt_attempts drop column candidate_answer_revision, drop column v2_result;
commit;
