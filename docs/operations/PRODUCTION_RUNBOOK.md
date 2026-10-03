# EduReach Hub — Production Runbook

The sequence for taking the verified codebase to a live site, and the checks at each
step. Written so that whoever performs it does not have to re-derive anything from
the code, and so that **no step is skipped silently**: each one states what to run
and what a pass looks like.

Nothing in this document has been executed against a production environment. There is
no deployed origin and no production credential in this repository's environment;
every step below is *prepared*, not *verified*. See
`docs/PRODUCTION_READINESS_AUDIT_2026-10-01.md`.

---

## 1. Provision the production Supabase project

Create the project, then record:

- project URL → `VITE_SUPABASE_URL`
- publishable (anon) key → `VITE_SUPABASE_PUBLISHABLE_KEY`
- secret / service-role key → `SUPABASE_SERVICE_ROLE_KEY`

**Pass:** the three values exist and are stored in the deployment platform's secret
store, never in the repository.

## 2. Set environment variables

Set every variable in the contract (`src/lib/envContract.ts`, summarised in
`docs/features/D5.md`). On Netlify, set them for both the **build** and the
**functions** scope — `VITE_*` is inlined at build time, the rest is read at runtime.

**Check:** `npm run prod:validate` with the variables exported locally. It prints each
variable's presence and never its value.

**Pass:** `every required environment variable is set — pass`. A `fail` here means the
site will not start correctly; do not continue.

> **Trap:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are server-side aliases. Setting
> only those leaves the browser bundle without a Supabase origin.

## 3. Apply the migrations

52 migrations in `supabase/migrations/`, applied in filename order. Use the Supabase
CLI against a **scratch project first**:

```bash
supabase link --project-ref <scratch>
supabase db reset          # applies every migration from empty
```

Compare the scratch project's `information_schema.columns` against production
before applying there; the baseline restores structure, and any column production
has that the repository has never seen is drift requiring a reviewed migration.

