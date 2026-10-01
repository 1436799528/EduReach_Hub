-- BASE-1b — explicit row-level security and grant posture for every public
-- table.
--
-- Why this exists
-- ---------------
-- Supabase grants the API roles broad access to `public` by default
-- (`alter default privileges ... grant all on tables to anon, authenticated,
-- service_role`). A table created in that schema is therefore reachable through
-- PostgREST unless something restricts it, and `anon` is not a privileged role:
-- the publishable key is public. BASE-1 made the repository able to *create*
-- these tables; this migration makes the repository able to create their
-- intended *access posture*, for every table, including the ones with no policy
-- and the ones with a policy that never ran because RLS was off.
--
-- The classification this implements, with the reasoning for each table, is
-- `scripts/rls-posture.ts` and `docs/features/BASE-1b.md`. `tests/rls-posture
-- .test.ts` replays this migration on a real engine and fails if the database
-- and the classification disagree, or if a table is unclassified.
--
-- Properties: idempotent, no drops, no data changes, no policy removed. Dormant
-- tables keep their historical policies; without a grant those policies simply
-- have nothing to apply to, so reviving a feature means granting deliberately.
--
-- Applied to a Supabase project this narrows access; it never widens it.

-- 1. Fail-closed defaults for tables created in the future --------------------
--    Only our own SQL can now open a table to the API roles. Revoking the
--    defaults cannot lock out service_role (the server) and cannot affect the
--    owner. If the role running migrations may not change its defaults, the
--    per-table posture below still applies and the reason is reported.
do $base1b_defaults$
begin
  begin
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
  exception
    when insufficient_privilege then
      raise notice 'BASE-1b: current role cannot change default privileges (%). Future tables rely on the per-table posture only.', current_user;
  end;
  raise notice 'BASE-1b: new tables in public are no longer granted to anon/authenticated by default.';
end
$base1b_defaults$;

-- 2. Public read (anon + authenticated may select; nobody but the server writes)
--    These are the directory/content tables the browser reads without a session
--    or with one. Row filtering stays in the existing policies (published news,
--    active services/exams/opportunities); this only makes the grant explicit.
do $base1b_public$
declare
  target text;
  targets constant text[] := array[
    'institutions', 'service_catalog', 'cbt_exams', 'news_articles', 'opportunities'
  ];
begin
  foreach target in array targets loop
    if to_regclass('public.' || target) is null then
      raise notice 'BASE-1b: skipping public-read posture for missing table public.%.', target;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from anon, authenticated, public', target);
    execute format('grant select on table public.%I to anon, authenticated', target);
    raise notice 'BASE-1b: public-read posture on public.% (select for anon/authenticated).', target;
  end loop;
end
$base1b_public$;

-- 3. Owner-scoped (authenticated only, restricted to its own rows by policy) --
--    Every verb granted here is covered by a policy on the table. Tables the
--    browser does not read are not in this group, even when they have a good
--    owner policy: a grant without a feature is exposure without a purpose.
do $base1b_owner$
declare
  row record;
  mapping constant text[][] := array[
    ['profiles',                 'select, insert, update'],
    ['service_requests',         'select, insert, update'],
    ['student_notifications',    'select, insert, update, delete'],
    ['student_saved_items',      'select, insert, update, delete'],
    ['student_cgpa_courses',     'select, insert, update, delete'],
    ['student_cgpa_terms',       'select, insert, update, delete'],
    ['student_security_events',  'select, insert'],
    ['cbt_attempts',             'select']
  ];
  i int;
begin
  for i in 1 .. array_length(mapping, 1) loop
    if to_regclass('public.' || mapping[i][1]) is null then
      raise notice 'BASE-1b: skipping owner posture for missing table public.%.', mapping[i][1];
      continue;
    end if;
    execute format('alter table public.%I enable row level security', mapping[i][1]);
    execute format('revoke all on table public.%I from anon, authenticated, public', mapping[i][1]);
    execute format('grant %s on table public.%I to authenticated', mapping[i][2], mapping[i][1]);
    raise notice 'BASE-1b: owner posture on public.% (authenticated: %s).', mapping[i][1], mapping[i][2];
  end loop;
end
$base1b_owner$;

-- 4. Server-only and dormant tables: RLS on, no client grant ------------------
--    Server-only tables are reached by the application through service_role (and
--    by security-definer functions), which bypasses RLS — revoking here does not
--    affect them. Dormant tables are kept, not dropped; the historical policies
--    stay and become effective again the day someone grants deliberately.
do $base1b_closed$
declare
  target text;
  targets constant text[] := array[
    -- active server-only
    'student_wallets', 'student_wallet_transactions', 'payment_events',
    'admin_audit_logs', 'edureach_audit_logs', 'rate_limit_hits',
    'site_analytics_events', 'news_sources', 'news_ingest_runs',
    'news_ingest_candidates', 'edureach_deadlines', 'edureach_exams',
    'exam_questions', 'cbt_answers',
    -- dormant / legacy (no application code path)
    'campus_posts', 'campus_post_comments', 'campus_post_likes', 'resources',
    'courses', 'edureach_notifications', 'past_questions', 'edureach_material_notes'
  ];
begin
  foreach target in array targets loop
    if to_regclass('public.' || target) is null then
      raise notice 'BASE-1b: skipping closed posture for missing table public.%.', target;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from anon, authenticated, public', target);
    raise notice 'BASE-1b: closed posture on public.% (no client privileges).', target;
  end loop;
end
$base1b_closed$;

-- 5. Assert the invariant this migration exists for ---------------------------
--    A client-reachable table with RLS off would be readable by anyone holding
--    the publishable key. Fail the migration rather than ship that.
do $base1b_verify$
declare
  offender text;
begin
  select c.relname into offender
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
    and (
      has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('authenticated', c.oid, 'select')
    )
  limit 1;
  if offender is not null then
    raise exception 'BASE-1b: public.% is reachable by a client role with RLS disabled', offender;
  end if;
  raise notice 'BASE-1b: no client-reachable table has RLS disabled.';
end
$base1b_verify$;
