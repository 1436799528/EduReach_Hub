# EduReach Hub — CBT Backend Requirements

> **Purpose.** The complete CBT workflow the new backend must implement:
> exam/bank configuration, subject selection, compulsory-English rules,
> question retrieval and ordering, answer saving, timer/deadline handling,
> attempt recovery, submission, server-side scoring, result persistence,
> guest practice, question confidentiality, and concurrent-session
> restrictions. Existing frontend request/response expectations are
> preserved verbatim where practical (see `API-REQUIREMENTS.md` §3–§5 for
> the wire contract).
>
> **Verified against:** `pages/ExamSetupPage.tsx`, `pages/CbtSessionPage.tsx`,
> `pages/CbtPage.tsx`, `pages/CbtPracticeEntryPage.tsx`,
> `pages/CbtResultsPage.tsx`, `src/lib/cbt-config.ts`,
> `src/lib/cbtAnswerQueue.ts`, `src/lib/useCbtPageWriter.ts`,
> `src/lib/cbtProtocolValidation.ts`, `src/lib/api.ts` (CBT section),
> `server.ts` CBT handlers, and the CBT migrations
> (`20261002120000_cbt_practice_and_mock_modes.sql`,
> `20261022090000_cbt_question_serving_rules.sql`,
> `20261022091500_cbt_mock_paper_spec.sql`,
> `20261022093000_cbt_deadline_grace.sql`,
> `20261025120000_cbt_submit_grace_120.sql`,
> `20261107120000_cbt_attempt_protocol_fence.sql`,
> `20261107130000_cbt_v2_server_lifecycle.sql`,
> `20261107140000_cbt_v2_answer_gateway.sql`,
> `20261107150000_cbt_single_writing_session.sql`).

---

## 1. Exam and bank configuration

### 1.1 Banks (`cbt_exams`)

- A bank is one row in `cbt_exams` (see `DATABASE-REQUIREMENTS.md` §3.1).
  `exam_body` ∈ `JAMB | WAEC | NECO | POST-UTME` (canonical uppercase).
  POST-UTME banks carry `institution_id` (required); other bodies null it.
- `duration_minutes` is the bank's default duration (5–240 in the new
  schema). `mock_question_count` + `mock_subject_quota` define the fixed
  mock paper when present.
- `format_status` (`verified | partially_verified | unverified`) +
  `official_guidance_url` + `format_notes` + `guidance_year` describe the
  exam format provenance shown in the setup wizard. They do not affect
  serving.
- `is_active=false` banks are invisible in the catalogue, setup, start,
  paper, and guest flows.

### 1.2 Bank classification (fail closed)

- Every bank must have a `cbt_bank_security` row (`public` or
  `restricted` + `correction_release_at`). **No row = unclassified =
  inaccessible**: excluded from `GET /api/cbt/exams` (including counts),
  `GET .../subjects` → 404, start → 404, paper → 404, guest → 404.
- `public` banks: anyone (including guests) may list metadata, start
  attempts (signed-in), and use guest practice.
- `restricted` banks: only users with an **active** candidate assignment
  may access. Revocation takes effect immediately for all subsequent
  operations (re-checked inside every write transaction).
- Classification is staff-chosen (`cbt.manage`) and immutable once set.
  `correction_release_at` (restricted only) is future-only on set and can
  never move earlier.
- **Policy-unavailable fails closed with 503** (`CBT service is
  temporarily unavailable.`), never by falling back to open access.

### 1.3 Subject catalogue vs. bank availability

- `cbt_subject_catalog` is the governed subject list per exam body
  (advisory for the wizard).
- The **authoritative** servable list for a bank is derived from actual
  `exam_questions` rows (`review_status != 'rejected'`), aggregated by
  canonical subject key with a display label. `GET .../subjects` returns
  this + `totalQuestions` + `review` counts + `mock` spec + `rules`.
- The wizard (`ExamSetupPage`) renders from `GET .../subjects` and
  validates with the same rules the server enforces. The server is
  authoritative; the wizard is a preview.

---

## 2. Subject selection and compulsory-English rules

### 2.1 Canonicalisation

All subject comparisons use the canonical key (`normalizeSubject()`):
trim, collapse `[-_]+` to space, lowercase, and map
`use of english | english language | english → english`.
Display names are never rewritten. The server must canonicalise
identically (dedupe, compulsory checks, planning, availability).

### 2.2 Compulsory subjects

- **JAMB (UTME): Use of English is compulsory in both practice and mock.**
  Enforced in the wizard (`compulsorySubjectKeys()`), in the Express
  pre-check, and in the start RPC. Error (422):
  `Use of English is compulsory for JAMB UTME. Include it in your subject
  combination.`
