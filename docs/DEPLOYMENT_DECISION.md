# Deployment architecture — decision record

Status: **open decision, documented as recommended (audit P0-4)**
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
3. Confirm `npm run ci` runs on `main` in GitHub Actions (the audit could not see
   workflow runs for the current HEAD).
4. Record the outcome by changing the Status line of this document.

Until step 4, treat deployment as **Netlify-defined, Vercel-unverified**.
