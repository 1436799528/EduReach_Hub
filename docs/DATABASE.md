# EduReach Data Contracts

Supabase is the authoritative application database.

Core domains:
- profiles: authenticated user profile and role.
- service_catalog: active service definitions, descriptions, pricing and portal links.
- service_requests: authenticated student service requests.
- cbt_exams: CBT definitions.
- exam_questions: protected question bank; answer keys are server-side.
- cbt_attempts: student attempts and timing.
- cbt_answers: submitted answers.
- news_articles: published news.
- admin_audit_logs: administrative audit trail.

Security rule: browser code must never be the final authority for authorization. Sensitive operations go through protected server APIs or authorized database functions.

Public-release hardening in `supabase/migrations/20260925_public_release_security_hardening.sql` keeps service-request reads owner-scoped, restores the profile completion column grant, retires the data-less Course Finder seed and revokes the legacy public reference-code tracker RPC. Apply this migration before production QA.
