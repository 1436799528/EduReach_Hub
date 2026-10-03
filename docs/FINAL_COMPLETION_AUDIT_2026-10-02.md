# EDUREACH FINAL COMPLETION AUDIT

Date: **2026-10-02** · Audited tree: `aa60b5386a7129ab5266ff56ebe10f5a73c74b57` (`main`, merge of PR #11)
Audit branch: `arena/01a0fe6f-edureach-hub` · Working tree: clean (no source, migration, config or data change made during this audit)

Evidence labels used throughout: **VERIFIED** (a command or live request was run and its output is the basis of the claim), **NOT VERIFIED** (the check could not be performed; the missing dependency is named), **BLOCKED** (the check is impossible from this environment by design or permission). Nothing is reported as verified on the basis of a previous audit.

---

## 1. Executive Status

- **Current commit:** `aa60b5386a7129ab5266ff56ebe10f5a73c74b57` (`main`, merged 2026-10-01T22:27:49Z, PR #11).
- **Current branch:** audit work is on `arena/01a0fe6f-edureach-hub`; `main` is at the commit above and unmodified.
- **Overall release classification:** **CONDITIONALLY READY**.
- **Major blockers:** none confirmed. No defect found in this pass makes a critical journey unusable or creates a confirmed data/security breach.
- **Major unresolved risks (all operational rather than code):**
  1. Recovery is undocumented and untested — no backup, rollback or restore procedure exists anywhere in the repository (CRIT-1).
  2. The production validation gate contains an internal contradiction that, if followed as written, breaks public image serving (CRIT-2).
  3. The scheduled newsroom job has never been observed running, job health has no console surface, and there is no alerting of any kind (HIGH-2).
  4. `main` is not protected (`"protected": false`), so the green quality gate is not enforced (HIGH-1).
  5. Public content and copy make assurance claims the data does not support (ToS/Privacy consent with no such pages; "checked" opportunities with `last_verified_at = null`) (HIGH-3, HIGH-4).
- **What is genuinely complete:** the Netlify production site is live and healthy at `https://edureachhub.netlify.app` (HTTPS, API healthy, Supabase connected, database read 355 ms); the local gate is green (346/346 tests, schema/RLS/analytics/a11y/performance audits clean, `npm audit` 0 vulnerabilities); the newsroom, CBT bank, services catalogue, news, institutions and upcoming-deadline APIs all serve real governed data; authorization is server-derived with ownership checks and 401/403 semantics; no secret is committed; the public news, article, opportunity, search, sitemap/robots and 404 journeys work.
- **What remains unfinished:** authenticated journeys (registration, verification, login, profile, dashboard, service submission, CBT attempt) have never been exercised against production; live RLS/storage policies are unverified through the real JWT/PostgREST path; analytics retention is not scheduled; global search omits institutions; there is no self-service account deletion or data export; support is a WhatsApp link and a "coming soon" page; Firefox/Safari and assistive-technology behaviour is untested.

---

## 2. Audit Coverage

Inspected in this pass:

| Area | What was actually inspected |
|---|---|
| Baseline | Branch, commit, tree status, remote, PR #11 metadata, merge-commit check-runs and statuses, repository deployments, branch protection, rulesets, workflow file |
| Documentation | `docs/features/D5.md`, `docs/PRODUCTION_READINESS_AUDIT_2026-10-01.md`, `docs/DEPLOYMENT_DECISION.md`, `docs/operations/PRODUCTION_RUNBOOK.md` (§1–15 + smoke plan), `docs/operations/OBSERVABILITY.md`, `docs/NETLIFY_PRODUCTION_SETUP.md`, `docs/ADMIN_CONTROL_CENTRE_MAP.md` headings, `docs/DATABASE.md` excerpt, audit reports of 21/24/25/26/27/29 September |
| Backend | `server.ts` (health, analytics, admin users, service requests, CBT start/submit/progress, news, services, upcoming, uploads, content manager, newsroom, integrity, robots/sitemap), `lib/auth.ts`, `lib/authorization.ts`, `lib/rate-limit.ts`, `lib/errors.ts`, `lib/supabase-config.ts`, `src/server/jobRuns.ts`, `src/server/notifications.ts`, `src/server/seo.ts`, `src/server/whatsapp.ts` (unused), `src/server/newsroom/*` |
| Frontend | `src/app/App.tsx`, `routes.tsx`, `ProtectedRoute.tsx`, `Playwright` specs, `index.html`, `public/_headers`, key pages (News, NewsArticle, Jobs, SchoolFinder, SchoolDetails, ServiceApply, CbtPractice, AdminQueue, AdminLayout/Nav, AdminDashboard) |
| Data model | All 42 migrations enumerated; service-request policies and reference-code trigger, notification policies, CBT RPCs, newsroom pipeline SQL, OBS-1 job table, RLS posture migration, storage bucket creation and policies, opportunity category constraint |
| Quality gates | `npm run typecheck`, `npm test` (346 tests), `schema:audit`, `build`, `perf:audit`, `analytics:audit`, `rls:audit`, `a11y:audit`, `npm audit` — all executed locally on 2026-10-02 |
| Production (live, read-only) | `/`, `/news`, `/news?category=jamb`, `/news?category=scholarships`, one article, `/jobs`, `/schools` (twice), one school detail, `/search?q=nelfund`, `/services/apply/results`, `/support`, `/privacy`, `/dashboard`, `/robots.txt`, `/sitemap.xml`, `/api/health`, `/api/health/ready`, `/api/news`, `/api/opportunities`, `/api/cbt/exams`, `/api/services`, `/api/upcoming`, the Vercel production URL |
| Local runtime | Production build served on `127.0.0.1:4173` to inspect real response headers, status codes and the fail-closed readiness path |

Not inspectable here (and therefore not claimed): any authenticated production action; the live Supabase database directly (no credentials in this environment — no `.env`, no CLI, no MCP); storage policies as applied in the cloud project; Netlify/Netlify-function logs, schedules and environment variables; browser rendering above a single headless pass (no local browser: `npx playwright install` fails — downloads blocked, `~/.cache/ms-playwright` empty).

---

## 3. Master Completion Matrix

| Domain | Exists | Functional | Secure | Tested | Data Ready | Admin Ready | Operational | Production Ready | Status |
|---|---|---|---|---|---|---|---|---|---|
| Public experience (home, news, article, jobs, search, schools, services, 404) | YES | YES | YES | YES (unit + e2e in CI) | PARTIAL | YES | YES | YES | **VERIFIED LIVE** |
| Student experience (register/login/profile/dashboard/notifications) | YES | NOT VERIFIED | YES (code-level) | PARTIAL | PARTIAL | YES | PARTIAL | NOT VERIFIED | **NOT VERIFIED LIVE** |
| Admin experience (12 console sections) | YES | NOT VERIFIED | YES (capability-guarded) | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | **AMBER** |
| Authentication | YES | NOT VERIFIED | YES | PARTIAL (6 tests) | YES | YES | PARTIAL | NOT VERIFIED | **NOT VERIFIED LIVE** |
| Authorization / capabilities | YES | YES | YES | YES (17 tests + every admin route 401) | YES | YES | YES | PARTIAL | **GREEN (code), live unverified** |
| CBT (4 banks, 1,620 questions claimed) | YES | PARTIAL | YES (guests receive no answer key on questions; scoring server-side) | YES (bank readiness migration tests) | YES (4 exams listed live) | YES | PARTIAL | PARTIAL | **AMBER** |
| Newsroom ingestion pipeline | YES | PARTIAL | YES (server-only tables) | YES (21 tests) | PARTIAL | YES (queue mounted in `/admin/news`) | PARTIAL (unverified schedule, no alerting) | PARTIAL | **AMBER** |
| News content (21 published) | YES | YES | YES | YES | PARTIAL (mixed category vocabulary) | YES | PARTIAL | PARTIAL | **AMBER** |
| Opportunities (2 active) | YES | YES | YES | YES | NO (no deadline, no verification on 2/2) | YES | PARTIAL | PARTIAL | **RED (data)** |
| Institutions (329) | YES | PARTIAL | YES | PARTIAL | NO (328/329 without website; no source links) | YES | PARTIAL | PARTIAL | **RED (data)** |
| Services (4 live workflows of 24 catalogue rows) | YES | PARTIAL | YES | YES | YES | YES | PARTIAL | PARTIAL | **AMBER** |
| Service requests / tracking | YES | PARTIAL (public read path verified by policy; submit not exercised live) | YES (owner insert/read, staff read/update) | YES | YES | YES | YES | PARTIAL | **AMBER** |
| Notifications | YES | PARTIAL | YES (owner-scoped RLS) | YES (11 tests) | YES | PARTIAL | PARTIAL | PARTIAL | **AMBER** |
| Analytics + retention | YES | YES | YES (allowlisted payloads, no free text) | YES (26 tests + audit) | YES | PARTIAL | NO (prune unscheduled) | PARTIAL | **AMBER** |
| Search & discovery | YES | PARTIAL | YES | PARTIAL | YES | N/A | PARTIAL | PARTIAL | **AMBER** |
| SEO / crawler surfaces | YES | YES | YES | YES (14 tests) | YES | N/A | PARTIAL (client-rendered HTML) | PARTIAL | **AMBER** |
| Accessibility | YES | PARTIAL | YES | PARTIAL (axe public routes in CI) | YES | N/A | PARTIAL | NOT VERIFIED | **AMBER** |
| Performance | YES | YES | N/A | YES (10/10 budgets, throttled browser pass) | N/A | N/A | PARTIAL | NOT VERIFIED (lab only) | **AMBER** |
| Database & migrations | YES (42) | YES (replay on real PostgreSQL) | YES | YES | PARTIAL | YES | PARTIAL | PARTIAL (live apply unverified) | **AMBER** |
| RLS | YES (36/36 classified) | PARTIAL | YES (structural) | YES (structural) | YES | N/A | PARTIAL | NOT VERIFIED (live) | **AMBER** |
| Scheduled jobs | YES (1 scheduled function) | NOT VERIFIED | YES | PARTIAL | N/A | NO (no console surface) | NO | NO | **RED** |
| Deployment (Netlify) | YES | YES | YES | YES (CI + live) | N/A | N/A | YES | YES | **GREEN** |
| Deployment (Vercel) | YES (connected, unintended) | NO (SSO-protected, no API config) | YES (protected) | N/A | N/A | N/A | NO | NO | **DRIFT** |
| Monitoring / alerting | PARTIAL (liveness + readiness + job rows) | PARTIAL | YES | YES | YES | NO | NO (no alerting) | NO | **RED** |
| Backups / recovery | NO (nothing documented) | NOT VERIFIED | NOT VERIFIED | NO | N/A | NO | NO | NO | **RED** |
| Support / issue handling | PARTIAL (WhatsApp + service dashboard) | PARTIAL | YES | NO | N/A | N/A | PARTIAL | PARTIAL | **AMBER** |
| Privacy / data governance | PARTIAL | PARTIAL | YES | PARTIAL | PARTIAL | NO | PARTIAL | NO (no policy/terms, no deletion) | **RED** |
| Data quality | PARTIAL (integrity report exists) | PARTIAL | YES | YES | NO (see §11) | NO (no console surface) | PARTIAL | PARTIAL | **RED** |
| CI/CD | YES | YES | YES | YES | N/A | N/A | PARTIAL (not enforced) | PARTIAL | **AMBER** |
| Documentation | YES (broad) | PARTIAL (drift found) | N/A | N/A | N/A | PARTIAL | PARTIAL | PARTIAL | **AMBER** |
| Mobile / responsive | YES | NOT VERIFIED | N/A | PARTIAL (Pixel 7 project in CI) | N/A | N/A | PARTIAL | NOT VERIFIED | **AMBER** |
| Cross-browser | PARTIAL (Chromium only) | NOT VERIFIED | N/A | NO | N/A | N/A | N/A | NOT VERIFIED | **AMBER** |

---

## 4. Critical Findings

### CRIT-1 — No documented or tested backup, rollback or restore capability

- **Severity:** CRITICAL
- **Domain:** Production operations / business continuity
- **Description:** The repository contains no backup strategy, no restore procedure, no rollback procedure (for deployment or migration) and no record that either has ever been tested. The runbook covers provisioning, migration application, RLS verification, seeding, deployment, smoke tests, branch protection, jobs, alerting, performance and GO/NO-GO — but not recovery.
- **Evidence:** `grep -rniE "backup|rollback|restore|recovery|point-in-time|PITR" docs/` returns only incidental matches (e.g. "restores structure" in `docs/operations/PRODUCTION_RUNBOOK.md:52`); the runbook's section list (`grep -nE "^#{1,3} " docs/operations/PRODUCTION_RUNBOOK.md`) has no recovery section. Migrations are forward-only (42 files, no down-migrations).
- **Impact:** A bad migration, an accidental delete, a corrupted table or a compromised admin account has no defined, practised recovery path. Student PII (profiles, service requests, CBT attempts) could be unrecoverable. Supabase plan-level backups may exist, but that is an assumption, not evidence.
- **Reproduction/verification:** Documentation inspection plus migration inventory. Live backup configuration could not be inspected (no Supabase credentials) — **NOT VERIFIED** for what the platform actually provides.
- **Recommended action:** Establish and document: Supabase backup tier/PITR state, a restoration rehearsal on a scratch project with the date it was performed, deployment rollback (Netlify deploy rollback to previous publish), migration rollback policy (pre-migration snapshot), credential-rotation and emergency-admin procedure.
- **Dependencies:** Supabase plan access; a scratch project.

### CRIT-2 — Production validation and the runbook contradict the storage design, and the contradiction directs an operator to break image serving

- **Severity:** CRITICAL
- **Domain:** Storage / release gate
- **Description:** `admin-content` is created **public** with a public-read policy, and the application publishes images through `storage.getPublicUrl(...)`. The production validator and the runbook both require that no application bucket is public, and mark it a failure otherwise.
- **Evidence:**
  - `supabase/migrations/20260926200000_admin_control_centre_backend.sql:173-185` — `insert into storage.buckets ... values ('admin-content','admin-content', true)` plus `create policy admin_content_public_read ... using (bucket_id = 'admin-content')`.
  - `server.ts:1404-1413` — upload then `getPublicUrl` (the returned URL is stored as the article/opportunity image).
  - `scripts/prod-validate.ts:87-110` and `scripts/prod-validate.ts:51-53` — `EXPECTED_BUCKETS = ['admin-content','resource-files','campus-uploads']`; any of them public ⇒ `state: 'fail'`, detail "public but must not be".
  - `tests/prod-validate.test.ts:161-163` asserts that a public `admin-content` must fail.
  - `docs/operations/PRODUCTION_RUNBOOK.md` §6 — "**Pass:** buckets exist, all three private".
- **Impact:** Either (a) `npm run prod:validate` fails on a correctly configured project, permanently blocking the documented GO criterion (§15), or (b) an operator "fixes" it by making `admin-content` private, which silently breaks every admin-uploaded image URL already published. This is a live release-gate defect and a trap, not a cosmetic inconsistency.
- **Reproduction/verification:** Static inspection of the migration, the validator, its test and the runbook. Live outcome **NOT VERIFIED** (no service key in this environment); the contradiction exists in the tree regardless of the live bucket state.
- **Recommended action:** Decide the intended posture in one place. If public read is intended (it is, for image URLs), the validator must exempt `admin-content` and the runbook §6 must say so; `resource-files` and `campus-uploads` should stay private. Add a test asserting the exemption.
- **Dependencies:** Product decision on whether admin uploads are public.

---

## 5. High Findings

### HIGH-1 — `main` is not protected; the quality gate is not enforced

- **Severity:** HIGH · **Domain:** CI/CD governance
- **Description:** `quality-gate` runs and passes, but nothing requires it before merging to `main`.
- **Evidence:** `gh api repos/1436799528/EduReach_Hub/branches/main --jq '{name,protected}'` → `{"name":"main","protected":false}`. `gh api .../rulesets` → `[]`. `gh api .../branches/main/protection` → 403 "Resource not accessible by integration". `.github/workflows/production-checks.yml` runs on push/PR to `main` but cannot enforce itself.
- **Impact:** A direct push or a merge with a red gate reaches production. `docs/operations/PRODUCTION_RUNBOOK.md` §11 and §15 both list this as a GO condition.
- **Recommended action:** Require the `quality-gate` check (and PR review) on `main` in GitHub settings; re-verify with `gh api .../branches/main` → `protected: true`.
- **Dependencies:** Repository-admin rights (the current token cannot set it).

### HIGH-2 — The scheduled newsroom job is unverified, unmonitored and unaudited by any operator surface; there is no alerting

- **Severity:** HIGH · **Domain:** Automation / observability
- **Description:** The only scheduled process is `netlify/functions/daily-news-refresh.ts` (`export const config = { schedule: '@daily' }`). No execution has been observed; job health is exposed only through an authenticated API (`/api/admin/jobs`) that **no console page consumes**; failures reach only the platform log stream.
- **Evidence:** `netlify/functions/` contains `api.ts` and `daily-news-refresh.ts` only; `grep -rn "schedule" netlify/` returns the `@daily` export and nothing else. No client call to `/api/admin/jobs` exists (`grep -rn "api/admin/" src pages` — the list has no jobs entry); `evaluateJobHealth` is used only inside that endpoint (`server.ts:23,237-243`). `docs/operations/PRODUCTION_RUNBOOK.md` §13 states "**Current state: failures are recorded and visible in the admin console, but nothing pushes an alert**" — and even the console half is absent. The migration comment for OBS-1 says "the console reads the rows"; it does not. Observable proxy: no published news has changed since 2026-09-26 (`/api/news`, `/sitemap.xml` lastmod values), i.e. six days of `@daily` runs have produced no visible publication.
- **Impact:** A stopped schedule, a blocked source or a failing run is invisible until a human notices stale content. The platform's core promise (fresh, verified education updates) can silently stop.
- **Reproduction/verification:** Live `GET /api/admin/jobs` requires a staff token — **NOT VERIFIED**. Netlify function logs/schedule registration require Netlify access — **NOT VERIFIED**.
- **Recommended action:** Add a jobs/health section to the admin console, an operator alert channel (email/Slack/webhook) for `failed` and `stale` runs, and an external uptime check on `/api/health/ready`; then record one verified production run in the runbook.
- **Dependencies:** Netlify account access; an alert destination.

### HIGH-3 — Registration requires agreement to Terms of Service and a Privacy Policy that do not exist anywhere in the product

- **Severity:** HIGH · **Domain:** Privacy / data governance / product integrity
- **Description:** The signup form makes agreement mandatory and names two documents; neither is linked, and neither route exists. There is also no account deletion or data export.
- **Evidence:** `pages/AuthPageV2.tsx:171` — `throw new Error('You must agree to the Terms of Service and Privacy Policy.')`; `pages/AuthPageV2.tsx:683` renders the sentence with `<strong>` text only (no anchor). Live `GET https://edureachhub.netlify.app/privacy` returns the branded **404** page with title "EduReach Hub — Student Services, CBT & Education Updates". `grep -rniE "delete account|export (my )?data|data deletion"` over `src pages server.ts lib` returns nothing.
- **Impact:** Students consent to documents they cannot read; if a student asks what is collected, how long it is kept, or asks for deletion, there is no product answer and no process. This requires legal/product review, not engineering improvisation.
- **Recommended action:** Publish versioned Privacy Policy and Terms pages (public, indexed, linked from signup and the footer), describe the data classes in §11, and define a deletion/export request path with an internal owner.
- **Dependencies:** Legal/product decision.

### HIGH-4 — Public opportunity content asserts verification that the data does not support

- **Severity:** HIGH · **Domain:** Content governance / truthfulness
- **Description:** Both active opportunities have `deadline: null` and `last_verified_at: null`, while the public page states that listings only appear once source, eligibility and application route have been checked. No per-item verification or freshness is shown to students.
- **Evidence:** Live `GET /api/opportunities` (2026-10-02) returns two items, both with `"deadline":null,"last_verified_at":null`. The live `/jobs` page states: "Grants and scholarships appear only when their source, eligibility and application route have been checked." `pages/JobsPage.tsx` renders `Closes {deadline}` / `Expired` but never renders `last_verified_at` (no match in that file).
- **Impact:** Students cannot judge urgency or freshness of the only two listings, and the page copy overstates the assurance behind them. This is exactly the class of issue ("make the platform misleading") the audit targets.
- **Recommended action:** Either verify the two listings and record `last_verified_at`, or soften the public copy and show an explicit "not yet independently verified" state per item; add a verification badge driven by data, not copy.
- **Dependencies:** Editorial decision; source URLs are present and reachable.

### HIGH-5 — Live security boundaries have never been exercised through the real path

- **Severity:** HIGH (risk) · **Status:** NOT VERIFIED · **Domain:** RLS / authorization
- **Description:** RLS is proven structurally (36/36 tables classified, 0 findings; policies switch roles inside a PostgreSQL replay) and the code derives identity only from the bearer token and the trusted `profiles` row — but no request through Supabase Auth/PostgREST has ever been made in this or the previous audit.
- **Evidence:** `npm run rls:audit` passes (`36 public tables, 36 classified, 0 findings`); `tests/rls-posture.test.ts` uses `set role` inside PGlite. This environment has no Supabase credentials (no `.env`, no CLI, no MCP), so live cross-tenant probes (student A vs student B, guessed IDs, direct PostgREST reads of `service_requests`, `profiles`, `cbt_attempts`, `student_notifications`, `admin_audit_logs`, storage objects) are **BLOCKED**.
- **Impact:** The strongest possible evidence — an authenticated cross-user denial test on the live project — is missing. Storage policies in particular (`resource-files`, `campus-uploads`, and the public `admin-content`) have never been probed.
- **Recommended action:** With two seeded test accounts, run the documented probe matrix against production (own record / another student's record / guessed UUID / direct endpoint / direct PostgREST), then run `supabase/ci/production-validation.sql` in the SQL editor and attach the output to the release record.

### HIGH-6 — Analytics retention is not scheduled, and its absence makes the job-health verdict permanently unhealthy

- **Severity:** HIGH · **Domain:** Data governance / automation
- **Description:** AN-1 declares a 90-day retention window and ships `prune_site_analytics_events()` plus a manual CLI, but nothing calls it on a timer. `analytics-retention` is nevertheless listed in `KNOWN_JOBS`, so `evaluateJobHealth` will always report a missing job, i.e. a permanently "unhealthy" verdict.
- **Evidence:** `scripts/analytics-retention.ts` is a CLI (`npm run analytics:retention -- --dry-run|--apply`); `netlify/functions/` has no retention schedule; `src/server/jobRuns.ts:33` — `KNOWN_JOBS = ['newsroom-refresh', 'analytics-retention']`; `evaluateJobHealth` returns `ok: false` when a known job has no row (asserted in `tests/job-runs.test.ts`). `docs/operations/PRODUCTION_RUNBOOK.md` §12 instructs running the prune by hand.
- **Impact:** (a) `site_analytics_events` grows without bound, contradicting the documented retention promise; (b) the OBS-1 health signal is meaningless (always false) which trains operators to ignore it.
- **Recommended action:** Schedule the prune (a second Netlify scheduled function, or fold the call into the daily run and record it as its own job row), or remove it from `KNOWN_JOBS` and document the manual cadence.

---

## 6. Medium Findings

### MED-1 — News category vocabulary is unconstrained; a public filter returns nothing while matching content exists

- **Severity:** MEDIUM · **Domain:** Data quality / user-facing filtering
- **Description:** The controlled list is client-side only. Published rows store display labels rather than slugs, so filters that compare lowercased values match single-word labels but not multi-word ones.
- **Evidence:** Live `GET /api/news` rows carry `"category":"Admissions"`, `"category":"NECO"`, `"category":"NABTEB"`, `"category":"Universities"`, `"category":"Scholarships & Funding"`. `src/data/newsCategories.ts` defines slugs (`admissions`, `neco`, `nabteb`, `scholarships`, …) and `newsCategoryMatches()` (lines 58-76) compares the lowercased stored value against the filter slug plus a small alias list — `'scholarships & funding'` never equals `'scholarships'`. Live control: `/news?category=jamb` renders 3 JAMB articles (stored slug matches), while `/news?category=scholarships` renders **"No announcements found matching this category."** although `/news/nuc-dangote-foundation-scholarship-30000` exists and is labelled "Scholarships & Funding" on the homepage. No DB constraint exists on `news_articles.category` (the only category CHECK in the migrations is on `opportunities.category`, `20260926220000_admin_full_catalogue_opportunities.sql:74`), and the bulk CMS treats category as free text (`server.ts` `CONTENT_RESOURCES.news_articles.category` → `type:'text'`).
- **Impact:** Students filtering for scholarships/funding are told nothing exists. The same class of mismatch will recur on every multi-word category until the vocabulary is constrained.
- **Recommended action:** Normalise existing values to slugs, add a CHECK constraint (or a foreign key to a category table), and make the editor a select. Do not rewrite content silently — the fix is a normalisation migration plus an editorial pass.
- **Dependencies:** Editorial confirmation of intended categories.

### MED-2 — Institution directory is largely navigational dead-end data

- **Severity:** MEDIUM · **Domain:** Data completeness
- **Description:** 329 institutions are published; 328 have no website URL, no admission portal, no student portal and no provenance. A student can find a school and then has nowhere to go.
- **Evidence:** Live `/schools/abia-state-university-uturu` renders "**Official website link not configured**". `/sitemap.xml` lists ~329 `/schools/<slug>` URLs. `pages/SchoolFinderPage.tsx:38` selects `website_url`; `pages/SchoolDetailsPage.tsx` renders the missing-link notice; the CMS exposes `website_url`/`admission_portal_url`/`student_portal_url`, so the enrichment path exists but no data source/process does.
- **Impact:** The directory is presented as a maintained product ("Search the maintained institution directory…") but frequently cannot take the student one step further. Honestly disclosed in the UI, so this is a completeness/effort gap rather than a defect.
- **Recommended action:** Decide the enrichment source (e.g., NUC/regulator lists), record provenance and verification per institution, and only then claim "maintained". Do not fabricate URLs.
- **Note:** No institution list was directly queryable here (institutions are read browser-side from Supabase; no public API), so the 328/329 count is carried from the previous live verification and corroborated evidence-wise by the detail page and the sitemap.

### MED-3 — Public HTML is a shell: per-route metadata exists only after JavaScript runs

- **Severity:** MEDIUM · **Domain:** SEO / social sharing
- **Description:** There is no SSR or prerendering. Every route is served the same 2,342-byte `index.html` with default metadata; canonical/OG/Twitter/JSON-LD are applied at runtime by `src/lib/seoMeta.ts`.
- **Evidence:** `netlify.toml` — `from = "/*" → "/index.html", status = 200`; `dist/index.html` is 2,342 bytes with only default title/description; `grep -rn "prerender|ssr|renderToString" vite.config.ts scripts/*.ts package.json` → no matches; `index.html` comment states the behaviour.
- **Impact:** Google can render JS, but non-JS consumers — link previews in WhatsApp/Facebook/Twitter, many crawlers and unfurlers — see the homepage title and description for every news article, opportunity and institution page, and no canonical. The sitemap advertises ~350 URLs whose raw HTML carries no unique metadata.
- **Recommended action:** Add prerendering (or edge-side metadata injection) for `/news/:slug`, `/schools/:slug`, `/jobs`, `/news`, `/events`; at minimum emit per-route OG/canonical in the HTML for the crawler surfaces that matter for sharing.

### MED-4 — Vercel is still connected, contradicting D5, and creates production ambiguity

- **Severity:** MEDIUM · **Domain:** Deployment
- **Description:** D5 states "Vercel is not a deployment target and is not configured" and treats the earlier Vercel signal as "a commit status, not a configuration". The GitHub API shows Vercel is an active integration: a **Production**-environment deployment of the merge commit, preview deployments on every pushed commit, and a Vercel commit status.
- **Evidence:** `gh api repos/1436799528/EduReach_Hub/deployments` → 30 entries, all `creator: vercel[bot]`, including `{id: 6796649459, environment: "Production", ref: aa60b538…, created_at: 2026-10-01T22:28:26Z}` and Preview deployments for `ba9f493`, `cd16e78`, `a0e8f9f`, …; `gh api .../deployments/6796649459/statuses` → `state: success`, `environment_url: https://aponijames-8f7kgnixk-james-projects-cc0475f0.vercel.app`; that URL redirects to Vercel SSO login (deployment protection), so it is not publicly serving. Netlify is simultaneously connected (`Pages changed - edureachhub`, `Header rules`, `Redirect rules` checks on PR #11, project `edureachhub`).
- **Impact:** Two platforms are configured for the same repository; the repository contains no `vercel.json`, so the Vercel deployment cannot serve `/api/*`, `/robots.txt`, `/sitemap.xml` or the scheduled job — it is a partially-functional mirror. The risk is operational confusion (which URL is production?) and a stale SSO-protected copy of the app, not an active data exposure.
- **Recommended action:** Decide ownership explicitly. If Netlify owns production (per D5), disconnect the Vercel project from the repository (or vice versa) and update D5 plus the readiness audit, which currently assert Vercel is absent.
- **Dependencies:** Repository owner action in Vercel.

### MED-5 — Support is a WhatsApp link and a coming-soon page; there is no issue intake, ticketing or status path

- **Severity:** MEDIUM · **Domain:** Support / operations
- **Description:** `/support` renders a placeholder ("A dedicated support centre is being prepared"), offering only WhatsApp. There is no way to report incorrect news, an outdated opportunity, wrong institution data, a CBT problem or a privacy concern from within the product, and no internal ticket/response/escalation process is documented.
- **Evidence:** Live `/support` content; `src/data/hubContent.ts` WhatsApp constants; `wa.me` links in `HubLayout`, `JobsPage`, `PastQuestionsPage`, `ComingSoonPage`; no report/ticket route in `src/app/routes.tsx`.
- **Impact:** Complaints arrive as unstructured WhatsApp messages with no tracking, no SLA and no audit trail; a student cannot see that a report was received or resolved.
- **Recommended action:** Define the intake → triage → response → resolution path (even if it starts as a monitored mailbox/WhatsApp with a published response time), add a lightweight "Report an issue" action on news/opportunity/institution pages, and record the internal owner.

### MED-6 — Platform search is fragmented and omits the institution directory

- **Severity:** MEDIUM · **Domain:** Search & discovery
- **Description:** `/search` searches services, news, opportunities, CBT and static hub content; it does not search institutions or events. The school finder has its own separate search with different filters and deep links.
- **Evidence:** `pages/SearchPage.tsx:114-116` fetches news, CBT exams and opportunities plus local data; no institutions query. Live `GET /search?q=nelfund` returns three correct results (service + two articles) and works well for what it covers.
- **Impact:** A student searching "University of Lagos" in global search finds nothing, even though the institution page exists at a different route; discovery depends on knowing which of two search boxes to use.
- **Recommended action:** Extend search to institutions and events (or link out explicitly), and unify the query contract (`/search?q=` → `school` filters).

### MED-7 — Guest CBT exposes complete question banks, including answers, with no dedicated limit on question retrieval

- **Severity:** MEDIUM · **Domain:** Abuse / content protection
- **Description:** `/api/cbt/exams/:examId/guest-questions` (unauthenticated) returns question text and options; `/api/cbt/guest-submit` (unauthenticated) returns the full paper **including `correct_option` and `explanation`**. Scoring is server-side, which is correct, but the answer key is fully extractable and the questions endpoint has no dedicated limiter.
- **Evidence:** `server.ts` guest-questions handler selects `position,subject,question_text,option_a..d`; guest-submit response includes `questions: [...] correct_option, explanation`; `lib/rate-limit.ts:146-154` — only `guestCbtSubmit` is durable (30/600 s); `apiGeneral` (1,200/min) is in-process only and Netlify runs many instances.
- **Impact:** The practice banks are the platform's authored asset; a script can mirror all 1,620 questions and keys in minutes. Acceptable if the banks are permanently practice-only; a problem if any bank is ever reused for graded assessment.
- **Recommended action:** Confirm the product decision that these banks are public practice material; if so, document it and add a durable per-IP limit plus pagination to the questions endpoint. If not, require authentication for explanations.

### MED-8 — Notification preferences are collected but nothing sends them

- **Severity:** MEDIUM · **Domain:** Notifications / product truthfulness
- **Description:** Students can enable "Email alerts", "WhatsApp alerts" and "SMS alerts"; no code path sends any of them. `src/server/whatsapp.ts` exists but is never imported.
- **Evidence:** `pages/ProfileCompletionPage.tsx:141-144, 208-211, 311` read/write `notification_preferences`; `grep -rn "server/whatsapp" src pages server.ts netlify` → only `src/lib/envContract.ts` references (`consumedBy: ['src/server/whatsapp.ts']`); no other consumer.
- **Impact:** A student who enables WhatsApp alerts will never receive one and will not know. In-app notifications work (NTF-1), so the primary transaction is not corrupted.
- **Recommended action:** Either wire the delivery channels, or label the toggles as "in-app only" until delivery exists.

### MED-9 — Verification gaps that no amount of code reading can close

- **Severity:** MEDIUM · **Domain:** QA coverage
- **Description and evidence:**
  - **Authenticated journeys:** no seeded test account exists in this environment; signup, email verification, login, profile save, dashboard, service submission and a full CBT attempt have never been exercised against production (**NOT VERIFIED**).
  - **Cross-browser:** Playwright runs `desktop-chromium` and `mobile-chromium (Pixel 7)` only (`playwright.config.ts:20-21`); no Firefox, no WebKit/Safari (**NOT VERIFIED** for Safari/iOS — do not claim it).
  - **Assistive technology:** axe covers the public routes in CI (`tests/e2e/a11y.spec.ts`); authenticated screens are covered by static rules only; NVDA/JAWS/VoiceOver/TalkBack have never been run.
  - **Mobile rendering:** the Pixel 7 project asserts load and headings, not layout integrity across dashboards, tables, CBT hall and admin console.
  - **Performance:** all numbers are lab (CI budget + throttled local run); no field data exists (no CrUX/traffic) — the runbook §14 procedure is documented but not performed.

### MED-10 — Dormant financial and legacy schema remains in the database

- **Severity:** MEDIUM · **Domain:** Codebase/data hygiene · **Privacy surface**
- **Description:** `student_wallets`, `student_wallet_transactions`, `payment_events` (plus `campus_posts`, `campus_post_likes`, `campus_post_comments`, `past_questions`, `resources`, `edureach_material_notes`) have no application consumer. The baseline migration even notes the campus tables are no longer read.
- **Evidence:** `npm run rls:audit` classifies them as `server-only`/`dormant`; `grep -rn "student_wallet|payment_events|idempotency" src pages server.ts lib` → no matches; `supabase/migrations/20260830000000_baseline_core_schema.sql` comment on the legacy Campus Feed tables.
- **Impact:** Unused tables with financial-shaped columns are a standing privacy/compliance question ("do you store wallet data?" — yes, empty tables) and a maintenance trap. No evidence of PII in them (they are empty per the design), but that is unverified live.
- **Recommended action:** Decide retention vs removal per table in a migration; document the decision. Do not drop blindly.

### MED-11 — School directory list rendering could not be confirmed in production

- **Severity:** MEDIUM (verification item) · **Domain:** Frontend reliability
- **Description:** Two renders of `/schools` (2026-10-02) showed "Loading verified directory…" and no results. The detail page for an institution renders its data, so the client-side read path works; the loading state is most likely a snapshot-timing artefact, but a school list that never resolves would be a major public-journey failure.
- **Evidence:** Live `/schools` (twice) — loading skeleton only; live `/schools/abia-state-university-uturu` — rendered profile; `pages/SchoolFinderPage.tsx:30-56` loads `institutions … limit(400)` and has an error state.
- **Recommended action:** Confirm with a real browser session (and in CI's mobile project) that the list resolves; if it is a slow-query problem, move the directory to a server endpoint with caching.
- **Status:** **NOT VERIFIED** — unresolved.

### MED-12 — Opportunity expiry is coupled to the newsroom job, and articles never expire in practice

- **Severity:** MEDIUM · **Domain:** Automation / content freshness
- **Description:** `close_expired_opportunities()` is invoked from inside the newsroom pipeline (`src/server/newsroom/pipeline.ts:805`), so if the newsroom job stops, opportunity closure stops with it. Separately, every published article has `expires_at = null`, so `expire_stale_news` has nothing to act on and time-bound notices (e.g. "registration closes 26 October") never leave the feed.
- **Evidence:** live `/api/news` rows — `"expires_at":null` throughout; pipeline code computes `expires_at: expiresAtFor(entry.category, …)` only for pipeline-published rows, while the live rows have `"source_key":null,"source_tier":null` (seeded directly). `supabase/migrations/20260930120000…` defines `expire_stale_news`.
- **Impact:** Stale, time-limited notices remain live with a "Source checked" badge after their relevance has passed; students can act on expired information.
- **Recommended action:** Schedule expiry independently (or verify it runs), backfill `expires_at` for time-bound notices, and show an "expired/updated" state on articles.

### MED-13 — Admin console has no surface for job health, data quality, or a full audit log

- **Severity:** MEDIUM · **Domain:** Admin operations
- **Description:** The console covers content, services, users, CBT, institutions, opportunities, analytics and the data-control centre (12 sections, capability-filtered). `/api/admin/jobs` (job health), `/api/admin/integrity` (the data-quality report) and the full audit trail have **no UI consumer**; the dashboard shows only the six most recent audit entries.
- **Evidence:** `pages/AdminLayout.tsx` `ADMIN_CONSOLE_NAV`; `grep -rn "api/admin/" src pages` lists no `jobs`, no `integrity`; `pages/AdminDashboardPage.tsx:176-177` renders `AuditTimeline items={analytics?.audit.slice(0,6)}`.
- **Impact:** An administrator cannot see that the newsroom failed, whether content quality degraded, or review a full action history without API/DB access — which is exactly the "operation requires developer intervention" test in the audit brief.
- **Recommended action:** Add three read-only console panels (Scheduled Jobs, Data Quality, Audit Log) backed by the endpoints that already exist.

### MED-14 — Rate limiting is only cross-instance for five rule sets

- **Severity:** MEDIUM · **Domain:** Abuse protection
- **Description:** Only `adminBootstrap`, `guestCbtSubmit`, `adminUpload`, `adminImport` and `adminNewsroomRun` use the durable Postgres counter. The general API bucket (1,200/min) and the analytics ingest bucket (240/min) are in-process only, on a platform that runs many short-lived function instances. The durable layer also fails open by design if the RPC is missing.
- **Evidence:** `lib/rate-limit.ts:146-154`; `server.ts:37-44` (fail-open with a logged message); `app.use('/api', rateLimitFor(RATE_LIMIT_RULES.apiGeneral))`.
- **Impact:** Public endpoints (news/article reads, analytics ingestion, CBT question retrieval) can be scraped or spammed beyond the nominal limits.
- **Recommended action:** Move analytics ingest and CBT question retrieval to durable limits; add a durable bucket for anonymous read bursts; consider platform-level (Netlify) rate limiting.

---

## 7. Low Findings

- **LOW-1 — Unused runtime dependencies.** `@google/genai`, `canvas-confetti` (and `@types/canvas-confetti`), and `motion` have no import anywhere in `src`, `pages`, `server.ts`, `lib`, `scripts` or `netlify` (exhaustive grep). They are not bundled, but they are install-time and supply-chain surface. `autoprefixer` also appears with no PostCSS config (Tailwind v4 handles vendor prefixes).
- **LOW-2 — Documentation drift.** (a) `docs/PRODUCTION_READINESS_AUDIT_2026-10-01.md` says the site has "never been deployed" — it is live. (b) `docs/features/D5.md` and `docs/DEPLOYMENT_DECISION.md` assert Vercel is not configured — it is connected (MED-4). (c) The same audit describes a public reference-code lookup returning limited fields; that RPC was revoked from `anon`/`authenticated` in `20260925_public_release_security_hardening.sql:11` and has no caller (its only remaining role is a validation constant in `scripts/prod-validate.ts`).
- **LOW-3 — Node version declarations differ.** `.nvmrc` = `22.22`, `package.json engines` = `>=22.12.0`, CI = `22.22.x`, `netlify.toml NODE_VERSION = "22"` (floating). Harmless today; pin Netlify to the same minor.
- **LOW-4 — Deliberate legacy fallbacks lack a removal criterion.** `NEWS_COLUMNS_LEGACY` (`src/lib/api.ts:626`), the legacy retry in `src/server/seo.ts:217`, the `closed_at` fallback (`server.ts:1213`), `LEGACY_SUPER_ADMIN_ROLES` (`src/lib/capabilities.ts:177`) and the `edureach-student-profile` key in `src/lib/localPreview.ts:25` all exist for older databases. The production database already carries the governed columns (live `/api/news` returns them), so these paths are now dead weight; no migration note says when they can go.
- **LOW-5 — Netlify badge on every page.** The free-plan "Build your own site with Netlify" badge is appended to every rendered page, including `/support` and article pages. It is third-party advertising on a student-facing platform and a trust signal worth removing (plan setting).
- **LOW-6 — Header source drift (minor).** `public/_headers` sets `/index.html: Cache-Control: no-cache, no-store, must-revalidate`; the Express server serves the same file with `Cache-Control: public, max-age=0` (observed locally on `127.0.0.1:4173`). Both are safe; the two sources are no longer byte-identical in intent for this path, and `tests/headers.test.ts` covers the security set, not this caching nuance.
- **LOW-7 — Migration filename format inconsistency.** `20260831_add_production_query_indexes.sql` uses an 8-digit prefix while the other 41 use 14 digits. Lexicographic ordering still places it correctly (verified by the replay in `tests/migrations.test.ts`), but it is a weak spot in the naming convention.
- **LOW-8 — Local-preview PII path.** When Supabase is unconfigured the app persists service requests and profile data in `localStorage`. It is unreachable in production (Supabase is configured and the live readiness probe reports `supabase_configured: true`), but it is documented only in code comments.

---

## 8. Enhancements

Genuine improvements, not defects:

1. **Server-side rendering/prerendering** for crawler and social surfaces (also fixes MED-3).
2. **A durable per-user notification digest** (in-app + WhatsApp/email) once delivery exists (MED-8).
3. **School directory enrichment** with provenance fields (source URL, verified date, verification status per institution) rather than only `is_verified` (MED-2).
4. **Admin "Data Quality" panel** surfacing `content_integrity_report()` with one-click remediation links (MED-13).
5. **Analytics: field measurement** — PageSpeed/CrUX record with the deployment SHA, per runbook §14.
6. **PWA/offline hardening** for the CBT hall (queue submissions when offline, explicit conflict resolution) — the offline skeleton exists (`src/lib/cbt-offline.ts`).
7. **Search unification** (institutions, events, service guides) and typo tolerance (MED-6).
8. **Self-service account export/deletion** as a product feature, not only a compliance obligation (HIGH-3).
9. **Firefox/WebKit CI projects** and a scripted assistive-technology checklist (MED-9).
10. **Opportunity verification workflow** in the console: `last_verified_at` required to publish, with a stale badge after N days (HIGH-4/MED-12).

---

## 9. User Journey Results

| Journey | Result | Evidence |
|---|---|---|
| **A. New student** (landing → register → verify → login → profile → dashboard) | **NOT VERIFIED** | Landing `/` renders with live data; `/register` renders the full form including the terms checkbox and the "no sensitive PII (NIN, BVN, banking passwords)" note; submission, email verification, session creation and profile save were never exercised (no credentials, cannot create accounts in this environment). |
| **B. Returning student** (open → session restore → dashboard → continue) | **PARTIAL** | Anonymous access to `/dashboard` correctly redirects to `/login?next=%2Fdashboard` (live). Session restoration, remember-me behaviour and dashboard-with-data are **NOT VERIFIED**. CI asserts the anonymous redirect for 12 protected routes including `/services/track`, `/admin/*`. |
| **C. CBT** (select → start → navigate → refresh/offline → resume → submit → score → result) | **PARTIAL** | Live `/api/cbt/exams` returns the 4 banks; `/cbt/setup/jamb` etc. exist; code shows server-side scoring, owner-scoped progress, expiry auto-submit (`pages/CbtPracticePage.tsx:241`), resume from `localStorage`, keyboard shortcuts, submit-modal disabling. No live attempt, refresh, multi-tab, expiry or submission was executed (**NOT VERIFIED** for the authenticated hall and result persistence). |
| **D. Service request** (catalogue → form → submit → reference → track → status → completion) | **PARTIAL** | Client insert is RLS-constrained to `user_id = auth.uid() and status = 'submitted'`; reference codes are generated by trigger; read-own policy exists; staff update policy exists. Live UI form is reachable (`/services/apply/results` renders, snapshot showed its loading state). Submission, duplicate handling, notification receipt and status transition were **NOT VERIFIED**. |
| **E. News** (browse → filter → article → source → image → related) | **PASS (with one filter defect)** | `/news` renders 21 published items with images, categories, dates; one category filter is broken (`?category=scholarships` empty — MED-1); `/news?category=jamb` renders 3 correct items; article page renders category, author, date, "Source checked", source link, tags, "Last verified", related updates and share/copy actions; images load from the listed third-party hosts. |
| **F. Opportunity** (browse → filter → open → source → deadline → verification → expiry) | **PARTIAL** | `/jobs` renders 2 listings, filter pills, honest empty-state copy, and outbound "Official link" to `nuc.edu.ng` / `education.gov.ng`. Deadlines and verification dates are absent on both (HIGH-4); no expiry state; no per-item freshness display. |
| **G. Admin content** (login → create → draft → preview → publish → edit → correct → unpublish) | **NOT VERIFIED** | Console has Newsroom CMS, Events, Opportunities, Services and Data Control Centre with capability-filtered navigation and per-section denial screens; APIs are capability-guarded and every admin route returns 401 unauthenticated (asserted in `tests/api.test.ts`, spot-checked live on the local build: `/api/admin/users` → 401). No admin session was available to exercise publish/correct/unpublish. |
| **H. Admin service** (view request → change status → note → student notified → note stays internal → audit recorded) | **NOT VERIFIED** | Code path: legal transition map with 409 on illegal transitions, `admin_audit_log` written before the notification, notification best-effort so it cannot fail the transition, notification copy contains no internal vocabulary or `admin_note`; the public tracker RPC is revoked, so internal notes have no public exposure path. Live execution **NOT VERIFIED**. |
| **I. Failure states** | **PARTIAL** | Verified live: branded 404 for unknown/malformed routes (`/privacy` 404 observed; CI asserts 4 malformed routes) and admin API 401s; verified locally: readiness returns **503 with an explicit degraded body** when Supabase is unconfigured (fail-closed, not a false "ok"), and `/api/health` stays 200 for liveness. Code-inspected only: timeout/offline/duplicate/rate-limit/stale-page paths; user-facing error normalisation hides Postgres/Supabase internals (`lib/errors.ts`). No network-interruption or concurrent-submission test was executed in a browser. |

---

## 10. Security Findings

**Confirmed vulnerabilities:** none found in this pass.

**Controls confirmed present (code-level):**

- Authentication: bearer token verified with Supabase `auth.getUser(token)`; the caller's role comes from the trusted `profiles` row; `user_metadata` is never consulted for authorization (`lib/auth.ts`). A missing/unreadable profile row fails closed.
- Authorization: 50 routes carry `requireCapability(...)`; 401 for missing/invalid token, 403 with a generic message; ownership failures return 404 so existence is not leaked; owner-scoped capabilities are never satisfied by staff roles (`lib/authorization.ts`, `src/lib/capabilities.ts:OWNER_SCOPED_CAPABILITIES`).
- Tenancy/ownership on data: `service_requests` insert restricted to `user_id = auth.uid() and status='submitted'`; read-own; staff read/update policies; reference code generated server-side by trigger; `profiles` column grants restrict client-writable columns; `exam_questions` is denied to client roles and read only through SECURITY DEFINER RPCs.
- CBT integrity: guest question payload omits `correct_option`; guest submission is scored server-side; authenticated attempt/submit RPCs resolve the student from `auth.uid()` and never from a client-supplied id; progress updates are owner- and status-scoped.
- Uploads: admin-only capability, data-URL allowlist (png/jpeg/webp/gif — no SVG), 2 MB cap, random object path, audited. No user-upload path exists.
- Input handling: no dynamic SQL built from request input — the content manager is an allowlist of 10 resources with per-field allowlists and coercion (`server.ts` `CONTENT_RESOURCES`, `validateContentRow`, `coerceContentValue`); table names never come from the request; imports are capped at 2,000 rows and chunked.
- Secrets: no live credential in the tree or in git history (`git log -S "eyJhbGciOi"` returns only a synthetic fixture in `tests/config.test.ts`); service key retrieval rejects non-service keys (`lib/supabase-config.ts`); the client bundle is inert without configuration.
- Headers: production header set present in both sources (`public/_headers` and the Express middleware) — CSP without `unsafe-inline`/`unsafe-eval` for scripts, HSTS bounded at one year without `includeSubDomains`/preload, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; verified live for the Express path on the local production build.
- Analytics privacy: allowlisted event names and metadata keys with caps; free-text search terms are no longer collected; the ingest endpoint derives identity from the bearer token only.
- Rate limiting: durable across instances for bootstrap, guest CBT submit, uploads, imports and newsroom runs; in-process elsewhere (see MED-14).

**Hardening opportunities:** MED-7 (guest answer-key exposure), MED-14 (durable limits), MED-5 (no structured intake for security/privacy reports), MED-10 (dormant financial-shaped tables), LOW-6 (header drift).

**Unverified areas (state plainly — no penetration test was performed):** live RLS through the JWT/PostgREST path; storage object policies in the cloud project; Auth configuration (email confirmation, redirect allowlist, brute-force/rate protection, MFA enforcement); Netlify function secrets and environment scoping; CORS/session-cookie behaviour for the deployed origin; response headers as actually served by Netlify for static assets (the sandbox cannot issue raw HTTP requests to the internet, and the platform fetch tool returns rendered content rather than headers). No vulnerability scanning beyond `npm audit` (0 vulnerabilities) was run.

---

## 11. Data Quality Findings

Actual production data issues (observed through the public API/UI on 2026-10-02):

1. **News category vocabulary (recheck of the known finding — unchanged).** Published rows carry display labels (`Admissions`, `NECO`, `NABTEB`, `WAEC`, `NELFUND`, `Universities`, `Scholarships & Funding`) rather than the controlled slugs in `src/data/newsCategories.ts`. Live consequence: `/news?category=scholarships` returns "No announcements found matching this category" although the Dangote scholarship article exists. Root cause: no database constraint, free-text in the CMS, and a client-side matcher that only lowercases. The `content_integrity_report()` already counts `unknown_categories`, so the measure exists but is not surfaced or acted on. (The precise prior count of 17 rows could not be re-derived — the public API returns only the 30 most recent items — but the class of defect is confirmed present.)
2. **Opportunities (recheck — unchanged).** Both active listings have `deadline: null` and `last_verified_at: null`. No expiry automation can apply, and the public copy implies verification.
3. **Institutions (recheck — unchanged, corroborated).** 329 published institution pages; the sampled detail page shows "Official website link not configured". No provenance fields are exposed for the directory's data.
4. **Articles never expire.** All live articles have `expires_at: null`, so time-bound notices (e.g. a screening window that ended 30 September) remain published and marked "Source checked".
5. **Scheduled-job execution records.** No execution record has been observed in this audit. `/api/admin/jobs` requires a staff token and no console surface exists; Netlify logs are inaccessible. **NOT VERIFIED** — the previous audit's finding stands unrefuted, with the added observable that no news has been published or updated since 2026-09-26.
6. **CBT (recheck).** Four active banks are served (`JAMB UTME`, `WAEC SSCE`, `Post-UTME`, `NECO SSCE`) with durations 120/120/90/120 minutes. Per-exam question counts, subject coverage and answer integrity were verified previously and are re-verified structurally by the migration replay and the `cbt_bank_readiness` report, but not against live rows in this pass (**live figures NOT VERIFIED**).
7. **Service catalogue.** `/api/services` returns 4 active services (`nelfund-loan`, `results`, `jamb-slip`, `admission-letters`); the catalogue holds 24 rows, the remainder deactivated by later migrations (`20260924_retire_legacy_scratch_service.sql`, `20260925_public_release_security_hardening.sql`). Reconciliation: 24 catalogue entries, 4 live workflows — not a contradiction.
8. **Not checked live (no database access):** duplicate institutions, orphan service requests, orphan CBT attempts, impossible dates, null profile fields, and referential integrity. The `content_integrity_report()` RPC exists for exactly this and should be run by an operator; treat these as **NOT VERIFIED**.

---

## 12. Operational Readiness

- **Deployment — VERIFIED.** GitHub → CI → Netlify → Supabase is live. The public origin serves the merged commit's behaviour (newsroom columns, generated robots/sitemap), HTTPS is in place, `/api/health` returns `{"status":"ok"}`, `/api/health/ready` returns `{"status":"ready", …database ok, database_latency_ms: 355}`, `/robots.txt` and `/sitemap.xml` are generated from the database, and `/api/*` routes through the Netlify function. Assets are `immutable`, `index.html`/`sw.js` `no-store` per `public/_headers`. Cold-start behaviour, function timeouts and the newsroom run's duration limits remain unmeasured.
- **Deployment rollback — NOT VERIFIED.** Netlify offers deploy rollback, but no procedure, owner or rehearsal is documented.
- **Scheduled jobs — RED.** One scheduled function exists (`@daily` newsroom refresh, which also performs image repair, news expiry and opportunity closure). Its registration and execution are unverified; the analytics retention prune is not scheduled at all; `prune_scheduled_job_runs` is never called. Job recording is best-effort and secret-safe (`src/server/jobRuns.ts`), so a job cannot fail because telemetry failed.
- **Monitoring — PARTIAL.** Liveness and readiness are separated correctly and readiness fails closed (verified: 503 with an explicit body locally when unconfigured). Job health, run history and error summaries are recorded server-side. There is no metrics/APM, no error tracker, and no dependency-level health beyond the database read.
- **Alerts — RED.** None. `docs/operations/PRODUCTION_RUNBOOK.md` §13 states this plainly and offers polling of `/api/health/ready` plus a scheduled check of `/api/admin/jobs` as a substitute; neither polling job exists in the repository, and no external monitor is evidenced.
- **Backups / recovery — RED.** See CRIT-1.
- **Support — AMBER.** WhatsApp (`wa.me/2349130134969`) is the only live channel; `/support` is a placeholder; service requests are trackable in the dashboard for signed-in students; there is no issue-intake process for content, account or privacy problems (MED-5).
- **Administration — AMBER.** An administrator can run content, services, CBT, users, institutions, opportunities and analytics from the console with capability-scoped sections and honest denial screens. They cannot, without API/database access: see scheduled-job health, read the data-quality report, review a full audit log, schedule/maintain retention, correct news categories in a guided way, or perform any recovery step (MED-13).

---

## 13. Codebase Health

- **Dead code / unused dependencies:** `@google/genai`, `canvas-confetti` (+types), `motion` have no imports; `autoprefixer` has no PostCSS configuration (LOW-1). `src/server/whatsapp.ts` is unused (MED-8).
- **Dormant schema:** `student_wallets`, `student_wallet_transactions`, `payment_events`, `campus_posts`, `campus_post_likes`, `campus_post_comments`, `past_questions`, `resources`, `edureach_material_notes` (MED-10).
- **Duplicate systems:** none found. Netlify and Docker deliberately share one Express app; the client and server share `src/lib/*` modules rather than reimplementing them; the services list, sitemap and router share `src/data/liveServices.ts`; SEO indexability is mirrored deliberately between `src/server/seo.ts` and `src/lib/seoMeta.ts` and is covered by tests.
- **TODO/FIXME:** none in application source (`grep -rniE "\b(TODO|FIXME|HACK|XXX|WORKAROUND|TEMPORARY)\b"` matches only historical audit documents).
- **Deprecated/legacy paths:** five deliberate fallbacks remain for pre-newsroom databases (LOW-4); the production database no longer needs them.
- **Architecture consistency:** strong. One router, one API client, one capability model used by both client and server, one analytics taxonomy enforced by an audit script, header sets kept identical by test, migration replay on a real PostgreSQL engine.
- **Technical debt:** MED-12 (expiry coupling), MED-13 (missing operator surfaces), MED-14 (incomplete durable rate limiting), MED-10, LOW-4, LOW-7.
- **Test suite:** 346 tests across 22 unit/spec files plus Playwright (desktop + mobile Chromium) executed only in CI. `tests/ci.test.ts` fails if any gate stage disappears, softens or changes order; `tests/migrations.test.ts` applies all 42 migrations to real PostgreSQL (PGlite) and executes the defined functions; `tests/headers.test.ts` prevents the two header sources from drifting.

---

## 14. Production Verification

**VERIFIED**

| Claim | Evidence |
|---|---|
| Production is deployed on Netlify and serves the merged `main` | Live `https://edureachhub.netlify.app` renders newsroom-era content; `/api/news` returns the migrated column set; `robots.txt`/`sitemap.xml` are generated by the deployed Express app |
| API liveness and readiness | `/api/health` → 200 `{"status":"ok","service":"edureach"}`; `/api/health/ready` → 200 `"ready"`, `supabase_configured` ok, `database` ok, `database_latency_ms: 355` |
| Crawler surfaces | `/robots.txt` disallows `/api/`, `/admin`, `/dashboard`, `/profile`, `/settings`, `/search`, CBT practice/results/setup, tracker, auth routes; sitemap lists 14 static paths + 4 live service pages + ~329 institution pages + 21 news articles |
| Public data APIs | `/api/news` (governed columns present), `/api/opportunities` (2 items), `/api/cbt/exams` (4 banks), `/api/services` (4 active), `/api/upcoming` (NECO deadline 2026-10-26T22:59Z) |
| Public journeys | Homepage, news list, category filter (jamb), article page with source attribution and "Last verified", jobs page, search (3 correct results), 404 page, protected-route redirect |
| Local quality gate at `aa60b53` | typecheck clean; **346/346** tests pass; `schema:audit` no blocking findings; build clean; `perf:audit` 10/10 budgets (entry 91.9 KB gzip ≤100; critical path 194 KB ≤210; 58 chunks 282.7 KB ≤310); `analytics:audit` clean; `rls:audit` 36/36 classified, 0 findings; `a11y:audit` 0 blocking / 4 informational; `npm audit` 0 vulnerabilities |
| CI | `quality-gate` check-run on `aa60b53` = success (run 36935209582), steps including "Install Playwright Chromium" and "Run authoritative CI gate" all success |
| Security headers (Express path) | Live local production build returns CSP (no `unsafe-inline`/`unsafe-eval` for scripts), HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| Fail-closed behaviour | Local unconfigured production server: `/api/health/ready` → **503 degraded**; `/api/admin/users` unauthenticated → **401** |
| No committed secrets | `git log -S "eyJhbGciOi"` → synthetic test fixture only |

**NOT VERIFIED** (dependency missing named in each case)

- Any authenticated journey: registration, email verification, login/session restoration, profile save, dashboard, service submission/tracking, CBT attempt/submission/result (no test account, no credentials).
- Live RLS/authorization through Supabase Auth/PostgREST and live storage policies (no Supabase service key).
- Scheduled job registration and execution, Netlify function logs, Netlify environment variables (no Netlify account access).
- Netlify response headers for static assets and the `/api/*` proxy path (sandbox cannot issue raw HTTP requests; the available fetch tool returns rendered content, not headers).
- What Supabase's backup tier actually provides (no project access).
- Cross-browser (Firefox/WebKit), real assistive technology, real mobile devices.
- Field performance data (no traffic/CrUX access).
- Whether the school finder list resolves in a real browser (MED-11) — two production renders showed only the loading state.
- Exact live counts for CBT questions/subject coverage and the precise number of news rows with uncontrolled categories (public API is limited to 30 items; no DB access).

**BLOCKED**

- Applying a verification browser locally (`npx playwright install` → download failure; `--with-deps` → apt package errors). The E2E suite therefore could not be executed here; its CI execution is evidenced by the successful gate step, not by this environment.
- Setting or reading branch protection with the available token (403/`protected:false`).

---

## 15. Recommended Remediation Order

Respect dependencies; do not reorder within a band without a dependency reason.

**Stage 0 — decisions that unblock everything else (business/product, not engineering)**
1. Confirm Netlify owns production and disconnect the Vercel project (MED-4), then correct D5 and the readiness audit.
2. Confirm the intended storage posture for `admin-content` (public read for image URLs) and the retention/removal decision for dormant financial tables.

**Stage 1 — CRITICAL**
3. CRIT-2: align the storage rule across migration, validator, test and runbook §6; add the exemption test. (Small, unblocks the GO gate.)
4. CRIT-1: document and rehearse recovery — Supabase backup tier/PITR state, restore rehearsal with date, deployment rollback, migration pre-snapshot policy, credential rotation, emergency admin path.

**Stage 2 — HIGH**
5. HIGH-1: require `quality-gate` on `main`; re-verify `protected: true`.
6. HIGH-2: verify one real scheduled run, add an admin Jobs panel, add an operator alert destination, add an external readiness check.
7. HIGH-6: schedule the analytics retention prune (or fold it into the daily job as its own recorded run) so job health is meaningful.
8. HIGH-3: publish Privacy Policy and Terms, link them from signup and the footer, and define the deletion/export request path.
9. HIGH-4: verify or de-claim the two opportunities; add `last_verified_at` display and a stale badge.
10. HIGH-5: run the authenticated cross-user probe matrix and `supabase/ci/production-validation.sql` against production; attach results to the release record.

**Stage 3 — MEDIUM**
11. MED-1: normalise news categories to slugs, add the constraint, replace free text in the CMS, surface `unknown_categories`.
12. MED-13: add Jobs / Data Quality / Audit Log console panels (endpoints already exist).
13. MED-12: decouple opportunity expiry from the newsroom job; backfill `expires_at` for time-bound notices and surface an expired state.
14. MED-7 and MED-14: durable limits for CBT question reads and analytics ingest; document the practice-bank decision.
15. MED-8: either wire notification delivery or relabel the preference toggles.
16. MED-11: confirm the school finder resolves; move the directory read server-side if it is a latency problem.
17. MED-2: institution enrichment with provenance (no fabricated URLs).
18. MED-3: prerender/edge-render metadata for article, institution, jobs and news routes.
19. MED-5: define and publish the support intake → triage → response → resolution path.
20. MED-6: extend search to institutions and events.
21. MED-9: Firefox/WebKit CI projects, assistive-technology checklist, mobile layout checks for dashboard/CBT/admin.
22. MED-10: decide and document dormant-table retention.

**Stage 4 — LOW**
23. LOW-1 (remove unused dependencies), LOW-2 (correct drifted documents), LOW-3 (pin Node), LOW-4 (set removal criteria for legacy fallbacks), LOW-5 (remove the Netlify badge), LOW-6 (align index.html caching), LOW-7 (migration naming), LOW-8 (document the local-preview PII path).

**Stage 5 — ENHANCEMENTS**
24. §8 items 1–10, only after the stages above.

---

## 16. FINAL RELEASE GATE

**What prevents release?** Nothing confirmed prevents the public, anonymous platform from operating today — it is live, healthy and serving real data. Two things prevent it from being declared **READY**:

1. **CRIT-1** — no documented or tested recovery. A platform holding student PII cannot be called production-ready while a bad migration or an accidental delete has no practised path back.
2. **CRIT-2** — the storage rule contradicts the implementation, so the documented GO gate (`prod:validate` + runbook §6) cannot pass without either breaking published images or changing the gate. Until it is resolved, "GO" is not meaningful.

**What must be verified (evidence still owed, in priority order)?**

1. One authenticated pass of both critical journeys on production with seeded accounts: register → verify → login → profile → dashboard, and CBT start → answer → refresh → submit → score (Journey A/C) plus a service request submit → status change → notification (Journey D/H).
2. Live cross-user RLS probes and `supabase/ci/production-validation.sql` output.
3. One recorded successful run of the newsroom job and its health verdict.
4. The school finder list resolving in a real browser (MED-11).
5. Netlify-served headers on the live origin (static and `/api/*`).
6. Firefox/Safari behaviour for the critical flows, and a screen-reader pass on the dashboard and CBT hall.

**What can wait until after launch?** Prerendering/social metadata (MED-3), institution enrichment (MED-2), search unification (MED-6), dormant-table decisions (MED-10), unused-dependency removal (LOW-1), the Netlify badge (LOW-5), and every item in §8.

**What should NOT be changed because it is already correct?** The Netlify production topology (`netlify.toml`, function wiring, crawler redirect order); the Express/serverless single-app design and the Docker path; the capability model and the server-derived identity rule (`lib/auth.ts`, `lib/authorization.ts`); the service-request RLS policies and the trigger-generated reference code; the CBT server-side scoring and owner-scoped RPCs; the analytics allowlist/taxonomy; the header sets and their drift test; the migration history (all 42 apply in order and must not be rewritten); the newsroom pipeline structure; the RLS posture migration; the specific decision *not* to seed student data or fabricate content.

**What requires a user/business decision rather than an engineering decision?**

1. Platform ownership: Netlify vs Vercel (MED-4).
2. Whether `admin-content` is intentionally public and whether practice banks may be fully public (MED-7).
3. Privacy Policy and Terms content, retention periods, and the deletion/export promise (HIGH-3).
4. Editorial standards for opportunity verification and expiry, and the correction of the two live opportunities (HIGH-4/MED-12).
5. The support model and response commitments (MED-5).
6. Whether to fund a Supabase plan with guaranteed backups/PITR, and who owns the recovery rehearsal (CRIT-1).

**Release classification: CONDITIONALLY READY.** The product is deployed, the public experience works for anonymous users, the code-level security model is coherent and tested, and the local gate is green with 346 passing tests. It is not READY because six conditions above (recovery, release-gate integrity, authenticated verification, alerting, consent documents, and opportunity data truthfulness) are unresolved, and it is not NOT READY because no confirmed defect blocks normal public operation.
