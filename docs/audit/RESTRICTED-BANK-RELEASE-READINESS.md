# Restricted-bank release readiness — 2026-10-31

Scope: inspection-only assessment of the target project, audit-integrity review,
question-provenance control, a disposable staging plan, and an inventory of the
existing banks. **Nothing was applied, migrated, reclassified or deleted on the
hosted project.** The restricted-bank feature remains non-deployable and its
candidate SQL stays in `supabase/candidates/`.

Target inspected read-only through the Supabase connector:
`EduReach-V1` / `gjdfatwcoosyuhakrrhh` (eu-west-1, ACTIVE_HEALTHY, PostgreSQL
17.6). All statements were `select`; no DDL, no DML.

---

## 1. Hosted compatibility assessment

### 1.1 Object reality on the target

| Object the feature needs | Hosted state |
| --- | --- |
| `cbt_bank_security` (classification) | **absent** |
| `cbt_bank_candidate_assignments` (assignments) | **absent** |
| `cbt_bank_candidate_access(uuid)` | **absent** |
| `cbt_bank_lock_candidate_access(uuid)` (the race fix) | **absent** |
| `cbt_bank_classify`, `cbt_bank_set_release`, `cbt_bank_assign` | **absent** |
| `cbt_bank_admin_inventory/candidates/history`, `cbt_bank_admin_assign` | **absent** |
| `commit_question_import(uuid,uuid)` (guarded publisher) | **absent**; only the older unguarded `commit_question_import(uuid)` exists |
| `question_import_bank_guard_ready()` | **absent** |
| `question_import_atomic_ready()` | **absent** |
| `admin_audit_logs` table and `admin_audit_log(...)` RPC | **absent** |
| `cbt_writing_sessions`, `cbt_attempt_answers`, `exam_question_imports`, `cbt_v2_*` | **absent** |
| `cbt_exams`, `exam_questions`, `cbt_attempts`, `question_imports`, `question_import_items`, `profiles` | present |

Consequences, all of which are code-independent:

1. Every bank-security route fails closed with 503 (`isUnavailable()` mapping), so
   the `/admin/banks` console cannot load on this project.
2. Question publication returns 503 because both readiness probes are missing;
   nothing is published through the guarded path.
3. The candidate's audit triggers insert into `admin_audit_logs`; **applying the
   admin candidate to this project before that table exists would make every
   classification and assignment fail at the moment it writes its audit row.**
   The reviewed migration must create `admin_audit_logs` (or the candidate must
   be adapted to `edureach_audit_logs`) in a reviewed order.
4. Migration lineage still diverges: the ledger holds **195** applied versions
   (oldest `20260814143854`, newest `20261023155533`), while the repository ships
   **84** migration files. A blind replay or `db push` remains unsafe.

### 1.2 Authenticated role mapping

- Standard Supabase roles only: `anon`, `authenticated`, `service_role`
  (NOLOGIN, inherit), `authenticator` (LOGIN, member of all three),
  `postgres`, `supabase_admin`.
- **No custom database roles** exist for `content_editor`, `service_admin`,
  `super_admin` or `moderator`. Administrative authority is expressed by
  `profiles.role` plus the application's capability map, and — for the candidate
  — by `cbt_bank_is_manager()` reading `profiles.role`.
- Hosted `profiles` holds **one** account (`super_admin`). There are no staff or
  student accounts to exercise role mapping, so hosted role behaviour for
  `content_editor` / `service_admin` is **unverified**, and the candidate's role
  check cannot be exercised against real hosted identities.
- The candidate's `cbt_bank_is_manager()` allow-list
  (`super_admin, content_editor, admin, moderator`) matches the local
  `cbt.read`/`cbt.manage` holders, but this equality is asserted locally only.

### 1.3 RPC execute grants

| Function | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `get_cbt_questions(uuid)` | – | yes | yes |
| `submit_cbt_attempt_configured(uuid,jsonb)` | – | yes | yes |
| `commit_question_import(uuid)` (legacy) | – | – | yes |
| `admin_bootstrap_first_admin(uuid,text)` | – | – | yes |
| `admin_audit_log(...)` | — | — | **function absent** |
| 27 granted routines in total touch `exam_questions` | mostly no | yes | yes |

Two pre-existing exposures remain on the target and are **not** fixed by the
candidate being ready:

- `plan_cbt_paper(uuid,text[],integer,jsonb)` is executable by **anon** and reads
  `exam_questions` (it plans a paper; it does not return question content).
