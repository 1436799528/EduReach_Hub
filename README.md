# EduReach Hub

EduReach Hub is a student-focused platform for Nigerian tertiary students, combining student services, CBT practice, verified academic updates and student opportunities in one responsive workspace.

## Product & system architecture

The authoritative product architecture — product definition, information
architecture, data model, roles and permissions, user journeys, business rules,
design-system requirements, the feature catalogue with build order, and the
required feature template — lives in [`docs/architecture/`](docs/architecture/).

Implementation follows it **one connected feature at a time**: the feature is
documented first, then built end to end, then validated. Open decisions and the
recommended next feature are listed in
[`docs/architecture/README.md`](docs/architecture/README.md).

## Application architecture

The browser entry point is `src/main.tsx`, which renders `src/app/App.tsx`. The active frontend is React + Vite with an Express production server. Supabase provides authentication and database access; server-side endpoints handle trusted operations such as CBT scoring and protected administration.

### Public routes

- `/` — student services and verified updates hub
- `/login` or `/signin` — sign in
- `/register` or `/signup` — create account
- `/forgot-password` — password recovery / password update
- `/dashboard` — authenticated student workspace
- `/cbt` — CBT setup
- `/cbt/practice` — active CBT session
- `/cbt/results` — authenticated CBT result review
- `/services` — service catalogue
- `/services/:service-slug` — direct service entry
- `/services/apply/:service-slug` — authenticated service request wizard
- `/services/track` — authenticated request tracker
- `/news` — verified academic/news feed
- `/news/:slug` — verified article detail
- `/jobs` — student opportunities

### Admin routes

- `/admin` — operations dashboard
- `/admin/queue` — service processing queue
- `/admin/cbt` — CBT question bank
- `/admin/users` — student accounts

## Core services

1. NELFUND Loan Application
2. WAEC / NECO Result Checking
3. JAMB Exam Slip Printing
4. Admission Deferment & Supplementary Letters

## Production backend

### Supabase

The current production schema contains the main service, account, CBT and announcement tables. RLS is enabled on the exposed tables. Service requests are tied to the authenticated user and receive server/database-generated reference codes.

Key tables include:

- `profiles`
- `service_catalog`
- `service_requests`
- `cbt_exams`
- `exam_questions`
- `cbt_attempts`
- `cbt_answers`
- `news_articles`

### Server API

- `GET /api/health` — liveness check
- `GET /api/health/ready` — readiness/dependency check (database reachability and latency)
- `GET /api/news` — verified published announcements
- `GET /api/news/:slug` — verified announcement detail
- `GET /api/cbt/exams/:examId/questions` — authenticated active-exam questions without answer keys
- `POST /api/cbt/submit` — authenticated server-side scoring and attempt persistence
- `/api/admin/*` — protected administrative endpoints
- `/api/admin/newsroom/*` — ingestion runs, review queue, manual runs
- `/api/admin/integrity` — content integrity report (news, CBT, opportunities, institutions)

### Security rules

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Browser code uses the Supabase publishable key only. Authentication is enforced before service requests, student dashboards and CBT submissions.

Service request references are unique, and a student cannot have two concurrent in-progress attempts for the same CBT exam. CBT answer keys are not browser-readable.

## Newsroom automation

`netlify/functions/daily-news-refresh.ts` runs daily and is the full ingestion
pipeline — source discovery, fetch, parse, deduplicate, classify, quality gate,
publish or queue for review — followed by image repair and the freshness sweeps.
It replaces the earlier image-only job, which is why "daily refresh" previously
did not mean "daily news".

Editorial rules: Tier 1 official sources (JAMB, WAEC, NECO, NABTEB, NELFUND,
NUC, NBTE, TETFund, the Federal Ministry of Education, NYSC) may publish
automatically when relevance and the quality gate pass with no warnings.
Everything else waits in **Admin → Newsroom CMS → Ingestion review queue** for a
human decision. Stories carry provenance (source key, tier, source publication
time, last verified time, verification state) and an expiry date, so stale
deadline news stops being shown as current.

```bash
npm run newsroom:run                 # one real ingestion run
npm run newsroom:run -- --dry-run    # decisions only, no writes
npm run newsroom:check               # probe every source, record health
npm run newsroom:integrity           # content integrity report
```

Full policy, dedupe signals, rate limits and failure modes:
[`docs/NEWSROOM_PIPELINE.md`](docs/NEWSROOM_PIPELINE.md). Apply
`supabase/migrations/20260930120000_newsroom_ingestion_pipeline.sql` before the
first run; the scheduled function and the console degrade gracefully (with a log
line) until it is applied. Deployment platform decision (audit P0-4):
[`docs/DEPLOYMENT_DECISION.md`](docs/DEPLOYMENT_DECISION.md).

## Environment

Copy `.env.example` to the appropriate local environment and provide:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional integrations are documented in `.env.production.example`.

## Development

Use Node.js 22.12 or newer. The server loads `.env`; deployed environment variables take precedence.


```bash
npm ci
npm run dev
```

## Production build

```bash
npm run lint
npm run build
npm start
```

The public frontend is built into `dist/`. The private Express bundle and source map are
built into `build/`, **outside** the web publish directory. `npm start` runs the
production server; do not publish `build/` as static assets. Docker copies both
outputs and their Node runtime dependencies.

## Automated quality gate

```bash
npm ci
npx playwright install --with-deps chromium
npm run check
```

`check` runs TypeScript checking, Node-based unit/API/security regression tests
(including the newsroom parser/dedupe/quality-gate suite and the rate-limit
suite), a production build, desktop/mobile Chromium smoke and interaction tests,
and `npm audit --audit-level=low`. The existing GitHub CI still runs type checking
and the production build. The expanded CI workflow is retained locally pending
GitHub Workflows write permission; run the full gate locally before merging.
Individual commands:

- `npm run typecheck` (also available as the legacy `npm run lint`; this is not ESLint)
- `npm test`
- `npm run build && npm run test:e2e`

Browser tests require an **unconfigured build** (no `VITE_SUPABASE_*` credentials),
not a production account. They test public routes, empty/error states, search,
navigation and fail-closed authentication. Authentication contract tests use a
local Supabase stub. These checks do not certify live RLS, database migrations,
real sign-in, admin writes, or exam persistence. See
[`docs/PROGRAMMING_AUDIT_2026-09-26.md`](docs/PROGRAMMING_AUDIT_2026-09-26.md)
for findings and remaining deployment checks.

An existing Chromium installation can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`. The normal CI setup uses
Playwright's downloaded browser without this override.

Before deployment, configure the Supabase Auth redirect URLs for the production domain. The production server must have the server-only Supabase secret configured in its runtime environment.


## Admin student view

Administrators retain their administrative identity but can enter the same `/dashboard` student-facing workspace through **View Student Site**. This uses the existing student pages and authenticated user data; it does not create a duplicate student dashboard or weaken server-side admin authorization.
