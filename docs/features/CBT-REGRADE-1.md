# CBT-REGRADE-1 — regrading attempts after an answer key is corrected

Status: **implemented** (working guide 5.5 Step 7; checklist items in 5.5 and
6.5; hotfix response in 10.5).

## Why

An answer key is wrong in the bank. A reviewer fixes it. Every student who
already submitted a paper containing that question was graded against the old
key, and their stored score, their per-question verdict and the result page they
can open all still say the old thing. Until now there was no way to correct that
without editing rows by hand.

The guide asks for exactly one tool: *"for a given question (after a fixed
answer key), find attempts that included it, recompute their results, and record
what changed. Notify only if policy requires."*

## What the tool does

Given a question:

1. **Finds the affected attempts.** A submitted attempt is affected when it has
   a `cbt_answers` row for that question. That row is the record that the
   question was in the frozen paper — not a date window, not a subject guess, and
   not the request body.
2. **Recomputes from the corrected key.** The verdict is
   `selected_option = exam_questions.correct_option`, where `selected_option` is
   what the student stored at submit. No score, answer or attempt id is ever
   read from the HTTP request.
3. **Updates everything derived, in one statement per attempt.** The answer
   row's `is_correct`, the attempt's `correct_answers` and `score`, and — for a
   v2 attempt — the `v2_result` snapshot the finalize replay returns.
4. **Preserves history.** `selected_option`, `submitted_at`,
   `submission_late_ms`, the attempt status and `total_questions` are untouched.
   A question deleted later therefore cannot silently move a student's
   percentage.
5. **Records the run** in the existing admin audit log: who, when, which
   question, which key, and every affected attempt with its before and after.

## Why it is idempotent

The operation is a **recompute**, not a delta. Each run derives the verdict and
the score from two immutable inputs — the stored answer and the current key — so
a second run computes the same numbers and reports `changed: 0`. Nothing is
incremented, so nothing can be applied twice. Running it again after a further
key correction is safe and is the intended way to apply that correction.

A no-op run is still audited: "we checked and the key was already right" belongs
in the trail.

## Endpoints

| Verb | Path | Capability | Effect |
| --- | --- | --- | --- |
| `GET` | `/api/admin/cbt/questions/:questionId/regrade` | `cbt.read` | Preview: what a regrade would change. Writes nothing. |
| `POST` | `/api/admin/cbt/questions/:questionId/regrade` | `cbt.manage` | Apply, then audit. |

Both call the same database function, so what an operator sees is what they
apply. The POST accepts an optional `expectedCorrectOption` (`A`–`D`); if the
stored key moved after the operator looked at it, the request is refused with
`409` instead of regrading against a key nobody has reviewed.

Responses never include a student's answer text or email address. The per-attempt
list is capped at 500 entries with `truncated: true`; the counts above it are
always complete and every affected attempt is regraded and audited regardless of
the cap.

## Database

`public.cbt_regrade_question(p_question uuid, p_apply boolean default true)`
returns `jsonb`. Additive only: **no table, no column**.

- `security definer`, owned by `cbt_v2_executor` so the protocol fence permits a
  v2 answer row to be rewritten (a v2 key cannot currently be corrected at all —
  the fence refuses any edit to a question a v2 attempt references).
- `revoke all … from public, anon, authenticated`; `grant execute … to
  service_role`. No student or browser session can reach it; the capability-
  checked admin API is the only path.
- Locks each affected attempt with `for update`, and refuses an unknown question
  before locking anything.
- Skips an attempt whose answer rows and recorded total cannot produce a score
  rather than guessing, and counts it as unchanged.

## What is deliberately not done

- **No notification.** The guide says "notify only if policy requires"; no such
  policy exists yet. Tell students through the support channel you already use.
- **No auto-resolution of question reports.** A regrade is evidence that reports
  were right, but closing them is a triage decision with its own audit entry
  (`question_report_resolved`).
- **No grader version column.** The audit metadata carries `grader:
  "regrade-1"`, which is what the guide's `grader_version` is for at this scale;
  a column would have been a schema change the existing tables do not need.

## Tests

- `tests/cbt-regrade.test.ts` — 21 tests: the operator confirmation, payload
  validation (a malformed payload is a failure, never "0 changed"), normal /
  repeated / partial regrades, the audit shape, and the schema contract that
  only the server can run the function and that it recomputes rather than
  increments.
- `tests/authorization.test.ts` — 6 route tests: anonymous `401`, student and
  unrelated staff `403`, preview writes nothing and runs with `p_apply:false`,
  apply audits with before/after, a re-run is a no-op, a stale confirmed key is
  `409`, and an invalid or unknown question never reaches the grader.
- `tests/api.test.ts` — both new admin routes are in the unauthenticated `401`
  sweep automatically.

## Acceptance criteria

- [x] Affected attempts are found from the stored answer rows.
- [x] Results are recomputed from the corrected key, never from client data.
- [x] Original answers, timestamps and denominators are preserved.
- [x] Re-running the same regrade changes nothing.
- [x] Derived scores, verdicts and the v2 snapshot stay consistent.
- [x] The run is audited with actor, time, question and before/after.
- [x] Only `cbt.manage` can apply, only `cbt.read` can preview.
- [x] A question that is not in the attempt's paper cannot be regraded into it.
- [x] Submitted attempts are the only ones touched; in-progress papers are
      graded with the corrected key when they are handed in.
