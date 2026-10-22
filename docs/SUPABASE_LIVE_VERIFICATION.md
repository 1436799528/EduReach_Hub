# Supabase live verification — what this machine can check, and what it cannot

**Date:** 22 October 2026
**Question it answers:** "Which Supabase checks are genuinely done, which need
authenticated access to the project, and what exactly is blocking the rest?"

Status: **local checks complete and passing; no live check has been performed.**
This document does not contain, and must never contain, a key, a password or a
connection string. Only the *names* of environment variables appear here.

---

## 1. The blocker, stated precisely

The repository is designed to read its Supabase configuration from the
environment at runtime. In this working environment:

```
$ npm run prod:validate
  VITE_SUPABASE_URL                  NOT SET    (required, client, non-secret)
  VITE_SUPABASE_PUBLISHABLE_KEY      NOT SET    (required, client, non-secret)
  SUPABASE_SERVICE_ROLE_KEY          NOT SET    (required, server, secret)
  NODE_ENV                           NOT SET    (required, server, non-secret)
  skip [connectivity] live validation against the Supabase project — no
       SUPABASE_URL/VITE_SUPABASE_URL and no service-role key in this environment
  0 passed, 1 failed, 2 skipped
```

Three things follow, and they are different in kind:

1. **No credentials exist here.** Only `.env.example` and
   `.env.production.example` are tracked, and both hold placeholders. Nothing can
   connect to the project until real values are supplied in the environment.
2. **Production access is an owner decision, not a technical default.** Even with
   a key, running anything against project `gjdfatwcoosyuhakrrhh` is a production
   action, and the instruction for this work is explicit: no production writes,
   no migrations, no settings changes without approval. The read-only checks below
   still wait for that approval.
3. **Secrets must not travel through chat.** A service-role key bypasses row-level
   security and is equivalent to the database itself. The safe routes are: put
   the values in a local `.env` (git-ignored) and run the commands yourself, or
   attach a staging project to an authorised environment. Never paste them into a
   conversation, a screenshot or an issue.

There is a second, unrelated network fact: this sandbox can reach GitHub, npm
and PyPI only. `https://edureachhub.netlify.app` is unreachable from here, so the
deployed-site checks (§4) cannot be run from this machine at all.

---

## 2. What was verified locally (safe, read-only, no project contacted)

| Check | Command | Result on 22 Oct 2026 |
|---|---|---|
| Types | `npm run typecheck` | pass, exit 0 |
| Unit/integration suite | `npm test` | see the run recorded in the final report |
| Every migration applies to a real PostgreSQL | `npm test` → `tests/migrations.test.ts` (PGlite 18) | pass, 74/74 migrations |
| Migration checklist covers every committed migration | `npm run migrations:checklist` | pass, 74/74 listed |
| Static schema audit (references, ordering, object creation) | `npm run schema:audit` | no blocking findings |
| RLS posture of every public table | `npm run rls:audit` | 50/50 tables classified, 0 findings |
| Accessibility rules | `npm run a11y:audit` | 0 blocking, 5 informational |
| Performance budgets on the built artefact | `npm run perf:audit` | 10/10 |
| Production build | `npm run build` | exit 0 |
| Browser suite (desktop + mobile) | `npm run test:e2e` | see the final report |
| Environment contract | `npm run prod:validate` | 1 failed (missing variables), 2 skipped (live groups) |
| Duplicate-question analysis | `npm run duplicate:audit` | BLOCKED — reports missing credentials, exits 0 without claiming a result |
| Backup/restore rehearsal | `npm run backup:rehearsal` | proves a **local** PGlite dump/restore only; it is not a Supabase backup proof |

What this proves: the schema the repository describes is internally consistent
and replayable, the policies it classifies are the policies it applies, and the
build ships within its budgets. What it does **not** prove: that the hosted
project is in that state. That is the whole of §3.

---

## 3. The live checks, and how each one is performed (all read-only)

