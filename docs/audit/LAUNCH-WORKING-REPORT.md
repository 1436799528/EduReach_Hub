# EduReach Hub launch working report

**Status: NOT READY FOR LAUNCH.** This is a working assessment, not a complete
audit or deployment approval. The scope spans more workflows than have been
verified. See `LAUNCH-BASELINE-2026-10-31.md` for the earlier repository and
read-only production inventory, news migration details and recovery plan.

## Coordination and environment

- The session continues on `arena/258c802c-edureach-hub`, based on main
  `b2e0a6c`; `8dad4fd` contains the news work. No PR, merge or deployment has
  been made for this branch. The existing GitHub Actions gate runs on pushes to
  main or PRs, not this branch. A temporary branch-only push trigger was tried
  but GitHub rejected the push because the connected GitHub App lacks workflow
  permission; that trigger and its test change were removed. Authoritative
  branch CI remains blocked until connection permissions or an approved PR route
  are available. An approved PR may trigger a Netlify preview.
- Open PR #31 changes Supabase key precedence and #32 contains privacy and legal
  work. Both were reported as having failing quality gates and Netlify previews.
  GitHub run metadata is available, but download of the detailed job logs failed
  in this environment. Do not infer the failure cause. Netlify account capacity,
  deploy logs and live configuration have not been inspected.
- Consent portions of #32 were adapted on this branch using the same preference
  key and banner architecture, with a fix for failed storage. The overlap must be
  reconciled with #32 before any merge; its separate static refund page has not
  been adopted, because policy content belongs in the existing site-pages CMS.
- The owner is handling restoration of inactive staging; it has not been started
  here. No production data, credentials, configuration or schema were changed.
  Earlier production metadata reads were read-only and are only a partial view.

## Finding and verification matrix

P0 denotes a possible security, integrity or core operational blocker; P1 is an
essential launch gate. P2/P3 are not permission to ignore a risk. Pending checks
are not claimed to have passed.

