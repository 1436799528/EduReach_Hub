-- LOCAL REVIEW REQUIRED. Controlled v2 writing sessions; no v2 rollout and no
-- finalization access. Apply only after the fence, lifecycle and answer gateway.
-- A session cannot reveal answers that exist only on a disconnected device.
-- The authoritative attempt row is the serialization lock for takeover/writes.
begin;

create table public.cbt_v2_writing_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  generation bigint not null check (generation between 1 and 9007199254740991),
  request_key uuid not null,
  status text not null check (status in ('active','revoked','expired')),
  created_at timestamptz not null default clock_timestamp(),
  last_activity_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  unique (attempt_id, generation),
  unique (attempt_id, request_key)
);
create unique index cbt_v2_one_active_writing_session
  on public.cbt_v2_writing_sessions(attempt_id) where status='active';
alter table public.cbt_v2_writing_sessions enable row level security;
revoke all on public.cbt_v2_writing_sessions from public, anon, authenticated, service_role, cbt_v2_client, cbt_v2_answer_gateway;
grant select, insert, update on public.cbt_v2_writing_sessions to cbt_v2_executor;
create policy cbt_v2_executor_writing_sessions on public.cbt_v2_writing_sessions
  to cbt_v2_executor using (true) with check (true);

-- A request key makes an uncertain session creation/takeover response safe to
-- retry. Replaying an older request never reactivates a revoked session.
create function public.cbt_v2_session_gateway(p_attempt uuid,p_request_key uuid,p_takeover boolean)
returns jsonb language plpgsql security definer set search_path='' as $session$
declare
  v_user uuid := auth.uid(); v_attempt public.cbt_attempts%rowtype;
  v_prior public.cbt_v2_writing_sessions%rowtype;
  v_active public.cbt_v2_writing_sessions%rowtype;
  v_session public.cbt_v2_writing_sessions%rowtype; v_generation bigint;
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_attempt is null or p_request_key is null or p_takeover is null then raise exception 'Invalid session request.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  v_now := clock_timestamp(); -- The row lock may have waited across the deadline.
  if v_attempt.protocol<>'v2' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'CBT attempt is not active.'; end if;
  if v_attempt.expires_at is not null and v_attempt.expires_at+public.cbt_submit_grace()<=v_now then
    update public.cbt_v2_writing_sessions set status='expired',last_activity_at=v_now
      where attempt_id=p_attempt and status='active';
    return jsonb_build_object('outcome','expired','revision',v_attempt.candidate_answer_revision,
      'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  select * into v_prior from public.cbt_v2_writing_sessions where attempt_id=p_attempt and request_key=p_request_key;
  if found then
    if v_prior.owner_id<>v_user then raise exception 'CBT attempt not found.'; end if;
    return jsonb_build_object('outcome',case when v_prior.status='active' then 'resumed' else v_prior.status end,
      'sessionId',v_prior.id,'generation',v_prior.generation,'revision',v_attempt.candidate_answer_revision,
      'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  select * into v_active from public.cbt_v2_writing_sessions where attempt_id=p_attempt and status='active';
  if found and not p_takeover then
    return jsonb_build_object('outcome','takeover_required','revision',v_attempt.candidate_answer_revision,
      'answers',v_attempt.answers_draft,'status',v_attempt.status);
  end if;
  if v_active.id is not null then
    update public.cbt_v2_writing_sessions set status='revoked',last_activity_at=v_now where id=v_active.id;
  end if;
  select coalesce(max(generation),0)+1 into v_generation from public.cbt_v2_writing_sessions where attempt_id=p_attempt;
  if v_generation>9007199254740991 then raise exception 'CBT session generation exhausted.'; end if;
  insert into public.cbt_v2_writing_sessions(attempt_id,owner_id,generation,request_key,status,created_at,last_activity_at,expires_at)
    values(p_attempt,v_user,v_generation,p_request_key,'active',v_now,v_now,
      case when v_attempt.expires_at is null then null else v_attempt.expires_at+public.cbt_submit_grace() end)
    returning * into v_session;
  return jsonb_build_object('outcome',case when v_active.id is null then 'created' else 'taken_over' end,
    'sessionId',v_session.id,'generation',v_session.generation,'revision',v_attempt.candidate_answer_revision,
    'answers',v_attempt.answers_draft,'status',v_attempt.status);
end $session$;
alter function public.cbt_v2_session_gateway(uuid,uuid,boolean) owner to cbt_v2_executor;
revoke all on function public.cbt_v2_session_gateway(uuid,uuid,boolean) from public, anon, authenticated, service_role, cbt_v2_client;
grant execute on function public.cbt_v2_session_gateway(uuid,uuid,boolean) to authenticated;

-- Close the unleased entry points, including for the restricted client role.
-- The original implementations are retained under new internal names for the
-- leased gateway and a future independently reviewed finalization boundary.
drop function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid);
alter function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) rename to cbt_candidate_answer_core;
revoke all on function public.cbt_candidate_answer_core(uuid,uuid,integer,bigint,uuid,uuid) from public, anon, authenticated, service_role, cbt_v2_client, cbt_v2_answer_gateway;
alter function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) rename to cbt_candidate_finalize_core;
revoke all on function public.cbt_candidate_finalize_core(uuid,bigint,uuid,uuid) from public, anon, authenticated, service_role, cbt_v2_client, cbt_v2_answer_gateway;

