-- ROLE-1 — capability-based authorization: make the database vocabulary match
-- the application's (docs/features/ROLE-1.md).
--
-- The application resolves capabilities from `profiles.role` through
-- src/lib/capabilities.ts. Before this migration the stored vocabulary was
-- wider than anything the server enforced: `admin`, `moderator`, `super_admin`,
-- plus the retired half-roles `senate_admin` and `campus_agent`, which passed
-- staff RLS predicates while never passing the admin gate.
--
-- What this migration does, in order:
--   1. normalises the retired *staff* aliases (`admin`, `moderator`) to
--      `super_admin`, preserving their access exactly;
--   2. leaves rows holding `senate_admin` / `campus_agent` untouched, and
--      reports them as a notice so the operator can re-assign deliberately;
--   3. replaces any role check constraint on profiles with the application
--      vocabulary (the two retired values stay legal so no row is silently
--      rewritten or rejected);
--   4. rewrites the staff predicate and the notification staff-insert policy so
--      the retired half-roles no longer grant staff data access.
--
-- Before applying to a live project, review the accounts that hold a retired
-- role:  select id, role, full_name from public.profiles order by role;
-- They keep their login and their own student data; they simply stop being staff.
-- Re-assign them with `POST /api/admin/users/:userId/role` if that is wrong.
--
-- Every statement is guarded: on a database without the base tables (BASE-1) the
-- migration is a no-op that raises a notice instead of failing the run.

begin;

-- 1. Normalise the stored role vocabulary ------------------------------------
do $role_normalisation$
declare
  v_legacy_staff integer := 0;
  v_retired integer := 0;
begin
  if to_regclass('public.profiles') is null then
    raise notice 'ROLE-1: public.profiles is missing; skipping role normalisation (see BASE-1).';
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    raise notice 'ROLE-1: profiles.role is missing; skipping role normalisation.';
    return;
  end if;

  -- Existing staff keep exactly the access they have today.
  update public.profiles set role = 'super_admin' where role in ('admin', 'moderator');
  get diagnostics v_legacy_staff = row_count;

  -- The half-roles are retired from the application, but the rows are left
  -- exactly as they are: this migration must not silently demote a real person.
  -- They already cannot pass the admin gate; sections 3 and 4 remove the staff
  -- data access they still had through RLS. Re-assigning them is a human
  -- decision, taken through POST /api/admin/users/:userId/role.
  select count(*) into v_retired from public.profiles where role in ('senate_admin', 'campus_agent');
  if v_retired > 0 then
    raise warning 'ROLE-1: % account(s) still hold a retired role (senate_admin/campus_agent). They have no capability and no staff data access. Review: select id, role, full_name from public.profiles where role in (''senate_admin'', ''campus_agent'');', v_retired;
  end if;

  raise notice 'ROLE-1: % legacy staff alias row(s) normalised to super_admin; rows holding a retired role were left untouched.', v_legacy_staff;
end
$role_normalisation$;

-- 2. One vocabulary, enforced by the database --------------------------------
do $role_constraint$
declare
  v_constraint record;
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;

  -- Drop any earlier check that mentions role (the original table definition is
  -- not in the migration history, so its constraint name is unknown).
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', v_constraint.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_vocabulary_check'
  ) then
    -- The two retired values remain legal on purpose: they are the historical
    -- vocabulary, the application maps them to `student` (no capability), and
    -- rewriting someone's stored role is an operator decision, not a migration
    -- side effect. Anything else is rejected so the vocabulary cannot drift.
    alter table public.profiles
      add constraint profiles_role_vocabulary_check
      check (role in ('student', 'content_editor', 'service_admin', 'super_admin', 'senate_admin', 'campus_agent'));
  end if;
end
$role_constraint$;

-- 3. Staff predicate and staff-write policy ----------------------------------
-- `admin`/`moderator` stay in the predicate so a row written between the
-- normalisation and the constraint (or on a database where section 1 was
-- skipped) can never silently lose staff access.
do $staff_predicate$
begin
  if to_regprocedure('public.is_staff_user()') is not null then
    execute $fn$
      create or replace function public.is_staff_user()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator', 'super_admin', 'content_editor', 'service_admin')
        )
      $body$;
    $fn$;
    execute 'revoke all on function public.is_staff_user() from public, anon';
    execute 'grant execute on function public.is_staff_user() to authenticated';
    raise notice 'ROLE-1: is_staff_user() now recognises the four application roles.';
  else
    raise notice 'ROLE-1: is_staff_user() is not present in this project; nothing to rewrite.';
  end if;
end
$staff_predicate$;

do $notification_policy$
begin
  if to_regclass('public.student_notifications') is null then
    return;
  end if;

  drop policy if exists student_notifications_staff_insert on public.student_notifications;
  create policy student_notifications_staff_insert on public.student_notifications
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'super_admin', 'content_editor', 'service_admin')
    )
  );
  raise notice 'ROLE-1: notification staff-insert policy narrowed to the staff vocabulary.';
end
$notification_policy$;

commit;
