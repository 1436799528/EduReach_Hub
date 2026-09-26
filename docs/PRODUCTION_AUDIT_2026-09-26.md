# EduReach Repository Production Audit — 2026-09-26

**Scope:** repository-wide static and test-gate audit of the checked-out branch before remediation. This report was written before code changes. It covers application, API, auth, Netlify/Express, Supabase migration history, service worker, routing, tests, and CI configuration. The live Supabase project, Netlify deployment, external integrations, GitHub Actions run API, and production credentials were not available to this audit; database/runtime claims are limited to repository evidence and local tests.

## Executive assessment

**Release status: NOT VERIFIED / DO NOT CLAIM PRODUCTION-READY.** `npm ci` succeeds and reports 0 known vulnerabilities. The authoritative local gate `npm run ci` currently fails during the Node test suite (128 passed, 3 failed; 131 total). It therefore does not reach the build, E2E, or `npm audit` stages. The workflow is configured to run that same gate, so a CI run on this checkout should fail before completing quality checks.

A broader schema-reproducibility issue is visible in migration history: later migrations alter and query core tables whose original `CREATE TABLE` definitions are absent from the checked-in migrations. In addition, a migration dated 2026-09-27 is ahead of this audit date and performs unguarded data updates against tables assumed to exist. A clean-database migration replay cannot be certified from this repository.

## Findings

### CRITICAL

No confirmed critical exploit or data exposure was demonstrated in this repository-only pass. This is not equivalent to a penetration test or live RLS verification.

### HIGH

#### H1 — Authoritative CI gate fails in the checked-out state
- **Issue:** `npm run ci` exits nonzero in the test stage: 128 pass, 3 fail. The first failure is `Cannot read properties of undefined (reading 'PROD')` at `src/lib/api.ts:213`; importing API helpers under Node evaluates `import.meta.env.PROD`, but Node's test runner does not provide `import.meta.env`.
- **Root cause:** browser/Vite-only environment access is evaluated at module top level in a shared module imported by Node tests. `src/lib/supabase.ts` has a defensive environment read, but the adjacent API module does not.
- **Affected files/features:** `src/lib/api.ts`, `tests/config.test.ts`, `tests/error-sanitization.test.ts`; also any Node consumer of the API module.
- **How it fails:** `tests/config.test.ts` fails when it dynamically imports `ExamSimulatorGrid` (which imports the API module); the error-sanitization test file fails at module load for the same reason.
- **Why existing tests missed it:** the relevant test imports exist but the committed gate is presently red; a production Vite build substitutes the Vite global and does not exercise plain Node module evaluation. The workflow has not been run against this exact checkout during this audit.
- **Recommended fix:** make runtime/build environment selection safe when `import.meta.env` is absent, while preserving Vite production behavior; add a Node regression test that imports the module without Vite globals.
- **Regression risk:** incorrect fallback could point production API calls at `/api` rather than the Netlify function path.

#### H2 — Migration history cannot independently recreate the deployed data model
- **Issue:** migration files use `profiles`, `service_requests`, `service_catalog`, and other existing relations without any checked-in baseline `CREATE TABLE` definitions for several core tables. Some newer migrations create selected objects (including `institutions` and telemetry), but do not provide the full base schema. The 2026-09-27 `postmerge_data_control` migration contains unguarded DELETE/UPDATE statements against `news_articles` and `cbt_exams` before guarded additions.
- **Root cause:** migration history is a partial set of changes against an assumed pre-existing Supabase project rather than a complete, reproducible schema history. Existing live schema may have been created manually/out of band.
- **Affected files/features:** `supabase/migrations/*`, auth/profile, service requests/catalogue, CBT, News, admin resources, and clean environment setup.
- **How it fails:** replaying the repository migrations on a clean Supabase database can fail at the first reference to a missing base table, so subsequent RLS, RPC, grants, and feature assumptions never become deployable. The future-dated migration adds an additional ordering/verification concern.
- **Why existing tests missed it:** Node tests stub auth and exercise API boundaries without a PostgreSQL instance; no migration replay/drift CI job or schema dump is present. A successful application build cannot validate SQL objects.
- **Recommended fix:** obtain an authoritative schema-only dump/baseline from the actual intended project, reconcile it into a safe migration sequence, and validate all migrations on an empty disposable Supabase/Postgres-compatible database before deployment. Confirm the dated post-merge cleanup is actually intended before applying it.
- **Regression risk:** high—schema reconstruction or out-of-order migrations can destroy/alter real data if not tested and reviewed against staging snapshots.

