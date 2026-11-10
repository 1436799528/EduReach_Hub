# CBT Phase 10 — guarded read-only recovery preview, incomplete

**Phase 10: NOT COMPLETE. Overall: NOT READY FOR PRODUCTION.** The actual blocked CBT page can render a read-only preview derived from its existing `answers` state when journal recovery is unambiguous. The real production build exceeds the unchanged JavaScript budget by **563 gzip bytes**. The requested page-created-answer/close/reopen scenario also remains unproven because v2 editing and writes are intentionally blocked. V2 answer writing, conflict controls, submission and the fail-closed protocol guard remain disabled. No merge, deployment, hosted migration, hosted/production v2 connection, production data change, deadline/grace/scoring/question-count change or CBT card/CSS redesign occurred.

## State-boundary audit and changed files

Starting branch `arena/e52320f9-edureach-hub`, HEAD `ac66747296301e53c363b497b97944368ff85239`; Phase 9 and the real page, journal, reconciliation, API and existing tests were examined. Existing uncommitted work was preserved; the other Arena branch was not modified. The audit table was presented before implementation.

- `pages/CbtSessionPage.tsx`: keeps the one `answers` state and existing v1 snapshot path. The v2 paper/state/journal preflight calculates a projection before changing `answers`, retains `legacyProtocol.current === false`, and still raises `CbtProtocolUnavailableError`. The blocked error view may show a labelled read-only textual preview; it never creates an editable attempt or exposes answer radios, submit or conflict controls. Preview identity metadata gates rendering to the same account and attempt; a new load clears its visibility.
- `src/lib/cbtAnswerQueue.ts`: adds `projectCbtJournal`, a pure, conservative read-only operation using the existing canonicalization, scope validation, snapshot and frozen-paper checks. It neither persists nor transmits operations.
- `tests/cbt-journal-projection.test.ts`: projection, ordering, server authority and fail-closed boundary tests.
- `tests/e2e/cbt-v2-recovery-preview-mocked.spec.ts`: actual CBT page with synthetic routed APIs/auth and seeded browser IndexedDB, including two actual pages, refresh and invalid cases.
- This report. No server, migration, Terser configuration or performance threshold was changed in this phase.

Existing v1 callbacks remain `choose`/`clearAnswer` → `setAnswers` → `queueSave` → legacy snapshot save, with navigation potentially flushing. They remain v1-only through the existing guard. The normal exam UI renders `answers[question.position]` as selected radio options; the new v2 recovery is **not** that editable exam UI. It renders question/answer text from the same `answers` state inside the blocked page, with a warning that pending answers are not confirmed saved. The page does not initialize the attempt for v2, so keyboard handlers, the timer/submit path and legacy writers are not enabled by the preview.

## Projection semantics and safety limits

The calculation starts with the validated server snapshot. It canonicalizes operation and scope UUIDs, validates each row against the current scope and frozen question paper, rejects duplicate operation IDs and non-increasing or duplicate journal sequences, and checks option bounds. It builds a new local object before `setAnswers`; errors do not commit a partial projection. Conflicted or closed operations reject the entire preview. Pending rows are projected in sequence only when their expected revision equals the fetched server revision, their stored base and last-server answer equal that server answer, their last-server revision equals their expected revision and no accepted revision is recorded. A pending clear removes that position. Stale/unknown pending outcomes, mismatched bases and inconsistent metadata fail closed rather than guessing whether an unseen commit or remote change occurred. Multiple qualifying pending rows for one question apply in sequence, so the last qualifying row appears.

Acknowledged rows are validated for their expected/accepted revision relationship, last-server revision and answer. They never overwrite the fetched authoritative snapshot; if an acknowledgement claims the same server revision with a different answer, recovery fails closed. Thus an old acknowledgement cannot replace a newer server answer. `superseded` and `resolved-server` rows are ignored for projection after rejecting a future last-server revision; this limited handling does not establish a full conflict/replacement reconciliation lifecycle. A successful preview is a point-in-time local view, not confirmation of persistence or an active-tab synchronization mechanism. Concurrent server updates or another tab's later journal changes are not automatically reflected; no broadcast or journal data is treated as server authority. V2 write integration, refresh notifications, conflict controls and finalization remain unimplemented.

## Actual-page browser evidence

All cases below use the real CBT page and real Chromium IndexedDB, but **synthetic routed APIs/auth** and manually seeded records. They do not use hosted data or show a live server transaction.

