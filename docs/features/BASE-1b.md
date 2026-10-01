# Feature: BASE-1b — RLS posture for every public table

Status: **implemented** (spec written before the code, per
`docs/architecture/08-FEATURE-TEMPLATE.md`; evidence at the end).

## Purpose

BASE-1 established *"the repository can recreate these objects."* BASE-1b
establishes *"the repository can recreate their intended security posture, and
every policy-less table is deliberately classified."*

The acceptance criterion is **zero unexplained tables**: every table in
`public` must have an explicit, documented, machine-checked access decision.
That does not mean zero policy-less tables — a server-only table legitimately
has no policy — but the decision must be made, written down, and enforced, not
inherited from a platform default.

## User

The engineer or security reviewer deciding whether a table may be reached with
the publishable (anon) key. Indirectly: every student whose data lives in these
tables.

## User Flow

1. A reviewer opens the posture table in this document (or runs
   `npm run rls:audit`) and sees every public table with its RLS state, policies,
   client privileges, access model and rationale.
2. A contributor creates a table in a new migration. If they do not classify it
   in `scripts/rls-posture.ts`, `npm test` fails with the table name.
3. CI runs the same check on every PR, so the posture cannot drift.

## Screens

N/A — no product surface.

## Routes

N/A — no HTTP surface.

## Components

N/A — no frontend components.

## User Actions

N/A.

## Button Logic

N/A.

## Data

Every table in `public` after all migrations (35 tables), with the intended
posture. "Client" means the `anon` and `authenticated` roles that reach the
database through PostgREST with the publishable key; `service_role` is the
server and always bypasses RLS.

| Table | RLS | Policies | Client privileges (intended) | Access model / decision |
|---|---|---|---|---|
| `profiles` | on | own select/insert/update, staff update | authenticated: select, insert, update | Owner-scoped. Browser reads and updates the signed-in student's own row. |
| `service_requests` | on | own insert/select, staff read/update | authenticated: select, insert, update | Owner-scoped (students) + staff read/update. |
| `student_notifications` | on | 4 owner + staff insert | authenticated: select, insert, update, delete | Owner-scoped (NTF-1). |
| `student_saved_items` | on | 4 owner | authenticated: select, insert, update, delete | Owner-scoped. |
| `student_cgpa_courses` | on | 4 owner | authenticated: select, insert, update, delete | Owner-scoped. |
| `student_cgpa_terms` | on | 4 owner | authenticated: select, insert, update, delete | Owner-scoped. |
| `student_security_events` | on | owner select/insert | authenticated: select, insert | Owner-scoped. |
| `cbt_attempts` | on | own select | authenticated: select | Owner-scoped; attempt creation, answering and submission go through RPCs. |
| `institutions` | **enable** | public read (`using (true)`) | anon + authenticated: select | Public-read. School finder/detail pages read it directly; writes are service-role only. |
| `service_catalog` | on | public read | anon + authenticated: select | Public-read (active services). |
| `cbt_exams` | on | public read (active) | anon + authenticated: select | Public-read (active exams). |
| `news_articles` | on | public read (published) | anon + authenticated: select | Public-read of published rows only. |
| `opportunities` | on | public read (active) | anon + authenticated: select | Public-read of active rows only. |
| `student_wallets` | **enable** | none | none | **Server-only. Financial data.** Written by `handle_new_user()` and wallet RPCs; the app has no balance UI, so no client role may read it. |
| `student_wallet_transactions` | on | owner select (kept in history) | none | Server-only until a wallet UI exists; the owner policy is deliberately not granted. |
| `payment_events` | on | none | none | Server-only (payment idempotency). |
| `admin_audit_logs` | on | none | none | Server-only (audit trail). |
| `edureach_audit_logs` | on | none | none | Server-only (legacy audit trail). |
| `rate_limit_hits` | on | none | none | Server-only. |
| `site_analytics_events` | on | none | none | Server-only; analytics arrive through the API, not PostgREST. |
| `news_sources`, `news_ingest_runs`, `news_ingest_candidates` | on | none | none | Server-only (newsroom pipeline). |
| `edureach_deadlines`, `edureach_exams` | on | none | none | Server-only (read through the API). |
| `exam_questions` | on | deny-client policy | none | Server-only; the answer key must never be readable with the publishable key. |
| `past_questions` | on | own insert, entitlement select | none | Dormant. The entitlement policy is good, but no UI reads it; granting is a reviewed change when the page becomes real. |
| `edureach_material_notes` | on | 4 owner | none | Dormant (no application reference). |
| `cbt_answers` | on | own select | none | Dormant for clients; attempts/explanations flow through RPCs. |
| `campus_posts` | on | own insert | none | Legacy/dormant Campus Feed. Deny clients until the feed is revived with a read/moderation policy set. |
| `campus_post_comments`, `campus_post_likes` | **enable** | none | none | Legacy/dormant. Never had RLS or a policy. |
| `resources` | **enable** | insert (history) | none | Dormant. See the storage coupling in Edge Cases. |
| `courses` | **enable** | none | none | Dormant; the CGPA calculator stores its own courses per student. |
| `edureach_notifications` | **enable** | staff insert (history) | none | Legacy; superseded by `student_notifications` and NTF-1's owner-scoped model. |

