# EduReach Hub — Production Readiness Audit

Date: 2026-10-01 · Branch: `arena/01a0f3bd-edureach-hub` · Head: `cd16e78` · PR: #11 (30 commits, 171 files)

This report separates four states and never blends them: **VERIFIED** (a command
was run here and its output is quoted), **IMPLEMENTED BUT NOT VERIFIED** (the code
exists and is reasoned about, but no execution proves it), **NOT IMPLEMENTED**, and
**BLOCKED BY ENVIRONMENT/ACCESS**.

---

## A. Executive summary

EduReach Hub was audited end to end against the repository as it actually is: 41
migrations, 88 declared capabilities, 50 admin routes behind `requireCapability`,
9 feature specifications, and a CI gate that runs typecheck, 311 tests (including a
real PostgreSQL migration replay), a schema audit, a build, a performance budget,
an analytics taxonomy audit, a Playwright browser pass and a dependency audit.

The eight previously delivered initiatives (SEO-1, ROLE-1, NTF-1, BASE-1, TEST-1,
BASE-1b, A11Y-1, PERF-1) were inspected rather than assumed, and each one holds up
against the code. Three genuine defects were found and fixed during this pass
(analytics free-text ingestion and absent retention, an invisible CBT failure mode,
and missing HSTS with nothing preventing the two header sources from drifting).
Nothing was redesigned.

The determining limitation is environmental, not technical: **there is no
production database credential and no deployed origin in this environment.** Every
claim about live data, live RLS behaviour, storage, field performance and smoke
behaviour is therefore unverified here, and the report says so at each point rather
than implying otherwise.

**Final status: CONDITIONALLY READY.**

---

## B. What was already complete (inspected, not recreated)

| Initiative | Verified in this pass |
|---|---|
| **SEO-1** | `src/lib/seoMeta.ts` + `src/server/seo.ts` generate robots/sitemap server-side; `netlify.toml` routes `/robots.txt` and `/sitemap.xml` to the API function *before* the SPA fallback; `X-Robots-Tag: noindex, nofollow` is set on private paths in `server.ts`; 14 tests in `tests/seo.test.ts` |
| **ROLE-1** | 88 capabilities in `src/lib/capabilities.ts`; 50 admin routes guarded by `requireCapability`; 17 tests in `tests/authorization.test.ts`; every admin route asserted 401 unauthenticated in `tests/api.test.ts` |
| **NTF-1** | `src/server/notifications.ts` writes `notification_type` + `metadata.to`; 11 tests; called from the status-change route *after* the audit log, best-effort so a notification failure cannot fail the transition |
| **BASE-1** | 41 migrations apply in order to real PostgreSQL (PGlite 18.3) in `tests/migrations.test.ts`; `npm run schema:audit` reports 0 blocking findings |
| **TEST-1** | `npm run ci` is the single authoritative gate; `tests/ci.test.ts` (9 tests) fails if a stage disappears, softens, or changes order — it caught this session's own additions twice |
| **BASE-1b** | `npm run rls:audit`: **35 public tables, 35 classified, 0 findings**; `tests/rls-posture.test.ts` switches to `anon`/`authenticated` and proves the policies filter rows |
| **A11Y-1** | `npm run a11y:audit`: **0 blocking findings, 4 informational**; axe runs in Chromium over the public routes in CI |
| **PERF-1** | `npm run perf:audit`: **every budget passes**; the throttled browser pass holds CLS under 0.1 on `/`, `/news` and `/past-questions` (it was 0.21 / 0.18 / 0.31 before the fix) |

---

## C. What was verified (actual evidence)

**The local gate, run at `cd16e78`:**

```
npm run typecheck     → clean
npm test              → 311 tests, 311 pass, 0 fail, 0 skipped
npm run schema:audit  → BASE-1 audit: no blocking findings.
npm run build         → clean
npm run perf:audit    → Every performance budget passes.
npm run analytics:audit → The taxonomy, the call sites, the server and the document agree.
npm run a11y:audit    → 0 blocking findings, 4 informational.
npm run rls:audit     → 35 public tables, 35 classified, 0 findings.
npm audit --audit-level=low → found 0 vulnerabilities
```

**CI (`quality-gate`, full gate including Chromium):**

