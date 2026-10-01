-- AN-1 — analytics taxonomy: retention window and search reporting shape.
--
-- Two changes, both consequences of the taxonomy in src/lib/analyticsTaxonomy.ts:
--
-- 1. Raw events now have a retention window. `prune_site_analytics_events(90)`
--    deletes rows older than the declared window and reports how many it
--    removed. The window lives in three places that must agree — the taxonomy
--    (RETENTION_DAYS), this default, and docs/features/AN-1.md — and
--    scripts/analytics-audit.ts fails the build if they drift.
--
--    A scheduler is OBS-1's job, not this feature's: `npm run
--    analytics:retention -- --apply` is the executable unit, and the runbook
--    step is in the feature document. Until something calls it, rows older than
--    the window remain; that limitation is stated rather than papered over.
--
-- 2. `admin_activity_breakdown` no longer returns the literal search terms.
--    The taxonomy stopped collecting them (a search box is where a student
--    writes their name and their problem), so the console's "Top searches"
--    panel becomes what it was used for: how many searches happened, and how
--    many found nothing.
--
-- No table is altered, no column is added, and no grant changes: the posture
-- from BASE-1b (RLS on, no policy, service_role only) is already correct.

-- The prune and the window counts both filter on created_at.
create index if not exists site_analytics_events_created_at_idx
  on public.site_analytics_events (created_at);

-- Retention: delete raw rows older than p_retention_days, in the database, so
-- the clock used is the database's and not the calling script's.
create or replace function public.prune_site_analytics_events(p_retention_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_days int := greatest(coalesce(p_retention_days, 90), 1);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_deleted bigint := 0;
begin
  if to_regclass('public.site_analytics_events') is null then
    return jsonb_build_object('deleted', 0, 'cutoff', v_cutoff, 'retentionDays', v_days);
  end if;
  delete from public.site_analytics_events where created_at < v_cutoff;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted, 'cutoff', v_cutoff, 'retentionDays', v_days);
end;
$fn$;

-- Service-role only, like every other function in this schema.
revoke all on function public.prune_site_analytics_events(int) from public, anon, authenticated;
grant execute on function public.prune_site_analytics_events(int) to service_role;

-- What the console shows for searches now: volume, and how many found nothing.
-- Both numbers already answer the product question the raw terms were used for,
-- and neither can hold a person's name.
create or replace function public.admin_activity_breakdown(p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 14), 1));
  v_top_pages jsonb := '[]'::jsonb;
  v_service_views jsonb := '[]'::jsonb;
  v_service_submits jsonb := '[]'::jsonb;
  v_cbt_starts jsonb := '[]'::jsonb;
  v_searches bigint := 0;
  v_zero_result_searches bigint := 0;
  v_events_total bigint := 0;
begin
  if to_regclass('public.site_analytics_events') is null then
    return jsonb_build_object(
      'since', v_since,
      'topPages', v_top_pages,
      'serviceViews', v_service_views,
      'serviceSubmits', v_service_submits,
      'cbtStarts', v_cbt_starts,
      'searches', 0,
      'zeroResultSearches', 0,
      'eventsTotal', 0
    );
  end if;

  select count(*) into v_events_total
    from public.site_analytics_events
    where created_at >= v_since;

  select coalesce(jsonb_agg(row_to_json(t) order by t.views desc), '[]'::jsonb) into v_top_pages
    from (
      select path, count(*)::bigint as views
        from public.site_analytics_events
       where created_at >= v_since and event_name = 'page_view' and path is not null
       group by path
       order by views desc
       limit 8
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.views desc), '[]'::jsonb) into v_service_views
    from (
      select metadata->>'slug' as path, count(*)::bigint as views
        from public.site_analytics_events
       where created_at >= v_since and event_name = 'service_view' and metadata->>'slug' is not null
       group by metadata->>'slug'
       order by views desc
       limit 8
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb) into v_service_submits
    from (
      select metadata->>'slug' as path, count(*)::bigint as count
        from public.site_analytics_events
       where created_at >= v_since and event_name = 'service_submit' and metadata->>'slug' is not null
       group by metadata->>'slug'
       order by count desc
       limit 8
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb) into v_cbt_starts
    from (
      select coalesce(metadata->>'examTitle', metadata->>'examId') as exam, count(*)::bigint as count
        from public.site_analytics_events
       where created_at >= v_since and event_name = 'cbt_start'
         and (metadata->>'examTitle' is not null or metadata->>'examId' is not null)
       group by coalesce(metadata->>'examTitle', metadata->>'examId')
       order by count desc
       limit 8
    ) t;

  select count(*) into v_searches
    from public.site_analytics_events
   where created_at >= v_since and event_name = 'search';

  select count(*) into v_zero_result_searches
    from public.site_analytics_events
   where created_at >= v_since and event_name = 'search'
     and coalesce((metadata->>'result_count')::bigint, 0) = 0;

  return jsonb_build_object(
    'since', v_since,
    'topPages', v_top_pages,
    'serviceViews', v_service_views,
    'serviceSubmits', v_service_submits,
    'cbtStarts', v_cbt_starts,
    'searches', v_searches,
    'zeroResultSearches', v_zero_result_searches,
    'eventsTotal', v_events_total
  );
end;
$fn$;

revoke all on function public.admin_activity_breakdown(int) from public, anon, authenticated;
grant execute on function public.admin_activity_breakdown(int) to service_role;
