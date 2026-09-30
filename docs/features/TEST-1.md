# Feature: TEST-1 — CI quality gate

Status: **implemented** (see Evidence). Written before the code, per
`docs/architecture/08-FEATURE-TEMPLATE.md`.

## Purpose

Make it impossible to claim that a change is verified when it is not.

The repository already had one workflow (`.github/workflows/production-checks.yml`,
job `quality-gate`) running `npm run ci`. Two things were wrong with treating it
as the gate:

1. **It did not run everything the repository had learned to check.** BASE-1's
   `npm run schema:audit` — the check that proves the migrations build the
   database the application expects — was not part of it. Neither were the
   BASE-1 tests until `npm test` picked them up by glob, which is luck rather
   than design.
2. **It proved nothing about a real database.** BASE-1 could only simulate a
   fresh apply; the definitive `supabase db reset` on an empty project was left
   as a manual dependency.

TEST-1 turns the gate into the authoritative list of required checks, makes each
one visible as its own step, adds a real Postgres replay job so BASE-1's central
claim is executed rather than asserted, and records what the gate still does not
cover.

## User

The engineer/operator merging a change, and the reviewer reading a pull request
check. Nobody using the product.

## User Flow

1. Open a pull request against `main` (or push to `main`).
2. GitHub starts **EduReach production checks**; the `quality-gate` job installs,
   typechecks, tests, audits the schema and builds; the `migration-replay` job
   applies every migration to a scratch PostgreSQL and verifies the objects the
   application needs.
3. The check turns green only when every stage passed; any failure names the
   stage that failed.
4. Locally, `npm run ci` runs the same gate (plus the browser and dependency
   steps that only make sense with a network).

## Screens

N/A — no product surface. The "screen" is the GitHub check run and the local
terminal output.

## Routes

N/A — no HTTP surface.

## Components

N/A — no frontend components.

## User Actions

N/A.

## Button Logic

N/A.

## Data

N/A — CI reads the repository; it writes nothing to Supabase. The replay job
uses a throwaway PostgreSQL container that exists for the duration of the run.

## Data Source

- Workflow: `.github/workflows/production-checks.yml`.
- Gate definition: `package.json` scripts (`ci`, and its stages).
- Scratch database: a `postgres:16` service container, plus
  `supabase/ci/platform-shims.sql` (the `auth`/`storage` surface the migrations
  reference) and `supabase/ci/verify-migrations.sql` (the post-apply assertions).

## Backend

**`npm run ci` is the single authoritative gate** and runs, in this order:

```
npm ci                     (the workflow installs; npm run ci assumes it)
npm run typecheck
npm test
npm run schema:audit
npm run build
npm run test:e2e           (browser smoke tests; needs the build)
npm run audit:ci           (npm audit --audit-level=low)
```

`npm run check` remains as an alias so existing documentation and muscle memory
keep working. The workflow executes the same stages as separate, named steps so
a failure is attributable at a glance, and `tests/ci.test.ts` fails if the two
ever disagree or if a stage disappears.

**Why E2E stays in the gate:** the browser suite already ran and passed in CI
before TEST-1 (Chromium is installed explicitly, the server boots unconfigured on
port 3100). Removing a working check would weaken the gate. It is excluded from
*this* environment's verification only because Playwright cannot download
browsers here — which is why the evidence distinguishes local from CI results.

**Why a real Postgres job:** BASE-1 shipped `npm run schema:audit`, a static
simulation. It catches reference and ordering defects but cannot catch a syntax
error, a bad constraint or a policy that Postgres refuses. The `migration-replay`
job applies every file in `supabase/migrations/` in order to an ephemeral
PostgreSQL 16, with `ON_ERROR_STOP=1`, and stops at the first failing statement
naming the file. It then verifies the objects the application actually uses.

**What the replay is not:** it is not Supabase. The platform's `auth` and
`storage` schemas are replaced by `supabase/ci/platform-shims.sql` — the same
shape our migrations reference (`auth.uid()`, `auth.users`, `storage.buckets`,
`storage.objects`) and nothing more. The job therefore proves *our* migrations
are valid SQL that applies in order to a real PostgreSQL; it does not prove a
Supabase Cloud project accepts them, and no RLS behaviour is exercised.

## Security

- No secrets: every command runs with an empty/unconfigured environment, which
  is also how the browser suite is designed to run (`webServer.env` blanks the
  Supabase variables). The replay connects to a local container with a throwaway
  password.
- `permissions: contents: read` stays on the workflow; no step needs a token.
- The replay never touches production, staging or any hosted database.
- No required check is wrapped in `|| true` or `continue-on-error`; a test asserts
  this so a future edit cannot quietly soften the gate.

## States

- **Passing**: both jobs green.
- **Failing**: the failing step names itself; the log shows which migration or
  which test failed (`replay-migrations.sh` prints the file name and the
  PostgreSQL error).
- **Cancelled**: `concurrency` cancels a superseded run on the same ref, so a
  quick follow-up push does not run the expensive jobs twice.

## Edge Cases

| Case | Behaviour |
|---|---|
| `package.json` and the lockfile disagree | `npm ci` fails, before any check runs |
| A new test needs a Supabase credential | It fails in CI rather than skipping: the gate runs unconfigured on purpose |
| A migration is added that references an object nobody creates | `schema:audit` (static) and the replay job (real SQL) both fail, with the file name |
| A migration is syntactically invalid | The replay fails with the PostgreSQL error; the static audit may not notice |
| A migration is applied twice by the replay | Impossible: the job starts from an empty database every run |
| Playwright browser download fails | The E2E step fails loudly — no retry, no skip |
| A newly published advisory trips `npm audit` | The gate fails; that is intentional at `--audit-level=low`. The remedy is to fix or bump, not to downgrade the check |
| A run is superseded by a newer push | Cancelled, not left pending |
| Fork pull request | Workflow needs no secrets, so it runs like any other |

## Analytics

N/A — no product events.

## Notifications

N/A — GitHub's own check notifications. No application notification is involved.

## Testing

`tests/ci.test.ts` (new, static assertions — GitHub validates the YAML itself):

- the authoritative gate script in `package.json` contains every required stage
  (`typecheck`, `test`, `schema:audit`, `build`), in the required order;
- the workflow installs with `npm ci` (never `npm install`), uses
  `node-version-file: .nvmrc`, and contains every required check as its own step;
- the workflow triggers on `pull_request` and on `push` to `main`;
- no required step uses `continue-on-error: true`, `|| true`, `set +e` or
  `--if-present`;
- the replay job points at `scripts/replay-migrations.sh` and the shim/verify SQL
  files exist;
- `.nvmrc`, `package.json#engines` and `netlify.toml` agree on the Node major.

Deliberately not tested: YAML syntax and GitHub's own interpretation of the
workflow (GitHub reports those directly on the check run).

## Evidence

See the Evidence section at the end of this file.
