# CBT real Supabase integration rehearsal

**Status: prepared for the session lease schema, not verified on a real Supabase stack.** Local Docker/Podman is unavailable in the current workspace. Review the runner before use; direct PostgreSQL and synthetic compatibility rehearsals are not Auth, JWT or PostgREST evidence.

## Audit and minimal change

| Existing component | Classification / behavior | Gap / minimal solution | Impact and verification |
| --- | --- | --- | --- |
| Gateway, fence, lifecycle and session migrations | Reuse unchanged; session-aware answer-only wrapper and restricted internal RPCs | Real HTTP/JWT path not yet proven; the session rollback is only tested for refusal with existing history | Actual Auth/PostgREST assertions and DB state/grant checks; no global v2 or finalization grant |
| `rehearse-cbt-protocol-fence.mjs` | Reuse as separate local SQL evidence | Synthetic roles/claims cannot prove Auth or PostgREST | Remains separate, not called by the real runner |
| Prior HTTP compatibility rehearsal | Preserve, not reuse as proof | Synthetic gateway/Auth is not Supabase | No fallback or substitute server in this suite |
| Staging runbook and migration checklist | Extend with this target-specific checklist | Need identity, backup, duplicate-version reconciliation and authorization | Fail-closed configuration and operator attestations; no automatic migration push |
| Page writer, IndexedDB seal and finalization | Preserve unchanged | Multi-device recovery remains unresolved | The runner creates only disposable SQL fixtures; no rollout or production readiness claim |

## What this does

`scripts/rehearse-cbt-real-supabase.mjs` uses real Supabase Auth, PostgREST and direct PostgreSQL. It creates two disposable Auth users and an invoker identity observer, a fixture exam, and v2 and legacy attempts. It tests JWT validation, session acquisition, takeover, stale-session denial, ownership, answer replay and stale revision, legacy isolation and denial of internal answer/finalization operations. It runs the actual session rollback expecting transactional refusal while session history exists, then cleans its exact fixtures. It does not exercise a successful rollback/reapply; the separate disposable PostgreSQL rehearsal covers that path, not real PostgREST. If the rollback unexpectedly commits or its outcome is uncertain, the runner attempts to restore the session migration and requires independent recovery review.

The suite tests internal finalization denial through PostgREST, not the Express finalization route. It does not push migrations, change the migration ledger, enable v2 globally or authorize finalization. It does not prove disconnected devices have no local work or establish staging or release readiness.

## Mandatory checklist before any run

1. Obtain a **separate dedicated, empty, quiesced disposable** local Supabase stack, or a dedicated disposable staging project with **separate explicit authorization** for these hosted mutations and rollback. Never use production, a shared development project, a tunnel to another system, or a live database. The runner rejects the repository's known production ref and insists on loopback for local, and matching direct project hosts plus full TLS verification for staging. These checks and system ID do not independently prove disposability. The operator must verify identity and isolation out of band, disable traffic/jobs and prevent concurrent users, and keep it isolated until cleanup and review are complete. The runner requires zero Auth users, CBT attempts and operations at entry and rechecks before rollback; this is not a lock against new activity.
2. Take and **test-restore** a backup for the target, record the verified recovery procedure and obtain explicit rollback approval. A crash, lost connection, role/ownership difference or failed cleanup can leave schema, users or fixtures behind. Do not reopen traffic on failure. IDs are printed on failure for targeted review; never broadly delete by prefix. Independently check the observer, test users, exam/attempts, function, owner, grants, PostgREST cache and ledger. If restoration is uncertain, restore from the verified backup under the approved runbook.
3. Prepare the migrations only under the target's separate approved procedure, not with this script. Reconcile all current migration files and `supabase/ci/production-validation.sql`, including fence `20261107120000`, lifecycle `20261107130000`, gateway `20261107140000` and writing sessions `20261107150000`; independently verify the migration ledger, actual schema, function bodies, role graph and grants against the reviewed files. **Important:** older migration filenames share version prefixes (for example `20260903`); a version-only ledger cannot prove each such file was applied. The runner checks that every distinct local version appears in the Supabase ledger and checks selected function/grant facts, but cannot prove all individual duplicate-version files or migration contents. Require independent file-level evidence, resolve any migration-history discrepancies using an approved procedure, then set the migration acknowledgement. Do not fabricate ledger entries to pass the test.
4. Ensure Auth signup, password login, service-admin confirmation/deletion and PostgREST are real and available; the JWT signing/verification configuration must agree across Auth and PostgREST. Configure disposable Auth to accept the reserved `example.invalid` addresses and prevent outbound email to real people (e.g. local mail capture or explicitly disabled confirmation mail). If the provider rejects these addresses or signups are disabled, the suite fails; do not replace them with real addresses. The service key must map to `service_role` in PostgREST. Never paste keys, JWTs or database URLs into chat, logs, repository files, shell history or issue reports.
5. Independently obtain the intended PostgreSQL system identifier on the target with a separately reviewed direct connection. For example, with `psql` configured to prompt for a password and to verify the server certificate for staging, run `select system_identifier::text from pg_control_system();` and record it privately. Access may be restricted on managed Supabase: lack of this permission, inability to verify TLS, lack of direct DB access/DDL/role-assumption privileges, or an inability to create the test-only observer are **blockers**, not reasons to bypass checks. No application role membership is added. The admin must be able to `SET LOCAL ROLE cbt_v2_executor` without adding memberships and perform the authorized gateway DDL.
6. Use a trusted isolated shell and `env -i`; shell/Node preload hooks and proxy variables can run or redirect requests before application checks. Never use a loopback port forwarded to hosted infrastructure. The runner uses the existing project `@supabase/supabase-js` and a separately installed trusted `pg` driver; it does not modify the project dependency lockfile. Example installation in a temporary directory: `npm install --prefix /tmp/cbt-real-pg --no-audit --no-fund pg@8.16.3` (review the package and supply chain first). The PostgreSQL module path below must point to its `lib/index.js`.

