# CBT Phase 12 — recovery coordinator and revision review

**Phase 12: NOT COMPLETE — NOT READY FOR PRODUCTION.** The actual CBT page remains read-only and blocked for v2. It does not retry pending operations before its preview; it does not create or send v2 answers, expose conflict controls, or submit/finalize v2. No merge, deployment, hosted migration, hosted v2 rehearsal, production-data change, deadline, scoring or exam-rule change occurred. This report describes local, uncommitted work on `arena/e52320f9-edureach-hub` at starting HEAD `ac66747296301e53c363b497b97944368ff85239`.

## Audit and changes

Before implementation, the actual page and its v1 guards, scoped journal, queue, protocol validation, API/Express local gate, candidate SQL, prior reports, build configuration and tests were reviewed; an implementation/duplicate/behavior/gap/impact/verification table was presented. Existing journal, queue and locking mechanisms were extended, not replaced. A tentative page hookup was removed before testing: the existing nonproduction/loopback gate cannot prove a loopback service is not proxying hosted data. No rehearsal flag or retry hookup remains on the page.

- `src/lib/cbtAnswerQueue.ts`: added **isolated, unwired** `recoverCbtJournal`, reusing `IndexedDbAnswerJournal`, `CbtAnswerQueue`, canonical UUIDs, existing transport and browser locks. Frozen-paper preflight also rejects empty/blank option arrays and blank question text. Unit red tests reproduced the missing rejections before the fixes.
- `tests/cbt-recovery-coordinator.test.ts`: isolated fake-IndexedDB/synthetic-server recovery, identity, conflict, invalid acknowledgement and concurrency checks.
- `tests/e2e/cbt-recovery-coordinator-mocked.spec.ts`: **standalone library harness**, not the session page, using real browser IndexedDB and Web Locks with a synthetic server.
- `tests/cbt-paper-journal-preflight.test.ts` and `tests/e2e/cbt-v2-recovery-preview-mocked.spec.ts`: malformed-paper regressions, including actual blocked-page tests with synthetic API responses.
- No production budget, minifier setting, server gate, candidate SQL, deployable migration or session-page writer was changed for this phase.

## Recovery sequence, identity and unresolved race

**Before:** the page obtains frozen paper, authoritative state and a canonical account/attempt-scoped journal, then calls `projectCbtJournal` directly. A pending row whose response was lost after server commit can be stale relative to the new server revision, so this preflight refuses it. The page never tries its existing key; some current-revision pending intent may appear in an explicitly unconfirmed read-only preview. It is not an authoritative acknowledgement.

**Isolated coordinator only:** acquire an attempt/account recovery Web Lock; assert the caller's current identity; read and validate authoritative state and frozen paper; read and validate all scoped journal rows and order; retry each durable pending request in sequence through the existing queue lock with its original operation key, question, answer and expected revision; atomically persist the response or conflict in IndexedDB; fetch fresh authoritative state; read the journal again; refuse pending, conflict, closed, inconsistent or invalid rows; then conservatively project. Account assertions surround asynchronous boundaries. Uncertain transport failures preserve the original pending operation; explicit conflict is recorded rather than discarded or silently rebased. An accepted/replayed outcome must pass the queue's revision, state and answer checks. No new key is created for a retry. The caller must supply a meaningful identity guard; the current tests use synthetic identity guards.

**This is not yet a proven end-to-end atomic snapshot.** The coordinator holds a separate recovery lock but `enqueue` does not acquire it. A new local operation can appear after the final list and before/after the result is consumed; a test covers insertion during final refresh, not every insertion window. Other server writers can also advance state after a read. The exact interaction of journal mutations, UI publication, identity changes and server state must be designed and proved before wiring. Queue locking and passing tests do not establish linearizability across IndexedDB and a remote database. The page's generic unavailable message does not show the exact recovery failure reason, another unmet requirement. No pending row may be treated as accepted on the basis of this prototype.

## Revision-model decision

The smallest architecture supported by the **existing nondeployable SQL candidate** is an **attempt-wide, server-authoritative revision and per-operation immutable idempotency ledger**, with serialized local recovery and explicit conflict handling. This is a provisional choice, not a deployed protocol or permission to enable it. It is not safe to assume that client serialization controls other browsers, legacy RPCs, privileged writers or remote commits. There is no implemented per-question revision RPC to rely on.

| Issue | Attempt-wide revision (candidate) | Per-question revision (not implemented) |
| --- | --- | --- |
| Rapid edits to one question | Ordered durable operations; later stale revision conflicts unless explicitly reconciled; never rewrite a possibly delivered request | Same question still needs ordered operations, durable IDs and conflict resolution. |
| Different questions | Competing writes at the same base revision can conflict even when different questions; server result and explicit review win | Independent counters could reduce unrelated conflicts, but require new server schema, atomic operations and semantics. |
| Two tabs / retries / unknown response | Server row lock and unique operation ledger decide outcome; repeat exact key/payload, including after lost response; local Web Locks reduce duplicate sends but are not authority | Still requires durable ledger, cross-tab coordination and authoritative idempotency; counters alone do not solve unknown responses. |
| Ordering and stale conflicts | Attempt revision provides total ordering; a genuine stale request is recorded as conflict, not automatically replayed as a new operation or overwritten | Requires a defined total/causal ordering for attempt-wide operations, question removal and finalization; question counters alone do not supply it. |
| Finalization / deadlines | Candidate serializes answer/finalization on the attempt row and applies post-lock time checks in disposable PG; UI finalization remains disabled | Requires an atomic attempt-wide barrier/snapshot covering all question revisions, deadline and scoring; otherwise finalize can race an answer. |
| Server authority and migration | Candidate is isolated: deployable column/RPCs, reviewed grants, legacy and privileged-writer fencing, old-client compatibility, ledger retention and rollback are missing | Larger migration and new RPC contract, compatibility/cutover and equivalent fencing required; inventing client-side counters is unsafe. |

