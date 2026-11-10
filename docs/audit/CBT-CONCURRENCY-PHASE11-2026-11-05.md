# CBT Phase 11 — writer boundary audited; integration blocked

**Phase 11: NOT COMPLETE — NOT READY FOR PRODUCTION.** The actual CBT page does **not** create v2 answer operations, send v2 answers, retry them, or provide conflict controls. The existing v2 guard remains in place and the normal exam controls are not exposed for v2. The requested page-created write, clear, replay, recovery and two-tab races are therefore **not proven**. No merge, deployment, hosted migration, hosted/production v2 connection, production-data change, deadline/grace/scoring/question-count change or production feature enablement occurred.

## Audit and implementation status

Branch `arena/e52320f9-edureach-hub`, starting HEAD `ac66747296301e53c363b497b97944368ff85239`. Phase 10, the actual page, journal, typed API, local server gate, candidate SQL and relevant tests were inspected before changes. All prior uncommitted work was preserved. A writer inventory and impact table were presented before changes.

| Interaction | Existing code path | Current v2 boundary |
| --- | --- | --- |
| Answer / clear | `choose` or `clearAnswer` → `setAnswers` → `queueSave` → localStorage snapshot → `flush` → `saveConfiguredCbtDraft` → legacy `/draft` | V2 fails closed before this UI is reached. `choose` itself does not test protocol; exposing it without a new durable writer would allow an unpersisted projection. |
| Navigation | `goTo` updates index → `queueSave(..., true)` → snapshot flush | `queueSave` refuses non-v1, but it is not a v2 navigation/scheduler implementation. |
| Debounce, online, visibility | timer, `online` or `visibilitychange` → `flush` → legacy `/draft` | `flush` checks `legacyProtocol`; there is no v2 retry/recovery orchestration. |
| Manual / timer submit | `submit` → legacy `/submit`; timer invokes the same function | `submit` refuses non-v1. No v2 finalization or scoring is wired. |
| End test | `endTest` → legacy `/abandon` | Refuses non-v1. |
| V2 preflight | `fetchCbtV2State` → `inspectCbtAnswerJournal` → `projectCbtJournal` → blocked read-only preview/error | No page-created answer or `CbtAnswerQueue` call. Failure does not fall back to v1. |

The intended boundary remains **frozen paper + scoped account → validate choice/clear → persist immutable operation in existing IndexedDB journal → show explicitly pending projection → send through existing user-scoped v2 transport → authoritative acknowledgement/conflict → reconcile projection**. That abstraction was **not** implemented or connected in this phase; no second persistence system was created. The page is still guarded because recovery, ordering, identity changes, conflict handling and real-page tests are not complete. Candidate revision is **attempt-wide**, not per-question: two different-question edits based on the same revision can conflict and need explicit handling.

### Changes made

- `src/lib/cbtAnswerQueue.ts`: the existing frozen-paper preflight now rejects missing/non-string question text or subject and non-string/sparse option values before they can reach the read-only preview. It retains existing ID, position, scope and option-bound checks. A red test first reproduced acceptance of malformed content; the repaired test passes.
- `tests/cbt-paper-journal-preflight.test.ts`: malformed text, subject and option checks.
- `tests/e2e/cbt-v2-recovery-preview-mocked.spec.ts`: actual blocked-page synthetic-API browser test for malformed paper; no v2 writer was enabled.
- `tests/cbt-v2-recovery-boundary.test.ts`: isolated fake-IndexedDB/synthetic-server regression for a lost committed response and same-key retry.
- This report. No page writer, v2 gate, transport, server, migration, performance budget or Terser setting was changed.

## Recovery and concurrency: evidence versus gap

The new isolated recovery test commits an answer, loses the response, verifies the durable operation remains pending, and shows that Phase 10's conservative `projectCbtJournal` rejects the now-stale pending row. Retrying the **same key** through the isolated queue yields a replay/acknowledgement and permits projection without a second server revision. This demonstrates an ordering requirement: actual-page initialization must safely handle unknown pending requests before relying on the current projection. It does **not** implement that scheduler or prove the real page can do so, particularly offline, during account changes, or with another tab's concurrent work.

Existing isolated queue tests cover durable enqueue, clear represented as `null`, same-key retry, conflicts, immutable IDs and order, but do not test actual `choose` or `clearAnswer`. Browser harnesses using real IndexedDB/Web Locks are likewise not the CBT session UI. Current actual-page tests cover read-only preview, invalid data and no fallback while blocked; they do not produce an operation by clicking the CBT controls. Same-question races, different-question writes, acknowledgement and lost-response retries through **two real session pages**, and page-created pending answer/clear refresh or close/reopen recovery, remain unimplemented and unproven. The full local browser suite passing does not fill this gap.