### MEDIUM

#### M1 — User-facing error normalization can still stringify nested objects
- **Issue:** `userFacingError()` may call `String()` on untrusted object-valued `message`, `details`, or `hint` fields; Express `publicErrorMessage()` also falls back to `String(value)` for non-Errors. A malformed/alternate API error shape can therefore produce `[object Object]`, contrary to the intended error contract. Several page handlers display `error.message` directly rather than the shared sanitizer.
- **Root cause:** there are parallel client/server normalization implementations and string coercion accepts objects; not all UI catch paths use a shared safe boundary.
- **Affected files/features:** `src/lib/api.ts`, `server.ts`, plus direct error renderers in service application, profile, school/news/CBT/admin-facing pages.
- **How it fails:** an error shaped like `{ message: { reason: '...' } }` or `{ details: { ... } }` is converted to a generic object string; database errors thrown from direct Supabase calls may reach page state with backend text.
- **Why existing tests missed it:** current sanitizer tests cover string/Error examples only. In this run, the sanitizer test file cannot even import `api.ts` due to H1.
- **Recommended fix:** define one defensive unknown-value normalizer (only admit bounded strings from known fields, redact implementation detail patterns, use safe fallback for non-strings) and route every user-visible catch path through it; test nested objects, arrays, cyclic objects, raw database details, and network shapes.
- **Regression risk:** over-redaction can hide useful validation messages; preserve explicit safe server validation messages and add behavior tests.

#### M2 — Service-worker regression test contradicts implemented cache policy
- **Issue:** `tests/service-worker.test.ts` expects a request for `/icons/logo.png` to cache `/assets/app.js`; actual worker correctly caches the requested stable icon. This is a failing test independent of the Node import failure.
- **Root cause:** assertion was copied from a different fixture/request and no longer describes the service worker's cache behavior.
- **Affected files/features:** `tests/service-worker.test.ts`; service-worker stable-asset cache policy.
- **How it fails:** gate reports an assertion mismatch (actual icon URL versus unrelated JS asset URL).
- **Why existing tests missed it:** this test currently fails when the suite runs; it may have been introduced or edited without running the full suite.
- **Recommended fix:** assert the actual requested stable asset is cached and separately assert hashed JS/CSS assets are not intercepted/cached.
- **Regression risk:** low, if the corrected assertion reflects the documented intended policy rather than weakening coverage.

#### M3 — API base-path logic is duplicated across application entry points
- **Issue:** `src/lib/api.ts`, `src/app/App.tsx`, and admin components independently select API base paths via `import.meta.env.PROD`. This contributes to the test-only crash and risks drift between fetch helpers, analytics, and admin endpoints.
- **Root cause:** multiple local environment-dependent path selectors rather than a central API transport configuration.
- **Affected files/features:** public API calls, admin API calls, analytics, local Express and Netlify deployments.
- **How it fails:** a build/runtime mismatch or later path change can make only a subset of features target the wrong endpoint.
- **Why existing tests missed it:** current tests do not exercise every API call under both Vite development and Netlify production modes.
- **Recommended fix:** centralize the browser-safe API base/path resolver, and verify dev `/api` plus production Netlify routing in integration smoke tests.
- **Regression risk:** medium because Netlify's direct function path and `/api/*` redirect behavior must remain aligned.

#### M4 — Live auth, admin permissions, and database boundaries are not integration-verified
- **Issue:** committed tests exercise a local Supabase HTTP stub and anonymous API rejection, not real Auth refresh/recovery, deployed RLS, role grants, service-role operations, storage authorization, real admin CRUD, or real student workflows. `verifyAdminToken` maps `admin`, `super_admin`, and `moderator` to the same unrestricted admin class; whether this is intended least privilege is not documented.
- **Root cause:** no staging integration suite/environment or explicit granular admin capability matrix is available in this repository gate.
- **Affected files/features:** authentication, profile completion, admin actions, uploads, student service requests, CBT persistence, and all RLS-protected tables.
- **How it fails:** an out-of-band policy/schema difference, refresh configuration issue, or overprivileged moderator may work in local stubs but fail or authorize too much in production.
- **Why existing tests missed it:** test-only fake Supabase contract and no configured live backend; E2E is intentionally unconfigured and checks protected routes, not real authenticated journeys.
- **Recommended fix:** run a non-production staging matrix with student/admin/moderator/anonymous identities, cross-user denial, refresh/logout, uploads, complete admin CRUD, and CBT concurrency. Document role capabilities and enforce them server-side if roles are intended to differ.
- **Regression risk:** medium/high for permission changes; validate existing staff workflows before reducing privileges.