- `cbt_plan_summary`, `cbt_subject_availability`, `get_cbt_questions`,
  `get_cbt_questions_for_subjects`, `get_cbt_attempt_paper`, `start_cbt_attempt*`,
  `submit_cbt_attempt*` and `get_cbt_result` are executable by any
  `authenticated` user and read `exam_questions` without a bank check today.
  These are exactly the routines `restricted_bank_readers_candidate.sql` and
  `restricted_bank_results_candidate.sql` wrap and revoke.

### 1.4 RLS and table grants

| Table | RLS | anon | authenticated | service_role |
| --- | --- | --- | --- | --- |
| `cbt_exams` | on | select | select | select |
| `exam_questions` | on | – | – | select |
| `cbt_attempts` | on | – | select | select |
| `profiles` | on | – | select/insert/update | select |
| `question_imports`, `question_import_items`, `rate_limit_hits` | on | – | – | select |
| `edureach_audit_logs` | on | – | – | **select + delete** |

- `cbt_exams` has a public SELECT policy (`is_active = true`); `profiles` has
  own-row and staff policies; `exam_questions` has **no** policies, so only the
  service role reads it directly. There is therefore no browser path to question
  text today, but also no bank-level restriction for
  `authenticated` RPCs (see 1.3).
- No table is `FORCE ROW LEVEL SECURITY`; `postgres` and `service_role` hold
  `BYPASSRLS` on this project. Any server-side path that reads questions with
  the service key bypasses policy, which is why the guards live in the functions.

### 1.5 Profile privilege boundary

- Hosted `authenticated` still holds a column-level `UPDATE` grant on
  `profiles.role`. Escalation is currently prevented by two triggers:
  - `guard_profile_role()` — any role change requires
    `private.can_manage_profile_roles()`, i.e. the caller's own row must be
    `admin` or `super_admin`;
  - `prevent_role_escalation()` — blocks a role change unless `old.role = 'admin'`.
- The candidate's mitigation (revoke the table-wide UPDATE grant, re-grant only
  editable profile columns) is **not applied** on the target, so the boundary
  rests entirely on those two triggers. Locally the same triggers exist and the
  candidate's revoke is additionally tested; hosted behaviour is **unverified**.

### 1.6 PostgREST exposure

PostgREST's exposed-schema configuration is not visible from SQL and no
publishable key was used for an HTTP probe, so exposure is **unverified**. What
is verifiable: the candidate tables `revoke all ... from public, anon,
authenticated` and grant only `select` to `service_role`, so even if the `public`
schema is exposed they cannot be read by a browser session; the candidate RPCs
grant `execute` to `authenticated` only where they are meant to be callable, and
each re-checks the caller.

### 1.7 Candidate-only object dependencies

`scripts/schema-audit.ts` classifies these as candidate-only (server code uses
them, no migration creates them), and the audit fails if the list changes
without review:

```
cbt_bank_security
rpc:cbt_bank_admin_assign        rpc:cbt_bank_admin_candidates
rpc:cbt_bank_admin_history       rpc:cbt_bank_admin_inventory
rpc:cbt_bank_candidate_access    rpc:cbt_bank_classify
rpc:cbt_bank_set_release         rpc:cbt_public_score_average
rpc:question_import_bank_guard_ready
```

None of these exist on the target, which is the single largest release blocker.

### 1.8 Verified locally vs unverified hosted

**Verified locally (disposable PGlite with real `anon`/`authenticated` roles, and
a private Unix-socket PostgreSQL for concurrency):**

- Classification, inventory, assignment/revocation/reassignment, release
  configuration, audit rows, guarded publication, atomic rollback, import
  re-pointing refusal, question-provenance refusal, public/restricted/unclassified
  reader behaviour, revocation/release serialization, guest public practice.
- `npm test` 965 tests / 964 pass / 1 skip / 0 fail; typecheck, lint, build, RLS
  audit, performance and accessibility audits all clean.

**Unverified on hosted (assumptions, not facts):**

- That applying the candidates in a reviewed order succeeds against the hosted
  schema, grants and triggers.
- That hosted `profiles.role` values and staff capabilities behave as the
  capability map assumes (no staff accounts exist).
- PostgREST schema exposure and the real HTTP behaviour of `/admin/banks`.
- Anything about the Vercel preview runtime beyond fail-closed 503s.
- Hosted `auth.uid()` propagation into the candidate's audit triggers.

---

## 2. Audit integrity