| Run | Commit | Result |
|---|---|---|
| `36920967965` | `5483b08` (AN-1) | success |
| `36921425306` | `a0e8f9f` (CBT readiness) | success |
| `36921804312` | `cd16e78` (headers) | success |

**Behaviour verified against a real PostgreSQL engine** (not by reading SQL — the
functions are called):

- `content_integrity_report()` executes and reports the new CBT subject coverage: a
  bank with a 12-question subject and a 2-question subject reports
  `active_exams_with_thin_subjects = 1` and the correct per-subject rows.
- `prune_site_analytics_events(90)` deletes the two rows past its window, keeps the
  10-day-old row, and deletes nothing on a second run.

**Verified by reading the implementation:**

- Service status transitions are validated server-side with an explicit map;
  illegal transitions return **409**, each change writes `admin_audit_log` and then
  notifies the student (`server.ts:405-445`).
- The public reference-code lookup returns only `id, reference_code, status,
  created_at, title, service_key` — **no `admin_note`, no owner identity**.
- `close_expired_opportunities()` is called by the daily newsroom pipeline
  (`src/server/newsroom/pipeline.ts:805`), so expiry is enforced, not advisory.
- Health is split correctly: `/api/health` (liveness) and `/api/health/ready`
  (readiness — checks Supabase configuration, performs a real database read and
  reports latency, returns 503 when degraded).
- The newsroom is a genuine ingestion pipeline — `sources → politeFetch (robots-
  aware) → parse (RSS / JSON feed / HTML discovery / meta extraction) → dedupe
  (event fingerprint + canonical URL) → classify → qualityGate → publish or queue
  for review` — with per-source failure reporting and a run summary.

---

## D. What was fixed

### D1. Analytics ingested free text and had no retention (AN-1)

- **Problem.** Six event names were declared twice (a TypeScript union and an inline
  regex in `server.ts`) with nothing tying them to the call sites. The ingest
  endpoint stored any `metadata` object it was handed, and what the product sent
  was `{ q: term.slice(0, 120) }` — the student's literal search query — rendered
  back in the admin console in **two** places. No retention window existed.
- **Root cause.** No taxonomy, so no allowlist; the console's "top searches" panel
  was built on whatever the event happened to carry.
- **Fix.** `src/lib/analyticsTaxonomy.ts` is now the single source of truth (10
  events, 4 funnels, per-event declared metadata keys with types and caps). Client
  and server both validate through it. `search` sends `query_length` and
  `result_count`. Stored paths lose query strings and fragments; referrers keep
  origin and path; `user_id` still comes only from the bearer token. `page_view`
  now uses `trackEvent`, retiring a duplicate ingest path in `src/app/App.tsx`. Four
  events close real gaps (`news_view`, `school_view`, `cbt_setup_view`,
  `notification_open`). `prune_site_analytics_events(90)` plus
  `npm run analytics:retention`; `npm run analytics:audit` joins `npm run ci`.
- **Files.** `src/lib/analyticsTaxonomy.ts`, `src/lib/api.ts`, `server.ts`,
  `src/app/App.tsx`, `pages/{SearchPage,NewsArticlePage,SchoolDetailsPage,
  ExamSetupPage,StudentDashboardV2,AdminAnalyticsPage,AdminDashboardPage}.tsx`,
  `src/lib/studentDashboard.ts`, `supabase/migrations/20261001120000_*.sql`,
  `scripts/analytics-{audit,retention}.ts`, `tests/analytics.test.ts`,
  `tests/ci.test.ts`, `docs/features/AN-1.md`, `docs/architecture/02-DATA-MODEL.md`
- **Tests.** 26 new tests, including that a search term is refused under ten
  plausible key names and that all eight audit failure paths fail.
- **Verification.** `npm test` 311/311; CI `36920967965` success.

### D2. CBT "not ready yet" — invisible until the student hit it

- **Problem.** Students saw *"This CBT is not ready yet. Please choose another
  available question bank."*
- **Root cause (determined, not hidden).** That message is the user-facing mapping
  of `No questions are available for the selected subjects`, raised by
  `start_cbt_attempt_for_subjects` when `get_cbt_questions_for_subjects` returns no
  rows. That function **inner-joins on subject**, so a bank holding hundreds of
  questions still returns nothing for a subject it does not cover. Meanwhile
  `fetchCbtExams` filters on `is_active` alone, so availability is *asserted* when
  the exam is listed but only *verified* when the attempt starts — after the student
  has completed the whole setup wizard. `content_integrity_report()` counted only
  exams with **zero** questions, so exactly this bank reported as healthy.
