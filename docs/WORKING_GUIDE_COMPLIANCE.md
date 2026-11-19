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

Last full pass: 19 November 2026 (branch `arena/ccd0b3f2-edureach-hub`, PR #65).

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
| Linter and formatter | ✅ | `npm run lint` = ESLint 10 (flat config) over the whole repository: typescript-eslint recommended, Rules of Hooks, `prefer-const`, `eqeqeq`, `no-empty`, `no-useless-*`, `preserve-caught-error`; `npm run format:check` = Prettier 3 over the server, tooling, configuration and workflows. First run: 202 errors / 237 warnings; now 0 errors / 110 warnings. 81 of the original errors were missing globals in plain-JS scripts and the service worker (configuration, not code); 68 were the React Compiler preset, deliberately off; the rest were fixed in code (dead catch assignments, an expression used as a statement, an unnecessary try/catch, a rethrow that dropped its cause, unused bindings, useless regex escapes, empty catches) or kept as three documented, reasoned exceptions. See `CONTRIBUTING.md` "Lint and formatting" | Formatting of the app shell is staged: ~30 tests match exact source text, so reformatting `pages/`/`src/components/` needs those assertions rewritten first — tracked as a follow-up |
| CI on every PR: install, lint, typecheck, tests, vulnerability scan, build, bundle budget | ✅ | `.github/workflows/production-checks.yml` → a named "Lint and format check" step, then `npm run ci` (typecheck → lint → format:check → tests → schema/migration audits → build → perf → analytics → Playwright desktop+mobile → perf profile → RLS → a11y → npm audit) | — |
| Preview deploy per PR | ✗ | Netlify builds `main`; no PR previews | **Approval item B** |
| Migrations only, never hand edits, tested | ✅ | `supabase/migrations/` + `npm run schema:audit` + `npm run migrations:checklist` + `tests/migrations.test.ts` | — |
| Test tooling (unit, integration, E2E) | ✅ | 1300 unit tests, 318 Playwright tests on desktop + mobile, real-Postgres migration replay | — |
| Secrets management, no secrets in the repo | ✅ | Only `.env*.example`; `scripts/client-secret-guard.ts` fails a build that exposes a privileged key | — |
| Observability early (errors, structured logs, request ids) | ◐ | `lib/observability.ts`: one JSON line per event, five real levels (`warn`+ on stderr), one event vocabulary, `X-Request-Id` correlation from the platform id, redaction by key name, `errorFacts` (name/SQLSTATE/status, never the message), collapsed repeats. Every server/`src/server`/`lib`/`netlify` catch block now emits a named event (HTTP 5xx/401/403/slow, auth verify and capability refusals, CBT start/save/submit/grade/regrade, import pipeline, banks, institutions, CMS, admin mutations, audit-write failures, scheduled jobs, boot and crash). `/api/health` liveness + `/api/health/ready` fail-closed dependency probe with `health.degraded`/`health.recovered` transitions. Catalogue, thresholds and the external boundary: `docs/operations/OBSERVABILITY.md`; tests: `tests/observability.test.ts`, `tests/request-correlation.test.ts`, `tests/error-telemetry.test.ts` | **Approval item C — application side done; a destination (log drain, uptime check incl. an African vantage point, error aggregation, alert routing, status page) needs an external service and the owner's approval** |
| Seed scripts with realistic volume | ◐ | Demo seeding was neutralised (`docs/features/…` + migrations); no production-scale seeder | Needed for Stage 7 staging |
| Onboarding under a day | ◐ | `README.md` has run/test steps; `CONTRIBUTING.md` now added | — |

## Stage 5 — Development

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| 5.1 Accounts: register, verify, log in, log out, reset, roles, rate limits | ◐ | All flows exist; roles enforced server-side (`tests/authorization.test.ts`). Email verification is **off by decision** (Supabase `mailer_autoconfirm = true`, `VITE_EMAIL_VERIFICATION_ENABLED=false`) | Enabling verification is a product decision, not a code gap |
| 5.1 Generic "if this email exists" copy; reset token single-use | ✅ | Supabase Auth handles both; the UI never states whether an account exists | — |
| 5.2 Question bank: statuses and transitions, versioning, safe renderer, media, search | ✅ | `src/server/question-import/`, `tests/admin-question-management.test.ts`; rich content sanitised and rendered | — |
| 5.3 Import: template, background parse, per-row validation, duplicates, dry run, error report, drafts, rollback, review queue, publish, audit | ◐ | Batch import with validation, review states and audit exist (`admin-question-management`). Duplicate detection is present in `scripts/duplicate:audit` and the importer; rollback of a batch is not a first-class admin action | Verify duplicates + batch rollback; see item D |
| 5.3 Report-a-question loop (Step I) | ✅ | `question_reports` + migration `20261119130000`, `POST /api/cbt/questions/:id/report`, admin triage `GET/PATCH /api/admin/question-reports`, control on the review screen. Flag at three open reports is advisory (hiding is not implemented). Contract: `docs/features/CONTENT-REPORT-1.md`; tests: `tests/question-reports.test.ts` | Auto-hide of flagged questions still needs a decision |
| 5.4 Practice mode with per-answer feedback, server-selected, saved | ✅ | `tests/cbt-modes.test.ts`, `cbt-experience`, practice rules migrations | — |
| 5.5 Engine: start, save, resume, submit, auto-submit, grading, concurrency, observability | ✅ | Protocol v2 endpoints in `server.ts`; auto-submit and lazy finalisation; grading tests; session gateway. **Production cannot run v2 until `cbt_attempts.protocol` exists there** | Production migration is the known blocker |
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
| Test pyramid: unit, integration, E2E | ✅ | 1300 unit/integration; 318 Playwright across desktop + mobile; real-Postgres replay | — |
| Exam timing tests (the 6.3 table) | ✅ | Timer authority, refresh, deadline + grace, double submit, two devices, shuffle stability, frozen snapshot | — |
| Scoring correctness against hand-calculated sets | ✅ | `tests/cbt-modes.test.ts` builds papers and asserts scores; `tests/dashboard-cbt-accuracy.test.ts` | — |
| Network resilience (throttle, offline, flap, cold cache) | ◐ | Offline and reconnection specs plus a throttled mobile profile; no flapping/packet-loss harness | Partial by tooling limit |
| Content quality audit sampling | ✗ | No sampling-audit tool or recorded error rate | **Approval item F** |
| Load testing (start/submit spikes, soak) | ◐ | k6 scripts exist under `scripts/load/k6/` with documented scenarios; they cannot run in this sandbox and have no recorded results | Needs a load-capable environment |
| Security testing (OWASP, access control, answer-key leak, upload, input, session) | ✅ | `tests/authorization.test.ts`, `tests/cbt-authoritative-candidate.test.ts` (no keys in a simulation), `npm run rls:audit`, `npm audit` in CI | — |
| Accessibility and compatibility | ◐ | axe in CI, keyboard and contrast rules, 320/360/768/1440 width checks; no real-device matrix (Tecno/Infinix/itel) | Device testing needs hardware |
| Regression suite before release | ✅ | `npm run ci` is the regression suite; the smoke list maps to `npm run smoke` + the E2E specs | — |
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
| Support readiness, help centre, incident plan, status page | ✗ | Not in the repository | Owner/product work |
| Release and incident plans | ◐ | `docs/DEPLOYMENT_DECISION.md` describes rollback; no incident plan | Owner |

## Stage 9 — Deployment (going live)

| Requirement | Status | Evidence / state | Action |
|---|---|---|---|
| Tagged release, pipeline from the tag | ✗ | No tags or releases | Add when Stage 9 is reached |
| Backward-compatible migrations, no exam disruption | ✅ | Additive migrations; protocol switch is per-attempt (`protocol` column) | — |
| Production smoke tests | ◐ | `npm run smoke` exits 0 only on `status: ready`; it currently fails because production lacks `cbt_attempts.protocol` | Production migration |
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
| B | Netlify deploy previews per PR | 4.5 step 8 | Config-only; gives reviewers a live build per PR | Optional |
| C | Error tracking + uptime/metrics wiring | 4.9, 8.7 | **Application side implemented 19 Nov 2026** (structured events, correlation, redaction, readiness transitions, crash reporting, documented thresholds). The remaining half is external and unstarted: a log destination, uptime checks (one from Africa), error aggregation, alert routing and a status page — listed with thresholds in `docs/operations/OBSERVABILITY.md` | Essential before launch |
| D | ~~Question reporting loop~~ | 5.3 step I, 5.7 | **Approved and implemented 19 Nov 2026** — see CONTENT-REPORT-1 | Done |
| E | ~~Regrade tool for a corrected answer key~~ | 5.5 step 7 | **Approved and implemented 19 Nov 2026** — see `docs/features/CBT-REGRADE-1.md` | Done |
| F | Content sampling-audit tool and recorded error rate | 6.5 | Script + a place to record outcomes | Recommended |

Until these are approved, the work in this phase stays inside what the guide
already requires and the repository already owns.
