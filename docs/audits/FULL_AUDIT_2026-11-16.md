# EduReach Hub — full repository audit

**Audit date:** 16 November 2026 (UTC)  
**Branch:** `arena/83ba49ac-edureach-hub`  
**Audited base:** `722cee772e02b8aaf363d5c24c5463f75f2f11e3`  
**Outcome:** Core code and database checks pass. Release readiness is **not fully verified**: browser E2E could not run in this environment, and no production Supabase/deployment credentials were available.  
**Changes made:** This report only; no application, database, or deployment configuration was changed.

## Executive summary

The static quality gates, all 1,070 unit tests, production build, local migration/restore rehearsal, schema/RLS checks, performance and analytics audits, and dependency vulnerability audit passed. A local HTTP smoke inspection also confirmed the API health endpoint, safe unknown-API response, and crawler endpoints.

The full `npm run ci` gate did not complete. It stopped at Playwright E2E because the required Chromium binary was absent. Installing it was attempted, but the browser download from `cdn.playwright.dev` failed with `ECONNRESET`. The E2E cases therefore **did not execute**; their launch errors are environment-blocked tests, not evidence of 306 application defects. The subsequent browser performance suite was not reached.

Production configuration and live data were not inspected. The local environment has no Supabase project URL or keys. `prod:validate` therefore reports required configuration missing and skips live checks. No live Supabase, Netlify, or Vercel system was contacted or modified.

## Findings and actions

### A1 — Production readiness remains unverified — release gate

The local environment lacks `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NODE_ENV`. Consequently:

- `npm run prod:validate -- --json` reports missing required environment variables and skips its live Supabase checks.
- The local production build succeeds with a warning and documented fallback behavior; it warns that visitor submissions will not persist without client Supabase configuration.
- The local `/api/health/ready` endpoint correctly returns `503 degraded` when Supabase is unconfigured.

**Action:** Before declaring a production release ready, run the documented production validation with the deployment's actual environment and perform the deployment smoke check. Keep secrets in deployment settings; do not add them to this repository. This finding is an absence of verification in this audit, not proof that the hosted deployment is misconfigured.

### A2 — Browser E2E and browser performance gates are blocked in this environment

`npm run ci` reached `npm run test:e2e`, where Playwright could not launch Chromium because its executable was absent. `npx playwright install chromium` then failed to download from `cdn.playwright.dev` (`ECONNRESET`). The E2E attempt recorded 306 launch failures and 20 skipped cases; the launch failures share the missing-browser cause. `npm run e2e:perf` was not reached by the CI chain.

The GitHub Actions workflow does install Chromium before running CI (`.github/workflows/production-checks.yml`), but this audit did not query remote workflow runs.

**Action:** Re-run `npm run ci` in an environment where the Playwright Chromium download/cache is available. Treat browser E2E and performance status as **unverified**, not passing.

### A3 — Vercel is not a functioning API deployment fallback as currently configured

`vercel.json:37-41` rewrites every unmatched path to `/index.html`, with no `/api` route or serverless function entry. Meanwhile `src/lib/apiBase.ts:1-7` says production uses a separately deployed Vercel backend and supports `VITE_EDUREACH_API_URL`. If this repository is deployed to Vercel without a separately deployed API origin configured, API calls will resolve to the static SPA fallback rather than this Express API. The deployment decision record says Netlify is the intended target and explicitly notes that Vercel lacks an API route (`docs/DEPLOYMENT_DECISION.md:52-63`).

**Action:** Keep Netlify as the sole production target as documented, or—if Vercel is intentionally selected—add and test a real API deployment/rewrite and configure the frontend API origin. Also reconcile the stale Vercel wording in `src/lib/apiBase.ts` with the current deployment decision. This is conditional on using Vercel; it does not indicate a failure of the documented Netlify path.

### A4 — `docs/BUILD-STATUS.md` is materially stale

The file describes a documentation-only backend discovery milestone on a different branch and records 85 migrations. The checked-out project contains a working application and 90 migrations. The file's milestone state is therefore not a reliable description of this checkout.

**Action:** Retitle/archive it as historical backend-discovery context, or replace it with a current build/status summary. Do not use it to make release decisions.

### A5 — Production question-bank duplicate audit not performed

`npm run duplicate:audit` safely reported `BLOCKED` because authorized Supabase read credentials were absent. No production questions were examined or changed. The script itself notes that exact analysis is capped at 20,000 rows and near-duplicate analysis samples only the first 200 rows.

**Action:** If content-quality sign-off requires duplicate review, run it with approved read-only/least-privilege access and record its caps and coverage. No production-data conclusion can be drawn from this audit.

## Verification results

| Area | Result | Evidence / limits |
|---|---|---|
| Dependency installation | Pass | `npm ci`; 263 packages audited, 0 vulnerabilities reported by install. |
| TypeScript | Pass | `npm run typecheck` (`tsc --noEmit`). |
| Unit tests | Pass | `npm test`: 1,070 passed, 0 failed, 0 skipped. |
| Production build | Pass with local-env warning | `npm run build`; Vite client and bundled Express server built. Client Supabase env was absent, so this was not a production-configured build. |
| Schema audit | Pass | 90 migrations; no hard failures, missing required objects, or creation-order failures. Nine candidate-only RPCs are identified as requiring the reviewed restricted-bank migration; the audit reports no blocking findings. It also reports deferred runtime references and guarded dynamic SQL that are not statically resolved. |
| Migration checklist | Pass | All 90 migration files are listed by the production validation checklist. |
| RLS posture | Pass | 53/53 public tables classified, 0 findings. This is the repository's local migration replay, not a live hosted-database inspection. |
| Backup/restore rehearsal | Pass, local-only | Applied all 90 migrations to PGlite, backed up and restored representative seeded rows; schema/security fingerprint matched (53 tables, 616 columns, 59 policies, 53 RLS-enabled tables). Does not prove a hosted Supabase backup can restore. |
| Performance budget | Pass | 10/10 checks; 365.4 KB gzip across all chunks against the 366 KB budget. |
| Analytics taxonomy | Pass | Taxonomy, call sites, server validation, docs, and 90-day retention declaration agree. |
| Static accessibility | Pass with informationals | 0 blocking findings; 6 informational findings. Browser/axe E2E was blocked with the other browser tests. |
| Dependency security | Pass | `npm audit --audit-level=low`: 0 vulnerabilities. |
| Local HTTP behavior | Pass / expected degraded state | `/api/health` 200; `/api/health/ready` 503 due to missing Supabase config; unknown API route JSON 404; `/robots.txt` and `/sitemap.xml` 200. `X-Content-Type-Options: nosniff` observed. |
| Browser E2E/performance | Blocked | Chromium unavailable; download attempt failed at the external Playwright CDN. |
| Live production checks | Not run | No deployment/Supabase credentials supplied to the local process; no live systems contacted. |
| Git hygiene | Pass | `git diff --check` clean; generated build, test, and dependency directories are ignored. |

## Scope and caveats

This is a repository-level audit against the checked-out code and locally executable checks. It is not a penetration test, legal/privacy compliance review, live-cloud configuration review, or independent human UX review. RLS and backup claims above are limited to the committed migrations and isolated PGlite rehearsal. The audit did not mutate production data or deploy anything.

The dependency install created ignored local `node_modules`, build/test outputs are ignored, and no generated artifacts were added to Git. Apart from this report, the working tree remains unchanged.
