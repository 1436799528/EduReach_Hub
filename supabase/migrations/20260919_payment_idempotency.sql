begin;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  reference text not null,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists payment_events_provider_event_uidx
  on public.payment_events(provider, provider_event_id)
  where provider_event_id is not null;
create unique index if not exists payment_events_provider_reference_uidx
  on public.payment_events(provider, reference);
alter table public.payment_events enable row level security;
revoke all on table public.payment_events from anon, authenticated;

commit;