- **WAEC, NECO, POST-UTME: no compulsory subject.** English is selectable,
  never forced. (The wizard previously gated Start on English presence for
  all bodies — a bug that was fixed by gating only when
  `compulsoryKeys.length > 0`. Do not regress this.)
- `GET .../subjects` returns `rules.compulsorySubjects` (canonical keys)
  + `rules.compulsoryMissing` (true when the bank has no English pool, so
  the wizard can block Start with an honest message). The wizard prefers
  the server's `rules` over its local `compulsorySubjectKeys()`.

### 2.3 Subject-count limits

- General: `maxSubjects` from `cbt_limits` (frontend default 9; old SQL
  said 6 — **the new backend must use one value everywhere; recommend 9**).
- JAMB: at most 4 subjects (English + 3 others), in both modes.
- WAEC/NECO mocks: at least 4, at most 9.
- POST-UTME mocks: at least 4.
- Practice: at least 1 subject (no minimum beyond that).

### 2.4 Mock combination rules (`mockCombinationError`)

- JAMB mock: exactly 4 subjects including English.
- WAEC/NECO mock: at least 4 subjects.
- POST-UTME mock: at least 4 subjects.
- Practice: flexible (1+ subjects, student-sized).

---

## 3. Modes: practice vs. mock

| Aspect | Practice | Mock |
|---|---|---|
| Size | Student-chosen `questionCount` (5–100) | Bank's paper (`mock_question_count` / `mock_subject_quota`), or full bank |
| Duration | Student-chosen (5–240 min), or pace-derived (`durationForQuestionCount`) | Bank default (`mockDurationMinutes`, default 120) |
| Subjects | Student-chosen (1+) | Governed combination (§2.4) |
| Quota | Proportional across chosen subjects | Fixed quota (JAMB: English 60 + 40×3) |
| Resume | Resumable in-progress attempt returned on re-start | Same |

The frontend `CbtMode` is `'practice' | 'mock'`; `mode` defaults to
`practice` in the setup page (unless `?mode=mock`).

---

## 4. Paper planning (deterministic, server-authoritative)

The server plans the paper at start time and **freezes** it into
`cbt_attempts.question_ids` (ordered UUID array). The frontend
`previewPlan()` mirrors this algorithm for display; the server plan is
authoritative and the two are compared before submission.

**Algorithm (from `plan_cbt_paper` + `previewPlan`):**
1. Preserve the student's subject order. Drop subjects with zero available
   questions (the caller reports them as uncovered).
2. Target = `min(requested total, total available)`.
3. If a subject quota exists (JAMB mock): assign required questions first
   (capped by availability and target), trim from the end if over target.
4. If no quota and `target >= subject count`: give every subject 1 question.
5. Distribute the remainder one at a time to the subject with the smallest
   used-share (`quota / available`), capacity-aware, deterministic.
6. Materialise subject-by-subject in student order, each block ordered by
   `exam_questions.position, id`, limited to the quota.
7. Positions are the array order (1-based). `subject_plan` is derived:
   `[{subject, questions, first, last}]`.

**JAMB pace:** 180 questions / 120 minutes. Practice duration =
`ceil(count / 180 * 120)` clamped to 5–240 (`durationForQuestionCount`).
Question-count choices are the presets `[10,20,30,40,50,60,80,100]`
filtered to `[minQuestions, min(maxQuestions, bankTotal)]`, plus the bank
total itself when servable (`questionCountOptions`).

---

## 5. Attempt start

**Endpoint:** `POST /api/cbt/exams/:examId/attempts` (§3.1 in API doc).
Rate limit: 60 starts / 10 min per user (per-user, not per-IP — a school
lab is one IP behind NAT).

**Server steps:**
1. Authenticate + require `cbt.attempt`.
2. Canonicalise + dedupe subjects; validate count limits, JAMB English,
   mock combination, practice question-count limits (422 on failure).
3. Check bank exists, `is_active`, and `candidate_access` (404 otherwise).
4. Call the start logic (transaction): if an in-progress attempt exists
   for this user+exam, return it with `resumed: true` (200). Otherwise
   plan the paper (§4), freeze `question_ids`, compute `subject_plan`,
   `selected_subjects`, `duration_minutes`, `expires_at =
   started_at + duration`, insert the attempt (201).
5. Return `CbtConfiguredStart`.

**Idempotency:** re-starting with the same configuration while an attempt
is in progress returns the same attempt (no duplicate). The frontend
navigates to `/cbt/session/<id>` immediately after start.

