# EduReach Hub — Database Requirements

> **Purpose.** The data structures the frontend needs, expressed as
> **requirements for a fresh PostgreSQL database** — not as a copy of the
> existing Supabase schema. Table/column names below are **proposed** for
> the new backend (snake_case, matching the frontend's field names where
> they already use snake_case). Relationships, constraints, and required
> fields are derived from frontend reads/writes, `src/lib/api.ts` types,
> and the behavioural rules encoded in the existing migrations/tests.
>
> **Rules for the new schema:**
> - Fresh migration history. Do not copy `supabase/migrations/` (84 files)
>   or `supabase/candidates/` (non-deployable). Re-derive each table from
>   this document.
> - The browser never touches PostgreSQL directly in the new design. RLS is
>   defence-in-depth only; application-level authorization (capability +
>   ownership + bank policy) is the boundary.
> - Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` unless
>   noted, plus `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and
>   `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (with an
>   `updated_at` trigger) unless noted.
> - All timestamps are `TIMESTAMPTZ` (UTC). All money is `NUMERIC`.
> - Answer indices are `SMALLINT 0..3`; question positions are `INTEGER >= 1`.
> - Foreign keys use `ON DELETE CASCADE` for owned data (attempts, answers,
>   saved items) and `ON DELETE SET NULL` / `RESTRICT` for reference data
>   (banks, institutions) — see per-table notes.

---

## 1. Identity: users, profiles, roles

### 1.1 `users` (identity — replaces `auth.users` + `profiles` identity columns)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID PK | The identity id. If keeping Supabase Auth, this **is** the Supabase `auth.users.id` (FK target for all owned tables). If owning auth, generate here. |
| `email` | TEXT NOT NULL UNIQUE | Lowercased, trimmed. |
| `email_verified_at` | TIMESTAMPTZ NULL | Set on verification. |
| `password_hash` | TEXT NULL | Only if owning auth (argon2id). NULL when using Supabase Auth. **Never returned by any API.** |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |
| `deleted_at` | TIMESTAMPTZ NULL | Soft-delete for account-deletion requests (see `tests/account-deletion-dependencies.test.ts`). Hard delete must cascade owned data. |

### 1.2 `profiles` (one row per user — the frontend's `profiles` table)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID PK, FK → `users(id) ON DELETE CASCADE` | One-to-one with `users`. |
| `full_name` | TEXT NOT NULL DEFAULT `''` | Display name. Frontend derives from `first_name + last_name` or email prefix when empty. |
| `first_name`, `last_name` | TEXT NULL | From signup metadata. |
| `phone` | TEXT NULL | Nigerian phone; frontend validates ≥10 digits on signup. |
| `account_type` | TEXT NOT NULL DEFAULT `'student'` | CHECK IN (`'student'`, `'parent'`, `'teacher'`). All dashboards are student-shaped regardless. |
| `school` | TEXT NOT NULL DEFAULT `''` | Free text (dropdown + "Other" custom). **No FK** to `institutions` (frontend allows arbitrary strings). |
| `course_programme` | TEXT NULL | Free text (dropdown + "Other"). |
| `faculty`, `department`, `level` | TEXT NOT NULL DEFAULT `''` | Free text. |
| `session` | TEXT NOT NULL DEFAULT `''` | Academic session (e.g. `2024/2025`). |
| `matric_number` | TEXT NULL | Shown on result slip. |
| `jamb_reg_no` | TEXT NULL | Shown on result slip. |
| `target_exam` | TEXT DEFAULT `'JAMB (UTME)'` | Preferred exam. |
| `admission_year`, `expected_graduation_year` | INTEGER NULL | |
| `academic_interests` | TEXT[] NOT NULL DEFAULT `'{}'` | |
| `notification_preferences` | JSONB NOT NULL DEFAULT `'{"email_alerts":true,"whatsapp_alerts":true,"sms_alerts":false}'` | CHECK `jsonb_typeof = 'object'`. |
| `avatar_url` | TEXT NULL | |
| `terms_agreed_at` | TIMESTAMPTZ NULL | Set when signup metadata `terms_agreed=true`. |
| `profile_completed` | BOOLEAN NOT NULL DEFAULT `false` | Set by profile-completion flow. |
| `mfa_enabled` | BOOLEAN NOT NULL DEFAULT `false` | Mirrors Supabase MFA enrolment (written by `SecurityModal` directly today; in the new backend, written server-side after MFA verification). |
| `role` | TEXT NOT NULL DEFAULT `'student'` | CHECK IN (`'student'`, `'content_editor'`, `'service_admin'`, `'super_admin'`). Legacy values `admin`/`moderator` map to `super_admin`; retired `senate_admin`/`campus_agent` map to `student` (see auth doc). **Never client-writable** — only via `POST /api/admin/users/:id/role` with `user.manage_roles`. |
| `suspended` | BOOLEAN NOT NULL DEFAULT `false` | Set by ban/unban. Suspended users must be refused at the auth layer (see auth doc §7 — **currently only partially enforced; the new backend must enforce it**). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Indexes:** PK on `id`; `UNIQUE (matric_number)` is **not** required
(frontend never assumes uniqueness). Index on `role` for admin user search.

**Assumptions to preserve:** profile upsert is idempotent
(`ON CONFLICT (id) DO UPDATE`); signup trigger creates the profile row
from `raw_user_meta_data` (`first_name`, `last_name`, `full_name`, `phone`,
`account_type`, `terms_agreed`, `school`/`institution`, `course_programme`,
`faculty`, `department`, `level`) + a wallet row. The new backend must
create the profile atomically with the user.

### 1.3 `student_security_events` (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `event_type` | TEXT NOT NULL | e.g. `password_changed`, `mfa_enabled`, `sign_out_others`. |
| `event_label` | TEXT NOT NULL | Human label. |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. |
| `created_at` | TIMESTAMPTZ | No `updated_at` (append-only). |

Index: `(user_id, created_at DESC)`. No UPDATE/DELETE grants to the app role
except retention jobs.

---

## 2. Institutions and academic catalogue

### 2.1 `institutions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `school_name` | TEXT NOT NULL | |
| `acronym` | TEXT NULL | |
| `slug` | TEXT NULL UNIQUE | Used by `/schools/:slug`. |
| `state` | TEXT NULL | |
| `institution_type` | TEXT NULL | |
| `website_url`, `admission_portal_url`, `student_portal_url` | TEXT NULL | HTTPS only (validated). |
| `is_verified` | BOOLEAN NOT NULL DEFAULT `false` | |
| `post_utme_available` | BOOLEAN NOT NULL DEFAULT `false` | |
| `post_utme_method` | TEXT NULL | CHECK IN (`'cbt'`, `'handwritten'`). |
| `post_utme_source_url` | TEXT NULL | Required when `post_utme_available=true` (frontend filters on non-null). |
| `post_utme_verified` | BOOLEAN NOT NULL DEFAULT `false` | Frontend lists only `available=true AND verified=true AND method/source non-null`. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(school_name)` for the 400-row finder list. Seed: ~329 NUC rows
(content, not schema — the new backend needs a seed/import step, not a
migration with data).

### 2.2 `cbt_subject_catalog` (governed subject list per exam body)

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT GENERATED ALWAYS AS IDENTITY PK | |
| `exam_body` | TEXT NOT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). |
| `subject_name` | TEXT NOT NULL | Display name (e.g. `Use of English`). |
| `subject_group` | TEXT NOT NULL | CHECK IN (`'Science'`, `'Arts'`, `'Commercial'`, `'Technical & Vocational'`). |
| `active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `created_at` | TIMESTAMPTZ | |
| UNIQUE | `(exam_body, subject_name, subject_group)` | |

