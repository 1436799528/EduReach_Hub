# 02 — Data Model

Supabase (Postgres) is the authoritative application database. This document
records what exists, who owns each record, and — the audit's central question —
**how we know a record is correct**.

## 0. Finding: the baseline schema is not reproducible from this repository

`profiles`, `service_catalog` and `service_requests` exist in production and are
read and written all over the codebase, but **no migration in
`supabase/migrations/` creates them**. They appear only as guarded references
(`to_regclass('public.profiles')`) and as `alter table`/policy statements that
assume them. Consequences:

- A fresh environment cannot be built from the repository.
- Nobody can diff "what the schema should be" against "what production is".
- Audit P0-1 (live verification) cannot be closed by reading code.

**Required remediation (do this before further schema work):** export the live
baseline with `supabase db pull` (or `pg_dump --schema-only`) and commit it as
`supabase/migrations/20260901000000_baseline_core_tables.sql`, then confirm the
full sequence applies to an empty database. Until then, treat every column list
below for those three tables as *observed in code*, not guaranteed.

## 1. Domains and tables

Legend: owner = the role accountable for correctness; source = where truth comes
from; verification = how correctness is established.

### Identity

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `profiles` | One row per user: identity + academic profile + role (`full_name`, `school`, `faculty`, `department`, `level`, `matric_number`, `role`) | Student (their own data) | Student self-entry; admin review for services; `role` is server/DB-controlled, never client-writable (see `20260903_restrict_profile_client_columns.sql`) |
| `student_security_events` | Account security trail | System | Written by server/database only |

Identity data is not duplicated elsewhere. Academic attributes live only on
`profiles`; services read them at application time rather than copying them.

### Content

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `news_articles` | Published updates; single source of truth for `/news`, the homepage and search | Content staff | Provenance columns (`source_name`, `source_url`, `source_published_at`, `source_tier`), `verification_status`, `last_verified_at`, `expires_at`, `content_hash`, `dedupe_key` |
| `news_sources` | Source registry: tier, feed, discovery mode, health, operator overrides | Content staff + ops | `last_checked_at`/`last_status` from `npm run newsroom:check`; tier and trust score are editorial policy |
| `news_ingest_runs` | One row per ingestion run with its daily report | System | The run report is the audit trail of what the pipeline did |
| `news_ingest_candidates` | Every discovery and its outcome (`needs_review`, `duplicate`, `rejected`, `published`, `failed`) with the reason | System + content staff | Reason fields (`rejection_reason`, `review_notes`, `quality_flags`, `matched_article_id`) |
| `edureach_deadlines` | Calendar items surfaced on `/events` and the dashboard | Content staff | Manual entry; dates must be sourced |
| `edureach_material_notes` | Student-owned study notes | Student | Owner-scoped RLS |

News lifecycle: source discovery → candidate → parse → normalise → dedupe →
relevance → quality gate → editorial review or Tier 1 auto-publish → monitor →
correct → expire/archive. Full policy in `docs/NEWSROOM_PIPELINE.md`.

### Opportunities

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `opportunities` | Scholarships, grants, jobs, fellowships, competitions | Content staff | `deadline`, `link_url` (HTTPS), `last_verified_at`, `source_name`, `is_active`, `closed_at`; `close_expired_opportunities()` retires past-deadline rows |

Lifecycle states: active → closing soon → closed/expired → archived. An
opportunity whose deadline has passed must not be listed as available; the sweep
and the public filter enforce this independently.

### Institutions

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `institutions` | Institution directory seeded from the NUC university system list (329 rows, 20 Sep 2026) | Content staff | `school_name`, `acronym`, `state`, `institution_type`, `website_url`. Programmes, cutoffs, fees and admission requirements are **deliberately absent** — EduReach does not fabricate them (`docs/DATA_SOURCES.md`) |

### Student services

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `service_catalog` | Service definitions: title, description, requirements, portal links, routing metadata (`route`, `category`, `sort_order`) | Service admin | Manual entry plus admin console; a service with no live workflow renders an honest coming-soon panel instead of a form |
| `service_requests` | One row per student request, with `reference_code`, `status`, `form_data`, `admin_note` | Student (ownership) + service admin (processing) | Status vocabulary is a database check constraint; every staff change is audit-logged |

Status vocabulary (enforced by `service_requests_status_check`):
`submitted`, `reviewing`, `processing`, `awaiting_information`, `completed`,
`closed`, `rejected`, `cancelled`.

### CBT

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `cbt_exams` | Exam definitions (`title`, `exam_body`, `subject`, `duration_minutes`, `is_active`) | Content/admin | Integrity report counts active exams with no questions or fewer than the minimum |
| `exam_questions` | The question bank: `question_text`, four options, `correct_option`, `explanation`, `marks`, `position`, `subject` | Content/admin | Constraints on `correct_option`; answer keys are **never** exposed to the browser (`20260919_admin_cbt_production_hardening.sql` revokes direct access); integrity report counts missing options, invalid answers, duplicate positions |
| `cbt_attempts` | Attempt header: owner, exam, score, `total_questions`, `selected_subjects`, resume position, timestamps | Student (owner) | Created by server RPC; one in-progress attempt per student per exam |
| `cbt_answers` | One row per answered question, upserted on `(attempt_id, question_id)` | Student (owner) | Unique constraint prevents duplicate answers for the same question |

