# Feature: TEST-1 — CI quality gate

Status: **implemented** — the gate is authoritative in CI and includes a
real-PostgreSQL migration replay. One workflow-file improvement could not be
pushed with the current automation token and is recorded under Limitations.
Written before the code, per `docs/architecture/08-FEATURE-TEMPLATE.md`.

## Purpose

Make it impossible to claim that a change is verified when it is not.

The repository had one workflow (`.github/workflows/production-checks.yml`, job
`quality-gate`) running `npm run ci`, and that workflow did run and pass. Two
things were still wrong with treating it as *the* gate:

1. **It did not run everything the repository had learned to check.** BASE-1's
   `npm run schema:audit` — the check that proves the migrations build the
   database the application expects — was not part of `npm run ci`.
2. **Nothing ever applied the migrations to a real database.** BASE-1 could only
   simulate a fresh apply statically; the definitive run against an empty
   PostgreSQL was left as a manual dependency. A static audit cannot see a
   syntax error, and one was hiding in the history.

TEST-1 makes `npm run ci` the authoritative list of required checks, adds those
two missing checks to it, and records precisely what the gate still does not
cover — including one improvement that the automation token cannot push.

## User

The engineer/operator merging a change, and the reviewer reading a pull request
check. Nobody using the product.

## User Flow

1. Open a pull request against `main` (or push to `main`).
2. GitHub starts **EduReach production checks**. The `quality-gate` job runs
   `npm ci`, installs Chromium, then runs `npm run ci`, which typechecks, runs
   the whole test suite (including the real-PostgreSQL migration replay), audits
   the migration history, builds for production, runs the desktop/mobile browser
   suite, and audits dependencies.
3. The check turns green only when every stage passed. A failure is attributable:
   `npm` prints the failing script name, and within the replay and the browser
   suite the failing migration/test names itself.

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

N/A — CI reads the repository; it writes nothing to Supabase. The replay uses an
in-process throwaway database that exists for the duration of the test.

## Data Source

- Workflow: `.github/workflows/production-checks.yml`.
- Gate definition: `package.json` (`ci`, and the stages it calls).
- Replay engine: `@electric-sql/pglite` (PostgreSQL compiled to WebAssembly),
  a dev dependency, no server and no network.
- Supabase surface for the replay: `supabase/ci/platform-shims.sql`.
- Post-apply assertions: `supabase/ci/verify-migrations.sql`.

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

`npm run check` remains as an alias. `tests/ci.test.ts` fails if a required stage
disappears from the gate, if the workflow stops executing the gate, if a check is
softened (`continue-on-error`, `|| true`, `--if-present`), if `npm install`
replaces `npm ci`, or if the Node major drifts between `.nvmrc`,
`package.json#engines` and `netlify.toml`.

**Why E2E stays in the gate:** the browser suite ran and passed in CI before
TEST-1 (Chromium is installed explicitly; the server boots unconfigured on port
3100). Removing a working check would weaken the gate. It is excluded from *this*
environment's verification only because Playwright cannot download browsers here,
which is why the evidence separates local runs from CI runs.

**The real PostgreSQL replay — how and why.** `tests/migrations.test.ts`:

1. starts a real PostgreSQL engine in-process (`@electric-sql/pglite`; version
   0.5.8 bundles PostgreSQL 18.3) and asserts `select version()` reports a real
   PostgreSQL ≥ 16;
2. applies `supabase/ci/platform-shims.sql` — roles, `auth.users`, `auth.uid()`,
   `auth.role()`, `auth.jwt()`, `storage.buckets`, `storage.objects`, plus the
   grants the migrations make;
3. applies **every** file in `supabase/migrations/` in filename order, and on
   failure reports the filename and the PostgreSQL error;
4. runs `supabase/ci/verify-migrations.sql`, which asserts that the objects the
   application actually uses exist: 35 public tables, 23 functions, the expected
   columns, RLS enabled on the policy-backed tables, and a trigger on
   `auth.users` running `public.handle_new_user()`.

Because this runs inside `npm test`, it gates every `npm run ci` — locally and in
CI — with no container service and no workflow change. It immediately earned its
keep: see the Error found in the Evidence section.

