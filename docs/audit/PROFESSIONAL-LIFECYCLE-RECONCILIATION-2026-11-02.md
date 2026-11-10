# EduReach Hub: professional lifecycle reconciliation

**Decision: NOT READY FOR LAUNCH.** This is an evidence-based reconciliation of
the user's 22-stage professional website workflow with an existing product, not
a declaration that any stage is approved. Stages are listed in the requested
order. Earlier missing decisions and approvals must be resolved; existing work
is not erased or represented as if it happened in a different order. Engineering
can address urgent risks while foundational documents are reconciled, but no
release gate is skipped. No merge, deployment, hosted migration or production
record changes are authorized here.

**Later local evidence (2026-11-04):** `CBT-RECOVERY-AND-PRIVACY-BULK-2026-11-04.md` records CBT snapshot recovery and load-error corrections, a consent-failure warning, 792 local tests, and browser/audit results. This does not approve any lifecycle gate: durable withdrawal, server-authoritative CBT concurrency and real staging remain open. Earlier counts in the stage table are historical.

**Status meanings:** *Partial* means some evidence exists but it is incomplete or
not approved. *Blocked* means a dependency prevents meaningful completion.
*Not performed* means no evidence of completion for this release. Historical
reports and local tests are evidence of specific past checks, not blanket proof.

## Ordered stage-by-stage status