Paper composition rules (in the RPCs, not the client): English papers cap at 60
questions, other subjects at 40; `position` is the paper position the student
sees; `use of english`/`english language`/`english` normalise to one subject.

Note: `exam_questions` retains `unique (exam_id, position)` from its original
creation while subject-aware papers number questions per subject inside the
RPCs. Any anomaly here is reported by `content_integrity_report()` and must be
confirmed against the live constraint during P0-1.

### Academic tools

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `student_cgpa_terms` | Saved CGPA terms (`term_label`, `gpa`, `total_units`, `classification`) | Student | Owner-scoped; computed client-side, stored for the student's own record |
| `student_cgpa_courses` | Courses within a term (code, units, grade, grade points) | Student | Bound to a term by FK; unique per term |

### Saved content and notifications

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `student_saved_items` | Bookmarks: `item_type` ∈ (school, course, service, scholarship, custom), `item_key`, title, href, metadata | Student | `unique (user_id, item_type, item_key)` prevents duplicates. **Gap:** `opportunities` is the current opportunities model and its rows are not an `item_type`; saving an opportunity today would use `custom`. Alignment is a small, tracked change (see `07-FEATURE-CATALOGUE.md` SA-3) |
| `student_notifications` | In-app notifications: `title`, `body`, `notification_type`, `href`, `read_at` | System (creation restricted to staff) | `20260903_restrict_notification_creation_to_staff.sql` stops clients creating their own; no expiry column yet (gap) |

### Analytics, audit and governance

| Table | Purpose | Owner | Verification |
|---|---|---|---|
| `site_analytics_events` | Product events (`event_name`, `path`, `session_id`, `user_id`, `referrer`, `user_agent`, `metadata`) | Ops | Server allowlist of six event names; no retention policy yet (gap, PRIV-2) |
| `admin_audit_logs` / `edureach_audit_logs` | Administrative audit trail via `admin_audit_log(...)` | Ops | Written by the server on privileged actions; this is the system of record for "who changed what" |
| `rate_limit_hits` | Durable rate-limit counters | System | Maintenance-free (self-cleaning); service-role only |
| `content_integrity_report()` | Read-only JSON over news, CBT, opportunities and institutions | Ops | This is how the running database vouches for itself |

### Present but not a product

`student_wallet_transactions` and `payment_events` exist with no product surface,
no fee model, no terms and no refund policy. They are ⚪ out of scope until
open decision D2 is settled (`README.md`).

## 2. Relationship map

```
profiles ──1:N── service_requests ──N:1── service_catalog
   │  │                 │
   │  │                 └── admin_audit_logs (entity_id, action)
   │  ├──1:N── cbt_attempts ──1:N── cbt_answers ──N:1── exam_questions ──N:1── cbt_exams
   │  ├──1:N── student_cgpa_terms ──1:N── student_cgpa_courses
   │  ├──1:N── student_saved_items
   │  ├──1:N── student_notifications
   │  └──1:N── student_security_events

news_sources ──1:N── news_ingest_candidates ──0:1── news_articles
news_ingest_runs ──1:N── news_ingest_candidates
news_articles.source_key ──▶ news_sources.source_key   (soft reference, by key)

institutions ──(no child tables yet: programmes/courses are deliberately unbuilt)
opportunities ──(standalone; saved-state now via student_saved_items)
```

`edureach_deadlines.institution_id` and `.user_id` are soft (nullable) references
used for scoping future calendar items, not live relationships.

## 3. Integrity rules

| Rule | Enforced by |
|---|---|
| A published article must have a source name, an HTTPS source URL and an editorial body | Quality gate in the pipeline + the admin CMS validation |
| The same story cannot be published twice | `news_articles.dedupe_key` unique index; five-signal dedupe in `src/server/newsroom/dedupe.ts` |
| A past-deadline opportunity cannot be active | `close_expired_opportunities()` + public filter on `is_active` and `closed_at` |
| An active CBT must have a usable bank | `content_integrity_report()` counters, surfaced in the admin console and CLI |
| A student cannot have two concurrent attempts for one exam | `start_cbt_attempt_for_subjects` |
| One answer per question per attempt | `unique (attempt_id, question_id)` (upsert on conflict) |
| A student's records are theirs | RLS: owner-scoped policies on every student table; service-role only for governance tables |
| Staff actions are traceable | `admin_audit_log(...)` on privileged mutations |

## 4. Data-quality monitoring (`content_integrity_report()`)

Run `npm run newsroom:integrity` or `GET /api/admin/integrity`. It reports:

- **News** — published totals, published without a source URL, non-HTTPS sources, expired-but-published, expiring within 7 days, duplicate dedupe keys, unknown categories.
- **CBT** — active exams, active exams with no questions, questions with missing options, invalid correct answers, missing explanations, duplicate `(exam_id, subject, position)` rows, active exams below the 10-question floor.
- **Opportunities** — active totals, active-but-expired, missing deadlines, missing or non-HTTPS links, never-verified.
- **Institutions** — totals, missing names, duplicate names, missing websites/states, non-HTTPS websites.

Non-zero counters are work items, not noise. Remediation is tracked in
`07-FEATURE-CATALOGUE.md`.

## 5. Retention and deletion

Currently **unspecified** for analytics and audit tables (PRIV-2), and there is
no student-facing data export or deletion path. Both are required for
Nigerian data-protection compliance and are scheduled in the feature catalogue;
until then, personal data collection stays deliberately minimal.