-- Keep the former internal signatures fail-closed; do not reinterpret an old
-- unleased operation as a write or a submission.
create function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)
returns jsonb language plpgsql security definer set search_path='' as $old$
begin raise exception 'CBT writing session required.'; end $old$;
alter function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) from public, anon, authenticated, service_role, cbt_v2_client;
grant execute on function public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid) to cbt_v2_client;

create function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)
returns jsonb language plpgsql security definer set search_path='' as $old$
begin raise exception 'CBT finalization unavailable pending recovery verification.'; end $old$;
alter function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) from public, anon, authenticated, service_role, cbt_v2_client;
grant execute on function public.cbt_candidate_finalize(uuid,bigint,uuid,uuid) to cbt_v2_client;

create function public.cbt_candidate_answer_leased(
  p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,p_operation_key uuid,
  p_session uuid,p_generation bigint,p_expected_user uuid
) returns jsonb language plpgsql security definer set search_path='' as $leased$
declare v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_session public.cbt_v2_writing_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user<>v_user then raise exception 'Account changed.'; end if;
  if p_session is null or p_generation is null or p_generation<1 or p_generation>9007199254740991 then raise exception 'Invalid writing session.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol<>'v2' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status<>'in_progress' then raise exception 'CBT attempt is not active.'; end if;
  select * into v_session from public.cbt_v2_writing_sessions
    where id=p_session and attempt_id=p_attempt and owner_id=v_user and generation=p_generation;
  if not found or v_session.status<>'active' or (v_session.expires_at is not null and v_session.expires_at<=clock_timestamp()) then
    raise exception 'CBT writing session is no longer active.';
  end if;
  update public.cbt_v2_writing_sessions set last_activity_at=clock_timestamp() where id=v_session.id;
  return public.cbt_candidate_answer_core(p_attempt,p_question,p_selected,p_expected_revision,p_operation_key,v_user);
end $leased$;
alter function public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid) from public, anon, authenticated, service_role, cbt_v2_client, cbt_v2_answer_gateway;
grant execute on function public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid) to cbt_v2_answer_gateway;

-- Internal only: no application or client role is granted this function. A
-- reviewed client recovery barrier and separate authorization boundary are
-- still required before any finalization route can be opened.
create function public.cbt_candidate_finalize_leased(
  p_attempt uuid,p_expected_revision bigint,p_operation_key uuid,
  p_session uuid,p_generation bigint,p_expected_user uuid
) returns jsonb language plpgsql security definer set search_path='' as $finalize$
declare v_user uuid:=auth.uid(); v_attempt public.cbt_attempts%rowtype; v_session public.cbt_v2_writing_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_expected_user is null or p_expected_user<>v_user then raise exception 'Account changed.'; end if;
  if p_session is null or p_generation is null or p_generation<1 or p_generation>9007199254740991 then raise exception 'Invalid writing session.'; end if;
  select * into v_attempt from public.cbt_attempts where id=p_attempt and user_id=v_user for update;
  if not found then raise exception 'CBT attempt not found.'; end if;
  if v_attempt.protocol<>'v2' then raise exception 'CBT protocol mismatch.'; end if;
  if v_attempt.status not in ('in_progress','submitted') then raise exception 'CBT attempt is not active.'; end if;
  select * into v_session from public.cbt_v2_writing_sessions
    where id=p_session and attempt_id=p_attempt and owner_id=v_user and generation=p_generation;
  if not found or v_session.status<>'active' or
     (v_attempt.status='in_progress' and v_session.expires_at is not null and v_session.expires_at<=clock_timestamp()) then
    raise exception 'CBT writing session is no longer active.';
  end if;
  update public.cbt_v2_writing_sessions set last_activity_at=clock_timestamp() where id=v_session.id;
  return public.cbt_candidate_finalize_core(p_attempt,p_expected_revision,p_operation_key,v_user);
end $finalize$;
alter function public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid) owner to cbt_v2_executor;
revoke all on function public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid) from public, anon, authenticated, service_role, cbt_v2_client, cbt_v2_answer_gateway;

create function public.cbt_v2_answer_gateway(
  p_attempt uuid,p_question uuid,p_selected integer,p_expected_revision bigint,p_operation_key uuid,
  p_session uuid,p_generation bigint
) returns jsonb language plpgsql security definer set search_path='' as $gateway$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  return public.cbt_candidate_answer_leased(p_attempt,p_question,p_selected,p_expected_revision,p_operation_key,p_session,p_generation,v_user);
end $gateway$;
alter function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) owner to cbt_v2_answer_gateway;
revoke all on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) from public, anon, authenticated, service_role;
grant execute on function public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint) to authenticated;
commit;