| # | Stage | Current status / existing evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1 | Discovery and planning | **Partial.** `docs/architecture/00-PRODUCT-DEFINITION.md` and README describe the product and audience. | Owner confirms scope, stakeholders, budget/timeline and measurable KPIs; no approval or complete brief was found. |
| 2 | Requirements and documentation | **Partial.** `docs/architecture/01-INFORMATION-ARCHITECTURE.md`, `03-ROLES-AND-PERMISSIONS.md`, `04-USER-JOURNEYS.md`, `05-BUSINESS-RULES.md`, `07-FEATURE-CATALOGUE.md`, `docs/ROUTES.md`. | Reconcile these as an owner-approved release SRS, including deletion, supported content and integrations, failure states and non-functional requirements; verify business rules against actual code. |
| 3 | Research and competitor analysis | **Partial.** Preliminary public-page observations below; existing site content and claims have not been independently validated. | Expand and date research, verify with users and obtain product-owner review; do not copy competitors or infer their operational/security quality. |
| 4 | UI/UX and wireframing | **Partial.** Existing visual rules in `docs/DESIGN_RULES.md`, `COLOR_THEME_SPEC.md`, `architecture/06-DESIGN-SYSTEM.md`; admin refresh explicitly requested and implemented locally. | Owner review of the actual release UI, journeys and accessible states at mobile/tablet/desktop; no evidence of complete approved wireframes or stakeholder sign-off. Preserve the approved public identity. |
| 5 | Technical architecture | **Partial.** React/TypeScript/Vite, Express, Supabase and Netlify; existing architecture docs, SQL migrations and operations runbooks. | Reconcile deployed schema, auth/authorization, user deletion, multi-writer concurrency, consent, dependencies and recovery; diagram actual data flow and obtain technical/security review. |
| 6 | Development environment | **Partial.** Git, package lock, TypeScript, npm scripts and `.github/workflows/production-checks.yml` exist; local unconfigured tests run. | Staging is inactive in the last project inventory. Authoritative CI/preview on the reconciled commit and code review remain outstanding; `npm run lint` currently invokes typecheck, not an independent ESLint/format gate. Do not silently change GitHub workflows. |
| 7 | Frontend development | **Partial.** Public, student and admin React routes and shared UI are implemented; responsive and error-state work exists. | Verify every required journey against the SRS with real auth/staging, including account deletion and precise save/failure messages. Existing local tests do not establish complete functionality. |
| 8 | Backend development | **Partial.** Express handlers, capabilities, validation, rate limits and existing notifications. Service-request UPDATE, student field and direct staff-read boundaries have local migration candidates and role tests; they are not deployed. | Verify both migrations and real PostgREST journeys in staging; review existing records, privileged-writer and nontransactional side-effect risks; close CBT multi-writer/versioning risks, deletion workflow, durable consent and error/notification dependencies. |
| 9 | Database development | **Partial.** Versioned Supabase migrations and local replay/schema/RLS audits. | Compare production/staging effective policies, functions, grants, constraints, storage and migration ledger; validate deletion dependencies; perform backup/restore and migration rehearsal. No production DDL without separate authorization. |
| 10 | API and integrations | **Partial.** Existing endpoints and Netlify/Supabase integration; local API tests and runbooks. | Inventory and verify actual configured auth/email, storage, telemetry and external dependencies; test outages, authorization, contracts and production-like configuration. No payment requirement was approved for this currently free product. |
| 11 | Content and assets | **Partial.** Admin-managed news, opportunities, services and CMS; optional new placeholder news seed removed locally. Historical migrations still contain prototype seeds and a broad cleanup, as documented in `docs/audit/SERVICE-REQUEST-WRITE-BOUNDARY-2026-11-02.md`. | Reconcile historical migrations and review affected records and dependencies without blind replay or deletion; administrators verify existing content and sources, assets, permissions, legal pages, contact and links. Do not claim production data is verified. Nigerian legal review remains required. |
| 12 | Functional testing | **Partial.** Last local suite: 766/766 tests; Chromium desktop/mobile 178 passed, 2 skipped; mocked admin/CBT and offline tests. | Real authenticated signup/recovery, service lifecycle, CBT, deletion, CRUD, uploads, notifications and negative cases in staging; local mocks do not prove hosted behavior. |
| 13 | UI/UX and responsiveness | **Partial.** Chromium tests include mobile/desktop; mocked admin tested 320/768/1440px. | Broader representative device, content, keyboard and touch testing and human review; cannot certify all screen sizes. |
| 14 | Security audit | **Blocked by critical findings.** Existing RLS audit, roles, auth guards and dependency checks; production metadata showed service-request direct-write bypass and policy/role drift. | Remediate and independently test effective live-like boundaries, storage, auth, consent, CSRF/CORS, uploads, secrets, monitoring and backups. Offline audit is not a hosted security assessment. |
| 15 | Performance | **Partial.** Strict local build budgets and throttled Chromium tests pass on an unconfigured build. | Repeat against the final reviewed build and staging/realistic data; assess actual device/network and production monitoring. Local synthetic metrics are not field Core Web Vitals. |
| 16 | SEO and accessibility | **Partial.** `docs/features/SEO-1.md`, `A11Y-1.md`, metadata/sitemap/robots code, static audit and rendered axe tests. | Verify deployed domain/canonical/indexing, content, keyboard and assistive-technology journeys; address findings and obtain review. Automated checks do not prove WCAG 2.2 AA conformance. |
| 17 | Cross-browser compatibility | **Blocked/incomplete.** Local browser evidence is Chromium, with desktop/mobile emulation. | Test actual supported Chrome/Edge, Firefox, Safari/WebKit, Android and iOS environments; document devices, versions and results. |
| 18 | Staging and UAT | **Blocked.** Last checked staging project was inactive; staging runbook exists. | Restore staging via the already assigned owner process, perform real journeys with synthetic users and stakeholder UAT, fix issues, retest and record approval. |
| 19 | Deployment preparation | **Partial.** Netlify configuration, production, backup and rollback runbooks exist. | Verify approved domain/DNS/TLS, environment and secret handling, dependency readiness, alert ownership, recovery rehearsal, migration order, release notes and approvals. PR #33 preview checks failed; cause not established. |
| 20 | Production deployment | **Not performed for this work.** User's standing instruction is not to deploy. | Separate explicit approval only after all prior gates and authorized merge/release process. |
| 21 | Post-launch verification | **Not performed for this release.** Smoke/runbook guidance exists. | Execute approved live checks only after authorized deployment, without exposing or modifying real user data unnecessarily. |
| 22 | Monitoring and maintenance | **Partial planning, not verified operations.** `docs/operations/OBSERVABILITY.md`, backup and production runbooks. | Confirm real alerts/owners, privacy-safe logging, on-call, incident communication, dependency updates, backup schedule and restore drills. A liveness endpoint alone is not full monitoring. |

## Stages 1–2: working brief and requirements baseline