**Note:** this catalogue is *advisory* for the setup wizard. The
authoritative servable-subject list for a bank is derived from actual
`exam_questions` rows (see `cbt_subject_availability` equivalent in the
new backend). Both must exist; the wizard shows the intersection.

### 2.3 Programme catalogue (optional — frontend uses free text)

`ccmas_programmes`, `ccmas_disciplines`, `national_programme_catalogue`
exist in the old DB but the frontend never queries them (profile fields
are free text). **Do not create these tables** unless the product wants a
governed programme list. Recorded here so the omission is deliberate.

---

## 3. Question banks (CBT content)

### 3.1 `cbt_exams` (banks)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `exam_body` | TEXT NOT NULL | e.g. `JAMB`, `WAEC`, `NECO`, `POST-UTME`. Frontend matches case-insensitively + substring (`includes('jamb')`). Keep values canonical uppercase. |
| `subject` | TEXT NOT NULL | Legacy single-subject label; multi-subject banks use `'Multiple subjects'`. Kept for display compatibility. |
| `description` | TEXT NULL | |
| `duration_minutes` | INTEGER NOT NULL DEFAULT `30` | CHECK 5..180 in the old schema; the configured-session flow allows 5..240 (`cbt_limits`). **New schema: CHECK 5..240.** |
| `is_active` | BOOLEAN NOT NULL DEFAULT `true` | Inactive banks are invisible everywhere. |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | Required for POST-UTME banks (frontend nulls it for other bodies on create). |
| `format_status` | TEXT NOT NULL DEFAULT `'unverified'` | CHECK IN (`'verified'`, `'partially_verified'`, `'unverified'`). |
| `official_guidance_url` | TEXT NULL | HTTPS only. |
| `format_notes` | TEXT NULL | |
| `guidance_year` | INTEGER NULL | |
| `mock_question_count` | INTEGER NULL | Fixed mock paper size (e.g. 180 for JAMB). NULL = mock size derived from bank. |
| `mock_subject_quota` | JSONB NULL | e.g. `{"english":60,"other":40}`. CHECK object. |
| `created_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(is_active, exam_body, subject)`.

