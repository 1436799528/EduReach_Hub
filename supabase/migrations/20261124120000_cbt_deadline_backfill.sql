-- CBT countdown authority: restore the deadline for timed attempts stored
-- without one.
--
-- History: `start_cbt_attempt` (20260920_production_student_workflows.sql)
-- inserted `expires_at = started_at + (duration_minutes || ' minutes')::interval`.
-- When the exam's `cbt_exams.duration_minutes` was NULL the concatenation
-- produced NULL, so the attempt was created with `expires_at NULL` even though
-- the student's session was timed. The practice/mock migration
-- (20261002120000) later filled in `duration_minutes` for those rows but left
-- `expires_at` NULL, and the start RPC's resume rule explicitly allows
-- `expires_at is null` rows to resume.
--
-- The visible symptom: the exam hall derives remaining time from the server's
-- `expiresAt`, so a resumed timed attempt showed a frozen "00:00 remaining" —
-- a countdown that did not count — and never auto-submitted.
--
-- The deadline restored here is the one the session was created with:
-- `started_at + duration_minutes`. Deliberately NOT `now() + duration_minutes`:
-- reconnecting or signing in again must never extend an examination. Rows
-- whose restored deadline is already past close through the ordinary expiry
-- path on their next touch — the time was used or abandoned.
--
-- Idempotent: rows that already carry a deadline are untouched.

update public.cbt_attempts
set expires_at = started_at + make_interval(mins => duration_minutes)
where expires_at is null
  and duration_minutes is not null
  and started_at is not null;