## Data Source

**Why the "six tables" discrepancy, and what the real number is.** BASE-1's
finding 7 said *six* tables carry no policy in the repository (`courses`,
`resources`, `campus_post_comments`, `campus_post_likes`, `student_wallets`,
`edureach_notifications`), and the review added `campus_posts` and
`past_questions` — eight names. Both lists are imprecise, and the truth is only
visible in a database, because RLS and policies are partly created dynamically.

Verified on the replayed schema (`npx tsx scripts/rls-posture.ts`):

- **7 tables have RLS disabled**: `campus_post_comments`, `campus_post_likes`,
  `courses`, `edureach_notifications`, `institutions`, `resources`,
  `student_wallets`. With Supabase's default table grants to `anon`/`authenticated`,
  each of these is reachable through PostgREST today; four of them are protected
  only by the absence of an explicit grant, which is not a protection at all.
- **14 tables have zero policies**: the four above with neither
  (`campus_post_comments`, `campus_post_likes`, `courses`, `student_wallets`)
  plus ten server-only tables that are RLS-protected by having no policy.
- **3 tables have policies that never run** because RLS is off: `institutions`,
  `resources`, `edureach_notifications` (`campus_posts` was in this group until
  the baseline enabled RLS on it).
- `campus_posts` and `past_questions` are *not* policy-less: both have policies,
  and the baseline enabled RLS on both. They belong in the review because their
  intent was never stated in one place, not because they are unprotected.
- The definition that makes BASE-1's list correct is **"no effective policy"**:
  four tables with no policy, plus two whose only policy could never run. That is
  the six; the eight came from mixing that list with the baseline's separate
  list of tables whose RLS was never enabled.

So: **six was the right count for one property, eight was the right set of
tables that needed a decision, and neither is a substitute for the classification
below.**

## Backend

Enforcement is three files, in order:

1. **`supabase/ci/platform-shims.sql`** now models the worst case that production
   can present: Supabase's permissive bootstrap grants (`grant usage on schema
   public`, `alter default privileges ... grant all on tables/sequences to anon,
   authenticated, service_role`). Without this the replay could not tell a table
   protected by an explicit `revoke` from one protected only by a platform
   default. With it, every table created by a migration starts reachable, and only
   our own SQL can restrict it.
2. **`supabase/migrations/20260930200000_rls_posture.sql`** applies the table
   above: `enable row level security` where it is missing, explicit `grant` for
   the client-facing verbs of client-facing tables, explicit
   `revoke all ... from anon, authenticated, public` for everything else, and
   `alter default privileges ... revoke all on tables, sequences from anon,
   authenticated` so **future** tables are fail-closed rather than silently
   exposed. Every statement is idempotent; nothing is dropped, no data is
   touched, no policy is removed (the dormant policies stay in the history and
   simply have no grant to act on).
3. **`scripts/rls-posture.ts`** holds the classification as data, one record per
   table with `access`, `browser`, grants and `why`, and audits a schema against
   it (`npm run rls:audit` — it audits the replayed schema in-process; the same
   queries run against a hosted project with `psql`). `tests/rls-posture.test.ts` replays
   all migrations and asserts that the database matches the classification and
   that nothing is unclassified.

The rule for `browser: true` is narrow: the table is read or written by a module
that imports the browser Supabase client (`src/lib/supabase.ts`). Everything else
is server-only or dormant. That is why several tables with perfectly good owner
policies (`past_questions`, `cbt_answers`, `student_wallet_transactions`,
`edureach_material_notes`) get no grant: no client code path uses them, so
granting would create exposure without a feature.

## Security

- **The concrete risk closed:** `student_wallets` had RLS disabled and no policy.
  On a project where the transport grants are the Supabase default, any holder of
  the publishable key could have read every student's balance. It now has RLS
  enabled and no client privileges at all.
- **Defence in depth:** a table is protected by both a missing/limited grant and
  by RLS. Either layer alone would be a single point of failure.
- **`service_role` is unaffected** — the server, the storage service and
  `security definer` functions keep working; the replay proves it by signing up a
  user through the `auth.users` trigger and asserting the profile and wallet rows
  are created.
- **No weakening:** no policy is deleted, no `using (true)` is added, no
  `authenticated` grant is widened beyond the verbs the existing policies allow.
- **The publishable key is not a secret.** The posture is designed on that
  assumption, which is why "the client never asks for that table" is not treated
  as protection.

## States

- **Classified**: the table appears in `scripts/rls-posture.ts` and matches.
- **Unclassified**: `npm test` fails naming the table — a new migration cannot
  land without a decision.
- **Drifted**: the database contradicts the classification (an extra grant, RLS
  turned off, a policy removed) — the same test fails with the difference.

## Edge Cases

| Case | Behaviour |
|---|---|
| A future migration creates a table and forgets the posture | The test fails with the table name; the default-privileges revoke means it is also fail-closed in production, so the mistake is loud rather than silent |
| A future migration adds a policy but no `grant` | The test reports the missing client privileges for that table |
| A future migration drops RLS from a classified table | The test fails: `access.rls` is true but the database says otherwise |
| Storage policies that reference dormant tables | `storage.objects` policies for the campus and resources buckets sub-select `campus_posts`/`resources`, so revoking client SELECT makes those storage reads fail **if a client ever uses those buckets**. Nothing does today (the app only touches storage server-side, for `admin-content`). Reviving either feature requires the table grants and the policy work together — recorded in `docs/architecture/02-DATA-MODEL.md`. |
| The project already has RLS on and grants in place | Every statement is idempotent; the migration only narrows what the table above says must be narrow |
| Objects created by `supabase_admin` rather than the migration role | The `alter default privileges` covers the role migrations run as; the parallel `supabase_admin` default cannot be changed from a migration and is documented as residual |
| A dormant table later gets a UI | Add the grant plus the policy in the same migration, update the classification, and the test keeps the two in step |

## Analytics

N/A — no product events.

## Notifications

N/A — no product notifications. `edureach_notifications` is classified as legacy
precisely because the notification model is NTF-1's owner-scoped
`student_notifications`.

## Testing

`tests/rls-posture.test.ts` (new), against the replayed schema:

- every table in `public` is classified — the failure message lists the
  unclassified names;
- every classified table exists;
- the database matches each classification: RLS state, and the exact set of
  `select`/`insert`/`update`/`delete` privileges for `anon` and `authenticated`;
- **no table grants a client role any privilege while RLS is disabled** — the one
  invariant that makes every other check meaningful;
- client-facing tables have at least one policy;
- named high-risk assertions: `student_wallets`, `payment_events` and
  `admin_audit_logs` grant nothing to `anon`/`authenticated`;
  `institutions`/`opportunities`/`news_articles`/`service_catalog`/`cbt_exams`
  grant `select` only;
- the signup trigger still provisions a profile and a wallet row with the
  tightened posture (proves `service_role`/`definer` paths are untouched);
- **enforcement, not just catalog state**: the replay switches to the API roles
  (`set role anon|authenticated` with `request.jwt.claim.sub`, as PostgREST sets
  it) and asserts that anon can read the public catalogue but not write it, that
  anon and authenticated are refused on `student_wallets`, that a student sees
  exactly their own notification and profile and no rows belonging to another
  student, and that updating another student's profile matches nothing.

## Evidence

Produced 2026-09-30 on `arena/01a0f3bd-edureach-hub`.

**The reconciliation, before anything changed.** Computed on the replayed schema
rather than by grepping the migration text (which misses dynamically created
policies): 7 tables had RLS disabled, 14 had zero policies, and 3 had a policy
that could never run. `campus_posts` and `past_questions` — the two names added
in review — both had policies and RLS enabled by the baseline, so they were never
policy-less; they needed a decision, not a fix. BASE-1's "six" was the right
count for *no effective policy*; the review's "eight" was the right set of tables
needing a decision. The derivation is in §Data Source.

**What changed.**

| File | Change |
|---|---|
| `supabase/ci/platform-shims.sql` | Reproduces Supabase's permissive default grants (`grant usage on schema public`, `alter default privileges ... grant all on tables/sequences to anon, authenticated, service_role`). Without this the replay could not distinguish "protected by an explicit revoke" from "protected only because the shim granted nothing". |
| `supabase/migrations/20260930200000_rls_posture.sql` | The posture itself: RLS enabled on the 7 tables that lacked it; explicit `select` for the 5 public-read tables; the verbs the existing policies cover for the 8 owner-scoped tables; `revoke all ... from anon, authenticated, public` with no client grant for the remaining 22; default privileges narrowed so future tables are fail-closed; and a closing assertion that fails the migration if any client-reachable table still has RLS off. Idempotent; no drops; no policy removed; no data touched. |
| `scripts/rls-posture.ts`, `scripts/replay.ts` | The classification (35 tables) and the audit that compares it with a database; shared replay helper. `npm run rls:audit`. |
| `tests/rls-posture.test.ts` | 6 tests: classification completeness, catalog agreement, the RLS-off invariant, named high-risk tables, enforcement as `anon`/`authenticated`, and signup provisioning. |
| `tests/migrations.test.ts` | Now uses the shared replay helper instead of its own copy. |

**Before → after** (`npm run rls:audit` against the replayed schema):

| State | Result |
|---|---|
| Before BASE-1b | **57 findings** — `student_wallets`, `courses`, `campus_post_comments`, `campus_post_likes`, `campus_posts`, `resources` client-reachable with RLS disabled; 4 tables with a client grant and no policy at all; `institutions`, `resources`, `edureach_notifications` carrying policies that could never run |
| After BASE-1b | **0 findings** — 35 public tables, 35 classified, database matches |

**Enforcement, not just catalog state.** With `set role anon|authenticated` and
`request.jwt.claim.sub` set the way PostgREST sets it:

| Check | Result |
|---|---|
| `anon` reads `service_catalog` | 22 rows — public read works |
| `anon` reads `student_wallets` / `student_notifications` / `admin_audit_logs` | `permission denied for table ...` |
| `anon` inserts or updates `service_catalog` | `permission denied` |
| `authenticated` reads its own notifications | 1 row |
| `authenticated` reads another user's notifications | 0 rows |
| `authenticated` reads another user's profile | 0 rows |
| `authenticated` updates another user's profile | 0 rows matched |
| `authenticated` reads or updates `student_wallets` | `permission denied` |
| Signup through the `auth.users` trigger (two accounts) | profile row + wallet row created for both |

The last row is the proof that tightening posture did not break the
service/definer paths: `handle_new_user()` writes `profiles` and
`student_wallets`, and both are now closed to client roles.

**Local gate.** `npm run typecheck` clean; `npm test` 245/245; `npm run
schema:audit` exit 0 ("no blocking findings"); `npm run build` clean; `npm run
rls:audit` 35/35 classified, 0 findings.

**CI.** The same gate runs on the branch's pull request (`EduReach production
checks` → `quality-gate` → `npm run ci`), so the posture test gates every change
from this commit on.

**Known limitations.**

1. The audit models the *most permissive* platform default, so it can only be
   stricter than a given project, never more permissive — it errs closed.
2. PostgreSQL keeps a parallel default-ACL entry for `supabase_admin` that a
   migration cannot change. Objects created as that role are outside this
   control; nothing in this repository creates tables that way.
3. No hosted project was audited here (no credentials in this environment). The
   same queries in `scripts/rls-posture.ts` can be run against one with `psql`.
4. Enforcement is exercised as roles in the replay, not through Supabase's
   PostgREST/JWT path.
5. Dormant tables are kept, not dropped; their historical policies stay and
   become effective only after a deliberate grant.
