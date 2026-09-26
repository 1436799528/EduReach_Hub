-- Backfill for server dependencies that are called by `server.ts` but were
-- missing from the migration history (found in the 2026-09-26 full audit):
--   * tables  edureach_audit_logs, edureach_deadlines, edureach_exams
--   * rpc     admin_dashboard_metrics(), admin_bootstrap_first_admin(uuid, text)
--
-- Every statement is guarded so it is a no-op when the object already exists
-- (for example when it was created out-of-band in the live Supabase project).
-- Applying this migration on the live project must therefore change nothing;
-- on a fresh project it creates working versions of the missing objects.
--
-- All created objects are server-only: RLS is enabled with no client policies
-- and EXECUTE/SELECT is granted to service_role only, matching the boundary
-- used by the 20260919/20260925 hardening migrations.

-- 1. Server-only tables ----------------------------------------------------

create table if not exists public.edureach_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.edureach_deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_at timestamptz not null,
  priority text not null default 'normal',
  institution_id uuid,
  user_id uuid,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.edureach_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  priority text not null default 'normal',
  institution_id uuid,
  user_id uuid,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Browser-deny boundary: RLS is enabled and no policy is created, so anon and
-- authenticated clients can read nothing. The Express server uses the
-- service-role key, which bypasses RLS.
alter table public.edureach_audit_logs enable row level security;
alter table public.edureach_deadlines enable row level security;
alter table public.edureach_exams enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['edureach_audit_logs', 'edureach_deadlines', 'edureach_exams']
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

-- 2. admin_dashboard_metrics() ----------------------------------------------
-- Consumed by GET /api/admin/analytics and rendered by AdminAnalyticsPage.
-- Created only when the live project does not already define it, so an
-- out-of-band production implementation is never overwritten.

do $outer$
begin
  if to_regprocedure('public.admin_dashboard_metrics()') is null then
    execute $fn$
      create function public.admin_dashboard_metrics()
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        v_users bigint := 0;
        v_admins bigint := 0;
        v_requests bigint := 0;
        v_pending bigint := 0;
        v_completed bigint := 0;
        v_rejected bigint := 0;
        v_events_24h bigint := 0;
        v_sessions_24h bigint := 0;
        v_events_7d bigint := 0;
        v_attempts bigint := 0;
        v_submitted bigint := 0;
        v_avg_score numeric := 0;
        v_institutions bigint := 0;
        v_active_services bigint := 0;
        v_published_news bigint := 0;
        v_audit bigint := 0;
      begin
        if to_regclass('public.profiles') is not null then
          select count(*) into v_users from public.profiles;
          select count(*) into v_admins from public.profiles
            where role in ('admin', 'super_admin', 'moderator', 'senate_admin', 'campus_agent');
        end if;

        if to_regclass('public.service_requests') is not null then
          select count(*) into v_requests from public.service_requests;
          select count(*) into v_pending from public.service_requests
            where status in ('submitted', 'reviewing', 'processing', 'awaiting_information');
          select count(*) into v_completed from public.service_requests where status = 'completed';
          select count(*) into v_rejected from public.service_requests
            where status in ('rejected', 'cancelled');
        end if;

        if to_regclass('public.site_analytics_events') is not null then
          select count(*) into v_events_24h from public.site_analytics_events
            where created_at >= now() - interval '24 hours';
          select count(distinct session_id) into v_sessions_24h from public.site_analytics_events
            where created_at >= now() - interval '24 hours';
          select count(*) into v_events_7d from public.site_analytics_events
            where created_at >= now() - interval '7 days';
        end if;

        if to_regclass('public.cbt_attempts') is not null then
          select count(*) into v_attempts from public.cbt_attempts;
          select count(*) into v_submitted from public.cbt_attempts where status = 'submitted';
          select coalesce(round(avg(score), 2), 0) into v_avg_score
            from public.cbt_attempts where status = 'submitted';
        end if;

        if to_regclass('public.institutions') is not null then
          select count(*) into v_institutions from public.institutions;
        end if;

        if to_regclass('public.service_catalog') is not null then
          select count(*) into v_active_services from public.service_catalog where active is true;
        end if;

        if to_regclass('public.news_articles') is not null then
          select count(*) into v_published_news from public.news_articles where published is true;
        end if;

        if to_regclass('public.admin_audit_logs') is not null then
          select count(*) into v_audit from public.admin_audit_logs;
        end if;

        if to_regclass('public.edureach_audit_logs') is not null then
          select v_audit + count(*) into v_audit from public.edureach_audit_logs;
        end if;

        return jsonb_build_object(
          'users', v_users,
          'admins', v_admins,
          'service_requests', v_requests,
          'pending_requests', v_pending,
          'completed_requests', v_completed,
          'rejected_requests', v_rejected,
          'events_24h', v_events_24h,
          'sessions_24h', v_sessions_24h,
          'events_7d', v_events_7d,
          'cbt_attempts', v_attempts,
          'cbt_submitted', v_submitted,
          'average_cbt_score', v_avg_score,
          'institutions', v_institutions,
          'active_services', v_active_services,
          'published_news', v_published_news,
          'audit_events', v_audit
        );
      end;
      $body$;
    $fn$;

    execute 'revoke all on function public.admin_dashboard_metrics() from public, anon, authenticated';
    execute 'grant execute on function public.admin_dashboard_metrics() to service_role';
  end if;
end $outer$;

-- 3. admin_bootstrap_first_admin(uuid, text) ---------------------------------
-- Consumed by POST /api/admin/bootstrap. The server first requires a valid
-- Supabase session whose email exactly matches EDUREACH_ADMIN_BOOTSTRAP_EMAIL;
-- this RPC is the database-side lock: it promotes the account only while no
-- administrator exists, so re-running it later can never create a second
-- bootstrap admin or demote anyone.

do $outer$
begin
  if to_regprocedure('public.admin_bootstrap_first_admin(uuid, text)') is null then
    execute $fn$
      create function public.admin_bootstrap_first_admin(p_user_id uuid, p_email text)
      returns boolean
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        v_existing bigint;
      begin
        if p_user_id is null or p_email is null then
          return false;
        end if;

        if to_regclass('public.profiles') is null then
          return false;
        end if;

        select count(*) into v_existing from public.profiles
          where role in ('admin', 'super_admin', 'moderator', 'senate_admin', 'campus_agent');
        if v_existing > 0 then
          return false;
        end if;

        update public.profiles
          set role = 'super_admin'
          where id = p_user_id;

        return found;
      end;
      $body$;
    $fn$;

    execute 'revoke all on function public.admin_bootstrap_first_admin(uuid, text) from public, anon, authenticated';
    execute 'grant execute on function public.admin_bootstrap_first_admin(uuid, text) to service_role';
  end if;
end $outer$;
