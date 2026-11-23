# Environment variables and their classification

Every variable the application reads is declared once, in
[`src/lib/envContract.ts`](../src/lib/envContract.ts), with a security class, the
scope it belongs in and the file that consumes it. This page is the human-readable
view of that table. It contains **names and rules only — never values**. Values
live in the deployment platform and in a local `.env` that is never committed.

`.env.example` and `.env.production.example` carry placeholders only.

## The five classes

| Class | Meaning | May reach a browser bundle? | May be in a public repository? |
|---|---|---|---|
| `PUBLIC` | Deliberately published: project origin, publishable key, site origin. | Yes | Yes (it ships in the bundle anyway) |
| `PRIVATE` | Deployment configuration that is not a credential: ports, feature flags, thresholds, CI targets. | No | Names yes, values no |
| `SECRET` | A credential. Compromise requires rotation. | **Never** | **Never** |
| `SENSITIVE_OPERATIONAL` | Real-world identity or access detail that is not a credential: the admin bootstrap address, the mail sender, an ingest DSN. | **Never** | **Never** |
| `DEVELOPMENT_ONLY` | Rehearsal and test switches. Never set in production. | No | Names yes |

Scope says where a value is needed at runtime:

- `build` — read while the bundle is produced (Vite inlining, build guards);
- `runtime` — read by the long-running server;
- `function` — read by a serverless function only; scope it to those functions and
  keep it out of the build environment;
- `ci` — GitHub Actions or a local rehearsal, never a deployment.

## The table

| Variable | Class | Scope | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | PUBLIC | build | Inlined into the bundle. The project origin is public by definition. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | PUBLIC | build | Publishable/anon key. RLS is the control, not secrecy. |
| `VITE_SUPABASE_ANON_KEY` (alias) | PUBLIC | build | Pre-rename name for the same key. Still accepted. |
| `EDUREACH_PUBLIC_SUPABASE_URL` (alias) | PUBLIC | build | Fallback for a host that cannot un-flag the VITE_ variable as secret. |
| `EDUREACH_PUBLIC_SUPABASE_KEY` (alias) | PUBLIC | build | Same, for the key. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` (aliases) | PUBLIC | runtime | Server-side fallbacks; not proof that the browser is configured. |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | runtime / function | Bypasses RLS. Server only. Rotating it is an incident procedure. |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | **SENSITIVE_OPERATIONAL** | function | An administrative control and a real person's address. Not a credential; still never in the build or a document. |
| `SENTRY_DSN` | **SENSITIVE_OPERATIONAL** | runtime | Ingest credential. Never inlined into a bundle. |
| `EDUREACH_SITE_URL`, `EDUREACH_NEWSROOM_USER_AGENT`, `PROBE_BASE_URL`, `EDUREACH_SMOKE_URL` | PUBLIC | runtime / ci | Public origins and crawler identification. |
| `NODE_ENV`, `PORT`, `OBS_SLOW_REQUEST_MS`, `SENTRY_MAX_EVENTS_PER_HOUR`, `SENTRY_MAX_EVENTS_PER_DAY`, `CBT_LEGACY_SCHEMA`, `EDUREACH_REQUIRE_CLIENT_ENV`, `EDUREACH_ALLOW_UNCONFIGURED_CLIENT`, `UPTIME_READINESS_STRICT`, `UPTIME_TIMEOUT_MS` | PRIVATE | runtime / build / ci | Configuration, not credentials. |
| `DISABLE_HMR`, `STAGING_PROJECT_REF`, `CBT_V2_LOCAL_REHEARSAL`, `CBT_V2_TEST_IMPORT`, `CBT_HTTP_BROWSER`, `INSTITUTION_IMPORT_ENV` | DEVELOPMENT_ONLY | build / ci | Rehearsal switches. Never set in production. |

Not every credential in the running system is an environment variable. The
transactional mail credential and the Google OAuth client secret live in the
Supabase Auth project settings, server-side, and are never read by this
application — so they are not in this table and must not be added to it.

## Invariants asserted in CI

`validateEnvContract()` runs in `scripts/security-scan.ts` (part of `npm run build`
and `npm run ci`) and in `tests/security-boundary.test.ts`:

1. no `SECRET` or `SENSITIVE_OPERATIONAL` variable is declared client-visible;
2. every `VITE_` name is classified `PUBLIC` (Vite inlines it, whatever the author
   intended);
3. no credential-sounding name (`…_SECRET`, `…_SERVICE_ROLE_KEY`, `…_PASSWORD`,
   `…_ADMIN_BOOTSTRAP_EMAIL`, `…_CLIENT_SECRET`) is classified `PUBLIC`;
4. `secret` and `classification` agree;
5. every variable names the code that consumes it, and no name is declared twice.

## What is checked before a deployment

| Check | Command | Fails on |
|---|---|---|
| Client configuration | `tsx scripts/client-env-check.ts` (first step of `npm run build`) | a credential or credential-named variable in client-exposed configuration |
| Published artefacts | `tsx scripts/dist-secret-scan.ts` (inside `npm run build`) | a credential pattern, a server-only value, or a forbidden file (`.env`, source map, dump, SQL) in `dist/` |
| Repository and history | `npm run security:scan` / `npm run security:check` | a credential pattern in a tracked file or in any commit, not covered by a narrow allowlist entry |
| Contract | `npm run security:scan` | a classification violation above |

Allowlisted findings live in [`.security/secret-scan-allowlist.json`](../.security/secret-scan-allowlist.json),
scoped to a rule and a path, each with a written reason, and each still printed on
every run. Whole directories are never excluded.