---

## 6. Question retrieval (paper)

**Endpoint:** `GET /api/cbt/attempts/:attemptId/paper` (§3.2).

- Owner check (`user_id = caller`) + bank-access re-check per request
  (revocation stops paper access immediately) → 404 on mismatch.
- Expiry check: if `expires_at` passed (plus grace), mark expired via the
  owner-scoped expiry RPC and return 409 `This CBT attempt has expired.`
- Protocol: stored `protocol` selects the response. Legacy attempts →
  `{version:1}` via the paper RPC. v2 attempts → `{version:2,
  scope:'local-rehearsal'}` **only** when the rehearsal gate is open;
  v2 attempt without the gate → 503. The frontend validates the protocol
  object strictly (`CbtProtocolUnavailableError` otherwise).
- Questions are returned **without** `correct_option`/`explanation`:
  `{position, subject, id, text, options[4]}`. The frozen `question_ids`
  order defines positions; a missing question (deleted mid-attempt) →
  409 `This attempt requires review.` (fail closed, never re-plan).
- `serverTime` (server clock ISO string) is returned so the client timer
  uses server time, not the device clock.
- `savedAnswers` (draft) + `questionIndex` (resume position) are returned
  for recovery.

---

## 7. Answer saving

### 7.1 Legacy (v1) draft — the production path

**Endpoint:** `PATCH /api/cbt/attempts/:attemptId/draft` (§3.3).

- Body: `{ answers: Record<position, 0-based index>, questionIndex? }`.
- **Idempotent:** re-saving the same draft succeeds as a no-op. The
  frontend debounces saves (`queueSave` in `CbtSessionPage`) and also
  keeps a `localStorage` pending snapshot (`edureach-cbt-pending:<id>`)
  as a recovery aid.
- Validation: `answers` must be an object; each value must be an integer
  0–3 (or absent = unanswered); positions must be within the frozen
  paper. Invalid → 400.
- Expiry: saving after `expires_at` (+ grace) → 409 + mark expired.
- Protocol mismatch (v2 attempt via v1 draft) → 409.
- The draft is stored in `cbt_attempts.answers_draft` (+
  `current_question`). The new backend must keep this shape (JSONB object
  keyed by 1-based position string).

### 7.2 V2 versioned answers — rehearsal only (fenced)

**Endpoints:** `GET .../state`, `POST .../session`,
`PATCH .../answer`, `POST .../finalize` (§5 in API doc). All return 503
in production. When the rehearsal gate is open:

- **State:** `{protocol:2, revision, answers, status, questionIds}`.
  The client verifies the frozen ID-to-position mapping before replaying
  any persisted operation (`validateCbtJournalPaper`).
- **Writing session (lease):** `POST .../session` with `{protocol:2,
  requestKey, takeover}`. Creates/resumes/takes over the single active
  writing session. `takeover:false` with an active session →
  `takeover_required` (409). Takeover revokes the old session and
  increments `generation`. Replaying a `requestKey` returns the recorded
  outcome (never reactivates a revoked session).
- **Answer operation:** `PATCH .../answer` with `{protocol:2,
  expectedRevision, operationKey, questionId, selected, sessionId,
  sessionGeneration}`. Outcomes: `accepted` (revision incremented),
  `replayed` (same `operationKey` + same input → recorded outcome),
  `conflict` (stale `expectedRevision` → current revision + answers
  returned), `expired`, `closed`, `session_revoked` (stale lease →
  `CBT_SESSION_REVOKED`). Same key + different input → refuse.
- **Finalize:** always 503 (`CBT finalization is unavailable pending
  recovery verification.`) — a browser seal cannot prove the absence of
  offline work on other devices.
- **Client journal:** `CbtAnswerQueue` (IndexedDB) persists operations
  with `pending | acknowledged | conflicted | resolved-server |
  superseded | closed` statuses. The server revision accounts only for
  operations accepted by *this* server; it cannot reveal unregistered
  offline work on another device. Conflicts require explicit review —
  never silent overwrite.

**New-backend requirement:** implement the v1 draft path fully. Implement
the v2 schema (`cbt_v2_operations`, `cbt_v2_writing_sessions`,
`candidate_answer_revision`) and the rehearsal endpoints behind the same
dev-only gate, **or** omit v2 entirely and always return
`protocol:{version:1}` (the frontend degrades cleanly). **Do not enable
v2 globally without an explicit release decision.**

---

## 8. Timer and deadline handling