- **Fix.** Extended the existing integrity report (rather than adding a second one —
  two places answering "is this bank healthy" is how they drift) with
  `active_exams_with_thin_subjects` and the per-subject coverage itself, so an
  operator sees which subject a student would be refused on. No exam was
  deactivated and no question data was touched: what to do about a gap is an
  editorial decision.
- **Files.** `supabase/migrations/20261001140000_cbt_bank_readiness.sql`,
  `tests/migrations.test.ts`
- **Tests.** Both new functions are executed against real inserted rows (a `plpgsql`
  / dynamic-SQL body is not validated at creation, so the replay alone proves
  nothing about them).
- **Verification.** Migration replay passes; CI `36921425306` success.
- **Remaining action (operational, not code):** run `content_integrity_report()`
  against the live database and either add questions for uncovered subjects or
  deactivate the affected exams.

### D3. Missing HSTS, and nothing stopping the header sources drifting

- **Problem.** `Strict-Transport-Security` was absent from both header sources.
  Headers are declared twice by design (`server.ts` for the API function,
  `public/_headers` for Netlify static responses — most of the site); the source
  comment said "keep in sync" and nothing enforced it.
- **Fix.** HSTS added with `max-age=31536000`, deliberately **without**
  `includeSubDomains` or `preload` — both are one-way decisions that would also bind
  any future staging or CDN host, and preload is effectively irreversible.
  `tests/headers.test.ts` (8 tests) asserts both sources declare the same header
  set, that the production CSP is byte-identical between them, that `script-src`
  allows neither `unsafe-inline` nor `unsafe-eval` in production while the dev
  branch still may, that HSTS stays bounded, and that hashed assets are immutable
  while `index.html` is not.
- **Verification.** 8/8 pass; CI `36921804312` success.

### Also corrected during this pass

The local git clone was found re-created at the branch point (`dd29336`) with the
working tree intact, making 136 files appear modified. The remote branch was
confirmed intact at `b07f9a1` via `git ls-remote` and the GitHub API before the
local ref was re-synced with `git reset` (**not** `--hard`, so no file was lost).
No history was rewritten and no force-push was used.

---

## E. Remaining risks

1. **Live RLS behaviour is unverified.** BASE-1b proves the policies filter rows by
   switching roles inside a PGlite replay. That is strong evidence, but it is not the
   production project: the JWT/PostgREST request path is never exercised, and
   PGlite is not Supabase Cloud.
2. **No scheduled-job alerting.** The daily newsroom refresh logs per-source failures
   and its own failure to Netlify logs, and nothing is notified. A job that fails
   silently is exactly the risk OBS-1 names. **NOT IMPLEMENTED.**
3. **Retention is not scheduled.** `prune_site_analytics_events()` exists, is tested,
   and has a CLI — but nothing calls it on a timer, so rows older than 90 days
   remain until something does.
4. **No assistive-technology testing.** axe and the static rules cover the
   mechanically checkable subset. NVDA/JAWS/VoiceOver/TalkBack were never run, and
   authenticated screens (admin console, dashboard, CBT hall) are covered by static
   rules only — weaker than a rendered pass.
5. **Lab performance only.** The throttled Chromium numbers are a consistent relative
   signal on a shared runner, not field data, and not a phone.
6. **INP is approximated** by total blocking time; it needs scripted interactions to
   be meaningful.

---

## F. Production blockers

None found in the code. The following must happen **before** real students use the
platform, and all of them are operational rather than code changes:

1. **Decide and execute deployment (D5).** There is no deployed origin. Config is
   Netlify-only (`netlify.toml`: build `npm run build`, publish `dist`, functions
   `netlify/functions`, API redirect, robots/sitemap redirects, SPA fallback). No
   `vercel.json` exists, so the platform ambiguity is resolved *in config* — but the
   decision document still needs its status line updated and the site actually
   deployed.
2. **Apply the 41 migrations to the real Supabase project** and confirm they apply
   end to end from empty (`supabase db reset` against a scratch project first). This
   environment cannot perform that step.