> **Take a backup first.** Causing a migration incident without one is the single
> most expensive mistake available in this document. See
> `docs/operations/BACKUP_AND_RESTORE.md` §4 (platform backup, or the `pg_dump`
> path if the plan's backup status is unknown) and record it in that document's
> evidence log.

**Pass:** `supabase db reset` completes with no error on the scratch project, then
the same history applies to production.

### 3a. The production sync check (run this when code is live but migrations are not)

On 2026-10-03 the merged application code was live in production while four
migrations were not applied. Nothing failed loudly: the news pages rendered, the
APIs answered `200`, and the *only* symptom was silently reduced data and two
endpoints returning `503`. Counting rows in the migration history is not enough —
it says how many migrations ran, not which. Check 9 of
`supabase/ci/production-validation.sql` now compares the exact release versions
and names every missing migration, including data-only migrations. Run it, then
apply every file named in its `detail` column. The four files reported during that
original incident were:

```
apply 20261002120000_cbt_practice_and_mock_modes.sql
apply 20261002130000_news_category_contract.sql
apply 20261002140000_past_question_resources.sql
apply 20261002150000_opportunity_eligibility.sql
```

**Pass:** check 9 prints `pass` and confirms all release migrations are recorded;
check 8 reports at least 52 recorded migrations.

### 3b. What “not applied” looked like from outside, on 2026-10-03

Recorded because each of these symptoms is easy to misread as something else. All
observations are from the public production API.

| Probe | Observed | Real meaning |
| --- | --- | --- |
| `GET /api/cbt/exams/<id>/subjects` | `503 {"error":"CBT subjects are temporarily unavailable."}` | `cbt_limits(body)` from `20261002120000` is missing. The route itself is fine. |
| `GET /api/past-questions/resources` | `503 {"error":"The resource library is temporarily unavailable."}` | `past_question_resources` from `20261002140000` is missing. |
| `GET /api/opportunities` | `200`, but every item lacks `last_verified_at`, `source_name`, `eligibility` | `20261002150000` is missing. The route degrades to a legacy column set *when any one* of the governed columns is absent, so provenance that already exists is dropped too. A newer migration can therefore make an older field disappear — the fallback is coarser than it needs to be. |
| `GET /api/news` | `200`, with `verification_status`, `source_key`, `source_tier` | `20260930120000_newsroom_ingestion_pipeline.sql` **is** applied. |
| `GET /api/news/<slug>` | `200`, `category_slug` equals the lowercased label (`"scholarships & funding"`) | the code's own fallback ran, i.e. that request asked for a column set without `category_slug`. |

> **Do not conclude a migration is applied from a list payload alone.** The news
> list and the article endpoint disagreed on the same article, because they select
> different column sets and have different fallbacks. Only check 9 answers the
> question. If a value looks impossible (a slug the canonical function cannot
> produce), treat the database as drifted and re-run check 9 before trusting it.

> The repository's own replay (`tests/migrations.test.ts`) proves the history applies
> to a real PostgreSQL engine and that the resulting objects behave — including
> calling `content_integrity_report()`, `prune_site_analytics_events()` and
> `scheduled_job_status()` against inserted rows. That is strong evidence and it is
> **not** a substitute for this step: PGlite is not Supabase Cloud, and the
> `auth`/`storage` surface there is a shim.

## 4. Verify the schema

Run the read-only validation SQL in the Supabase SQL editor:

```
supabase/ci/production-validation.sql
```

It prints `pass` / `fail` per check and mutates nothing. Check 9 is the migration
sync check described in §3a — run it first if you suspect production is behind.

**Pass:** no row prints `fail`. It covers expected tables, RLS enablement on every
public table, every function the application calls, function grants to `anon` /
`authenticated` (there must be none), server-only tables exposing no client policy,
storage buckets, and migration count.

## 5. Verify RLS behaviour

The static posture is already enforced (`npm run rls:audit`: 36/36 tables classified,
0 findings), and `tests/rls-posture.test.ts` proves the policies filter rows by
switching to `anon`/`authenticated` inside the replay. What the replay cannot do is
exercise the **JWT/PostgREST** path — which is how a real browser reaches the
database.

Do this against production with two real tokens (an anonymous publishable key and a
signed-in student):

- read a public table (`institutions`) anonymously → rows returned
- read `service_requests` anonymously → no rows, or only public reference lookups
- read another student's row while signed in → **no rows**
- read `site_analytics_events` and `scheduled_job_runs` while signed in → **no rows**

**Pass:** every expectation above holds. Any row returned where none should be is a
stop-the-line finding.

## 6. Verify storage

`npm run prod:validate` checks bucket existence *and* that each bucket has the read
access the application actually uses — the rule is declared once, in
`PUBLIC_BUCKETS` / `PRIVATE_BUCKETS` in `scripts/prod-validate.ts`, with the code
that depends on it named there. Then confirm, in the dashboard, the per-bucket
policies for upload, read, update and delete.

| Bucket | Read access | Why |
| --- | --- | --- |
| `admin-content` | **public** | Holds published news/featured images. `POST /api/admin/uploads` (admin-only, images ≤2 MB) returns `getPublicUrl(...)` and that URL is stored on the article row. Making it private would 404 every published image. |
| `resource-files` | **private** | Entitlement-gated past-question documents, signed for 300 s by `GET /api/past-questions/resources`. |
| `campus-uploads` | **private** | Campus post attachments. |

**Pass:** buckets exist, `admin-content` is public, `resource-files` and
`campus-uploads` are private, and policies are present for the roles that need them.

**If `admin-content` is reported private:** do not "fix" it by making it public
without checking, and do not make the private buckets public to match it. A private
`admin-content` breaks every news image; a public `resource-files` exposes gated
papers. Both are stop-the-line findings with different causes.

## 7. Seed required system data

Classify before inserting. **Do not insert fake student data, fake news, or fake
public opportunities into production.**

| Class | Examples | Action |
|---|---|---|
| **Required system data** | `service_catalog` rows, CBT exam configuration, `news_sources` | Seed deliberately and reproducibly; the application does not function without a service catalogue |
| **Operational content** | news, opportunities, question banks | Created through the admin console or the newsroom pipeline, never hand-inserted |
| **User-generated data** | profiles, service requests, CBT attempts, notifications, analytics | Never seeded. Created by real use |

The post-merge data-control migration (`20260927000000`) already removed prototype
news and deactivated demo CBT banks; nothing in the migration history inserts
student data.

**Pass:** the service catalogue is populated, and `content_integrity_report()` shows
no prototype content.

## 8. Resolve CBT coverage

`npm run prod:validate` calls `content_integrity_report()` and fails on:

- an active bank with **no** questions
- an active bank with a subject holding **fewer than 5** questions
- a question missing an answer option
- a question with an invalid correct answer

This is the data problem behind the student-facing *"This CBT is not ready yet"*
message. `get_cbt_questions_for_subjects` inner-joins on subject, so a bank with
hundreds of questions still returns nothing for a subject it does not cover — and
`fetchCbtExams` lists any active bank regardless.

For each finding, choose one: **add questions**, **fix the configuration**, or
**deactivate the bank**. Do not hide broken banks in the frontend.

**Pass:** `no active CBT bank is empty` and `no active CBT bank has a thinly covered
subject` both pass. The `subject_coverage` array in the report names the exact subject
and count for anything that does not.

## 9. Deploy the application

Netlify is the production architecture (`docs/features/D5.md`).

- build `npm run build`, publish `dist`, Node 22
- functions `netlify/functions`, `external_node_modules = ["express", "serverless-http"]`
- redirects and headers come from `netlify.toml` and `public/_headers`

**Pass:** the deploy succeeds and `/` returns the application.

## 10. Run smoke tests

See the smoke-test plan below. Use **dedicated test accounts and synthetic data
only** — no real student information, no publicly visible fake content, and nothing
that contaminates analytics beyond the test session.

**Pass:** every listed expectation holds.

## 11. Configure branch protection

The `quality-gate` check exists and runs on every push and pull request to `main`, but
nothing enforces it. This repository's token cannot read or write the setting
(`GET /branches/main/protection` returns **403 Resource not accessible by
integration**), so it must be done by a human with admin rights:

```
GitHub → Repository Settings → Branches (or Rulesets) → main
  → Require status checks to pass before merging
  → search for and add: quality-gate
```

Do not weaken or remove any required check to make a merge pass.

**Pass:** a deliberately failing branch cannot be merged.

## 12. Verify the scheduled jobs

Confirm the `@daily` newsroom refresh fired:

```
GET /api/admin/jobs        (requires analytics.read)
```

It returns last success, last failure, failure count and a `fresh` flag per job, plus
a `health` verdict that names jobs which are **missing** (never ran), **stale** (no
success within 48 hours) or **failing** (last failure newer than last success).

**Pass:** `newsroom-refresh` has a recent success. Then run the retention prune once
by hand to prove it works before scheduling it:

```bash
npm run analytics:retention -- --dry-run    # prints the window and cutoff, no writes
npm run analytics:retention -- --apply      # deletes rows older than 90 days
```

## 13. Verify alerting

**Current state: failures are recorded and visible in the admin console, but nothing
pushes an alert.** A failed job writes a `failed` row to `scheduled_job_runs` with a
truncated, secret-free error, and `/api/admin/jobs` reports it — but no notification
is sent anywhere.

Until OBS-1's alerting half exists, the operational substitute is an external uptime
check on `/api/health/ready` (it returns 503 when the database read fails) plus a
scheduled check of `/api/admin/jobs`. **Do not describe this as alerting**; it is
polling.

## 14. Verify production performance

Lab numbers from CI are regression protection, not field data. Once deployed:

- PageSpeed Insights API against the live origin, **three times**, recorded next to
  the deployment SHA
- CrUX history once the origin has traffic
- Search Console → Core Web Vitals for the URL groups

Record p75 **LCP, INP, CLS, TTFB** per URL group with the date and SHA. A number
without a SHA is not evidence. Never present the CI lab numbers as field numbers.

## 15. GO / NO-GO

GO requires every step above to pass, specifically:

- `prod:validate` reports no `fail`
- the production-validation SQL prints no `fail`
- the RLS spot-checks in step 5 all hold
- CBT coverage resolved
- smoke tests pass
- `quality-gate` required on `main`
- the daily job has a recorded success

---

## Smoke-test plan

Run against the live origin with test accounts only.

### Public

| Route | Expect |
|---|---|
| `/` | 200, hero and news feed render, no console error |
| `/news`, `/news/<slug>` | 200, article body and source attribution present |
| `/opportunities` | 200, no opportunity past its deadline shown as active |
| `/institutions`, `/schools/<slug>` | 200, institution details render |
| `/services` | 200, service catalogue lists configured services |
| `/tools` | 200, CGPA calculator usable |
| `/robots.txt` | 200, `text/plain`, private routes disallowed |
| `/sitemap.xml` | 200, `application/xml`, absolute URLs on the live origin |
| `/api/health` | 200 `{ "status": "ok", "service": "edureach" }` |
| `/api/health/ready` | 200 `ready`, with a database latency figure |

Check headers on any response: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
`Permissions-Policy`, `Strict-Transport-Security: max-age=31536000`, and a
`Content-Security-Policy` whose `script-src` contains neither `unsafe-inline` nor
`unsafe-eval`.

### Authentication

| Step | Expect |
|---|---|
| Signup with a test account | account created, profile row exists, verification email sent |
| Duplicate signup | rejected with a clear message, no second profile |
| Login with valid credentials | session created, dashboard reachable |
| Login with wrong password | rejected; no user-enumeration difference in the message |
| Repeated failed logins | rate limited |
| Password reset | email arrives, reset link works once |
| Expired / invalid reset link | refused with a safe message |
| Logout | session cleared; `/dashboard` redirects to sign-in |
| Protected route after logout | not accessible, including a direct API call |

### Student

| Step | Expect |
|---|---|
| `/dashboard` | academic info, services, saved items, CBT results, notifications render |
| Submit a service request | reference code returned, row owned by the student |
| Track by reference code | status shown, **no admin note and no other student's data** |
| Change a request's status as admin | student sees a notification; audit row written |
| Mark all notifications read | unread count clears |
| Start a CBT attempt | questions load, timer runs, answers persist on reload |
| Submit the attempt | score returned, result stored, answer key never sent to the client |
| Submit the same attempt twice | no duplicate attempt, same result |

### Admin

| Step | Expect |
|---|---|
| Admin login | console reachable |
| News | create, publish, correct, expire |
| Opportunities | create, close, verify expiry behaviour |
| Institutions | create and update |
| Services | edit the catalogue |
| Requests | status transitions; an illegal transition returns 409 |
| CBT | banks and questions manageable |
| Analytics | KPI grid, focus panel, search counts (never search terms) |
| `/api/admin/jobs` | job status and health verdict |
| Any admin route unauthenticated | **401**, not 403, with no data leaked |
| Any admin route as a student | **401/403** per ROLE-1 semantics |

### Cleanup

Delete the test accounts and any test service requests afterwards. Do not leave test
content publicly visible, and note in the record which analytics sessions were test
traffic.