**Why not a `postgres:16` service job.** That was the original design (and the
job exists in the unpublished workflow improvement below). The automation token
for this branch cannot write `.github/workflows/`, so a service job could not be
delivered at all. An in-process engine delivers the same guarantee — real
PostgreSQL parsing and execution of every migration — on every developer machine
as well as in CI, in ~5 seconds, offline. The trade-off is that it is a
single-user instance: it does not exercise concurrent connections or RLS as a
non-superuser.

**What the replay is not.** It is not Supabase Cloud. `auth` and `storage` are
our shims, no hosted project is contacted, and policies are created but never
executed as a restricted role. It proves our SQL is valid and applies in order
to a real PostgreSQL engine; it does not prove a Supabase project accepts it.

## Security

- No secrets: every command runs with an empty/unconfigured environment, which is
  also how the browser suite is designed to run (`webServer.env` blanks the
  Supabase variables). The replay needs no credentials at all.
- `permissions: contents: read` stays on the workflow; no step needs a token.
- The replay never touches production, staging or any hosted database.
- No required check is wrapped in `|| true` or `continue-on-error`; a test asserts
  this so a future edit cannot quietly soften the gate.

## States

- **Passing**: `quality-gate` green.
- **Failing**: `npm` names the failing stage; the replay prints the migration
  filename and the PostgreSQL error; Playwright prints the failing spec.
- **Cancelled**: not implemented — the deployed workflow has no `concurrency`
  block (the improvement that adds it is documented below).

## Edge Cases

| Case | Behaviour |
|---|---|
| `package.json` and the lockfile disagree | `npm ci` fails, before any check runs |
| A new test needs a Supabase credential | It fails in CI rather than skipping: the gate runs unconfigured on purpose |
| A migration is added that references an object nobody creates | `schema:audit` (static) and the replay (real engine) both fail, naming the file |
| A migration is syntactically invalid | The replay fails with the PostgreSQL error; this happened for real — `20260926220000` (Evidence) |
| A dollar-quoted block reuses its own tag | The replay fails: the inner delimiter closes the outer block. Fixed in `20260926220000` |
| A migration is applied twice by the replay | Impossible: each test run starts from an empty database |
| Playwright browser download fails | The E2E step fails loudly — no retry, no skip |
| A newly published advisory trips `npm audit` | The gate fails; that is intentional at `--audit-level=low`. Fix or bump, do not downgrade |
| Fork pull request | Workflow needs no secrets, so it runs like any other |

## Analytics

N/A — no product events.

## Notifications

N/A — GitHub's own check notifications. No application notification is involved.

## Testing

`tests/ci.test.ts` (static assertions; GitHub validates the YAML itself):

- `npm run ci` contains every required stage (`typecheck`, `test`,
  `schema:audit`, `build`) in order, and ends with build → E2E → dependency audit;
- the workflow executes every required stage — either by delegating to
  `npm run ci` (today) or by enumerating them (with named steps), never neither;
- the workflow installs with `npm ci` (never `npm install`) and triggers on
  `pull_request` and `push` to `main`;
- no required step uses `continue-on-error`, `|| true`, `set +e` or
  `--if-present`;
- the replay files exist, are wired into `npm test`, and the replay engine is a
  declared dev dependency;
- `.nvmrc`, `package.json#engines` and `netlify.toml` agree on the Node major.

`tests/migrations.test.ts` (the replay itself, two tests): every migration
applies in order to a real PostgreSQL ≥ 16, and the applied schema satisfies
`supabase/ci/verify-migrations.sql` (plus a floor of 35 public tables).

Deliberately not tested: YAML syntax and GitHub's interpretation of the workflow
(GitHub reports those on the check run); RLS enforcement as a non-superuser role;
anything requiring live Supabase credentials.

## Evidence

