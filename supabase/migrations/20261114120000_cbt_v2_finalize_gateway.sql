-- LOCAL REVIEW REQUIRED. Adds the authenticated boundary for v2 finalization.
-- The scoring/idempotency core and the writing-lease wrapper already exist; this
-- migration only exposes the leased wrapper to a signed-in candidate through a
-- security-definer gateway. It does not enable v2 rollout (the server switch is
-- still limited to the disposable local rehearsal).
--
-- Ownership: cbt_v2_executor owns the gateway and the core. Authenticated users
-- may execute the gateway but cannot execute the core or the leased wrapper.
-- Identity: the gateway passes auth.uid(); the client never supplies a user id.
-- Duplicate safety: the caller's operation key is persisted by the core.
begin;

create function public.cbt_v2_finalize_gateway(
  p_attempt uuid,
  p_expected_revision bigint,
  p_operation_key uuid,
  p_session uuid,
  p_generation bigint
) returns jsonb language plpgsql security definer set search_path = '' as $gateway$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;
  return public.cbt_candidate_finalize_leased(
    p_attempt, p_expected_revision, p_operation_key, p_session, p_generation, v_user
  );
end
$gateway$;

alter function public.cbt_v2_finalize_gateway(uuid,bigint,uuid,uuid,bigint) owner to cbt_v2_executor;
revoke all on function public.cbt_v2_finalize_gateway(uuid,bigint,uuid,uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_finalize_gateway(uuid,bigint,uuid,uuid,bigint)
  to authenticated;

comment on function public.cbt_v2_finalize_gateway(uuid,bigint,uuid,uuid,bigint) is
  'Authenticated boundary for leased v2 CBT finalization. Owner-scoped; requires an active writing session and the current answer revision.';

commit;