- **Authoritative deadline:** `cbt_attempts.expires_at` (server clock).
  The client countdown is display-only; `serverTime` from the paper
  response corrects device-clock skew.
- **Auto-submit:** when the client countdown hits 0, `CbtSessionPage`
  auto-submits exactly once (`autoSubmitStarted` ref). The server still
  enforces the deadline — a late submit is scored only within the grace
  window, otherwise 409 expired.
- **Submit grace:** 120 seconds after `expires_at` (`cbt_submit_grace`).
  The new backend must define its grace explicitly and apply it
  consistently to draft saves, paper reads, session creation, and submit.
- **Expiry marking:** owner-scoped, lock-after-check
  (`cbt_expire_owned_attempt` equivalent). It can only transition
  `in_progress → expired`; it never alters answers or reopens a result.
  If the RPC is missing/fails, the server logs a warning and does **not**
  fall back to a privileged table update (migration-first deployment).
- **Stale-attempt sweep:** `expire_stale_cbt_attempts` equivalent for
  abandoned in-progress attempts (the new backend should run this as a
  scheduled job).

---

## 9. Attempt recovery

- **Resume:** `GET .../paper` returns `savedAnswers` + `questionIndex` +
  `expiresAt`. The session page restores answers and position.
- **Re-start:** `POST .../attempts` with an in-progress attempt returns
  it with `resumed: true` (same id, same frozen paper, same deadline —
  the timer does not restart).
- **History resume:** `GET /api/cbt/attempts` marks `resumable: true` for
  in-progress attempts; `ContinuePracticeCard` links back to the session.
- **Local pending snapshot:** `CbtSessionPage` writes
  `edureach-cbt-pending:<attemptId>` on every change and removes it only
  after the server draft save succeeds (best-effort compare; localStorage
  has no atomic CAS). On load, the snapshot is merged with server state.
- **V2 journal recovery:** IndexedDB operations are projected onto server
  state (`projectCbtJournal`); unknown/conflicting histories throw
  `CBT journal requires review.` — never inferred.
- **Result recovery:** after submit, the result is cached in localStorage
  (`cbt-result-<id>`) so the scorecard survives a reload even if the
  result RPC is unavailable. `fetchCbtResult` falls back to the
  owner-scoped `cbt_attempts` row + paper when the RPC has no rows, and
  only uses the local breakdown when its score agrees with the server
  score.

---

## 10. Submission and server-side scoring

**Endpoint:** `POST /api/cbt/attempts/:attemptId/submit` (§3.4).

- Body: `{ answers: Record<position, 0-based index> }`.
- **Server-authoritative:** scoring runs against the frozen
  `question_ids` in a single transaction with the attempt row locked.
  The client never computes the score. `examId` is not accepted (the
  attempt id is the identity; the legacy `POST /api/cbt/submit` that
  accepted `examId` is superseded — do not re-implement it).
- **Scoring:** `correct = (selected_option == correct_option)` per
  question; `score = round(correct / total * 100, 2)`. Unanswered =
  incorrect. `breakdown` entries:
  `{question (position), subject?, selected (0-based|null), correct
  (0-based), explanation?, isCorrect?}`.
- **Idempotent:** a retried submit returns the stored result (same
  score/breakdown). Submitting an already-submitted attempt without a
  stored result → 409.
- **Result persistence:** `score`, `correct_answers`, `total_questions`,
  `submitted_at`, `status='submitted'` on the attempt + per-question
  `cbt_answers` rows (`selected_option`, `is_correct`). The frontend
  caches the response in localStorage and navigates to the results page.
- **Errors:** 400 (answers missing/not an object), 409 (expired / no
  result produced), 503 (unrecognised — never 400, so the client shows
  "connection problem, press Submit again").

---

## 11. Result persistence and review

- **Result read:** `fetchCbtResult(attemptId)` tries (in order):
  1. localStorage (guest ids or unconfigured),
  2. RPC `get_cbt_result` (owner-scoped),
  3. fallback: owner-scoped `cbt_attempts` row + `cbt_exams` row + paper
     (subject breakdown attached from the frozen paper),
  4. localStorage scan for the exact attempt id (guest reopen after
     sign-out).
- **New-backend replacement:** `GET /api/cbt/attempts/:attemptId/result`
  **[PROPOSED]** returning `CbtResultPayload`:
  `{attempt: {id, exam_id, score, correct_answers, total_questions,
  submitted_at, mode, duration_minutes, subjects}, exam, answers:
  [{question_id, selected_option, is_correct}], questions: [{id,
  position, subject, question_text, option_a..d, correct_option,
  explanation}], subjects, plan}`. Answer keys/explanations are included
  **only** for submitted attempts (and, for restricted banks, only after
  `correction_release_at` — see §12).