| Question | Finding |
| --- | --- |
| Who can read audit records? | The dashboard route (`/api/admin/...`) reads `admin_audit_logs` **and** the legacy `edureach_audit_logs` with the service key only when the caller holds `audit.read`; otherwise it returns `[]`. Direct table access: no grants to `anon`/`authenticated`; `service_role` has `select` (locally) on `admin_audit_logs`. |
| Who can write them? | Only `public.admin_audit_log(...)`, a `SECURITY DEFINER` function granted to `service_role` alone (locally). The candidate's bank triggers write attribution from `auth.uid()` and skip the row when no actor is known. |
| Who can modify or delete them? | No application role has `UPDATE`/`DELETE` on `admin_audit_logs` locally; there is also **no** immutability trigger, no append-only rule and no hash chain, so anyone holding the service key or a database connection can rewrite history. On the **hosted** project the legacy `edureach_audit_logs` grants `DELETE` to `service_role`, which the server holds. |
| Can ordinary administrators alter history? | Through the application: no route updates or deletes audit rows, and `audit.read` only reveals them. With a service key or database access: yes — nothing structurally prevents it. A `super_admin` is not distinguishable from the server here. |
| Is there a retention policy? | **No.** No purge job, no retention setting, no documentation. The only `pg_cron` job on the target expires news (`select public.expire_stale_news()` hourly); analytics retention covers `site_analytics_events` only. No retention period was invented. |
| Do events contain confidential material? | Bank events contain `visibility`, timestamps, `correction_release_at`, candidate ids, import ids and counts — no question text, options, answer keys, scores or student answers, and the refusal messages never echo the protected text (tested). Two pre-existing events carry personal data rather than exam content: `user_ban` stores the account **email**, and `upload` stores the **filename** and storage path of an uploaded document (a filename can itself be sensitive, e.g. an unreleased paper title). |

**Operational decision required (not made here):**

1. Retention period and legal basis for `admin_audit_logs` (and for the legacy
   `edureach_audit_logs`, which still contains one row).
2. Whether audit rows must be append-only in production (trigger-based refusal of
   `UPDATE`/`DELETE`, or a write-only role), and who may hold that authority.
3. Whether `user_ban` should keep the email or only the user id, and whether
   uploaded filenames should be truncated or hashed.
4. Whether the legacy table is migrated into `admin_audit_logs` or frozen
   read-only (the dashboard already reads both).

Locally the feature stores current actor and timestamps on the policy tables
(`classified_by`, `assigned_by`, `revoked_by`, `updated_by`) **and** an append-only
event history; only the event history is tamper-evident by convention, not by
construction.

---

## 3. Question provenance

### 3.1 Where restricted text could reach a public bank

| Vector | Before this change | Now |
| --- | --- | --- |
| Manual question creation (`POST /api/admin/cbt/exams/:id/questions`) | Any admin could re-type a restricted question into a public bank; duplicate detection was per-bank only. | Refused by the database guard; the route returns 403 and audits `question_provenance_refused`. |
| Import + publication | Per-bank duplicate detection only; the publication guard checked the destination classification, not the content's origin. | The whole batch rolls back and `question_import_provenance_refused` is recorded. |
| Editing (`PATCH /api/admin/cbt/questions/:id`) | Text could be replaced with restricted text; `exam_id` moves were already refused. | Refused by the guard; audited. |
| Question movement | Refused by `cbt_bank_question_move_guard` (all moves) and, for imports, by `cbt_import_bank_move_guard`. | Unchanged. |
| Duplicate/duplicate-into-bank action | No duplicate endpoint exists in the app; a copy is just a second create or an import, so it inherits the same guard. | Covered. |

### 3.2 The control that was added

`supabase/candidates/restricted_question_provenance_candidate.sql`:

1. `cbt_question_text_fingerprint(text)` — the same normalisation the application
   already uses (`questionFingerprint`): case-fold, fold curly quotes, collapse
   every run of non-alphanumerics to one space, trim. Tested to agree with the
   TypeScript helper for case, punctuation, curly quotes, apostrophes and empty
   text.
2. `cbt_question_provenance_guard()` — `BEFORE INSERT OR UPDATE OF question_text,
   exam_id` on `exam_questions`. If the destination bank is **not** restricted and
   any restricted bank already holds the same fingerprint, the write is refused
   with SQLSTATE `42501` and a message that names no title, text, bank or key.
   Copying public text **into** a restricted bank stays allowed (containment).
3. `cbt_restricted_requires_provenance()` — a restricted bank cannot be created
   while the guard trigger is absent, so classification cannot be applied in a
   half-migrated state that would leave the copy path open.
4. `cbt_question_provenance_ready()` — a read-only readiness marker for staging
   and operations, executable by `service_role` only.

No historical row is classified, reclassified or backfilled, and no source bank
is invented for existing questions. The guard is content-identity only.

### 3.3 Limits that remain

