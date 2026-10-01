-- OBS-1 — scheduled job observability.
--
-- The daily newsroom refresh already records its own run in `news_ingest_runs`,
-- with status, counters and the error. What was missing is everything around it:
-- the analytics retention prune records nothing, a failure reaches only the
-- platform's log stream, and there is no single place that answers the two
-- questions an operator actually asks — when did this job last succeed, and when
-- did it last fail?
--
-- This adds that layer without a monitoring platform: one table, one status
-- function, and an admin endpoint that reads it. Jobs write a row; the console
-- reads the rows. A job that never writes is visible as a job with no recent row,
-- which is the failure mode that matters most (a schedule that stopped firing).
--
-- Server-only, like every other operational table: RLS on, no client policy, no
-- grant to anon or authenticated.

create table if not exists public.scheduled_job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null
    check (status in ('succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  duration_ms int,
  /** Operator-safe detail: counts, source names, a truncated error. Never a secret. */
  detail jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_job_runs_job_started_idx
  on public.scheduled_job_runs (job_name, started_at desc);

alter table public.scheduled_job_runs enable row level security;

do $$
begin
  if to_regclass('public.scheduled_job_runs') is not null then
    execute 'drop policy if exists scheduled_job_runs_deny_client on public.scheduled_job_runs';
    execute 'create policy scheduled_job_runs_deny_client on public.scheduled_job_runs
             for all to anon, authenticated using (false) with check (false)';
    execute 'revoke all on table public.scheduled_job_runs from anon, authenticated';
    execute 'grant select, insert, update, delete on table public.scheduled_job_runs to service_role';
  end if;
end $$;

-- Last success and last failure per job, in one call, so the console and the
-- readiness check do not each invent their own query. `stale_after_hours` lets a
-- caller ask the real question: has this job run successfully recently enough?
create or replace function public.scheduled_job_status(p_stale_after_hours int default 48)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hours int := greatest(coalesce(p_stale_after_hours, 48), 1);
  v_jobs jsonb := '[]'::jsonb;
begin
  if to_regclass('public.scheduled_job_runs') is null then
    return jsonb_build_object('sinceHours', v_hours, 'jobs', v_jobs);
  end if;

  select coalesce(jsonb_agg(row_to_json(j) order by j.job_name), '[]'::jsonb) into v_jobs
    from (
      select
        j.job_name,
        count(*)::int as runs,
        max(r.started_at) filter (where r.status = 'succeeded') as last_success_at,
        max(r.started_at) filter (where r.status = 'failed') as last_failure_at,
        count(*) filter (where r.status = 'failed')::int as failures,
        max(r.error) filter (where r.status = 'failed') as last_error,
        (
          max(r.started_at) filter (where r.status = 'succeeded')
            is not null
          and max(r.started_at) filter (where r.status = 'succeeded')
              > now() - make_interval(hours => v_hours)
        ) as fresh
      from public.scheduled_job_runs r
      join lateral (select r.job_name) j on true
      group by j.job_name
    ) j;

  return jsonb_build_object('sinceHours', v_hours, 'jobs', v_jobs);
end;
$fn$;

revoke all on function public.scheduled_job_status(int) from public, anon, authenticated;
grant execute on function public.scheduled_job_status(int) to service_role;

-- Retention for the job log itself. It is operational telemetry, not product data:
-- 180 days is longer than the analytics window because an operator needs to see a
-- trend across a term, and the rows are small.
create or replace function public.prune_scheduled_job_runs(p_retention_days int default 180)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_days int := greatest(coalesce(p_retention_days, 180), 1);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_deleted bigint := 0;
begin
  if to_regclass('public.scheduled_job_runs') is null then
    return jsonb_build_object('deleted', 0, 'cutoff', v_cutoff, 'retentionDays', v_days);
  end if;
  delete from public.scheduled_job_runs where started_at < v_cutoff;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted, 'cutoff', v_cutoff, 'retentionDays', v_days);
end;
$fn$;

revoke all on function public.prune_scheduled_job_runs(int) from public, anon, authenticated;
grant execute on function public.prune_scheduled_job_runs(int) to service_role;