### 3.2 `exam_questions` (the question bank — most sensitive table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | **Bank moves are forbidden** (trigger: `exam_id` change → refuse). |
| `question_text` | TEXT NOT NULL | |
| `option_a`, `option_b`, `option_c`, `option_d` | TEXT NOT NULL | Four options. A fifth option (`option_e`) exists only in import staging, never here. |
| `correct_option` | CHAR(1) NOT NULL | CHECK IN (`'A'`,`'B'`,`'C'`,`'D'`). **Never returned to students before correction release.** |
| `explanation` | TEXT NULL | Same release rule as `correct_option`. |
| `subject` | TEXT NOT NULL | Display subject (e.g. `Use of English`). Comparisons use the canonical key (see §3.4). |
| `position` | INTEGER NOT NULL | CHECK `> 0`. Paper position within the bank. |
| `marks` | INTEGER NOT NULL DEFAULT `1` | CHECK `> 0`. (Scoring is currently 1 mark/question; keep the column for future weighting.) |
| `topic` | TEXT NULL | |
| `passage` | TEXT NULL | Reading passage, if any. |
| `review_status` | TEXT NOT NULL DEFAULT `'needs_review'` | CHECK IN (`'approved'`, `'needs_review'`, `'rejected'`). Rejected questions are excluded from serving/counts. |
| `source_type` | TEXT NULL | e.g. `'official_past_question'` only when an admin confirmed the source. |
| `import_id` | UUID NULL, FK → `question_imports(id) ON DELETE SET NULL` | Provenance. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Constraints:**
- `UNIQUE (exam_id, position)` — duplicate positions refused (409).
- Index `(exam_id, position)`, `(exam_id, subject)`, `(exam_id, review_status)`.
- **Provenance guard:** a question whose normalised text already exists in
  a `restricted` bank cannot be added to a `public` or unclassified bank
  (403 `question_provenance_refused`). The new backend must implement this
  as an application-level check inside the write transaction (the old
  backend used a trigger with SQLSTATE 42501 + `DETAIL` marker; do not
  copy the trigger — reproduce the *refusal semantics*).
- **Access:** no direct client grants. All reads go through services that
  enforce bank classification + candidate assignment + correction release.

### 3.3 `cbt_bank_security` (bank classification — fail closed)

| Column | Type | Notes |
|---|---|---|
| `exam_id` | UUID PK, FK → `cbt_exams(id) ON DELETE RESTRICT` | One row per classified bank. **No row = unclassified = inaccessible** (fail closed). |
| `visibility` | TEXT NOT NULL | CHECK IN (`'public'`, `'restricted'`). |
| `correction_release_at` | TIMESTAMPTZ NULL | Required when `restricted`; must be NULL when `public`. CHECK enforces the pair. |
| `classified_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `classified_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `updated_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `updated_at` | TIMESTAMPTZ | Standard. |

**Rules:** classification is staff-chosen and **immutable** once set
(changing it requires a separate reviewed lifecycle — the old candidate
refused re-classification). `correction_release_at` is future-only on set
and can never move earlier. The new backend must enforce both.

### 3.4 `cbt_bank_candidate_assignments` (restricted-bank access)

| Column | Type | Notes |
|---|---|---|
| `exam_id` | UUID NOT NULL, FK → `cbt_bank_security(exam_id) ON DELETE RESTRICT` | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `assigned_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `assigned_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `revoked_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `revoked_at` | TIMESTAMPTZ NULL | CHECK (`revoked_by IS NULL OR revoked_at IS NOT NULL`). |
| PK | `(exam_id, user_id)` | Individual assignments only — **never bulk**. |

**Access predicate (must be reproduced exactly):**
`candidate_access(exam) = visibility='public' OR (visibility='restricted'
AND active assignment exists)`. No row → `false`. Revocation takes effect
immediately for all subsequent operations (the old backend used a locking
form so a revocation committing mid-transaction cannot be overtaken; the
new backend must re-check inside the write transaction).

**Subject canonicalisation (must be reproduced):** `Use of English` /
`English Language` / `English` → `english`; `Literature-in-English` /
`Literature in English` → one key. Frontend `normalizeSubject()` and SQL
canonicalisation must agree. Store display names; compare by canonical key.

---

## 4. CBT attempts, answers, and results

