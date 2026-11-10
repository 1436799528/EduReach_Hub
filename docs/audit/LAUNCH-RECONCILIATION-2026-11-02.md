# Launch audit: reconciliation after PRs #31 and #32

**Status: NOT READY FOR LAUNCH.** This is a point-in-time, evidence-based audit
and coordination addendum, not a claim that every product flow or legal/security
obligation has been fully verified. It supplements the existing
`MASTER-AUDIT-2026-10.md`, `PRODUCTION-SCALE-AUDIT-2026-10.md` and
`SESSION-7-PRODUCTION-RECONCILIATION.md`; PR #33 also contains an earlier
`LAUNCH-WORKING-REPORT.md` on its own branch, not on this one.

**Later local continuation:** Service-request boundary candidates, honest submission and queue failure handling, and new local evidence are documented in `SERVICE-JOURNEY-CONTINUATION-2026-11-02.md`. The historical findings and test counts below describe the earlier snapshot, not deployment of those candidates.

## Branch and release coordination

- This branch, `arena/e52320f9-edureach-hub`, started clean at `ac66747`, the
  verified `origin/main` head on 2026-11-02. PR #31 (server key precedence) and
  PR #32 (privacy and refund page) have been merged to main.
- PR #33 (`arena/258c802c-edureach-hub`, head `ccf44fb`) remains open: four
  commits ahead and two behind main. GitHub reports it **CONFLICTING**. A
  non-working-tree `git merge-tree` analysis found add/add conflicts in
  `src/components/CookieConsent.tsx`, `src/lib/privacyPreferences.ts`, and
  `tests/privacy-preferences.test.ts`. No merge was performed.
