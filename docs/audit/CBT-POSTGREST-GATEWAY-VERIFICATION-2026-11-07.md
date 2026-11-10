# Local Supabase/PostgREST gateway verification — 2026-11-07

**POSTGREST GATEWAY NOT VERIFIED — SYNTHETIC COMPATIBILITY TESTS ONLY**

The answer gateway, v2 fence, submission seal and page-writer block were preserved. No hosted Supabase project, production data, deployment, merge or hosted migration was touched.

## Real local stack prerequisite check

The checkout has no existing `supabase/config.toml` and this environment initially had no Supabase CLI, `docker`, `podman`, `nerdctl`, `containerd`, `postgrest`, or Docker/Podman socket on the checked paths. For an isolated check only, Supabase CLI 3.0.0 was installed under `/tmp/cbt-supabase-cli` from the npm registry, and an empty temporary project was initialized under `/tmp/cbt-supabase-stack-check`. No temporary CLI/config artifacts are part of the repository.

```
env -i PATH="$PATH" HOME="$HOME" npm install --prefix /tmp/cbt-supabase-cli --no-audit --no-fund supabase@3.0.0
env -i PATH="$PATH" HOME="$HOME" /tmp/cbt-supabase-cli/node_modules/.bin/supabase init --workdir /tmp/cbt-supabase-stack-check
env -i PATH="$PATH" HOME="$HOME" /tmp/cbt-supabase-cli/node_modules/.bin/supabase start --workdir /tmp/cbt-supabase-stack-check
```

`init` succeeded. `start` exited 1: **`docker: command not found (podman also not found)`**. No real local Auth, PostgREST or Supabase PostgreSQL services started, and no application migrations were applied to a Supabase stack. A usable Docker/Podman runtime and accessible local service images are prerequisites. The sandbox's outbound network is limited to the approved GitHub and package-registry hosts, so service-image registry access is not established. A standalone embedded PostgreSQL engine is present but is not a Supabase stack.

Therefore real Auth sign-in/JWT validation, real PostgREST JWT-to-role/claim assignment, direct PostgREST invocation, and real Supabase ownership/role/RLS behavior were **not tested**. The earlier local compatibility HTTP rehearsal uses a hand-written local Auth/JWT and PostgREST gateway; its CBT responses and role enforcement come from real PostgreSQL, but it must not be represented as real Supabase/PostgREST evidence.

## Actual disposable PostgreSQL role and rollback checks

```
env -i PATH="$PATH" HOME="$HOME" node scripts/rehearse-cbt-protocol-fence.mjs /tmp/cbt-reconstruction-tools/node_modules/embedded-postgres/dist/index.js
```

The isolated private-Unix-socket PostgreSQL run applied all 82 actual migrations against the repository's Supabase platform shims, then passed:

- Catalog checks for the wrapper's `SECURITY DEFINER`, `cbt_v2_answer_gateway` owner, empty `search_path`, NOLOGIN/NOINHERIT role, and lack of ordinary-role membership. The internal answer function is owned by `cbt_v2_executor`, also `SECURITY DEFINER` with empty `search_path`. Both attempt and ledger RLS are enabled.
- `authenticated` can execute the narrow wrapper; `anon` and `service_role` cannot. The gateway role can execute the internal answer RPC but not finalization, start or transition; it has no direct attempt/ledger table privilege. Ordinary authenticated/service roles cannot execute the internal answer RPC. The internal `cbt_v2_client` retains its restricted answer/finalize grants; application roles are not members in this local role graph. Executor policies grant the definer access needed for the inner operation.
- Gateway rollback first refuses an added gateway-role membership and rolls back its revoke atomically. Once membership is removed, the actual rollback removes the wrapper; internal answer/finalize grants remain unchanged. A v2 draft/operation ledger and a legacy attempt retain the same database row values, and the legacy submitted-result RPC still replays.
- Reapplying the actual migration **after rollback** succeeds; the original answer operation replays without data change. Applying it again while the role exists deliberately fails closed, rather than being idempotent. After draining synthetic v2 fixtures, the gateway, lifecycle and protocol rollbacks were exercised in order. In-flight destructive rollback safety remains unproven; quiesce traffic before any separately approved rollback.

These are direct SQL tests against disposable PostgreSQL. They set synthetic request identity for local database fixtures and do **not** demonstrate real JWT validation or actual PostgREST `auth.uid()` behavior. Function-owner privileges and role membership may differ on hosted Supabase; the migration requires role-creation/ownership permissions that have not been verified there.

## Credential boundary and outstanding verification

The gateway migration introduces no credential; the server obtains Supabase service credentials from server-only environment configuration and uses the caller's user-scoped token for the wrapper. A scan of this local unconfigured client build found public `sb_secret_` *format-check* strings but did not establish actual production secret exposure or absence. Real deployment configuration and client output still require independent secret-exposure review; do not treat string markers alone as credentials or a security proof.

When a genuinely disposable local Supabase stack is available, use real Auth-issued user tokens through actual PostgREST and the actual migrations to test JWT rejection, `auth.uid()` binding, wrong-owner and attempted user-ID overrides, legacy/v2 isolation, replay/conflict, direct inner-RPC denial, role/RLS grants and finalization denial. Repeat the rollback/data-preservation checks with that stack and separately verify hosted role graphs only after authorization. The existing protected programme/reconstruction documents remain unchanged.

The finalization HTTP path stays closed. The privileged `cbt_v2_client` role still has the existing internal finalizer grant; no application runtime membership is created by these migrations, and it must not be granted until a server-enforced registered-device recovery barrier and policy exist. Multi-device recovery remains unresolved; no browser-local seal can reveal unregistered offline work.

## Regression results

- `npm run typecheck`, `npm test` (**875/875**), `npm run build`, and `npm run perf:audit` passed. The local, unconfigured preview build measured **343,463 / 344,064 JavaScript gzip bytes** (gzip level 6).
- `LD_LIBRARY_PATH=/tmp/cbt-v2-libs/lib PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e`: **248 passed / 20 skipped**. Eighteen skips are nine configured-client service cases in each desktop/mobile project; two are accessibility cases with no live exam. `npm run e2e:perf` with the same environment: **1 passed**.
- The compatibility HTTP rehearsal also passed, but its local Auth/JWT and PostgREST compatibility services are synthetic; it is not a real Supabase or real PostgREST test.
- `git diff --check`, `node --check scripts/rehearse-cbt-protocol-fence.mjs`, and `npm run migrations:checklist` passed. Protected programme/reconstruction SHA-256 values remained `c323ad855c168bd040a7f6035d42a31691ce04956cfbc757e7735c558d4c3923` and `d83fe8abbed62cc505efbc4f1f7e6c4fa0b057bdc1d7b2e595add10c2e307245`.