- **Paraphrase and formatting are not detected** (only normalisation-insensitive
  identity). Markup that changes words, reordered options, or a question split
  into parts will pass.
- Cross-bank duplicates that already exist are left alone by design. The hosted
  inventory already contains identical seeded text in several banks
  (`Synthetic 1`, `Seeded …` in local fixtures; on the target, all 1610 questions
  are `source_type = 'unverified'` with no `import_id`, so provenance is unknown).
- Copies made with direct SQL or a service-role write bypass every application
  check; the trigger still applies to those writes unless the role disables
  triggers (only superusers can).
- Cost: the guard evaluates a fingerprint per inserted row, and a 400-question
  publication therefore performs 400 existence checks against restricted banks.
  With 1610 questions this is trivial; a reviewed migration should add
  `create index concurrently on public.exam_questions
  (public.cbt_question_text_fingerprint(question_text))` before large imports.
- It does not replace per-question provenance (`source_bank_id`, `import_id`),
  which remains the durable fix and needs its own reviewed design.

---

## 4. Disposable staging verification plan

**Precondition — identity confirmation (not met):** the organisation also owns
`EduReach-Hub-Staging` (`kilkvajanoesqtzclsrs`, eu-central-1), currently
**INACTIVE**. It was **not** started, migrated or queried. Staging may proceed
only after the operator confirms, in writing, (a) that this project is
disposable, (b) that no production data has been copied into it, (c) that the
person running the plan holds owner/admin on it, and (d) the exact migration and
candidate files to apply. Production (`gjdfatwcoosyuhakrrhh`) is out of scope.

Environment for every step: a fresh disposable database built from
`supabase/migrations` **plus the candidates in this order** —
`restricted_bank_policy_foundation.sql`, `restricted_bank_readers_candidate.sql`,
`restricted_bank_results_candidate.sql`, `restricted_bank_admin_candidate.sql`,
`restricted_question_provenance_candidate.sql` — with `admin_audit_logs` present
(created by the migrations) before the admin candidate runs. Require
`select public.cbt_question_provenance_ready()` = true and
`select public.question_import_bank_guard_ready()` = true before starting.

| # | Step | Expected |
| --- | --- | --- |
| S0 | Preflight: object inventory, function privileges, `admin_audit_logs` present, guard markers true. | All pass; abort on any missing object. |
| S1 | Administrator classification: classify bank A `public`, bank B `restricted` with a future release, bank C left unclassified; then retry classification of A. | Both succeed and are audited (`bank_classified`); retry refused "already classified"; unclassified C has no row. |
| S2 | Non-administrator attempts to classify via the API and via direct RPC. | 403 at HTTP; `permission denied` from the RPC; refusal audited; no policy change. |
| S3 | Candidate assignment: assign student 1 to B; list candidates; verify `cbt_bank_candidate_access(B)`. | Assignment recorded and audited; student 1 sees access, student 2 does not. |
| S4 | Restricted paper retrieval: student 1 fetches the paper (`/api/cbt/...`, `get_cbt_questions`, `get_cbt_attempt_paper`); student 2 fetches the same; guest fetches it. | Student 1 receives questions and no key/score; student 2 and the guest receive nothing (0 rows / 404) and no question read occurs server-side. |
| S5 | Answer submission before release: submit as student 1. | Accepted; response carries no score, correctness or key; repeated submissions stay identical; direct `cbt_attempts` row hidden. |
| S6 | Assignment revocation: revoke student 1, then retry fetch, submit and history. | Every later operation denied; an operation already in flight may finish; revocation audited (`bank_candidate_revoked`). |
| S7 | Correction release: move the release earlier than an in-flight submission, then to the past; wait for release; fetch result as an assigned, released candidate. | Backdating refused ("cannot be undone"), change serialized against the in-flight submission, result only revealed after release and only while assigned. |
| S8 | Public guest practice: guest gets bank A's paper, submits, receives corrections. | 200 with score and corrections; bank B and C return 404 with no question read. |
| S9 | Import and publication: upload a batch to A (valid), to C (unclassified), to B (restricted), and a batch into A containing text that already exists in B. | A publishes atomically and is audited `bank_questions_published`; C refuses with no rows written; B publishes with `visibility = restricted`; the provenance batch rolls back whole and is audited `question_import_provenance_refused`; a batch with an invalid item leaves the import at `extracted` and adds zero rows. |
| S10 | Unauthorized access: student and guest call every `/api/admin/cbt/banks*` route, and a signed-in non-manager calls `commit_question_import` with their own id. | 401/403 before any database read; publish refused with `permission denied`; refusals audited. |
| S11 | Provenance: create a question in A with B's text; edit an A question to B's text; drop the guard trigger in a transaction and try to classify a new restricted bank. | Both copies refused (403 at HTTP, `42501` at SQL); classification refused "requires the question provenance guard"; no partial state. |
| S12 | Evidence capture: `admin_audit_logs` extract for the run, function-privilege matrix, RLS listing, row counts per bank. | Matches the expectations above; no answer keys or question text in any audit row. |