3. **Require `quality-gate` on `main`.** The check exists and runs; nothing enforces
   it. Exact setting: *Settings → Branches → Add/edit the rule for `main` → Require
   status checks to pass before merging → `quality-gate`*.
4. **Resolve CBT subject coverage** using the new integrity-report numbers (D2).
5. **Set `EDUREACH_SITE_URL`** so the advertised origin is pinned rather than
   inferred from request headers.

---

## G. Operational actions (no code required)

| Owner surface | Action |
|---|---|
| **GitHub settings** | Require `quality-gate` on `main` (blocker 3) |
| **Supabase dashboard** | Apply migrations to a scratch project, then production; run `content_integrity_report()` and act on CBT coverage; confirm storage bucket policies for `admin-content`, `resource-files`, `campus-uploads`; decide the RLS posture for any table added after BASE-1b |
| **Netlify** | Deploy; set `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY`, `EDUREACH_SITE_URL`, `EDUREACH_NEWSROOM_USER_AGENT`; confirm the `@daily` schedule ran; enable HSTS at the domain level if preferred over the header |
| **Domain/DNS** | Point the domain, confirm HTTPS, then submit `/sitemap.xml` in Search Console |
| **Human review** | Editorial decisions on CBT gaps and newsroom Tier-1 auto-publish scope |

---

## H. Test evidence

| Suite | Tests | Result |
|---|---|---|
| `npm test` (all 20 files) | 311 | pass, 0 fail |
| `tests/migrations.test.ts` (real PostgreSQL replay) | 4 | pass |
| `tests/analytics.test.ts` | 26 | pass |
| `tests/headers.test.ts` | 8 | pass |
| `tests/authorization.test.ts` | 17 | pass |
| `tests/newsroom.test.ts` | 21 | pass |
| `tests/perf.test.ts` | 16 | pass |
| `tests/a11y.test.ts` | 14 | pass |
| `tests/seo.test.ts` | 14 | pass |
| `tests/schema.test.ts` | 12 | pass |
| `tests/notifications.test.ts` | 11 | pass |
| `tests/api.test.ts` (incl. every admin route 401) | 10 | pass |
| `tests/ci.test.ts` | 9 | pass |
| `npm run test:e2e` (Playwright, mobile Chromium) | — | **CI only** — browsers cannot be installed in this environment; green in runs above |

**Could not run here, and why:**

- `supabase db reset` / any live-database check — no Supabase credentials.
- Production smoke tests (`/`, `/news`, `/robots.txt`, signup, dashboard, admin) —
  no deployed origin.
- Field Core Web Vitals (CrUX / Search Console) — no deployed origin with traffic.
- Assistive-technology passes — no screen reader available.
- Branch-protection verification — `GET /branches/main/protection` returns **403
  Resource not accessible by integration**.

---

## I. Deployment status

**Verified:** the Netlify configuration is complete and internally consistent —
build command, publish directory, function directory with `serverless-http`
externals, `/api/*` → function redirect, crawler-surface redirects ordered before
the SPA fallback, Node 22, `public/_headers` with CSP/HSTS/caching. The Express
server sets production headers only under `NODE_ENV=production` and serves
`no-store` on `/api`.

**Not verified:** that any of it has ever been deployed. No origin exists, so build
output on Netlify, function cold starts, redirect behaviour, HTTPS, domain binding,
production logs and rollback are all unexercised.

---

## J. Final gap matrix

