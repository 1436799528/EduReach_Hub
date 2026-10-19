# EduReach Hub

A student platform for Nigerian tertiary applicants and undergraduates. It covers
the things students actually queue for: service applications (NELFUND, WAEC and
NECO result checking, JAMB slip printing, admission letters), CBT practice,
verified education news, scholarship and job listings, and a school finder.

The app is a React single-page frontend served by an Express process, with
Supabase behind it for authentication, Postgres and storage.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 6, plain CSS with design tokens |
| Server | Express 4, bundled with esbuild for production |
| Data | Supabase (Postgres, row-level security, storage, auth) |
| Tests | `node:test` for units and API behaviour, Playwright for browser checks |
| Hosting | Netlify (static `dist/` plus one serverless function) or the Docker image |

## Getting started

Node 22.12 or newer is required.

```bash
npm ci
cp .env.example .env      # fill in the Supabase values
npm run dev               # http://localhost:3000
```

`npm run dev` runs the Express server through `tsx` and mounts Vite in middleware
mode, so the API and the frontend share one port in development.

Without Supabase credentials the app still boots: public pages render, and the
API answers with empty catalogues and a `degraded` readiness state instead of
failing. That is the mode the browser tests use.

### Environment

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`VITE_SUPABASE_ANON_KEY` is accepted as an alias for older deployments. The
service role key is server-only and must never be given a `VITE_` prefix.
`EDUREACH_SITE_URL` sets the canonical origin used by `robots.txt`, the sitemap
and canonical tags; when it is unset the origin is derived from the request.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Checks client env, builds `dist/`, bundles the server to `build/` |
| `npm start` | Runs the production server bundle |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit, API, migration and security suites |
| `npm run schema:audit` | Replays every migration and checks the resulting schema |
| `npm run rls:audit` | Prints the table access posture for the replayed schema |
| `npm run a11y:audit` | Static accessibility checks over every page |
| `npm run perf:audit` | Bundle and asset budgets against the last build |
| `npm run analytics:audit` | Confirms every emitted event is declared |
| `npm run prod:validate` | Checks a production environment before release |
| `npm run newsroom:run` | One newsroom ingestion run (`--dry-run` available) |
| `npm run smoke` | Hits the main routes on a running server |
| `npm run ci` | The full gate listed below |

The full gate is `npm run ci`:

```text
typecheck -> test -> schema:audit -> build -> perf:audit -> analytics:audit -> test:e2e -> npm audit
```

`npm test` includes `tests/migrations.test.ts`, which applies all 70 migrations in
order to an in-process PostgreSQL build (PGlite), then asserts the tables,
functions, columns, RLS state and signup trigger the application depends on. It
also runs the accessibility and SQL posture checks, so a page or a policy that
regresses fails the same command.

`npm run test:e2e` needs an unconfigured build (no `VITE_SUPABASE_*` values) and
downloads Chromium on first use. Playwright cannot run in every sandbox because
browser downloads are often blocked; CI installs Chromium before calling it.

## Layout

```text
server.ts              Express app: public API, admin API, CBT scoring, SEO files
src/app/               Router, route guards and the app shell
src/components/        Shared UI, grouped by area (admin, dashboard, cbt, a11y)
src/lib/               Client helpers: API client, auth, formatting, analytics
src/server/            Server-only modules: newsroom pipeline, notifications, job runs
src/data/              Static catalogues and copy
pages/                 Route-level screens
lib/                   Server utilities shared by Express and the functions
supabase/migrations/   Schema history, applied in filename order
scripts/               Audits, newsroom CLI and smoke checks
netlify/functions/     Serverless entry point and the daily newsroom job
tests/                 Node test suites and Playwright specs
docs/                  Architecture, feature contracts and operations
```

## Routes

Public: `/`, `/login`, `/register`, `/forgot-password`, `/news`, `/news/:slug`,
`/jobs`, `/schools`, `/schools/:slug`, `/services`, `/services/:slug`,
`/services/apply/:slug`, `/services/track`, `/events`, `/cbt`, `/past-questions`,
`/search`, `/screening-calculator`, `/tools/cgpa-calculator`, `/jamb`, `/waec`,
`/neco`, `/post-utme`.

Signed in: `/dashboard`, `/profile`, `/settings`, `/cbt/setup`, `/cbt/practice`,
`/cbt/results`.

Admin: `/admin`, `/admin/queue`, `/admin/cbt`, `/admin/question-imports`,
`/admin/news`, `/admin/users`, `/admin/schools`, `/admin/opportunities`,
`/admin/services`, `/admin/analytics` and the rest of the console.

## Deployment

Netlify builds with `npm run build`, publishes `dist/`, and routes `/api/*`,
`/robots.txt` and `/sitemap.xml` to `netlify/functions/api.ts`, which wraps the
same Express app. The bundled server and its source map go to `build/`, outside
the publish directory, and must not be published as static assets.

`Dockerfile` builds the same two outputs for a long-running Node host. See
[docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md) and
[docs/NETLIFY_PRODUCTION_SETUP.md](docs/NETLIFY_PRODUCTION_SETUP.md).

Before a release, `npm run prod:validate` checks variables, connectivity and the
migration history against a target environment. `npm run backup:rehearsal`
rehearses restore steps against a scratch database.

## Documentation

[docs/README.md](docs/README.md) indexes everything. The useful starting points:

- [docs/architecture/](docs/architecture/): product definition, data model, roles,
  journeys, business rules and the design system
- [docs/features/](docs/features/): analytics, accessibility, performance,
  notifications, SEO and the environment contract
- [docs/NEWSROOM_PIPELINE.md](docs/NEWSROOM_PIPELINE.md): how news is fetched,
  deduplicated, classified and published
- [docs/operations/PRODUCTION_RUNBOOK.md](docs/operations/PRODUCTION_RUNBOOK.md):
  deploy, rollback and incident steps

## Licence

Private project. All rights reserved.