| Case | Evidence / limitation |
| --- | --- |
| A — acknowledged | An acknowledged operation matching the synthetic server answer was seeded; after actual-page refresh, the blocked preview rendered `First question: B`. The server snapshot is the source of the acknowledged value. |
| B — pending | Current-revision pending rows were accepted and their values rendered in the read-only preview; the warning explicitly says pending answers are not confirmed saved. |
| C — two questions | Two journal positions rendered their separate projected values in the real blocked page. |
| D — ordering | Two qualifying same-question pending rows plus another question were seeded; the later same-question sequence was rendered. |
| E — casing | An uppercase legacy row and uppercase account/attempt input were read after local IDB normalization, then rendered. Mixed-case validation is also covered by unit/identity tests. |
| F — close/reopen | A page showing a previously seeded pending record was closed; a new actual page in the same context reopened and rendered it, with unchanged row count. **Not proven:** the actual page itself answering and creating that operation. Doing so would require the prohibited v2 writer. |
| G — invalid | Mismatched question ID, out-of-range answer, stale revision and conflicted status produced the blocked error with no preview and no observed answer write. |
| H — two pages | Two real CBT pages for the same seeded journal produced the same preview after their own refresh, and no duplicate rows appeared. **Not proven:** live cross-tab notification, simultaneous edits or consistency after a later server/journal change. |

The evidence distinguishes the steps: the journal is read by `inspectCbtAnswerJournal`; `projectCbtJournal` accepts or rejects all rows; only successful projection calls `setAnswers`; and the blocked view renders text by reading that `answers` state. The browser assertions verify rendered text, the blocked alert, absence of radio controls and no intercepted CBT non-GET writes. They do not observe or claim an actual v2 operation being written by the page, a selected normal exam radio, or production-grade online synchronization.

## Performance and test results

- Phase 9 stable build: **343,978 bytes** gzip JS. This phase's real production build succeeded, but gzip JS measured **344,627 / 344,064 bytes**, a **649-byte increase** and **563 bytes over** the limit (**336.5 / 336.0 KiB**). PERF-1: **9/10 passed**, with total JavaScript failing. The existing Terser setting was not changed, and no validation or performance budget was weakened. Per instruction, further performance changes were stopped rather than masking the failure. This over-budget integration is not ready for release.
- Final standalone `npm run typecheck`: passed. Focused journal, projection, preflight, reconciliation, protocol and authorization Node tests: **65/65 passed**.
- Focused actual-page/guard/identity desktop/mobile Chromium run: **34/34 passed**. After adding an explicit out-of-range browser case, the final real-page recovery file alone passed **12/12**. The full browser suite before that final test-only addition passed **230**, with **20 skipped**. Unconfigured server logs noted missing Supabase configuration on unrelated requests. No browser result proves hosted services.
- Full local `npm run ci`: typecheck passed, then **846 passed / 2 failed / 0 skipped of 848 Node tests**. The failures are the correct built-bundle performance test and the unchanged schema test for missing deployable `cbt_candidate_answer` and `cbt_candidate_finalize`. CI stopped after Node tests; its later stages were not run by CI. Separate browser, build and performance results above are not authoritative GitHub CI.
- Disposable PostgreSQL concurrency rehearsal passed after 79 synthetic migrations plus the isolated candidate, covering local replay/conflict, permissions and deadline/expiry/finalization races. It is not actual-page v2 writing, hosted Auth, RLS or a deployable migration.
- `git diff --check` passed. No authoritative GitHub CI, staging/preview review, merge or deployment occurred.

## Remaining blockers

First reduce the **actual emitted bundle by at least 563 bytes** without changing the budget or weakening validation, then rebuild and rerun the full performance audit. The existing Terser configuration did not make this build pass. The read-only preview needs further review of historical resolved/superseded chains, account changes, invalid paper content, server and journal changes between reads, and coordinated two-tab refresh. A real-page-created answer followed by close/reopen cannot be tested until a separately authorized, fully safe v2 writer exists; it was not simulated as a pass. Do not enable v2 writes, conflict UI or submission based on this work.

Also outstanding: a reviewed deployable candidate migration and safe legacy/direct/privileged-writer cutover, rollback and old-client handling; authoritative GitHub CI, preview/review, isolated staging verification and separate approval. When staging is restored, the owner can arrange authorized staging checks and review genuine content/legal materials; no production credentials are needed for the current local work. **Overall: NOT READY FOR PRODUCTION.**