Neither model permits silent automatic conflict resolution, weakening ownership or idempotency, a legacy snapshot fallback, or changes to exam rules. Candidate row locking and expiry/grace rehearsal do not establish safe mixed-version deployment.

## Race and validation evidence

| Scenario | Evidence and limit |
| --- | --- |
| Two tabs, one pending/lost-commit operation | Standalone browser harness: real IndexedDB/Web Locks and synthetic replay; one delivery and both recoveries acknowledged. Not the CBT page. |
| Retry versus refresh | Isolated fake-IDB queue retry and coordinator concurrently serialize on the queue lock; not real page refresh. |
| Different-question and same-question pending edits | Isolated coordinator tests: first accepted, second stale/conflicted, authoritative draft preserved. No page-created edits. |
| Lost committed response and duplicate delivery | Isolated queue/coordinator and standalone browser harness replay identical key; one synthetic server revision. Real Express/disposable PG rehearsals also test replay, not CBT UI. |
| Close during retry | Standalone browser harness closes the page after synthetic commit and before response; another page replays the same key. Not an actual session page. |
| Genuine stale conflict / malformed acceptance | Isolated tests persist conflict, do not overwrite newer answer, and leave pending on invalid accepted revision. |
| New operation during final refresh | Isolated test refuses a newly pending row. It does **not** close the final-read/publication race described above. |
| Malformed paper and mapping | Actual blocked page with synthetic API: object/empty/blank options, blank text and duplicate paper ID cannot show preview; invalid option/question mapping, stale and conflicted rows also blocked. Unit preflight validates frozen IDs, positions, options and answer bounds. |
| Actual page two-tab recovery | Unproven: page has no recovery retry, no page-created operations, and no conflict-resolution controls. Existing two-page preview tests seed rows and refresh, not real concurrent CBT writes. |

## Production size and verification

- Production `npm run build`: passed. Exact gzip sum of emitted JS assets at level 6: **344,616 bytes / 344,064 budget**, **552 bytes over**. This is 50 bytes below Phase 11's 344,666, but does not meet the limit or demonstrate sufficient writer headroom. No correctness check or budget was removed/raised. The standalone performance audit reports **9/10**, failing total JS; other checks pass. Exploratory module graph before the final blank-text check measured 344,589 bytes, not the final build.
- Full CBT Node suite: **122 passed / 0 failed**; the focused queue/protocol/coordinator subset: **56/56**, isolated where stated. TypeScript check passed.
- Full desktop/mobile browser suite: **246 passed / 20 skipped**, including **62 CBT-named test runs**. Actual blocked-page preview file: **22 passed**; new standalone coordinator browser harness: **4 passed** (two scenarios across two projects). Skips are not passes. Mobile performance profile: **1/1 passed**. Local unconfigured server emitted missing-Supabase-configuration logs for unrelated routes.
- Disposable PostgreSQL: candidate concurrency rehearsal passed after **79 synthetic migrations**, including conflicting attempts, idempotent replay, deadline/grace and finalization locking. Express handlers + disposable PostgreSQL + synthetic Auth/PostgREST and raw browser-fetch race passed. An initial invocation omitted `--import tsx` and failed to load TypeScript; the corrected invocation passed. Neither is hosted Auth/RLS or actual session-page write evidence.
- Full local `npm run ci`: typecheck passed; Node tests **857 passed / 2 failed / 0 skipped of 859**. Failures are the real built total-JS budget and missing deployable `cbt_candidate_answer` / `cbt_candidate_finalize` RPCs. CI stopped at Node tests, so separately run build, performance, browser and PG results are not a successful complete CI run. Independent previous schema review also found missing deployable `cbt_attempts.candidate_answer_revision`. No fake migration or weakened test was added. `git diff --check` passed.

## Remaining work and owner actions

1. Specify and implement an atomic-enough local journal/publication protocol with server authority, identity change and multi-tab invalidation; prove exact failure reasons and unknown-response preservation before considering any page hookup.
2. Establish a demonstrably disposable synthetic/local boundary that cannot target hosted or real data, then prove recovery through the actual guarded page and two real session pages. The loopback check alone is insufficient. Keep editing, conflict controls, navigation persistence and submission disabled until independently authorized and proven.
3. Reduce and remeasure real production JS by at least **552 bytes**, plus sufficient headroom, without weakening correctness or changing budgets. Re-run all performance tests on the final build.
4. Design and review a real deployable protocol and safe migration/rollback, fencing every legitimate legacy and privileged writer without breaking existing clients. The candidate alone is not deployable; do not apply it to hosted systems.
5. Restore staging when the owner is ready, then perform authorized staging/Auth/RLS and genuine browser journeys, preview/review and authoritative GitHub CI. Local synthetic evidence is not a substitute. Production DDL, records, deployment and any cutover require separate approval.

**Phase 12: NOT COMPLETE — NOT READY FOR PRODUCTION.**