The reviewed local Express v2 answer route obtains a caller-scoped client rather than falling back to service role; its candidate SQL uses owner and frozen-question checks, a row lock, an attempt-wide revision and an operation ledger. The disposable HTTP/PostgreSQL rehearsal passed ownership, conflicting revisions, replay, frozen paper ordering and a raw-fetch two-browser race. Its Auth and PostgREST bridge are synthetic; the two pages issue **raw API fetches**, not CBT UI actions. This is not proof of hosted Auth/RLS, staging, local page writer behavior or deployable migrations. The server's `CBT_V2_LOCAL_REHEARSAL`/nonproduction/loopback check is not proof that a loopback service cannot proxy hosted data. Do not wire or expose v2 to hosted or real data.

## Performance

- Phase 10 baseline reproduced by actual build: **344,627 bytes** gzip JS, **563 bytes over** the unchanged 344,064-byte budget.
- Current actual build with additional malformed-paper checks: **344,666 bytes** gzip JS, **602 bytes over** budget, **39 bytes more** than Phase 10. PERF-1 **9/10**: total JS is **336.6 / 336.0 KiB**; the other nine checks pass.
- In-memory standard Terser comparisons against the Phase 10 baseline did not yield a passing, verified production build; the best of that set was 344,159 bytes (95 over). Some later exploratory comparisons overlapped the validation edit and are not treated as a stable before/after result. No proposed minifier setting was saved, no budget was raised and no validation or concurrency check was removed. A safe, measured reduction plus additional headroom for a real writer remains required.

## Verification

- `npm run build`: passed; standalone `npm run perf:audit`: **9/10**, failure above. Typecheck passed as the first stage of full CI.
- Final focused queue, identity, projection, reconciliation, transport, authorization, candidate and new recovery-boundary Node tests: **74/74 passed**. These include isolated and synthetic tests, not page-created v2 writes.
- Focused real-browser CBT guard/recovery/legacy tests plus isolated harnesses: **50/50 passed** across desktop/mobile. The actual v2 session remains blocked. Full desktop/mobile browser suite: **234 passed, 20 skipped**; skipped configured-environment cases are not passes. Unconfigured local server logs included missing Supabase configuration on unrelated requests.
- Disposable PostgreSQL candidate concurrency rehearsal: passed after **79 synthetic migrations** plus the isolated candidate. Actual Express handlers + disposable PostgreSQL + synthetic Auth/PostgREST rehearsal also passed; its optional browser race used raw HTTP, not CBT controls.
- Full local `npm run ci`: typecheck passed, then **848 passed / 2 failed / 0 skipped out of 850 Node tests**. Correct failures: built total-JS budget **336.6 KiB** and schema test missing deployable `cbt_candidate_answer` / `cbt_candidate_finalize`. CI stopped before later stages; standalone browser/build/performance/PG results above are separate. No fake migration or test weakening was used.
- `git diff --check` passed. No authoritative GitHub CI, preview, hosted/staging or production verification was performed.

## Remaining blockers and next steps

1. **Implemented locally:** read-only preview and journal identity from previous phases; malformed-paper preflight hardening and isolated lost-response boundary test in this phase. No page write boundary exists yet.
2. **Proven on actual CBT page:** blocked read-only recovery and fail-closed invalid paper/no legacy fallback in the tested mocked scenarios. Page-created choose/clear, durable persistence, unknown response, actual-page races and submission behavior beyond the existing block remain unproven.
3. **Only isolated:** queue sequencing/replay/conflicts and browser Web Locks/IndexedDB harnesses; raw HTTP/PostgreSQL races are not real session UI tests.
4. **Schema/cutover:** candidate RPCs/column are absent from deployable migration history. A reviewed deployable protocol, safe legacy and privileged-writer fences, old-client compatibility and rollback remain separate work.
5. **Performance:** the current build is 602 bytes over budget even without the writer; adding the writer will require more genuine byte reduction, without sacrificing checks or the guard.
6. **Staging/hosted:** no authoritative hosted CI or staging/Auth/RLS verification. The owner can arrange authorized staging checks once staging is restored; no production credentials are needed for remaining local work.
7. **Submission:** manual/timer v2 submission and scoring/finalization remain intentionally disabled and require a later phase.

Do not remove the guard or enable a local/hosted writer until the unresolved recovery state machine, account/frozen-paper binding, revision conflict semantics, safe local-only boundary and mandatory actual-page two-tab evidence are implemented and demonstrated. **Phase 11: NOT COMPLETE — NOT READY FOR PRODUCTION.**