### 4.1 `cbt_attempts` (attempt header — frozen paper + draft + result)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. All reads/writes owner-scoped. |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | |
| `status` | TEXT NOT NULL DEFAULT `'in_progress'` | CHECK IN (`'in_progress'`, `'submitted'`, `'expired'`, `'cancelled'`). |
| `mode` | TEXT NOT NULL DEFAULT `'mock'` | CHECK IN (`'practice'`, `'mock'`). Existing rows default to `mock` (legacy full papers). |
| `protocol` | TEXT NOT NULL DEFAULT `'legacy'` | CHECK IN (`'legacy'`, `'v2'`). v2 attempts are rehearsal-only (see CBT doc). |
| `programme` | TEXT NULL | Free text (max 160 chars, frontend-truncated). |
| `selected_subjects` | TEXT[] NOT NULL DEFAULT `'{}'` | Student-chosen order (drives paper block order). |
| `subject_plan` | JSONB NOT NULL DEFAULT `'[]'` | CHECK array. `[{subject, questions, first, last}]` (1-based positions). Derived from the frozen paper. |
| `question_ids` | UUID[] NOT NULL DEFAULT `'{}'` | **The frozen paper** (ordered). All reads/resume/scoring use this, never a re-query. |
| `requested_questions` | INTEGER NULL | Student-requested total (practice). |
| `duration_minutes` | INTEGER NULL | CHECK 1..360. Authoritative duration (not the bank default). |
| `started_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `expires_at` | TIMESTAMPTZ NULL | `started_at + duration`. Server clock only. |
| `submitted_at` | TIMESTAMPTZ NULL | |
| `score` | NUMERIC(8,2) NULL | Percentage (0–100, 2dp). Set at submission. |
| `correct_answers` | INTEGER NOT NULL DEFAULT `0` | CHECK `>= 0`. |
| `total_questions` | INTEGER NOT NULL DEFAULT `0` | CHECK `>= 0`. Equals `cardinality(question_ids)` at submission. |
| `current_question` | INTEGER NOT NULL DEFAULT `0` | Zero-based resume position (frontend `questionIndex`). |
| `answers_draft` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. `{ "<1-based position>": <0-based option index> }`. The v1 draft store. |
| `candidate_answer_revision` | BIGINT NOT NULL DEFAULT `0` | v2 revision counter (monotonic). |
| `v2_result` | JSONB NULL | v2 submission result (rehearsal). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Constraints & rules:**
- One in-progress attempt per student per exam (enforced by the start
  RPC's resume logic: starting again returns the existing attempt with
  `resumed: true` instead of creating a second).
- `expires_at` is computed server-side; the client timer is display-only.
  A submit grace window exists (`cbt_submit_grace`, 120 s in the latest
  migration) — the new backend must define and document its grace.
- Expiry marking is owner-scoped and lock-after-check
  (`cbt_expire_owned_attempt` equivalent): it can mark `expired` but can
  never alter answers or reopen a result.
- Indexes: `(user_id, created_at DESC)`, `(user_id, mode, started_at DESC)`,
  `(exam_id)`.

### 4.2 `cbt_answers` (per-question answer rows)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | |
| `question_id` | UUID NOT NULL, FK → `exam_questions(id) ON DELETE CASCADE` | |
| `selected_option` | CHAR(1) NULL | CHECK IN (`'A'`,`'B'`,`'C'`,`'D'`). NULL = unanswered/cleared. |
| `is_correct` | BOOLEAN NULL | Set at submission (server-computed). |
| `answered_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| UNIQUE | `(attempt_id, question_id)` | Upsert target. |

**Note:** the v1 flow primarily uses `cbt_attempts.answers_draft` (JSONB)
for in-progress answers and materialises `cbt_answers` at submission for
scoring/results. The new backend may use either (or both), but must keep
the *observable* behaviour: draft saves are idempotent, submission scores
against the frozen paper, and `get_cbt_result` returns per-question rows.
Recommended: keep both (draft JSONB for cheap idempotent saves, answer
rows for auditable results).

### 4.3 `cbt_v2_operations` (v2 idempotency log — rehearsal)

| Column | Type | Notes |
|---|---|---|
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | Part of PK. |
| `operation_key` | UUID NOT NULL | Part of PK. Client-generated UUID v4, reused on retry. |
| `request` | JSONB NOT NULL | The operation payload (`kind`, `question`, `selected`, `expected`). Replaying a key with *different* input → refuse. |
| `outcome` | TEXT NOT NULL | CHECK IN (`'accepted'`, `'conflict'`). |
| `accepted_revision` | BIGINT NOT NULL | CHECK `>= 0`. |
| PK | `(attempt_id, operation_key)` | |
| Partial unique index | `(attempt_id, accepted_revision) WHERE request->>'kind'='answer' AND outcome='accepted'` | One accepted answer per revision. |

