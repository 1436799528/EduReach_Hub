# Service draft account isolation — local follow-up

**NOT READY FOR LAUNCH.** This is a local change, not a hosted release. The student's actual submission still uses direct inserts and is **not idempotent**.

## Pre-change audit and duplicate check

| Existing workflow | Prior behaviour / impact | Minimal local repair | Verification and remaining impact |
| --- | --- | --- | --- |
| `ServiceApplyPage` and its existing session-storage draft | The key identified only the service, so a different student in the same browser tab could inherit the previous student's form, including personal information. | Configured drafts use an account-and-service-scoped key. The form remounts on account changes and waits for auth loading; signed-out configured users do not automatically load or save an account's draft. Existing unconfigured preview behaviour is retained. | Desktop/mobile Chromium uses an intercepted synthetic configured client to exercise account changes without reload and with reload. Browser storage is still accessible to anyone who can inspect the same browser session; this is UI separation, not encryption or a defense against a compromised device. |
| Older unscoped `edureach-service-draft-*` keys | Their owner is not recorded. Assigning one to the current user could disclose another person's data; deleting them would lose work. | Preserve the value without displaying or silently migrating it; report that an old draft cannot be automatically loaded because ownership is unknown. | Existing data remains in session storage but no in-app recovery is provided yet. Safe owner-verified recovery and retention guidance need design; closing the tab or clearing storage may still remove it. |
| `submitServiceRequest`, authenticated `getUser`, form state and existing owner RLS | An account could change before the server-verified user is read, causing form details captured for one account to be submitted as another. | The form passes its current user id as an expected identity; the existing direct-insert API refuses when the verified account differs or no expected identity is supplied. The existing insert includes the verified user id and remains protected by the owner RLS policy. | In-memory client tests reproduce and block the mismatch. A later switch between verification and insert also depends on actual hosted RLS/Auth, which has not been verified. Do not interpret this client check as authorization. |
| Proposed idempotent RPC | It originally derived ownership from the active token without checking the account that prepared the form. A later token switch could bind old form data to a different account if wired naively. | A subsequent local change adds an expected-account assertion at the RPC boundary while retaining `auth.uid()` as the only owner; design and test retry-key, storage failure and edited-payload recovery before client integration. | The new assertion is locally tested only, and does not prove hosted Auth/PostgREST behavior or end-to-end idempotency. |

## Verification and limitations

The configured test first failed on both desktop and mobile because the legacy unscoped draft appeared as the new student's name. The repair passed the synthetic configured-browser test for switching accounts in-place, reloads and return to the first account, while preserving the old unscoped storage value. The accompanying configured request-list recovery fixture also passed. These tests use intercepted fake Supabase traffic and do not establish real hosted Auth, RLS, browser storage behavior in every browser, or production readiness. Full regression results are recorded below after completion.

The form does not yet reuse an idempotency key. No hosted migration, production record change, merge or deployment was performed.

## Completed local checks

- **787/787** unit/integration tests; typecheck, schema audit, 78-migration checklist, offline RLS, analytics, static accessibility (0 blocking, 5 informational), and dependency audit (0 vulnerabilities) passed.
- Configured build with intercepted synthetic Auth/PostgREST: **4/4** desktop/mobile browser tests passed, covering draft isolation and request-list recovery. The draft isolation test had first failed on both form factors before the change. This is not a hosted Supabase test.
- Unconfigured desktop/mobile Chromium suite: **188 passed, 6 skipped**. Four skips are the two synthetic-configured tests across both projects, run separately above; the other two are existing CBT keyboard tests needing unavailable fixtures. Mobile performance: **1 passed**. Build budgets passed **10/10**; staged and unstaged diff checks passed.
- These checks did not exercise real sign-in/account switching, live policies, real services, another browser, shared-device protections or cross-tab submission recovery. No CI, staging or live release is established.