Abort and stop the run if any step produces a different result, if any guest or
unassigned caller reads a restricted question, if a successful publication lacks
its audit row, or if a refused publication leaves rows behind. The local
rehearsal (`scripts/rehearse-restricted-bank-concurrency.mjs`, 8 PASS) already
automates S4–S8's race behaviour and S8's guest path against real PostgreSQL; it
does **not** cover S1–S3 or S9–S11 end to end over HTTP.

Data hygiene for the run: synthetic accounts only, no copied production
questions, no real candidate identities, delete the disposable project
afterwards, and never point the preview deployment at it without recording which
project the preview uses.

---

## 5. Existing bank inventory (read-only, hosted)

No bank has a policy row, so every bank below is **unclassified** — not public,
not restricted. Nothing was classified or modified.

| # | Bank id | Title | Body | Active | Questions | From import | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `f56e8e07-541e-4884-bf13-022bc8b30422` | JAMB UTME Comprehensive Practice Bank | JAMB | yes | 400 | 0 | 0 |
| 2 | `ca4d3ae4-fb7e-4eff-8679-4e2742e725c4` | WAEC SSCE Comprehensive Practice Bank | WAEC | yes | 398 | 0 | 2 |
| 3 | `fa35067e-d23d-407a-a8a2-fc85ad8a7a63` | NECO SSCE Comprehensive Practice Bank | NECO | yes | 395 | 0 | 0 |
| 4 | `77b8808b-3978-462c-85a6-fed314d4feda` | Post-UTME Comprehensive Practice Bank | POST-UTME | yes | 395 | 0 | 0 |
| 5 | `d37a0c7c-4b59-49a1-afad-30f08a6cfd09` | JAMB UTME Demo Practice | JAMB | no | 10 | 0 | 5 |
| 6 | `edef5d4f-46fb-4f2d-8895-1a593f2f4945` | Post-UTME Demo Practice | POST-UTME | no | 10 | 0 | 0 |
| 7 | `33075e1c-8798-4ccc-858b-120d17b37bcd` | JAMB UTME Practice Bank | JAMB | no | 2 | 0 | 0 |

Totals: 7 banks, 1610 questions, 7 attempts, 0 imports, 0 classified banks.

Source provenance as stored: `source_type = 'unverified'` for 1608 questions and
`'original_practice'` for 2 (source year 2026); no question carries an
`import_id`. Provenance is therefore **unknown for 1608 of 1610** questions — the
records must not be used to infer a classification, and the guard's existence
says nothing about where these questions came from.

---

## 6. Remaining release blockers

1. **No deployable migration.** All bank policy, administration, publication and
   provenance objects exist only in `supabase/candidates/`. They must become a
   reviewed migration sequence that also creates `admin_audit_logs` before the
   admin candidate's triggers run.
2. **Hosted schema drift.** 195 ledger rows vs 85 repository migrations, and 88
   public tables including objects this repository does not create. A migration
   plan must reconcile the lineages before any candidate is applied.
3. **No hosted staff identities.** Role mapping for `content_editor`,
   `service_admin`, `admin`, `moderator` is unverified, and `super_admin` is the
   only hosted account.
4. **Audit trail is not durable on the target.** `admin_audit_logs` and
   `admin_audit_log` are absent, so today's audit writes fail silently there, and
   the legacy table still allows `DELETE` by the service role. Retention,
   append-only semantics and the email/filename fields need an owner decision.
5. **Provenance is incomplete by design.** The guard stops copying known
   restricted text; it cannot detect paraphrase, already-copied material, or
   service-role bypasses, and per-question provenance does not exist.
6. **v2 finalization has no gateway**, so restricted v2 cannot produce a result;
   v2 creation stays disabled.
7. **Hosted/POSTGREST verification outstanding:** the `/admin/banks` console and
   the guest/public paths have never been exercised against real hosted Auth and
   PostgREST.
8. **Staging identity unconfirmed.** `EduReach-Hub-Staging` is inactive and was
   not used; the plan in section 4 cannot run until its disposability and
   permissions are confirmed.
9. **Classification lifecycle is immutable** in the candidate: a misclassified
   bank cannot be corrected, and released corrections cannot be re-embargoed.
   That is deliberate, but it needs an operational procedure before cutover.
