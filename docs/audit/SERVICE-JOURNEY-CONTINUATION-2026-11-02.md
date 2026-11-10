# Service journey: local continuation and remaining launch gates

**NOT READY FOR LAUNCH.** The changes in this document are local candidates, not deployed code or hosted migration work. The user has not authorized merge or deployment.

## Audit before implementation

| Existing implementation and duplicate check | Current behavior / gap found | Local change | Impact and verification |
| --- | --- | --- | --- |
| `service_requests` RLS, `src/lib/api.ts` student submission, `pages/StudentDashboardV2.tsx` tracking; existing admin API in `server.ts` | Students could set server-owned columns such as `admin_note` and `updated_at`, and read internal notes. Legacy staff SELECT policy could expose other students' records without the API capability check. | Reuse the existing student and admin workflows. Append `20261102200000_service_request_student_field_boundary.sql`, allowlist student columns and owner policies, remove direct staff-read policy, fail on unexpected client policies/inherited grants. | Real PostgreSQL role tests cover allowlists, own/other isolation, privilege drift, unreviewed policies and privileged service-role access. The prior UPDATE candidate remains separate. Hosted PostgREST behavior and external integrations need staging testing. |
| `scripts/rls-posture.ts`, `supabase/ci/production-validation.sql` | The posture only counted table-level grants, so moving to columns could hide privilege drift. | Extend the existing audit to count column-level access and check the exact service-request column set. Extend read-only release checks and migration checklist. | Focused real-PostgreSQL tests deliberately add unsafe grants and policies and verify the checks fail. These tests are not a hosted security review. |
| `server.ts` admin service update, `pages/AdminQueuePage.tsx`, `pages/AdminDashboardPage.tsx` | A failed database read was reported as a nonexistent request. Queue-load failure could display zero requests and an empty state. A failed/timeout update could have committed despite an error. | Distinguish missing from failed read; report an ambiguous write and ask for refresh. Queue failures show unavailable; uncertain or stale queue updates block further actions until a successful refresh. Dashboard reuses the same error guidance. | Mocked API and browser tests exercise read/write failures, queue failure/recovery and ambiguous-update refresh; they do not establish audit/notification atomicity or hosted failure behavior. |
| Existing service transition lists in `server.ts` and `src/components/admin/AdminKit.tsx` | Submitted requests offered a Complete action the API rejects; waiting requests offered a rejected transition but not valid resume transitions. | Reuse the existing API rules in a shared transition table. Controls filter against those rules; waiting requests can return to review/processing. No server-side transitions were added. | Unit and mocked browser tests cover every displayed action and the previously mismatched states. |
| `submitServiceRequest` and `ServiceApplyPage` | Without backend configuration, a locally generated reference was displayed as a confirmed server request, even if local storage failed. | Do not create new local pseudo-submissions: report unavailable and keep the form/draft. The configured path still uses the existing active-service check and direct owner-scoped submission. Existing local preview records are retained and labeled as not submitted in the dashboard. | Tests cover unconfigured refusal, retained draft/local records and a synthetic configured client returning the server reference. Real authenticated submission and uncertain network-after-commit cases still require staging. |
| `src/lib/serviceLifecycle.ts`, `src/server/notifications.ts`, `pages/ServiceApplyPage.tsx` | Copy promised strict queue ordering, reliable notification, a reply path or an outcome/reason screen without supporting evidence. | Retain status descriptions and existing notification flow, but use limited status-only wording. | Content and existing notification tests; delivery, missing-information communication and outcome/reason workflows remain unresolved. |
| Student dashboard request loading | A failed request query became an empty array, so the recovery advice to check My Requests could falsely imply that nothing was submitted. | Distinguish a failed or malformed result from a successful empty result and provide a refresh action. Unconfigured preview sessions use the existing local branch and label old local records. | The configured-client browser fixture intercepts a synthetic Supabase origin; it is not hosted Auth/PostgREST evidence. |
| `dashboardPriority.ts`, `ExamSetupPage.tsx` | Resume and setup copy guaranteed saved answers and preserved time despite known multi-tab and timeout risks. | Ask students to check saved answers; state that the timer continues. The underlying CBT ordering and recovery constraints remain open. | Unit tests check the revised guidance; existing same-tab CBT tests do not prove global save ordering. |

## Local verification for this continuation

- **780/780** unit/integration tests passed, including real PostgreSQL migration replay and role tests, synthetic configured-client tests, API authorization/failure tests and local backup rehearsal. Typecheck, schema, the 77-migration checklist, offline RLS, analytics and static accessibility audits passed; dependency audit reported zero known vulnerabilities.
- Unconfigured Chromium desktop/mobile: **188 passed, 4 skipped**. Two skips are the pre-existing answer-option keyboard test requiring unavailable CBT fixtures; two are the configured-client fixture, which was run separately against a synthetic configured build and passed **2/2**. No real account or hosted Supabase was used.
- Build and strict budgets passed **10/10** (entry 98.5/100 KB; CSS 50.9/51 KB; critical 208.1/211 KB; all chunks 334.5/336 KB). The separate throttled mobile performance test passed. The unconfigured server reports missing Supabase configuration in logs, as expected; this does not verify live data.
- The local physical backup/restore rehearsal used synthetic data and does not prove that Supabase production backup, storage or Auth can be restored. Staging, CI and independent review remain required.

## Deployment and safety constraints

