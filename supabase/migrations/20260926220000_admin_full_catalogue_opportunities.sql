-- Full-catalogue admin control + opportunities (scholarships/jobs/grants).
-- Guarded throughout: on the live project only the new columns/table are
-- added; existing rows and the four supported form services are untouched.

-- 1. service_catalog: fields the admin console manages for every service
--    (route = in-app destination, sort_order = display order, category =
--    filter grouping). Columns are additive and nullable, so out-of-band
--    live data keeps working unchanged.
do $$
begin
  if to_regclass('public.service_catalog') is not null then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'service_catalog' and column_name = 'category') then
      alter table public.service_catalog add column category text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'service_catalog' and column_name = 'route') then
      alter table public.service_catalog add column route text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'service_catalog' and column_name = 'sort_order') then
      alter table public.service_catalog add column sort_order int;
    end if;
  end if;
end $$;

-- 2. Backfill known in-app destinations and ordering (only when unset, so a
--    value an admin sets later is never overwritten by re-running).
do $$
declare
  mapping jsonb := $$
  {
    "jamb":            { "route": "/jamb",           "category": "Examinations", "sort": 10 },
    "jamb-cbt":        { "route": "/cbt",            "category": "Examinations", "sort": 11 },
    "post-utme":       { "route": "/post-utme",      "category": "Examinations", "sort": 12 },
    "waec":            { "route": "/waec",           "category": "Examinations", "sort": 13 },
    "neco":            { "route": "/neco",           "category": "Examinations", "sort": 14 },
    "nabteb":          { "route": "/nabteb",         "category": "Examinations", "sort": 15 },
    "past-questions":  { "route": "/past-questions", "category": "Examinations", "sort": 16 },
    "school-finder":   { "route": "/schools",        "category": "Academics",    "sort": 20 },
    "scholarships":    { "route": "/jobs",           "category": "Opportunities", "sort": 30 },
    "nelfund-loan":    { "route": null,              "category": "Services",     "sort": 1 },
    "results":         { "route": null,              "category": "Services",     "sort": 2 },
    "jamb-slip":       { "route": null,              "category": "Services",     "sort": 3 },
    "admission-letters": { "route": null,            "category": "Services",     "sort": 4 }
  }
  $$;
  key text;
  entry jsonb;
begin
  if to_regclass('public.service_catalog') is null then
    return;
  end if;
  for key, entry in select * from jsonb_each(mapping)
  loop
    update public.service_catalog
      set route = coalesce(route, (entry->>'route')),
          category = coalesce(category, (entry->>'category')),
          sort_order = coalesce(sort_order, (entry->>'sort')::int)
      where service_key = key;
  end loop;
end $$;

-- 3. Opportunities: scholarships, grants, jobs and fellowships listed on
--    /jobs. Public read of active rows; writes via the admin API only.
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organisation text,
  category text not null default 'scholarship'
    check (category in ('scholarship', 'grant', 'job', 'fellowship', 'competition')),
  description text,
  link_url text,
  deadline date,
  locations text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;

do $$
begin
  if to_regclass('public.opportunities') is not null then
    execute 'grant select on table public.opportunities to anon, authenticated';
    execute 'revoke insert, update, delete on table public.opportunities from anon, authenticated';
    execute 'grant select, insert, update, delete on table public.opportunities to service_role';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'opportunities' and policyname = 'opportunities_public_read_active'
    ) then
      execute 'create policy opportunities_public_read_active on public.opportunities for select to anon, authenticated using (is_active = true)';
    end if;
  end if;
end $$;