| # | Check | Why it needs project access | How to run it | Pass looks like |
|---|---|---|---|---|
| 1 | Server key is a real service-role key and the project answers | PostgREST call under the secret key | `npm run prod:validate` | `pass [connectivity]`, `0 skipped` |
| 2 | Storage buckets exist with the intended read access (`admin-content` public by design; `resource-files`, `campus-uploads`, `past-questions` private) | `storage.buckets` read | `npm run prod:validate` | `pass [storage] …` |
| 3 | Data integrity report (question banks, thin subjects, orphaned content) | `content_integrity_report()` as service role | `npm run prod:validate` | `pass [data] …`, or the report's own warnings listed |
| 4 | RLS is enabled on every public table | `pg_class` needs SQL, not PostgREST | `supabase/ci/production-validation.sql` #2 | `pass` |
| 5 | No application function is executable by `anon`/`authenticated`; no SECURITY DEFINER with a mutable `search_path` | `pg_proc`, `pg_roles` | SQL script #3, plus `docs/SUPABASE_SECURITY_CHECKLIST.md` | `pass` |
| 6 | Server-only tables expose no client policy or grant | `pg_policies`, ACLs | SQL script #5, #6 | `pass` |
| 7 | Every migration in the repository is recorded in the live ledger | `supabase_migrations.schema_migrations` | **SQL script #8** (new: the generated full checklist, §5) | `pass`; otherwise a `fail` naming each unrecorded file |
| 8 | Key release objects exist (tables, functions, constraints, policies from the 2026-10 releases) | catalogue | SQL script #9 | `pass` |
| 9 | Auth settings: leaked-password protection, Site URL, redirect allow-list, email templates | dashboard only | `docs/SUPABASE_SECURITY_CHECKLIST.md` §"Auth dashboard" | human sign-off |
| 10 | Deployed site is actually ready | network call to the deployment | `npm run smoke -- https://<host>` | `status=ready, http 200` |
| 11 | Real backup/PITR restore | Supabase dashboard / support | `docs/operations/BACKUP_AND_RESTORE.md` | a restore rehearsal recorded with a date |

Checks 1–8 are read-only and safe to run against staging at any time. Checks
1–3 and 10 touch the network; 4–8 are SQL you paste into the SQL editor. **None
of them writes.** Nothing in this repository should be used to "fix" a ledger
row: if #7 reports a missing migration, the answer is a reviewed forward-only
migration or a documented reconciliation, never an edit to
`supabase_migrations.schema_migrations` (see
`docs/operations/SUPABASE_MIGRATION_HISTORY_RECONCILIATION.md`).

---

## 3b. Which project is this checkout pointed at?

Two jobs share one `.env`, and their safety rules are opposite:

| Job | Commands | Safe against production? |
|---|---|---|
| Read-only verification | `prod:validate`, `duplicate:audit`, `analytics:retention` (no `--apply`), `newsroom:integrity`, the SQL artifact | **Yes** — every statement is a `SELECT` |
| Manual walkthrough | sign-up, password reset, practising a paper, uploads, admin edits | **No** — it creates accounts, attempts, uploads and emails |

`npm run env:check` prints the project reference and says which case you are in.
It prints no key and no part of the connection string beyond the reference, which
is already public in the deployed site's own requests.

**Recorded 2026-10-22:** the owner's `.env` pointed at `gjdfatwcoosyuhakrrhh`,
which is the production project named in this repository's audit documents.
Every command run against it that day was read-only, so nothing was written — but
the next step in the plan (the walkthrough) would have. To do the walkthrough,
point `.env` at a staging project first, or create one.

Recommended arrangement for one machine:

1. `cp .env .env.production-live` — keeps the production values in a file the app
   does not read (`.env*` is git-ignored, so neither file is ever committed).
2. Edit `.env` to hold the staging project's three values.
3. Run `npm run env:check` after any edit; it must say `staging or another project`
   before the walkthrough.
4. To go back to read-only production checks, swap the two files over and run
   `npm run env:check` again.

### NODE_ENV, and why it does not belong in `.env`

`prod:validate` reports `NODE_ENV` as required. Do **not** add
`NODE_ENV=production` to `.env`: the dev server reads the same file, and a
"production" value there makes `npm run dev` serve the built `dist/` folder
instead of the live development server. Provide it per command instead:

```
NODE_ENV=production npm run prod:validate      # Git Bash, macOS, Linux
$env:NODE_ENV="production"; npm run prod:validate   # PowerShell
```

`npm start` sets it itself, so serving the production build needs no variable.

## 4. Running it from Windows (PowerShell)

- `npm run prod:validate`, `npm run duplicate:audit`, `npm run analytics:retention`
  and `npm run smoke` now load `.env` themselves, so a value written there is used
  by the command that checks it. Before this, they read only the shell
  environment and reported a `.env`-configured project as "NOT SET".
- `npm run analytics:retention` without `--apply` is a **read-only count**. It
  used to call the deleting function and print its answer as a plan; that was
  fixed on 2026-10-22 after being caught on a real project with a count of 0.
