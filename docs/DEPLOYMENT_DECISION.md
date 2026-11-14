# Deployment architecture — decision record

Status: **Netlify confirmed; repository configuration restored 13 November 2026; the hosted site still needs its build and environment settings before it can publish**
Date: 30 September 2026
Owner: EduReach maintainer

## Context

The 30 September 2026 audit found an inconsistency it could not resolve from the
repository alone:

- the repository is configured for **Netlify** — `netlify.toml` (build, publish
  `dist`, functions directory, `/api/*` redirect, SPA fallback),
  `netlify/functions/api.ts` (Express wrapped with `serverless-http`),
  `netlify/functions/daily-news-refresh.ts` (scheduled `@daily`),
  `public/_headers` (production security headers) and
  `docs/NETLIFY_PRODUCTION_SETUP.md` (environment variables, bootstrap email);
- the last commit status the audit could see reported a **Vercel** deployment
  check.

Both cannot be the production target. This record states what the repository
assumes today, what would have to change for the alternative, and how to close
the question. It does not change any configuration — that is the maintainer's
call, and the audit explicitly asked for the choice to be made explicitly rather
than by drift.

## Update — 13 November 2026 (UX-4 production audit)

The 30 September audit described `netlify.toml` and
`netlify/functions/api.ts` as present. They were not in the repository: Netlify
had no build command or publish directory, every deploy failed in about 25
seconds, and the published site stayed on deployment `6ad32026` (commit
`e38e54b`, 17 October 2026).

Both files are now committed. `netlify.toml` sets `npm run build`, publishes
`dist`, points at `netlify/functions`, and rewrites `/api/*`, `/robots.txt` and
`/sitemap.xml` to the Express function before the SPA fallback. The function is
the legacy `handler` export that `serverless-http` requires; a v2 `config.path`
was deliberately not mixed with it.

Two operator actions remain outside the repository:

1. Netlify site `aa0aef85-2371-48ec-9569-3dcacb7cfe47` still reports
   `build_settings: {}`. Config-as-code should supply the build values on the
   next deploy, but the site must be checked after that deploy.
2. Production deploys run with `CONTEXT=production`, so
   `scripts/client-env-check.ts` fails the build unless `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` are set for the build, and the function needs
   `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) at runtime. These
   values cannot be verified from the repository.

The Vercel project is not a working fallback: its deployment is protected and
`vercel.json` has no `/api` route, so every API request would be rewritten to
`index.html`.

## What the repository assumes today

| Concern | Netlify (current) | Vercel (alternative) |
|---|---|---|
| Build | `npm run build` → `dist/` | Same command, output `dist/` |
| API | `netlify.toml` redirect `/api/*` → `/.netlify/functions/api/:splat` | Needs `api/index.ts` (or `vercel.json` rewrites) exporting the Express app |
| Runtime bundle | `netlify/functions/api.ts` via `serverless-http` | Same wrapper, different entry layout |
| Scheduled work | `export const config = { schedule: '@daily' }` | `vercel.json` `crons` entry calling an HTTP route |
| Security headers / CSP | `public/_headers` **and** the Express header middleware (kept in sync) | `vercel.json` `headers` block |
| Environment variables | Site settings; functions/runtime scopes | Project settings; same variable names |
| Long-running process | Dockerfile + `npm start` (self-hosted) | Not applicable |

The Express server sets the same security headers in code as `public/_headers`,
so a platform that serves `dist/` directly still gets the production headers
because the API and SPA fallback go through Express on the same origin.

## What must be true whichever platform wins

1. **Server-only secrets stay server-only.** `SUPABASE_SERVICE_ROLE_KEY` (or
   `SUPABASE_SECRET_KEY`) must never be exposed with a `VITE_` prefix. Browser
   code uses the publishable key only.
2. **The daily newsroom run must be scheduled.** `netlify/functions/daily-news-refresh.ts`
   currently owns `@daily`. On another platform the equivalent schedule must call
   the pipeline (`POST /api/admin/newsroom/ingest` with an admin token, or a
   dedicated cron entry point wrapping `runNewsroomRefresh`).
3. **`/api/*` must not fall through to the SPA.** `server.ts` already returns a
   JSON 404 for unknown API paths; the platform rewrite must preserve that.
4. **Redirect/header parity.** Whatever serves the static bundle must keep the
   CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and
   `Cache-Control: no-store` for `/api` responses.
5. **Supabase Auth redirect URLs** must list the production domain
   (`docs/NETLIFY_PRODUCTION_SETUP.md` lists the rest of the checklist).

## Recommendation

Keep **Netlify** as the single production target. The scheduled newsroom job,
the function entry point and the `_headers` file already exist there, so
migrating to Vercel would mean re-implementing working infrastructure with no
functional gain.

## How to close the question

1. If a Vercel project exists, delete it (or disconnect it from this repository)
   so only one platform builds `main`.
2. Confirm in Netlify: build command, publish directory, functions directory,
   `@daily` schedule, and that environment variables are set for Functions and
   Runtime.
3. ~~Confirm `npm run ci` runs on `main` in GitHub Actions.~~ **Confirmed
   2026-09-30 (TEST-1):** the `EduReach production checks` workflow is active and
   has run on every push to `main` and every PR to `main`, including the runs
   behind PR #11. The `quality-gate` job runs `npm ci` → Chromium install →
   `npm run ci`, and `npm run ci` now includes the schema audit and the
   real-PostgreSQL migration replay, so both gate every change. The earlier audit
   looked for runs against a specific HEAD and saw none; the runs exist — see
   `docs/features/TEST-1.md` for the run IDs and for the one workflow
   improvement that could not be pushed with this automation token.
4. Record the outcome by changing the Status line of this document.

Until step 4, treat deployment as **Netlify-defined, Vercel-unverified**.