### 4.4 `cbt_v2_writing_sessions` (single-writer leases — rehearsal)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `sessionId` in the API. |
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | |
| `owner_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `generation` | BIGINT NOT NULL | CHECK 1..9007199254740991. Monotonic per attempt. |
| `request_key` | UUID NOT NULL | Idempotent session-creation key. |
| `status` | TEXT NOT NULL | CHECK IN (`'active'`, `'revoked'`, `'expired'`). |
| `created_at`, `last_activity_at` | TIMESTAMPTZ NOT NULL DEFAULT `clock_timestamp()` | |
| `expires_at` | TIMESTAMPTZ NULL | Attempt expiry + grace. |
| UNIQUE | `(attempt_id, generation)`, `(attempt_id, request_key)` | |
| Partial unique index | `(attempt_id) WHERE status='active'` | **One active writer per attempt.** |

**Rules:** takeover revokes the previous session and increments
`generation`; stale-session writes are rejected (`session_revoked`);
replaying an old `request_key` never reactivates a revoked session.

---

## 5. Question imports (staging → publication)

### 5.1 `question_imports`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | Destination bank. |
| `exam_body` | TEXT NOT NULL | Denormalised for listing. |
| `subject` | TEXT NOT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `source_name`, `source_url` | TEXT NULL | `source_url` HTTPS only. |
| `source_verified` | BOOLEAN NOT NULL DEFAULT `false` | Admin-confirmed official source. |
| `original_filename` | TEXT NOT NULL | |
| `mime_type` | TEXT NOT NULL | |
| `file_bytes` | BIGINT NOT NULL | CHECK `> 0`. |
| `checksum` | TEXT NOT NULL | Content hash. `UNIQUE (checksum, exam_id, lower(subject))` among non-archived rows → re-uploads are idempotent (`duplicate: true`). |
| `storage_path` | TEXT NOT NULL | Private bucket path (`past-questions` bucket). |
| `status` | TEXT NOT NULL DEFAULT `'queued'` | CHECK IN (`'queued'`, `'processing'`, `'extracted'`, `'failed'`, `'completed'`, `'archived'`). |
| `attempts` | INTEGER NOT NULL DEFAULT `0` | Max 5 (claim RPC refuses beyond). |
| `extraction_error` | TEXT NULL | |
| `extraction_warnings` | TEXT[] NOT NULL DEFAULT `'{}'` | |
| `item_count`, `approved_count`, `imported_count`, `duplicate_count` | INTEGER NOT NULL DEFAULT `0` | |
| `uploaded_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at`, `completed_at` | TIMESTAMPTZ | |

### 5.2 `question_import_items` (extracted, awaiting review)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `import_id` | UUID NOT NULL, FK → `question_imports(id) ON DELETE CASCADE` | |
| `source_index` | INTEGER NOT NULL | `UNIQUE (import_id, source_index)`. |
| `question_text` | TEXT NOT NULL | |
| `option_a`..`option_d` | TEXT NOT NULL | |
| `option_e` | TEXT NULL | Flagged for correction (engine serves 4). |
| `correct_option` | CHAR(1) NULL | CHECK IN (`'A'..'E'`). NULL = missing key (cannot be approved). |
| `explanation`, `passage`, `topic`, `raw_text` | TEXT NULL | |
| `review_status` | TEXT NOT NULL DEFAULT `'pending'` | CHECK IN (`'pending'`, `'approved'`, `'rejected'`, `'imported'`). |
| `issues` | TEXT[] NOT NULL DEFAULT `'{}'` | Validation issues (missing key, 5th option, etc.). |
| `duplicate_of` | UUID NULL | Pointer to the existing question when duplicate. |
| `question_id` | UUID NULL, FK → `exam_questions(id) ON DELETE SET NULL` | Set at commit. |
| `updated_at` | TIMESTAMPTZ | Optimistic-concurrency token (`expectedUpdatedAt`). |

**Publication rule (atomic):** `commit` publishes only approved, complete,
non-duplicate rows; destination bank must be classified; provenance guard
re-checked; any failure rolls back the whole batch. Extraction alone never
touches `exam_questions`.

---

## 6. Services and service requests

### 6.1 `service_catalog`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `service_key` | TEXT NOT NULL UNIQUE | Slug (e.g. `nelfund-loan`). |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `category` | TEXT NULL | |
| `route` | TEXT NULL | In-app route, if any. |
| `sort_order` | INTEGER NULL | |
| `active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `application_url` | TEXT NULL | External portal link (HTTPS). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Seed the four live services (`nelfund-loan`, `results`, `jamb-slip`,
`admission-letters`) + the 16 catalogue definitions from
`src/data/services.ts` (content seeding, not schema).

### 6.2 `service_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `profiles(id) ON DELETE CASCADE` | Owner. |
| `service_id` | UUID NULL, FK → `service_catalog(id)` | |
| `status` | TEXT NOT NULL DEFAULT `'submitted'` | CHECK IN (`'submitted'`, `'reviewing'`, `'processing'`, `'awaiting_information'`, `'completed'`, `'closed'`, `'rejected'`, `'cancelled'`). |
| `form_data` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. Student fields only (student field boundary enforced — staff fields like `admin_note` are not writable by students). |
| `admin_note` | TEXT NULL | Staff-only. |
| `reference_code` | TEXT UNIQUE | Generated at creation (e.g. `ER-...`). |
| `submission_key` | UUID NULL UNIQUE | Idempotency key (client UUID v4). Replays return the existing row. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. `updated_at` is the optimistic-concurrency token for staff updates. |

**Rules:** creation is idempotent on `submission_key` (with
`expected_user_id` + `recovery_only` semantics from the RPC); staff status
changes are audit-logged; students can only read their own rows.

### 6.3 `service_guides`

| Column | Type | Notes |
|---|---|---|
| `service_key` | TEXT PK, FK → `service_catalog(service_key) ON DELETE CASCADE` | |
| `eyebrow`, `summary`, `safety_note` | TEXT NOT NULL DEFAULT `''` | |
| `steps` | JSONB NOT NULL DEFAULT `'[]'` | CHECK array, max 24 steps. `[{title, body, image?, imageAlt?, imageKind?, imageSource?, section?}]`. |
| `status` | TEXT NOT NULL DEFAULT `'draft'` | CHECK IN (`'draft'`, `'published'`). Only published rows are served publicly. |
| `updated_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

---

## 7. News, opportunities, calendar

### 7.1 `news_articles`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT NOT NULL UNIQUE | |
| `title` | TEXT NOT NULL | |
| `excerpt` | TEXT NULL | Mapped to `summary` in the API. |
| `body` | TEXT NOT NULL | HTML (sanitised client-side on render). |
| `category` | TEXT NOT NULL DEFAULT `'general'` | Display label. |
| `category_slug` | TEXT NULL | Canonical slug (derived by DB in the old backend; compute server-side in the new backend from `src/data/newsCategories.ts`). |
| `image_url` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | Provenance. `source_url` HTTPS. |
| `author_id` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `published` | BOOLEAN NOT NULL DEFAULT `false` | |
| `published_at` | TIMESTAMPTZ NULL | |
| `featured` | BOOLEAN NOT NULL DEFAULT `false` | |
| `tags` | TEXT NULL | Comma-separated (frontend `parseNewsTags` splits, max 12). |
| `is_placeholder` | BOOLEAN NOT NULL DEFAULT `false` | Placeholder safety: placeholders need `placeholder_note` + explicit replacement confirmation. |
| `placeholder_note` | TEXT NULL | |
| `verification_status` | TEXT NOT NULL DEFAULT `'verified'` | e.g. `verified`, `expired` (derived when `expires_at` passed). |
| `expires_at` | TIMESTAMPTZ NULL | Freshness window. Expired articles leave the feed, stay reachable by slug. |
| `last_verified_at` | TIMESTAMPTZ NULL | |
| `content_hash`, `dedupe_key` | TEXT NULL | Newsroom dedupe. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(published, published_at DESC)`.