## Operator commands (do not run until every prerequisite is met)

Supply the actual secrets and system identifier in private environment variables with the same `CBT_REAL_*` names shown below, without putting their values on a command line or in shell history. All required variables are passed into the clean child environment; values are deliberately not echoed. Environment variables can still be visible to privileged users or process inspection, so use a trusted host and clean them afterward.

```sh
# Local real stack; the database URL must use 127.0.0.1, an explicit port,
# database postgres and an explicit DB user. URL-encode password characters.
# The API URL must be http://127.0.0.1:<port> without a path.
env -i PATH="$PATH" HOME="$HOME" \
  CBT_REAL_TARGET=local \
  CBT_REAL_DISPOSABLE_ACK=DEDICATED_EMPTY_DISPOSABLE_PROJECT \
  CBT_REAL_ROLLBACK_ACK=BACKUP_VERIFIED_AND_ROLLBACK_AUTHORIZED \
  CBT_REAL_MIGRATIONS_ACK=RECONCILED_ALL_MIGRATION_FILES_AND_DUPLICATE_VERSIONS \
  CBT_REAL_SUPABASE_URL="$CBT_REAL_SUPABASE_URL" \
  CBT_REAL_DATABASE_URL="$CBT_REAL_DATABASE_URL" \
  CBT_REAL_DB_SYSTEM_ID="$CBT_REAL_DB_SYSTEM_ID" \
  CBT_REAL_ANON_KEY="$CBT_REAL_ANON_KEY" CBT_REAL_SERVICE_KEY="$CBT_REAL_SERVICE_KEY" \
  CBT_REAL_PG_MODULE=/tmp/cbt-real-pg/node_modules/pg/lib/index.js \
  node scripts/rehearse-cbt-real-supabase.mjs
```

For an **explicitly authorized** disposable hosted staging project, use the same command but set `CBT_REAL_TARGET=staging`, and pass additionally:

```sh
  CBT_REAL_STAGING_REF="$CBT_REAL_STAGING_REF" \
  CBT_REAL_HOSTED_AUTHORIZATION=SEPARATELY_AUTHORIZED_HOSTED_TEST_AND_ROLLBACK \
```

The staging URL must be exactly `https://<ref>.supabase.co`; the DB URL must use the corresponding direct `db.<ref>.supabase.co` host, the `postgres` database and `?sslmode=verify-full`. Poolers, custom domains, local proxies/tunnels, query overrides and the known production ref are intentionally rejected. `<ref>` is independently verified with the project owner; it is not proof of environment isolation. If the managed project cannot satisfy these gates, stop and review a safe alternative; do not weaken them.

The runner exits nonzero for missing configuration, unexpected grants, missing migration versions, connectivity/permission errors, mismatched identities, JWT failures, wrong response/state, rollback/reapply issues or failed cleanup. It intentionally suppresses raw driver/SDK errors because they may contain credentials. Investigate securely without pasting secret-bearing diagnostics into logs. A `PASS` is valid only for the reviewed target and that specific run, not other projects.

## Local preparation checks, not integration evidence

```sh
node --check scripts/cbt-real-supabase-safety.mjs
node --check scripts/rehearse-cbt-real-supabase.mjs
node --test scripts/tests/cbt-real-supabase-safety.test.mjs
env -i PATH="$PATH" HOME="$HOME" node scripts/rehearse-cbt-real-supabase.mjs
# The final command must fail nonzero at preflight when configuration is absent.
```

The standalone tests cover configuration refusal and do not simulate Auth or PostgREST. Separately, the earlier disposable real-PostgreSQL rehearsal applied 82 migration files and exercised grants/rollback with synthetic identities; it is **local database evidence only**. On 2026-11-07, preparation checks passed: 6 standalone safety tests, 875/875 unit, typecheck, schema and RLS audits, and the 82-file checklist. A connection to an unused loopback port failed closed at database preflight. The prior full regression had 248 browser passed and 20 skipped (18 need configured-client fixtures, 2 need a live exam), mobile performance 1 passed, and 343,463 / 344,064 compressed JavaScript bytes; browsers and build were not rerun during this documentation/standalone-runner change. These results are not a replacement for actual Supabase or current CI/staging verification.

**REAL SUPABASE INTEGRATION PENDING — LOCAL DATABASE CHECKS ONLY**
