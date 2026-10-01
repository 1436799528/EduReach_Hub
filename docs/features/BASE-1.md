# Feature: BASE-1 — Reproducible baseline schema

Status: **implemented** (see Evidence). Written before the code, per
`docs/architecture/08-FEATURE-TEMPLATE.md`.

## Purpose

Answer one question honestly:

> If a new Supabase project is given this repository and nothing else, can the
> database structure EduReach expects be reconstructed?

Before BASE-1 the answer was **no**, and worse than "incomplete": applying the
migration history to an empty database fails at the first files, because the
history assumes objects that no migration creates — `profiles`,
`service_catalog`, `service_requests` (already recorded as a P0 finding) plus
eleven more tables and three functions discovered here. Later migrations then
build policies, indexes, triggers and grants on top of them.

BASE-1 creates those baseline objects in a migration that sorts before every
other one, guarded so an existing project is never rewritten, so that a fresh
project can apply the history end to end.

## User

Nobody using the product. The user is the engineer/operator who has to stand up
staging or a new production project, or verify P0-1 (live migration state) —
and, indirectly, every future verification claim in this repository, because
those claims are only meaningful if the environment can be rebuilt.

## User Flow

N/A — no user-facing surface. The flows are operator flows, documented in
`docs/architecture/02-DATA-MODEL.md` § Baseline and in the PR checklist:

1. New project: `supabase link` → apply migrations in order → the baseline runs
   first and the rest of the history applies cleanly → seed/reference data is
   added deliberately (see "Data Source").
2. Existing project: the baseline is applied but every statement is
   create-if-absent or guarded, so nothing is dropped, renamed or rewritten;
   the one intentional effect is listed in "Security".

## Screens

N/A — no UI.

## Routes

N/A — no HTTP surface.

## Components

N/A — no frontend components.

## User Actions

N/A — migrations run at deploy time, not from the product.

## Button Logic

N/A — no buttons.

## Data

**Objects the history expects and did not create** (created by the baseline as
`schema only`, no rows):

| Object | Referenced by | Notes |
|---|---|---|
| `profiles` | 50 references; every RLS policy, `handle_new_user()`, the app | Columns reconstructed from the insert lists in `20260919_auth_cbt_consistency_hardening.sql`, `20260920_auth_and_profile_completion.sql`, the column grants, the policies and the application queries |
| `service_catalog` | 19 references; public read policy, `get_public_service_request()`, the app | `service_key`, `title`, `description`, `active`, `amount_kobo`, `application_url`, `category`, `route`, `sort_order` |
| `service_requests` | 27 references; the student dashboard, the admin queue, the reference-code trigger | `user_id`, `service_id`, `status`, `form_data`, `admin_note`, `reference_code`, `created_at`, `updated_at` |
| `campus_posts` | 7 references; moderation and storage policies | `author_id`, `institution_id`, `moderation_status`, `attachment_path` |
| `campus_post_comments`, `campus_post_likes` | indexes | Legacy Campus Feed tables; no application code reads them |
| `past_questions` | 5 references; programme-scoped policy | `course_id`, `uploaded_by`, `status`, `year` |
| `resources` | storage policy (`storage_path`, `uploaded_by`, `status`, `course_id`) | |
| `courses` | index + storage policy (`programme_id`, `code`, `level`, `semester`, `is_active`) | |
| `student_wallets` | `handle_new_user()` inserts into it | `user_id` unique, `balance`, `currency` |
| `edureach_notifications` | staff-insert policy only | Legacy notification table, superseded by `student_notifications`; column shape is **inferred** (flagged below) |
| `admin_content_versions` | deny-client policy | Content versioning table; column shape is **inferred** |
| `public.is_staff(uuid)` | 8 policy references in four migrations | Functional: the staff predicate those policies call. `is_staff_user()` (ROLE-1) is the application-facing successor |
| `public.is_staff_user()` | revoke/grant in `20260919_production_hardening.sql`, before ROLE-1 creates it | Created here delegating to `is_staff()`, then **replaced** by ROLE-1's canonical definition (`create or replace`, guarded) |
| `public.handle_new_student_profile()` | revoke/grant and search-path migrations | Legacy routine; **body is not reproduced** — see "Backend" |
| `public.claim_service_voucher(uuid, text)` | revoke/grant migrations; dropped again by `20260924_retire_legacy_scratch_service.sql` | Same treatment |