- **Delete:** `DELETE /api/cbt/attempts/:attemptId` deletes the caller's
  own attempt/result (guest/local ids handled client-side).

---

## 12. Guest practice

- **Serving:** `GET /api/cbt/exams/:examId/guest-questions` (legacy) +
  `POST /api/cbt/guest-submit` (§4 in API doc). **Public banks only** —
  restricted/unclassified → 404 with no question read performed.
- **Scoring:** server-side against the bank's questions (paper selected
  by `subjects` + `paperSeed`). Score = `round(correct/total*100, 2)`.
  Attempt id is synthetic (`guest-cbt-<ts>-<rand>`) and **not persisted**
  server-side; the result is cached in localStorage by the caller.
- **Confidentiality (critical):** corrections are released **per
  attempted question only**. `correct`/`explanation` are `null` for
  unattempted questions. An empty submission (`{"answers":{}}`) must
  return **no keys at all** — this was a disclosed-key vulnerability that
  was fixed; do not regress it. Rate limit: 30/10 min.
- **No guest attempt persistence:** guest results are browser-owned.
  The new backend must not create attempt rows for guests.

---

## 13. Question confidentiality

| Rule | Enforcement |
|---|---|
| Students never receive `correct_option`/`explanation` before permitted release. | Paper/draft/catalogue responses exclude keys. Result responses include keys only for submitted attempts (guest: per-attempted-question; restricted: after `correction_release_at`). |
| Unclassified banks fail closed. | No row in `cbt_bank_security` → no catalogue listing, no counts, no subjects, no start, no paper, no guest questions. 404 (student) / 503 (policy unavailable). |
| Restricted banks require active assignment. | `candidate_access` checked on every read/write (catalogue, subjects, start, paper, draft, submit, progress, v2). Revocation is immediate. |
| Provenance guard. | Question text existing in a restricted bank cannot be added to a public/unclassified bank (403). Bank moves refused (403). Import commit re-checks. |
| No generic question listing for students. | The only student question reads are the frozen paper (no keys) and the post-submission result (keys). Admin question listing requires `cbt.read`. |
| Refusals never echo content. | Error bodies contain no question text, fingerprint, bank title, SQLSTATE, or raw DB error. |

---

## 14. Concurrent session restrictions

- **One active writing session per attempt** (v2): partial unique index
  `(attempt_id) WHERE status='active'`. Takeover revokes the previous
  session and increments `generation`; stale-session writes are rejected
  with `session_revoked` / `CBT_SESSION_REVOKED`.
- **One in-progress attempt per student per exam** (v1 + v2): re-start
  resumes instead of duplicating.
- **Answer idempotency:** v1 draft saves are idempotent (same draft =
  success). V2 operations are idempotent on `operation_key` (same key +
  same input = replayed outcome; same key + different input = refuse).
- **Revision ordering (v2):** `expectedRevision` must equal the current
  `candidate_answer_revision`, else `conflict` with current state
  returned. One accepted answer per revision (partial unique index).
- **Submission idempotency:** retried submit returns the stored result.
- **Service-request idempotency** (adjacent): `submission_key` replays
  return the existing request.

---

## 15. Frontend expectations checklist (new backend must satisfy)

- [ ] `GET /api/cbt/exams` lists only public banks with availability counts.
- [ ] `GET /api/cbt/exams/:id/subjects` returns bank payload with
      `limits`, `review`, `mock`, `rules` (compulsory + missing flag).
- [ ] `POST .../attempts` validates subjects/mode/counts/duration and
      returns 201 (new) / 200 (resumed) with `plan` + `expiresAt`.
- [ ] `GET .../paper` returns frozen paper without keys + `serverTime` +
      strict `protocol` object (`{version:1}` in production).
- [ ] `PATCH .../draft` is idempotent; 409 on expiry/protocol mismatch.
- [ ] `POST .../submit` scores server-side against the frozen paper and
      is idempotent on retry.
- [ ] `POST .../abandon`, `DELETE ...`, `GET /api/cbt/attempts` behave as
      specified.
- [ ] Guest submit releases keys only for attempted questions; public
      banks only; rate-limited.
- [ ] V2 routes return 503 in production (fence preserved).
- [ ] All CBT errors use the §12 vocabulary in `API-REQUIREMENTS.md`;
      unrecognised errors → 503, never 400.
- [ ] Answer indices are 0-based; positions are 1-based; timestamps are
      ISO-8601 UTC.