### 7.2 Newsroom tables (only if re-implementing ingestion)

`news_sources` (registry: `source_key` PK, tier, feed URL, health,
overrides), `news_ingest_runs` (one row per run with counters),
`news_ingest_candidates` (every discovery + outcome + reason). See
`docs/NEWSROOM_PIPELINE.md` and `src/server/newsroom/`. **If ingestion is
not re-implemented, do not create these tables** — news CRUD alone needs
only `news_articles`.

### 7.3 `opportunities`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `organisation` | TEXT NULL | |
| `category` | TEXT NOT NULL | e.g. `scholarship`, `grant`, `job`, `fellowship`, `competition`. |
| `subcategory` | TEXT NULL | |
| `description` | TEXT NULL | |
| `link_url` | TEXT NULL | HTTPS only. |
| `deadline` | TIMESTAMPTZ NULL | Past-deadline rows must not be listed as available (public filter + `close_expired_opportunities` sweep equivalent). |
| `locations` | TEXT NULL | |
| `eligibility` | TEXT NULL | |
| `education_levels` | TEXT[] NULL | |
| `disciplines` | TEXT[] NULL | |
| `work_mode` | TEXT NULL | |
| `is_active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `is_featured` | BOOLEAN NOT NULL DEFAULT `false` | |
| `source_name` | TEXT NULL | |
| `last_verified_at` | TIMESTAMPTZ NULL | |
| `closed_at` | TIMESTAMPTZ NULL | Set by the expiry sweep. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

### 7.4 Calendar items (`edureach_deadlines` / `edureach_exams` → unify as `calendar_items`)

The old backend has two tables (`edureach_deadlines`, `edureach_exams`)
selected by `?type=deadline|exam`. The new backend should use **one**
table with a `kind` column (the API already abstracts this):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `kind` | TEXT NOT NULL | CHECK IN (`'deadline'`, `'exam'`). |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `due_at`, `starts_at`, `ends_at` | TIMESTAMPTZ NULL | |
| `location` | TEXT NULL | |
| `priority` | TEXT NOT NULL DEFAULT `'normal'` | |
| `status` | TEXT NOT NULL DEFAULT `'active'` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

---

## 8. Student portal data

### 8.1 `student_saved_items`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. |
| `item_type` | TEXT NOT NULL | CHECK IN (`'school'`, `'course'`, `'service'`, `'scholarship'`, `'custom'`). |
| `item_key` | TEXT NOT NULL | Stable key (e.g. institution id/slug). |
| `title` | TEXT NOT NULL | |
| `subtitle`, `detail` | TEXT NULL | |
| `location` | TEXT NULL | |
| `href` | TEXT NULL | |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |
| UNIQUE | `(user_id, item_type, item_key)` | Upsert target. |

Index: `(user_id, created_at DESC)`.

### 8.2 `student_notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. |
| `title` | TEXT NOT NULL | |
| `body` | TEXT NULL | |
| `notification_type` | TEXT NOT NULL DEFAULT `'system'` | |
| `href` | TEXT NULL | |
| `read_at` | TIMESTAMPTZ NULL | NULL = unread. |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. `metadata.to` carries the service status announced (NTF-1). |
| `created_at` | TIMESTAMPTZ | No `updated_at`. |

Index: `(user_id, read_at, created_at DESC)`. **Rule:** students may create
personal alerts, but staff/system creation is the norm; the old backend
restricted creation to staff after hardening. The new backend should only
allow server-side creation (remove the client insert path).

### 8.3 `student_cgpa_terms` + `student_cgpa_courses`

| Table | Columns |
|---|---|
| `student_cgpa_terms` | `id` UUID PK; `user_id` FK CASCADE; `term_label` TEXT NOT NULL DEFAULT `'Current Semester'`; `gpa` NUMERIC NOT NULL; `total_units` INTEGER NOT NULL; `classification` TEXT NOT NULL; `created_at`, `updated_at`. Index `(user_id, created_at DESC)`. |
| `student_cgpa_courses` | `id` UUID PK; `term_id` FK → terms CASCADE; `user_id` FK CASCADE (denormalised for owner checks); `course_code` TEXT NOT NULL; `units` INTEGER NOT NULL CHECK `> 0`; `grade` TEXT NOT NULL; `grade_points` NUMERIC NOT NULL; `created_at`. Index `(term_id, created_at ASC)`. |

