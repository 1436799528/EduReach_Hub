-- BASE-1 (second half) — restore the signup trigger.
--
-- For an existing project this migration is a no-op: the guard only fires when
-- nothing on auth.users executes public.handle_new_user().
--
-- Why it is needed for a fresh project:
--   * 20260919_auth_cbt_consistency_hardening.sql creates the trigger
--     `on_auth_user_created` (after insert on auth.users -> public.handle_new_user());
--   * 20260919_remove_redundant_auth_trigger.sql then drops that trigger AND
--     public.handle_new_user(), noting that "the canonical EduReach auth
--     triggers are on_auth_user_created_edureach and on_auth_user_created_wallet";
--   * 20260920_auth_and_profile_completion.sql recreates public.handle_new_user()
--     but nothing recreates the trigger, and no migration mentions those two
--     canonical names again.
--
-- So on an empty database every signup would produce an auth user with no
-- profile row (and no wallet). lib/auth.ts reads profiles.role to authorize, so
-- the account would be treated as unauthenticated everywhere until an operator
-- inserted the row by hand: exactly the "undocumented manual SQL" BASE-1 exists
-- to remove.
--
-- What this migration does NOT do: it does not invent a second wallet routine.
-- public.handle_new_user() already inserts the wallet row, so one trigger is
-- enough; if production holds a separate `on_auth_user_created_wallet` routine
-- whose body was never committed, it is recorded as unreproducible in
-- docs/features/BASE-1.md rather than guessed here.

begin;

do $signup_trigger$
declare
  v_trigger_exists boolean := false;
begin
  if to_regclass('auth.users') is null then
    raise notice 'BASE-1: auth.users is not present; skipping the signup trigger repair.';
    return;
  end if;

  if to_regprocedure('public.handle_new_user()') is null then
    raise notice 'BASE-1: public.handle_new_user() is missing; the signup trigger cannot be created.';
    return;
  end if;

  -- "Is any trigger on auth.users already executing handle_new_user()?" —
  -- name-agnostic, so a project that installed the same behaviour under a
  -- different name is recognised as already covered.
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and pn.nspname = 'public'
      and p.proname = 'handle_new_user'
      and not t.tgisinternal
  ) into v_trigger_exists;

  if v_trigger_exists then
    raise notice 'BASE-1: a signup trigger for public.handle_new_user() already exists; left untouched.';
    return;
  end if;

  create trigger on_auth_user_created_edureach
    after insert on auth.users
    for each row execute function public.handle_new_user();

  raise notice 'BASE-1: created the signup trigger on_auth_user_created_edureach -> public.handle_new_user().';
end
$signup_trigger$;

commit;