**Local gate (this machine, Node v22.22.3, npm 10.9.8).** `npm run typecheck`
clean; `npm test` 239/239; `npm run schema:audit` exits 0 ("no blocking
findings"); `npm run build` succeeds. `npm run test:e2e` cannot run here —
Playwright browser downloads are blocked in this sandbox — and is marked as such
rather than reported as passing; it runs in CI.

**The error the static gate could not see.** The first real-engine run applied
37 of 38 migrations and stopped at
`20260926220000_admin_full_catalogue_opportunities.sql` with
`syntax error at or near "{"`. The file opened a `do $$` block and then declared
`mapping jsonb := $$` for its JSON literal — the inner `$$` terminated the outer
block, so the file could not parse on any PostgreSQL, including Supabase. The
static `schema:audit` (correctly, for what it is) reported no blocking findings,
because it never feeds the SQL to a parser. Fixed in that file by giving the
literal its own tag (`$mapping$`); the migration's intent and effects are
unchanged. After the fix: 38/38 applied, `verify-migrations.sql` passes, 35
public tables. Engine reported by `select version()`: `PostgreSQL 18.3 (PGlite
0.5.8)`.

**CI.** The workflow is active. Runs observed with `gh run list`:

| Run | Commit | Result |
|---|---|---|
| 36774149773 | earlier PR #11 commit | success (1m56s) |
| 36775905085 | `f67f01b` (BASE-1) | success (1m59s) — gate steps: install, Chromium, "Run authoritative CI gate" |
| 36777106149 | `b732752` | **failure** at the gate step after 16s |

Run 36777106149 is honest evidence that the gate is not cosmetic: that commit
pushed a version of `tests/ci.test.ts` that asserted the *planned* workflow
shape, which the deployed workflow cannot have — `npm test` therefore failed in a
clean checkout (reproduced: `git clone` of that commit + `npm test` → 5 failures)
and the gate refused it. A follow-up commit fixes the tests to assert the
guarantee ("the workflow runs every required stage") instead of the file layout.

**Branch protection — verified vs configured.** `gh api
repos/1436799528/EduReach_Hub/branches/main/protection` returns
`403 Resource not accessible by integration`; `gh api .../rulesets` returns `[]`;
`actions/permissions` is also 403. So: the workflow **exists and runs** (verified),
and "the `quality-gate` check is required before merge" is **not verified** from
here. The manual setting to apply in the repository: *Settings → Branches → Add
branch protection rule* (or edit the rule for `main`) → *Require status checks to
pass before merging* → select **`quality-gate`**.

**Workflow-file limitation (why the deployed workflow still has one big step).**
The automation token's GitHub App installation lacks the `workflows` permission:

```
! [remote rejected] ... (refusing to allow a GitHub App to create or update
  workflow `.github/workflows/production-checks.yml` without `workflows` permission)
```

and the same change through the Contents API returns
`403 Resource not accessible by integration`. A prepared improvement — separate
named steps (Typecheck / Tests / Schema audit / Production build / Browser tests
/ Dependency audit), `node-version-file: .nvmrc`, `concurrency` to cancel
superseded runs, and a `migration-replay` job on a `postgres:16` service
container — could not be committed. It is optional, not missing functionality:
the replay already runs inside `npm test`, which the deployed workflow executes.
Applying it needs a token with `workflows` permission (or a person with write
access to `.github/workflows/`, e.g. via the GitHub UI editor).

**Known limitations (not covered by the gate):**

1. No `supabase db reset` against a Supabase project, and no Supabase-specific
   behaviour (extensions, dashboard-applied configuration, real JWT issuance).
   The gate says: *CI verifies schema consistency through `schema:audit` and
   applies every migration to a real PostgreSQL engine, but does not claim to
   execute `supabase db reset` against a Supabase project.*
2. No RLS enforcement as a non-superuser role — policies are created and their
   existence is asserted, not exercised.
3. Browser tests do not run in this sandbox (downloads blocked); they do run in
   CI.
4. No deployment smoke: the Netlify build, redirects and functions are not
   exercised by this gate.
5. Branch protection is unverified from here — see the manual setting above.
6. Anything needing live Supabase credentials is out of scope by design: the gate
   runs unconfigured.
7. The workflow YAML itself cannot be updated with this automation token.

**Required verification before calling a change done.**

- Locally: `npm ci && npm run ci` (or, without browsers: `npm run typecheck &&
  npm test && npm run schema:audit && npm run build && npm run audit:ci`).
- In CI: the `EduReach production checks` workflow's **`quality-gate`** check on
  the pull request, green on the exact commit being merged.