- PR #33's authoritative GitHub Actions run
  [41492031082](https://github.com/1436799528/EduReach_Hub/actions/runs/41492031082)
  passed on the PR head. It is not a test of a reconciled result. Its Netlify
  preview and related checks report failure; the cause has not been verified.
  Main's Actions run 41318827354 at `ac66747` passed.
- PR #33 contains prior news, service, consent, performance and test work. Do
  not recreate it independently or close, merge or deploy it without the user's
  decision. Its results must be revalidated when reconciled with current main.

## Findings and minimal repair directions

P0: security, integrity or essential operation could block release. P1: required
launch verification or correction. P2/P3: follow-up, not permission to bypass a
P0/P1. "Unverified" means exactly that; these are not findings of confirmed
failure unless stated.

| Area | Existing implementation / duplicate check | Current behavior, gap and classification | Minimal direction and verification |
| --- | --- | --- | --- |
| Service requests | Capability-protected PATCH in `server.ts`, admin queue/dashboard, direct student Supabase insert; staff policy in `20260903_enable_staff_service_request_moderation.sql`; PR #33 adds versioned UI/API CAS. | **P0 confirmed:** main PATCH writes by ID after a prior read. Production metadata also shows authenticated UPDATE grant and `service_requests_update_staff` using `is_staff(auth.uid())`, bypassing server capabilities/CAS. Its `is_staff(uuid)` currently recognizes `moderator`, `admin`, `super_admin`, `contributor`, which differs from the current app role vocabulary. Live insert policy lacks the repo's active-service check. Audit and notification writes are separate and their production dependencies need reconciliation. | Reuse endpoint and PR #33 CAS, reject unverifiable legacy submissions. Inventory effective privileges, triggers, functions, all privileged writers and integrations; design a narrowly scoped DB-enforced write boundary with staged compatibility/rollback. Verify multiple real sessions, ownership, transitions, audit and notification failures. Do not blindly revoke grants on production. |
| Consent / privacy | Existing merged `privacyPreferences.ts`, `CookieConsent.tsx`, `trackEvent` gate; PR #33 contains a competing adaptation and tests. | **P0:** main's save catches storage errors but returns success, so the UI closes; when an earlier allow remains readable a failed rejection may leave tracking enabled. PR #33 improves same-tab failure but documents an unresolved durable cross-tab/reload case if writes and deletion both fail. | Preserve one preference key and customization UI; reconcile, fail closed and report save failures. Test intercepted browser traffic across tabs/reload, storage denial/recovery, no replay and all transmission paths. A durable design must not claim persistence when no durable write succeeded. |
| Newsroom / placeholders | Main admin endpoint and Newsroom use existing `news_articles`; PR #33 proposes guarded markers, draft-first replacement, generic-manager restrictions, pagination and a separate optional seed. | **P0/P1:** main list is limited to 200; safe placeholder and reference guards are not present on this branch. PR #33's migration, concurrent behavior and genuine-data protection are not hosted-verified; PDF selector still has a first-200 limit. | Reconcile existing PR work and tests, not a parallel news subsystem. Verify all relevant FKs, publication paths, replay/collisions, import, multi-page search, linked deletion and actual races in an isolated DB and staging. Any seed/migration needs separate approval. |
| Refund / legal | Existing `site_pages` CMS, `LegalPage.tsx`, and `AdminSitePage.tsx`; merged #32 adds independent static `RefundPolicyPage.tsx` and routes `/refunds` and `/refund-policy`. | **P1:** static page is not controlled by the CMS and includes proposed future billing/cancellation language. Policy and operational statements need qualified review, not invention. | Extend the existing CMS with a controlled refund slug and deliberate route compatibility; assess impact before retiring the static page. Do not invent legal entity, contact, refund terms or paid offerings; obtain Nigerian legal review. |
| Authentication / roles | Existing Supabase auth, profiles, role/capability checks and modern server-key precedence from merged #31. | **P0/P1:** hosted signup, verification, reset, sessions, ownership and effective role isolation have not been exercised here; production role predicate differs as above. | Trace effective grants and roles, then test all sessions in staging without extracting credentials or altering real users. |
| CBT | Existing configured-attempt RPCs, guest-submit API, question importer and local tests (`cbt-modes`, `cbt-submit-grace`, guest disclosure). | **P0/P1:** local isolated function tests exercise frozen papers, draft saves, scoring, retry and timing, but do not prove full authenticated or guest browser journeys, real content quality, hosted persistence or all exam rules. | Reuse the engine; test JAMB/WAEC/NECO/POST-UTME setup, submission, grading, results, expiry, recovery and role isolation with approved synthetic staging data. Never seed fake official questions or results in production. |
| Dashboard / notifications | Existing dashboard, `src/server/notifications.ts`, audit RPC calls. | **P0/P1:** read-only production inventory in this audit did not find `student_notifications` or `admin_audit_logs` among the requested public tables; no `admin_audit_log` function appeared in the sampled functions. A differently named `edureach_audit_logs` exists. Absence alone does not justify creating tables; actual deployed behavior is unverified. | Map live equivalents and error handling, then verify writes, feeds, retries and delivery in staging; preserve existing records. |
| Services / guides | Existing catalogue, guide CMS and request workflow. | **P1:** live guide edits, uploads, status transitions and student/admin persistence not verified end to end. | Exercise existing flows and error handling in staging, including capability isolation and safe content. |
| Resources / opportunities | Existing PDF/document bank, educational resources and opportunity manager. | **P1:** source provenance, expiry, link validation, >200 selectors, permissions and complete admin/public journeys remain unverified. | Inspect actual sources and relationships; exercise existing workflows without invented organizations, statistics or content. |
| Database / Supabase | Existing 74 migration files, RLS audits and staging runbook. Production/staging are separate projects. | **P0:** project listing shows staging **INACTIVE** and production **ACTIVE_HEALTHY**. Production metadata sampled here confirms policy/grant and table/function drift. Repo replay is not a hosted Supabase test. | Owner is already handling staging restoration. Compare ledger, columns, grants, policies, SECURITY DEFINER functions, Auth and Storage there first. Rehearse backup/rollback and migration order; no hosted writes without separate approval. |
| Security | Existing capability checks, offline RLS audit, rate limits, security headers and dependency audit. | **P0/P1:** the offline posture audit passing does not establish effective live security; abuse, storage, CSRF/CORS, privileged RPCs and cross-role access require verification. No advisory is not proof of security. | Test against isolated/staging roles, review exact grants/function search paths and logging; retain least privilege. |
| Performance | Existing Vite/esbuild build and `scripts/perf-audit.ts`; PR #33 adds transitive static-chunk accounting and build-only Terser. | **P1:** merged #32 raised entry/critical/total budgets from 100/211/336 KB to 101/212/339 KB. Current unconfigured main build measures 100.1/211.3/337.6 KB and passes the raised gates; the older strict limits would fail. Main's audit sums named chunks and can miss transitive static chunks. | Reconcile PR #33's improved accounting and measure genuine byte reductions against the prior limits; do not hide initial dependencies or weaken tests. Run browser and performance gates on the exact final combined build. |
| Homepage / navigation / accessibility / PWA | Existing shell, routes, CSS layers, static and Playwright tests. | **P1:** browser evidence for this specific new branch has not been run in this session; keyboard, assistive technology, installability, offline behavior and responsive journeys remain incomplete. Static accessibility audit has five informational findings. | Test desktop/mobile journeys and meaningful failure states on the final build; do not claim WCAG certification or offline CBT. Preserve approved visual identity. |
| Deployment / monitoring | Existing Netlify config, CI gate, runbooks and telemetry. | **P0/P1:** #33 conflicts and its Netlify preview failed; deployed configuration, capacity, migration compatibility and monitoring are unverified. A passed PR-head job is not approval of a resolved build. | Run authoritative CI and approved preview on the resolved commit, rehearse recovery, obtain review and explicit authorization before staging/production operations. |

## Executed checks and boundaries

- Read-only GitHub inspection and `git merge-tree`; no branch switch, PR edit,
  merge or deployment. `origin/main` was fetched and matched branch HEAD.
- Installed lockfile dependencies locally (`npm ci`). On this branch:
  `npm test` **753/753 passed**; typecheck, schema audit, migration checklist
  (74 files), analytics audit, offline RLS audit, static a11y audit and
  `npm audit --audit-level=low` passed (zero advisories; a11y five informational
  findings). The unconfigured build and current, raised performance gates pass.
- Previous PR #33 reports browser, concurrency and other evidence for its own
  branch; do not attribute those results to this branch or a future conflict
  resolution without rerunning them.
- Supabase inspection used project listing and read-only production **metadata**
  queries only. No secrets, personal records, schema/data writes, migration,
  deployment or staged/live user journeys were performed.
- Staging remains inactive at this check. Existing local tests and production
  metadata snapshots do not replace authenticated staging and legal review.

## Next decision and release sequence

The active branch is separate from conflicting PR #33. Decide explicitly how to
reconcile/supersede that overlapping PR before importing or duplicating its
changes; closing or merging it requires a separate instruction. Once reconciled:
fix P0/essential P1, rerun unit/integration and actual browser suites, run
GitHub CI and approved preview on the resolved commit, reconcile and rehearse in
staging, obtain content/legal/operational approvals, and only then request
separate production migration/deployment authorization.

## Reconciliation work in progress on this branch

After this audit, the user chose to reconcile the overlapping PR #33 work here,
without merging, closing or deploying it. The findings table above records the
pre-reconciliation main baseline. The prior news migration, optional seed,
service CAS, performance accounting and tests have been brought forward locally;
they have **not** been applied to a hosted project. The consent conflict retains
main's Customize and saved-settings behavior and preference-change event while
adding PR #33's visible save-failure and same-tab fail-closed behavior. The
unresolved durable storage-failure scenario remains a blocker.

On the combined, unconfigured build, the earlier stricter 100 KB entry / 211 KB
critical / 336 KB total JS budgets were restored. The transitive-static audit
passes at **98.5 / 208.0 / 333.2 KB** respectively, using build-only Terser.
After rebuilding to avoid stale `dist`, 64 focused tests passed and the full
local test suite passed **764/764**. The combined build's desktop/mobile
Chromium suite passed **164**, with **2 skipped** because no CBT answer options
were available in the unconfigured environment. The separate throttled mobile
performance test passed for `/`, `/news` and `/past-questions`. These are local,
unconfigured tests, not hosted journeys. The prior PR-head GitHub CI does not
certify this reconciliation.

Direct staff/privileged DB writes, durable consent revocation, live drift,
legal CMS reconciliation and real authenticated CBT/staging journeys remain
open. The imported `LAUNCH-WORKING-REPORT.md` is a historical snapshot only;
its old branch and PR status must not be mistaken for this branch's status.

## 2026-11-02: administrator-managed content and console refresh

The administrator chose **no seeded placeholder news**, with the existing
editorial draft and publication workflows retained. The previously prepared
optional seed is absent from the working tree and index; older references to it
in this report and the historical audit reports describe the earlier proposal
and are superseded. The migration contains no seed. Its isolated PGlite test
creates a synthetic legacy row only inside the test database, and checks replay,
unpublished visibility, replacement, collision handling, linked deletion and
preservation of unrelated genuine records. The legacy marking controls remain
available to identify and safely handle pre-existing placeholder records; this
is not a claim that all real data has been verified. No production records were
changed. Production news marker columns were absent in the read-only metadata
sample; do not assume there are no legacy placeholders.

The existing capability-aware admin shell, controls and pages were restyled
without adding a second component library. Its mobile menu has an explicit
accessible toggle, Escape/focus handling and active-page indication; admin table
wrappers are keyboard-focusable. The shared public image-card selectors were
preserved while removing the admin metrics from that layer. When the dashboard
fetch fails, it no longer presents zero metrics or a clear queue as fact; the
error, retry and navigation shortcuts remain available. A successful but
incomplete analytics response can still default missing metrics or optional
feeds to zero/empty, and the backend tolerates some component-query errors;
that broader data-quality issue remains open and must be resolved or disclosed
before treating the dashboard as authoritative.

Final local checks for this working tree: typecheck; **764/764** unit/integration
tests; schema, migration checklist (75), analytics, offline RLS and static
a11y audits; dependency audit (0 known vulnerabilities); build and performance
budgets (10/10: entry 98.5 KB, CSS 50.9 KB, critical path 208.1 KB, all JS
333.8 KB). The complete unconfigured Chromium desktop/mobile suite passed
**172**, with **2 skipped**; this includes 8 newly added mocked-admin tests for
320/768/1440px navigation, permissions, error states and automated axe checks.
The isolated tests mock authentication and API responses and do **not** prove
hosted authorization, genuine account journeys, all screen sizes, or WCAG
certification. The separate throttled mobile performance test passed on `/`,
`/news` and `/past-questions`. The initial CSS-budget, accessibility and
font-weight failures were fixed rather than suppressing or loosening the gates.

PR #33 is still open and conflicting; its quality gate passed on its own head,
while Netlify header/page/redirect checks report failure, and its result does not
validate this uncommitted reconciliation. No merge, deployment, hosted
migration, production-data cleanup or independently sourced content review has
been performed. Critical blockers remain the service-request database write
boundary, durable cross-tab consent revocation, live schema/notification drift,
authenticated CBT/admin workflows, legal CMS review, active staging and
current-branch authoritative CI and preview. **NOT READY FOR LAUNCH.**