This draft reconciles the repository and the user's decisions; it is not a
stakeholder-approved brief or SRS. The existing architecture documents remain
the detailed source rather than being copied into a competing specification.

- **Purpose / audience:** an independent Nigerian student-support platform for
  prospective and current students, with staff operating the editorial and
  service workflows. Its stated pillars are exam preparation, updates,
  opportunities, school information and student support. These are product
  intentions, not a claim all underlying data or journeys are verified.
- **Release scope to verify:** public discovery/content, account and profile,
  student dashboard, CBT and resources, service requests and tracking,
  capability-controlled admin tools, privacy preferences and the selected
  deletion/review paths. Only approved, sourced content should be published.
  The current product is free; no payment workflow or terms are invented.
- **Role / security requirement:** guests have only intended public access;
  students access their own data; staff actions require server-side and
  database-enforced capabilities. Existing code is the starting point, not
  proof this is already true in the deployed database.
- **User trust requirements:** disclose an unconfirmed save, submission or
  deletion; do not present fabricated data; allow eligible users to initiate
  self-service deletion and reviewed exceptions; preserve privacy and minimize
  collection. Full deletion remains unimplemented and legally unreviewed.
- **Non-functional gates:** responsive and accessible journeys, accurate
  source/currency status, security and permission isolation, reproducible
  migrations, backup restoration, failure recovery, privacy-safe monitoring and
  tested deployment/rollback. See the detailed stage matrix and existing audits
  for evidence and blockers.
- **Not established:** named decision-makers and reviewers, approved budget,
  delivery date, quantitative success thresholds, retention/exception policy,
  complete integration inventory and formal approval. Owners must decide these;
  they are not inferred from documentation or placeholder values.

## Stage 3: preliminary public competitor observations

These are limited public-page observations from search results on 2026-11-02,
not authenticated hands-on testing, independent verification of marketing
claims, user research, a recommendation to imitate UI, or evidence about any
vendor's security or quality. Features and prices can change.

