# CBT subject selection — remediation note (Phase 2A + 2B)

**Date:** 2026-10-19 · **Status:** code + migration drafted; not released. The
migration in `supabase/migrations/20261021120000_cbt_subject_selection_rules.sql`
must be applied **before** (or with) the application code at an approved
release. It has been exercised only against the pglite replay in tests.

## Root cause of “subjects are not showing for selection”

1. The setup route chose its bank from the public catalogue, which is ordered
   newest-first. The newest JAMB bank was a 2-question test bank
   (`33075e1c…`, two placeholder Physics questions, no English), so the wizard
   showed a single “Physics” chip and could never satisfy its own
   compulsory-English requirement or the 5-question minimum. The
   `resolveSetupExam` “prefer a bank with English” rule keyed on
   `subject='Multiple subjects'`, which every bank carries, so it never fired.
2. `/api/cbt/exams` counted questions from an unpaginated PostgREST read, so
   counts silently capped at 1,000 rows (NECO reported 0 questions; JAMB
   Comprehensive reported 205 of 400) and differed from the setup’s counts.
3. The frontend required English for **every** body; picking a subject group
   silently replaced the student’s selection with `[English]`; and bank /
   catalogue / course-guide spellings (`Literature-in-English` vs
   `Literature in English`, `Use of English` vs `English Language`) could
   mismatch.

## Rules now in force (shared by UI, API and database)

- **Canonical subjects.** `Use of English`, `English Language` and `English`
  are one subject (`cbt_subject_key()` in SQL, `normalizeSubject()` in TS);
  punctuation/case/spacing variants pool together. Availability offers one
  canonical subject whose display name is the bank’s most common spelling.
- **Compulsory subjects.** `Use of English` is compulsory for **JAMB practice
  and mock only**. WAEC, NECO and Post-UTME practice accept any valid
  selection; their mocks require a valid selection within the server subject
  maximum. Post-UTME per-institution rules need verified institutional data
  and are deliberately not encoded yet.
- **Startability.** A bank is startable only with ≥ the server minimum
  question count and, for JAMB, an English subject. Default setup routes and
  simulator cards never resolve to an unstartable bank; an explicit `?exam=`
  deep link to one explains why it cannot start.
- **Bounds.** Explicit question counts outside the server limits (5–100) and
  selections that cannot reach the minimum are rejected with specific
  messages. Missing subjects are named. Case-variant duplicates can never
  double-allocate or repeat a question.
- **Guests.** Kept, but guest papers use the same planner as signed-in
  sessions: no silent fallback to unrelated subjects, one question-count
  contract, paginated reads.

## The migration

`20261021120000_cbt_subject_selection_rules.sql`:

1. Deactivates the 2-question test bank `33075e1c…` (title-guarded; rows and
   history preserved — reactivation is `update … set is_active=true`).
2. Adds `public.cbt_subject_key(text)` (immutable; not client-executable).
3. Replaces `cbt_subject_availability`, `plan_cbt_paper` and
   `start_cbt_attempt_configured` with canonical, bounded versions (see
   rules above). No tables, policies or grants change; `exam_questions`
   remains service-role/RPC only.

**Not in this change:** migrations `20261020130000`/`20261020140000` (bulk
generated content) — they remain unapplied and must not be applied in their
current form. No question content was altered: all questions remain
`needs_review` and must not be described as verified/official.

## Release order & rollback

1. Apply the migration; run `supabase/ci/production-validation.sql`
   (check 9 names the new version/object).
2. Deploy the application build from the same commit.
3. Smoke-test `/cbt/setup/jamb|waec|neco|post-utme` (subjects listed with
   bank counts; JAMB locks English; a session starts, answers, submits).
4. Rollback: redeploy the previous build; the migration is backward
   compatible with the old build (function signatures unchanged). If needed,
   `update public.cbt_exams set is_active=true where id='33075e1c…'`.

## Deliberately deferred

- Phase 2C content programme (independent 200-per-subject pools, review
  workflow), including deciding whether served papers should require
  `approved` questions (today every question is `needs_review`, so gating
  would empty every bank).
- Post-UTME verified-institution banks (0 of 329 institutions verified; the
  setup honestly dead-ends until one is).
- Governed-mock UI: the programme combination combobox is still disabled
  behind `{false && …}` pending verified programme data; JAMB mocks take the
  practice selection (English-first). Practice “subject groups” remain an
  informational filter, not a selection preset.
- Phase 2D hardening (auth redirect/site URL, `student_*` dashboard
  contract, SECURITY DEFINER review, build telemetry, e2e CBT journeys).
