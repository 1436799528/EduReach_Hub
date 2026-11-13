-- Route service-request updates through the capability-checked server API.
-- Local preparation only: inventory direct writers, role inheritance, existing
-- timestamps, the hosted schema, and rollback procedure before any rollout.
-- This does not constrain service_role/other privileged writers, nor make
-- audit/notification side effects transactional.
begin;

drop policy if exists service_requests_update_staff on public.service_requests;
revoke update on table public.service_requests from public, anon, authenticated;

-- A table-level REVOKE does not remove separately granted column privileges.
do $$
declare
  columns_sql text;
begin
  select string_agg(format('%I', attname), ', ' order by attnum) into columns_sql
  from pg_attribute
  where attrelid = 'public.service_requests'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke update (%s) on public.service_requests from public, anon, authenticated', columns_sql);

  -- A role can inherit grants from other roles. Abort atomically rather than
  -- advertise a closed boundary if unreviewed hosted role membership reopens it.
  if exists (
    select 1 from unnest(array['anon','authenticated']) as roles(role_name)
    where has_table_privilege(role_name, 'public.service_requests', 'UPDATE')
       or exists (
         select 1 from pg_attribute a
         where a.attrelid = 'public.service_requests'::regclass and a.attnum > 0 and not a.attisdropped
           and has_column_privilege(role_name, 'public.service_requests', a.attname, 'UPDATE')
       )
  ) then
    raise exception 'service_requests UPDATE remains available through inherited grants; review role membership before retrying';
  end if;
end
$$;

-- Versions must advance even when a privileged writer omits/forges updated_at.
-- clock_timestamp() is wall-clock time, not the transaction-start timestamp;
-- the one-microsecond floor also handles same-instant and future-dated rows.
create or replace function public.advance_service_request_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.updated_at is not null and not isfinite(old.updated_at) then
    raise exception 'service request has a non-finite version; repair it before updating';
  end if;
  new.updated_at := greatest(clock_timestamp(), coalesce(old.updated_at + interval '1 microsecond', '-infinity'::timestamptz));
  return new;
end
$$;
revoke all on function public.advance_service_request_version() from public, anon, authenticated;
drop trigger if exists service_requests_advance_version on public.service_requests;
create trigger service_requests_advance_version
before update on public.service_requests
for each row execute function public.advance_service_request_version();

commit;