**Deliberately not created:** `programmes`, `campus_uploads`,
`resource_files`, `exam_attempts` and other names that appear nowhere in the
history or the code. A fabricated table is worse than a documented gap — the
drift check fails if the application ever asks for one.

**Storage:** three buckets are referenced (`resource-files` and `campus-uploads`
by storage policies, `admin-content` by `20260926200000`). The first two are
created idempotently by the baseline; `admin-content` keeps its existing owner.

**Seed/reference data:** the baseline contains **no rows of application data**.
Three migrations carry reference data (`20260915_application_integration_seed.sql`
— a demo CBT exam; `20260926200000` — the `admin-content` bucket;
`20260926220000` — catalogue/opportunities defaults). They are applied history
and are not moved: rewriting an applied migration is how environments diverge.
The boundary is documented instead, and `tests/schema.test.ts` asserts the
baseline stays schema-only.

## Data Source

Supabase/Postgres. The baseline is derived from the repository itself: every
column it creates is traceable to a migration, a policy or an application query
(the Evidence section lists the commands that produced the inventory).

## Backend

`supabase/migrations/20260830000000_baseline_core_schema.sql`:

- **Ordering.** The timestamp sorts before `20260831_add_production_query_indexes.sql`
  so a fresh project meets the base objects first. On an existing project order
  is irrelevant: every statement is idempotent.
- **Never overwrite what exists.** Tables use `create table if not exists`;
  functions are created inside `do $$ ... if to_regprocedure(...) is null ...`
  guards, so a production definition — including the real
  `handle_new_student_profile()` / `claim_service_voucher(uuid, text)` bodies,
  which this repository has never seen — is **never replaced**.
- **Legacy routines are fail-closed stubs.** `handle_new_student_profile()` and
  `claim_service_voucher(uuid, text)` raise if called. Nothing in the current
  application or history calls them; they exist so the historical
  `revoke`/`grant` statements can apply on a fresh project. One is dropped again
  by `20260924_retire_legacy_scratch_service.sql`, which is correct.
- **`is_staff(uuid)` is functional**, because eight live policies depend on it:
  `exists (select 1 from public.profiles where id = $1 and role in (...))`, with
  the same staff vocabulary ROLE-1 adopted (`admin`, `moderator`, `super_admin`,
  `content_editor`, `service_admin`). The retired half-roles are excluded, so
  the baseline cannot contradict ROLE-1.
- **No semantic shortcuts:** no `drop`, no `delete`, no `update` of existing
  rows, no column additions to existing tables, no constraint changes.

## Security

- **RLS is enabled** on every table the baseline creates that carries policies
  (`profiles`, `service_catalog`, `service_requests`, `campus_posts`,
  `campus_post_comments`, `campus_post_likes`, `past_questions`, `resources`,
  `courses`, `student_wallets`, `edureach_notifications`,
  `admin_content_versions`). Without this step a fresh project would have
  policies that never run: RLS is enabled by the history for the newer tables
  but **never** for these. On an existing project the statement is a no-op where
  RLS is already on, and where it is off the migration prints a notice so the
  change is visible, not silent.
- No grants are widened. The history's own `revoke`/column-`grant` statements
  remain the authority; the baseline only grants `execute` on `is_staff(uuid)`
  to `authenticated`, mirroring `is_staff_user()`.
- The baseline cannot *repair* drift on an existing database (it will not add a
  missing column to a live table). That is deliberate: silently altering a
  production table is the failure mode this feature exists to avoid. Drift is
  reported by `npm run schema:audit` and must be fixed by a reviewed migration.

## States

N/A — no UI states. Migration output has two states: applied cleanly, or the
statement that failed (Postgres reports it; the audit command reports the same
class of problem before you get there).

