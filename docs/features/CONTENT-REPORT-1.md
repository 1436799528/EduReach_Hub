# CONTENT-REPORT-1 — the student's half of the content-quality loop

Working guide: **5.3 Step I** (each question shows a small "Report a problem"
button; reports go to a triage queue; a question with several reports is
auto-flagged) and **5.7** (report from the review screen).

## Why

Until this feature, a wrong answer key could only be found by a reviewer reading
the bank. The students sitting the paper were the people most likely to notice,
and they had no way to say so. The guide treats that loop as part of the content
standard, not as a nice-to-have: *"One wrong answer key damages trust."*

## What a student sees

In the review screen, under each question's explanation, a quiet
**Report a problem** button. Pressing it opens a small inline form — the question
stays visible, because a modal would cover the thing being reported:

- **What is wrong?** — answer key, spelling/wording, diagram, something else.
- **Details (optional)** — one sentence, capped at 500 characters.

Sending shows `Thank you. A reviewer will check this question.` A second press
of the same category shows `You have already reported this question.` and is not
treated as an error.

## What the server does

| Endpoint | Who | Effect |
|---|---|---|
| `POST /api/cbt/questions/:questionId/report` | student (`cbt.attempt`) | Files one report. The question must appear in one of **this student's** frozen papers (checked before the insert), so an unknown id cannot be used to probe the bank. Rate limited per account (`cbt-report`, 20 / 10 min, durable). |
| `GET /api/admin/question-reports?status=open` | staff (`cbt.read`) | The triage queue, newest first, with the question text, options and key so a reviewer can compare without leaving the queue. |
| `PATCH /api/admin/question-reports/:reportId` | staff (`cbt.manage`) | Moves a report to `triaged`, `resolved` or `dismissed`, with an optional note. Writes an `admin_audit_log` entry (`question_report_<status>`). |

Repeats are idempotent: the database has one report per student, per question,
per category, and a `23505` from that index is answered as
`{ status: "already_reported" }` with HTTP 200 rather than as a failure.

## What the database enforces

`supabase/migrations/20261119130000_question_reports.sql`:

- `question_reports` with foreign keys to `exam_questions`, `cbt_attempts`
  (`on delete set null`) and `auth.users`, and CHECK constraints for the
  category, the status and the 500-character note.
- A partial unique index (`status <> 'dismissed'`) so one student is one
  complaint, but a dismissed complaint may be filed again if it turns out to be
  right.
- `exam_questions.open_report_count` and `report_flagged_at`, recomputed by
  trigger from the reports themselves. **Three open reports** set the flag;
  clearing them clears it. The columns are not writable from the browser role,
  so a report cannot be used to hide a question.
- RLS: a student reads and inserts only their own reports; nobody may update or
  delete through the browser role; triage runs through the capability-checked
  server API.

## Deliberate limit

The flag is **advisory**: it tells a reviewer that a question needs attention,
and it does not remove the question from new papers. Excluding flagged questions
from paper selection changes exam-engine behaviour and needs its own review — the
working guide says "can be temporarily hidden", not "is hidden".

## Acceptance criteria

- [x] A student can report a question from the review screen in four categories
- [x] The report is refused for a question that is not in the student's paper
- [x] A repeat report is accepted as already-reported, not as an error
- [x] Staff can list open reports and move one through triage, with an audit entry
- [x] Three open reports flag the question; resolving them clears the flag
- [x] A student cannot read another student's report, edit one, or triage
- [x] The control is reachable by keyboard and its inputs are 44 px / 16 px on a phone

## Tests

`tests/question-reports.test.ts` — the rules (categories, statuses, note
cleaning, malformed input), the SQL contract (constraints, unique index, trigger
threshold, RLS, revoked columns), the route contract (ownership check, 23505
handling, capabilities, audit action) and the client wiring.
