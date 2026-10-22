# Staging verification runbook

**What this is:** the ordered procedure for running the checks that could not be run
in the development environment, against a **disposable** Supabase project.
**What this is not:** a production deployment, a production migration run, or a
claim that any of it has already been done.

**Status when this was written (22 October 2026):** every step below is
**NOT RUN**. There are no Supabase credentials in the audit environment, and
Netlify credits are expired, so nothing here has been executed. Sections that
touch the network are marked so; nothing in this document may be reported as
`pass` until someone has actually run it and kept the output.

Everything below is written for **Git Bash / MSYS2** on Windows (prompt
`~/EduReach_Hub`), the shell this project's verification is done in.

---

## 0. The rule that governs everything else

A read-only check is safe against any project. A **write** is only safe against a
project that has been proved disposable. The split:

| Job | Commands | Safe against production? |
|---|---|---|
| Read-only verification | `env:check`, `prod:validate`, `rls:audit`, `schema:audit`, the SQL artifact | **Yes** — `SELECT` only |
| Manual walkthrough | sign-up, password reset, CBT attempt, uploads, admin edits | **No** — creates accounts, attempts, files, emails |

If any step below would create or change data and the target has not been
confirmed disposable, **stop**. That is not a formality: on 2026-10-22 the
owner's `.env` was found pointing at production while a plan described it as
staging (recorded in `docs/SUPABASE_LIVE_VERIFICATION.md` §3b).

---

## 1. Target-project identity (fail closed)

Run this first, before any other command, and again after every `.env` edit:

```bash
npm run env:check -- --require-staging
```

`env:check` prints the project reference (never a key) and a classification, then
applies the gate. It exits **1** — blocking the runbook — when:

| Situation | Why it blocks |
|---|---|
| No project URL configured | There is no verified target |
| The project is the documented production project | Writes are never allowed there |
| The project is not production but was not named by the operator | "Not production" is not proof of disposable |
| `STAGING_PROJECT_REF` does not match the configured project | Two different projects are in play; refuse to guess |

It exits **0** only when the project is configured, is not the documented
production project, **and** the operator names it explicitly:

```bash
STAGING_PROJECT_REF=<your-staging-ref> npm run env:check -- --require-staging
```

**Limitation, stated plainly:** the tool knows one production reference. It
cannot prove that an unknown project is disposable, and a project whose *display
name* says "staging" is not evidence. Create the project for this purpose (§2) and
keep its reference in the evidence record. Until `STAGING_PROJECT_REF` is set to
the reference the tool just printed, the gate stays closed by design.

---

## 2. A disposable environment

Requirements for the target project:

1. A **dedicated Supabase project** used for nothing else — not the project the
   live site points at, not a copy of production data beyond schema.
2. **No production data.** If realistic content is needed, generate it; do not
   copy user rows, documents or storage objects from production.
3. **No production secrets.** Give the staging project its own keys. Copying the
   production service-role key into staging would make a mistake here a
   production-equivalent key in a second place.
4. The person running the steps is the project owner (or has been given the keys
   deliberately). Keys go into a local `.env` (git-ignored). They are never pasted
   into chat, an issue, a commit or a screenshot.

Environment variable **names** only — the values are never written down here:

| Variable | Where it is used | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | client + server | no |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | no (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | server only | **yes** |
| `NODE_ENV` | server | no |
| `EDUREACH_SITE_URL` | robots/sitemap canonical origin | no |
| `STAGING_PROJECT_REF` | the gate in §1 | no |

`npm run env:check` prints only "present / not present" for these, and only the
project reference from the URL.

---

## 3. Migration baseline

The repository holds **74** migration files in `supabase/migrations/` and a
generated checklist of all 74 inside `supabase/ci/production-validation.sql`
(`npm run migrations:checklist` fails if the two drift apart).

Establish the staging baseline **read-only**:

```bash
npm test                                    # includes PGlite applying all 74 migrations
npm run schema:audit                        # static: references, ordering, objects
npm run migrations:checklist                # 74/74 listed in the artifact
```

Then compare against the staging ledger with the SQL in §4 — it is a `SELECT`.
The repository does **not** apply migrations to staging from this runbook: if the
staging project is empty, create it, and apply the migrations with your normal
`supabase db push` procedure **only after** §1 passes and you have confirmed the
target. Record which method was used.

---

## 4. Read-only reconciliation (the three verdicts)

Open `supabase/ci/production-validation.sql` in the staging project's SQL editor
and run **check 8 only** (the block between `-- 8.` and `-- 9.`), or run the whole
file — every statement is a `SELECT`. It prints three rows:

| Verdict | Meaning | What to do |
|---|---|---|
| `pass` | every repository migration has a ledger row that identifies it | nothing |
| `fail` | named files are missing from the ledger | investigate; fix forward only |
| `unresolved` | the ledger cannot distinguish this file from another | see below |

How the matching works, so the result can be read correctly:

* **Unique versions** match on version, or on the ledger name with its date
  prefix stripped (the live ledger renumbered several files; the reconciliation
  document lists them file by file).
* **Shared legacy versions** (six files carry `20260903`, five carry `20260919`,
  three carry `20260920`) match **by name only**. One ledger row carrying
  `20260903` proves at most one of those six — it cannot vouch for the rest.
* **`unresolved`** is the honest state for a file with no distinguishing ledger
  row. It is **not** a pass and must not be counted as one. The one currently in
  that state is `20260903_production_security_hardening.sql`
  (see `docs/operations/SUPABASE_MIGRATION_HISTORY_RECONCILIATION.md`).

### Investigating an unresolved migration without inventing history

1. Read the file and compare its statements with the staging schema (the objects
   it creates — tables, policies, functions — either exist or they do not).
2. Compare it with the similarly named ledger row
   (`20260903191133 production_security_contract_hardening`) and decide whether
   it is the same change under a different name. Two files with similar names are
   not the same file.
3. Record the finding, with evidence, in the reconciliation document. If the SQL
   is genuinely equivalent to the recorded row, map it there and it becomes
   verifiable; if it is not, it stays pending until a forward-only migration
   brings staging to the intended state.
4. **Never** insert into, update or delete from
   `supabase_migrations.schema_migrations`, and never `supabase migration repair`
   to make a verdict go green. A ledger edited to pass is worse than an honest
   `unresolved`.

---

## 5. Application validation against staging (read-only, network)

```bash
npm run env:check -- --require-staging        # must print GATE: ... confirmed
npm run prod:validate                         # must show 0 skipped, 0 failed
npm run rls:audit                             # static posture, no network
npm run schema:audit                          # static, no network
```

`prod:validate` exits 1 whenever a required variable is missing or a live check
cannot run. That is correct behaviour, not a bug: it reports `skipped`, never
`pass`. Copy the exit code and the per-check lines into the evidence record.

If `prod:validate` cannot reach the network from your machine, that is a
**network restriction** — record it as `blocked`, not as `pass`.

---

## 6. CBT verification (writes — staging only)

Run after §1 passes. Use two student accounts, one staff account and one admin
account created in staging, never real accounts.

| # | Step | Expected |
|---|---|---|
| 1 | Start an exam as student A | attempt created, paper frozen, questions returned without answer keys |
| 2 | Answer some questions, reload the page, reopen the attempt | the same selection comes back (draft persisted) |
| 3 | Let another student (B) call `/api/cbt/attempts/<A's attempt>` | 403/404 — ownership enforced by `auth.uid()` in the RPC, not by the client |
| 4 | Submit A's attempt as B | refused; no rows change |
| 5 | Submit A's attempt twice | second call replays the same result; score does not double-count |
| 6 | Submit after the deadline (a short-duration paper, or the configured grace) | refused or scored under the documented grace rule — record which |
| 7 | Call submit on an exam id that does not exist / an attempt id that does not exist | clean 4xx, no stack, no SQL text |
| 8 | Guest paper: answer 3 of 10 questions and submit `/api/cbt/guest-submit` | `correct_option`/`explanation` present only for the 3 attempted; the other 7 are `null` |
| 9 | Guest paper: submit `{"answers":{}}` | no answer key for any question |
| 10 | `correct_answers` and `score` | match the answers given, computed server-side |

If any step returns another user's data, stop and record a **security finding**
before continuing; do not "work around" it in the walkthrough.

---

## 7. Upload verification (writes — staging only)

| # | Step | Expected |
|---|---|---|
| 1 | Upload a valid small `.csv` question file | accepted; items extracted; nothing committed until you commit the import |
| 2 | Upload a `.docx` paper | accepted; questions recognised |
| 3 | Upload a `.zip` of two valid `.txt` papers | both read; per-file counts in warnings |
| 4 | Upload a `.zip` containing a nested `.zip` | rejected: "Nested ZIP archives are not supported" |
| 5 | Upload a `.zip` of 61 files | rejected: the entry-count message names the ceiling |
| 6 | Upload a file with a wrong extension for its content | rejected before parsing: "does not look like a …" |
| 7 | Upload a 21 MB file | rejected at the route with 413; the body is not parsed into the extractor |
| 8 | Upload a corrupt `.zip` (truncate a valid one) | clean "damaged or encrypted" error, no crash, no partial import |
| 9 | Upload a deflate bomb inside a `.docx`, and a `.zip` of many small `.docx` files whose inner XML expands past 80 MB | rejected with the size message; **no** import row moves to `ready`; the archive is not partially imported |
| 10 | After each rejection, check `question_imports` | status `failed` with a readable reason, or untouched; no orphaned storage object from a failed insert |

Step 9 is the check for the nested-container budget: the outer entries were
measured, and the text expanded *inside* them now draws from the same 80 MB
archive budget. Reproducing it needs a generated archive (a 4 KB upload of six
tiny `.docx` files can expand ~90 MB of text); `tests/zip-bounds.test.ts` holds the
small-scale versions of exactly these cases.

A rejected import must leave the question bank untouched: extraction only
populates staging rows, and nothing reaches `exam_questions` until the import is
committed and reviewed.

---

## 8. Authorization boundaries (staging accounts)

| Account | Try | Expected |
|---|---|---|
| ordinary student | open `/admin`, call `/api/admin/users`, `/api/admin/question-imports` | 403 (server-side), page redirects |
| ordinary student | submit another student's CBT attempt | 403/404 |
| staff with `cbt.manage` but not `user.manage_roles` | call `/api/admin/users/:id/role` | 403 |
| staff | upload a question import | allowed if they hold `cbt.manage` or `data.import` |
| admin | the above | allowed, and each action appears in `admin_audit_logs` |
| anyone signed out | any `/api/admin/*` write | 401 |
| anyone | `/api/admin/bootstrap` with a non-configured email | 403 |

Record the exact status codes. A UI-only block (button hidden) is **not** a pass:
the server check is the control, and these calls are made with a REST client or
`fetch`, not only through the interface.

---

## 9. Evidence to keep

One record per run, stored outside the repository if it contains anything
sensitive:

```
Target project reference:  <ref from env:check>          (not a key)
Commit SHA:                <git rev-parse HEAD>
Date / operator:           <who, when>
Staging project created:   <yes/no, method>
Migration baseline:        <db push / empty / other>
env:check --require-staging:  GATE line + exit code
prod:validate:                exit code + the pass/fail/skip counts
rls:audit:                    exit code + finding count
schema:audit:                 exit code
SQL check 8 verdicts:         unique / shared / unresolved rows (verbatim)
Unresolved investigation:     conclusion + evidence, or "still unresolved"
CBT steps 1-10:               pass/fail each, with status codes
Upload steps 1-10:            pass/fail each, with the error text seen
Authorization matrix:         each row's status code
Failures:                     sanitized message only — never a key, token or query
```

Anything not run is recorded as **NOT RUN**. Anything blocked by a missing
credential, a network restriction or an expired service is recorded as
**BLOCKED** with the reason. `pass` is reserved for a check whose output you have
in front of you.

---

## 10. What is still outstanding after this runbook

These cannot be closed by running the steps above:

* **Live ledger reconciliation of `20260903_production_security_hardening.sql`** —
  stays `unresolved` until §4's investigation produces evidence.
* **Production deployment verification** — Netlify credits are expired; no deploy
  is attempted and no deployment check is claimed.
* **Backup/restore rehearsal** — `docs/operations/BACKUP_AND_RESTORE.md`; needs a
  real restore, not a read-only check.
* **Auth dashboard settings** (leaked-password protection, site URL, redirect
  allow-list, email templates) — dashboard-only, human sign-off
  (`docs/SUPABASE_SECURITY_CHECKLIST.md`).