GPA computation is client-side (`src/lib/calc-engine.ts`); the server
stores the snapshot. The new backend may store the snapshot as-is.

### 8.4 Wallets (dormant — do not create unless payments are in scope)

`student_wallets` (`user_id` UNIQUE, `balance` NUMERIC, `currency='NGN'`),
`student_wallet_transactions` (`reference` UNIQUE where non-null,
`transaction_type`, `status`, `amount`), `payment_events`. No frontend
caller exists. **Recommendation: omit from the fresh schema.** If payments
are later required, design idempotent crediting (`reference` unique +
`credit_wallet_payment` equivalent) from scratch.

### 8.5 Legacy / dormant tables (do not create)

`campus_posts`, `campus_post_comments`, `campus_post_likes` (Campus Feed —
no frontend reader), `courses`, `past_questions`, `resources` (legacy
course-scoped uploads, superseded by `past_question_resources` +
`document_bank`), `edureach_notifications` (superseded by
`student_notifications`), `edureach_material_notes` (student notes — no
frontend caller found; omit unless the product revives it).

---

## 9. Documents and files

### 9.1 `document_bank` (PDF bank)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `original_filename` | TEXT NOT NULL | |
| `mime_type` | TEXT NOT NULL DEFAULT `'application/pdf'` | CHECK `= 'application/pdf'`. |
| `file_bytes` | BIGINT NOT NULL | CHECK `> 0 AND <= 10485760` (10 MB). |
| `storage_path` | TEXT NOT NULL UNIQUE | Private `resource-files` bucket. |
| `destination` | TEXT NOT NULL DEFAULT `'inbox'` | CHECK IN (`'inbox'`, `'past_questions'`, `'admission_guides'`, `'scholarships'`, `'news_attachments'`, `'school_resources'`, `'other'`). |
| `exam_body` | TEXT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). Required when `destination='past_questions'`. |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | Required when `destination='past_questions' AND exam_body='POST-UTME'`. |
| `subject`, `course` | TEXT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `description` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | `source_url` HTTPS. |
| `source_verified` | BOOLEAN NOT NULL DEFAULT `false` | Public delivery requires `true`. |
| `news_article_id` | UUID NULL, FK → `news_articles(id) ON DELETE SET NULL` | |
| `opportunity_id` | UUID NULL, FK → `opportunities(id) ON DELETE SET NULL` | |
| `status` | TEXT NOT NULL DEFAULT `'inbox'` | CHECK IN (`'inbox'`, `'routed'`, `'rejected'`). Public delivery requires `'routed'`. |
| `routed_resource_id` | UUID NULL, FK → `past_question_resources(id) ON DELETE SET NULL` | |
| `uploaded_by`, `routed_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `routed_at` | TIMESTAMPTZ NULL | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

### 9.2 `past_question_resources` (public past-question library)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_body` | TEXT NOT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | |
| `subject`, `course` | TEXT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | |
| `storage_path` | TEXT NULL | Private copy; NULL = external-only. CHECK: at least one of `storage_path`/`source_url` non-null. |
| `access` | TEXT NOT NULL DEFAULT `'view'` | CHECK IN (`'view'`, `'download'`). |
| `published` | BOOLEAN NOT NULL DEFAULT `false` | Only published rows are listed. |
| `verified_at` | TIMESTAMPTZ NULL | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**File metadata rule:** every stored file has a row (`storage_path`,
`file_bytes`, `mime_type`, checksum where relevant). No orphan objects:
deleting a row deletes its object (or vice versa, transactionally).

---

## 10. Site content, analytics, audit, operations

### 10.1 `site_settings` + `site_pages` + `site_page_revisions`

| Table | Key columns |
|---|---|
| `site_settings` | `key` TEXT PK, CHECK IN (`'brand'`, `'footer'`, `'contact'`, `'social'`); `value` JSONB NOT NULL DEFAULT `'{}'` (CHECK object); `updated_by` FK SET NULL; `updated_at`. Public read. |
| `site_pages` | `slug` TEXT PK, CHECK `^[a-z0-9-]{2,64}$`; `title` TEXT NOT NULL; `summary` TEXT NOT NULL DEFAULT `''`; `body` TEXT NOT NULL DEFAULT `''`; `status` CHECK IN (`'draft'`, `'published'`); `review_state` CHECK IN (`'pending'`, `'approved'`); `revision` INTEGER NOT NULL DEFAULT `1` CHECK `>= 1`; `updated_by` FK SET NULL; `updated_at`; `published_at`. Index `(slug) WHERE status='published'`. |
| `site_page_revisions` | `id` BIGSERIAL PK; `slug` FK → `site_pages(slug)` CASCADE; `revision` INTEGER NOT NULL; `title`, `summary`, `body`, `status`, `review_state` (snapshots); `edited_by` FK SET NULL; `edited_at`. UNIQUE `(slug, revision)`. Append-only (no UPDATE/DELETE). |

