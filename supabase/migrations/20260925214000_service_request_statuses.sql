-- Keep student-facing request statuses expressive without changing the single
-- service_requests history record or the WhatsApp continuation channel.
begin;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.service_requests drop constraint %I', constraint_row.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_requests_status_check'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      add constraint service_requests_status_check
      check (status in ('submitted', 'reviewing', 'processing', 'awaiting_information', 'completed', 'closed', 'rejected', 'cancelled'));
  end if;
end $$;

commit;
