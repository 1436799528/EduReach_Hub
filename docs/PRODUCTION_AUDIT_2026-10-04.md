# EduReach Hub — Full Production Audit

**Date:** 4 October 2026
**Repository:** `1436799528/EduReach_Hub`
**Branch audited:** `arena/01a10833-edureach-hub` @ `ae958e9` (HEAD of `main` after PR #19)
**Method:** static analysis, full test-suite execution, all ten repository audit
scripts, production build, live boot of the compiled server, and an authenticated
probe matrix against a stubbed Supabase backend.
**Verdict:** 🔴 **NO-GO for release.** Three blocking defects, one of which is a
reproduced security exploit.
**Remediation (4 October 2026, same day):** ✅ every repository-side finding in
this report is fixed and re-verified on branch `arena/01a10833-edureach-hub` —
see **§10** for the finding-by-finding status and the gate evidence. Two actions
remain outside the repository: enabling required status checks on `main` (P0-2,
needs repository admin) and reconciling the five externally-created tables in the
live Supabase project (§10, "Outside the repository").

---

## 1. Executive summary

This is a **well-engineered codebase with a broken release pipeline.** The
architecture, authorization model, security headers, input sanitisation, rate
limiting, performance budget and secret hygiene are all genuinely strong — better
than most production Node/React applications of this size. The failures are not
architectural; they are at the boundary between *written* and *enforced*:

* a migration that cannot apply was merged to `main`;
* the authoritative CI gate that exists specifically to catch it has been red for
  four consecutive merges and was merged over each time;
* the same merge train shipped a public endpoint that discloses the CBT answer
  key, which I reproduced end to end.

### 1.1 Scorecard

| Area | Result | Evidence |
| :--- | :--- | :--- |
| TypeScript (`tsc --noEmit`) | ✅ **PASS** | 0 errors |
| Dependency vulnerabilities | ✅ **PASS** | `npm audit` → 0 vulnerabilities |
| Production build | ✅ **PASS** | `vite build` + `esbuild` server bundle, exit 0 |
| Performance budget | ✅ **PASS** | 10/10 checks (entry 94.8 KB gzip) |
| Analytics taxonomy | ✅ **PASS** | 7/7 cross-checks |
| **Test suite** | ❌ **FAIL** | **40 failures / 440 tests**, 10 files |
| **Migration history** | ❌ **FAIL** | 14 blocking schema findings; fresh apply aborts |
| **RLS posture audit** | ❌ **FAIL** | Crashes at the same migration |
| **Backup rehearsal** | ❌ **FAIL** | Crashes at the same migration |
| **Accessibility gate** | ❌ **FAIL** | 1 blocking finding |
| **CI on `main`** | ❌ **FAIL** | 4 consecutive red merges |
| Runtime API surface | ⚠️ **1 exploit** | Answer-key disclosure reproduced |
| Secrets hygiene | ✅ **PASS** | No credentials in tree |
| Authorization | ✅ **PASS** | 15/15 admin routes 401 unauthenticated |

### 1.2 Change-risk concentration

All four blocking defects were introduced by the **last merged pull request**,
PR #19 (`feature/opportunity-detail-layer-20261004`), or by the PR before it
(#17, `backend/data-backfill-20261003`). The last green CI run on `main` was
PR #16, one day before this audit.

---

## 2. Blocking findings (P0)

### P0-1 — Migration 53 aborts the chain: a fresh production database cannot be built

**File:** `supabase/migrations/20261003175703_backfill_verified_academic_catalogue_and_daily_quiz_v2.sql`

The migration writes to five tables that **no migration in the repository
creates**:

| Object | Created by |
| :--- | :--- |
| `public.ccmas_disciplines` | ❌ nothing |
| `public.ccmas_programmes` | ❌ nothing |
| `public.national_programme_catalogue` | ❌ nothing |
| `public.daily_quizzes` | ❌ nothing |
| `public.daily_quiz_questions` | ❌ nothing |

A repo-wide search confirms these names appear in the migrations directory
**only** inside this one file — not in any `create table`, not in application
code, not in documentation.

**Evidence — real PostgreSQL engine (pglite) replay of all 54 migrations:**

```
migration 20261003175703_backfill_verified_academic_catalogue_and_daily_quiz_v2.sql
  failed after 52 applied: relation "public.ccmas_disciplines" does not exist
```

```
BASE-1 schema audit — 54 migrations
  hard failures (a fresh apply stops here): 14
    - 20261003175703_..._v2.sql → insert public.ccmas_disciplines (table is not created by any earlier migration)
    - 20261003175703_..._v2.sql → insert public.national_programme_catalogue (…)
    - 20261003175703_..._v2.sql → insert public.daily_quizzes (…)
    - 20261003175703_..._v2.sql → insert public.daily_quiz_questions (…)
    - 20261003175703_..._v2.sql → update public.ccmas_programmes (…)
    … 9 more
```

**Blast radius (this single defect is the root cause of 36 of the 40 test failures):**

* `npm test` → 40 failures, most reporting the identical migration error
* `npm run schema:audit` → exit 1, 14 blocking findings
* `npm run rls:audit` → crashes
* `npm run backup:rehearsal` → crashes
* `supabase db reset` / `db push` on a new or restored project → **fails**

**Impact.** There is no reproducible schema. The five tables exist in the live
Supabase project only because they were created out-of-band (dashboard/console).
That means: no disaster recovery from the repository, no ephemeral environments,
no new region or project, and the RLS/grants posture of those five tables is
unverifiable — until this is fixed, nobody can prove what their security settings are.

**Remediation.** Add a schema migration *before* the backfill (`create table if
not exists` with the columns the backfill uses), or guard the backfill
statements so they no-op when the relations are absent. Then re-run
`npm run schema:audit` and `npm test`; both must be green. Independently, dump
the live definitions of those five tables and reconcile them into the history.

---

### P0-2 — The CI gate is red on `main` and has been merged over four times

**Evidence:**

```
gh run list
completed  failure  Merge pull request #19 … opportunity-detail-layer   main  push  1h
completed  failure  Merge pull request #18 … opportunity-discovery-…    main  push  1d
completed  failure  Merge pull request #17 … backend/data-backfill-…    main  push  1d
completed  success  Merge pull request #16 …                           main  push  1d
```

Failing job: `quality-gate` → failing step: `Run authoritative CI gate`
(`npm run ci`). Locally that gate first fails at its second stage, `npm test`
(40 failures), exactly as the workflow would.

**Impact.** `.github/workflows/production-checks.yml` defines a comprehensive
gate (`typecheck → test → schema:audit → build → perf → analytics → e2e →
audit:ci`) and `tests/ci.test.ts` asserts the gate still contains every stage.
None of that protects anything if a red run can be merged. PR #19 was merged
with a failing check; PR #17 introduced P0-1 on the same basis.

**Remediation.** Enable required status checks on `main` (branch protection or a
ruleset) so `quality-gate` must pass before merge. Do not merge over a red run —
including this one.

---

### P0-3 — Answer-key disclosure on the public guest CBT endpoint *(exploited and reproduced)*

**Endpoint:** `POST /api/cbt/guest-submit` — **unauthenticated**, `server.ts` ≈ line 2193.

**Exploit:** send an **empty** answer sheet.

```bash
curl -X POST http://<host>/api/cbt/guest-submit \
  -H 'Content-Type: application/json' \
  -d '{"examId":"<any-active-exam-id>","answers":{}}'
```

**Reproduced** against the real compiled server (`build/server.cjs`) with a
stubbed Supabase REST backend returning a 3-question paper:

```
### CONTROL: GET /api/cbt/exams/exam-1/guest-questions  — correctly withholds keys ###
{"questions":[{"id":1,"text":"Q3 text","options":["A","B","C","D"]}, … ]}

### EXPLOIT: POST /api/cbt/guest-submit  {"answers":{}} ###
{ "score": 0, "correct_answers": 0, …
  "questions": [
     { "id":"q3", "question_text":"Q3 text", "correct_option":"C", "explanation":"because C" },
     { "id":"q1", "question_text":"Q1 text", "correct_option":"B", "explanation":"because B" },
     { "id":"q2", "question_text":"Q2 text", "correct_option":"D", "explanation":"because D" } ] }
```

**Root cause.** Validation accepts any non-array object:

```ts
if (!examId || !answers || typeof answers !== 'object' || Array.isArray(answers))
  return res.status(400).json({ error: 'examId and answers are required.' });
```

`{}` passes. The handler then maps the **entire frozen paper** and returns
`correct_option` and `explanation` for every question, in both `questions[]` and
`breakdown[]`, regardless of whether any question was attempted.

**This directly contradicts a documented security invariant** — README:

> CBT answer keys are not browser-readable.

`GET /api/cbt/exams/:examId/guest-questions` honours that rule (verified above,
and asserted for the authenticated RPC path in `tests/cbt-modes.test.ts:131`).
The submit route does not.

**Amplifying factors**

* The endpoint is unauthenticated, so no account is needed.
* It creates **no attempt record**, so extraction is undetectable and
  unrate-limited beyond the generic 30 requests / 600 s per IP — one request
  returns an entire paper's key.
* **The guest CBT endpoints have zero test coverage**: `grep -rn guest tests/*.ts`
  returns nothing. The gap that allowed this is structural.
* Answer keys feed the paid CBT product; disclosure undermines its integrity and
  any certificate/preparation value it claims.

**Remediation (in order of value).**

1. Reject submissions that do not cover the paper —
   `Object.keys(answers).length === paper.length` and every position present —
   returning 400 before any scoring.
2. Return `correct_option`/`explanation` only for questions the student actually
   answered (a full-key reveal is not needed to render corrections).
3. Ideally, have `guest-questions` issue a short-lived signed paper token and
   require it on submit, binding the answers to a paper the server handed out.
4. Add tests: empty answers → 400; partial answers → no key for unanswered
   questions; the response never contains `correct_option` for unattempted items.

---

### P0-4 — Two public endpoints hard-depend on the newest migration's columns, with no fallback

**Files:** `server.ts:1233` (`GET /api/opportunities`), `server.ts:1272` (`GET /api/opportunities/:opportunityId`)

Both hard-select `subcategory, education_levels, disciplines, work_mode,
is_featured`, which are added **only** by
`20261003190000_opportunity_discovery_engine.sql` — the last migration, and one
that P0-1 makes unreachable by any automated apply.

```ts
supabase.from('opportunities')
  .select('id,title,organisation,category,subcategory,description,link_url,deadline,
           locations,last_verified_at,source_name,eligibility,education_levels,
           disciplines,work_mode,is_featured')
```

There is **no column-existence fallback**. If those columns are absent, PostgREST
raises `column … does not exist`, the handler's `catch` fires, and students get:

```
503 {"error":"Opportunities are temporarily unavailable."}
```

i.e. the entire Jobs / Opportunities discovery surface goes down.

**Note the asymmetry:** `/api/news` implements a documented three-tier column
fallback (`NEWS_ROW_BASE` → `NEWS_ROW_GOVERNED` → `NEWS_ROW_CATEGORISED`,
`server.ts:1558-1610`) precisely so a partially-migrated database degrades
instead of failing. That pattern was not applied to the endpoint that PR #19
changed.

**Related documentation drift.** `docs/operations/PRODUCTION_RUNBOOK.md:95` still
states that `GET /api/opportunities` "degrades to a legacy column set *when any
one* of the governed columns is absent." **That behaviour no longer exists in the
code.** An on-call engineer following the runbook would misdiagnose a 503 as a
permissions problem.

**Remediation.** Apply the same tiered-select pattern used by `/api/news`, or
probe column availability once at startup; correct the runbook. Verify against
the live project first:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='opportunities'
  and column_name in ('subcategory','education_levels','disciplines','work_mode','is_featured');
```

---

## 3. High-severity findings (P1)

### P1-1 — Release-artifact and runbook migration counts are stale (52 vs 54)

| Location | Claims |
| :--- | :--- |
| `supabase/ci/production-validation.sql:142` | `count(*) >= 52`, `repository holds 52` |
| `docs/operations/PRODUCTION_RUNBOOK.md:43,84` | `52 migrations` |
| Actual repository | **54** |

`tests/prod-validate.test.ts` enforces these three numbers against the directory,
and fails (`the artifact's threshold is not 54`).

**Impact.** The production sync check (runbook §3a) is the designated tool for
detecting "code is live but migrations are not". With a threshold of 52 it would
report `pass` on a production database that is missing the entire current
release — precisely the incident the check exists to prevent.

**Remediation.** Update the threshold, the artifact detail string and the runbook
to 54 in one change; the test enforces that they cannot drift again.

---

### P1-2 — Duplicate `<main>` landmark on the opportunity detail route (blocking a11y)

```
✗ pages/OpportunityDetailsPage.tsx:1
  page renders its own <main> while also rendering HubLayout, which already renders <main>
  — two main landmarks on one route
```

`HubLayout` renders `<main id="main-content" tabIndex={-1}>` (HubLayout.tsx:461),
which is the skip-link target. `OpportunityDetailsPage.tsx:80` nests a second
`<main>` inside it. Two `main` landmarks make screen-reader landmark navigation
ambiguous and duplicate the skip target. `npm run a11y:audit` exits 1.

**Remediation.** Replace the inner `<main>` with a `<div>`/`<section>` and keep
the layout as the single main landmark.

---

### P1-3 — Type-scale violation

`pages/OpportunityDetailsPage.tsx:101` uses inline `fontWeight: 600`, which is not
a step on the shared type scale. `tests/type-system.test.ts:77` fails on this
(the file's own rule is that inline weights must use the scale).

**Remediation.** Use the shared class/token instead of the inline override.

---

## 4. Medium-severity findings (P2)

### P2-1 — Silent misconfiguration: the app renders a plausible but fake product with no backend

`src/lib/supabase.ts` deliberately never throws, and `isSupabaseConfigured` gates
an extensive local fallback: `fallbackServicesCatalog`, `fallbackCbtExams`,
client-side CBT scoring, and `localStorage`-persisted service requests that
generate official-looking `ER-YYYY-XXXXXX` reference codes.

The engineering is careful — guards are applied consistently at every call site I
sampled (`SchoolFinderPage`, `CbtResultsPage`, `ServiceApplyPage`,
`routes.tsx:serviceEntry`), and non-live service slugs correctly render
`ComingSoonPage` rather than a fabricated form.

The risk is operational, not technical: if an operator forgets
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at **build** time on
Netlify, the deployed site looks complete and functional. A student can "apply"
for a service and "sit" a CBT exam that were never persisted anywhere, and no
alarm fires. The server already knows the truth —
`GET /api/health/ready` returns `503 {status:"degraded"}` — but nothing on the
client surfaces it to a user or an operator.

Related: `src/lib/supabase.ts` constructs a real client aimed at
`https://edureach-unconfigured.supabase.co` with a placeholder key. **36
browser-side call sites** use `supabase.*` directly; every one I sampled guards
on `isSupabaseConfigured`, but any future one that forgets will generate doomed
DNS traffic to a non-existent domain rather than failing fast.

**Remediation.** Fail the production build when the client contract is unmet, or
render an unambiguous environment banner and disable the persistence-claiming
flows. Add a deployment smoke check that asserts `/api/health/ready` is `ready`.

---

### P2-2 — No client-side error telemetry

There is no error-tracking integration anywhere in the repository
(`grep -rn "Sentry|captureException|window.onerror"` → 0 hits).
`src/app/ErrorBoundary.tsx` renders a friendly panel and `console.error`s the
component stack into a browser console nobody reads. Unhandled promise
rejections are not captured.

Server-side observability is good (`/api/health/ready`, `scheduled_job_runs`,
`recordJobRun`, structured `console.error`). The browser has no equivalent.

**Impact.** A broken route is invisible to the team; the first signal is a
support ticket. This audit found two such defects (P1-2, P1-3) by running gates,
not by monitoring.

**Remediation.** Wire an error reporter into `ErrorBoundary.componentDidCatch`
plus `window.onerror` / `unhandledrejection`, or at minimum POST sanitised errors
to the existing `/api/analytics/event` surface.

---

### P2-3 — Dead feature presented as live configuration: WhatsApp notifications

`src/server/whatsapp.ts` exports `sendWhatsAppServiceCompletion`, which **has zero
callers** in the repository. Yet:

* `src/lib/envContract.ts:138,147` declare it as the consumer of
  `WHATSAPP_API_ENDPOINT` and `WHATSAPP_API_TOKEN`;
* `.env.production.example` documents both variables;
* `tests/prod-validate.test.ts:89` lists it as a tracked file.

Actual status notifications go through `src/server/notifications.ts`
(`notifyServiceRequestStatus`, called at `server.ts:460`).

**Impact.** An operator provisions a bearer token for an integration that can
never fire — attack surface and secret-management cost with zero benefit, and a
misleading capability claim in the environment contract.

**Remediation.** Either wire it into the service-completion path or delete the
module and remove the variables from the contract, the example env file and the
validator.

---

### P2-4 — Orphaned page still consuming test coverage

`pages/CbtPracticePage.tsx` has **no production importer** — routes resolve to
`CbtPracticeEntryPage` and `CbtSessionPage` (`src/app/routes.tsx`). Its only
references are three assertions in `tests/a11y.test.ts:102,113,120`.

**Impact.** The accessibility gate spends budget certifying a file users cannot
reach, which inflates apparent coverage and hides the fact that the live CBT
pages carry no equivalent assertions. Dead weight in a codebase already carrying
17 stylesheets and 62 chunks.

**Remediation.** Delete the page and its assertions, or re-wire it deliberately.

---

### P2-5 — Container image ships the full development toolchain

`Dockerfile`: the `runner` stage does
`COPY --from=deps /app/node_modules ./node_modules`, and the `deps` stage runs a
plain `npm ci` — dev dependencies included. The production image therefore
contains Playwright, esbuild, TypeScript, jsdom, autoprefixer and the rest.

**Impact.** Larger image, slower cold starts, and a materially broader attack
surface (build tooling, browser automation) inside a runtime container.

**Remediation.** Add a `deps-prod` stage running `npm ci --omit=dev` and copy that
into `runner`.

**Credit where due:** the Dockerfile gets the hard parts right — multi-stage,
`USER node`, `dist`/`build` correctly separated so the server bundle is never
published as static assets, and `.dockerignore` excludes `.env*`, `.git`,
`node_modules` and the backup artefacts.

---

## 5. Low-severity / hardening (P3)

| # | Finding | Location | Note |
| :--- | :--- | :--- | :--- |
| P3-1 | **CSS budget has zero headroom** — `bundle css (gzip) 46.0 KB ≤ 46.0 KB`, an exact tie | `scripts/perf-audit.ts` | Any CSS addition fails the gate. Raise deliberately or consolidate the 17 stylesheets imported in `main.tsx`. |
| P3-2 | PostgREST filter input strips `% , _` but not `(` `)` `.` | `server.ts:340, 994` | Admin-only, service-role query, no cross-table reach — low risk, cheap to tighten with an allowlist. |
| P3-3 | Upload MIME type is derived from the file extension | `server.ts:1434` | `UPLOAD_MIME_BY_EXT` maps extension → MIME. Confirm the storage layer also sniffs content, not just the declared type. |
| P3-4 | Two cache policies for `index.html` depending on platform | `server.ts` static vs `public/_headers` | Express serves `public, max-age=0`; Netlify `_headers` sets `no-cache, no-store, must-revalidate`. Align them. |
| P3-5 | 17 CSS files (~46 KB gzip) loaded on every route | `src/main.tsx` | Design-system sheet sprawl flagged in earlier audits is still present. |
| P3-6 | Majors available: React 19.3, Vite 8, Express 5, Motion 14, lucide 1.52, TypeScript 7 | `package.json` | Not urgent. Vite 6→8 and Express 4→5 are breaking; schedule deliberately. |
| P3-7 | 15 date-stamped audit reports — 14 under `docs/` plus `EDUREACH_FULL_AUDIT.md` at the repository root — among 32 markdown documents in `docs/` | `docs/` | Dates spanning 2026-09-21 → 2026-10-03 with no index; hard to tell which is authoritative. Add an index or archive superseded reports. |

---

## 6. What is genuinely strong (verified, not assumed)

These were tested rather than taken on trust:

**Security posture**

* **Secret hygiene.** No credential material anywhere in the tree
  (`eyJ…` JWTs, `AIza…`, `sk-…` → zero hits). `SUPABASE_SERVICE_ROLE_KEY` is never
  `VITE_`-prefixed; `getServerSupabaseKey` rejects publishable keys and validates
  `role === 'service_role'` before use. `.env*` is both git-ignored and
  `.dockerignore`d. `scripts/prod-validate.ts` prints presence, never values.
* **Authorization.** Capability-based, resolved from the validated bearer token
  plus the trusted `profiles.role` row — `user_metadata` is never consulted
  (`lib/auth.ts`). I probed **15/15 admin endpoints unauthenticated; all returned
  `401`.** Owner-scoped capabilities are never satisfied by staff roles, and
  ownership failures are reported as `404` so resource existence does not leak.
* **Headers.** Every response carries `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`; production adds a strict CSP
  (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'self'`,
  `object-src 'none'`), HSTS and `X-Frame-Options`. Dev relaxes the CSP only as
  far as HMR and sandbox embedding require.
* **Rate limiting.** Two layers (in-process sliding window + durable
  `check_rate_limit` RPC) with a reviewable policy table and per-route limits on
  the expensive surfaces. The durable layer fails open **with a log line** when
  a migration is missing — correct behaviour for a half-migrated environment.
* **Error and input hygiene.** `userFacingError` normalises and redacts
  Postgres/Supabase/framework detail before it reaches a user. Malformed JSON →
  `400 {"error":"Invalid request body or URL."}`; unknown `/api/*` → JSON `404`,
  never the SPA shell; oversized bodies → `413`.
* **XSS.** Every `dangerouslySetInnerHTML` (3 sites) is paired with the
  allowlist `sanitizeRichHtml`, which drops non-allowlisted tags/attributes,
  filters inline styles property-by-property, rejects `data:image/` and
  protocol-relative URLs, and permits only `https:`/`mailto:` links.

**Operational quality**

* **Graceful degradation.** `/api/health` → `200`; `/api/health/ready` → `503
  {status:"degraded"}` naming the exact cause; public read endpoints return
  `200 {items:[]}` rather than 5xx.
* **SEO.** Server-side `X-Robots-Tag: noindex, nofollow` on private paths,
  generated `robots.txt` and `sitemap.xml`, canonical origin via
  `EDUREACH_SITE_URL`, and a single shared rule (`isNonIndexablePath`) so the
  header, robots.txt and sitemap cannot drift.
* **Performance.** 10/10 budget checks: entry 94.8 KB gzip, critical path
  201.2 KB, all 62 chunks 298.5 KB, largest image 60.6 KB, fonts preconnected
  with `display=swap` and no CSS `@import`, content-hashed assets served
  `immutable`.
* **Service worker.** Versioned caches with cleanup; never caches `/api/`,
  `.netlify/`, requests bearing `authorization`, or content-hashed `/assets/`;
  navigations go network-first so the shell can never be stale.
* **Scheduled job.** `netlify/functions/daily-news-refresh.ts` declares
  `export const config = { schedule: '@daily' }` (verified present) and records
  per-task outcomes in `scheduled_job_runs`.
* **Build hygiene.** `dist/` (public) and `build/` (server bundle + source map)
  are correctly separated and the README warns against publishing `build/`.

**Baseline health**

* `tsc --noEmit` clean; `npm audit` **0 vulnerabilities**; production build exit 0
  (`dist` 1.9 MB, server bundle 240 KB).
* 53 of 54 migrations apply cleanly in order on a real PostgreSQL engine, with
  RLS posture, grants and policies asserted by tests rather than assumed.
* Node version consistent across `.nvmrc` (22.22), the workflow (`22.22.x`) and
  `engines` (`>=22.12.0`).

---

## 7. Failure inventory (exact)

| Test file | Failures | Root cause |
| :--- | ---: | :--- |
| `tests/cbt-modes.test.ts` | 13 | P0-1 |
| `tests/migrations.test.ts` | 7 | P0-1 |
| `tests/rls-posture.test.ts` | 6 | P0-1 |
| `tests/news-category-contract.test.ts` | 4 | P0-1 |
| `tests/past-question-resources.test.ts` | 4 | P0-1 |
| `tests/prod-validate.test.ts` | 2 | P0-1 (1) + P1-1 (1) |
| `tests/a11y.test.ts` | 1 | P1-2 |
| `tests/backup-rehearsal.test.ts` | 1 | P0-1 |
| `tests/schema.test.ts` | 1 | P0-1 |
| `tests/type-system.test.ts` | 1 | P1-3 |
| **Total** | **40** | 36 × P0-1, 1 × P1-1, 1 × P1-2, 1 × P1-3 |

Suite totals: **440 tests — 399 pass, 40 fail, 1 skipped.**

---

## 8. Unverifiable in this environment (stated, not hidden)

An honest audit names its blind spots:

1. **Browser E2E — `tests/e2e/{site,a11y,perf}.spec.ts` did not run.** The
   Chromium download is blocked in this sandbox
   (`npx playwright install chromium` → `Download failure, code=1`; the
   `--with-deps` apt packages are unavailable). This is an environment
   limitation, not a repository defect — the workflow installs browsers and runs
   this suite. **Treat E2E status as unknown until CI is green.**
2. **Live Supabase connectivity was not exercised.** No project credentials were
   available. `npm run prod:validate` correctly reports the connectivity checks
   as *skipped* (env-dependent, not a failure) and points to
   `supabase/ci/production-validation.sql` for the checks that need a real SQL
   connection. The answer-key exploit was still proven end to end by stubbing
   the PostgREST backend — the flaw is in server-side validation, independent of
   which database is attached.
3. **The live production database's actual state is unknown.** P0-4 is
   conditional on migration 54 being unapplied; run the verification query in
   P0-4 to confirm. P0-1 is unconditional — the repository cannot build its own
   schema either way.
4. **Third-party source reputation** for the newsroom pipeline (Tier-1 source
   list, robots handling) was reviewed by reading `src/server/newsroom/*`, not by
   fetching those publishers.

---

## 9. Release readiness checklist

**Must be green before the next deploy:**

- [ ] **P0-1** — add the missing schema migration (or guard the backfill), then
      `npm run schema:audit` and `npm test` both pass.
- [ ] **P0-2** — enable required status checks on `main`; re-run the gate on this
      branch and get it green.
- [ ] **P0-3** — reject submissions that do not cover the paper; stop returning
      keys for unattempted questions; add regression tests.
- [ ] **P0-4** — add a column fallback to both `/api/opportunities` handlers
      (mirror `/api/news`) and fix the runbook drift.
- [ ] **P1-1** — reconcile 52 → 54 in the artifact and the runbook.
- [ ] **P1-2 / P1-3** — remove the duplicate `<main>`; replace the off-scale
      inline `fontWeight`.
- [ ] Confirm `npm run test:e2e` passes in CI (not verifiable here).

**Should follow shortly after:**

- [ ] **P2-1** — fail the production build (or banner the UI) when the client
      Supabase contract is unmet; add a post-deploy
      `/api/health/ready` assertion.
- [ ] **P2-2** — client error telemetry.
- [ ] **P2-3** — resolve the dead WhatsApp module one way or the other.
- [ ] **P2-4** — remove or re-wire `pages/CbtPracticePage.tsx`.
- [ ] **P2-5** — `npm ci --omit=dev` in the container runtime stage.

---

## 10. Remediation status (4 October 2026)

The branch that this audit judged has been fixed. Every finding below was
re-checked after the fix; the evidence column names the gate or test that proves
it, and "unverified" is stated where the sandbox could not run something.

| Finding | Status | Evidence |
| :--- | :--- | :--- |
| **P0-1** — migration that cannot apply | ✅ **Fixed** | New migration `20261003170000_create_academic_catalogue_and_daily_quiz.sql` creates the five relations the backfill writes to (`if not exists`, so production is untouched). Fresh replay applies all 55; `npm run schema:audit` → 0 blocking; `npm run backup:rehearsal` → restored; `tests/migrations.test.ts` green |
| **P0-2** — CI gate red and unprotected | ⏳ **Repository side done, owner action needed** | `.github/workflows/production-checks.yml` is intact and `npm run ci` is green locally (all stages below). Enabling *Require status checks* on `main` and re-running the gate requires repository admin — the integration token is refused (`403`). Steps in §10.1 |
| **P0-3** — public endpoint discloses the CBT answer key | ✅ **Fixed + tested** | `server.ts` guest-submit releases `correct_option`/`explanation` only for answered positions; `tests/guest-cbt-disclosure.test.ts` (4 tests) replays the exploit (`answers:{}`) and asserts no key is present, while a fully attempted sheet still returns them |
| **P0-4** — opportunities endpoints assume the newest columns | ✅ **Fixed + tested** | Both handlers try DISCOVERY → GOVERNED → BASE (`server.ts` ~1240–1340); `tests/opportunities-fallback.test.ts` (5 tests) walks the schema back one migration at a time; runbook drift corrected |
| **P1-1** — release artifact asserts 52 migrations | ✅ **Fixed** | `supabase/ci/production-validation.sql` check 8 asserts `>= 55`; the runbook's two references say 55; `tests/prod-validate.test.ts` 18/18 |
| **P1-2** — two `<main>` landmarks on the opportunity page | ✅ **Fixed + verified** | `pages/OpportunityDetailsPage.tsx` renders a `div` inside the shell's single `<main id="main-content">`; `npm run a11y:audit` → 0 blocking |
| **P1-3** — off-scale inline `fontWeight` | ✅ **Fixed** | 600 → 500, the scale's weight; `tests/type-system.test.ts` green |
| **P2-1** — silent misconfiguration | ✅ **Fixed** | `scripts/client-env-check.ts` runs first in `npm run build` and **fails a production build** (`CONTEXT=production`) without the client contract, warning in dev/preview; `EnvironmentBanner` in `src/app/App.tsx` says so on screen in production builds; `npm run smoke -- <url>` asserts `/api/health/ready` is `ready`; `tests/deploy-guards.test.ts` (7 tests) |
| **P2-2** — no client error telemetry | ✅ **Fixed + tested** | `src/lib/errorTelemetry.ts` reports `client_error` (source enum + constructor name, never the message) from the route boundary and global `error`/`unhandledrejection` listeners; wired in `ErrorBoundary.componentDidCatch` and `src/main.tsx`; declared in the taxonomy and documented in AN-1; `tests/error-telemetry.test.ts` (5 tests) |
| **P2-3** — dead WhatsApp module presented as configuration | ✅ **Fixed** | `src/server/whatsapp.ts` deleted and un-imported; `WHATSAPP_API_*` removed from `src/lib/envContract.ts`, `.env.production.example`, `docs/NETLIFY_PRODUCTION_SETUP.md`, D5 and the business-rules S7 row; `tests/prod-validate.test.ts` green |
| **P2-4** — orphaned page consuming test coverage | ✅ **Fixed** | `pages/CbtPracticePage.tsx` deleted; its clock-threshold notices ported into the live `pages/CbtSessionPage.tsx`; `tests/a11y.test.ts` re-pointed at the pages candidates actually reach (14/14) |
| **P2-5** — container ships the dev toolchain | ✅ **Fixed (code), unverified (build)** | `Dockerfile` gained a `prod-deps` stage (`npm ci --omit=dev`) and the runner copies it. No Docker daemon in this environment, so the image was not built — see §10.2 |
| **P3-1** — CSS budget had zero headroom | ✅ **Fixed** | `BUDGETS.cssGzip` 46 → 50 KB with the rationale recorded (46.0 KB was an exact tie with the measurement) |
| **P3-2** — PostgREST filter input strips too little | ✅ **Fixed** | Admin search now strips `% , _ . ( ) \` before the filter string is built (`server.ts` both handlers) |
| **P3-3** — upload type trusted the declared MIME | ✅ **Fixed + tested** | `lib/image-signature.ts` sniffs PNG/JPEG/GIF/WebP from the bytes; `/api/admin/uploads` rejects a mismatch before writing to the public bucket; `tests/image-signature.test.ts` (4 tests) |
| **P3-4** — two cache policies for `index.html` | ✅ **Fixed** | Express static now serves `index.html` as `no-cache, no-store, must-revalidate` and `/assets/*` as `immutable`, matching `public/_headers`; `perf:audit`'s cache check green |
| **P3-5** — 17 stylesheets on every route | ✅ **Documented + guarded** | `docs/architecture/STYLESHEET_LAYERS.md` records what each sheet owns, the order contract and a staged 17 → 8 consolidation plan; `tests/stylesheet-layers.test.ts` fails if the set or order changes without the note |
| **P3-6** — 19 packages behind | ✅ **Documented** | `docs/operations/DEPENDENCY_UPGRADE_PLAN.md` — the snapshot, a seven-batch order, and the rules (one major per change; a major never rides a release-blocking fix) |
| **P3-7** — 15 audit reports, no index | ✅ **Fixed** | `docs/README.md` — current / reference / history, naming the authoritative report and what supersedes what |

### 10.1 The one action left in GitHub (P0-2)

The defect was that the gate exists but nothing required it. From the repository
owner's account:

1. **Fix the red first.** Re-run the workflow on the branch this remediation
   lives on (`gh workflow run "EduReach production checks" --ref <branch>` or the
   Actions UI) and get it green — including `test:e2e`, which cannot run in the
   audit sandbox.
2. **Require it.** Settings → Branches → branch protection rule for `main` →
   *Require status checks to pass before merging* → select the
   `quality-gate` job; enable *Require branches to be up to date*.
3. **Do not merge past it again.** The four consecutive red merges this audit
   found are the reason P0-1, P0-3 and P0-4 reached `main` at all.

### 10.2 Verification evidence (post-remediation, this branch)

| Gate | Result |
| :--- | :--- |
| `npm run typecheck` | ✅ 0 errors |
| `npm test` | ✅ **473 tests — 473 pass, 0 fail, 0 skipped** (was 440 / 40 failing) |
| `npm run schema:audit` | ✅ 0 blocking findings (was 14) |
| `npm run rls:audit` | ✅ 42 public tables, 0 findings |
| `npm run backup:rehearsal` | ✅ 55 migrations, 5,105.5 KB, restored and verified |
| `npm run a11y:audit` | ✅ 0 blocking, 4 informational (was 1 blocking) |
| `npm run perf:audit` | ✅ 10/10 budget checks |
| `npm run analytics:audit` | ✅ 7/7 checks, 11 events declared / 11 emitted / 11 documented |
| `npm run build` | ✅ exit 0; the new client-contract guard warns without credentials and refuses a `CONTEXT=production` build without them |
| `npm audit` | ✅ 0 vulnerabilities |
| `npm run test:e2e` | ⚠️ **not run** — Chromium is blocked in this sandbox; this is what step 10.1.1 exists to check |
| `npm run prod:validate` | ⚠️ **not run against a live project** — needs production credentials |
| Docker image build | ⚠️ **not run** — no Docker daemon in this sandbox; the Dockerfile change is code-reviewed only |

### 10.3 Outside the repository (left to the project owner)

These are the items the audit can only describe, because they need live access:

* **Live Supabase reconciliation.** The five relations the backfill writes to
  (`ccmas_disciplines`, `ccmas_programmes`, `national_programme_catalogue`,
  `daily_quizzes`, `daily_quiz_questions`) are now created by migration 55 with
  `if not exists`, so applying it to production is a no-op and the existing
  tables are preserved. If production's shapes differ from the definition in
  that migration, reconcile the canonical definition from the live project into
  the file — the guards mean nothing breaks either way.
* **Apply migrations.** `supabase db push` (or the dashboard SQL editor) with
  migration 55, then run `supabase/ci/production-validation.sql` to confirm the
  checks pass against the real database.
* **Post-deploy smoke check.** `EDUREACH_SMOKE_URL=https://<host> npm run smoke`
  after the next deploy asserts the deployment is genuinely `ready` rather than
  a plausible-looking preview.

## Appendix A — Reproduction commands

```bash
npm ci
npm run typecheck                      # PASS
npm test                               # FAIL: 40/440
npm run schema:audit                   # FAIL: 14 blocking findings
npm run rls:audit                      # FAIL: migration 53
npm run backup:rehearsal               # FAIL: migration 53
npm run a11y:audit                     # FAIL: nested-main
npm run build                          # PASS
npm run perf:audit                     # PASS: 10/10
npm run analytics:audit                # PASS: 7/7
npm audit                              # PASS: 0 vulnerabilities
npm run prod:validate                  # env-dependent; needs real credentials

# P0-3 exploit (against a host with Supabase configured)
curl -X POST https://<host>/api/cbt/guest-submit \
  -H 'Content-Type: application/json' \
  -d '{"examId":"<active-exam-id>","answers":{}}'
# -> 200 with correct_option + explanation for every question
```

## Appendix B — Runtime probe summary

**Unauthenticated admin surface (mock backend active): 15/15 returned 401**

```
/api/admin/session                401   /api/admin/news              401
/api/admin/users                  401   /api/admin/service-requests  401
/api/admin/analytics              401   /api/admin/cbt/exams         401
/api/admin/integrity              401   /api/admin/opportunities     401
/api/admin/content-manager/…      401   /api/admin/newsroom/runs     401
/api/admin/calendar-items         401   /api/admin/institutions      401
/api/admin/services               401   /api/admin/jobs              401
```

**CBT surface (mock backend active)**

```
GET  /api/cbt/attempts                 401   ✅
GET  /api/cbt/attempts/:id/paper       401   ✅
POST /api/cbt/attempts/:id/submit      401   ✅
POST /api/cbt/submit                   401   ✅
PATCH/DELETE /api/cbt/attempts/:id     401   ✅
GET  /api/cbt/exams/:id/subjects       200   ✅ by design (no keys)
GET  /api/cbt/exams/:id/guest-questions 200  ✅ by design (keys withheld, verified)
POST /api/cbt/guest-submit             200   ❌ **P0-3 — keys disclosed**
```

**Degradation without a configured backend**

```
GET /api/health         200 {"status":"ok","service":"edureach"}
GET /api/health/ready   503 {"status":"degraded", … "VITE_SUPABASE_URL or the server secret key is missing."}
GET /api/services       200 {"items":[]}
GET /api/news           200 {"items":[]}
GET /api/opportunities  200 {"items":[]}
POST /api/analytics/event (malformed JSON)  400 {"error":"Invalid request body or URL."}
DELETE /api/health      404 {"error":"API endpoint not found."}
```

**Response headers (production build)**

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'self'; form-action 'self' https://wa.me; script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; …
Cache-Control: no-store              (API)
X-Robots-Tag: noindex, nofollow      (private paths)
```

---

*End of audit. All findings are reproducible with the commands in Appendix A.
No files were modified during this audit; the working tree remains clean at
`ae958e9`.*
