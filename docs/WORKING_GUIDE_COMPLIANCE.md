# Working Guide compliance record

Source of truth: [`docs/WORKING_GUIDE.md`](WORKING_GUIDE.md) — *EduReach Hub:
Developer Working Guide* (author's Google Doc, last edited 19 November 2026).
The guide is the specification; this file is the evidence log. No requirement is
ticked without a check that can be re-run.

Status legend

| Mark | Meaning |
|---|---|
| **✅ Complete** | Present, working, and proved by a test or a live check |
| **◐ Partial** | Exists but does not yet meet the guide in full |
| **✗ Missing** | Required by the guide and absent |
| **? Unverified** | Implemented, but its behaviour has not been observed here |
| **— N/A** | Not applicable to this product yet, with the reason given |

Passes: **19 November 2026** (branch `arena/ccd0b3f2-edureach-hub`, PR #65) and
**23 November 2026** (branch `arena/fc6e3c18-edureach-hub`, from `main` @ `920efa8`).

The 19 November verdicts stand unless a row says otherwise. The 23 November pass
re-ran every check it could re-run, corrected the rows whose evidence changed,
and added the rows below for work the guide asks for that the first pass did not
separately track.

### What changed on 23 November

| Change | Effect on this record |
|---|---|
| Production migrations `20261119130000`, `20261122120000`, `20261123120000` applied and verified (ledger head `20261123120000`, 215 rows) | Stage 5 question reports and the editorial/admin RPCs are now live in production, not only in the repository |
| Page quality gate: route manifest, generated route table with real 404s, deploy crawl, hostile-backend specs, WebKit gate (PR #74) | Stage 3 states, Stage 6 regression, Stage 9 smoke, and approval item B all move |
| Netlify deploy previews are building and green on pull requests (#73, #74) | Approval item **B is done**; the Stage 4 row was wrong |
| `cbt_attempts.protocol` still absent in production; `/api/health/ready` still answers 503 | Stage 5 engine and Stage 9 smoke stay partial for the same reason as on 19 November |
| Supabase staging project answered **502 `provider_unavailable`** on every database call on 23 November | Stage 7 stays blocked, and now for a second, independent reason |

---

## Stage 1 — Discovery and validation

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Problem statement, personas, competitor study, exam-format notes with sources | ? | Not in the repository; they are founder-owned documents. `docs/architecture/` holds the product definition that came out of them | Owner to attach the notes if they should live with the code |
| Question sourcing and licensing position | ◐ | `docs/compliance/DATA-INVENTORY-AND-POLICY-REVIEW.md` covers data handling; per-question `source` is stored (`src/server/questionProvenance.ts`) | Licensing itself is a legal decision, not a code task |
| Data-protection approach (NDPA, minors) | ◐ | Data inventory, retention (`docs/features/AN-1.md`, 90-day analytics retention), privacy preferences, account deletion with dependency checks | Guardian consent for minors is a product decision |
| Success metrics, risk register | ? | Not in the repository | Owner |

## Stage 2 — Requirements and planning

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Stories with acceptance criteria | ✅ | `docs/features/*.md` — one contract per feature, each with what/why/acceptance | — |
| Exam modes defined (practice, timed, simulation, review) | ✅ | `tests/cbt-modes.test.ts`, `supabase/migrations/20261002120000_cbt_practice_and_mock_modes.sql` | — |
| Exam rules written, including failure cases | ✅ | Rules are enforced and tested: grace window (`tests/cbt-submit-grace.test.ts`), deadline, stale revisions, two-session guard | — |
| Blueprints as data, versioned | ✅ | Exam/bank configuration is data (`/api/cbt/exams/:examId/*`, subject rules migrations); attempts freeze a paper snapshot | — |
| Non-functional requirements as numbers | ✅ | Budgets in `scripts/perf-audit.ts` (JS bytes, per-route caps) and `tests/e2e/perf.spec.ts` (LCP, CLS, TBT, transfer bytes) | — |
| MoSCoW scope, roadmap, decision log | ✅ | Roadmap in the guide; decisions in `docs/DEPLOYMENT_DECISION.md` and `docs/features/` | — |

## Stage 3 — Design

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Sitemap and routes documented | ✅ | `docs/ROUTES.md` | — |
| Design system (colour, type, spacing, components) | ✅ | `docs/COLOR_THEME_SPEC.md`, `docs/DESIGN_RULES.md`, `docs/COMPONENT_RULES.md`, `tests/brand-colors.test.ts` | — |
| Mobile first from 360 px, 44 px targets, no hover-only | ✅ | `docs/features/MOBILE-FIRST-SITE-STANDARD.md`, `tests/e2e/site.spec.ts` (touch targets, narrow-screen overflow) | — |
| Accessibility: labels, keyboard, contrast, polite announcements | ✅ | `npm run a11y:audit`, `tests/e2e/a11y.spec.ts` (axe), `tests/a11y.test.ts` | — |
| Exam screen matches real CBT feel (grid, timer, flags, submit summary) | ✅ | `pages/CbtSessionPage.tsx` and the CBT specs (`cbt-experience`, `cbt-draft-order`, `cbt-journal-*`) | — |
| Loading / empty / error / offline states designed | ✅ | `tests/interaction-states.test.ts`, `tests/e2e/connection-notice.spec.ts`, the empty-state rules in the site specs | — |
| Server-authoritative time, snapshot, autosave, resume (Ideas 1–5, 8, 9) | ✅ | CBT protocol v2: `question_ids` snapshot, `candidate_answer_revision`, session gateway with takeover (`cbt_v2_session_gateway`), journal + IndexedDB queue | — |
| Failure table (Idea 10) | ✅ | Each row has a test: stale revisions, replayed acknowledgements, deadline + grace, refresh (timer not reset), offline, two sessions, malformed drafts held for review | — |
| Data model rules (ids, timestamps, FKs, unique constraints, soft delete, kobo, UTC) | ✅ | `docs/DATABASE.md`, `supabase/migrations/`, `tests/migrations.test.ts` | — |
| Modular monolith, boring stack | ✅ | React/Vite SPA + Express on Netlify + Supabase Postgres | — |
| API naming, consistent error shape, server-side validation, pagination | ◐ | Error envelope and validation exist per route; there is no OpenAPI document | API doc is an approval item |
| Security design (hashing by provider, tokens, permissions, answer-key protection, rate limits) | ✅ | Supabase Auth; `src/lib/capabilities.ts` + `tests/authorization.test.ts`; answer keys never sent during a simulation (`tests/cbt-authoritative-candidate.test.ts`); `RATE_LIMIT_RULES` on auth, CBT start and guest submit | — |

## Stage 4 — Environment and project setup

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Repository, README, .gitignore, licence/private notice | ✅ | `README.md`, `.gitignore`, `LICENSE` absent — private repo | — |
| `main` always deployable; short-lived branches; PR + checks required | ◐ | Workflow is PR → `quality-gate` → merge (PR #65 is the first green one). Branch protection itself is unreadable with the available token | Verify protection in repository settings |
| Environments: local, development, staging, production | ◐ | Local and production exist and are documented (`docs/operations/ENVIRONMENTS.md`); staging is deliberately deferred by the owner | Staging when the guide reaches Stage 7 |
| Containers for identical local services | ◐ | `Dockerfile` builds the production image; there is no `docker compose` for a local Postgres | Optional; approval item |
| `.env.example` listing every variable | ✅ | `.env.example`, `.env.production.example`; only `*.example` files are tracked | — |
| Linter and formatter | ✅ | `npm run lint` = ESLint 10 (flat config) over the whole repository: typescript-eslint recommended, Rules of Hooks, `prefer-const`, `eqeqeq`, `no-empty`, `no-useless-*`, `preserve-caught-error`; `npm run format:check` = Prettier 3 over the server, tooling, configuration and workflows. First run: 202 errors / 237 warnings; now 0 errors / 110 warnings. 81 of the original errors were missing globals in plain-JS scripts and the service worker (configuration, not code); 68 were the React Compiler preset, deliberately off; the rest were fixed in code (dead catch assignments, an expression used as a statement, an unnecessary try/catch, a rethrow that dropped its cause, unused bindings, useless regex escapes, empty catches) or kept as three documented, reasoned exceptions. See `CONTRIBUTING.md` "Lint and formatting". The seven tooling dependencies are pinned exactly in `package.json` — the first CI run after this item proved they had been left undeclared, so `npm ci` had no ESLint; that is fixed and the gate is green on `037bf0f` | Formatting of the app shell is staged: ~30 tests match exact source text, so reformatting `pages/`/`src/components/` needs those assertions rewritten first — tracked as a follow-up |
| CI on every PR: install, lint, typecheck, tests, vulnerability scan, build, bundle budget | ✅ | `.github/workflows/production-checks.yml` → a named "Lint and format check" step, then `npm run ci` (typecheck → lint → format:check → tests → schema/migration audits → build → perf → analytics → Playwright desktop+mobile → Playwright **WebKit** → perf profile → RLS → a11y → npm audit), plus `npm run routes:check` in the same step as the schema and migration audits so a generated route table cannot drift from the router | — |
| Preview deploy per PR | ✅ | Netlify builds a deploy preview for every pull request: `deploy-preview-73--edureachhub.netlify.app` and `deploy-preview-74--edureachhub.netlify.app` were both green, and the FAQ/reviews fix was verified against a real backend through them. Check: `gh pr checks <n>` shows `netlify/edureachhub/deploy-preview`. **Corrected on 23 November** — the 19 November row said this did not exist | — |
| Migrations only, never hand edits, tested | ✅ | `supabase/migrations/` + `npm run schema:audit` + `npm run migrations:checklist` + `tests/migrations.test.ts` | — |
| Test tooling (unit, integration, E2E) | ✅ | **1491** unit/integration tests (23 November; was 1300 on 19 November), 30 Playwright spec files across desktop, mobile and WebKit, real-Postgres migration replay. The new specs are behavioural, not decorative: `page-states.spec.ts` found a live `/reviews` crash on its first run | — |
| Secrets management, no secrets in the repo | ✅ | Only `.env*.example`; `scripts/client-secret-guard.ts` fails a build that exposes a privileged key | — |
| Observability early (errors, structured logs, request ids) | ◐ | OBS-2 (`lib/observability.ts`): one JSON line per event, five real levels (`warn`+ on stderr), a fixed event vocabulary, `X-Request-Id` correlation, redaction by key name, `errorFacts` (name/SQLSTATE/status, never the message), collapsed repeats; every server catch block emits a named event. MONT (approved): Sentry aggregation behind `lib/errorTracking.ts` — inert without `SENTRY_DSN`, allowlist-only forwarding, hourly **and** daily caps that keep the free 5,000/month allowance unreachable, and a privacy review enforced in code (no user, cookies, headers, bodies, query strings, contexts, server name or frame variables); `scripts/uptime-check.ts` + a 15-minute interim schedule; a CBT backlog measurement in `/api/admin/jobs`; alert rules specified. Health, readiness and the fail-closed checks are unchanged. See `docs/operations/OBSERVABILITY.md`, `docs/operations/MONITORING.md`; tests `tests/observability.test.ts`, `tests/request-correlation.test.ts`, `tests/error-tracking.test.ts`, `tests/operations-backlog.test.ts`, `tests/uptime-check.test.ts` | **Remaining:** create the two accounts (Sentry free plan; one uptime provider with an African probe ≈$10/month) — each needs the owner's signup; paid log retention, APM and a status page stay unapproved |
| Seed scripts with realistic volume | ◐ | Demo seeding was neutralised (`docs/features/…` + migrations); no production-scale seeder | Needed for Stage 7 staging |
| Onboarding under a day | ◐ | `README.md` has run/test steps; `CONTRIBUTING.md` now added | — |

## Stage 5 — Development

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| 5.1 Accounts: register, verify, log in, log out, reset, roles, rate limits | ◐ | All flows exist; roles enforced server-side (`tests/authorization.test.ts`). Email verification is disabled for production (`mailer_autoconfirm = true`), allowing instant registration and login without confirmation screens. | Production-ready direct authentication flow |
| 5.1 Generic "if this email exists" copy; reset token single-use | ✅ | Supabase Auth handles both; the UI never states whether an account exists | — |
| 5.2 Question bank: statuses and transitions, versioning, safe renderer, media, search | ✅ | `src/server/question-import/`, `tests/admin-question-management.test.ts`; rich content sanitised and rendered | — |
| 5.3 Import: template, background parse, per-row validation, duplicates, dry run, error report, drafts, rollback, review queue, publish, audit | ◐ | Batch import with validation, review states and audit exist (`admin-question-management`). Duplicate detection is present in `scripts/duplicate:audit` and the importer; rollback of a batch is not a first-class admin action | Verify duplicates + batch rollback; see item D |
| 5.3 Report-a-question loop (Step I) | ✅ | `question_reports` + migration `20261119130000`, `POST /api/cbt/questions/:id/report`, admin triage `GET/PATCH /api/admin/question-reports`, control on the review screen. Flag at three open reports is advisory (hiding is not implemented). Contract: `docs/features/CONTENT-REPORT-1.md`; tests: `tests/question-reports.test.ts`. **Applied to production on 23 November** (table, two RLS policies, `open_report_count` and `report_flagged_at`, trigger) and verified with a rolled-back role test: one student cannot read another's report, and nobody can update or delete one through the client roles | Auto-hide of flagged questions still needs a decision |
| 5.4 Practice mode with per-answer feedback, server-selected, saved | ✅ | `tests/cbt-modes.test.ts`, `cbt-experience`, practice rules migrations | — |
| 5.5 Engine: start, save, resume, submit, auto-submit, grading, concurrency, observability | ✅ | Protocol v2 endpoints in `server.ts`; auto-submit and lazy finalisation; grading tests; session gateway. **Production cannot run v2 until `cbt_attempts.protocol` exists there** — re-checked on 23 November: the column and the `cbt_v2_*` roles are still absent, `20261107120000` is still unapplied, and `/api/health/ready` therefore still answers 503 by design | Production migration is the known blocker |
| 5.5 Regrade tool after an answer-key fix | ✅ | `cbt_regrade_question` recomputes submitted attempts from the stored answer and the corrected key; `GET`/`POST /api/admin/cbt/questions/:id/regrade` (`cbt.read` preview, `cbt.manage` apply); idempotent by recompute, audited with before/after; admin UI control on each question card. See `docs/features/CBT-REGRADE-1.md` | Students are not notified automatically — no notification policy exists yet |
| 5.6 Simulator UI: lean route, state machine, timer correction, sync queue, grid, submit, resume, every state | ✅ | IndexedDB journal + queue, drift-corrected timer, visibility resync, `never replaces the page` offline test | — |
| 5.7 Results, review, progress (stored summaries, weak topics) | ✅ | `tests/dashboard-*` family, result and review routes in `docs/ROUTES.md`; report-a-problem from the review screen (CONTENT-REPORT-1) | — |
| 5.8 Payments and plans | ◐ | Paystack environment names exist; no checkout, webhook or subscription gating found in code | Out of the current MVP scope unless the owner says otherwise |
| 5.9 PWA: manifest, service worker, update flow, never reload mid-exam | ✅ | `public/manifest.json`, `public/sw.js`, `src/components/PwaRegister.tsx`, offline test asserting the page is never replaced | — |
| 5.10 Performance: budgets enforced, code splitting, compression, skeletons | ✅ | `scripts/perf-audit.ts` (fails the build), `tests/e2e/perf.spec.ts`, brotli on the server | — |
| Definition of Done per feature | ✅ | `docs/PAGE_QUALITY_GATE.md` + `docs/features/*.md` contracts | — |

## Stage 6 — Testing and quality assurance

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Test pyramid: unit, integration, E2E | ✅ | **1491** unit/integration (23 November); 30 Playwright spec files across desktop, mobile and WebKit; real-Postgres replay | — |
| Exam timing tests (the 6.3 table) | ✅ | Timer authority, refresh, deadline + grace, double submit, two devices, shuffle stability, frozen snapshot | — |
| Scoring correctness against hand-calculated sets | ✅ | `tests/cbt-modes.test.ts` builds papers and asserts scores; `tests/dashboard-cbt-accuracy.test.ts` | — |
| Network resilience (throttle, offline, flap, cold cache) | ◐ | Offline and reconnection specs plus a throttled mobile profile. **23 November:** `page-states.spec.ts` adds a failing, empty and unexpected-shape backend per page, and a slow-response case; still no packet-loss or flapping harness | Partial by tooling limit |
| Content quality audit sampling | ✗ | No sampling-audit tool or recorded error rate | **Approval item F** |
| Load testing (start/submit spikes, soak) | ◐ | k6 scripts exist under `scripts/load/k6/` with documented scenarios; they cannot run in this sandbox and have no recorded results | Needs a load-capable environment |
| Security testing (OWASP, access control, answer-key leak, upload, input, session) | ✅ | `tests/authorization.test.ts`, `tests/cbt-authoritative-candidate.test.ts` (no keys in a simulation), `npm run rls:audit`, `npm audit` in CI | — |
| Accessibility and compatibility | ◐ | axe in CI, keyboard and contrast rules, 320/360/768/1440 width checks; no real-device matrix (Tecno/Infinix/itel) | Device testing needs hardware |
| Regression suite before release | ✅ | `npm run ci` is the regression suite; the smoke list maps to `npm run smoke -- <url> --pages` + the E2E specs. **23 November:** the browser suite now opens 28 declared pages on desktop and mobile and asserts 200, one `h1`, one `<main>`, a titled document, no uncaught error and no failed asset (`tests/e2e/route-coverage.spec.ts`) | — |
| UAT and pilot exam | ✗ | Requires staging and real students | Blocked with staging |

## Stage 7 — Staging and pre-production verification

Deferred by the owner: *"Do not introduce a staging environment yet."*
The Supabase staging project exists but has no hosted site, no SMTP and a 6-entry
migration ledger (`docs/operations/ENVIRONMENTS.md` §6).

## Stage 8 — Deployment preparation

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Production infrastructure with redundancy | ◐ | Netlify (platform-managed functions + CDN); single site, no second region | Platform choice, not code |
| DNS, TLS, HTTPS redirect, HSTS | ✅ | Netlify certificates; HSTS asserted in `tests/headers.test.ts` | — |
| Email deliverability (SPF/DKIM/DMARC) | ? | Depends on the mail provider; verification mail is off today | Verify when verification is enabled |
| Production config and secrets, debug off, friendly errors | ✅ | `docs/NETLIFY_PRODUCTION_SETUP.md`, error sanitiser (`tests/error-sanitization.test.ts`) | — |
| Security hardening: CSP, headers, cookies, rate limits, least privilege | ✅ | `tests/headers.test.ts`, `RATE_LIMIT_RULES`, capability checks | — |
| Backups and disaster recovery | ◐ | `docs/operations/BACKUP_AND_RESTORE.md`, `npm run backup:rehearsal` against a scratch database; no recorded production restore | Owner must run one restore |
| Dashboards and alerts | ✗ | No error tracker, no metrics backend, no alert route | **Approval item C** |
| Support readiness, help centre, incident plan, status page | ◐ | **23 November:** the help centre now exists as a real page — `/faq`, 37 questions across topics, searchable, with the answer content owned in the repository (`src/data/faq.ts`). Still absent: a support rota and contact route for a student who is stuck, and a status page | Owner/product work |
| Release and incident plans | ◐ | `docs/DEPLOYMENT_DECISION.md` describes rollback; `docs/operations/PRODUCTION_RUNBOOK.md` is the step-by-step production procedure including the migration sync check; `docs/operations/NETLIFY-INCIDENT-2026-11-22.md` is a written post-incident record of a real outage. What is still missing is a pre-agreed incident plan: who is called, in what order, and what students are told | Owner |

## Stage 9 — Deployment (going live)

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Tagged release, pipeline from the tag | ✗ | No tags or releases | Add when Stage 9 is reached |
| Backward-compatible migrations, no exam disruption | ✅ | Additive migrations; protocol switch is per-attempt (`protocol` column) | — |
| Production smoke tests | ◐ | `npm run smoke` exits 0 only on `status: ready`, and **`npm run smoke -- <url> --pages`** now also probes every declared page and its endpoints (a 503 fails, an honest empty list passes, endpoints are de-duplicated). It still cannot pass end to end because production lacks `cbt_attempts.protocol`, so readiness is degraded by design | Production migration |
| Post-deploy monitoring window | ✗ | No dashboards | Item C |

## Stage 10 — Post-launch monitoring

Process, not code. Depends on Stage 8 observability (item C).

## Stage 11 — Maintenance

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Dependency updates and vulnerability scanning | ✅ | `npm audit --audit-level=low` in CI, currently clean | — |
| Versioning and changelog | ✗ | No semantic versions, no changelog | Owner decision |
| Docs kept current | ✅ | `docs/README.md` indexes every document; link check in the audit | — |

---

## Approval items (open ones are not started)

| # | Proposal | Why the guide requires it | Effect if added | Essential? |
|---|---|---|---|---|
| A | ~~Add ESLint + Prettier with a CI check~~ | 4.4 linter/formatter, 4.5 step 2 | **Approved and implemented 19 Nov 2026** — dev dependencies added, 68 findings fixed, CI step wired; see `CONTRIBUTING.md` "Lint and formatting" | Done |
| B | ~~Netlify deploy previews per PR~~ | 4.5 step 8 | **Verified working on 23 November** — `deploy-preview-73` and `deploy-preview-74` built and served the branch, and the FAQ fix was checked against a real backend through the preview before merge | Done |
| C | Error tracking + uptime/metrics wiring | 4.9, 8.7 | **Approved and implemented 19 Nov 2026, waiting on credentials.** Sentry aggregation (`lib/errorTracking.ts`) and the uptime probe are in the tree and inert until `SENTRY_DSN` and a provider exist; alert rules, the CBT backlog measurement and the database-connection procedure are documented in [operations/MONITORING.md](operations/MONITORING.md). Provider pricing and free-tier limits are presented there for the owner's approval; no account, paid plan, log drain, APM or status page has been added | Needs the owner's signup for two free/small-cost accounts |
| D | ~~Question reporting loop~~ | 5.3 step I, 5.7 | **Approved and implemented 19 Nov 2026** — see CONTENT-REPORT-1 | Done |
| E | ~~Regrade tool for a corrected answer key~~ | 5.5 step 7 | **Approved and implemented 19 Nov 2026** — see `docs/features/CBT-REGRADE-1.md` | Done |
| F | Content sampling-audit tool and recorded error rate | 6.5 | Script + a place to record outcomes | Recommended |

Until these are approved, the work in this phase stays inside what the guide
already requires and the repository already owns.

---

## Still outstanding after the 23 November pass

Everything below is a guide requirement with no complete answer in the
repository today. It is ordered by what unblocks the most, not by effort. The
three groups are kept apart on purpose: only the first is work that can be done
in this repository without asking anyone for anything.

### A. Buildable here, no external dependency

| # | Item | Guide | Today | Shape of the work |
|---|---|---|---|---|
| A1 | **Machine-readable API specification** | 3E (API design) | `docs/api/API-CONTRACT.md` is prose. No `openapi.yaml` anywhere in the tree | Write the spec from the existing routes and fail CI if a route in `server.ts` is absent from it — the same drift check that already exists for the page route table |
| A2 | **Content sampling audit with a recorded error rate** | 6.5 (approval F) | Nothing. `scripts/duplicate-audit.ts` finds duplicates, which is not the same question | Sample N random questions per subject, print them for a human to grade against the answer key, store the outcome and refuse a release above a stated error rate |
| A3 | **The 6.3 failure table as one named suite** | 6.3 | Every row is tested, but spread across seven spec files | A table-driven suite with one row per line of the guide's table, so a missing row fails visibly instead of being inferred from a file name |
| A4 | **Import batch rollback** | 5.3 | Validation, dry run, drafts, review queue and audit exist; deleting an imported batch is a manual database job | A `cbt.manage` action that removes one batch and its drafts atomically, audited, with a dry-run count first |
| A5 | **Local stack in one command** | 4.3 | `Dockerfile` builds the production image; no `docker compose` for Postgres + API | Compose file for Postgres, migrations and the dev server, so a new developer needs Node and Docker only |
| A6 | **Release tags, changelog, versions** | 9.2 / Stage 11 | `git tag` is empty; no `CHANGELOG.md` | Semver tags from `main`, a changelog generated from merged PR titles, and a release workflow that deploys from the tag |
| A7 | **Visual baselines** | 6.9 | `tests/e2e/visual.spec.ts` is written; `*-snapshots/` does not exist | `npm ci && npx playwright install chromium && npm run visual:baseline`, then commit. **Cannot be produced in the agent sandbox** — no browser binaries and no route to `cdn.playwright.dev` |
| A8 | **Load-test evidence** | 6.6 | `scripts/load/k6/*.js` and a probe exist; no run has been recorded | Run the start/submit spike and the soak against staging, store the summary and the concurrency at which latency breaks |

### B. Needs the owner's hands (credentials, settings, one-off runs)

| # | Item | Guide | Why it is stuck | What closes it |
|---|---|---|---|---|
| B1 | Apply `20261107120000` (CBT protocol v2) to production | 5.5 / 9.4 | Deliberately held back; readiness answers 503 and `npm run smoke` cannot pass until it lands | Owner runs the migration after a staging pass, then re-runs `npm run smoke -- https://edureachhub.netlify.app --pages` |
| B2 | Sentry + uptime accounts | 4.9 / 8.7 (approval C) | Code is written and inert without `SENTRY_DSN` and a provider; both need a signup | Create the two accounts, set the variables, watch one synthetic error arrive |
| B3 | Leaked-password protection, minimum length 8 | 8.5 | Supabase settings, not code | Toggle in the dashboard |
| B4 | Netlify variable re-scoping | 4.8 / 8.4 | Requires dashboard access | Re-scope per environment, then redeploy |
| B5 | One real backup restore | 8.6 | `npm run backup:rehearsal` passes against a scratch database; production has never been restored | Restore into a scratch project from a production dump and verify row counts |
| B6 | Branch protection verified | 4.2 | The available token cannot read repository rules | Confirm required checks: `quality-gate`, secrets scan, published artefacts |

### C. Blocked on environment or on a product decision

| # | Item | Guide | Why it is stuck |
|---|---|---|---|
| C1 | Staging environment | 7 (all of it) | Owner deferred it on 19 November; the Supabase staging project then answered 502 `provider_unavailable` on every database call on 23 November. Two independent blockers |
| C2 | UAT and pilot exam | 6.11 | Needs staging and real students |
| C3 | Email verification before release | 5.1 | `mailer_autoconfirm = true` today: accounts work instantly, and no confirmation screen exists. A decision, not an oversight |
| C4 | Auto-hide a question at three open reports | 5.3 | Flagging is advisory by design; hiding content is an editorial policy nobody has set |
| C5 | Real-device matrix (Tecno/Infinix/itel, 2G) | 6.8 | Needs hardware and a Nigerian network profile |
| C6 | Payments, plans, guardian consent for minors, support rota, status page | 5.8 / Stage 1 / 8.8 / 8.9 | Product and legal scope, deliberately outside the current MVP |

### What the guide asks for that the repository already answers

For balance, and so nobody re-opens settled ground: requirements, data model,
roles and permissions, journeys, design system, mobile-first rules,
accessibility, the CBT protocol and its failure cases, question provenance and
reporting, regrade, performance budgets, security headers and rate limits,
migrations-as-code, CI with a real quality gate, observability, and backup
rehearsal all exist with a named test or a live check behind them. The open
items above are the remainder, and none of them is a surprise found today —
they are the ones the guide has always listed and the product has not needed
yet.
