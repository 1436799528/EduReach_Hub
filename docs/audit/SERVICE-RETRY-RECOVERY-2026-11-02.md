# Student service retry recovery — local candidate

**Launch status: NOT READY.** The client and SQL below are local, uncommitted release candidates. They are not hosted and have not been verified together through real Supabase Auth/PostgREST. Do not deploy or migrate without review, staging and separate authorization.

## Pre-change audit

| Existing implementation / duplicate check | Gap | Minimal local change | Verification and impact |
| --- | --- | --- | --- |
| Account-scoped service draft in `ServiceApplyPage` | A lost response could leave a student unable to tell whether a direct insert committed. Ordinary draft saves did not retain a retry key. | Extend the same session draft with a verified pending UUID and original details. Preserve that pending record through ordinary edits. Stop before sending if storage or secure key generation fails. | Unit tests and synthetic configured desktop/mobile browser cases exercise storage failure, reload and preservation. This uses session storage, not durable cross-device storage. |
| `submitServiceRequest` direct insert and local idempotency RPC candidate | Retrying the direct insert could create another row. | Use the candidate's expected-account/key RPC; no fallback to an unsafe direct insert when the RPC is missing. Validate the response before confirming and clearing the draft. | In-memory client tests and intercepted fake browser RPCs. No actual hosted account/database/PostgREST was contacted. The independent local PostgreSQL role and multi-session tests separately exercise the SQL. |
| Form review and existing failure UI | Changed input must not silently reuse a key for different details. | Detect a changed payload; offer Review previous submission to restore the original fields and explicit retry. Retain the key across reload and ambiguous failures. | Synthetic browser test changes details after a lost response, confirms no second RPC was sent, restores original details and checks the same key and payload were retried. |
| Confirmed result and session-storage cleanup | The server may confirm while browser storage refuses to remove the local draft. | Keep the genuine confirmation, but warn when the local draft could not be cleared or read back. | A synthetic browser test blocks removal and verifies both confirmation and warning. The old draft may remain in this browser tab. |

## Important limitations and rollout

- The same-tab key is not cross-tab, cross-device or resilient to session-storage clearing/tab closure. Independent submissions can still create duplicates. The key does not replace explicit operator procedures for ambiguous cases.
- The original details are temporarily duplicated inside the existing account-scoped session draft for recovery. They are sensitive, unencrypted browser data, not an authorization boundary. They can remain if cleanup fails; qualified privacy and retention review is required. Legacy unscoped drafts are preserved and not silently assigned to an account.
- At this stage, an inactive service prevented the loader from showing recovery. A subsequent local-only check-only recovery candidate addresses that specific path; see `SERVICE-UNAVAILABLE-RECOVERY-2026-11-02.md`. Hosted verification and storage loss, identity changes, multiple tabs and independent attempts still require a recovery policy.
- Existing direct/privileged writers are not idempotent. Both the RPC candidate and client need independent security review, writer inventory, migration-first release planning and real authenticated staging tests, including network loss after commit, account/token switches, multi-session races, PostgREST response shape, rollback and historical migration/data impact. Do not replay historical cleanup/seed migrations blindly.
- This client deliberately fails closed on a database without the new RPC rather than reverting to a duplicate-prone direct insert. Deploying the client before a reviewed compatible migration would make configured service submissions unavailable. The hosted schema has not been changed.
- Consent withdrawal, safe account deletion/retention, CBT concurrency, CI/preview, legal review and final release approvals remain open. No launch, merge, hosted migration or production record change occurred.

## Evidence

- **790/790** local unit/integration tests; typecheck, schema audit, 78-migration checklist, offline RLS, analytics, static accessibility (0 blocking, 5 informational), dependency audit (0 vulnerabilities), build and strict performance budgets passed. The all-chunks gzip budget has little headroom (configured build 335.8/336 KB).
- Synthetic configured-client Chromium desktop/mobile: **10/10 passed**, with all fake Supabase requests intercepted. This includes lost-response/reload, changed-details refusal, storage-write failure, storage-cleanup failure, draft account isolation and request-load recovery.
- Unconfigured Chromium: **188 passed, 12 skipped**. Ten skips are the five configured-fixture tests across desktop and mobile, run separately above; the two existing CBT keyboard tests need unavailable fixtures. Mobile performance: **1 passed**. These are not hosted end-to-end or cross-browser certification.
- The prior local PostgreSQL multi-session rehearsal passed commit, rollback and mismatched-payload scenarios for the RPC with expected-account assertion. It was separate from the mocked-browser tests; it does not prove the combined hosted journey.