| Area | Existing implementation and work so far | Remaining issue / classification |
| --- | --- | --- |
| Release / CI | Existing GitHub quality gate and Netlify configuration inspected. The unconfigured preview build succeeds. | **P0/P1:** branch GitHub CI and Netlify preview need verification. Production build with real, safely configured variables, actual Netlify capacity and deployment not verified. |
| Privacy / analytics | Existing first-party `trackEvent` now checks the shared versioned preference; local tests exercise opt-in, rejection, no replay, malformed data, storage failure and visible save failure. Existing analytics taxonomy audit passes. | **P0/P1:** reconcile PR #32, audit all third-party/network transmissions. Local Chromium covers normal cross-tab/reload and intercepted analytics traffic, but not every transmission or storage failure across documents. If storage both rejects writes and cannot delete an old allow, this tab fails closed but durable cross-reload/cross-tab revocation cannot be guaranteed. Resolve and verify before launch. Server endpoint accepts direct requests; client gate is not a server-side consent attestation. |
| Service requests | Existing server endpoint, admin queue/dashboard, transition rules and notification writer reused. Updates use read-version/status compare-and-set; UI supplies its displayed version, and the note editor retains its opening version. Mock race tests reject a stale update before audit/notification. | **P0:** live insertion policy differs from checked-in active-service policy; hosted ownership, validation, duplicate prevention and persistence unverified. Real multi-session CAS and notification behavior unverified. Older clients now fail closed until refreshed. The authenticated staff UPDATE policy and table grant permit writes outside server capability/CAS checks, including roles without `service_request.process`; privileged writers that do not advance `updated_at` also bypass version freshness. Audit effective grants and all definer/privileged writers before a staged database repair; audit and notifications are still separate best-effort operations. |
| News | Existing branch adds marked unpublished drafts, dedicated confirmation, generic manager restrictions, paginated Newsroom, collision-safe optional seed and FK-aware deletion guard. PGlite and mock tests were run. | **P0/P1:** hosted Auth/PostgREST/RLS, browser workflows and migration compatibility remain unverified. A real PostgreSQL 17 concurrency test of the actual trigger on a minimal isolated schema passed; it is not a full migration replay or hosted Supabase test. Offset pagination is not a snapshot; the existing PDF selector remains limited to its first 200 results. Seed and migration require separate approvals. |
| Authentication / accounts | Existing Supabase auth, server capability checks and tests; no new auth system. | **P0:** hosted registration, verification, resets, sessions, ownership and role separation not verified. Inspect #31 and actual configuration without extracting or rotating secrets. |
| CBT | Existing subject rules, question bank, importer and local tests; no second engine created. | **P0:** full authenticated and guest journeys, JAMB exact rules, resume, expiry, retries, grading and hosted persistence remain to be verified end to end. Do not assert the local tests prove hosted operation. |
| Student dashboard / notifications | Existing dashboard, database helpers and notification writer inspected in part. | **P0/P1:** production metadata previously lacked several repo-expected student tables. Reconcile equivalents and migration history; verify ownership, persistence, status, error and delivery behavior. |
| Services / guides | Existing catalogue, guides and request system; no new system. | **P1:** guide edits, uploads, public instructions and complete student/admin request journey need hosted verification. Do not present local-only records as persisted submissions. |
| Resources and opportunities | Existing resources, PDF bank and opportunity manager; earlier inventory recorded counts only. | **P1:** validate sources, links, expiry, permissions, accessibility, provenance and admin workflows. Do not invent content. API additions are P2 unless required for launch. |
| Legal / support | Existing `LegalPage` and `site_pages` CMS. Operator identity, contacts and legal wording are owner/legal inputs. | **P1:** qualified Nigerian legal review, actual practices, age/parental-consent requirements and verified contact remain pending. Refund policy must use the CMS if needed; do not invent payment terms. |
| Database / Supabase | Repo migrations replay in isolated PGlite; a local restore rehearsal passed. Prior read-only metadata identified schema drift and service policy differences. | **P0:** reconcile live ledger, columns, relationships, policies, grants, SECURITY DEFINER functions/search paths, storage and Auth settings. Local shims are not hosted Supabase. No blind DDL. |
| Security | Server capability tests, offline RLS audit and dependency audit exist; npm audit found no advisories in the local lockfile. | **P0:** broader security, storage, secret/configuration, direct API, CSRF/CORS, rate limit and abuse reviews remain incomplete. Zero advisories is not proof of security. |
| Homepage / navigation | Existing homepage, navigation and assets retained. | **P1:** complete links, buttons, content accuracy, error/empty states and responsive/browser journeys remain unverified. |
| Accessibility / PWA / performance | Static accessibility audit and service worker code reviewed in part; privacy UI uses existing button styles. Static audit reported 0 blocking and 5 informational findings. | **P1:** real keyboard, screen reader, contrast, installability, cache isolation and Windows/Android browser tests remain pending. WCAG certification and offline CBT are not claimed. |
| Operations / feedback | Existing audit/notification/telemetry mechanisms retained. | **P1:** verify operator monitoring and safe logs. After launch capture, reproduce, classify, fix, test and record feedback through the normal release process. |

## Changes in this working slice

- `server.ts`, `pages/AdminQueuePage.tsx`, `pages/AdminDashboardPage.tsx`,
  `src/components/admin/AdminKit.tsx`, `src/lib/api.ts`: compare request status
  and `updated_at` at write time; send displayed versions from both admin views;
  preserve a note editor's opening version; return conflict without audit or
  notification when a competing update wins. Requests omitting a version are
  rejected with a refresh-required conflict; this can interrupt older open tabs.
- `src/lib/privacyPreferences.ts`, `src/components/CookieConsent.tsx` and CSS,
  `src/main.tsx`, `src/lib/api.ts`: adapt PR #32's existing first-party consent
  approach. Optional tracking is denied by default, and failed storage returns
  an error rather than pretending a choice was saved. No queued event replay.
- `scripts/perf-audit.ts`, `tests/perf.test.ts`: identify the actual HTML entry
  and include transitive static JS dependencies in the critical-path budget;
  tests cover multiple index chunks and missing/extra dependencies.
  Icon-grouping experiments were discarded because they increased the entry
  dependency set. Vite now uses Terser as a build-only dependency for client
  minification; budgets and server bundling were not changed.
- `tests/authorization.test.ts`, `tests/notifications.test.ts`,
  `tests/privacy-preferences.test.ts`: focused race, consent, transport and
  storage failure coverage. `tests/stylesheet-layers.test.ts` and
  `docs/architecture/STYLESHEET_LAYERS.md` record the new stylesheet in the
  required cascade order; focus and type closing-layer rules remain intact.