- Both service-request migrations are uncommitted local candidates. Apply neither to a hosted project without explicit authorization, ledger/drift reconciliation, backup/restore rehearsal, client and privileged-writer inventory, compatibility review, staging/UAT and a reviewed rollback plan. Do not blindly replay historical data migrations. See `SERVICE-REQUEST-WRITE-BOUNDARY-2026-11-02.md`.
- Column-level privileges and RLS must be validated with actual PostgREST, hosted Auth and all supported student/admin clients. The migration does not constrain service-role/other privileged writers or make audit and notification side effects transactional. Existing forged notes or non-finite versions are not automatically altered.
- Historical local preview service records are not sent to EduReach. They are retained for the user to inspect, not silently erased or represented as real requests.
- A network failure after submission may be ambiguous. The form directs the student to check My Requests before retrying, but this is not a server-side idempotency key: delayed commits, repeat submissions and reliable recovery still need a reviewed server/database design and real staging tests.
- The existing service page contains a hard-coded WhatsApp destination. Its ownership and approval have not been verified here. Do not present it as verified, invent a replacement, or assume it is an approved personal-data channel; owner/privacy review remains necessary.
- A request marked “Waiting on you” does not yet establish a verified student-visible question/reply path; neither completed nor rejected states establish an outcome/reason display. Product and operator workflow decisions remain necessary. Notifications are best-effort and their actual configured delivery is unverified.
- Durable cross-tab/reload consent revocation, safe account deletion and retained data, CBT multi-writer ordering, legal review, authoritative CI/preview, staging, owner/UAT/security approval and other lifecycle gates are still open. A local pass does not authorize launch.

## Follow-up: thrown submission transport failures

The configured student submission test was extended to throw from the existing
insert operation, simulating a client/network exception after an insert may
have been sent. Before the fix, the raw exception escaped instead of the
uncertain-outcome guidance. The insert now treats thrown exceptions and
returned errors alike: the student is told the outcome could not be confirmed
and to check My Requests before retrying. Lookup failures before insertion remain
separate. This is messaging, **not idempotency**: a delayed commit may still be
missing when the student checks, so the guidance cannot establish a safe retry.

Verification: the new regression failed before the fix and passed afterwards;
configured/unconfigured submission tests, typecheck, the complete local unit
suite, analytics audit, build, strict 10/10 performance budgets, four focused
unconfigured desktop/mobile browser cases and both Git diff checks passed.
The insert exception is simulated; no real hosted timeout or Auth/PostgREST
journey was tested. No change was made to consent storage, and durable
withdrawal across tabs/reloads remains open. Nothing has been deployed.

## Subsequent local idempotency candidate

A new authenticated, owner-scoped database RPC candidate and unique
per-student submission key were added and tested sequentially in a synthetic
PostgreSQL engine. The student client is **not wired to it**; legacy direct
inserts are unchanged, and multi-session concurrency and hosted behavior remain
unverified. Therefore duplicate prevention is **not yet fixed**. See
`SERVICE-IDEMPOTENCY-CANDIDATE-2026-11-02.md` for the audit, results, rollout
risks and next work. Current local suite: 786/786 tests; 78 migrations replayed
in synthetic backup/restore. No hosted migration or deployment occurred.

## Later update: idempotency candidate hardening

The local candidate now protects a server-generated fingerprint of original
submission details against ordinary updates. A disposable PostgreSQL
multi-connection rehearsal verified same-key commit, rollback and mismatch races
with synthetic data. Hosted behavior, additional failure modes, browser retry
key lifecycle and the existing direct form still need work. See the updated
`SERVICE-IDEMPOTENCY-CANDIDATE-2026-11-02.md`; prior notes that all local
multi-session races were untested are historical. Duplicate prevention is not
yet enabled for users.

## Later update: account-scoped service drafts

Configured service drafts are now scoped to the signed-in account and the form
is reset when that account changes. Older unscoped drafts remain stored but are
not automatically displayed because ownership is unknown. The existing direct
submission checks that the server-verified user is the account whose form was
submitted. This is not an authorization substitute or proof of live RLS.
The proposed idempotent RPC still needs a server-side expected-account guard
before client wiring: a token switch after client-side verification must not
submit old details under a new account. Details and test evidence:
`SERVICE-DRAFT-ACCOUNT-ISOLATION-2026-11-02.md`. Local checks: 787/787 tests,
188 unconfigured browser passes/6 skips, 4 synthetic configured browser passes,
and mobile performance passed. Still **NOT READY FOR LAUNCH**.

## Later update: expected-account assertion in candidate RPC

The local idempotency candidate now checks the expected account against the
authenticated identity inside the database before creating or recovering a
request; `auth.uid()` still determines ownership. The form is not wired to the
candidate. Earlier notes that the candidate has no account assertion describe
the prior state. See `SERVICE-IDEMPOTENCY-CANDIDATE-2026-11-02.md`.

## Subsequent local client retry integration

The local service form now calls the candidate idempotency RPC with a key and
original details persisted in its account-scoped session draft. Review, safe
retry, unavailable storage and confirmed-but-not-cleared messaging were tested
with intercepted browser fixtures. Earlier statements that the client still uses
the direct insert are historical. This is not deployed or verified with real
hosted Auth/PostgREST; cross-tab/device duplicates and inactive-service recovery
remained open at this stage. A later local check-only candidate is described in
`SERVICE-UNAVAILABLE-RECOVERY-2026-11-02.md`; hosted verification remains open.
See `SERVICE-RETRY-RECOVERY-2026-11-02.md`. Evidence at this stage:
790/790 local tests, 188 unconfigured Chromium passes/12 skips, 10 configured
mocked-browser passes, and mobile performance passed. NOT READY FOR LAUNCH.