#### M5 — Student CBT completion and guest CBT abuse limits lack end-to-end stress evidence
- **Issue:** the authenticated submission path has row-locking/transaction logic in migrations, but no concurrent integration test runs it against PostgreSQL. The public guest-submit endpoint accepts requests without an app-level rate limit and computes/replies with all bank answers after submission.
- **Root cause:** correctness/security rely on SQL behavior and external edge controls that are not verified by this repo's Node tests. Practice answer review appears intentional, but endpoint resource abuse is not bounded in application code.
- **Affected files/features:** `server.ts` CBT guest-submit/start/submit paths and CBT migrations.
- **How it fails:** high request volume can repeatedly query/score large banks; unverified SQL conflicts/retries could expose inconsistent attempts under race conditions. Correct answers are intentionally returned after guest submission, so content must not be treated as a confidential high-stakes test bank.
- **Why existing tests missed it:** no database concurrency/load test and no edge/WAF configuration inspected.
- **Recommended fix:** establish and test deployment-level rate limits and request-size limits for guest CBT; staging-test concurrent starts/submits, retries, expiry, ownership and partial failures against the exact migrations.
- **Regression risk:** rate limiting can block legitimate shared-campus traffic; set thresholds based on expected usage and test retry behavior.

### LOW

#### L1 — TypeScript gate is permissive and `lint` is not lint
- **Issue:** `npm run lint` aliases `tsc --noEmit`, and the TypeScript configuration does not enable strict mode. This misses many unused imports, accessibility, hook, and correctness diagnostics.
- **Root cause:** no dedicated ESLint/format/accessibility static analysis or strict type-check profile.
- **Affected files/features:** whole TypeScript/React codebase.
- **How it fails:** dead code, unsafe `any`, implicit null assumptions, and UI/accessibility defects may pass the type gate.
- **Why existing tests missed it:** no lint rules or strict compiler settings are executed.
- **Recommended fix:** introduce an incremental lint/strictness plan (start with unused imports and strict null checks) without changing business code simply to silence tools.
- **Regression risk:** broad existing errors can make adoption noisy; ratchet gradually and keep CI actionable.

#### L2 — Local development and production use different API paths/configuration
- **Issue:** local Express serves `/api`; production browser code targets `/.netlify/functions/api`, while Netlify also rewrites `/api/*`. Those configurations are plausible but not exercised against an actual Netlify function runtime.
- **Root cause:** two deployment architectures share one frontend with build-time selection.
- **Affected files/features:** all browser API clients, `netlify.toml`, `netlify/functions/api.ts`.
- **How it fails:** only Netlify production can show function routing, cold-start, function bundle, or timeout defects not reproduced by Express build smoke tests.
- **Why existing tests missed it:** no Netlify CLI/runtime integration test in `npm run ci`.
- **Recommended fix:** add a Netlify deploy-preview/function smoke gate with safe test configuration; do not treat local Express behavior as proof of Netlify compatibility.
- **Regression risk:** low to medium; retain direct `/api` route compatibility and browser relative URLs.

### INFORMATIONAL

- `npm ci` passed on Node 22.22.3/npm 10.9.8 and reported **0 vulnerabilities** in the installed lockfile graph. This is the install-time audit result only; `npm audit --audit-level=low` is after the failing test stage and was not independently run yet.
- `package.json` defines `typecheck`, Node `node:test` unit tests, Vite/Express production build, Playwright E2E, `npm audit`, and `ci` as a sequential aggregate (`typecheck → unit → build → E2E → audit`). GitHub Actions installs Node 22.22.x and Chromium then runs `npm run ci`.
- Routing is a custom history/popstate router with lazy-loaded pages and an error boundary; client route definitions and admin route shell are present. E2E covers many direct public paths and unauthenticated protected paths but not every feature interaction.
- Service worker intentionally bypasses APIs, documents use network-first, and JS/CSS bundles are excluded from interception. This policy is directionally protective against stale hashed chunks; its test currently has the incorrect cache target described in M2.
- `.env.production.example` contains a project URL and placeholders, not a service-role secret. Browser keys are expected to be public; server secret keys are not Vite-prefixed. Verify actual deploy environment independently.
- A successful `npm ci`/build does not establish migration correctness, live RLS, external integrations, mobile accessibility, load safety, or production readiness.

## Cross-System Risk Map