## Edge Cases

| Case | Behaviour |
|---|---|
| Existing project with the tables | Every statement is a no-op; notices only |
| Existing project with a *different* `is_staff()` | Left untouched (guarded); the audit reports it as drift to review |
| Project without `storage` schema (plain Postgres) | The bucket block is guarded on `to_regclass('storage.buckets')` |
| Applied *after* later migrations on an existing project | Safe: no later migration is re-run, and no baseline statement depends on being first except ordering for a fresh project |
| Project without the `auth` schema (plain Postgres) | Not supported and never was: the history already references `auth.users` in four tables, and `profiles.id` keeps the standard Supabase cascade |
| A future table is added to the code but not the history | `tests/schema.test.ts` and `npm run schema:audit` fail with the table name |

## Analytics

N/A — no product events.

## Notifications

N/A — no user-facing notification. Operators see migration notices (`raise
notice`) for RLS enablement and skipped function definitions.

## Testing

`tests/schema.test.ts` (new) + `scripts/schema-audit.ts` (new, also a CLI):

- every table and RPC the application calls is created by some migration
  (this is the check that would have caught `profiles`/`service_catalog`/`service_requests`);
- simulating the history in filename order, no statement references an object
  that neither the baseline nor an earlier migration creates — i.e. a fresh
  project applies end to end (the check that would have caught
  `20260831_add_production_query_indexes.sql` failing on an empty database);
