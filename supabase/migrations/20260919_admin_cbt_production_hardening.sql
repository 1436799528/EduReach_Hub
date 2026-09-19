begin;

-- CBT/admin production hardening.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;

-- The server uses service_role after requireAdmin() authorization.
revoke all on function public.admin_audit_log(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
create or replace function public.admin_audit_log(
  p_admin_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_admin_user_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_audit_log(uuid,text,text,uuid,jsonb) to service_role;

-- Enforce one answer row per question/attempt and protect the answer key.
revoke all on table public.exam_questions from anon, authenticated;
revoke insert, update, delete on table public.cbt_attempts from authenticated;
revoke insert, update, delete on table public.cbt_answers from authenticated;

commit;
