# Backup, restore and rollback

**Owner:** EduReach maintainer (single-operator project) · **Last reviewed:** 2026-10-03
**Status of the procedure:** documented and rehearsed — see §6 for exactly what has
and has not been exercised.

This document closes **CRIT-1** from `docs/FINAL_COMPLETION_AUDIT_2026-10-02.md`
("no backup, restore or rollback procedure documented anywhere"). It is written so
that a person who did not build this system can follow it at 2am.

---

## 1. What can be lost, and what that costs

| Asset | Where it lives | If it is lost |
| --- | --- | --- |
| Student records — profiles, service requests, CBT attempts, saved items, notifications | Supabase Postgres, `public` schema | Irreplaceable. Reconstructable from nothing. |
| Auth identities | Supabase `auth` schema | Students cannot sign in; must re-register. |
| Published content — news, opportunities, institutions, services, exam banks | Supabase Postgres | Rebuildable only by re-authoring; the newsroom pipeline re-fetches some of it. |
| Uploaded images | Storage bucket `admin-content` (public) | Every published article image 404s. Not in the database backup. |
| Gated documents | Storage bucket `resource-files` (private) | Past-question papers are gone. Not in the database backup. |
| Campus attachments | Storage bucket `campus-uploads` (private) | Campus posts lose their files. |
| Schema | `supabase/migrations/*.sql` in this repository | Rebuildable at any time from the repository — proven by `npm run backup:rehearsal`. |
| Configuration — env vars, function secrets, custom domain | Netlify + Supabase dashboards | Redeployable if the values are recorded somewhere safe (§4). |

**The two buckets that hold real content (`admin-content`, `resource-files`) are not
covered by a Postgres backup.** Whatever backup policy is chosen, storage needs its
own answer (§4.3).

---

## 2. Recovery objectives — decide these, do not assume them

The platform has not defined an RPO (how much data may be lost) or an RTO (how long
restore may take). This is a business decision, not a technical one, and it is the
one thing in this document that cannot be filled in by code.

| Tier | RPO | RTO | Requires |
| --- | --- | --- | --- |
| Minimum acceptable | up to 24 h | same working day | Supabase daily backups (default on paid plans) + the storage export in §4.3 |
| Recommended | ≤ 5 min | ≤ 1 h | Point-in-time recovery enabled on the project, plus a written runbook drill |
| Strongest | 0 (synchronous) | ≤ 30 min | Beyond Supabase's default offering; needs a decision and budget |

**Action:** choose a tier, write it here, and make sure the platform actually
provides it. Until a tier is chosen, the honest statement is: *the platform has
whatever backup facility its Supabase plan provides by default, and nobody has
confirmed which.*

---

## 3. Before anything else: confirm what the platform is doing

Do this once, and again after any plan change. It needs dashboard access.

1. Supabase dashboard → **Project → Database → Backups**. Record: is a daily backup
   schedule listed? What is the retention window? Is **Point-in-Time Recovery**
   enabled, and from what date can it restore?
2. Record the answers in §7 (Evidence log) with the date. If nothing is listed, treat
   the project as **having no backups** and use §4.2 as the only real backup.
3. Confirm the storage buckets (§4.3) and where their contents would come from.

> Do not write "backups are configured" without the dashboard evidence. This
> repository has already carried one unverified operational claim (the scheduled
> job alerting in OBS-1) for exactly that reason.

---

## 4. Taking a backup

### 4.1 Platform backup

Automatic, if the plan provides it (§3). Nothing to run. This is the fastest restore
path for a catastrophic error and the only one that can reach an arbitrary point in
time.

### 4.2 Logical backup (works on any plan, and the one to rely on if §3 is unclear)