- No new migration, external API or design system was added in this working
  slice; Terser is a direct development dependency. The previously prepared news migration and optional seed
  are described in the baseline report, and have not been applied to a host.

## Latest executed local gates

- TypeScript passed; 66 focused authorization, notification, analytics and
  privacy tests passed. After reverting the rejected temporary CI trigger and
  its test change, the unchanged full local `npm run ci` passed: **763/763**
  unit/integration tests, all subsequent gates, and the browser suites below.
  The restored CI assertion also passed its targeted 9-test rerun.
- The unconfigured build passes; this is not a production environment build.
  `npm run perf:audit` passes **10/10**: total JS **331.5 KB / 336 KB**,
  critical path **207.4 KB / 211 KB**, entry **98.1 KB / 100 KB**. No budget
  was increased. Terser minification is a build-only dependency; npm audit found
  zero advisories after installation.
- A clean Chromium run before the minifier change had **158 passed, 2 skipped**
  (answer-option keyboard tests had no available exam). The invalid earlier run
  was discarded because assets were rebuilt while it was running. Four new
  consent tests passed on the Terser build (desktop and mobile): initial denial,
  no replay, shared consent and rejection across tabs/reloads, plus a storage
  error in the same tab. The complete Terser-build Chromium suite passed
  **162**, with **2 skipped** for missing CBT answer options. The separate
  throttled mobile performance test passed for `/`, `/news`, `/past-questions`.
  Hosted or authenticated flows were not tested.
- PostgreSQL 17.11, local and disposable: the actual news safety migration was
  applied to a minimal `news_articles`/`document_bank` schema with an
  `ON DELETE SET NULL` FK. In a three-connection test, an uncommitted reference
  insert blocked deletion; after insert commit, READ COMMITTED returned the
  trigger's `23503` and retained the link. REPEATABLE READ returned `40001` and
  retained it. If deletion committed first, a concurrent insert failed FK check
  (`23503`). This does not cover all hosted relations, roles, migrations,
  isolation levels, or platform behavior. No hosted data was touched.
- Migration checklist, schema and analytics audits, offline RLS audit and static
  a11y audit passed; a11y had 5 informational findings. The RLS audit's broad
  classification does **not** establish that staff direct updates are safe.
- The earlier backup rehearsal passed for 75 migrations on isolated PGlite. It
  is not a production backup or proof of hosted Auth/Storage recoverability.
- The local `npm run ci` pass is not authoritative GitHub CI. No branch GitHub
  run exists, and no Netlify preview or configured hosted staging journey has
  run on this branch. Reconnect the GitHub app with workflow permission to use
  the branch-trigger approach, or separately authorize a PR/preview route.

## Deployment preparation checklist — do not execute without approval

1. Resolve remaining code/test failures and PR overlaps; commit only reviewed
   changes, open an approved PR, run authoritative CI and verify a Netlify preview.
2. Reconcile schema and migration ledger in authorized staging against the
   repository and the recorded production drift; verify exact migration order,
   prerequisites, role grants, policies, functions and storage. Do not assume
   missing table names imply an empty database.
3. Inventory public frontend, build-time and server-only environment variables
   without exposing values. Verify modern versus legacy server-key selection,
   safe replacement and rotation strategy; inspect Netlify capacity and runtime
   configuration through authorized access.
4. Rehearse a restorable backup and approved recovery plan, including Auth and
   Storage. Rehearse migration-first rollout, news seed separately, rollback and
   post-migration checks. Keep writes frozen during compatibility transitions.
5. Run real authenticated student/admin journeys, consent and privacy controls,
   CBT and services failures/retries, accessibility and mobile/desktop/PWA tests
   on staging. Verify legal/contact content and obtain qualified legal review.
6. Review the final evidence and explicit migration/deployment authorization.
   Only then use the approved migration mechanism, verify schema and data, deploy,
   smoke test the live site and record a tested rollback point.

## Owner decisions and inputs

- Restore or provide the staging environment (already assigned to the owner).
- Supply verified operator identity, monitored contact and legally reviewed
  policy/age decisions; approve proposed genuine content and any optional seed.
- Grant or provide authorized Netlify account/capacity information if it cannot
  be inspected through the available tools; review final migration/deployment
  steps and provide separate explicit approval before any production operation.