- Myschool's public homepage advertises CBT practice, past questions, school
  updates and scholarships [1](https://myschool.ng/). Its breadth makes clear
  that EduReach should clearly explain which material is available and sourced;
  do not claim parity without verified content.
- Pass.ng's public homepage advertises online CBT and downloadable offline
  software [3](https://pass.ng/). Offline behavior is a potential user need,
  **not** a capability EduReach may claim unless explicitly implemented and tested.
- Hypotheses to validate with Nigerian students: clear source provenance, usable
  mobile journeys on intermittent networks, transparent assisted-service status,
  privacy controls and understandable failure/recovery. They are product
  opportunities to research, not proven differentiation or scope expansion.

No account was created, no paid functionality tested, and no competitor content
was copied. Further research and stakeholder decisions remain open.

## User's final 16-item launch gate

**0/16 formally approved for this release.** This counts only complete,
evidenced and signed-off gates, not partial implementation. In particular, local
passing tests and local performance budgets are valuable but do not establish
staging, hosted, cross-browser, legal or operational approval.

| Gate | Status / remaining evidence |
| --- | --- |
| All required features work | Open — reconcile SRS and test real critical journeys, including deletion. |
| No unresolved critical/high bugs | Open — service-request write bypass, consent failure and CBT concurrency remain. |
| Mobile/tablet/desktop responsive | Partial — selected Chromium/emulated widths; broader UX review required. |
| Authentication and permissions tested | Partial — local/mocked tests; real hosted isolation and roles needed. |
| Security checks completed | Partial — independent live-like assessment and remediations needed. |
| Backups/restoration verified | Open — production-equivalent rehearsal and documented sign-off required. |
| Performance acceptable | Partial — local budgets pass; release/staging and field verification needed. |
| SEO essentials configured | Partial — code exists; actual domain/indexing and release content unverified. |
| Accessibility checked | Partial — automated/static checks; manual assistive testing and review needed. |
| Cross-browser testing completed | Open — no complete Firefox, Safari/iOS and Edge matrix evidence. |
| Staging/UAT approval | Blocked — staging inactive at last check, no sign-off. |
| Production environment secured | Open — effective configuration, drift and security verification outstanding. |
| HTTPS and domain verified | Open — no current release verification recorded. |
| Monitoring and error tracking active | Open — configuration, alert delivery and response owners not verified. |
| Rollback plan ready | Partial — documented, but release-specific restore/rollback rehearsal and approval needed. |
| Post-launch smoke test plan ready | Partial — runbook exists; final release-specific checklist, ownership and approval needed. |

## Next release work and owner decisions

1. Reconcile/approve stages 1–5: product owner confirms scope, target journeys,
   acceptance criteria and KPIs; technical and legal reviewers validate data
   flows, retention and user-rights design. Do not invent missing decisions.
2. Continue P0 local work safely: CBT draft ordering and database-level
   concurrency; service-request direct-write authorization/CAS; consent
   revocation; the selected self-service and reviewed deletion paths. Each change
   requires a dependency audit and isolated regression tests before staging.
3. Restore staging through the already assigned owner process. Reconcile drift,
   rehearse backup/restore/migrations and run authenticated, cross-role journeys
   using synthetic data, including failure and recovery paths.
4. Complete the remaining UX, privacy, content, browser, accessibility, SEO,
   performance, incident/monitoring and legal gates. Run authoritative CI and
   approved preview on the exact reviewed commit; record reviewer/UAT approvals.
5. Only after the preceding gates: request separate permission for merge,
   deployment and live verification. PR #33 remains open and conflicting; its
   own passing CI is not evidence for this uncommitted reconciliation.

See `LAUNCH-RECONCILIATION-2026-11-02.md`,
`LAUNCH-USER-RIGHTS-AND-RECOVERY-2026-11-02.md`, and the staging/production
runbooks for detailed findings, tests, blockers and rollback procedures.

## 2026-11-02 continuation: same-tab CBT save ordering

A deliberately reordered mocked-browser test first failed: the second answer
was selected but a slower first save overwrote it. The existing CBT session now
queues and serializes successful saves in one tab, retains the newest pending
local draft until its own acknowledgement, and uses the same path for question
navigation. A blocked-storage/unconfirmed-submission regression still passes.
This is a **partial mitigation**, not database-enforced concurrency control:
multiple tabs, timeouts whose server writes commit after a retry, ambiguous
responses and hosted RPC behavior still need an explicit server-side version or
idempotency design and staging tests. The existing local pending-draft recovery
also needs assessment against concurrent newer server data.

Final local evidence for this update: typecheck; **766/766** unit/integration
tests; schema, 75-migration checklist, analytics, offline RLS and static a11y
audits; dependency audit (zero known vulnerabilities); strict build budgets
10/10 (entry 98.6 KB, CSS 50.9 KB, critical 208.2 KB, all JS 334.1 KB).
Chromium desktop/mobile: **178 passed, 2 skipped**; separate throttled mobile
performance: **1 passed**. The new same-tab ordering test passed on both
emulated projects and checked the newer pending draft is not prematurely
cleared. Mocked browser endpoints are isolated and do not establish live Auth,
real database ordering or the missing staging/UAT, browser, legal and production
gates. No hosted data or environment was changed.

## 2026-11-02 continuation: service journey and honest recovery

Local migration candidates now restrict direct service-request updates, student
creation/read fields and direct staff reads; these remain uncommitted and
unapplied to hosted projects. Student preview submissions no longer generate a
false confirmation; request-list failures no longer appear empty. Admin update
failure and stale-state recovery, transition buttons and unverified status/CBT
copy were corrected. Details, pre-change audit, migration impact and remaining
risks are in `SERVICE-JOURNEY-CONTINUATION-2026-11-02.md`.

Current local evidence: **780/780** unit/integration tests, typecheck, schema,
77-migration checklist, offline RLS, analytics and static accessibility audits,
dependency audit and strict build budgets passed. Unconfigured Chromium tests:
**188 passed, 4 skipped**; two configured-client cases were run separately and
passed against intercepted synthetic responses, while two existing CBT keyboard
cases remain skipped. Mobile performance: **1 passed**. The configured mock is
not a hosted Supabase test. Formal approvals, real staging, consent durability,
user deletion, CBT multi-writer ordering, service idempotency, external writer
inventory, notification reliability, legal review, current-branch CI/preview
and the remaining gate matrix are still open. **NOT READY FOR LAUNCH.**
