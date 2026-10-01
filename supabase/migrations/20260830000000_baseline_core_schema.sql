-- BASE-1 — baseline core schema.
--
-- Before this migration the repository could not be replayed onto an empty
-- database. The history (from 20260831 onwards) creates indexes, policies,
-- triggers and grants on objects that no migration ever creates:
--
--   profiles, service_catalog, service_requests, campus_posts,
--   campus_post_comments, campus_post_likes, past_questions, resources,
--   courses, student_wallets, edureach_notifications
--   public.is_staff(uuid), public.handle_new_student_profile(),
--   public.claim_service_voucher(uuid, text)
--
-- Those objects live in production but were created outside the repository, so
-- `20260831_add_production_query_indexes.sql` fails at its first statement on a
-- fresh project. This migration creates them, and only them: schema, no rows.
--
-- Rules this migration follows:
--   * create-if-absent only — never drop, rename, delete or rewrite;
--   * functions are guarded on to_regprocedure(), so a definition that already
--     exists in a project (including bodies this repository has never seen) is
--     never replaced;
--   * no data of any kind, and no grants beyond the staff predicate;
--   * on an existing project the effect is limited to row-level security (see
--     section 3), which is reported with a notice when it changes anything.
--
-- It is timestamped to sort before every other migration so a fresh project
-- meets these objects first. On an existing project the ordering is irrelevant
-- because every statement is idempotent.
--
-- See docs/features/BASE-1.md and docs/architecture/02-DATA-MODEL.md.

begin;

-- 1. Core tables -------------------------------------------------------------
--
-- Column sets are reconstructed from the repository, not invented:
--   * columns referenced by migrations that run before the one that would have
--     added them (insert lists, index definitions, column grants);
--   * columns the application selects or writes that no migration adds.
-- Columns that a later migration adds with `add column if not exists` are
-- deliberately left out here so that migration stays the single source of
-- truth for them (for example profiles.account_type's check constraint, added
-- by 20260920_auth_and_profile_completion.sql).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  school text not null default '',
  faculty text not null default '',
  department text not null default '',
  level text not null default '',
  session text not null default '',
  matric_number text,
  phone text,
  jamb_reg_no text,
  target_exam text default 'JAMB (UTME)',
  programme_id uuid,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  title text not null,
  description text,
  category text,
  route text,
  sort_order integer,
  active boolean not null default true,
  application_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.service_catalog(id),
  status text not null default 'submitted',
  form_data jsonb not null default '{}'::jsonb,
  admin_note text,
  reference_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- handle_new_user() inserts a wallet row for every new account.
create table if not exists public.student_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric not null default 0,
  currency text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy Campus Feed tables: the repository's policies and indexes still
-- reference them, the application no longer reads them. Only referenced columns
-- are reconstructed.
create table if not exists public.campus_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade,
  institution_id uuid,
  moderation_status text not null default 'PENDING_REVIEW',
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campus_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.campus_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.campus_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- Past-question uploads are course-scoped; the programme filter in
-- 20260903_scope_past_questions_to_student_programme.sql joins profiles to
-- courses through programme_id.
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid,
  code text,
  title text,
  level text,
  semester text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.past_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  year integer,
  created_at timestamptz not null default now()
);

-- storage.objects policies read these two tables, so the storage entitlement
-- rules depend on them existing even when the application does not query them.
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy notification table, superseded by public.student_notifications.
-- Referenced only by its staff-insert policy. Its full production column set is
-- not recorded anywhere in the repository; the columns below are the minimum the
-- policy and the name imply. Recorded as inferred in docs/features/BASE-1.md.
create table if not exists public.edureach_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Staff predicate ---------------------------------------------------------
--
-- Eight policies in four migrations call public.is_staff(auth.uid()). It was
-- created outside the repository. The role list matches ROLE-1's is_staff_user()
-- exactly (including admin/moderator, which stay valid during the transition),
-- and excludes the retired senate_admin/campus_agent. The guard means an
-- existing project keeps whatever definition it has.

do $is_staff$
begin
  if to_regprocedure('public.is_staff(uuid)') is null then
    execute $fn$
      create function public.is_staff(p_user_id uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.profiles p
          where p.id = p_user_id
            and p.role in ('admin', 'moderator', 'super_admin', 'content_editor', 'service_admin')
        )
      $body$;
    $fn$;
    execute 'revoke all on function public.is_staff(uuid) from public, anon';
    execute 'grant execute on function public.is_staff(uuid) to authenticated';
    raise notice 'BASE-1: created public.is_staff(uuid) (staff predicate used by pre-baseline policies).';
  else
    raise notice 'BASE-1: public.is_staff(uuid) already exists; left untouched.';
  end if;
end
$is_staff$;