### 10.2 `site_analytics_events`

`id` BIGINT GENERATED ALWAYS AS IDENTITY PK; `event_name` TEXT NOT NULL
(taxonomy-validated server-side); `path` TEXT NULL (sanitised, no query);
`session_id` TEXT NOT NULL; `user_id` UUID NULL; `referrer` TEXT NULL
(origin+path only); `user_agent` TEXT NULL; `metadata` JSONB NOT NULL
DEFAULT `'{}'` (capped 2 KB, undeclared fields dropped); `created_at`.
Retention: 90 days (delete job). No client grants.

### 10.3 `admin_audit_logs` (append-only)

`id` UUID PK; `admin_user_id` UUID NOT NULL FK → `users(id)`; `action`
TEXT NOT NULL; `resource_type` TEXT NOT NULL; `resource_id` TEXT NULL;
`metadata` JSONB NOT NULL DEFAULT `'{}'`; `result` TEXT NOT NULL DEFAULT
`'success'` CHECK IN (`'success'`, `'failure'`); `created_at`. Written in
the **same transaction** as the mutation it describes (via an
`admin_audit_log` equivalent). Reads require `audit.read`. Never updated
or deleted by the app. **No question text, answer keys, or candidate PII
beyond an id in `metadata`.**

### 10.4 Operations tables

| Table | Purpose |
|---|---|
| `rate_limit_hits` / durable counter | Cross-instance rate limiting (`check_rate_limit` equivalent). The new backend may use Redis/Upstash instead — but must preserve the per-route limits + headers. |
| `scheduled_job_runs` | Job observability (`GET /api/admin/jobs`). `id`, `job_name`, `started_at`, `finished_at`, `status`, `triggered_by`, counters, `error`. |
| `cbt_bank_history` (or audit-backed) | Bank classification/assignment history (`GET .../banks/:id/history`). May be implemented as filtered `admin_audit_logs` rows instead of a separate table. |

---

## 11. Relationship summary

```
users 1—1 profiles
users 1—* service_requests, cbt_attempts, student_saved_items,
          student_notifications, student_cgpa_terms, student_security_events,
          cbt_bank_candidate_assignments, admin_audit_logs (as actor)
institutions 1—* cbt_exams (POST-UTME), past_question_resources, document_bank
cbt_exams 1—* exam_questions, cbt_attempts, question_imports
cbt_exams 1—0/1 cbt_bank_security 1—* cbt_bank_candidate_assignments
cbt_attempts 1—* cbt_answers, cbt_v2_operations, cbt_v2_writing_sessions
question_imports 1—* question_import_items 1—0/1 exam_questions (question_id)
service_catalog 1—* service_requests, 1—0/1 service_guides
news_articles 1—* document_bank (news_article_id)
opportunities 1—* document_bank (opportunity_id)
site_pages 1—* site_page_revisions
student_cgpa_terms 1—* student_cgpa_courses
past_question_resources 1—* document_bank (routed_resource_id)
```

---

## 12. Existing assumptions the new schema must not break

1. **Frozen paper:** `cbt_attempts.question_ids` is the paper. Editing or
   deleting a question mid-attempt must not change the paper being scored.
   (If a question is deleted, the attempt must fail closed with
   "requires review", never silently re-plan.)
2. **Subject canonicalisation** (§3.4) — planning, availability, and
   compulsory-subject checks all use canonical keys.
3. **Paper planning algorithm:** subjects in student-chosen order, one
   contiguous block each; every chosen subject gets ≥1 question while the
   target allows; remainder distributed by smallest used-share
   (largest-remainder, capacity-aware); mock quota (`mock_subject_quota`)
   applied first. The frontend `previewPlan()` mirrors this for display;
   the server plan is authoritative and the two are compared before
   submission.
4. **Limits:** `cbt_limits` = `{minQuestions:5, maxQuestions:100,
   minMinutes:5, maxMinutes:240, maxSubjects:9}` (frontend
   `DEFAULT_CBT_LIMITS`; note the old SQL `cbt_limits()` said
   `maxSubjects:6` — **the new backend must pick one value and use it
   everywhere**; recommend 9 to match the frontend + WAEC/NECO rule).
5. **JAMB paper standard:** 180 questions / 120 minutes, English 60 + 40×3.
   Practice keeps the same pace over a shorter paper
   (`durationForQuestionCount`).
6. **Idempotency keys:** service requests (`submission_key`), v2
   operations (`operation_key`), v2 sessions (`request_key`) — replays
   return the recorded response, never a second write.
7. **Optimistic concurrency:** service-request staff updates
   (`expected_updated_at`), import item edits/reviews
   (`expectedUpdatedAt`), site-page revisions — mismatch → 409.
8. **Fail-closed classification:** no `cbt_bank_security` row → no access,
   no counts, no questions, 404 (student) / 503 (policy unavailable).
9. **Correction release:** `correct_option`/`explanation` are released only
   (a) after submission, per attempted question (guest), or (b) after
   `correction_release_at` for restricted banks. Never in paper/draft/
   catalogue responses.
10. **Audit in-transaction:** every admin mutation writes an audit row in
    the same transaction.