- `npm run schema:audit` and `npm run perf:audit` normalise CRLF, so a Windows
  checkout (Git for Windows' default `core.autocrlf=true`) gives the same answers
  as Linux. Before the fix the schema audit reported 138 blocking findings on
  Windows and none on Linux.
- After pulling a commit that adds a dependency, run `npm ci` before anything
  else. Skipping it produces `Cannot find module 'compression'` (the module that
  compresses responses); `npm start` now says so in one sentence instead of a
  stack trace.
- `npm start` runs `node scripts/start.mjs`, which sets `NODE_ENV=production` in
  Node before loading the server. It works in PowerShell, Git Bash and cmd.exe.
  (It used to be the POSIX prefix `NODE_ENV=production node build/server.cjs`,
  which fails on Windows and also broke the Playwright `webServer`.)
- Put secrets in `.env` with `notepad .env`, never as a command argument — text
  typed into a command line is saved in the PowerShell history file.
- `git status` must stay clean after `.env` exists. `.env*` is git-ignored; if
  `.env` ever appears as untracked, stop and fix `.gitignore` before continuing.

## 4. The safe order of operations

Do these in order, on **staging first**. Production is step 8 and needs your
explicit approval plus a backup checkpoint.

1. Create (or confirm) a staging Supabase project. Never rehearse on production.
2. Put its three values into `.env` on your own machine
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`). Do not commit it; `.env*` is git-ignored.
3. `npm run build && npm run prod:validate` → expect `0 failed, 0 skipped`.
   A failure here names the group that failed and cannot be mistaken for a pass.
4. Open the staging project's SQL editor, paste
   `supabase/ci/production-validation.sql`, run it. Every row should read `pass`;
   record any `fail` row verbatim.
5. `npm run test:e2e` with the staging values present — this is the only way the
   sign-in, upload, CBT submit and dashboard flows are exercised against a real
   database.
6. `npm run duplicate:audit` — read-only; it prints duplicate groups for review
   and deletes nothing.
7. Complete the dashboard items in `docs/SUPABASE_SECURITY_CHECKLIST.md`
   (password protection, Site URL, redirect URLs).
8. Only after 1–7 pass: repeat 3–4 against production with your approval, take a
   backup checkpoint first, and record the date, the deployment SHA and the
   results in `docs/operations/PRODUCTION_RUNBOOK.md`.

---

## 5. What changed in this session to make #7 enforceable

Before: check 8 of `production-validation.sql` was
`select count(*) from supabase_migrations.schema_migrations` compared to a
hand-written `74`, and check 9 named a hand-picked list of release versions.
Neither could notice a migration file that had just been added.

Now:

- `supabase/ci/production-validation.sql` carries a generated list of **every**
  file in `supabase/migrations/`, between
  `-- BEGIN GENERATED MIGRATION CHECKLIST` and `-- END GENERATED MIGRATION CHECKLIST`.
- `npm run migrations:checklist` fails when a file is missing from that list, when
  the list names a file that no longer exists, when a 14-digit version is claimed
  twice, or when an entry disagrees with its file or with its reconciliation kind.
  It is a stage of `npm run ci`.
- `npm run migrations:checklist -- --write` regenerates the list. Regenerating is
  a source change reviewed like any other; it does not touch a database.
- Each row carries a `kind`, and the SQL applies a different rule to each:
  `unique` files match by version or by name (the live ledger recorded many under
  a different timestamp); `shared` files — the ones that share a legacy 8-digit
  version — match by **name only**, because a version match cannot distinguish
  six files on `20260903`; `unresolved` files are reported as `unresolved` until a
  ledger row for the file itself exists.
- `tests/migration-checklist.test.ts` runs that SQL against a real PostgreSQL with
  a synthetic ledger and proves the cases that matter: one `20260903` row does not
  satisfy the six files, a missing migration is named, a documented renumbering
  still matches, and a file with no evidence is never reported as applied.

Regenerating after adding a migration:

```
npm run migrations:checklist -- --write
npm run migrations:checklist
```

`docs/operations/SUPABASE_MIGRATION_HISTORY_RECONCILIATION.md` remains the record
of the deeper local-vs-remote history question. This checklist does not resolve
that history; it stops the repository from quietly forgetting a migration while
the question is open, and it refuses to report the remaining unresolved file as
applied. Live reconciliation stays **blocked** until it is run against a
disposable project.

---

## 6. Still unverified, and why that is being said plainly

- Whether the hosted project matches the repository schema, policies and grants.
- Whether `content_integrity_report()` is green against real data.
- Whether storage buckets exist with the intended visibility.
- Whether every repository migration is recorded in the live ledger.
- Auth dashboard settings (leaked-password protection, Site URL, redirects).
- The deployed site's readiness and performance.
- That a Supabase backup actually restores.

Each of these has a command or SQL statement in §3. None has been run, and none
is reported as passing anywhere in this repository.
