-- LOCAL REVIEW REQUIRED. Answer-only gateway; no v2 creation, finalization,
-- page-writer rollout or hosted grant is authorized by this migration.
-- PostgREST must verify the caller's JWT and supply its auth.uid().
do $role$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname='cbt_v2_answer_gateway') then
    raise exception 'CBT answer gateway role already exists; review role ownership and membership';
  end if;
  create role cbt_v2_answer_gateway nologin noinherit;
end
$role$;

grant usage on schema public, auth to cbt_v2_answer_gateway;
grant execute on function auth.uid() to cbt_v2_answer_gateway;
grant execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) to cbt_v2_answer_gateway;

-- No caller-supplied user ID. The existing internal function locks and checks
-- the owner, stored protocol, state, revision, operation key and paper.
create function public.cbt_v2_answer_gateway(
  p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,p_operation_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $gateway$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  return public.cbt_candidate_answer(p_attempt,p_question,p_selected,p_expected_revision,p_operation_key,v_user);
end
$gateway$;
alter function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) owner to cbt_v2_answer_gateway;
revoke all on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid) to authenticated;
