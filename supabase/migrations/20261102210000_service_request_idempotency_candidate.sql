-- Local candidate only: this adds an opt-in RPC and does not change legacy
-- direct inserts. Review all writers, live drift, lock/index impact and rollout
-- order before applying to any hosted project.
begin;

alter table public.service_requests add column submission_key uuid;
alter table public.service_requests add column submission_fingerprint bytea;
alter table public.service_requests add constraint service_requests_submission_identity_check
  check ((submission_key is null and submission_fingerprint is null)
    or (submission_key is not null and submission_fingerprint is not null and octet_length(submission_fingerprint) = 32));
create unique index service_requests_user_submission_key_uidx
  on public.service_requests (user_id, submission_key)
  where submission_key is not null;

-- Ordinary privileged updates may change status, notes or form data, but not
-- the identity used for recovery. Exceptional maintenance needs explicit review.
create function public.protect_service_submission_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.submission_key is distinct from old.submission_key
     or new.submission_fingerprint is distinct from old.submission_fingerprint then
    raise exception 'service submission identity is immutable' using errcode = '22023';
  end if;
  return new;
end
$$;
revoke all on function public.protect_service_submission_identity() from public, anon, authenticated;
create trigger service_requests_protect_submission_identity
before update on public.service_requests
for each row execute function public.protect_service_submission_identity();

create function public.submit_service_request_idempotent(
  p_service_key text, p_form_data jsonb, p_submission_key uuid, p_expected_user_id uuid, p_recovery_only boolean
)
returns table (id uuid, reference_code text, created_at timestamptz, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_service_id uuid;
  v_existing public.service_requests%rowtype;
  v_fingerprint bytea;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- The caller supplies the account that prepared the form, never the owner.
  -- Ownership is always auth.uid(); the assertion catches token/account swaps.
  if p_expected_user_id is distinct from v_user then
    raise exception 'account changed' using errcode = '42501';
  end if;
  if p_submission_key is null then
    raise exception 'submission key required' using errcode = '22023';
  end if;
  if p_recovery_only is null then
    raise exception 'recovery mode required' using errcode = '22023';
  end if;
  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' or p_form_data ? 'reference_code' then
    raise exception 'invalid request details' using errcode = '22023';
  end if;
  if p_service_key is null or btrim(p_service_key) = '' then
    raise exception 'service unavailable' using errcode = '22023';
  end if;

  -- A server-generated fingerprint avoids retaining a second copy of form data.
  -- It is still derived from personal information and must be treated as sensitive.
  v_fingerprint := sha256(convert_to(jsonb_build_array(lower(btrim(p_service_key)), p_form_data)::text, 'UTF8'));

  -- Recover committed work before checking active status. A service can be
  -- deactivated between an accepted insert and a client's retry.
  select r.* into v_existing from public.service_requests r
    where r.user_id = v_user and r.submission_key = p_submission_key;
  if not found then
    -- A check-only call must not create a row, even if the service is active.
    -- No row is not proof that an earlier in-flight transaction cannot commit.
    if p_recovery_only then return; end if;
    select s.id into v_service_id from public.service_catalog s
      where s.service_key = lower(btrim(p_service_key)) and s.active is true;
    if not found then
      raise exception 'service unavailable' using errcode = '22023';
    end if;
    -- The unique index serializes competing inserts with the same user/key.
    -- A conflicting insertion waits for the other transaction, then the next
    -- statement reads the committed winner under normal READ COMMITTED isolation.
    insert into public.service_requests as r
      (user_id, service_id, status, form_data, submission_key, submission_fingerprint)
      values (v_user, v_service_id, 'submitted', p_form_data, p_submission_key, v_fingerprint)
      on conflict (user_id, submission_key) where submission_key is not null do nothing
      returning r.* into v_existing;
    if not found then
      select r.* into v_existing from public.service_requests r
        where r.user_id = v_user and r.submission_key = p_submission_key;
      if not found then
        raise exception 'request outcome unavailable; retry with the same key' using errcode = '40001';
      end if;
    end if;
  end if;

  -- Compare with the original, not mutable form data or catalogue metadata.
  if v_existing.submission_fingerprint is distinct from v_fingerprint then
    raise exception 'submission key already belongs to a different request' using errcode = '22023';
  end if;
  return query select v_existing.id, v_existing.reference_code, v_existing.created_at, v_existing.status;
end
$$;
revoke all on function public.submit_service_request_idempotent(text,jsonb,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.submit_service_request_idempotent(text,jsonb,uuid,uuid,boolean) to authenticated;
commit;
