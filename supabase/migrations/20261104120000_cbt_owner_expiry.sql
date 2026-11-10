-- Additive compatibility step only: it does not enable the candidate answer
-- protocol, revoke a legacy writer, alter deadlines or modify existing rows.
-- This owner-scoped operation replaces the server's privileged direct status
-- update after a migration-first rollout. Legacy clients remain compatible.
-- It must be tested in disposable staging and reviewed before any deployment.

create or replace function public.cbt_expire_owned_attempt(p_attempt_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
  v_now timestamptz;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_attempt from public.cbt_attempts
    where id=p_attempt_id and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;

  -- Obtain actual time after acquiring the lock. Grace is for delivery of a
  -- submission only; this function neither extends answering time nor accepts
  -- answers. Existing non-active attempts remain unchanged.
  v_now := clock_timestamp();
  if v_attempt.status = 'in_progress' and v_attempt.expires_at is not null
     and v_attempt.expires_at + public.cbt_submit_grace() <= v_now then
    update public.cbt_attempts set status='expired',updated_at=v_now
      where id=v_attempt.id and status='in_progress';
    return 'expired';
  end if;
  return v_attempt.status;
end;
$fn$;
revoke all on function public.cbt_expire_owned_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cbt_expire_owned_attempt(uuid) to authenticated;
