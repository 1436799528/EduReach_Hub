-- PROPOSAL ONLY: not a migration, not deployed. Install only after reviewing
-- Supabase Auth schema ownership, retention, deletion workflows and rollback.
-- This prevents a raw Auth deletion from silently cascading an active attempt;
-- it is not a complete account-deletion or data-retention solution.
-- Requires a function owner that can see all cbt_attempts despite RLS.
create function public.cbt_block_auth_delete_with_active_attempt()
returns trigger
language plpgsql security definer set search_path = ''
as $guard$
begin
  perform 1 from public.cbt_attempts a
    where a.user_id = old.id and a.status = 'in_progress'
    limit 1 for update;
  if found then
    raise exception 'Account deletion blocked: active CBT attempt requires review.';
  end if;
  return old;
end
$guard$;
revoke all on function public.cbt_block_auth_delete_with_active_attempt() from public, anon, authenticated, service_role;
create trigger cbt_block_auth_delete_with_active_attempt
before delete on auth.users
for each row execute function public.cbt_block_auth_delete_with_active_attempt();