-- ROLE-1's is_staff_user() is created later (20260930140000), but
-- 20260919_production_hardening.sql already revokes and grants on it, so the
-- signature must exist by then. It delegates to the same predicate, and ROLE-1
-- replaces it with the canonical definition.
do $is_staff_user$
begin
  if to_regprocedure('public.is_staff_user()') is null then
    execute $fn$
      create function public.is_staff_user()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select public.is_staff(auth.uid())
      $body$;
    $fn$;
    execute 'revoke all on function public.is_staff_user() from public, anon';
    execute 'grant execute on function public.is_staff_user() to authenticated';
    raise notice 'BASE-1: created public.is_staff_user() (replaced by ROLE-1 with the canonical definition).';
  else
    raise notice 'BASE-1: public.is_staff_user() already exists; left untouched.';
  end if;
end
$is_staff_user$;

-- 3. Row-level security ------------------------------------------------------
--
-- The history defines policies for these tables but never enables RLS on them,
-- so on a fresh project those policies would never run. Existing projects are
-- unaffected where RLS is already enabled; where it is not, the change is
-- reported rather than silent. Tables the repository defines no policy for
-- (courses, resources, campus_post_comments, campus_post_likes,
-- student_wallets, edureach_notifications) are deliberately left alone — see
-- section 5.

do $rls$
declare
  target text;
  targets constant text[] := array[
    'profiles', 'service_catalog', 'service_requests', 'campus_posts', 'past_questions'
  ];
begin
  foreach target in array targets loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = target and c.relrowsecurity
    ) then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', target);
    raise notice 'BASE-1: enabled row-level security on public.% (it was off; the policies in this repository require it).', target;
  end loop;
end
$rls$;

-- 4. Legacy routines ---------------------------------------------------------
--
-- These two are referenced by historical revoke/grant statements, which fail on
-- an empty database if the routines do not exist. Their real bodies are not in
-- the repository, so the baseline does NOT guess them: it creates fail-closed
-- stubs that raise if called. Nothing in the application or the current
-- migration history calls either one (20260924 drops claim_service_voucher).

do $legacy_routines$
begin
  if to_regprocedure('public.handle_new_student_profile()') is null then
    execute $fn$
      create function public.handle_new_student_profile()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        raise exception 'public.handle_new_student_profile() is a BASE-1 stub: its production body is not in the repository. Use public.handle_new_user() (created by 20260920_auth_and_profile_completion.sql).';
      end
      $body$;
    $fn$;
    raise notice 'BASE-1: created public.handle_new_student_profile() as a fail-closed stub.';
  end if;

  if to_regprocedure('public.claim_service_voucher(uuid, text)') is null then
    execute $fn$
      create function public.claim_service_voucher(p_user_id uuid, p_voucher text)
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        raise exception 'public.claim_service_voucher(uuid, text) is a BASE-1 stub: the legacy scratch-card voucher routine was retired by 20260924_retire_legacy_scratch_service.sql.';
      end
      $body$;
    $fn$;
    raise notice 'BASE-1: created public.claim_service_voucher(uuid, text) as a fail-closed stub.';
  end if;
end
$legacy_routines$;

-- 5. Drift notices -----------------------------------------------------------
--
-- Two classes of gap that this migration intentionally does not close are
-- reported here so an operator sees them during the deploy instead of
-- discovering them later.

do $drift$
declare
  unpolicied constant text[] := array[
    'courses', 'resources', 'campus_post_comments', 'campus_post_likes',
    'student_wallets', 'edureach_notifications'
  ];
  target text;
  unmanaged text[] := array[]::text[];
begin
  foreach target in array unpolicied loop
    if to_regclass('public.' || target) is not null then
      unmanaged := unmanaged || target;
    end if;
  end loop;
  if array_length(unmanaged, 1) > 0 then
    raise notice 'BASE-1: no policy is defined in this repository for: %. Their row-level security state is therefore not reproducible from the repository; review before relying on them. See docs/features/BASE-1.md.', array_to_string(unmanaged, ', ');
  end if;

  if to_regclass('public.admin_content_versions') is null then
    raise notice 'BASE-1: public.admin_content_versions is absent. The history tolerates that (20260925 guards it) and no application code reads it, so the baseline does not invent its shape.';
  end if;
end
$drift$;

-- 6. Storage buckets ---------------------------------------------------------
--
-- Two buckets are referenced by storage.objects policies but never created by a
-- migration. Buckets are configuration; the repo already creates one this way
-- in 20260926200000_admin_control_centre_backend.sql. Guarded so a database
-- without the storage schema is unaffected.

do $buckets$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'BASE-1: storage schema not present; skipping bucket creation.';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values
    ('resource-files', 'resource-files', false),
    ('campus-uploads', 'campus-uploads', false)
  on conflict (id) do nothing;

  raise notice 'BASE-1: ensured the resource-files and campus-uploads buckets exist.';
end
$buckets$;

commit;
