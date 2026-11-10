-- Run before the v2 lifecycle rollback, only after disabling traffic and
-- independently approving rollback. Never run against a hosted DB by default.
begin;
revoke execute on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) from authenticated;
do $check$
begin
  if exists (select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.roleid
    where r.rolname='cbt_v2_answer_gateway') then
    raise exception 'Rollback refused: answer gateway role has members.';
  end if;
end
$check$;
drop function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid);
revoke execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) from cbt_v2_answer_gateway;
revoke execute on function auth.uid() from cbt_v2_answer_gateway;
revoke usage on schema public, auth from cbt_v2_answer_gateway;
drop role cbt_v2_answer_gateway;
commit;