```text
Node/Vite environment mismatch (H1)
  ├── shared API module import
  │     ├── API/error helper tests fail
  │     ├── CBT setup component tests fail
  │     └── any Node-side tooling importing API module fails
  └── duplicated PROD path selectors (M3)
        ├── public API calls
        ├── admin API calls
        └── analytics

Incomplete migration baseline (H2)
  ├── core profiles/service tables
  ├── RLS/grants/RPC dependencies
  ├── student auth/profile workflows
  ├── admin analytics/catalogue CRUD
  └── CBT starts, answer persistence, submissions/results

Unsafe error coercion (M1)
  ├── Supabase/PostgREST unknown error shapes
  ├── shared API helper normalization
  ├── Express content-import/admin error serialization
  └── page catch handlers → possible [object Object]/internal message

Missing live integration/performance proof (M4/M5)
  ├── auth refresh + protected routes
  ├── role authorization + service-role mutations
  ├── database RLS and schema parity
  ├── CBT locking and retry behavior
  └── public endpoint resource abuse
```

## Audit boundaries and required deployment follow-up

This report describes repository findings, not a live production penetration or migration review. Before production certification, obtain database schema/RLS/policy/function dumps, replay migrations on a clean staging project, run authenticated staging E2E and concurrency tests, verify Netlify function deployment and environment variables, and inspect actual GitHub Actions results. Do not apply an unreviewed schema baseline or the future-dated cleanup migration to production.

## Remediation and verification addendum (2026-09-26)

The audit report above was created before implementation changes. These fixes were then made and verified:

- **H1 fixed:** added a browser-safe shared API path resolver (`src/lib/apiBase.ts`) whose unconfigured Node behavior is `/api`; `api.ts`, analytics, admin health, and the admin shell now share it. Node tests that import API/UI code now load successfully.
- **M1 fixed for user-facing paths:** created `lib/errors.ts` as a single environment-neutral normalizer. It never converts object values with `String()`, safely selects string-valued known fields, hides database/framework details, and keeps safe validation messages. Express and browser code now use it; catch-to-UI handlers across student, public, and admin pages were migrated. Admin import row errors and direct Supabase API helper failures also pass through it. `jsonFetch` rejects malformed successful responses (except intentional HTTP 204) with a safe message. Regression tests cover object-shaped errors, DB details, network failures, and safe validation text.
- **M2 fixed:** service-worker test now expects the stable icon that was actually requested and separately verifies hashed JS/CSS bypass.
- **M3 fixed:** API base selection is centralized.
- **Typecheck/unit/build re-run:** `npm run typecheck` **PASS**; `npm test` **PASS (136/136)**; `npm run build` **PASS** (Vite client and Express server bundle). `npm audit --audit-level=low` **PASS (0 vulnerabilities)**. A clean `npm ci` **PASS**.
- **E2E/CI root cause found and fixed:** the first actual PR workflow (`36270914075`, PR #9) failed two E2E assertions, desktop and mobile, in `unconfigured login fails closed`. The shared normalizer's broad `/not available/` mapping rewrote the safe product-specific sign-in configuration message into an unrelated service-unavailable message. Narrowed the mapping to explicit service-unavailable phrases and added a regression test preserving the account-service copy. This was a genuine regression from the shared error-handling change, not an infrastructure-only failure.
- **Full `npm run ci`: PASS after fix** when run with Chromium from an npm-distributed browser package plus its required NSS/NSPR shared libraries extracted to `/tmp` (no project dependency or repository file added). Results: typecheck pass; unit tests **137/137**; production build pass; Playwright desktop/mobile **116/116**; `npm audit --audit-level=low` **0 vulnerabilities**. On an unprepared machine, `npm ci && npm run ci` still requires Playwright browser plus OS dependencies; CI's `npx playwright install --with-deps chromium` provides these in hosted runners. Chromium download and Debian apt mirrors were blocked in this sandbox, so a temporary npm package route was used to complete local E2E without modifying package manifests/lockfile.
- **Actual GitHub Actions verification:** after pushing the regression fix, authoritative `EduReach production checks` run **36271260964** on PR #9 completed **successfully** (`quality-gate` pass, 1m22s). Netlify deploy-preview status also passed. The prior run `36270914075` failed on the two assertions described above; the new run on the fix is green.

**Remaining findings:** H2 (schema/migration reproducibility), M4 (live Auth/RLS/role validation), M5 (staging CBT concurrency/abuse limits), L1 (permissive TypeScript/no dedicated lint), L2 (Netlify runtime not exercised), and missing live Supabase/Netlify integration evidence remain open. Consequently this audit does **not** certify the complete deployed application as production-ready.
