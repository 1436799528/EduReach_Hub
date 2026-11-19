# EduReach Data Contracts

Supabase is the authoritative application database.

Core domains:
- profiles: authenticated user profile and role.
- service_catalog: active service definitions, descriptions, pricing and portal links.
- service_requests: authenticated student service requests.
- cbt_exams: CBT definitions.
- exam_questions: protected question bank; answer keys are server-side.
- cbt_attempts: student attempts, timing and the zero-based current question used for signed-in resume.
- cbt_answers: active/submitted answers used for progress and result scoring.
  `is_correct` is derived at submit and can be re-derived by `cbt_regrade_question`
  (service-role only) after an answer key is corrected; `selected_option` is never
  rewritten by a regrade.
- question_reports: student reports about a question (wrong answer, typo, image, other),
  owner-scoped for read and insert, triaged through the admin API. `exam_questions`
  carries `open_report_count` and an advisory `report_flagged_at` (three open reports),
  both maintained by trigger and not writable from the browser role.
- news_articles: published news.
- admin_audit_logs: administrative audit trail.

Security rule: browser code must never be the final authority for authorization. Sensitive operations go through protected server APIs or authorized database functions.

Public-release hardening in `supabase/migrations/20260925_public_release_security_hardening.sql` keeps service-request reads owner-scoped, restores the profile completion column grant, retires the data-less Course Finder seed and revokes the legacy public reference-code tracker RPC. Apply it with `20260925213000_cbt_attempt_question_position.sql` and `20260925214000_service_request_statuses.sql` before production QA. The latter migrations preserve resume position and support the authenticated request lifecycle without creating a second history record.
