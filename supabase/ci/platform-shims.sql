-- TEST-1 — the Supabase platform surface our migrations reference.
--
-- This file is applied ONLY to a throwaway PostgreSQL engine: the in-process
-- replay in `tests/migrations.test.ts` (which runs inside `npm test`, and
-- therefore in CI) and, if anyone wires one up later, a scratch container. It
-- must never be applied to a Supabase project: there, auth and storage are the
-- real thing.
--
-- It replaces exactly what `supabase/migrations/` touches and nothing more:
--
--   roles       anon, authenticated, service_role (policy targets and grants)
--   auth.users  id, email, raw_user_meta_data (foreign keys, the signup trigger)
--   auth.uid()  the request-scoped user, as Supabase defines it
--   auth.role(), auth.jwt()   referenced by function bodies
--   storage.buckets / storage.objects  (bucket inserts, storage policies)
--
-- It does NOT reproduce Supabase's RLS enforcement, its storage service or its
-- auth service. The replay proves our migrations are valid SQL that applies in
-- order to a real PostgreSQL; it does not prove a Supabase project accepts them.

-- The permissive bootstrap, reproduced on purpose (BASE-1b) ------------------
--
-- A Supabase project grants the API roles broad access to the public schema by
-- default (`alter default privileges ... grant all on tables to anon,
-- authenticated, service_role`). Reproducing that here is what makes the replay
-- measure *exposure* instead of the absence of grants: a table created by a
-- migration starts reachable by anon/authenticated, and only our own SQL can
-- restrict it. Without this, a server-only table that simply forgot to revoke
-- would look safe in the replay and be world-readable in production.
-- See docs/features/TEST-1.md.

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin', role_name);
    end if;
  end loop;
end
$roles$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $body$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$body$;

create or replace function auth.role()
returns text
language sql
stable
as $body$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$body$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $body$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$body$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner_id text,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supabase grants these schemas to the client roles; the migrations create
-- policies `to anon, authenticated`, which needs the roles to exist and be able
-- to reach the tables.
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant select, insert, update, delete on storage.buckets, storage.objects to anon, authenticated, service_role;

-- The permissive bootstrap from the header comment. It must run after the roles
-- exist and before the migrations create their tables: `alter default
-- privileges` only affects objects created later.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
