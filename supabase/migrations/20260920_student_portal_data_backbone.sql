-- EduReach Student Portal Data Backbone
-- Persists dashboard saved items, notifications, CGPA snapshots, wallet history,
-- and security events with student-owned RLS policies.

begin;

create table if not exists public.student_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('school', 'course', 'service', 'scholarship', 'custom')),
  item_key text not null,
  title text not null,
  subtitle text,
  detail text,
  location text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, item_key)
);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  notification_type text not null default 'system',
  href text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.student_cgpa_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  term_label text not null default 'Current Semester',
  gpa numeric(4,2) not null default 0 check (gpa >= 0 and gpa <= 5),
  total_units int not null default 0 check (total_units >= 0),
  classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_cgpa_courses (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.student_cgpa_terms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text not null,
  units int not null check (units > 0 and units <= 10),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  grade_points int not null check (grade_points >= 0 and grade_points <= 5),
  created_at timestamptz not null default now()
);

create table if not exists public.student_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  transaction_type text not null check (transaction_type in ('credit', 'debit', 'refund', 'adjustment')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  reference text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.student_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_student_portal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_saved_items_set_updated_at on public.student_saved_items;
create trigger student_saved_items_set_updated_at
before update on public.student_saved_items
for each row execute function public.set_student_portal_updated_at();

drop trigger if exists student_cgpa_terms_set_updated_at on public.student_cgpa_terms;
create trigger student_cgpa_terms_set_updated_at
before update on public.student_cgpa_terms
for each row execute function public.set_student_portal_updated_at();

create or replace function public.credit_wallet_payment(
  p_user_id uuid,
  p_amount numeric,
  p_provider_reference text,
  p_metadata jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  -- Idempotency: if this provider reference was already recorded, return the
  -- current wallet balance without crediting the wallet a second time.
  if p_provider_reference is not null and exists (
    select 1 from public.student_wallet_transactions
    where reference = p_provider_reference
      and transaction_type = 'credit'
      and status = 'completed'
  ) then
    select coalesce(balance, 0) into v_balance
    from public.student_wallets
    where user_id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  insert into public.student_wallets (user_id, balance, currency)
  values (p_user_id, p_amount, 'NGN')
  on conflict (user_id) do update
    set balance = coalesce(public.student_wallets.balance, 0) + excluded.balance
  returning balance into v_balance;

  insert into public.student_wallet_transactions (
    user_id, amount, currency, transaction_type, status, reference, description, metadata
  ) values (
    p_user_id, p_amount, 'NGN', 'credit', 'completed', p_provider_reference,
    'Paystack wallet top-up', coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict do nothing;

  return coalesce(v_balance, 0);
end;
$$;

revoke all on function public.credit_wallet_payment(uuid, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.credit_wallet_payment(uuid, numeric, text, jsonb) to service_role;

create index if not exists student_saved_items_user_created_idx
  on public.student_saved_items (user_id, created_at desc);
create index if not exists student_notifications_user_read_created_idx
  on public.student_notifications (user_id, read_at, created_at desc);
create index if not exists student_cgpa_terms_user_created_idx
  on public.student_cgpa_terms (user_id, created_at desc);
create index if not exists student_cgpa_courses_term_idx
  on public.student_cgpa_courses (term_id, created_at asc);
create index if not exists student_wallet_transactions_user_created_idx
  on public.student_wallet_transactions (user_id, created_at desc);
create unique index if not exists student_wallet_transactions_reference_uidx
  on public.student_wallet_transactions (reference)
  where reference is not null;
create index if not exists student_security_events_user_created_idx
  on public.student_security_events (user_id, created_at desc);

alter table public.student_saved_items enable row level security;
alter table public.student_notifications enable row level security;
alter table public.student_cgpa_terms enable row level security;
alter table public.student_cgpa_courses enable row level security;
alter table public.student_wallet_transactions enable row level security;
alter table public.student_security_events enable row level security;

-- Saved shortlist policies
drop policy if exists student_saved_items_owner_select on public.student_saved_items;
drop policy if exists student_saved_items_owner_insert on public.student_saved_items;
drop policy if exists student_saved_items_owner_update on public.student_saved_items;
drop policy if exists student_saved_items_owner_delete on public.student_saved_items;
create policy student_saved_items_owner_select on public.student_saved_items
for select to authenticated using (user_id = auth.uid());
create policy student_saved_items_owner_insert on public.student_saved_items
for insert to authenticated with check (user_id = auth.uid());
create policy student_saved_items_owner_update on public.student_saved_items
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_saved_items_owner_delete on public.student_saved_items
for delete to authenticated using (user_id = auth.uid());

-- Notifications: students own read/update state and may create personal in-app alerts.
drop policy if exists student_notifications_owner_select on public.student_notifications;
drop policy if exists student_notifications_owner_insert on public.student_notifications;
drop policy if exists student_notifications_owner_update on public.student_notifications;
drop policy if exists student_notifications_owner_delete on public.student_notifications;
drop policy if exists student_notifications_staff_insert on public.student_notifications;
create policy student_notifications_owner_select on public.student_notifications
for select to authenticated using (user_id = auth.uid());
create policy student_notifications_owner_insert on public.student_notifications
for insert to authenticated with check (user_id = auth.uid());
create policy student_notifications_owner_update on public.student_notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_notifications_owner_delete on public.student_notifications
for delete to authenticated using (user_id = auth.uid());
create policy student_notifications_staff_insert on public.student_notifications
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','super_admin','moderator','senate_admin','campus_agent')
  )
);

-- CGPA policies
drop policy if exists student_cgpa_terms_owner_select on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_insert on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_update on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_delete on public.student_cgpa_terms;
create policy student_cgpa_terms_owner_select on public.student_cgpa_terms
for select to authenticated using (user_id = auth.uid());
create policy student_cgpa_terms_owner_insert on public.student_cgpa_terms
for insert to authenticated with check (user_id = auth.uid());
create policy student_cgpa_terms_owner_update on public.student_cgpa_terms
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_cgpa_terms_owner_delete on public.student_cgpa_terms
for delete to authenticated using (user_id = auth.uid());

drop policy if exists student_cgpa_courses_owner_select on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_insert on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_update on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_delete on public.student_cgpa_courses;
create policy student_cgpa_courses_owner_select on public.student_cgpa_courses
for select to authenticated using (user_id = auth.uid());
create policy student_cgpa_courses_owner_insert on public.student_cgpa_courses
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.student_cgpa_terms t
    where t.id = term_id and t.user_id = auth.uid()
  )
);
create policy student_cgpa_courses_owner_update on public.student_cgpa_courses
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_cgpa_courses_owner_delete on public.student_cgpa_courses
for delete to authenticated using (user_id = auth.uid());

-- Wallet history is readable by students but credited by the server-side
-- credit_wallet_payment() RPC after payment verification.
drop policy if exists student_wallet_transactions_owner_select on public.student_wallet_transactions;
drop policy if exists student_wallet_transactions_owner_insert on public.student_wallet_transactions;
create policy student_wallet_transactions_owner_select on public.student_wallet_transactions
for select to authenticated using (user_id = auth.uid());

-- Security events are append-only per student.
drop policy if exists student_security_events_owner_select on public.student_security_events;
drop policy if exists student_security_events_owner_insert on public.student_security_events;
create policy student_security_events_owner_select on public.student_security_events
for select to authenticated using (user_id = auth.uid());
create policy student_security_events_owner_insert on public.student_security_events
for insert to authenticated with check (user_id = auth.uid());

grant select, insert, update, delete on table public.student_saved_items to authenticated;
grant select, insert, update, delete on table public.student_notifications to authenticated;
grant select, insert, update, delete on table public.student_cgpa_terms to authenticated;
grant select, insert, update, delete on table public.student_cgpa_courses to authenticated;
grant select on table public.student_wallet_transactions to authenticated;
grant select, insert on table public.student_security_events to authenticated;

commit;
