-- Allow students to remove their own CBT results, including mock results,
-- when they choose not to retain them. Ownership is enforced inside the
-- security-definer function; deleting the attempt cascades to its answers.
create or replace function public.delete_cbt_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_attempt public.cbt_attempts%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where id = p_attempt_id and user_id = v_user
  for update;

  if not found then
    raise exception 'CBT attempt not found.';
  end if;

  delete from public.cbt_attempts where id = v_attempt.id;
  return true;
end;
$fn$;

revoke execute on function public.delete_cbt_attempt(uuid) from public, anon;
grant execute on function public.delete_cbt_attempt(uuid) to authenticated;
