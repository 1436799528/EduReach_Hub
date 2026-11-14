-- Server-only visibility boundary for CBT question banks.
-- The current API already requires this table to fail closed for guest access.
-- Existing active banks are released as public; inactive banks remain restricted
-- until an administrator explicitly releases them.
create table if not exists public.cbt_bank_security (
  exam_id uuid primary key references public.cbt_exams(id) on delete cascade,
  visibility text not null default 'restricted'
    check (visibility in ('public', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cbt_bank_security_visibility_idx
  on public.cbt_bank_security (visibility);

alter table public.cbt_bank_security enable row level security;

revoke all on public.cbt_bank_security from anon, authenticated;

insert into public.cbt_bank_security (exam_id, visibility)
select id, 'public'
from public.cbt_exams
where is_active = true
on conflict (exam_id) do update
set visibility = excluded.visibility,
    updated_at = now();

comment on table public.cbt_bank_security is
  'Server-only release boundary for CBT question banks. Public rows may be served by the server catalogue/guest reader; restricted rows must remain hidden.';
