-- Admin control centre backend (2026-09-26 full-audit follow-up).
-- Everything is guarded: on the live project (where objects already exist
-- out-of-band) this migration is a no-op; on a fresh project it produces the
-- objects the Admin console and main site depend on.

-- 1. Telemetry table (server-only). Referenced by server.ts inserts and the
--    20260925 hardening migration, but never created in-repo until now.
create table if not exists public.site_analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  path text,
  session_id text not null,
  user_id uuid,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.site_analytics_events enable row level security;

do $$
begin
  if to_regclass('public.site_analytics_events') is not null then
    execute 'revoke all on table public.site_analytics_events from anon, authenticated';
    execute 'grant select, insert, update, delete on table public.site_analytics_events to service_role';
  end if;
end $$;

-- 2. Institutions (public catalogue read by School Finder). Guarded so an
--    existing live table with its own shape is never touched.
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  acronym text,
  state text,
  institution_type text,
  website_url text,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.institutions') is not null then
    -- Public read is the point of the catalogue; writes stay service-only.
    execute 'grant select on table public.institutions to anon, authenticated';
    execute 'revoke insert, update, delete on table public.institutions from anon, authenticated';
    execute 'grant select, insert, update, delete on table public.institutions to service_role';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'institutions' and policyname = 'institutions_public_read'
    ) then
      execute 'create policy institutions_public_read on public.institutions for select to anon, authenticated using (true)';
    end if;
  end if;
end $$;

-- 3. Admin notes on service requests (operations workflow).
alter table public.service_requests add column if not exists admin_note text;

-- 4. Focus/activity breakdown for the Admin overview and analytics pages.
--    Computed entirely in SQL from real telemetry; empty results mean empty.
do $outer$
begin
  if to_regprocedure('public.admin_activity_breakdown(int)') is null then
    execute $fn$
      create function public.admin_activity_breakdown(p_days int default 14)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 14), 1));
        v_top_pages jsonb := '[]'::jsonb;
        v_top_searches jsonb := '[]'::jsonb;
        v_service_views jsonb := '[]'::jsonb;
        v_service_submits jsonb := '[]'::jsonb;
        v_cbt_starts jsonb := '[]'::jsonb;
        v_events_total bigint := 0;
      begin
        if to_regclass('public.site_analytics_events') is null then
          return jsonb_build_object(
            'since', v_since,
            'topPages', v_top_pages,
            'topSearches', v_top_searches,
            'serviceViews', v_service_views,
            'serviceSubmits', v_service_submits,
            'cbtStarts', v_cbt_starts,
            'eventsTotal', 0
          );
        end if;

        select count(*) into v_events_total
          from public.site_analytics_events
          where created_at >= v_since;

        select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'views', t.n)), '[]'::jsonb)
          into v_top_pages
          from (
            select path, count(*) as n
            from public.site_analytics_events
            where created_at >= v_since and event_name = 'page_view' and path is not null
            group by path
            order by n desc
            limit 8
          ) t;

        select coalesce(jsonb_agg(jsonb_build_object('term', t.term, 'count', t.n)), '[]'::jsonb)
          into v_top_searches
          from (
            select coalesce(nullif(btrim(metadata->>'q'), ''), '(blank)') as term, count(*) as n
            from public.site_analytics_events
            where created_at >= v_since and event_name = 'search'
            group by 1
            order by n desc
            limit 8
          ) t;

        select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'views', t.n)), '[]'::jsonb)
          into v_service_views
          from (
            select path, count(*) as n
            from public.site_analytics_events
            where created_at >= v_since and event_name = 'service_view' and path is not null
            group by path
            order by n desc
            limit 8
          ) t;

        select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'count', t.n)), '[]'::jsonb)
          into v_service_submits
          from (
            select path, count(*) as n
            from public.site_analytics_events
            where created_at >= v_since and event_name = 'service_submit' and path is not null
            group by path
            order by n desc
            limit 8
          ) t;

        select coalesce(jsonb_agg(jsonb_build_object('exam', t.exam, 'count', t.n)), '[]'::jsonb)
          into v_cbt_starts
          from (
            select coalesce(nullif(btrim(metadata->>'examTitle'), ''), metadata->>'examId', '(unknown)') as exam, count(*) as n
            from public.site_analytics_events
            where created_at >= v_since and event_name = 'cbt_start'
            group by 1
            order by n desc
            limit 8
          ) t;

        return jsonb_build_object(
          'since', v_since,
          'topPages', v_top_pages,
          'topSearches', v_top_searches,
          'serviceViews', v_service_views,
          'serviceSubmits', v_service_submits,
          'cbtStarts', v_cbt_starts,
          'eventsTotal', v_events_total
        );
      end;
      $body$;
    $fn$;

    execute 'revoke all on function public.admin_activity_breakdown(int) from public, anon, authenticated';
    execute 'grant execute on function public.admin_activity_breakdown(int) to service_role';
  end if;
end $outer$;

-- 5. Storage bucket for admin-uploaded content images (public read).
insert into storage.buckets (id, name, public)
values ('admin-content', 'admin-content', true)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'admin-content') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'admin_content_public_read'
    ) then
      execute 'create policy admin_content_public_read on storage.objects for select using (bucket_id = ''admin-content'')';
    end if;
  end if;
end $$;
