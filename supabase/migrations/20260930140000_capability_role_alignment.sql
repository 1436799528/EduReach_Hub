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
--   1. normalises stored roles to the four application roles;
--   2. replaces any role check constraint on profiles with the canonical one;
--   3. rewrites the staff predicate and the notification staff-insert policy so
--      the retired half-roles no longer grant staff data access.
--
-- Before applying to a live project, review the affected accounts:
--   select id, role, full_name from public.profiles order by role;
-- Rows holding `senate_admin` / `campus_agent` become `student` (least
-- privilege). Re-assign them deliberately through
-- `POST /api/admin/users/:userId/role` afterwards if they should keep staff work.
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

  -- The half-roles are retired: no application capability, no staff RLS.
  update public.profiles set role = 'student' where role in ('senate_admin', 'campus_agent');
  get diagnostics v_retired = row_count;

  raise notice 'ROLE-1: % legacy staff row(s) -> super_admin; % retired half-role row(s) -> student. Review staff assignments before the next staff onboarding.', v_legacy_staff, v_retired;
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
    alter table public.profiles
      add constraint profiles_role_vocabulary_check
      check (role in ('student', 'content_editor', 'service_admin', 'super_admin'));
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