- the baseline stays schema-only: no `insert`/`update`/`delete`, no `drop`;
- the baseline does not touch the retired roles and does not demote anyone
  (ROLE-1's decision, restated as a test);
- `is_staff(uuid)` and ROLE-1's `is_staff_user()` list the same staff
  vocabulary — two predicates cannot drift apart;
- migration filenames are unique and their prefixes parse as timestamps.

## Evidence

Everything below was produced on 2026-09-30 on `arena/01a0f3bd-edureach-hub`.

TEST-1 later closed the largest gap in this section: `tests/migrations.test.ts`
now applies all 38 migrations, in filename order, to a real PostgreSQL engine
(PostgreSQL 18.3 compiled to WebAssembly, `@electric-sql/pglite`) and runs
`supabase/ci/verify-migrations.sql` against the result. That run is what
produced finding 9 below — a migration the static audit could not fault and no
PostgreSQL could parse. It is still not `supabase db reset` against a Supabase
project, which remains a manual dependency.

### Migration inventory

| Metric | Before BASE-1 | After BASE-1 |
|---|---|---|
| Migration files | 35 | **38** (baseline + two repairs; two files renamed, nothing deleted) |
| Tables created by migrations | 24 | **35** (the baseline adds the 11 missing base tables) |
| Functions created by migrations | 21 | **25** (the baseline adds `is_staff(uuid)`, `is_staff_user()`, and fail-closed stubs for `handle_new_student_profile()` and `claim_service_voucher(uuid, text)`) |
| Tables the application reads | 17 | 17 (all created by migrations) |
| RPCs the application calls | 12 | 12 (all created by migrations) |
| Tables with RLS enabled by the history | 24 | 29 (baseline adds `profiles`, `service_catalog`, `service_requests`, `campus_posts`, `past_questions` — the tables whose policies the history defines) |

### Drift findings (what the repository could not build)

1. **Eleven base tables were never created by any migration** — `profiles`
   (50 references), `service_requests` (27), `service_catalog` (19),
   `campus_posts` (7), `past_questions` (5), `student_wallets` (5),
   `resources` (4), `courses` (3), `edureach_notifications` (2), plus
   `campus_post_comments` and `campus_post_likes`. The history's very first file,
   `20260831_add_production_query_indexes.sql`, fails on an empty database
   because of this.
2. **Three functions were never created by any migration** —
   `public.is_staff(uuid)` (eight policies call it), `is_staff_user()`
   (revoked/granted by `20260919_production_hardening.sql`),
   `handle_new_student_profile()` and `claim_service_voucher(uuid, text)`
   (revoked/granted by two migrations).
3. **RLS was never enabled for the base tables** — `profiles`, `service_catalog`,
   `service_requests`, `campus_posts` and `past_questions` have policies in the
   history but no `enable row level security` anywhere, so on a fresh project
   those policies would never run.
4. **Two migrations ran before the tables they use** —
   `20260915_application_integration_seed.sql` and `20260915_cbt_news_rls.sql`
   sort before `20260915_cbt_news_tables.sql`, which creates
   `cbt_exams`/`exam_questions`/`cbt_attempts`/`cbt_answers`/`news_articles`.
   They worked in production because those tables already existed there.
5. **No migration recreated the signup trigger** —
   `20260919_auth_cbt_consistency_hardening.sql` created
   `on_auth_user_created`, `20260919_remove_redundant_auth_trigger.sql` dropped
   it (and `handle_new_user()`), `20260920_auth_and_profile_completion.sql`
   restored the function but not the trigger, and the two canonical names it
   mentions appear nowhere else. On a fresh project every signup would produce a
   user with no profile row — and `lib/auth.ts` reads `profiles.role`, so the
   account would be locked out of everything.
6. **Five `institutions` columns the application selects were never created** —
   `slug`, `admission_portal_url`, `student_portal_url`, `is_verified`,
   `updated_at`; `GET /api/admin/institutions` would fail on a fresh project.
7. **Six tables carry no effective policy** — `courses`, `resources`,
   `campus_post_comments`, `campus_post_likes`, `student_wallets`,
   `edureach_notifications`: four had no policy at all and two had a policy that
   could never run because RLS was off. Their RLS state was therefore not
   reproducible from the repository and the baseline deliberately did not change
   it (changing RLS without a policy would silently deny reads that production
   allows). **Resolved by BASE-1b**, which widened the review to every table in
   `public` after the count in this finding was shown to be imprecise — see
   `docs/features/BASE-1b.md`.
8. **`admin_content_versions` is referenced but never created** — the one
   reference is inside a `to_regclass` guard and no application code reads it, so
   the baseline deliberately does not invent its shape.

9. **A migration in the history cannot be parsed by PostgreSQL at all** (found
   later, by TEST-1's real-engine replay). In
   `20260926220000_admin_full_catalogue_opportunities.sql`, the `do $$ ... $$`
   block declares `mapping jsonb := $$ ... $$` for its JSON literal; the inner
   `$$` closes the outer block, so the parser meets `{` at statement level and
   fails with `syntax error at or near "{"`. Every migration tool — Supabase's
   included — stops there. The static audit could not see it: it never feeds the
   text to a parser. Fixed by giving the literal its own dollar tag
   (`$mapping$`); intent, guards and effects are unchanged.

### Changes made

| File | Change |
|---|---|
| `supabase/migrations/20260830000000_baseline_core_schema.sql` | **New.** Creates the 11 missing tables, `is_staff(uuid)`, `is_staff_user()`, the two fail-closed legacy stubs, enables RLS on the five base tables, creates the `resource-files`/`campus-uploads` buckets, and prints drift notices. Create-if-absent and `to_regprocedure`-guarded throughout. |
| `supabase/migrations/20260930150000_auth_signup_trigger_repair.sql` | **New.** Creates `on_auth_user_created_edureach` only when nothing on `auth.users` executes `handle_new_user()` (name-agnostic `pg_trigger` check). |
| `supabase/migrations/20260930160000_institutions_column_repair.sql` | **New.** `add column if not exists` for the five missing `institutions` columns plus a non-unique slug index. |
| `20260915_application_integration_seed.sql` → `20260916000000_application_integration_seed.sql` | **Renamed** (content unchanged apart from a header note) so it runs after the tables it seeds. |
| `20260915_cbt_news_rls.sql` → `20260916010000_cbt_news_rls.sql` | **Renamed** (content unchanged apart from a header note) so it runs after the tables it protects. |
| `supabase/migrations/20260926220000_admin_full_catalogue_opportunities.sql` | **Fixed.** The JSON literal in its `do` block reused the block's own dollar-quote tag, so the file could not parse on any PostgreSQL (finding 9). The literal now uses `$mapping$`; the migration's intent and effects are otherwise untouched. |
| `scripts/schema-audit.ts` | **New.** The offline fresh-apply simulation and drift report; also `npm run schema:audit`. |
| `tests/schema.test.ts` | **New.** 12 tests: fresh-apply simulation, app-required objects, ordering, baseline invariants, staff-predicate agreement, bucket creation. |

No application code, endpoint, policy or role definition changed. No row was
updated or deleted by any of these files; the two renames are the only edits to
applied history and both are idempotent (verified statement by statement:
`create ... if not exists`, `create or replace`, `drop policy if exists`,
guarded inserts, `on conflict do update`).

### Fresh-environment result

`supabase db reset` against a scratch project is still the definitive check and
**has not been executed** — no hosted project is reachable from this environment.
Two substitutes run instead:

- `npm run schema:audit` plus `tests/schema.test.ts`, which walk every migration
  in filename order and assert that no statement references an object an earlier
  migration has not created;
- `tests/migrations.test.ts` (added by TEST-1), which executes every migration on
  a **real PostgreSQL engine** in-process and then asserts the objects the
  application uses exist. It applied 37 of 38 files before finding 9, and all 38
  after the fix, with `verify-migrations.sql` passing. The engine is PostgreSQL
  compiled to WebAssembly — real parsing and execution, but a single-user
  instance, so it does not prove Supabase Cloud accepts the SQL or exercise RLS
  as a restricted role.

| Check | Before | After |
|---|---|---|
| Hard failures (first statement that stops a fresh apply) | 181 with the first version of the tool; **18** after it was corrected | **0** |
| Objects the application requires that no migration creates | 6 tables/functions, 5 columns | **0** |
| Columns referenced before the migration that adds them | 11 | **0** |
| Deferred (runtime-resolved) references | 6, all pre-existing | 6 (unchanged, asserted) |
| Guarded dynamic SQL deliberately not checked | — | 36 statements (reported by the tool) |

### Test results

- `npm run typecheck` clean.
- `npm test` **228 passing, 0 failing** (was 216; +12 in `tests/schema.test.ts`).
- `npm run build` clean (client + `build/server.cjs`).
- `npm run schema:audit`: "no blocking findings" (exit 0).

The numbers above are BASE-1's own run. TEST-1 subsequently added
`tests/migrations.test.ts` (the real-engine replay) and `tests/ci.test.ts` (gate
assertions); the suite is now 239 tests and `npm run ci` runs all of it plus the
browser and dependency checks.

### Remaining manual dependencies

1. Run `supabase db reset` (or apply the migrations to a scratch project) once
   and confirm it completes — the one step this environment cannot perform. The
   in-process replay now covers syntax, ordering and missing objects on a real
   engine, so what remains unverified here is Supabase-specific behaviour only.
2. `psql` against the scratch project and compare `information_schema.columns`
   with production: the baseline restores *structure*, but a live project may
   hold columns this repository still does not know about.
3. Apply the two renamed migrations on the next deploy; they are idempotent, but
   the migration table will show new version rows for the same work.
4. Two legacy routine bodies (`handle_new_student_profile()`,
   `claim_service_voucher(uuid, text)`) and any separate
   `on_auth_user_created_wallet` routine remain unknown to the repository. They
   are stubbed/not invented; if production uses them, export their definitions
   and commit them as a migration.
5. ~~Decide the RLS posture for the six tables listed in finding 7.~~ **Done in
   BASE-1b** for every table in `public`, not just the six (`docs/features/BASE-1b.md`).
6. P0-1 (live migration-state verification) is still open: apply nothing to
   production until the reviewer checklist in PR #11 is done.

### Commit and PR

Commits on `arena/01a0f3bd-edureach-hub`; PR #11 carries a Part 5 section with
this evidence. Exact hashes are in the PR.
