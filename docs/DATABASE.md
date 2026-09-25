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
- news_articles: published news.
- admin_audit_logs: administrative audit trail.

Security rule: browser code must never be the final authority for authorization. Sensitive operations go through protected server APIs or authorized database functions.

Public-release hardening in `supabase/migrations/20260925_public_release_security_hardening.sql` keeps service-request reads owner-scoped, restores the profile completion column grant, retires the data-less Course Finder seed and revokes the legacy public reference-code tracker RPC. Apply it with `20260925213000_cbt_attempt_question_position.sql` and `20260925214000_service_request_statuses.sql` before production QA. The latter migrations preserve resume position and support the authenticated request lifecycle without creating a second history record.