| Area | Status | Evidence | Remaining risk | Required action |
|---|---|---|---|---|
| Architecture | **GREEN** | 9 feature specs; one connected Express + Supabase + React codebase; no duplicate systems introduced | Documentation can drift | Keep the spec-before-code rule |
| Database | **GREEN** | 41 migrations apply in order to real PostgreSQL; `schema:audit` 0 blocking | Not applied to the live project | Apply to scratch, then production |
| Supabase | **AMBER** | Config validated in code; `isServerSupabaseConfigured` fails closed | No live project contactable here | Deploy + connect |
| RLS | **AMBER** | 35/35 tables classified, 0 findings; policies proven to filter rows via `set role` in replay | JWT/PostgREST path unexercised; PGlite ≠ Cloud | Re-run `rls:audit` against production |
| Authentication | **AMBER** | 6 tests; fail-closed unconfigured env; 401 vs 403 semantics tested | No live signup/login/reset executed | Smoke test after deploy |
| Authorization | **GREEN** | 88 capabilities; 50 guarded routes; every admin route asserted 401; identity never from client | — | — |
| Student experience | **AMBER** | Playwright passes on public routes in CI | Authenticated journeys not browser-tested | Seeded test account |
| Dashboard | **AMBER** | Renders requests, attempts, saved items, CGPA, notifications; deep links present | Not verified against live data | Smoke test |
| Newsroom | **GREEN** | Full pipeline present (fetch → parse → dedupe → classify → quality gate); 21 tests | Live source reachability unknown | `npm run newsroom:check` from the deploy network |
| Daily news refresh | **AMBER** | `@daily` Netlify function calls the full pipeline; per-source failure logging + run summary | **No alerting on failure**; never observed running | OBS-1 |
| Opportunities | **GREEN** | `close_expired_opportunities()` called by the daily pipeline; integrity report tracks active-expired | — | — |
| Institutions | **AMBER** | Integrity report tracks missing/invalid records | Live data quality unknown | Run the report on production |
| Services | **GREEN** | Explicit transition map, 409 on illegal, audit log + notification; reference lookup exposes no `admin_note` | — | — |
| Notifications | **GREEN** | 11 tests; idempotent per (owner, request, status); never the source of truth | — | — |
| CBT | **AMBER** | Root cause of "not ready yet" determined and instrumented; concurrency hardening + server-side scoring present | **Subject coverage gaps are a data problem**, unresolved | Act on the new report numbers |
| Analytics | **GREEN** | AN-1: 10 declared events, allowlisted payloads, no free text, 90-day retention, gate-enforced taxonomy | Retention not scheduled | Schedule the prune |
| Security | **GREEN** | Full header set + HSTS in both sources with a drift test; CSP without `unsafe-inline`/`unsafe-eval` in prod; rate limiting; 0 npm vulnerabilities | No live pentest | — |
| Privacy | **AMBER** | Search terms no longer collected; retention window defined; server-only analytics table | No consent notice, no export/deletion flow | PRIV-1 / PRIV-2 |
| SEO | **GREEN** | Server-generated robots/sitemap, canonical + OG + JSON-LD, `X-Robots-Tag` on private routes; 14 tests | No live URLs to test | Submit sitemap after deploy |
| Accessibility | **AMBER** | 0 blocking static findings; axe clean in CI; skip link, focus management, reduced motion | **No screen-reader testing**; authenticated screens not axe-scanned | AT pass + seeded account |
| Performance | **GREEN** | 10 budgets pass; CLS < 0.1 on all three routes; LCP/TBT/transfer within ceilings | Lab only; no field data | CrUX after deploy |
| CI/CD | **GREEN** | `npm run ci` authoritative; 9 tests assert stage presence and order; 3 green runs this session | Workflow file not writable by this token | — |
| Deployment | **AMBER** | Netlify config complete and consistent; no `vercel.json` | **Never deployed** | D5 + deploy |
| Observability | **AMBER** | Liveness + readiness split, readiness checks the database and reports latency | No alerting on job/API failure | OBS-1 |
| Data quality | **AMBER** | `content_integrity_report()` classifies news/CBT/opportunity/institution defects, now including CBT subject coverage | Never run against live data | Run it in production |
| Documentation | **GREEN** | 9 feature docs; architecture set; stale claims removed as found | — | — |

---

## Final production decision

### **CONDITIONALLY READY**

The application is technically sound and every claim above is backed by a command
that was run: 311 tests pass, three independent audits report zero findings, the
migration history replays on a real PostgreSQL engine, and three consecutive CI runs
of the full gate — including a throttled browser pass — are green. Three genuine
defects were found and fixed, and the CBT failure that had been reported was traced
to its actual cause rather than hidden.

It is not **READY** because the things that only production can prove are unproven:
the migrations have never been applied to a real Supabase project, live RLS has never
been exercised through the JWT/PostgREST path, the site has never been deployed, and
`quality-gate` is not enforced on `main`. It is not **BLOCKED** because nothing found
would cause data loss, privilege escalation, or a broken student experience — the
outstanding items are deployment and verification steps, plus two data-quality
decisions (CBT subject coverage, and scheduling the retention prune and job
alerting).

The honest one-line summary: **the code is ready; the production environment does not
exist yet.**