Run from a machine with `pg_dump` (version ≥ the server's) and the project's
connection string — Supabase dashboard → **Project settings → Database →
Connection string → URI**. Keep the connection string in a password manager, never
in the repository.

```bash
# 1. Schema + data, compressed, with ownership and privileges omitted so it can be
#    restored into a fresh project without fighting Supabase's roles.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --no-owner --no-privileges --schema=public --schema=auth \
  --file="edureach-$(date -u +%Y%m%dT%H%M%SZ).dump"

# 2. Prove the archive is readable before you trust it, and keep the listing with it.
pg_restore --list edureach-*.dump > edureach-$(date -u +%Y%m%d).list.txt

# 3. Store both files somewhere that is not the machine you dumped from, and not the
#    repository. Two copies, at least one off-site.
```

Notes that matter:

- `--schema=auth` is included deliberately: student identities live there. Restoring
  `public` alone gives you profiles whose users cannot sign in.
- `--no-owner --no-privileges` avoids restore failures against Supabase's managed
  roles; grants and policies come back from the migrations and from §5.2.
- The dump is **not** encrypted by `pg_dump`. Encrypt it before it leaves the machine
  if the storage target is not encrypted at rest.
- **Never commit a dump to this repository.** Real student data must not enter git.

### 4.3 Storage (not covered by any database backup)

```bash
# Public news images — small, and covered by re-uploading from the articles if lost.
# Keep a copy of the bucket contents (Supabase CLI or dashboard download).

# Gated past-question documents — these are the ones that cannot be re-derived.
# Export the bucket on the same schedule as the database backup.
```

`scripts/prod-validate.ts` reports which buckets exist; it does not back them up.

### 4.4 Configuration

Keep an encrypted record of the production environment variables listed in
`src/lib/envContract.ts` (names only are in the repository, never values) and of the
Netlify build settings. Losing these does not lose data but does delay recovery.

---

## 5. Restoring

### 5.1 Platform restore (fastest, if available)

Supabase dashboard → **Database → Backups** → choose the point in time → restore.
The project is unavailable while this runs. Afterwards, complete §5.4.

### 5.2 Logical restore

```bash
# Into a fresh Supabase project (recommended first: prove it works somewhere that
# does not matter), then point the application at the new project's keys.
pg_restore "$TARGET_DB_URL" --no-owner --no-privileges --clean --if-exists \
  --dbname="$TARGET_DB_URL" edureach-YYYYMMDDTHHMMSSZ.dump

# Then re-apply the repository migrations, so the schema is exactly the version the
# code expects — a dump taken before a migration would otherwise restore an old
# shape into new code.
npx supabase db push        # or the SQL editor, in filename order
```

### 5.3 Schema-only rebuild (always available, no dependencies)

The repository is a complete, ordered source of the schema and is replayed by
`npm run backup:rehearsal` and `npm test`. Use it when the database is beyond
restoring but the code is intact:

```bash
npm run backup:rehearsal     # proves the migrations still build a working database
```

Applying migrations is the riskiest routine operation in
`docs/operations/PRODUCTION_RUNBOOK.md` §3; §3a there is the sync check that
confirms which of them production has actually seen.

Then reapply them to the target project in filename order. **This rebuilds structure,
not data and not student identity** — it is the path for a fresh start, not for
recovering a loss.

### 5.4 After any restore — verify before declaring success

In this order:

1. `npm run prod:validate` — environment contract, connectivity, buckets, integrity.
2. Run `supabase/ci/production-validation.sql` in the SQL editor — RLS, policies,
   grants, migration history.
3. Sign in with a real student account. **If sign-in fails, `auth` was not restored.**
4. Open `/dashboard` and confirm a request, an attempt and a notification are present.
5. Open a published article and confirm its image loads (bucket `admin-content`)
   and that a verified past-question paper opens.
6. `curl` the public API for one item of each kind: news, opportunities, CBT exams.

A restore that passes 1–2 but fails 3–6 has restored a *database*, not the product.

### 5.5 Rollback when a deploy or migration is wrong

| Situation | Action |
| --- | --- |
| Bad frontend/server deploy, database fine | Netlify → Deploys → select the last good deploy → **Publish deploy**. Immediate. |
| Bad migration applied | Prefer a *forward* fix: add a migration that repairs it. Supabase has no automatic down-migrations, and restoring the whole database to undo one column loses every write since. |
| Bad migration with data loss | Point-in-time restore to just before the migration (§5.1), then roll the application code back to the matching deploy (§5.5 row 1). |
| Migration applied twice / partially | Re-running is safe for this repository's migrations by design (they are written to be idempotent); verify with the SQL artifact, then continue. |

**Order matters in a restore:** restore the database *first*, then deploy the code
that matches its schema. Deploying first gives an application that queries columns
that do not exist yet.

---

## 6. The rehearsal — what is proven, and what is not

### Proven, and repeated by the test suite

`npm run backup:rehearsal` (`scripts/backup-rehearsal.ts`, run in CI by
`tests/backup-rehearsal.test.ts`) performs a real round trip on the PostgreSQL engine:

1. builds the production schema from the committed migrations;
2. writes representative rows, including an `auth.users` identity (the
   `handle_new_user` trigger produces its profile, which is then part of the backup);
3. takes a physical backup of the running database;
4. restores that archive into a **fresh, empty** database;
5. proves the result is the same database — identical row counts, an identical schema
   fingerprint, and **identical row-level security behaviour** when queried as `anon`;
6. proves database functions survive (the restored copy still canonicalises
   `'Scholarships & Funding'` to `scholarships`).

Last local run: **52 migrations, 5,055 KB archive, 37 tables, 406 columns, 47
policies, 37 tables with RLS — all identical after restore.**

Step 5 is the part that matters most and that a naive rehearsal skips: a backup that
restores rows but not policies is a data breach with a green tick next to it.

### Not proven — and it must not be described as proven

- **No Supabase production backup has been restored.** This sandbox has no
  credentials for the project and no dashboard access. Nothing in this repository can
  prove the platform's own backups work.
- **No storage bucket has been backed up or restored.**
- **No point-in-time recovery has been exercised.**
- **No restore has been timed**, so the RTO in §2 is a target, not a measurement.
- **The `auth` schema restore is untested** — the rehearsal uses the platform shim, not
  Supabase's real auth tables.

### The drill that closes the gap

Quarterly, and after any schema change that touches student data:

1. Create a **scratch** Supabase project (free tier is enough).
2. Restore the most recent production dump into it (§5.2).
3. Run §5.4 steps 1–2 against the scratch project.
4. Record in §7: the date, the dump's age, how long the restore took, and anything
   that did not come back.
5. Delete the scratch project.

Until that drill has been run once, the honest status is: **procedure documented,
schema-and-data round trip rehearsed, production restore untested.**

---

## 7. Evidence log

Fill this in as the work happens. An empty row is a real answer: it means the check
has not been done.

| Date | Item | Result | Evidence |
| --- | --- | --- | --- |
| 2026-10-03 | Schema + data round trip (rehearsal) | **pass** | `npm run backup:rehearsal` → 52 migrations, 5,055 KB, 37 tables / 47 policies identical after restore |
| 2026-10-03 | Supabase plan backup configuration | **NOT VERIFIED** | needs dashboard access (§3) |
| 2026-10-03 | RPO / RTO chosen | **NOT DECIDED** | business decision (§2) |
| 2026-10-03 | Storage bucket export | **NOT DONE** | needs credentials (§4.3) |
| — | First production restore drill | **NOT RUN** | needs a scratch project (§6) |
