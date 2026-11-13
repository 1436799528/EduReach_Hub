# EduReach Hub — Backend Handoff Package (Consolidated)

> **What this file is.** This is the **complete, self-contained** handoff
> package for building a new, independent EduReach Hub backend in a
> separate GitHub repository. It consolidates, without omission, the
> verified findings of all seven handoff documents:
>
> - **A.** `FRONTEND-SYSTEM-INVENTORY.md` — what the frontend is
> - **B.** `API-REQUIREMENTS.md` — what the frontend calls (wire contract)
> - **C.** `DATABASE-REQUIREMENTS.md` — what data the frontend needs
> - **D.** `AUTHENTICATION-AND-PERMISSIONS.md` — auth, roles, permissions
> - **E.** `CBT-BACKEND-REQUIREMENTS.md` — complete CBT workflow
> - **F.** `FRONTEND-INTEGRATION-PLAN.md` — cutover without redesign
> - **G.** `BACKEND-IMPLEMENTATION-BRIEF.md` — build specification
>
> **How to use it in the new repository.** Copy this single file into the
> new backend repository (e.g. as `docs/BACKEND-HANDOFF-PACKAGE.md` or
> `HANDOFF.md`). It is self-contained: an agent with only this file and
> the new repository should be able to build the backend without access
> to the frontend repository. References below to sibling filenames
> (e.g. "see `API-REQUIREMENTS.md` §3") refer to the corresponding
> section **within this package** (Part B, §3, etc.). Part letters A–G
> below map 1:1 to the seven documents above, in order.
>
> **Provenance and verification.** Verified against the actual frontend
> source code on **2026-11-10** in `1436799528/EduReach_Hub`, branch
> `arena/7f1c35f5-edureach-hub`, base commit
> `c543d8b645d768e22b641330be2b6f23d863f943` (`main`). Key sources
> inspected: `src/lib/api.ts`, `src/lib/studentDashboard.ts`,
> `src/lib/siteContent.ts`, `src/lib/auth.tsx`, `src/lib/supabase.ts`,
> `src/lib/apiBase.ts`, `src/lib/capabilities.ts`, `src/lib/cbt-config.ts`,
> `src/lib/cbtAnswerQueue.ts`, `src/lib/useCbtPageWriter.ts`,
> `src/lib/cbtProtocolValidation.ts`, `src/app/routes.tsx`,
> `src/app/ProtectedRoute.tsx`, `pages/*.tsx` (43 files),
> `src/components/**`, `src/data/*.ts`, `server.ts` (4,192 lines),
> `lib/*.ts`, `src/server/**/*.ts`, `netlify/functions/api.ts`,
> `src/lib/envContract.ts`, `supabase/migrations/` (85 files),
> `supabase/candidates/`, `tests/*.test.ts` (~110 files), and
> `docs/api/API-CONTRACT.md` + `docs/architecture/*` (cross-checked, not
> relied upon exclusively).
>
> **Scope rule (critical).** The existing frontend is the source of truth
> for *user-facing behaviour and data requirements* — **not** for the
> existing database implementation. The new backend must use a **fresh
> PostgreSQL database and a fresh migration history**. Do not copy
> `server.ts`, `supabase/migrations/`, RPCs, RLS policies, or candidate
> files. Reproduce *behaviour*, not *implementation*.
>
> **Repository protection (original task).** This package was produced
> as a documentation-only task: no frontend code, backend code,
> migrations, env vars, or dependencies were modified; nothing was
> staged, committed, pushed, merged, or deployed.

---

## Contents

- [Package-level summary](#package-level-summary)
- [Critical architecture requirements](#critical-architecture-requirements)
- [Unresolved decisions](#unresolved-decisions)
- [Part A — Frontend System Inventory](#part-a--frontend-system-inventory)
- [Part B — API Requirements](#part-b--api-requirements)
- [Part C — Database Requirements](#part-c--database-requirements)
- [Part D — Authentication and Permissions](#part-d--authentication-and-permissions)
- [Part E — CBT Backend Requirements](#part-e--cbt-backend-requirements)
- [Part F — Frontend Integration Plan](#part-f--frontend-integration-plan)
- [Part G — Backend Implementation Brief](#part-g--backend-implementation-brief)
- [Appendix — Verification checklist](#appendix--verification-checklist)

---

## Package-level summary

EduReach Hub is an examination-preparation platform (JAMB CBT, WAEC CBT,
NECO CBT, POST-UTME practice, past questions, student accounts/profiles,
question-bank management, admin management, results/performance tracking).
The existing frontend is a React 19 + Vite 6 + TypeScript SPA with a
custom string router, talking to **two** backends: a same-origin Express
API (`/api/*`, prod `/.netlify/functions/api/*`) and direct Supabase
(PostgREST + Auth + Storage) from the browser. The new backend
(Express.js + TypeScript + fresh PostgreSQL + REST + Vercel-compatible)
must serve the frozen wire contract (paths, plain-object shapes,
`{ error: string }` errors, Bearer-JWT auth, 0-based answer indices,
1-based positions, ISO-8601 UTC) while re-implementing all authorization,
CBT integrity, and audit rules server-side. Integration is incremental:
parity → base repoint → public reads → student data → auth decision →
storage → decommission, with no page/component redesign. The CBT v2
versioned writing protocol stays fenced (503 in production) until an
explicit release decision.

---

## Critical architecture requirements

The new backend must satisfy all of the following (full detail in Parts
C–G):

1. **Independent backend.** Fresh schema, fresh migrations, fresh code.
   Do not copy the existing server, migrations, RPCs, RLS, or candidates.
2. **Frontend is the contract.** Paths, shapes, error vocabulary, auth
   transport, and CBT protocol in Part B are frozen.
3. **Server-authoritative security.** All authorization enforced
   server-side (capability + ownership + bank policy, re-checked inside
   every transaction). Students never receive answer keys before
   permitted release. Unclassified banks fail closed (404 student / 503
   policy-unavailable). Answer saving is idempotent. CBT submission and
   scoring are server-authoritative against the frozen paper. Deadlines
   are enforced server-side (server clock only).
4. **Single writer.** One active writing session per attempt, using
   server-issued session generations/leases. Stale-session writes are
   rejected.
5. **Auditable admin.** Every administrative mutation writes an
   in-transaction audit row.
6. **V2 fence.** Do not enable a global CBT v2 writing protocol without
   an explicit release decision. Production serves `protocol:{version:1}`;
   v2 routes return 503.
7. **Vercel-compatible.** Stateless handlers, durable rate limiting for
   sensitive routes, cold-start-safe, no in-process-only correctness state.

---

## Unresolved decisions

These must be decided before or during the build (see Parts D, F, G):

1. **Identity provider:** Option A — keep Supabase Auth (recommended for
   phase 1, zero frontend auth change) vs Option B — own auth in the new
   backend (full control, frontend rewrite + credential migration).
2. **Bank-security provenance:** the live server references
   `cbt_bank_security` / `cbt_bank_candidate_access`, but the only
   in-repo definitions are non-deployable candidates. Design fresh.
3. **Email delivery** if auth moves (no provider configured today;
   WhatsApp links are static `wa.me` deep links).
4. **Newsroom ingestion:** re-implement automated ingestion or treat
   news as manually curated.
5. **Content-manager generic CRUD:** replace with explicit per-resource
   endpoints (recommended).
6. **Known gaps to fix (not preserve):** suspended users must be refused
   at authentication time; `cbt_limits.maxSubjects` must be unified
   (recommend 9); MFA challenge at login is currently enrolment-only —
   decide explicitly.

---


---

# Part A — Frontend System Inventory

> **Source document:** `FRONTEND-SYSTEM-INVENTORY.md` (Part A of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts B–G within this package.

---

# EduReach Hub — Frontend System Inventory

> **Purpose.** This document is the source-of-truth inventory of the existing
> EduReach Hub frontend for the purpose of building a **new, independent
> backend** in a separate repository. It was verified against the actual
> source code in this repository (branch `arena/7f1c35f5-edureach-hub`,
> base commit `c543d8b`), not only against `docs/` prose.
>
> **Scope rule.** The frontend is the source of truth for *user-facing
> behaviour and data requirements*. The existing database implementation
> (Supabase tables, RPCs, RLS, migrations in `supabase/migrations/`) is
> **not** to be copied blindly. The new backend uses a fresh PostgreSQL
> database and a fresh migration history.
>
> **How to read this package.** Start here, then read
> `API-REQUIREMENTS.md` (what the frontend calls), `DATABASE-REQUIREMENTS.md`
> (what data it needs), `AUTHENTICATION-AND-PERMISSIONS.md`,
> `CBT-BACKEND-REQUIREMENTS.md`, `FRONTEND-INTEGRATION-PLAN.md`, and finally
> `BACKEND-IMPLEMENTATION-BRIEF.md` (the build specification).
>
> **Verification date:** 2026-11-10. File/line references are to the
> repository as inspected on that date.

---

## 1. Repository shape

| Area | Path | What it is |
|---|---|---|
| Browser app entry | `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx` | React 19 SPA. Custom string-based router (`renderRoute(pathname)`); **no react-router**. Lazy-loaded pages via `React.lazy` + `Suspense` in `App.tsx`. |
| Pages | `pages/*.tsx` (43 files) | One component per route/screen. See §4. |
| Shared UI | `src/components/*.tsx`, `src/components/admin/*`, `src/components/dashboard/*`, `src/components/a11y/*` | Layout, cards, CBT panels, admin kit, dashboard widgets. See §5. |
| Browser data layer | `src/lib/api.ts` (1,981 lines), `src/lib/studentDashboard.ts`, `src/lib/siteContent.ts`, `src/lib/auth.tsx`, `src/lib/supabase.ts` | API client + direct Supabase calls. See §7–§9. |
| CBT client logic | `src/lib/cbt-config.ts`, `src/lib/cbtAnswerQueue.ts`, `src/lib/useCbtPageWriter.ts`, `src/lib/cbtProtocolValidation.ts`, `src/lib/cbtReconciliation.ts`, `src/lib/dashboardCbtStats.ts` | Session config, v2 journal, validation. See `CBT-BACKEND-REQUIREMENTS.md`. |
| Static catalogue data | `src/data/*.ts` | Hard-coded fallbacks/catalogues shipped in the bundle. See §6. |
| Existing server (to be replaced) | `server.ts` (4,192 lines), `lib/*.ts`, `src/server/**/*.ts`, `netlify/functions/api.ts` | Express app + Netlify serverless wrapper. **The new backend replaces this; do not copy it.** Its route list is the compatibility baseline — see `API-REQUIREMENTS.md`. |
| Existing DB (to be replaced) | `supabase/migrations/` (85 files), `supabase/candidates/`, `supabase/rollbacks/` | Fresh DB required. Candidate files are **not deployed** (see §9.4). |
| Tests | `tests/*.test.ts` (~110 files), `tests/e2e/`, `scripts/tests/` | Unit/integration tests that encode frontend expectations (CBT, auth, rate limits, provenance refusal, etc.). The new backend should treat the CBT/auth/security tests as behavioural specs. |
| Build/deploy | `vite.config.ts`, `netlify.toml`, `Dockerfile`, `package.json` | Vite build (terser), Netlify static + function, Docker self-host via `npm start`. |

**Stack (from `package.json`):** React 19, ReactDOM 19, Vite 6, TypeScript
~5.8, Express 4, `@supabase/supabase-js` 2.x, `serverless-http`, `compression`,
`dotenv`, `esbuild`, `tsx`, `fast-xml-parser`, `jszip`, `pdf-parse`,
`lucide-react`. Node `>=22.12.0` (`.nvmrc`). No state library, no form
library, no router library, no ORM in the browser.

---

## 2. Runtime architecture

### 2.1 Two data paths (critical for the rebuild)

The browser talks to **two** backends today:

1. **Same-origin Express API** (`/api/*` in dev, `/.netlify/functions/api/*`
   in production — see `src/lib/apiBase.ts`). All admin writes, CBT
   start/paper/draft/submit, service-request processing, newsroom, imports,
   site content, analytics ingestion, and public catalogue reads that need
   server logic go here. The new Express backend must serve this surface
   (or the frontend must be repointed — see `FRONTEND-INTEGRATION-PLAN.md`).
2. **Direct Supabase (PostgREST + Auth + Storage) from the browser**
   (`src/lib/supabase.ts` → `createClient`). Used for auth, several public
   reads, and all student-owned data (saved items, notifications, CGPA,
   profile upserts). The new backend must either (a) keep Supabase Auth as
   identity provider and re-implement these reads as REST endpoints, or
   (b) own auth and replace every direct call. See §9 and
   `AUTHENTICATION-AND-PERMISSIONS.md` §8.

There is **no** direct database access from the browser beyond Supabase
PostgREST (no raw SQL, no `pg` in the bundle). All privileged writes go
through the Express API or through `SECURITY DEFINER` RPCs invoked via
PostgREST (`supabase.rpc(...)`).

### 2.2 Request plumbing

- `src/lib/apiBase.ts`: `API_BASE_PATH = '/.netlify/functions/api'` when
  `import.meta.env.PROD`, else `'/api'`. `apiUrl(path)` rewrites any
  `/api/...` path to the production base. **The new backend must accept
  both prefixes** (or the frontend base must be changed — one-line change,
  see integration plan).
- `src/lib/api.ts` → `jsonFetch<T>()`: 15 s timeout (`REQUEST_TIMEOUT_MS`),
  respects caller `AbortSignal`, throws `EduReachError` (from
  `src/lib/failures.ts`) with kinds `auth|forbidden|not-found|validation|
  rate-limited|server|offline|timeout|unknown` mapped from HTTP status
  (401→auth, 403→forbidden, 404→not-found, 422→validation, 429→rate-limited,
  5xx→server). Non-2xx bodies are expected to be `{ error: string }` or
  `{ error: { message } }`; `userFacingError()` (`lib/errors.ts`) normalises
  them and hides infrastructure detail. **The new backend must keep the
  `{ error: string }` shape** (see `API-REQUIREMENTS.md` §1).
- `authHeaders()` (`src/lib/api.ts`): `supabase.auth.getSession()` →
  `Authorization: Bearer <access_token>`. No cookies, no CSRF token. The
  token is a Supabase JWT; the server verifies it via
  `supabase.auth.getUser(token)` (`lib/auth.ts` → `verifyJWT`) and then
  re-reads `profiles.role` from the database. `user_metadata` is **never**
  trusted for authorization.
- `adminApiFetch()` is the same `jsonFetch` with auth headers + JSON content
  type, used by all admin pages.
- `trackEvent()` (`src/lib/api.ts`): fire-and-forget `POST /api/analytics/event`
  with `keepalive: true`, consent-gated (`hasAnalyticsConsent()`), taxonomy-
  validated (`src/lib/analyticsTaxonomy.ts`). Failures are silent by design.
- Question-import upload uses `XMLHttpRequest` (not `fetch`) for upload
  progress, 120 s timeout (`uploadAdminQuestionImport`).

### 2.3 Rendering, routing, and shell

- `src/main.tsx` mounts `<App/>` inside `<AuthProvider>` and
  `<ErrorBoundary>`. `App.tsx` renders `renderRoute(window.location.pathname)`
  inside `Suspense` (fallback `WaveLoader`), plus `CookieConsent`,
  `PwaRegister`, `EnvironmentBanner`.
- `src/app/routes.tsx` `renderRoute()` is a hand-rolled `if` chain on the
  pathname (trailing slash stripped). Unknown paths → `NotFoundPage`.
  `/nabteb`, `/admission/*`, `/tools/*`, `/support` → `ComingSoonPage`.
  `/dashboard/scholarships` → redirect to `/jobs`.
- `src/app/ProtectedRoute.tsx`: wraps dashboard/profile/settings/track
  routes. Shows a loading portal while `useAuth().isLoading`, redirects to
  `/login?next=<encoded path>` when unauthenticated. `isProtectedPath()`
  covers prefixes `/dashboard`, `/profile`, `/settings`, `/services/track`,
  `/track`. **Admin routes are NOT wrapped in `ProtectedRoute`** — they are
  gated inside `pages/AdminLayout.tsx` (see §8.3).
- `src/components/HubLayout.tsx` + `HubSideRail.tsx` + `SiteFooter.tsx` are
  the public shell. `CbtSessionPage` deliberately uses **no** site shell
  (dedicated exam hall: no header/footer/nav).
- Navigation is via `navigateInApp()` (`src/lib/navigation.ts`) using
  `history.pushState` + a custom event; there is no router state to preserve.

### 2.4 Offline / unconfigured behaviour (must be preserved)

- `isSupabaseConfigured` (`src/lib/supabase.ts`) is `Boolean(url && key)`
  where the key is refused if it looks privileged (`isPrivilegedKey()` in
  `src/lib/supabaseKey.ts` — rejects `service_role` JWTs and `sb_secret_*`).
  When unconfigured, the client falls back to an inert dummy URL/key so the
  bundle renders an honest offline/preview state instead of crashing.
- Many `src/lib/api.ts` functions short-circuit when unconfigured:
  `fetchServices()` returns the code-defined fallback catalogue,
  `fetchCbtExams()` returns `[]`, `fetchNews()` returns `[]`,
  `fetchCbtSubjectCatalog()` returns `[]`, `fetchPostUtmeInstitutions()`
  returns `[]`, `fetchOpportunities()` returns `[]`. CBT configured-session
  calls (`startConfiguredCbt`, `fetchCbtAttemptPaper`, draft/submit) do
  **not** fall back to local questions — they throw, because an
  unauthorised paper cannot be scored.
- Guest CBT results and local-preview data live in `localStorage` under
  `edureach-local:<email-scope>:<name>` (`src/lib/localPreview.ts`).
  `fetchCbtResult()` reads `cbt-result-<attemptId>` from localStorage for
  `guest-cbt-*` ids or when unconfigured. The new backend does not need to
  serve guest results; it must not break this path.
- `src/lib/siteContent.ts` `loadSiteContent()` fetches `GET /api/site-content`
  with a 5 s timeout and falls back to shipped copy (`mergeSiteContent(null)`)
  on any failure. The footer must never disappear because the API is down.

### 2.5 Browser persistence

| Store | Keys / DB | Purpose |
|---|---|---|
| `localStorage` | `edureach-local:<scope>:cbt-result-<id>`, `last-cbt-attempt`, `edureach-local-user-email`, `edureach-student-profile` (legacy), `edureach-analytics-session` (sessionStorage) | Guest/local scorecards, last attempt, preview profile, analytics session id. |
| `localStorage` | `edureach-cbt-pending:<attemptId>` (`pages/CbtSessionPage.tsx`) | Best-effort pending-answer snapshot for legacy (v1) draft recovery. |
| IndexedDB | `IndexedDbAnswerJournal` (`src/lib/cbtAnswerQueue.ts`) | Durable v2 answer-operation journal (pending/acknowledged/conflicted/superseded/closed). Recovery aid only — **not** authoritative. |
| Supabase Auth storage | `sb-<ref>-auth-token` (default) | Session JWT + refresh token, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`. |

The new backend must treat all browser persistence as untrusted recovery
aids. Authoritative CBT state lives server-side (see
`CBT-BACKEND-REQUIREMENTS.md`).

---

## 3. Major application modules

| Module | Frontend entry points | Backend surface needed |
|---|---|---|
| **Identity & profiles** | `pages/AuthPageV2.tsx`, `pages/ProfileCompletionPage.tsx`, `src/lib/auth.tsx`, `src/components/dashboard/SecurityModal.tsx` | Auth (Supabase Auth or new), `profiles` CRUD, MFA, password reset. |
| **Student dashboard** | `pages/StudentDashboardV2.tsx` (tabs: `dashboard`/`services`/`cbt`/`tools`), `src/lib/studentDashboard.ts`, `src/lib/dashboardCbtStats.ts`, `src/lib/dashboardPriority.ts` | Profile, service requests (own), CBT history, saved items, notifications, CGPA, security events. |
| **CBT (configured sessions)** | `pages/CbtPage.tsx`, `pages/CbtPracticeEntryPage.tsx`, `pages/ExamSetupPage.tsx`, `pages/CbtSessionPage.tsx`, `pages/CbtResultsPage.tsx`, `src/lib/cbt-config.ts`, `src/lib/cbtAnswerQueue.ts`, `src/lib/useCbtPageWriter.ts` | Bank catalogue, subject availability, attempt start/paper/draft/submit/abandon/delete/history, v2 state/session/answer/finalize (gated), guest practice. |
| **Past questions library** | `pages/PastQuestionsPage.tsx`, `pages/ExamHubPage.tsx` | `GET /api/past-questions/resources`, `GET /api/public/documents`. |
| **Services (student requests)** | `pages/ServicesCatalogPage.tsx`, `pages/ServiceApplyPage.tsx`, `src/data/liveServices.ts`, `src/lib/serviceLifecycle.ts`, `src/lib/serviceSubmissionRecovery.ts` | Service catalogue, service detail + guide, idempotent request submission, own-request tracking. |
| **News & events** | `pages/NewsPage.tsx`, `pages/NewsArticlePage.tsx`, `pages/EventsPage.tsx`, `pages/HubHomePage.tsx` | News list/detail, upcoming deadlines/exams. |
| **Opportunities (scholarships/jobs)** | `pages/JobsPage.tsx`, `pages/OpportunityDetailsPage.tsx` | Opportunities list/detail. |
| **Schools / institutions** | `pages/SchoolFinderPage.tsx`, `pages/SchoolDetailsPage.tsx`, `src/components/dashboard/SchoolFinderCard.tsx` | Institution list/detail (direct Supabase today). |
| **Calculators & tools** | `pages/CgpaCalculatorPage.tsx`, `pages/ScreeningCalculatorPage.tsx`, `src/lib/calc-engine.ts`, `src/components/ScientificCalculator.tsx` | **Pure client-side.** No backend needed (CGPA snapshot persistence is optional — see §9). |
| **Search** | `pages/SearchPage.tsx` | Client-side aggregation over already-fetched catalogue/news/opportunities data. No dedicated endpoint. |
| **Site content & legal** | `pages/LegalPage.tsx`, `pages/RefundPolicyPage.tsx`, `src/lib/siteContent.ts`, `src/lib/siteContentModel.ts`, `src/components/useSiteContent.ts` | `GET /api/site-content` (public), admin site-content CRUD. |
| **Admin console** | `pages/AdminLayout.tsx` + 14 `Admin*Page.tsx` | Full `/api/admin/*` surface. See §4.2. |
| **Analytics** | `src/lib/api.ts` `trackEvent()`, `src/lib/analyticsTaxonomy.ts`, `src/lib/privacyPreferences.ts` | `POST /api/analytics/event`, `GET /api/admin/analytics`. |
| **SEO / platform** | `src/server/seo.ts`, `src/lib/seoMeta.ts`, `server.ts` sitemap/robots | `GET /sitemap.xml`, `GET /robots.txt` (+ `/api/*` aliases), `GET /api/health`, `GET /api/health/ready`. |

---

## 4. Pages and responsibilities

### 4.1 Public and student pages

| Route(s) | File | Responsibility | Data dependencies |
|---|---|---|---|
| `/` | `pages/HubHomePage.tsx` | Landing: hero, exam hubs, services, news, resume/continue-practice card. | `fetchNews`, `fetchServices`, `fetchUpcoming`, `fetchCbtExamsWithAvailability` (via `CbtHistoryPanel`/`ContinuePracticeCard`), `loadSiteContent`. |
| `/jamb`, `/waec`, `/neco`, `/post-utme` | `pages/ExamHubPage.tsx` | Per-exam hub: links into setup, past questions, subject info. | Static `src/data/examPreparation.ts` + `fetchCbtExams*`. |
| `/nabteb`, `/admission/*`, `/tools/*`, `/support` | `pages/ComingSoonPage.tsx` | Honest placeholder. No backend. |
| `/cbt` | `pages/CbtPage.tsx` | CBT catalogue: exam cards with availability, history panel. | `fetchCbtExams` (direct Supabase) or `fetchCbtExamsWithAvailability` (`GET /api/cbt/exams`) when configured; `fetchCbtHistory`. |
| `/cbt/practice` | `pages/CbtPracticeEntryPage.tsx` | Resolves bank via `resolveSetupExam()` then redirects to `/cbt/setup/<body>`. | Same catalogue calls as `/cbt`. |
| `/cbt/setup/jamb\|waec\|neco\|post-utme` | `pages/ExamSetupPage.tsx` | Setup wizard: mode (practice/mock), subjects, question count, duration, programme, Post-UTME institution. Validates with `validateSession()`/`mockCombinationError()` then `startConfiguredCbt()`. | `fetchCbtBank` (`GET /api/cbt/exams/:id/subjects`), `fetchCbtExams*`, `fetchCbtSubjectCatalog` (direct Supabase), `fetchPastQuestionResources`, `fetchPostUtmeInstitutions` (direct Supabase), `startConfiguredCbt`. |
| `/cbt/session/:attemptId` | `pages/CbtSessionPage.tsx` | Exam hall: paper, timer, answer queue, submit/end-test, calculator, keyboard shortcuts (1–4/A–D/arrows/M). | `fetchCbtAttemptPaper`, `fetchCbtV2State` (v2 only), `saveConfiguredCbtDraft`, `submitConfiguredCbt`, `abandonConfiguredCbt`, `useCbtPageWriter` (v2). |
| `/cbt/results`, `/cbt/results/:attemptId`, `/dashboard/cbt/results[/:attemptId]` | `pages/CbtResultsPage.tsx` | Scorecard + answer-by-answer review. Guest results from localStorage; signed-in from server. | `fetchCbtResult` (RPC `get_cbt_result` + fallbacks), `deleteCbtAttempt`, direct `profiles` read for name/matric/JAMB reg. |
| `/past-questions` | `pages/PastQuestionsPage.tsx` | Past-question resource library (available/external/unavailable states). | `fetchPastQuestionResources` (`GET /api/past-questions/resources`). |
| `/login`, `/signin`, `/register`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | `pages/AuthPageV2.tsx` | All auth modes in one component (see `AUTHENTICATION-AND-PERMISSIONS.md`). | `supabase.auth.*` direct; `bootstrapAdmin()` (`POST /api/admin/bootstrap`); `GET /api/admin/session` probe after sign-in. |
| `/profile/complete`, `/profile`, `/dashboard/profile` | `pages/ProfileCompletionPage.tsx` | Post-registration profile completion (school, course, department, faculty, level). | Direct `profiles` upsert; local-preview fallback. |
| `/dashboard`, `/dashboard/notifications` | `pages/StudentDashboardV2.tsx` (tab `dashboard`) | Overview: profile summary, notifications, CBT stats, priority actions. | Direct Supabase reads (profile, service_requests, cbt_attempts, saved items, notifications, CGPA) + `fetchCbtHistory`. |
| `/dashboard/services`, `/dashboard/applications`, `/services/track`, `/track` | `StudentDashboardV2` (tab `services`) | Own service requests + tracking. | Direct `service_requests` read; `submitServiceRequest` RPC for new submissions (via `ServiceApplyPage`). |
| `/dashboard/cbt`, `/dashboard/past-questions` | `StudentDashboardV2` (tab `cbt`) | CBT history + resume. | `fetchCbtHistory` (`GET /api/cbt/attempts`), direct `cbt_attempts` read. |
| `/dashboard/tools`, `/dashboard/saved` | `StudentDashboardV2` (tab `tools`) | Saved items, CGPA calculator card, school finder card. | `src/lib/studentDashboard.ts` direct Supabase. |
| `/settings`, `/dashboard/settings` | `StudentDashboardV2` (`openSettings`) | Settings + `SecurityModal` (password change, MFA, sign-out-others). | `supabase.auth.updateUser`, `supabase.auth.mfa.*`, direct `profiles` update (`mfa_enabled`). |
| `/services`, `/services/:slug`, `/nelfund`, `/results`, `/jamb-slip`, `/admission-letters` (live slugs) | `pages/ServicesCatalogPage.tsx`, `pages/ServiceApplyPage.tsx` | Catalogue + application forms with draft recovery and idempotent submission. | `fetchServices`/`fetchService` (direct Supabase), `submitServiceRequest` (RPC), `GET /api/services/:slug/guide` (fallback to static guide). |
| `/news`, `/news/:slug` | `pages/NewsPage.tsx`, `pages/NewsArticlePage.tsx` | News feed + article. Expired articles leave the feed but stay reachable by slug. | Direct `news_articles` reads (with column-fallback logic) + `GET /api/news*` server equivalents. |
| `/events` | `pages/EventsPage.tsx` | Deadlines/exams calendar. | `fetchUpcoming` (`GET /api/upcoming`). |
| `/jobs`, `/jobs/:id` | `pages/JobsPage.tsx`, `pages/OpportunityDetailsPage.tsx` | Scholarships/jobs list + detail. | `fetchOpportunities`/`fetchOpportunity` (`GET /api/opportunities*`). |
| `/schools`, `/schools/:slug` | `pages/SchoolFinderPage.tsx`, `pages/SchoolDetailsPage.tsx` | Institution directory + detail. | Direct `institutions` reads; `fetchPublicPdfDocuments` for school resources. |
| `/screening-calculator`, `/calculator` | `pages/ScreeningCalculatorPage.tsx` | Admission screening calculator. Pure client (`src/lib/calc-engine.ts`). | None. |
| `/tools/cgpa-calculator`, `/cgpa-calculator` | `pages/CgpaCalculatorPage.tsx` | CGPA calculator. Pure client; dashboard card optionally persists a snapshot. | None (optional `student_cgpa_*` persistence). |
| `/search` | `pages/SearchPage.tsx` | Cross-catalogue search. | `fetchCbtExams`, `fetchNews`, `fetchOpportunities` (client-side filter). |
| `/legal/:slug`, `/refund-policy` | `pages/LegalPage.tsx`, `pages/RefundPolicyPage.tsx` | Policy pages from site content. | `loadSiteContent` (`GET /api/site-content`). |
| `*` | `pages/NotFoundPage.tsx` | 404. | None. |

### 4.2 Admin console pages (`/admin/*`, gated by `AdminLayout.tsx`)

| Route | File | Capability (UI gate; server re-checks) | Main calls |
|---|---|---|---|
| `/admin` | `AdminDashboardPage.tsx` | any staff | `fetchAdminAnalytics`, `fetchAdminServiceRequests`, `updateAdminServiceRequest`. |
| `/admin/analytics` | `AdminAnalyticsPage.tsx` | `analytics.read` | `fetchAdminAnalytics` (`GET /api/admin/analytics`). |
| `/admin/queue` | `AdminQueuePage.tsx` | `service_request.read` | `fetchAdminServiceRequests`, `updateAdminServiceRequest`. |
| `/admin/cbt` | `AdminCbtPage.tsx` | `cbt.read` | `GET/POST /api/admin/cbt/exams`, `PATCH/DELETE /api/admin/cbt/exams/:id`, `GET/POST /api/admin/cbt/exams/:id/questions`, `PATCH/DELETE /api/admin/cbt/questions/:id` (via `adminApiFetch`). |
| `/admin/banks` | `AdminBankSecurityPage.tsx` | `cbt.read` | `fetchAdminBanks`, `classifyAdminBank`, `setAdminBankRelease`, candidate assign/revoke/search, history. |
| `/admin/news` | `AdminNewsPage.tsx` (+ `AdminNewsroomQueue`) | `news.read` | News CRUD + newsroom candidates/runs/ingest + `uploadAdminImage`. |
| `/admin/users` | `AdminUsersPage.tsx` | `user.read` | `fetchAdminUsers`, `fetchAdminUserActivity`, `setUserSuspended`, `updateAdminUserRole`. |
| `/admin/content` | `AdminContentPage.tsx` | `calendar.read` | Calendar items CRUD (`fetchAdminCalendarItems` etc.). |
| `/admin/opportunities` | `AdminOpportunitiesPage.tsx` | `opportunity.read` | Opportunities CRUD. |
| `/admin/schools` | `AdminSchoolsPage.tsx` | `institution.read` | Institutions CRUD. |
| `/admin/services` | `AdminServicesPage.tsx` | `service.read` | Services CRUD + service guides (`GET/PUT/DELETE /api/admin/services/:id/guide`). |
| `/admin/content-manager` | `AdminContentManagerPage.tsx` | `data.read` | Generic resource CRUD + bulk import (`/api/admin/content-manager/*`). |
| `/admin/pdf-bank` | `AdminPdfBankPage.tsx` | `data.read` | `fetchAdminPdfBank`, `uploadAdminPdf`, `routeAdminPdf`. |
| `/admin/question-imports` | `AdminQuestionImportPage.tsx` | `cbt.manage` | Full import workflow (upload → review → commit). |
| `/admin/site` | `AdminSitePage.tsx` | `site.read` | `fetchAdminSiteContent`, `saveAdminSiteSettings`, `saveAdminSitePage`, revisions/restore. |

`AdminLayout.tsx` resolves the session by calling `GET /api/admin/session`
with the bearer token (server is source of truth for capabilities) and
falls back to a direct `profiles` read + `capabilitiesForRole()` only when
the API is unreachable. Navigation is filtered by `hasCapability()`; deep
links to a section without the capability render `AdminSectionDenied`.
**The server enforces the same capability on every route — UI gating is
never the boundary.**

---

## 5. Components and reusable functionality

| Component | File | Reusable behaviour the backend must support |
|---|---|---|
| `HubLayout`, `HubSideRail`, `SiteFooter`, `BrandLogo`, `PageBar`, `SectionHead`, `FilterPills`, `ServiceCard`, `CardIdentityMark`, `ExamSimulatorGrid` | `src/components/*.tsx` | Public shell. `SiteFooter` consumes `loadSiteContent()`. No backend calls except via the libs above. |
| `AsyncState` (`ErrorState`, loading/empty), `Skeleton`, `WaveLoader`, `ConnectionBanner`, `EnvironmentBanner`, `CookieConsent`, `PwaRegister` | `src/components/*.tsx` | Error/loading/offline UX. `ConnectionBanner` reacts to `isOffline()` (`src/lib/failures.ts`). No backend calls. |
| `CbtHistoryPanel`, `ContinuePracticeCard`, `CbtResultSlip` | `src/components/*.tsx` | CBT history/resume/scorecard rendering. Depend on `fetchCbtHistory` / `fetchCbtResult` shapes. |
| `ScientificCalculator` | `src/components/ScientificCalculator.tsx` | In-exam calculator. Pure client. |
| `PublicPdfList` | `src/components/PublicPdfList.tsx` | Renders `fetchPublicPdfDocuments()` results (signed URLs). |
| `NewsSections` | `src/components/NewsSections.tsx` | News grouping by category. Pure rendering over `NewsItem[]`. |
| `useSiteContent` | `src/components/useSiteContent.ts` | Hook over `loadSiteContent()` cache. |
| `AdminKit` (`AdminEmptyState`, `Metric`, `BarStat`, `StatusBadge`, `TimeAgo`, `RequestActions`, `AuditTimeline`, `useAdminHealth`, skeletons) | `src/components/admin/AdminKit.tsx` | Admin rendering helpers. `useAdminHealth` calls `GET /api/health/ready`. |
| `Can` / `AdminCapabilityProvider` | `src/components/admin/Can.tsx` | Capability-gated rendering inside admin. Mirrors server capabilities. |
| `AdminRichTextEditor`, `AdminNewsroomQueue` | `src/components/admin/*` | News editing + newsroom review queue UI. Depend on news/newsroom API shapes. |
| `SecurityModal` | `src/components/dashboard/SecurityModal.tsx` | Password change, MFA enrol/challenge/verify/unenrol, sign-out-others, `mfa_enabled` flag. Direct Supabase Auth calls. |
| `CgpaCalculatorCard`, `SchoolFinderCard` | `src/components/dashboard/*` | Dashboard widgets. `SchoolFinderCard` defines the `Institution` type used by school pages. |
| `SkipLink` | `src/components/a11y/SkipLink.tsx` | Accessibility. No backend. |

**Shared client utilities the backend must stay compatible with:**

- `src/lib/failures.ts` — `EduReachError`, `isOffline()`, failure kinds.
- `lib/errors.ts` — `userFacingError()`, `httpStatusForErrorMessage()`.
  Shared by browser and server; error-message regexes (e.g. `/expired/`,
  `/not found/`, `/permission/`) drive status mapping. **Keep error
  messages in the same vocabulary** (see `API-REQUIREMENTS.md` §1.3).
- `src/lib/cbt-config.ts` — `DEFAULT_CBT_LIMITS` (5–100 questions, 5–240
  minutes, max 9 subjects), `normalizeSubject()`, `compulsorySubjectKeys()`,
  `JAMB_PAPER_STANDARD` (180 Q / 120 min, English 60 + 40×3), `previewPlan()`,
  `validateSession()`, `mockCombinationError()`. Mirrors server rules; the
  server is authoritative.
- `src/lib/capabilities.ts` — the single capability vocabulary (see
  `AUTHENTICATION-AND-PERMISSIONS.md`). Imported by browser, server, and
  tests. **The new backend must reuse this exact vocabulary.**
- `src/lib/analyticsTaxonomy.ts` — allowed analytics events + metadata
  schema. The server validates against the same taxonomy.
- `src/lib/html-sanitize.ts`, `src/lib/searchMatch.ts`, `src/lib/dates.ts`,
  `src/lib/navigation.ts`, `src/lib/pageMeta.ts`, `src/lib/seoMeta.ts` —
  pure client helpers; no backend impact.

---

## 6. Static (bundle-shipped) data — not backend data

These are compiled into the JS bundle and must **not** be re-implemented as
backend tables unless the product decides to govern them:

| File | Contents | Backend implication |
|---|---|---|
| `src/data/hubContent.ts` | `hubServices` (fallback service catalogue), `jobs` (fallback listings), `EDUREACH_WHATSAPP` number, channel URL. | Fallback only. When the backend is configured, `service_catalog` / `opportunities` tables win. New backend should seed the same four live services (see `src/data/liveServices.ts`). |
| `src/data/liveServices.ts` | `LIVE_SERVICE_SLUGS = ['nelfund-loan','results','jamb-slip','admission-letters']`. | Only these slugs get a live form; others render `ComingSoonPage` (unless Supabase is configured, in which case any active catalogue row gets a form). |
| `src/data/services.ts` | 16 service definitions (brand + EduReach) with categories. | Catalogue display data. Backend `service_catalog` is the governed copy. |
| `src/data/serviceGuides.ts` | Step-by-step guides (with `public/images/service-guides/*.webp`). | Fallback when `service_guides` table has no published row. |
| `src/data/examPreparation.ts` | `jambCourses`, subject catalogues per track, `postUtmeSchools`, `pastQuestionLibrary`, `studyMaterialLibrary`, `admissionMethodProfiles`. | Static guidance/search data. The **authoritative** subject list for CBT setup comes from `cbt_subject_catalog` + bank availability, not from this file. |
| `src/data/studentOptions.ts` | `commonInstitutions`, `faculties`, `courseProgrammes`, `departments`, `levels`, `academicSessions`. | Profile-completion dropdowns. Free-text "Other" is allowed; the backend must accept arbitrary strings for these fields (no FK to a lookup table). |
| `src/data/newsCategories.ts` | Canonical news categories + slug helpers. | Backend `news_articles.category` / `category_slug` must use the same slugs. |
| `public/news/photos/*`, `public/icons/brands/*`, `public/icons/services/*`, `public/logo/*` | Images. | Static assets. No backend. |

---

## 7. Existing backend dependencies (Express API)

The existing server is `server.ts` (Express 4) + `lib/` + `src/server/`,
wrapped for Netlify by `netlify/functions/api.ts` (`serverless-http`).
`netlify/functions/daily-news-refresh.ts` is a scheduled newsroom trigger.
`Dockerfile` runs `npm start` (`scripts/start.mjs`) for self-hosting.

**Server modules:**

| File | Responsibility |
|---|---|
| `server.ts` | All route registrations (~90 routes), security headers/CSP, compression, rate-limit wiring, CBT handlers, admin handlers, sitemap/robots, static serving, Vite middleware in dev. |
| `lib/auth.ts` | `verifyJWT()` — validates Supabase JWT via `auth.getUser()`, loads `profiles.role`, resolves capabilities. |
| `lib/authorization.ts` | `requireStaff`, `requireCapability(...)`, `can()`/`assertOwnership()`, `recordAudit()` (via `admin_audit_log` RPC). |
| `lib/rate-limit.ts` | In-process sliding-window + durable `check_rate_limit` RPC. Rules in §10. |
| `lib/supabase-server.ts`, `lib/supabase-config.ts` | Service-role client construction + key validation (refuses publishable keys as service keys). |
| `lib/errors.ts` | `userFacingError()`, `httpStatusForErrorMessage()`. |
| `lib/image-signature.ts`, `lib/pdf-signature.ts` | Magic-byte validation for uploads. |
| `src/server/question-import/routes.ts` | Question-import routes + extraction pipeline (`extract.ts`, `validate.ts`). |
| `src/server/restrictedBanks/routes.ts` | Bank classification/candidate admin routes. |
| `src/server/siteContent.ts` | Site-content public + admin routes. |
| `src/server/newsroom/*.ts` | News ingestion pipeline (fetch/parse/classify/dedupe/quality gate). |
| `src/server/notifications.ts`, `src/server/jobRuns.ts`, `src/server/seo.ts`, `src/server/questionBankList.ts`, `src/server/questionProvenance.ts` | Notification writes, scheduled-job observability, sitemap/robots, question listing, provenance guard. |

**The new backend replaces all of the above.** It must re-implement the
route surface in `API-REQUIREMENTS.md` with the same paths, methods,
request/response shapes, auth/capability rules, and error vocabulary.
It must **not** reuse the Supabase RPCs, RLS policies, or migration history
— those are implementation details of the old backend. Where the old
backend enforced a rule in SQL (CBT paper freezing, bank classification,
provenance guard), the new backend must enforce the same rule in its own
PostgreSQL schema + application code (see `DATABASE-REQUIREMENTS.md`).

---

## 8. Authentication and authorization dependencies (summary)

Full detail in `AUTHENTICATION-AND-PERMISSIONS.md`. Key dependencies:

- **Identity provider today:** Supabase Auth (email/password, email
  verification, password reset via email link, TOTP MFA). The browser holds
  the session; the Express server only verifies the JWT.
- **Token transport:** `Authorization: Bearer <Supabase access JWT>` on
  every authenticated API call. No cookies.
- **Authorization:** capability-based (`src/lib/capabilities.ts`, 30
  capabilities, 4 roles: `student`, `content_editor`, `service_admin`,
  `super_admin`; legacy `admin`/`moderator` → `super_admin`; retired
  `senate_admin`/`campus_agent` → `student`). Server re-reads
  `profiles.role` on every request. Owner-scoped capabilities never grant
  access to another user's rows, even for staff.
- **Protected routes:** `ProtectedRoute` (dashboard/profile/settings/track)
  + `AdminLayout` session gate + per-route `requireCapability` on the
  server. CBT result/paper routes additionally check attempt ownership
  (mismatch → 404, never 403, to avoid leaking existence).
- **Bootstrap:** `POST /api/admin/bootstrap` promotes the account whose
  email matches `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` to first admin
  (rate-limited 5/15 min). Sign-in also probes `GET /api/admin/session`
  to decide whether to route to `/admin`.

---

## 9. Direct database access from the browser

### 9.1 Direct Supabase PostgREST reads/writes (must be replaced or kept deliberately)

| Table / RPC | Caller(s) | Operation |
|---|---|---|
| `profiles` | `AuthPageV2` (upsert after signup), `ProfileCompletionPage` (upsert), `StudentDashboardV2` (select), `CbtResultsPage` (select name/matric/JAMB reg), `SecurityModal` (update `mfa_enabled`) | Read own profile; upsert own profile. **Role column is never client-writable** (column grants + RLS). |
| `service_catalog` | `api.ts` `fetchServices`/`fetchService`, `StudentDashboardV2` | Public read of active services. |
| `institutions` | `SchoolFinderPage`, `SchoolDetailsPage`, `StudentDashboardV2`, `api.ts` `fetchPostUtmeInstitutions` | Public read (limit 400, ordered by name). |
| `news_articles` | `api.ts` `fetchNews`/`fetchNewsItem` | Public read of published articles, with 3-tier column fallback (governed → categorised → legacy) for unmigrated DBs. |
| `cbt_exams` | `api.ts` `fetchCbtExams`, `fetchCbtResult` fallback | Public read of active exams (legacy path; configured path uses `GET /api/cbt/exams`). |
| `cbt_attempts` | `StudentDashboardV2`, `api.ts` `fetchCbtResult` fallback | Owner-scoped read of own attempts (limit 50). |
| `cbt_subject_catalog` | `api.ts` `fetchCbtSubjectCatalog` | Public read of active subjects by exam body. |
| `service_requests` | `StudentDashboardV2` | Owner-scoped read of own requests (limit 50). |
| `student_saved_items` | `src/lib/studentDashboard.ts` | Owner CRUD (upsert on `user_id,item_type,item_key`). |
| `student_notifications` | `src/lib/studentDashboard.ts` | Owner read/insert/update (`read_at`). |
| `student_cgpa_terms`, `student_cgpa_courses` | `src/lib/studentDashboard.ts` | Owner insert/read (snapshot persistence). |
| `student_security_events` | `src/lib/studentDashboard.ts` `recordSecurityEvent()` | Owner insert (append-only). |
| RPC `submit_service_request_idempotent` | `api.ts` `submitServiceRequest` | Idempotent service-request creation. Args: `p_service_key`, `p_form_data`, `p_submission_key` (UUID v4), `p_expected_user_id`, `p_recovery_only`. Returns `{id, reference_code, status, created_at}`. |
| RPC `get_cbt_result` | `api.ts` `fetchCbtResult` | Result rows for an attempt (with `cbt_attempts` + paper fallbacks). Args: `p_attempt_id`. |

### 9.2 Direct Supabase Auth calls

`signUp`, `signInWithPassword`, `signOut` (+ `signOut({scope:'others'})`),
`resetPasswordForEmail`, `updateUser({password})`, `resend({type:'signup'})`,
`getSession`, `getUser`, `onAuthStateChange`, `mfa.listFactors/enroll/
challenge/verify/unenroll`. See `AUTHENTICATION-AND-PERMISSIONS.md`.

### 9.3 What the browser must never do (and doesn't)

- Never reads `exam_questions.correct_option` / `explanation` directly.
  Question content for students is served only via
  `GET /api/cbt/attempts/:id/paper` (no keys) and post-submission results.
- Never writes `cbt_attempts`, `cbt_answers`, `exam_questions`,
  `question_imports`, `cbt_bank_security`, or any admin table directly.
- Never holds the service-role key. `vite.config.ts` has a build-time guard
  (`reject-privileged-client-values`) that fails the build if a privileged
  key appears in `VITE_*` env. `scripts/client-secret-guard.ts` enforces
  the same. **The new backend must keep this guard** (or its equivalent)
  if the frontend is kept.

### 9.4 Candidate / disabled migrations (do not treat as live schema)

- `supabase/candidates/*.sql` (7 files: restricted-bank policy foundation,
  readers, results, admin, provenance, CBT revision protocol, active-attempt
  deletion guard) are **incomplete local candidates — explicitly marked
  "DO NOT DEPLOY"**. They define `cbt_bank_security`,
  `cbt_bank_candidate_assignments`, `cbt_v2_operations`,
  `cbt_v2_writing_sessions` and related predicates, but the live server
  already references `cbt_bank_security` / `cbt_bank_candidate_access` —
  meaning production must have an equivalent applied outside this repo, or
  those routes fail closed with 503. **The new backend must design its own
  bank-security schema from `DATABASE-REQUIREMENTS.md`, not by copying
  these files.**
- `supabase/disabled-migrations/` (2 files) are retired seed scripts.
- `supabase/rollbacks/` contains rollbacks for the 4 CBT v2 migrations.

---

## 10. Storage dependencies

| Bucket | Visibility | Used by | Backend requirement |
|---|---|---|---|
| `past-questions` | Private | Question-import source files (`src/server/question-import/routes.ts`: upload, download for extraction, signed URL 300 s for source view, delete). | Private object storage for import sources. Signed URLs short-lived. |
| `resource-files` | Private | PDF bank + past-question resources (`server.ts`: upload, `createSignedUrl(...,300)` for public document delivery). | Private storage; public delivery only via short-lived signed URLs after `status='routed' && source_verified=true` checks. |
| `admin-content` | Public (via `getPublicUrl`) | Admin image uploads (`POST /api/admin/uploads` → `{url, path, bytes}`). | Public media storage for news/opportunity/institution images. Must validate image magic bytes + size (5 MB JSON limit). |

No other storage buckets are referenced. The new backend needs an
equivalent three-bucket (or three-prefix) design; see
`BACKEND-IMPLEMENTATION-BRIEF.md` §5.

**Upload constraints (observed):** JSON body limit 1 MB default; 5 MB for
`/api/admin/uploads`; 15 MB for `/api/admin/pdf-bank/upload`; question-import
upload accepts `.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.docx,.xlsx,.zip`
(`IMPORT_UPLOAD_ACCEPT`) with server-side extraction (`pdf-parse`, `jszip`,
`fast-xml-parser`). PDF bank rows are capped at 10 MB (`document_bank.
file_bytes <= 10485760`).

---

## 11. Environment variables and configuration

Single source of truth: `src/lib/envContract.ts` (`ENV_CONTRACT`), checked
by `scripts/env-check.ts` / `scripts/prod-validate.ts`. **The new backend
must define its own env contract; this table is the compatibility baseline.**

| Variable | Visibility | Required | Purpose / consumed by |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client (inlined at build) | required | Supabase project origin. `src/lib/supabase.ts`, `server.ts`. Alias `SUPABASE_URL` (server-only fallback). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | required | Browser key (public by design; RLS applies). Aliases: `VITE_SUPABASE_ANON_KEY` (client, legacy), `SUPABASE_ANON_KEY` (server-only). |
| `SUPABASE_SERVICE_ROLE_KEY` | server secret | required | Bypasses RLS. Admin routes, newsroom, analytics. Alias `SUPABASE_SECRET_KEY`. **Must never be prefixed `VITE_`.** Build fails if it is. |
| `NODE_ENV` | server | required | Selects strict production headers (CSP/HSTS/X-Frame-Options) in `server.ts`. |
| `EDUREACH_SITE_URL` | server | recommended | Canonical origin for sitemap/canonical URLs (`src/server/seo.ts`). |
| `EDUREACH_NEWSROOM_USER_AGENT` | server | recommended | Newsroom crawler User-Agent (`src/server/newsroom/run.ts`). |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | server | optional | Email allowed to bootstrap first admin (`POST /api/admin/bootstrap`). Leave unset in steady state. |
| `PORT` | server | optional | Listen port for self-hosted Express (default 3000). |
| `CBT_V2_LOCAL_REHEARSAL` | server | optional (dev only) | Enables v2 rehearsal routes **only** when `=1`, `NODE_ENV!=production`, no `NETLIFY`, and Supabase URL is `http://localhost|127.0.0.1` (`server.ts` `cbtV2LocalRehearsalEnabled()`). **Not a rollout switch. Must not be enabled in production.** |
| `DISABLE_HMR` | build/dev | optional | Disables Vite HMR (`vite.config.ts`). |
| `EDUREACH_SMOKE_URL`, `STAGING_PROJECT_REF` | scripts | optional | Smoke-test / staging scripts only. |

**New-backend env (proposed, see implementation brief):** `DATABASE_URL`,
`JWT_SECRET` (or Supabase JWKS config if keeping Supabase Auth),
`FRONTEND_ORIGIN` (CORS), `STORAGE_*` credentials, `PORT`, `NODE_ENV`,
`EDUREACH_SITE_URL`. The frontend's `VITE_*` variables stay as-is if
Supabase Auth is kept; if auth is owned by the new backend, the frontend
needs a new `VITE_API_BASE_URL` (see integration plan).

---

## 12. Non-functional requirements visible from the frontend

- **Performance budgets:** `scripts/perf-audit.ts`, `tests/e2e/perf.spec.ts`
  (mobile profile). Admin pages are code-split into an `admin-pages` chunk;
  Supabase client into its own chunk. API responses must stay small
  (catalogue endpoints page/limit; news limit 30; dashboard limit 50;
  content-manager limit 500; import batch limit 2,000 rows).
- **Rate limits** (`lib/rate-limit.ts`): `apiGeneral` 1,200/min per IP;
  `cbtStart` 60/10 min per user; `guestCbtSubmit` 30/10 min;
  `adminBootstrap` 5/15 min; `adminUpload` 20/10 min per user;
  `adminImport` 10/10 min per user; `adminNewsroomRun` 6/hour per user;
  `analyticsEvent` 240/min. Headers: `RateLimit-Limit`,
  `RateLimit-Remaining`, `Retry-After`; 429 body `{ error: 'Too many
  requests...' }`. Durable counter via `check_rate_limit` RPC (fails open
  with a log when missing). **The new backend must reproduce these limits
  and headers.**
- **Security headers:** `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  production CSP + `X-Frame-Options: SAMEORIGIN` + HSTS
  (`max-age=31536000`). `Cache-Control: no-store` on `/api/*`.
  `X-Robots-Tag: noindex, nofollow` on private paths. `public/_headers`
  mirrors these for Netlify static. **Reproduce in the new backend.**
- **Compression:** `compression` middleware (threshold 1 KB) on the
  self-hosted path.
- **Analytics retention:** 90 days (`RETENTION_DAYS` in
  `src/lib/analyticsTaxonomy.ts`); `site_analytics_events` retention job.
- **Error telemetry:** `src/lib/errorTelemetry.ts` (client-side, consent-
  gated). No backend endpoint required beyond analytics ingestion.

---

## 13. What is NOT in the frontend (do not invent)

- No payment/checkout UI flow that calls a backend (wallet tables exist in
  the DB, but no frontend payment integration was found; `credit_wallet_
  payment` RPC is server-only).
- No real-time channels (no Supabase Realtime subscriptions, no websockets).
- No push notifications (in-app notifications only).
- No file upload from students (uploads are admin-only).
- No guest CBT attempt persistence server-side (guest results are
  localStorage-only; guest *scoring* is server-side via
  `POST /api/cbt/guest-submit`).
- No NABTEB CBT (route renders `ComingSoonPage`).
- No parent/teacher dashboards (account types exist in metadata, but all
  dashboards are student-shaped).

---

## 14. Open questions for the backend build (unresolved assumptions)

1. **Identity provider decision** — keep Supabase Auth (zero frontend auth
   change) vs. own auth in the new backend (full control, frontend rewrite).
   This is the single largest decision; see
   `AUTHENTICATION-AND-PERMISSIONS.md` §8 and the implementation brief §2.
2. **Bank-security schema provenance** — the live server references
   `cbt_bank_security` / `cbt_bank_candidate_access`, but the only
   definitions in-repo are non-deployable candidates. The new backend must
   design this fresh; it cannot recover the exact production shape.
3. **Email delivery** — verification/reset emails are sent by Supabase Auth
   today. If auth moves, the new backend needs an email provider (none is
   configured in this repo; WhatsApp links are static `wa.me` deep links).
4. **Newsroom ingestion** — the pipeline (`src/server/newsroom/`) fetches
   external RSS/Atom feeds. Whether the new backend re-implements ingestion
   or treats news as manually-curated content is a product decision.
5. **Content-manager generic CRUD** — `CONTENT_RESOURCES` in `server.ts`
   exposes arbitrary tables via validated field lists. The new backend
   should replace this with explicit per-resource endpoints (see
   `API-REQUIREMENTS.md` §9) rather than a generic table gateway.

---

# Part B — API Requirements

> **Source document:** `API-REQUIREMENTS.md` (Part B of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A, C–G within this package.

---

# EduReach Hub — API Requirements

> **Purpose.** Every API operation the frontend currently needs, with method,
> endpoint, request/response shapes, auth, permissions, errors, and the
> calling frontend function/component. **Nothing here is invented** — every
> row was read from `src/lib/api.ts`, `src/lib/studentDashboard.ts`,
> `src/lib/siteContent.ts`, `pages/*.tsx`, or `server.ts` route
> registrations. Where the frontend needs something that does **not**
> currently exist as an endpoint, it is marked **[PROPOSED — does not
> exist]**.
>
> **Base URL.** Frontend calls use `/api/...` paths rewritten by
> `src/lib/apiBase.ts` (`apiUrl()`): dev → `/api`, production →
> `/.netlify/functions/api`. The new backend must accept both prefixes
> (strip `/.netlify/functions` if present, as `server.ts` does) or the
> frontend base must be repointed. All paths below are written as `/api/...`.
>
> **Conventions (observed, must be preserved):**
> - JSON everywhere (`Content-Type: application/json`). Uploads are JSON
>   with base64 `dataUrl` fields (not multipart), except where noted.
> - Auth: `Authorization: Bearer <Supabase JWT>` on every non-public route.
> - Success bodies are **plain objects/arrays, not wrapped** in an envelope
>   (e.g. `{ items: [...] }`, `{ item: {...} }`, `{ attempt: {...} }`).
> - Errors: `{ "error": "<message string>" }` with an HTTP status. The
>   frontend's `userFacingError()` also tolerates `{ error: { message } }`.
>   **Do not introduce `{ error: { code, message } }` without updating the
>   frontend** — `jsonFetch` passes `body.error` to `userFacingError`,
>   which handles both, but status mapping is by HTTP code + message regex.
> - Timestamps: ISO-8601 UTC strings. Answer indices: **0-based integers**
>   (0=A, 1=B, 2=C, 3=D). Question positions: **1-based integers**.
> - IDs: UUID strings, except guest attempt ids (`guest-cbt-<ts>-<rand>`)
>   and local ids (`local-cbt-*`), which never reach the server.
> - Rate limits: `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`
>   headers; 429 body `{ error: 'Too many requests. Please slow down and
>   try again shortly.' }`.
> - `Cache-Control: no-store` on all `/api/*` responses.

### Error status vocabulary (observed in `server.ts` + `lib/errors.ts`)

| Status | Meaning | Frontend kind |
|---|---|---|
| 400 | Validation (bad body shape, invalid answer value) | `validation` |
| 401 | No/invalid token (`Authentication required.` / `Invalid or expired session.`) | `auth` |
| 403 | Authenticated but lacking capability (`You do not have permission to perform this action.`) | `forbidden` |
| 404 | Not found **or deliberately hidden** (other user's attempt, restricted/unclassified bank) | `not-found` |
| 409 | Conflict (already submitted, expired, protocol mismatch, stale revision, duplicate) | `validation` (via `failureKindForStatus` fallback) — CBT callers branch on message text |
| 413 | Payload too large (body limit) | `validation` |
| 422 | Domain validation (subject combination, question count, no questions for subjects) | `validation` |
| 429 | Rate limited | `rate-limited` |
| 503 | Dependency unavailable (DB unconfigured, bank policy unavailable, v2 rehearsal disabled, infrastructure error) | `server` (retryable) |

**Important:** CBT handlers map unrecognised errors to **503, never 400**
(`httpStatusForErrorMessage`), so the session page can classify them as
"connection problem, press Submit again". Preserve this.

---

## 1. Health, platform, and SEO

| # | Method & endpoint | Auth | Request | Response | Caller |
|---|---|---|---|---|---|
| 1.1 | `GET /api/health` | none | — | `{ status: 'ok', service: 'edureach' }` | Uptime monitors; `useAdminHealth` (via `/api/health/ready`). |
| 1.2 | `GET /api/health/ready` | none | — | `{ status: 'ready'\|'degraded', checked_at, checks: { server, supabase_configured, database, cbt_protocol_schema }, database_latency_ms }`; 200 when ready, 503 when degraded. | `AdminKit.useAdminHealth`. New backend: replace `supabase_configured`/`cbt_protocol_schema` checks with `database` + `schema` equivalents. |
| 1.3 | `GET /sitemap.xml`, `GET /api/sitemap.xml` | none | — | XML sitemap (public paths only; private paths excluded via `isNonIndexablePath`). | Crawlers. `src/server/seo.ts`. |
| 1.4 | `GET /robots.txt`, `GET /api/robots.txt` | none | — | robots.txt. | Crawlers. |
| 1.5 | `GET /api/admin/jobs` | `analytics.read` | — | Scheduled-job run history (`scheduled_job_runs`). | Admin dashboard health widget. |
| 1.6 | `GET /api/admin/integrity` | `data.read` | — | Content-integrity report (counts: active exams with no questions, missing options, invalid answers, duplicate positions, etc.). | Admin dashboard. |

---

## 2. Public catalogue and content (no auth)

| # | Method & endpoint | Auth | Request | Response | Caller |
|---|---|---|---|---|---|
| 2.1 | `GET /api/cbt/exams` | none | — | `{ items: CbtExamSummary[] }` where each item is `{ id, title, exam_body, subject, description, duration_minutes, institution_id, question_count, subject_count, subjects: [{subject, questionCount}] }`. **Only `public`-classified banks are listed** (unclassified/restricted banks are invisible, including counts). | `fetchCbtExamsWithAvailability()` → `CbtPage`, `CbtPracticeEntryPage`, `ExamSetupPage`, `SearchPage`. |
| 2.2 | `GET /api/cbt/exams/:examId/subjects` | none for public banks; bearer + `cbt.attempt` for restricted banks | — | `CbtBankPayload`: `{ exam: { id, title, examBody, subject, description, defaultDurationMinutes, formatStatus, officialGuidanceUrl, formatNotes, guidanceYear }, subjects: [{subject, questionCount}], totalQuestions, limits: {minQuestions, maxQuestions, minMinutes, maxMinutes, maxSubjects}, review: {approved, needsReview, rejected, total}, mock: {questionCount, subjectQuota, durationMinutes}, rules: {compulsorySubjects, compulsoryMissing, minSubjects, maxSubjects} }`. Restricted/unclassified bank without valid assignment → **404** (never 403). | `fetchCbtBank()` → `ExamSetupPage`. |
| 2.3 | `GET /api/services` | none | — | `{ items: ServiceItem[] }` (active only, `sort_order` then `title`). | Server equivalent of `fetchServices()` (browser currently reads Supabase directly; see §10). |
| 2.4 | `GET /api/services/:slug` | none | — | `{ item: ServiceItem }` or 404. | Server equivalent of `fetchService()`. |
| 2.5 | `GET /api/services/:slug/guide` | none | — | `{ guide: ServiceGuide \| null }` (published `service_guides` row, else null → frontend falls back to static guide). | `ServiceApplyPage` (via `apiUrl`). |
| 2.6 | `GET /api/upcoming` | none | — | `{ items: UpcomingItem[] }` (`{id, kind:'deadline'\|'exam', title, description, due_at, starts_at, location, priority}`). Empty array when no feed. | `fetchUpcoming()` → `HubHomePage`, `EventsPage`. |
| 2.7 | `GET /api/news` | none | — | `{ items: NewsItem[] }` (published, fresh only, limit 30, `published_at` desc). | Server equivalent of `fetchNews()` (browser currently reads Supabase directly). |
| 2.8 | `GET /api/news/:slug` | none | — | `{ item: NewsItem }` or 404. Expired articles remain reachable here. | Server equivalent of `fetchNewsItem()`. |
| 2.9 | `GET /api/opportunities` | none | — | `{ items: Opportunity[] }` (active, unexpired). | `fetchOpportunities()` → `JobsPage`, `SearchPage`. |
| 2.10 | `GET /api/opportunities/:opportunityId` | none | — | `{ item: Opportunity }` or 404. | `fetchOpportunity()` → `OpportunityDetailsPage`. |
| 2.11 | `GET /api/public/documents` | none | Query: `destination` (required, one of `admission_guides\|scholarships\|news_attachments\|school_resources`), `institution_id`, `opportunity_id`, `news_article_id` (required for the matching destination; missing → `{ items: [] }`). | `{ items: PublicPdfDocument[] }` (`{id, title, description, source_name, source_url, destination, institution_id, news_article_id, opportunity_id, subject, course, paper_year, href (signed URL or source_url), created_at}`). Only `status='routed' && source_verified=true` rows. | `fetchPublicPdfDocuments()` → `PublicPdfList`, `SchoolDetailsPage`, `OpportunityDetailsPage`, `NewsArticlePage`. |
| 2.12 | `GET /api/past-questions/resources` | none | Query: `exam`, `subject`, `institution` (all optional). | `PastQuestionLibrary`: `{ items: PastQuestionResource[], coverage: [{exam_body, subjects, papers, institutions, latest_year}], configured: boolean, state: 'available'\|'not-published'\|'not-configured' }`. Each resource: `{id, examBody, institutionId, subject, course, year, title, description, sourceName, sourceUrl, state:'available'\|'external'\|'unavailable', access:'view'\|'download', href, verifiedAt}`. | `fetchPastQuestionResources()` → `PastQuestionsPage`, `ExamSetupPage`. |
| 2.13 | `GET /api/site-content` | none | — | `{ settings: {brand, footer, contact, social}, pages: [{slug, title, summary, body, status, reviewState, revision, updatedAt, publishedAt}] }` (published only). | `loadSiteContent()` → footer, `LegalPage`, `RefundPolicyPage`. |
| 2.14 | `POST /api/analytics/event` | none | `{ event_name, path, session_id, referrer, metadata }` (taxonomy-validated; rate limit 240/min). | `{ ok: true }` (or 204-equivalent JSON). Failures silent client-side. | `trackEvent()` (all pages). |

---

## 3. Student CBT — configured sessions (authenticated)

All routes in this section require `Authorization: Bearer <JWT>` and
capability `cbt.attempt` (owner-scoped). Ownership failures return **404**.

| # | Method & endpoint | Request | Response | Caller |
|---|---|---|---|---|
| 3.1 | `POST /api/cbt/exams/:examId/attempts` (rate limit `cbtStart`: 60/10 min per user) | `{ mode: 'practice'\|'mock', subjects: string[], questionCount: number\|null, durationMinutes: number\|null, programme: string\|null }` | **201** (new) or **200** (resumed existing in-progress attempt): `{ attempt: CbtConfiguredStart }` = `{ id, startedAt, expiresAt, totalQuestions, mode, durationMinutes, subjects, plan: [{subject, questions, first, last}], resumed: boolean }`. Errors: 422 (no subjects / too many subjects / JAMB English missing / mock combination invalid / question count out of limits / no questions for subjects), 404 (bank not found or not accessible), 409 (could not create). | `startConfiguredCbt()` → `ExamSetupPage`. |
| 3.2 | `GET /api/cbt/attempts/:attemptId/paper` | — | `{ attempt: CbtAttemptPayload, questions: CbtQuestionPayload[], serverTime: ISO string, protocol: {version:1} \| {version:2, scope:'local-rehearsal'} }`. `CbtAttemptPayload` = `{ id, examId, status:'in_progress'\|'submitted'\|'expired'\|'cancelled', startedAt, expiresAt, mode, durationMinutes, programme, subjects, plan, totalQuestions, questionIndex, savedAnswers: Record<position, 0-based index>, exam: {id, title, examBody, subject} }`. `CbtQuestionPayload` = `{ position (1-based), subject, id, text, options: string[4] }` — **never includes `correct_option` or `explanation`**. Errors: 404 (not found/not owned/no bank access), 409 (expired / protocol mismatch / requires review), 503 (unavailable). | `fetchCbtAttemptPaper()` → `CbtSessionPage`, `fetchCbtResult` fallback. |
| 3.3 | `PATCH /api/cbt/attempts/:attemptId/draft` | `{ answers: Record<position, 0-based index>, questionIndex?: number }` | `{ saved: true, ... }`. Idempotent: re-saving the same draft is a no-op success. Errors: 400 (answers not an object), 409 (expired → also marks attempt expired via `cbt_expire_owned_attempt`; protocol mismatch), 503 (unrecognised). | `saveConfiguredCbtDraft()` → `CbtSessionPage` (debounced queue). |
| 3.4 | `POST /api/cbt/attempts/:attemptId/submit` | `{ answers: Record<position, 0-based index> }` | `{ attemptId, score: number\|null, correctAnswers: number\|null, totalQuestions: number, breakdown: [{question, subject?, selected, correct, explanation?, isCorrect?}] }`. **Server-authoritative scoring against the frozen paper.** Retried submit returns the stored result (idempotent). Errors: 400 (answers missing), 409 (expired / already submitted without result / no result produced), 503 (unrecognised). | `submitConfiguredCbt()` → `CbtSessionPage` (also caches result in localStorage). |
| 3.5 | `POST /api/cbt/attempts/:attemptId/abandon` | `{}` | `{ abandoned: true }`. | `abandonConfiguredCbt()` → `CbtSessionPage` "End Test". |
| 3.6 | `DELETE /api/cbt/attempts/:attemptId` | — | `{ deleted: boolean }`. Deletes own attempt/result. | `deleteCbtAttempt()` → `CbtResultsPage`, `CbtHistoryPanel`. Guest/local ids are handled client-side and never sent. |
| 3.7 | `GET /api/cbt/attempts?limit=N` | Query `limit` (default 25). | `{ items: CbtHistoryItem[] }` (newest first). `CbtHistoryItem` = `{ id, examId, examTitle, examBody, mode, programme, status, score, correctAnswers, totalQuestions, durationMinutes, subjects, startedAt, expiresAt, submittedAt, answered, resumable }`. | `fetchCbtHistory()` → `CbtPage`, `StudentDashboardV2`, `CbtHistoryPanel`. |
| 3.8 | `GET /api/cbt/attempts/:attemptId/progress` (legacy) | — | `{ answers, questionIndex, expiresAt, status }`. Owner + bank-access checked. | Legacy compatibility (no current frontend caller found; kept for older clients). New backend may keep or drop — see §11. |
| 3.9 | `PATCH /api/cbt/attempts/:attemptId/progress` (legacy) | `{ answers, questionIndex }` | `{ ok: true, saved }` via the same draft path as 3.3. | Legacy compatibility. |
| 3.10 | `POST /api/cbt/exams/:examId/start` (legacy) | `{ subjects?, ... }` | Legacy start response. | No current frontend caller (superseded by 3.1). New backend: **do not re-implement** unless an old client must be supported. |
| 3.11 | `POST /api/cbt/submit` (legacy) | `{ attemptId, answers }` (`examId` accepted but ignored) | `{ attemptId, score, breakdown }` via the same scorer as 3.4. | No current frontend caller. New backend: **do not re-implement** (single scorer via 3.4). |

---

## 4. Student CBT — guest practice (unauthenticated)

| # | Method & endpoint | Auth | Request | Response | Caller |
|---|---|---|---|---|---|
| 4.1 | `GET /api/cbt/exams/:examId/guest-questions` | none | Query: `subjects` (comma list, optional), `paperSeed` (optional). | `{ questions: [...] }` — question text + options **without keys**, from a **public-classified bank only**. Non-public/unclassified → 404. | Legacy guest flow (no current `src/lib/api.ts` caller; guest scoring is via 4.2). New backend: keep only if guest *question serving* is required; otherwise guest practice can be served via 2.2 + 4.2. See `CBT-BACKEND-REQUIREMENTS.md` §10. |
| 4.2 | `POST /api/cbt/guest-submit` (rate limit `guestCbtSubmit`: 30/10 min) | none | `{ examId, subjects: string[], answers: Record<position, 0-based index>, paperSeed?: string }` | `{ attemptId: 'guest-cbt-...', score, exam, attempt, answers, questions, breakdown }`. **Corrections are released per attempted question only**: `correct`/`explanation` are `null` for unattempted questions. Public banks only; otherwise 404. | Guest practice scoring (server-side; result cached in localStorage by the caller). |

---

## 5. Student CBT — v2 versioned protocol (local rehearsal only)

> **Status: DISABLED in production.** All four routes return **503**
> `CBT versioned rehearsal is unavailable.` unless
> `cbtV2LocalRehearsalEnabled()` is true (dev-only gate, see inventory §11).
> `POST .../finalize` additionally always returns 503
> (`CBT finalization is unavailable pending recovery verification.`) even
> when the gate is open. The frontend (`CbtSessionPage` + `useCbtPageWriter`)
> degrades to the v1 protocol (paper `protocol: {version:1}`) when v2 is
> unavailable. **The new backend must preserve this fence: do not enable a
> global v2 writing protocol without an explicit release decision.**
> The shapes below are the rehearsal contract the frontend validates
> (`validCbtV2Outcome`, `validCbtV2WritingSession` in `src/lib/api.ts`).

| # | Method & endpoint | Request | Response (200 or 409 with body) | Caller |
|---|---|---|---|---|
| 5.1 | `GET /api/cbt/v2/attempts/:attemptId/state` | — | `{ protocol: 2, revision: number, answers: Record<position, 0-based>, status: string, questionIds: string[] }`. 409 `CBT protocol mismatch.` for legacy attempts; 404 for non-owned/no-access. | `fetchCbtV2State()` → `CbtSessionPage` (v2 path only). |
| 5.2 | `POST /api/cbt/v2/attempts/:attemptId/session` | `{ protocol: 2, requestKey: UUID, takeover: boolean }` | `{ protocol: 2, outcome: 'created'\|'taken_over'\|'resumed'\|'takeover_required'\|'revoked'\|'expired', sessionId?, generation?, revision, answers, status:'in_progress' }`. `takeover_required`/`revoked`/`expired` → **409** (frontend treats as non-error via `acceptConflict`). | `openCbtV2WritingSession()` → `useCbtPageWriter`. |
| 5.3 | `PATCH /api/cbt/v2/attempts/:attemptId/answer` | `{ protocol: 2, expectedRevision, operationKey: UUID, questionId: UUID, selected: 0-3\|null, sessionId: UUID, sessionGeneration: number }` | `{ protocol: 2, outcome: 'accepted'\|'replayed'\|'conflict'\|'expired'\|'closed'\|'session_revoked', revision?, acceptedRevision?, answers?, status?, code?: 'CBT_SESSION_REVOKED' }`. `conflict`/`expired`/`closed`/`session_revoked` → **409** (accepted as valid body by frontend). | `sendCbtV2Operation(..., 'answer')` → `useCbtPageWriter` / `CbtAnswerQueue`. |
| 5.4 | `POST /api/cbt/v2/attempts/:attemptId/finalize` | `{ protocol: 2, expectedRevision, operationKey, sessionId, sessionGeneration }` | **Always 503** in the current build. Rehearsal shape (when implemented): `{ protocol: 2, outcome: 'submitted'\|'replayed'\|'already_submitted'\|'conflict'\|..., revision, result }`. | `sendCbtV2Operation(..., 'finalize')` — currently unreachable in production. |

---

## 6. Service requests (student)

| # | Method & endpoint | Auth | Request | Response | Caller |
|---|---|---|---|---|---|
| 6.1 | `POST /api/service-requests` **[PROPOSED — does not exist as a REST endpoint]** | bearer + `service_request.create` | `{ serviceSlug, details: Record<string, unknown>, expectedUserId, submissionKey: UUID v4, recoveryOnly?: boolean }` (same payload as the RPC below) | `{ id, reference_code, status, created_at }` | Replacement for RPC `submit_service_request_idempotent` (see §10). The frontend currently calls the RPC directly; the new backend should expose this REST endpoint and the frontend should be repointed (one function in `src/lib/api.ts`). |
| 6.2 | `GET /api/service-requests/mine` **[PROPOSED — does not exist]** | bearer + `service_request.read_own` | — | `{ items: [{id, status, form_data, created_at, reference_code, service_id}] }` (own only, newest first, limit 50) | Replacement for the direct `service_requests` read in `StudentDashboardV2`. |

---

## 7. Admin — session, users, service requests, analytics

All admin routes require `Authorization: Bearer <JWT>` + the listed
capability. Missing token → 401; insufficient capability → 403 with
`You do not have permission to perform this action.`

| # | Method & endpoint | Capability | Request | Response | Caller |
|---|---|---|---|---|---|
| 7.1 | `POST /api/admin/bootstrap` (rate limit 5/15 min) | none (email-locked to `EDUREACH_ADMIN_BOOTSTRAP_EMAIL`) | — | `{ ok: true }` / 403 if not the designated account. | `bootstrapAdmin()` → `AuthPageV2` (after sign-in, best-effort). |
| 7.2 | `GET /api/admin/session` | any staff (`requireStaff`) | — | `{ user: { id, email, fullName, role, capabilities } }`. 403 for students. | `AdminLayout` session resolution; `AuthPageV2` post-sign-in probe. |
| 7.3 | `POST /api/admin/session/verify` | any staff | — | `{ authenticated: true }`. | Admin session check (legacy/alternate probe). |
| 7.4 | `GET /api/admin/users?search=` | `user.read` | Query `search` (optional). | `{ items: AdminUser[] }` (`{id, full_name, school, faculty, department, level, role, matric_number, created_at, suspended?}`). | `fetchAdminUsers()` → `AdminUsersPage`. |
| 7.5 | `GET /api/admin/users/:userId/activity` | `user.read` | — | `AdminUserActivity`: `{ requests: [{id, reference_code, status, created_at, service_catalog?}], attempts: [{id, status, score, started_at, submitted_at, cbt_exams?}], requestError?, attemptError? }`. | `fetchAdminUserActivity()` → `AdminUsersPage`. |
| 7.6 | `POST /api/admin/users/:userId/ban` | `user.suspend` | — | `{ ok: true }`. | `setUserSuspended(id, true)` → `AdminUsersPage`. |
| 7.7 | `POST /api/admin/users/:userId/unban` | `user.suspend` | — | `{ ok: true }`. | `setUserSuspended(id, false)`. |
| 7.8 | `POST /api/admin/users/:userId/role` | `user.manage_roles` | `{ role: 'student'\|'content_editor'\|'service_admin'\|'super_admin' }` | `{ user: { id, role } }`. | `updateAdminUserRole()` → `AdminUsersPage`. |
| 7.9 | `GET /api/admin/service-requests?status=` | `service_request.read` | Query `status` (`all` or a status value). | `{ items: AdminServiceRequest[] }` (`{id, user_id, status, form_data, created_at, updated_at, reference_code, admin_note, service_catalog?: {title}}`). | `fetchAdminServiceRequests()` → `AdminDashboardPage`, `AdminQueuePage`. |
| 7.10 | `PATCH /api/admin/service-requests/:requestId` | `service_request.process` | `{ status?: string, admin_note?: string\|null, expected_updated_at?: string }` (optimistic concurrency; mismatch → 409). | `{ item: { id, status, admin_note, updated_at } }`. | `updateAdminServiceRequest()` → `AdminDashboardPage`, `AdminQueuePage`. |
| 7.11 | `GET /api/admin/analytics` | `analytics.read` | — | `AdminAnalytics`: `{ metrics: Record<string, number>, activity: { since, topPages, searches, zeroResultSearches, serviceViews, serviceSubmits, cbtStarts, eventsTotal } \| null, audit: [...], recentRequests: [...], recentUsers: [...] }`. `audit` only with `audit.read`. | `fetchAdminAnalytics()` → `AdminDashboardPage`, `AdminAnalyticsPage`. |

---

## 8. Admin — CBT banks, questions, and bank security

| # | Method & endpoint | Capability | Request | Response | Caller |
|---|---|---|---|---|---|
| 8.1 | `GET /api/admin/cbt/exams` | `cbt.read` | — | `{ items: AdminCbtExam[] }` (`{id, title, exam_body, subject, description, duration_minutes, is_active, format_status, official_guidance_url, format_notes, guidance_year, institution_id?, created_at?}`). | `fetchAdminCbtExams()` → `AdminCbtPage`. |
| 8.2 | `POST /api/admin/cbt/exams` | `cbt.manage` | `{ title, exam_body, subject, description?, duration_minutes, institution_id? (POST-UTME only), ... }` | `{ item: AdminCbtExam }`. | `AdminCbtPage` (via `adminApiFetch`). |
| 8.3 | `PATCH /api/admin/cbt/exams/:examId` | `cbt.manage` | Partial `AdminCbtExam` fields. | `{ item: AdminCbtExam }`. | `updateAdminCbtExam()` → `AdminCbtPage`. |
| 8.4 | `DELETE /api/admin/cbt/exams/:examId` | `cbt.manage` | — | `{ ok: true }` (guarded when content exists). | `deleteAdminCbtExam()` → `AdminCbtPage`. |
| 8.5 | `GET /api/admin/cbt/exams/:examId/questions?page=&pageSize=&search=&subject=&topic=&year=&review=` | `cbt.read` | Query filters. | `{ items: Question[], hasMore: boolean, nextPosition: number }` (includes answer keys — staff only). | `AdminCbtPage` (via `adminApiFetch`). |
| 8.6 | `POST /api/admin/cbt/exams/:examId/questions` | `cbt.manage` | `{ question_text, option_a..d, correct_option, explanation?, subject, position?, ... }` | `{ item: Question }`. Provenance refusal → 403 `question_provenance_refused` (see §12). | `AdminCbtPage`. |
| 8.7 | `PATCH /api/admin/cbt/questions/:questionId` | `cbt.manage` | Partial question fields. **Never accepts a bank move** (`exam_id` change → 403). | `{ item: Question }`. | `AdminCbtPage`. |
| 8.8 | `DELETE /api/admin/cbt/questions/:questionId` | `cbt.manage` | — | `{ ok: true }` (audited). | `AdminCbtPage`. |
| 8.9 | `GET /api/admin/cbt/banks` | `cbt.read` | — | `{ items: AdminBank[], summary: { total, unclassified, public, restricted, embargoed } }`. `AdminBank` = `{ exam_id, title, exam_body, subject, is_active, visibility:'public'\|'restricted'\|null, correction_release_at, released, classified_at, classified_by, question_count, approved_question_count, attempt_count, assigned_count, revoked_count }`. | `fetchAdminBanks()` → `AdminBankSecurityPage`. |
| 8.10 | `GET /api/admin/cbt/banks/:examId/candidates` | `cbt.read` | — | `{ items: AdminBankCandidate[] }` (`{user_id, full_name, status:'active'\|'revoked', assigned_at, revoked_at, assigned_by, revoked_by}`). | `fetchAdminBankCandidates()` → `AdminBankSecurityPage`. |
| 8.11 | `GET /api/admin/cbt/banks/:examId/history` | `cbt.read` | — | `{ items: AdminBankHistoryEntry[] }` (`{id, action, actor, created_at, metadata}`). | `fetchAdminBankHistory()` → `AdminBankSecurityPage`. |
| 8.12 | `GET /api/admin/cbt/bank-candidates?search=` | `cbt.manage` | Query `search` (min 2 chars, max 20 rows). | `{ items: AdminBankCandidateLookup[] }` (`{id, full_name, matric_number, school}`). | `searchAdminBankCandidates()` → `AdminBankSecurityPage`. |
| 8.13 | `PATCH /api/admin/cbt/banks/:examId/classification` | `cbt.manage` | `{ visibility: 'public'\|'restricted', releaseAt: string\|null }` (restricted requires future `releaseAt`; immutable after set). | `{ ok: true }`. | `classifyAdminBank()` → `AdminBankSecurityPage`. |
| 8.14 | `PATCH /api/admin/cbt/banks/:examId/release` | `cbt.manage` | `{ releaseAt: string }` (future-only; backdating refused). | `{ ok: true }`. | `setAdminBankRelease()` → `AdminBankSecurityPage`. |
| 8.15 | `POST /api/admin/cbt/banks/:examId/candidates` | `cbt.manage` | `{ candidateId: UUID }` (individual only, never bulk; restricted banks only). | `{ ok: true }`. | `assignAdminBankCandidate()` → `AdminBankSecurityPage`. |
| 8.16 | `DELETE /api/admin/cbt/banks/:examId/candidates/:candidateId` | `cbt.manage` | — | `{ ok: true }` (revoke). | `revokeAdminBankCandidate()` → `AdminBankSecurityPage`. |

---

## 9. Admin — content, catalogue, media, and data control

| # | Method & endpoint | Capability | Request | Response | Caller |
|---|---|---|---|---|---|
| 9.1 | `GET /api/admin/news?page=&pageSize=&state=&search=` | `news.read` | Query (defaults page 1, pageSize 200, state `all`). | `{ items: AdminNewsArticle[], page, hasMore }`. | `fetchAdminNews()` → `AdminNewsPage`. |
| 9.2 | `POST /api/admin/news` | `news.create` | `AdminNewsInput` (`{title, slug?, excerpt?, body, category?, image_url?, source_url?, source_name?, published?, published_at?, featured?, tags?, is_placeholder?, placeholder_note?, confirm_placeholder_replacement?}`). | `{ item: AdminNewsArticle }`. | `createAdminNews()` → `AdminNewsPage`. |
| 9.3 | `PATCH /api/admin/news/:articleId` | `news.update` | Partial `AdminNewsInput`. | `{ item: AdminNewsArticle }`. | `updateAdminNews()` → `AdminNewsPage`. |
| 9.4 | `DELETE /api/admin/news/:articleId` | `news.delete` | — | `{ ok: true }`. | `deleteAdminNews()` → `AdminNewsPage`. |
| 9.5 | `GET /api/admin/newsroom/candidates?status=` | `news.read` | Query `status` (default `needs_review`). | `{ items: NewsroomCandidate[], pending_review: number\|null }`. | `fetchNewsroomCandidates()` → `AdminNewsroomQueue`. |
| 9.6 | `POST /api/admin/newsroom/candidates/:candidateId/approve` | `news.publish` | `{ title?, excerpt?, category?, image_url? }` (overrides). | `{ item: AdminNewsArticle }`. | `approveNewsroomCandidate()` → `AdminNewsroomQueue`. |
| 9.7 | `POST /api/admin/newsroom/candidates/:candidateId/reject` | `news.update` | `{ reason: string }`. | `{ ok: true }`. | `rejectNewsroomCandidate()` → `AdminNewsroomQueue`. |
| 9.8 | `POST /api/admin/newsroom/ingest` (rate limit 6/hour per user) | `news.create` | `{ dry_run?: boolean }`. | `{ report: NewsroomIngestReport }`. | `runNewsroomIngest()` → `AdminNewsPage`. |
| 9.9 | `GET /api/admin/newsroom/runs` | `news.read` | — | `{ items: NewsroomRun[] }`. | `fetchNewsroomRuns()` → `AdminNewsPage`. |
| 9.10 | `GET /api/admin/calendar-items?type=deadline\|exam` | `calendar.read` | Query `type` (required). | `{ items: AdminCalendarItem[] }`. | `fetchAdminCalendarItems()` → `AdminContentPage`. |
| 9.11 | `POST /api/admin/calendar-items?type=` | `calendar.create` | `{ title, description?, due_at?, starts_at?, ends_at?, location?, priority?, status? }`. | `{ item: AdminCalendarItem }`. | `createAdminCalendarItem()` → `AdminContentPage`. |
| 9.12 | `PATCH /api/admin/calendar-items/:itemId?type=` | `calendar.update` | Partial item. | `{ item: AdminCalendarItem }`. | `updateAdminCalendarItem()` → `AdminContentPage`. |
| 9.13 | `DELETE /api/admin/calendar-items/:itemId?type=` | `calendar.delete` | — | `{ ok: true }`. | `deleteAdminCalendarItem()` → `AdminContentPage`. |
| 9.14 | `GET /api/admin/institutions?search=` | `institution.read` | Query `search` (optional). | `{ items: AdminInstitution[] }`. | `fetchAdminInstitutions()` → `AdminSchoolsPage`, `AdminCbtPage`. |
| 9.15 | `POST /api/admin/institutions` | `institution.create` | `{ school_name, acronym?, slug?, state?, institution_type?, website_url?, admission_portal_url?, student_portal_url?, is_verified?, post_utme_available?, post_utme_method?, post_utme_source_url?, post_utme_verified? }`. | `{ item: AdminInstitution }`. | `createAdminInstitution()` → `AdminSchoolsPage`. |
| 9.16 | `PATCH /api/admin/institutions/:institutionId` | `institution.update` | Partial institution. | `{ item: AdminInstitution }`. | `updateAdminInstitution()` → `AdminSchoolsPage`. |
| 9.17 | `DELETE /api/admin/institutions/:institutionId` | `institution.delete` | — | `{ ok: true }`. | `deleteAdminInstitution()` → `AdminSchoolsPage`. |
| 9.18 | `GET /api/admin/services` | `service.read` | — | `{ items: AdminService[] }`. | `fetchAdminServices()` → `AdminServicesPage`. |
| 9.19 | `POST /api/admin/services` | `service.create` | `{ service_key, title, description?, application_url?, route?, category?, sort_order?, active? }`. | `{ item: AdminService }`. | `createAdminService()` → `AdminServicesPage`. |
| 9.20 | `PATCH /api/admin/services/:serviceId` | `service.update` | Partial service. | `{ item: AdminService }`. | `updateAdminService()` → `AdminServicesPage`. |
| 9.21 | `DELETE /api/admin/services/:serviceId` | `service.delete` | — | `{ ok: true }`. | `deleteAdminService()` → `AdminServicesPage`. |
| 9.22 | `GET /api/admin/services/:serviceId/guide` | `service.read` | — | `{ guide: ServiceGuide \| null }`. | `AdminServicesPage` (guide editor). |
| 9.23 | `PUT /api/admin/services/:serviceId/guide` | `service.update` | `{ eyebrow, summary, safety_note, steps: [{title, body, image?, imageAlt?, imageKind?, imageSource?, section?}] (max 24), status: 'draft'\|'published' }`. | `{ guide }`. | `AdminServicesPage`. |
| 9.24 | `DELETE /api/admin/services/:serviceId/guide` | `service.update` | — | `{ ok: true }`. | `AdminServicesPage`. |
| 9.25 | `GET /api/admin/opportunities` | `opportunity.read` | — | `{ items: Opportunity[] }`. | `fetchAdminOpportunities()` → `AdminOpportunitiesPage`. |
| 9.26 | `POST /api/admin/opportunities` | `opportunity.create` | Opportunity fields (`title, organisation?, category, description?, link_url?, deadline?, locations?, ...`). | `{ item: Opportunity }`. | `createAdminOpportunity()` → `AdminOpportunitiesPage`. |
| 9.27 | `PATCH /api/admin/opportunities/:opportunityId` | `opportunity.update` | Partial opportunity. | `{ item: Opportunity }`. | `updateAdminOpportunity()` → `AdminOpportunitiesPage`. |
| 9.28 | `DELETE /api/admin/opportunities/:opportunityId` | `opportunity.delete` | — | `{ ok: true }`. | `deleteAdminOpportunity()` → `AdminOpportunitiesPage`. |
| 9.29 | `POST /api/admin/uploads` (rate limit 20/10 min per user; 5 MB JSON) | any of `news.create`, `opportunity.create`, `institution.update`, `calendar.update`, `service.update` | `{ dataUrl: 'data:image/...;base64,...' }`. | `{ url, path, bytes }` (public URL from `admin-content` bucket). | `uploadAdminImage()` → `AdminNewsPage`, `AdminOpportunitiesPage`, `AdminSchoolsPage`, `AdminContentPage`, `AdminServicesPage`. |
| 9.30 | `GET /api/admin/pdf-bank` | `data.read` | — | `{ items: AdminPdfDocument[] }`. | `fetchAdminPdfBank()` → `AdminPdfBankPage`. |
| 9.31 | `POST /api/admin/pdf-bank/upload` (rate limit 20/10 min; 15 MB JSON) | any of `data.write`, `institution.update`, `cbt.manage` | `{ dataUrl: 'data:application/pdf;base64,...', filename, title, description? }`. | `{ item: AdminPdfDocument }` (status `inbox`). | `uploadAdminPdf()` → `AdminPdfBankPage`. |
| 9.32 | `PATCH /api/admin/pdf-bank/:documentId/route` | any of `data.write`, `institution.update`, `cbt.manage` | `{ destination, exam_body?, institution_id?, subject?, course?, paper_year?, source_name?, source_url?, source_verified?, news_article_id?, opportunity_id? }`. | `{ item: AdminPdfDocument }` (status `routed`). | `routeAdminPdf()` → `AdminPdfBankPage`. |
| 9.33 | `GET /api/admin/site-content` | `site.read` | — | `{ settings: Record<string, unknown>, pages: AdminSitePage[] }`. | `fetchAdminSiteContent()` → `AdminSitePage`. |
| 9.34 | `PUT /api/admin/site-content/settings/:key` | `site.update` | JSON object value (key ∈ `brand\|footer\|contact\|social`). | `{ value: Record<string, unknown> }`. | `saveAdminSiteSettings()` → `AdminSitePage`. |
| 9.35 | `PUT /api/admin/site-content/pages/:slug` | `site.update` | Partial `AdminSitePage` (`{title?, summary?, body?, status?, reviewState?}`). | `{ page: AdminSitePage }` (revision incremented, revision row appended). | `saveAdminSitePage()` → `AdminSitePage`. |
| 9.36 | `GET /api/admin/site-content/pages/:slug/revisions` | `site.read` | — | `{ items: AdminSiteRevision[] }`. | `fetchAdminSiteRevisions()` → `AdminSitePage`. |
| 9.37 | `POST /api/admin/site-content/pages/:slug/restore/:revision` | `site.update` | — | `{ page: AdminSitePage }` (new revision copying the old). | `restoreAdminSiteRevision()` → `AdminSitePage`. |
| 9.38 | `GET /api/admin/content-manager/resources` | `data.read` | — | `{ resources: [{ key, label, table, fields: [{name, type, required?, ...}] }] }` (CBT tables filtered by `cbt.read`/`cbt.manage`). | `AdminContentManagerPage`. |
| 9.39 | `GET /api/admin/content-manager/data/:resource` | `data.read` (+ `cbt.read` for CBT tables) | — | `{ rows: [...] }` (limit 500, newest first). | `AdminContentManagerPage`. |
| 9.40 | `POST /api/admin/content-manager/data/:resource` | `data.write` (+ `cbt.manage` for CBT tables) | Row object (validated against the resource field list). | `{ row }` (audited). | `AdminContentManagerPage`. |
| 9.41 | `PATCH /api/admin/content-manager/data/:resource/:id` | `data.write` (+ `cbt.manage`) | Partial row. | `{ row }` (audited). | `AdminContentManagerPage`. |
| 9.42 | `DELETE /api/admin/content-manager/data/:resource/:id` | `data.write` (+ `cbt.manage`) | — | `{ ok: true }` (audited). | `AdminContentManagerPage`. |
| 9.43 | `POST /api/admin/content-manager/import/:resource` (rate limit 10/10 min) | `data.import` | `{ rows: [...] }` (max 2,000 rows; bulk insert/upsert by `id`). | `{ inserted, updated, errors: [{row, error}] }` (audited). `exam_questions` import is refused (409) — use the question-import workflow. | `AdminContentManagerPage`. |

---

## 10. Admin — question imports

All routes require `cbt.manage` (guard) unless noted. Upload is JSON with
base64 `dataUrl` (not multipart); extraction runs server-side after the
bytes arrive; the review screen polls for results.

| # | Method & endpoint | Request | Response | Caller |
|---|---|---|---|---|
| 10.1 | `GET /api/admin/question-imports/formats` | — | `{ formats: string[] }` (accepted extensions). | `AdminQuestionImportPage` (file picker). |
| 10.2 | `GET /api/admin/question-imports` | — | `{ items: AdminQuestionImport[] }`. | `fetchAdminQuestionImports()`. |
| 10.3 | `POST /api/admin/question-imports` (rate limit 20/10 min; large JSON) | `{ dataUrl, filename, examId, subject, paperYear: number\|string\|null, sourceName?, sourceUrl?, sourceVerified? }` | `{ item: AdminQuestionImport, duplicate: boolean }` (status `queued`). Duplicate checksum → same import returned with `duplicate: true`. | `uploadAdminQuestionImport()` (XHR with progress). |
| 10.4 | `GET /api/admin/question-imports/:importId` | — | `AdminQuestionImportDetail`: `{ item, items: AdminQuestionImportItem[], summary: {pending, approved, rejected, imported} }`. | `fetchAdminQuestionImport()`. |
| 10.5 | `PATCH /api/admin/question-imports/:importId` (rate limit 10/10 min) | `{ examId?, subject?, paperYear?, sourceName?, sourceUrl?, sourceVerified? }` (refused once any question is saved). | `{ item: AdminQuestionImport }`. | `updateAdminQuestionImport()`. |
| 10.6 | `POST /api/admin/question-imports/:importId/retry` (rate limit 10/10 min) | — | `{ ok: true }` (re-queues extraction; max 5 attempts). | `retryAdminQuestionImport()`. |
| 10.7 | `PATCH /api/admin/question-imports/:importId/items/:itemId` | `{ expectedUpdatedAt, questionText?, optionA?, optionB?, optionC?, optionD?, optionE?, correctOption?, explanation?, passage?, topic? }` (optimistic concurrency). | `{ item: AdminQuestionImportItem, blocking: string[] }`. | `updateAdminQuestionImportItem()`. |
| 10.8 | `POST /api/admin/question-imports/:importId/items/:itemId/review` | `{ action: 'approve'\|'reject'\|'reset', expectedUpdatedAt }`. | `{ item: AdminQuestionImportItem }`. A missing key cannot be approved. | `reviewAdminQuestionImportItem()`. |
| 10.9 | `POST /api/admin/question-imports/:importId/commit` (rate limit 10/10 min) | — | `{ result: { inserted, duplicates, incomplete, remaining } }`. **Atomic**: destination bank must be classified; every approved item re-validated; any failure rolls back the batch. | `commitAdminQuestionImport()`. |
| 10.10 | `GET /api/admin/question-imports/:importId/source` | — | `{ url (signed, 300 s), filename }`. | `fetchAdminQuestionImportSource()`. |
| 10.11 | `DELETE /api/admin/question-imports/:importId` | — | `{ ok: true }` (row + storage object deleted). | `deleteAdminQuestionImport()`. |

---

## 11. Direct Supabase operations (no REST endpoint today)

These are called via `supabase.from(...)` / `supabase.rpc(...)` /
`supabase.auth.*` from the browser. The new backend must provide REST
equivalents (or the frontend must keep Supabase for these). Each row names
the **[PROPOSED]** REST replacement.

| # | Current direct call | Caller | [PROPOSED] REST replacement |
|---|---|---|---|
| 11.1 | `supabase.auth.signUp / signInWithPassword / signOut / resetPasswordForEmail / updateUser / resend / getSession / getUser / onAuthStateChange / mfa.*` | `AuthPageV2`, `auth.tsx`, `SecurityModal`, `AdminLayout` | Keep Supabase Auth (no replacement) **or** `POST /api/auth/*` (see auth doc §8). |
| 11.2 | `supabase.from('profiles').upsert/select/update` | `AuthPageV2`, `ProfileCompletionPage`, `StudentDashboardV2`, `CbtResultsPage`, `SecurityModal` | `GET /api/me`, `PATCH /api/me/profile`, `GET /api/me` (name/matric/JAMB reg for result slip). |
| 11.3 | `supabase.from('service_catalog').select` | `api.ts` `fetchServices`/`fetchService`, `StudentDashboardV2` | `GET /api/services`, `GET /api/services/:slug` (§2.3–2.4). |
| 11.4 | `supabase.from('institutions').select` | `SchoolFinderPage`, `SchoolDetailsPage`, `StudentDashboardV2`, `fetchPostUtmeInstitutions` | `GET /api/catalogue/institutions`, `GET /api/catalogue/institutions/:id`, `GET /api/catalogue/post-utme-institutions`. |
| 11.5 | `supabase.from('news_articles').select` | `api.ts` `fetchNews`/`fetchNewsItem` | `GET /api/news`, `GET /api/news/:slug` (§2.7–2.8). |
| 11.6 | `supabase.from('cbt_exams').select` | `api.ts` `fetchCbtExams`, `fetchCbtResult` fallback | `GET /api/cbt/exams` (§2.1). |
| 11.7 | `supabase.from('cbt_attempts').select` | `StudentDashboardV2`, `fetchCbtResult` fallback | `GET /api/cbt/attempts` (§3.7) + `GET /api/cbt/attempts/:id/result` **[PROPOSED]** (see 11.9). |
| 11.8 | `supabase.from('cbt_subject_catalog').select` | `api.ts` `fetchCbtSubjectCatalog` | `GET /api/catalogue/subjects?examBody=` **[PROPOSED]** (or fold into `GET /api/cbt/exams/:id/subjects`). |
| 11.9 | `supabase.rpc('get_cbt_result', {p_attempt_id})` | `api.ts` `fetchCbtResult` | `GET /api/cbt/attempts/:attemptId/result` **[PROPOSED]** returning `CbtResultPayload` (`{attempt, exam, answers, questions, subjects, plan}`). |
| 11.10 | `supabase.rpc('submit_service_request_idempotent', {...})` | `api.ts` `submitServiceRequest` | `POST /api/service-requests` (§6.1). |
| 11.11 | `supabase.from('service_requests').select` (own) | `StudentDashboardV2` | `GET /api/service-requests/mine` (§6.2). |
| 11.12 | `supabase.from('student_saved_items').upsert/delete/select` | `studentDashboard.ts` | `GET/PUT/DELETE /api/me/saved-items[/:id]` **[PROPOSED]**. |
| 11.13 | `supabase.from('student_notifications').select/insert/update` | `studentDashboard.ts` | `GET /api/me/notifications`, `POST /api/me/notifications/:id/read`, `POST /api/me/notifications` (staff/system only) **[PROPOSED]**. |
| 11.14 | `supabase.from('student_cgpa_terms'/'student_cgpa_courses').insert/select` | `studentDashboard.ts` | `GET/POST /api/me/cgpa` **[PROPOSED]** (optional; calculator works without it). |
| 11.15 | `supabase.from('student_security_events').insert` | `studentDashboard.ts` `recordSecurityEvent()` | Server-side audit only; no client endpoint needed (client insert should be removed). |

---

## 12. Domain error codes the new backend must reproduce

The current server returns plain-string errors, but the *semantics* below
are load-bearing (tests assert them; the frontend branches on message
text). The new backend should return the same HTTP status + message
vocabulary. If it adopts `{ error: { code, message } }`, it must keep the
messages identical.

| Condition | Status | Message (exact or prefix) | Where |
|---|---|---|---|
| Unauthenticated | 401 | `Authentication required.` / `Invalid or expired session.` | All guarded routes. |
| Insufficient capability | 403 | `You do not have permission to perform this action.` | All admin routes. |
| Attempt/bank not found or not accessible | 404 | `CBT attempt not found.` / `CBT exam not found.` | CBT routes (never reveal existence). |
| Attempt expired | 409 | `This CBT attempt has expired.` | Draft/submit/paper. |
| Protocol mismatch | 409 | `CBT protocol mismatch.` | Draft/paper/v2. |
| Attempt requires review | 409 | `This attempt requires review.` / `The operation requires review.` | Paper/v2 (corrupt frozen paper or draft). |
| Already submitted (no result) | 409 | `CBT submission did not produce a result.` | Submit. |
| JAMB English missing | 422 | `Use of English is compulsory for JAMB UTME. Include it in your subject combination.` | Start. |
| Mock combination invalid | 422 | `Use of English is compulsory for a JAMB mock...` / `A JAMB mock requires exactly four subjects...` / `A WAEC mock requires at least four subjects...` | Start. |
| No questions for subjects | 422 | `No questions are available for: ...` / `This CBT exam has no questions for the selected subjects.` | Start/guest. |
| Question-count out of limits | 422 | `Choose between <min> and <max> questions.` | Start. |
| Too many subjects | 422 | `A session can include at most <N> subjects.` / `A JAMB session can include Use of English plus three other subjects.` | Start. |
| Bank unclassified (fail closed) | 404 (student) / 503 (policy unavailable) | `CBT exam not found.` / `CBT service is temporarily unavailable.` | Catalogue/start/paper/guest. |
| Question provenance refusal | 403 | `This question text already exists in a restricted bank. It cannot be added to a public or unclassified bank.` (SQLSTATE 42501 + `DETAIL='cbt_question_provenance_guard'` in the old backend; the new backend must produce the same refusal semantics without leaking the text/fingerprint.) | Admin question create/import commit. |
| Bank move refused | 403 | `Question bank movement requires security review.` | Admin question update. |
| V2 rehearsal disabled | 503 | `CBT versioned rehearsal is unavailable.` | All v2 routes. |
| V2 finalization unavailable | 503 | `CBT finalization is unavailable pending recovery verification.` | `POST .../finalize`. |
| Rate limited | 429 | `Too many requests. Please slow down and try again shortly.` + `Retry-After`. | Rate-limited routes. |
| Unrecognised CBT error | 503 | Generic fallback (never 400). | CBT routes. |

---

## 13. What the new backend does NOT need to implement

- Legacy `POST /api/cbt/exams/:examId/start`, `POST /api/cbt/submit`,
  `GET/PATCH /api/cbt/attempts/:id/progress` — no current frontend caller.
  Keep only if old clients must be supported (recommend: drop, document).
- `POST /api/admin/session/verify` — redundant with `GET /api/admin/session`.
- Generic content-manager table gateway (§9.38–9.43) — replace with
  explicit per-resource endpoints. The frontend's `AdminContentManagerPage`
  is the only caller; it can be repointed resource-by-resource.
- Newsroom ingestion (§9.5–9.9) — only if the product wants automated
  ingestion in the new backend. Manual news CRUD (§9.1–9.4) is required
  regardless.
- Wallet/payment endpoints — no frontend caller exists.

---

# Part C — Database Requirements

> **Source document:** `DATABASE-REQUIREMENTS.md` (Part C of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A, B, D–G within this package.

---

# EduReach Hub — Database Requirements

> **Purpose.** The data structures the frontend needs, expressed as
> **requirements for a fresh PostgreSQL database** — not as a copy of the
> existing Supabase schema. Table/column names below are **proposed** for
> the new backend (snake_case, matching the frontend's field names where
> they already use snake_case). Relationships, constraints, and required
> fields are derived from frontend reads/writes, `src/lib/api.ts` types,
> and the behavioural rules encoded in the existing migrations/tests.
>
> **Rules for the new schema:**
> - Fresh migration history. Do not copy `supabase/migrations/` (85 files)
>   or `supabase/candidates/` (non-deployable). Re-derive each table from
>   this document.
> - The browser never touches PostgreSQL directly in the new design. RLS is
>   defence-in-depth only; application-level authorization (capability +
>   ownership + bank policy) is the boundary.
> - Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` unless
>   noted, plus `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and
>   `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (with an
>   `updated_at` trigger) unless noted.
> - All timestamps are `TIMESTAMPTZ` (UTC). All money is `NUMERIC`.
> - Answer indices are `SMALLINT 0..3`; question positions are `INTEGER >= 1`.
> - Foreign keys use `ON DELETE CASCADE` for owned data (attempts, answers,
>   saved items) and `ON DELETE SET NULL` / `RESTRICT` for reference data
>   (banks, institutions) — see per-table notes.

---

## 1. Identity: users, profiles, roles

### 1.1 `users` (identity — replaces `auth.users` + `profiles` identity columns)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID PK | The identity id. If keeping Supabase Auth, this **is** the Supabase `auth.users.id` (FK target for all owned tables). If owning auth, generate here. |
| `email` | TEXT NOT NULL UNIQUE | Lowercased, trimmed. |
| `email_verified_at` | TIMESTAMPTZ NULL | Set on verification. |
| `password_hash` | TEXT NULL | Only if owning auth (argon2id). NULL when using Supabase Auth. **Never returned by any API.** |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |
| `deleted_at` | TIMESTAMPTZ NULL | Soft-delete for account-deletion requests (see `tests/account-deletion-dependencies.test.ts`). Hard delete must cascade owned data. |

### 1.2 `profiles` (one row per user — the frontend's `profiles` table)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID PK, FK → `users(id) ON DELETE CASCADE` | One-to-one with `users`. |
| `full_name` | TEXT NOT NULL DEFAULT `''` | Display name. Frontend derives from `first_name + last_name` or email prefix when empty. |
| `first_name`, `last_name` | TEXT NULL | From signup metadata. |
| `phone` | TEXT NULL | Nigerian phone; frontend validates ≥10 digits on signup. |
| `account_type` | TEXT NOT NULL DEFAULT `'student'` | CHECK IN (`'student'`, `'parent'`, `'teacher'`). All dashboards are student-shaped regardless. |
| `school` | TEXT NOT NULL DEFAULT `''` | Free text (dropdown + "Other" custom). **No FK** to `institutions` (frontend allows arbitrary strings). |
| `course_programme` | TEXT NULL | Free text (dropdown + "Other"). |
| `faculty`, `department`, `level` | TEXT NOT NULL DEFAULT `''` | Free text. |
| `session` | TEXT NOT NULL DEFAULT `''` | Academic session (e.g. `2024/2025`). |
| `matric_number` | TEXT NULL | Shown on result slip. |
| `jamb_reg_no` | TEXT NULL | Shown on result slip. |
| `target_exam` | TEXT DEFAULT `'JAMB (UTME)'` | Preferred exam. |
| `admission_year`, `expected_graduation_year` | INTEGER NULL | |
| `academic_interests` | TEXT[] NOT NULL DEFAULT `'{}'` | |
| `notification_preferences` | JSONB NOT NULL DEFAULT `'{"email_alerts":true,"whatsapp_alerts":true,"sms_alerts":false}'` | CHECK `jsonb_typeof = 'object'`. |
| `avatar_url` | TEXT NULL | |
| `terms_agreed_at` | TIMESTAMPTZ NULL | Set when signup metadata `terms_agreed=true`. |
| `profile_completed` | BOOLEAN NOT NULL DEFAULT `false` | Set by profile-completion flow. |
| `mfa_enabled` | BOOLEAN NOT NULL DEFAULT `false` | Mirrors Supabase MFA enrolment (written by `SecurityModal` directly today; in the new backend, written server-side after MFA verification). |
| `role` | TEXT NOT NULL DEFAULT `'student'` | CHECK IN (`'student'`, `'content_editor'`, `'service_admin'`, `'super_admin'`). Legacy values `admin`/`moderator` map to `super_admin`; retired `senate_admin`/`campus_agent` map to `student` (see auth doc). **Never client-writable** — only via `POST /api/admin/users/:id/role` with `user.manage_roles`. |
| `suspended` | BOOLEAN NOT NULL DEFAULT `false` | Set by ban/unban. Suspended users must be refused at the auth layer (see auth doc §7 — **currently only partially enforced; the new backend must enforce it**). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Indexes:** PK on `id`; `UNIQUE (matric_number)` is **not** required
(frontend never assumes uniqueness). Index on `role` for admin user search.

**Assumptions to preserve:** profile upsert is idempotent
(`ON CONFLICT (id) DO UPDATE`); signup trigger creates the profile row
from `raw_user_meta_data` (`first_name`, `last_name`, `full_name`, `phone`,
`account_type`, `terms_agreed`, `school`/`institution`, `course_programme`,
`faculty`, `department`, `level`) + a wallet row. The new backend must
create the profile atomically with the user.

### 1.3 `student_security_events` (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `event_type` | TEXT NOT NULL | e.g. `password_changed`, `mfa_enabled`, `sign_out_others`. |
| `event_label` | TEXT NOT NULL | Human label. |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. |
| `created_at` | TIMESTAMPTZ | No `updated_at` (append-only). |

Index: `(user_id, created_at DESC)`. No UPDATE/DELETE grants to the app role
except retention jobs.

---

## 2. Institutions and academic catalogue

### 2.1 `institutions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `school_name` | TEXT NOT NULL | |
| `acronym` | TEXT NULL | |
| `slug` | TEXT NULL UNIQUE | Used by `/schools/:slug`. |
| `state` | TEXT NULL | |
| `institution_type` | TEXT NULL | |
| `website_url`, `admission_portal_url`, `student_portal_url` | TEXT NULL | HTTPS only (validated). |
| `is_verified` | BOOLEAN NOT NULL DEFAULT `false` | |
| `post_utme_available` | BOOLEAN NOT NULL DEFAULT `false` | |
| `post_utme_method` | TEXT NULL | CHECK IN (`'cbt'`, `'handwritten'`). |
| `post_utme_source_url` | TEXT NULL | Required when `post_utme_available=true` (frontend filters on non-null). |
| `post_utme_verified` | BOOLEAN NOT NULL DEFAULT `false` | Frontend lists only `available=true AND verified=true AND method/source non-null`. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(school_name)` for the 400-row finder list. Seed: ~329 NUC rows
(content, not schema — the new backend needs a seed/import step, not a
migration with data).

### 2.2 `cbt_subject_catalog` (governed subject list per exam body)

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT GENERATED ALWAYS AS IDENTITY PK | |
| `exam_body` | TEXT NOT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). |
| `subject_name` | TEXT NOT NULL | Display name (e.g. `Use of English`). |
| `subject_group` | TEXT NOT NULL | CHECK IN (`'Science'`, `'Arts'`, `'Commercial'`, `'Technical & Vocational'`). |
| `active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `created_at` | TIMESTAMPTZ | |
| UNIQUE | `(exam_body, subject_name, subject_group)` | |

**Note:** this catalogue is *advisory* for the setup wizard. The
authoritative servable-subject list for a bank is derived from actual
`exam_questions` rows (see `cbt_subject_availability` equivalent in the
new backend). Both must exist; the wizard shows the intersection.

### 2.3 Programme catalogue (optional — frontend uses free text)

`ccmas_programmes`, `ccmas_disciplines`, `national_programme_catalogue`
exist in the old DB but the frontend never queries them (profile fields
are free text). **Do not create these tables** unless the product wants a
governed programme list. Recorded here so the omission is deliberate.

---

## 3. Question banks (CBT content)

### 3.1 `cbt_exams` (banks)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `exam_body` | TEXT NOT NULL | e.g. `JAMB`, `WAEC`, `NECO`, `POST-UTME`. Frontend matches case-insensitively + substring (`includes('jamb')`). Keep values canonical uppercase. |
| `subject` | TEXT NOT NULL | Legacy single-subject label; multi-subject banks use `'Multiple subjects'`. Kept for display compatibility. |
| `description` | TEXT NULL | |
| `duration_minutes` | INTEGER NOT NULL DEFAULT `30` | CHECK 5..180 in the old schema; the configured-session flow allows 5..240 (`cbt_limits`). **New schema: CHECK 5..240.** |
| `is_active` | BOOLEAN NOT NULL DEFAULT `true` | Inactive banks are invisible everywhere. |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | Required for POST-UTME banks (frontend nulls it for other bodies on create). |
| `format_status` | TEXT NOT NULL DEFAULT `'unverified'` | CHECK IN (`'verified'`, `'partially_verified'`, `'unverified'`). |
| `official_guidance_url` | TEXT NULL | HTTPS only. |
| `format_notes` | TEXT NULL | |
| `guidance_year` | INTEGER NULL | |
| `mock_question_count` | INTEGER NULL | Fixed mock paper size (e.g. 180 for JAMB). NULL = mock size derived from bank. |
| `mock_subject_quota` | JSONB NULL | e.g. `{"english":60,"other":40}`. CHECK object. |
| `created_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(is_active, exam_body, subject)`.

### 3.2 `exam_questions` (the question bank — most sensitive table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | **Bank moves are forbidden** (trigger: `exam_id` change → refuse). |
| `question_text` | TEXT NOT NULL | |
| `option_a`, `option_b`, `option_c`, `option_d` | TEXT NOT NULL | Four options. A fifth option (`option_e`) exists only in import staging, never here. |
| `correct_option` | CHAR(1) NOT NULL | CHECK IN (`'A'`,`'B'`,`'C'`,`'D'`). **Never returned to students before correction release.** |
| `explanation` | TEXT NULL | Same release rule as `correct_option`. |
| `subject` | TEXT NOT NULL | Display subject (e.g. `Use of English`). Comparisons use the canonical key (see §3.4). |
| `position` | INTEGER NOT NULL | CHECK `> 0`. Paper position within the bank. |
| `marks` | INTEGER NOT NULL DEFAULT `1` | CHECK `> 0`. (Scoring is currently 1 mark/question; keep the column for future weighting.) |
| `topic` | TEXT NULL | |
| `passage` | TEXT NULL | Reading passage, if any. |
| `review_status` | TEXT NOT NULL DEFAULT `'needs_review'` | CHECK IN (`'approved'`, `'needs_review'`, `'rejected'`). Rejected questions are excluded from serving/counts. |
| `source_type` | TEXT NULL | e.g. `'official_past_question'` only when an admin confirmed the source. |
| `import_id` | UUID NULL, FK → `question_imports(id) ON DELETE SET NULL` | Provenance. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Constraints:**
- `UNIQUE (exam_id, position)` — duplicate positions refused (409).
- Index `(exam_id, position)`, `(exam_id, subject)`, `(exam_id, review_status)`.
- **Provenance guard:** a question whose normalised text already exists in
  a `restricted` bank cannot be added to a `public` or unclassified bank
  (403 `question_provenance_refused`). The new backend must implement this
  as an application-level check inside the write transaction (the old
  backend used a trigger with SQLSTATE 42501 + `DETAIL` marker; do not
  copy the trigger — reproduce the *refusal semantics*).
- **Access:** no direct client grants. All reads go through services that
  enforce bank classification + candidate assignment + correction release.

### 3.3 `cbt_bank_security` (bank classification — fail closed)

| Column | Type | Notes |
|---|---|---|
| `exam_id` | UUID PK, FK → `cbt_exams(id) ON DELETE RESTRICT` | One row per classified bank. **No row = unclassified = inaccessible** (fail closed). |
| `visibility` | TEXT NOT NULL | CHECK IN (`'public'`, `'restricted'`). |
| `correction_release_at` | TIMESTAMPTZ NULL | Required when `restricted`; must be NULL when `public`. CHECK enforces the pair. |
| `classified_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `classified_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `updated_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `updated_at` | TIMESTAMPTZ | Standard. |

**Rules:** classification is staff-chosen and **immutable** once set
(changing it requires a separate reviewed lifecycle — the old candidate
refused re-classification). `correction_release_at` is future-only on set
and can never move earlier. The new backend must enforce both.

### 3.4 `cbt_bank_candidate_assignments` (restricted-bank access)

| Column | Type | Notes |
|---|---|---|
| `exam_id` | UUID NOT NULL, FK → `cbt_bank_security(exam_id) ON DELETE RESTRICT` | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `assigned_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `assigned_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `revoked_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `revoked_at` | TIMESTAMPTZ NULL | CHECK (`revoked_by IS NULL OR revoked_at IS NOT NULL`). |
| PK | `(exam_id, user_id)` | Individual assignments only — **never bulk**. |

**Access predicate (must be reproduced exactly):**
`candidate_access(exam) = visibility='public' OR (visibility='restricted'
AND active assignment exists)`. No row → `false`. Revocation takes effect
immediately for all subsequent operations (the old backend used a locking
form so a revocation committing mid-transaction cannot be overtaken; the
new backend must re-check inside the write transaction).

**Subject canonicalisation (must be reproduced):** `Use of English` /
`English Language` / `English` → `english`; `Literature-in-English` /
`Literature in English` → one key. Frontend `normalizeSubject()` and SQL
canonicalisation must agree. Store display names; compare by canonical key.

---

## 4. CBT attempts, answers, and results

### 4.1 `cbt_attempts` (attempt header — frozen paper + draft + result)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. All reads/writes owner-scoped. |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | |
| `status` | TEXT NOT NULL DEFAULT `'in_progress'` | CHECK IN (`'in_progress'`, `'submitted'`, `'expired'`, `'cancelled'`). |
| `mode` | TEXT NOT NULL DEFAULT `'mock'` | CHECK IN (`'practice'`, `'mock'`). Existing rows default to `mock` (legacy full papers). |
| `protocol` | TEXT NOT NULL DEFAULT `'legacy'` | CHECK IN (`'legacy'`, `'v2'`). v2 attempts are rehearsal-only (see CBT doc). |
| `programme` | TEXT NULL | Free text (max 160 chars, frontend-truncated). |
| `selected_subjects` | TEXT[] NOT NULL DEFAULT `'{}'` | Student-chosen order (drives paper block order). |
| `subject_plan` | JSONB NOT NULL DEFAULT `'[]'` | CHECK array. `[{subject, questions, first, last}]` (1-based positions). Derived from the frozen paper. |
| `question_ids` | UUID[] NOT NULL DEFAULT `'{}'` | **The frozen paper** (ordered). All reads/resume/scoring use this, never a re-query. |
| `requested_questions` | INTEGER NULL | Student-requested total (practice). |
| `duration_minutes` | INTEGER NULL | CHECK 1..360. Authoritative duration (not the bank default). |
| `started_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `expires_at` | TIMESTAMPTZ NULL | `started_at + duration`. Server clock only. |
| `submitted_at` | TIMESTAMPTZ NULL | |
| `score` | NUMERIC(8,2) NULL | Percentage (0–100, 2dp). Set at submission. |
| `correct_answers` | INTEGER NOT NULL DEFAULT `0` | CHECK `>= 0`. |
| `total_questions` | INTEGER NOT NULL DEFAULT `0` | CHECK `>= 0`. Equals `cardinality(question_ids)` at submission. |
| `current_question` | INTEGER NOT NULL DEFAULT `0` | Zero-based resume position (frontend `questionIndex`). |
| `answers_draft` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. `{ "<1-based position>": <0-based option index> }`. The v1 draft store. |
| `candidate_answer_revision` | BIGINT NOT NULL DEFAULT `0` | v2 revision counter (monotonic). |
| `v2_result` | JSONB NULL | v2 submission result (rehearsal). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**Constraints & rules:**
- One in-progress attempt per student per exam (enforced by the start
  RPC's resume logic: starting again returns the existing attempt with
  `resumed: true` instead of creating a second).
- `expires_at` is computed server-side; the client timer is display-only.
  A submit grace window exists (`cbt_submit_grace`, 120 s in the latest
  migration) — the new backend must define and document its grace.
- Expiry marking is owner-scoped and lock-after-check
  (`cbt_expire_owned_attempt` equivalent): it can mark `expired` but can
  never alter answers or reopen a result.
- Indexes: `(user_id, created_at DESC)`, `(user_id, mode, started_at DESC)`,
  `(exam_id)`.

### 4.2 `cbt_answers` (per-question answer rows)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | |
| `question_id` | UUID NOT NULL, FK → `exam_questions(id) ON DELETE CASCADE` | |
| `selected_option` | CHAR(1) NULL | CHECK IN (`'A'`,`'B'`,`'C'`,`'D'`). NULL = unanswered/cleared. |
| `is_correct` | BOOLEAN NULL | Set at submission (server-computed). |
| `answered_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| UNIQUE | `(attempt_id, question_id)` | Upsert target. |

**Note:** the v1 flow primarily uses `cbt_attempts.answers_draft` (JSONB)
for in-progress answers and materialises `cbt_answers` at submission for
scoring/results. The new backend may use either (or both), but must keep
the *observable* behaviour: draft saves are idempotent, submission scores
against the frozen paper, and `get_cbt_result` returns per-question rows.
Recommended: keep both (draft JSONB for cheap idempotent saves, answer
rows for auditable results).

### 4.3 `cbt_v2_operations` (v2 idempotency log — rehearsal)

| Column | Type | Notes |
|---|---|---|
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | Part of PK. |
| `operation_key` | UUID NOT NULL | Part of PK. Client-generated UUID v4, reused on retry. |
| `request` | JSONB NOT NULL | The operation payload (`kind`, `question`, `selected`, `expected`). Replaying a key with *different* input → refuse. |
| `outcome` | TEXT NOT NULL | CHECK IN (`'accepted'`, `'conflict'`). |
| `accepted_revision` | BIGINT NOT NULL | CHECK `>= 0`. |
| PK | `(attempt_id, operation_key)` | |
| Partial unique index | `(attempt_id, accepted_revision) WHERE request->>'kind'='answer' AND outcome='accepted'` | One accepted answer per revision. |

### 4.4 `cbt_v2_writing_sessions` (single-writer leases — rehearsal)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `sessionId` in the API. |
| `attempt_id` | UUID NOT NULL, FK → `cbt_attempts(id) ON DELETE CASCADE` | |
| `owner_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | |
| `generation` | BIGINT NOT NULL | CHECK 1..9007199254740991. Monotonic per attempt. |
| `request_key` | UUID NOT NULL | Idempotent session-creation key. |
| `status` | TEXT NOT NULL | CHECK IN (`'active'`, `'revoked'`, `'expired'`). |
| `created_at`, `last_activity_at` | TIMESTAMPTZ NOT NULL DEFAULT `clock_timestamp()` | |
| `expires_at` | TIMESTAMPTZ NULL | Attempt expiry + grace. |
| UNIQUE | `(attempt_id, generation)`, `(attempt_id, request_key)` | |
| Partial unique index | `(attempt_id) WHERE status='active'` | **One active writer per attempt.** |

**Rules:** takeover revokes the previous session and increments
`generation`; stale-session writes are rejected (`session_revoked`);
replaying an old `request_key` never reactivates a revoked session.

---

## 5. Question imports (staging → publication)

### 5.1 `question_imports`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_id` | UUID NOT NULL, FK → `cbt_exams(id) ON DELETE CASCADE` | Destination bank. |
| `exam_body` | TEXT NOT NULL | Denormalised for listing. |
| `subject` | TEXT NOT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `source_name`, `source_url` | TEXT NULL | `source_url` HTTPS only. |
| `source_verified` | BOOLEAN NOT NULL DEFAULT `false` | Admin-confirmed official source. |
| `original_filename` | TEXT NOT NULL | |
| `mime_type` | TEXT NOT NULL | |
| `file_bytes` | BIGINT NOT NULL | CHECK `> 0`. |
| `checksum` | TEXT NOT NULL | Content hash. `UNIQUE (checksum, exam_id, lower(subject))` among non-archived rows → re-uploads are idempotent (`duplicate: true`). |
| `storage_path` | TEXT NOT NULL | Private bucket path (`past-questions` bucket). |
| `status` | TEXT NOT NULL DEFAULT `'queued'` | CHECK IN (`'queued'`, `'processing'`, `'extracted'`, `'failed'`, `'completed'`, `'archived'`). |
| `attempts` | INTEGER NOT NULL DEFAULT `0` | Max 5 (claim RPC refuses beyond). |
| `extraction_error` | TEXT NULL | |
| `extraction_warnings` | TEXT[] NOT NULL DEFAULT `'{}'` | |
| `item_count`, `approved_count`, `imported_count`, `duplicate_count` | INTEGER NOT NULL DEFAULT `0` | |
| `uploaded_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at`, `completed_at` | TIMESTAMPTZ | |

### 5.2 `question_import_items` (extracted, awaiting review)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `import_id` | UUID NOT NULL, FK → `question_imports(id) ON DELETE CASCADE` | |
| `source_index` | INTEGER NOT NULL | `UNIQUE (import_id, source_index)`. |
| `question_text` | TEXT NOT NULL | |
| `option_a`..`option_d` | TEXT NOT NULL | |
| `option_e` | TEXT NULL | Flagged for correction (engine serves 4). |
| `correct_option` | CHAR(1) NULL | CHECK IN (`'A'..'E'`). NULL = missing key (cannot be approved). |
| `explanation`, `passage`, `topic`, `raw_text` | TEXT NULL | |
| `review_status` | TEXT NOT NULL DEFAULT `'pending'` | CHECK IN (`'pending'`, `'approved'`, `'rejected'`, `'imported'`). |
| `issues` | TEXT[] NOT NULL DEFAULT `'{}'` | Validation issues (missing key, 5th option, etc.). |
| `duplicate_of` | UUID NULL | Pointer to the existing question when duplicate. |
| `question_id` | UUID NULL, FK → `exam_questions(id) ON DELETE SET NULL` | Set at commit. |
| `updated_at` | TIMESTAMPTZ | Optimistic-concurrency token (`expectedUpdatedAt`). |

**Publication rule (atomic):** `commit` publishes only approved, complete,
non-duplicate rows; destination bank must be classified; provenance guard
re-checked; any failure rolls back the whole batch. Extraction alone never
touches `exam_questions`.

---

## 6. Services and service requests

### 6.1 `service_catalog`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `service_key` | TEXT NOT NULL UNIQUE | Slug (e.g. `nelfund-loan`). |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `category` | TEXT NULL | |
| `route` | TEXT NULL | In-app route, if any. |
| `sort_order` | INTEGER NULL | |
| `active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `application_url` | TEXT NULL | External portal link (HTTPS). |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Seed the four live services (`nelfund-loan`, `results`, `jamb-slip`,
`admission-letters`) + the 16 catalogue definitions from
`src/data/services.ts` (content seeding, not schema).

### 6.2 `service_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `profiles(id) ON DELETE CASCADE` | Owner. |
| `service_id` | UUID NULL, FK → `service_catalog(id)` | |
| `status` | TEXT NOT NULL DEFAULT `'submitted'` | CHECK IN (`'submitted'`, `'reviewing'`, `'processing'`, `'awaiting_information'`, `'completed'`, `'closed'`, `'rejected'`, `'cancelled'`). |
| `form_data` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. Student fields only (student field boundary enforced — staff fields like `admin_note` are not writable by students). |
| `admin_note` | TEXT NULL | Staff-only. |
| `reference_code` | TEXT UNIQUE | Generated at creation (e.g. `ER-...`). |
| `submission_key` | UUID NULL UNIQUE | Idempotency key (client UUID v4). Replays return the existing row. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. `updated_at` is the optimistic-concurrency token for staff updates. |

**Rules:** creation is idempotent on `submission_key` (with
`expected_user_id` + `recovery_only` semantics from the RPC); staff status
changes are audit-logged; students can only read their own rows.

### 6.3 `service_guides`

| Column | Type | Notes |
|---|---|---|
| `service_key` | TEXT PK, FK → `service_catalog(service_key) ON DELETE CASCADE` | |
| `eyebrow`, `summary`, `safety_note` | TEXT NOT NULL DEFAULT `''` | |
| `steps` | JSONB NOT NULL DEFAULT `'[]'` | CHECK array, max 24 steps. `[{title, body, image?, imageAlt?, imageKind?, imageSource?, section?}]`. |
| `status` | TEXT NOT NULL DEFAULT `'draft'` | CHECK IN (`'draft'`, `'published'`). Only published rows are served publicly. |
| `updated_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

---

## 7. News, opportunities, calendar

### 7.1 `news_articles`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT NOT NULL UNIQUE | |
| `title` | TEXT NOT NULL | |
| `excerpt` | TEXT NULL | Mapped to `summary` in the API. |
| `body` | TEXT NOT NULL | HTML (sanitised client-side on render). |
| `category` | TEXT NOT NULL DEFAULT `'general'` | Display label. |
| `category_slug` | TEXT NULL | Canonical slug (derived by DB in the old backend; compute server-side in the new backend from `src/data/newsCategories.ts`). |
| `image_url` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | Provenance. `source_url` HTTPS. |
| `author_id` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `published` | BOOLEAN NOT NULL DEFAULT `false` | |
| `published_at` | TIMESTAMPTZ NULL | |
| `featured` | BOOLEAN NOT NULL DEFAULT `false` | |
| `tags` | TEXT NULL | Comma-separated (frontend `parseNewsTags` splits, max 12). |
| `is_placeholder` | BOOLEAN NOT NULL DEFAULT `false` | Placeholder safety: placeholders need `placeholder_note` + explicit replacement confirmation. |
| `placeholder_note` | TEXT NULL | |
| `verification_status` | TEXT NOT NULL DEFAULT `'verified'` | e.g. `verified`, `expired` (derived when `expires_at` passed). |
| `expires_at` | TIMESTAMPTZ NULL | Freshness window. Expired articles leave the feed, stay reachable by slug. |
| `last_verified_at` | TIMESTAMPTZ NULL | |
| `content_hash`, `dedupe_key` | TEXT NULL | Newsroom dedupe. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

Index: `(published, published_at DESC)`.

### 7.2 Newsroom tables (only if re-implementing ingestion)

`news_sources` (registry: `source_key` PK, tier, feed URL, health,
overrides), `news_ingest_runs` (one row per run with counters),
`news_ingest_candidates` (every discovery + outcome + reason). See
`docs/NEWSROOM_PIPELINE.md` and `src/server/newsroom/`. **If ingestion is
not re-implemented, do not create these tables** — news CRUD alone needs
only `news_articles`.

### 7.3 `opportunities`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `organisation` | TEXT NULL | |
| `category` | TEXT NOT NULL | e.g. `scholarship`, `grant`, `job`, `fellowship`, `competition`. |
| `subcategory` | TEXT NULL | |
| `description` | TEXT NULL | |
| `link_url` | TEXT NULL | HTTPS only. |
| `deadline` | TIMESTAMPTZ NULL | Past-deadline rows must not be listed as available (public filter + `close_expired_opportunities` sweep equivalent). |
| `locations` | TEXT NULL | |
| `eligibility` | TEXT NULL | |
| `education_levels` | TEXT[] NULL | |
| `disciplines` | TEXT[] NULL | |
| `work_mode` | TEXT NULL | |
| `is_active` | BOOLEAN NOT NULL DEFAULT `true` | |
| `is_featured` | BOOLEAN NOT NULL DEFAULT `false` | |
| `source_name` | TEXT NULL | |
| `last_verified_at` | TIMESTAMPTZ NULL | |
| `closed_at` | TIMESTAMPTZ NULL | Set by the expiry sweep. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

### 7.4 Calendar items (`edureach_deadlines` / `edureach_exams` → unify as `calendar_items`)

The old backend has two tables (`edureach_deadlines`, `edureach_exams`)
selected by `?type=deadline|exam`. The new backend should use **one**
table with a `kind` column (the API already abstracts this):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `kind` | TEXT NOT NULL | CHECK IN (`'deadline'`, `'exam'`). |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `due_at`, `starts_at`, `ends_at` | TIMESTAMPTZ NULL | |
| `location` | TEXT NULL | |
| `priority` | TEXT NOT NULL DEFAULT `'normal'` | |
| `status` | TEXT NOT NULL DEFAULT `'active'` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

---

## 8. Student portal data

### 8.1 `student_saved_items`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. |
| `item_type` | TEXT NOT NULL | CHECK IN (`'school'`, `'course'`, `'service'`, `'scholarship'`, `'custom'`). |
| `item_key` | TEXT NOT NULL | Stable key (e.g. institution id/slug). |
| `title` | TEXT NOT NULL | |
| `subtitle`, `detail` | TEXT NULL | |
| `location` | TEXT NULL | |
| `href` | TEXT NULL | |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |
| UNIQUE | `(user_id, item_type, item_key)` | Upsert target. |

Index: `(user_id, created_at DESC)`.

### 8.2 `student_notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL, FK → `users(id) ON DELETE CASCADE` | Owner. |
| `title` | TEXT NOT NULL | |
| `body` | TEXT NULL | |
| `notification_type` | TEXT NOT NULL DEFAULT `'system'` | |
| `href` | TEXT NULL | |
| `read_at` | TIMESTAMPTZ NULL | NULL = unread. |
| `metadata` | JSONB NOT NULL DEFAULT `'{}'` | CHECK object. `metadata.to` carries the service status announced (NTF-1). |
| `created_at` | TIMESTAMPTZ | No `updated_at`. |

Index: `(user_id, read_at, created_at DESC)`. **Rule:** students may create
personal alerts, but staff/system creation is the norm; the old backend
restricted creation to staff after hardening. The new backend should only
allow server-side creation (remove the client insert path).

### 8.3 `student_cgpa_terms` + `student_cgpa_courses`

| Table | Columns |
|---|---|
| `student_cgpa_terms` | `id` UUID PK; `user_id` FK CASCADE; `term_label` TEXT NOT NULL DEFAULT `'Current Semester'`; `gpa` NUMERIC NOT NULL; `total_units` INTEGER NOT NULL; `classification` TEXT NOT NULL; `created_at`, `updated_at`. Index `(user_id, created_at DESC)`. |
| `student_cgpa_courses` | `id` UUID PK; `term_id` FK → terms CASCADE; `user_id` FK CASCADE (denormalised for owner checks); `course_code` TEXT NOT NULL; `units` INTEGER NOT NULL CHECK `> 0`; `grade` TEXT NOT NULL; `grade_points` NUMERIC NOT NULL; `created_at`. Index `(term_id, created_at ASC)`. |

GPA computation is client-side (`src/lib/calc-engine.ts`); the server
stores the snapshot. The new backend may store the snapshot as-is.

### 8.4 Wallets (dormant — do not create unless payments are in scope)

`student_wallets` (`user_id` UNIQUE, `balance` NUMERIC, `currency='NGN'`),
`student_wallet_transactions` (`reference` UNIQUE where non-null,
`transaction_type`, `status`, `amount`), `payment_events`. No frontend
caller exists. **Recommendation: omit from the fresh schema.** If payments
are later required, design idempotent crediting (`reference` unique +
`credit_wallet_payment` equivalent) from scratch.

### 8.5 Legacy / dormant tables (do not create)

`campus_posts`, `campus_post_comments`, `campus_post_likes` (Campus Feed —
no frontend reader), `courses`, `past_questions`, `resources` (legacy
course-scoped uploads, superseded by `past_question_resources` +
`document_bank`), `edureach_notifications` (superseded by
`student_notifications`), `edureach_material_notes` (student notes — no
frontend caller found; omit unless the product revives it).

---

## 9. Documents and files

### 9.1 `document_bank` (PDF bank)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `original_filename` | TEXT NOT NULL | |
| `mime_type` | TEXT NOT NULL DEFAULT `'application/pdf'` | CHECK `= 'application/pdf'`. |
| `file_bytes` | BIGINT NOT NULL | CHECK `> 0 AND <= 10485760` (10 MB). |
| `storage_path` | TEXT NOT NULL UNIQUE | Private `resource-files` bucket. |
| `destination` | TEXT NOT NULL DEFAULT `'inbox'` | CHECK IN (`'inbox'`, `'past_questions'`, `'admission_guides'`, `'scholarships'`, `'news_attachments'`, `'school_resources'`, `'other'`). |
| `exam_body` | TEXT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). Required when `destination='past_questions'`. |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | Required when `destination='past_questions' AND exam_body='POST-UTME'`. |
| `subject`, `course` | TEXT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `description` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | `source_url` HTTPS. |
| `source_verified` | BOOLEAN NOT NULL DEFAULT `false` | Public delivery requires `true`. |
| `news_article_id` | UUID NULL, FK → `news_articles(id) ON DELETE SET NULL` | |
| `opportunity_id` | UUID NULL, FK → `opportunities(id) ON DELETE SET NULL` | |
| `status` | TEXT NOT NULL DEFAULT `'inbox'` | CHECK IN (`'inbox'`, `'routed'`, `'rejected'`). Public delivery requires `'routed'`. |
| `routed_resource_id` | UUID NULL, FK → `past_question_resources(id) ON DELETE SET NULL` | |
| `uploaded_by`, `routed_by` | UUID NULL, FK → `users(id) ON DELETE SET NULL` | |
| `routed_at` | TIMESTAMPTZ NULL | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

### 9.2 `past_question_resources` (public past-question library)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `exam_body` | TEXT NOT NULL | CHECK IN (`'JAMB'`, `'WAEC'`, `'NECO'`, `'POST-UTME'`). |
| `institution_id` | UUID NULL, FK → `institutions(id) ON DELETE SET NULL` | |
| `subject`, `course` | TEXT NULL | |
| `paper_year` | INTEGER NULL | CHECK 1954..2100. |
| `title` | TEXT NOT NULL | |
| `description` | TEXT NULL | |
| `source_name`, `source_url` | TEXT NULL | |
| `storage_path` | TEXT NULL | Private copy; NULL = external-only. CHECK: at least one of `storage_path`/`source_url` non-null. |
| `access` | TEXT NOT NULL DEFAULT `'view'` | CHECK IN (`'view'`, `'download'`). |
| `published` | BOOLEAN NOT NULL DEFAULT `false` | Only published rows are listed. |
| `verified_at` | TIMESTAMPTZ NULL | |
| `created_at`, `updated_at` | TIMESTAMPTZ | Standard. |

**File metadata rule:** every stored file has a row (`storage_path`,
`file_bytes`, `mime_type`, checksum where relevant). No orphan objects:
deleting a row deletes its object (or vice versa, transactionally).

---

## 10. Site content, analytics, audit, operations

### 10.1 `site_settings` + `site_pages` + `site_page_revisions`

| Table | Key columns |
|---|---|
| `site_settings` | `key` TEXT PK, CHECK IN (`'brand'`, `'footer'`, `'contact'`, `'social'`); `value` JSONB NOT NULL DEFAULT `'{}'` (CHECK object); `updated_by` FK SET NULL; `updated_at`. Public read. |
| `site_pages` | `slug` TEXT PK, CHECK `^[a-z0-9-]{2,64}$`; `title` TEXT NOT NULL; `summary` TEXT NOT NULL DEFAULT `''`; `body` TEXT NOT NULL DEFAULT `''`; `status` CHECK IN (`'draft'`, `'published'`); `review_state` CHECK IN (`'pending'`, `'approved'`); `revision` INTEGER NOT NULL DEFAULT `1` CHECK `>= 1`; `updated_by` FK SET NULL; `updated_at`; `published_at`. Index `(slug) WHERE status='published'`. |
| `site_page_revisions` | `id` BIGSERIAL PK; `slug` FK → `site_pages(slug)` CASCADE; `revision` INTEGER NOT NULL; `title`, `summary`, `body`, `status`, `review_state` (snapshots); `edited_by` FK SET NULL; `edited_at`. UNIQUE `(slug, revision)`. Append-only (no UPDATE/DELETE). |

### 10.2 `site_analytics_events`

`id` BIGINT GENERATED ALWAYS AS IDENTITY PK; `event_name` TEXT NOT NULL
(taxonomy-validated server-side); `path` TEXT NULL (sanitised, no query);
`session_id` TEXT NOT NULL; `user_id` UUID NULL; `referrer` TEXT NULL
(origin+path only); `user_agent` TEXT NULL; `metadata` JSONB NOT NULL
DEFAULT `'{}'` (capped 2 KB, undeclared fields dropped); `created_at`.
Retention: 90 days (delete job). No client grants.

### 10.3 `admin_audit_logs` (append-only)

`id` UUID PK; `admin_user_id` UUID NOT NULL FK → `users(id)`; `action`
TEXT NOT NULL; `resource_type` TEXT NOT NULL; `resource_id` TEXT NULL;
`metadata` JSONB NOT NULL DEFAULT `'{}'`; `result` TEXT NOT NULL DEFAULT
`'success'` CHECK IN (`'success'`, `'failure'`); `created_at`. Written in
the **same transaction** as the mutation it describes (via an
`admin_audit_log` equivalent). Reads require `audit.read`. Never updated
or deleted by the app. **No question text, answer keys, or candidate PII
beyond an id in `metadata`.**

### 10.4 Operations tables

| Table | Purpose |
|---|---|
| `rate_limit_hits` / durable counter | Cross-instance rate limiting (`check_rate_limit` equivalent). The new backend may use Redis/Upstash instead — but must preserve the per-route limits + headers. |
| `scheduled_job_runs` | Job observability (`GET /api/admin/jobs`). `id`, `job_name`, `started_at`, `finished_at`, `status`, `triggered_by`, counters, `error`. |
| `cbt_bank_history` (or audit-backed) | Bank classification/assignment history (`GET .../banks/:id/history`). May be implemented as filtered `admin_audit_logs` rows instead of a separate table. |

---

## 11. Relationship summary

```
users 1—1 profiles
users 1—* service_requests, cbt_attempts, student_saved_items,
          student_notifications, student_cgpa_terms, student_security_events,
          cbt_bank_candidate_assignments, admin_audit_logs (as actor)
institutions 1—* cbt_exams (POST-UTME), past_question_resources, document_bank
cbt_exams 1—* exam_questions, cbt_attempts, question_imports
cbt_exams 1—0/1 cbt_bank_security 1—* cbt_bank_candidate_assignments
cbt_attempts 1—* cbt_answers, cbt_v2_operations, cbt_v2_writing_sessions
question_imports 1—* question_import_items 1—0/1 exam_questions (question_id)
service_catalog 1—* service_requests, 1—0/1 service_guides
news_articles 1—* document_bank (news_article_id)
opportunities 1—* document_bank (opportunity_id)
site_pages 1—* site_page_revisions
student_cgpa_terms 1—* student_cgpa_courses
past_question_resources 1—* document_bank (routed_resource_id)
```

---

## 12. Existing assumptions the new schema must not break

1. **Frozen paper:** `cbt_attempts.question_ids` is the paper. Editing or
   deleting a question mid-attempt must not change the paper being scored.
   (If a question is deleted, the attempt must fail closed with
   "requires review", never silently re-plan.)
2. **Subject canonicalisation** (§3.4) — planning, availability, and
   compulsory-subject checks all use canonical keys.
3. **Paper planning algorithm:** subjects in student-chosen order, one
   contiguous block each; every chosen subject gets ≥1 question while the
   target allows; remainder distributed by smallest used-share
   (largest-remainder, capacity-aware); mock quota (`mock_subject_quota`)
   applied first. The frontend `previewPlan()` mirrors this for display;
   the server plan is authoritative and the two are compared before
   submission.
4. **Limits:** `cbt_limits` = `{minQuestions:5, maxQuestions:100,
   minMinutes:5, maxMinutes:240, maxSubjects:9}` (frontend
   `DEFAULT_CBT_LIMITS`; note the old SQL `cbt_limits()` said
   `maxSubjects:6` — **the new backend must pick one value and use it
   everywhere**; recommend 9 to match the frontend + WAEC/NECO rule).
5. **JAMB paper standard:** 180 questions / 120 minutes, English 60 + 40×3.
   Practice keeps the same pace over a shorter paper
   (`durationForQuestionCount`).
6. **Idempotency keys:** service requests (`submission_key`), v2
   operations (`operation_key`), v2 sessions (`request_key`) — replays
   return the recorded response, never a second write.
7. **Optimistic concurrency:** service-request staff updates
   (`expected_updated_at`), import item edits/reviews
   (`expectedUpdatedAt`), site-page revisions — mismatch → 409.
8. **Fail-closed classification:** no `cbt_bank_security` row → no access,
   no counts, no questions, 404 (student) / 503 (policy unavailable).
9. **Correction release:** `correct_option`/`explanation` are released only
   (a) after submission, per attempted question (guest), or (b) after
   `correction_release_at` for restricted banks. Never in paper/draft/
   catalogue responses.
10. **Audit in-transaction:** every admin mutation writes an audit row in
    the same transaction.

---

# Part D — Authentication and Permissions

> **Source document:** `AUTHENTICATION-AND-PERMISSIONS.md` (Part D of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A–C, E–G within this package.

---

# EduReach Hub — Authentication and Permissions

> **Purpose.** How sign-up, login, password reset, sessions, roles, and
> permissions work today, and what the new backend must reproduce.
> Verified against `pages/AuthPageV2.tsx`, `src/lib/auth.tsx`,
> `src/lib/supabase.ts`, `src/lib/capabilities.ts`, `lib/auth.ts`,
> `lib/authorization.ts`, `pages/AdminLayout.tsx`,
> `src/app/ProtectedRoute.tsx`, and `server.ts` guards.

---

## 1. Identity provider today: Supabase Auth

- **Provider:** Supabase Auth (GoTrue) — email/password only. No OAuth, no
  magic links, no phone OTP.
- **Client:** `src/lib/supabase.ts` → `createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true,
  detectSessionInUrl: true } })`. The session (access JWT + refresh token)
  is persisted in browser storage under the default Supabase key
  (`sb-<ref>-auth-token`).
- **Server verification:** `lib/auth.ts` `verifyJWT(token)` calls
  `supabase.auth.getUser(token)` (validates signature + expiry against the
  Supabase Auth server), then loads `profiles.role` + `full_name` and
  resolves capabilities. **The server never trusts `user_metadata` or
  `app_metadata` for authorization** (except as a last-resort fallback in
  `AdminLayout` when the API is unreachable — and even there, only to
  *display* the console; every API call re-checks server-side).
- **Token transport:** `Authorization: Bearer <access_token>` header on
  every authenticated API call (`authHeaders()` in `src/lib/api.ts`).
  No cookies, no CSRF tokens, no refresh-token handling in app code
  (Supabase JS auto-refreshes).

---

## 2. Sign-up behaviour (`pages/AuthPageV2.tsx`, mode `signup`)

**Frontend validation (before any network call):**
- `firstName`, `lastName` required.
- `email` must contain `@`.
- `phone` must have ≥10 digits (Nigerian number).
- `password` ≥8 characters; `confirmPassword` must match.
- `termsAgreed` must be true.
- `accountType` ∈ `student|parent|teacher` (default `student`).

**Flow:**
1. `supabase.auth.signUp({ email, password, options: { data: {
   first_name, last_name, full_name, phone, account_type, terms_agreed:
   true } } })`.
2. If a session is returned immediately (`signUpData.session?.user` —
   email confirmation disabled): upsert `profiles` row
   `{ id, full_name, phone, role: 'student' }` (direct PostgREST write),
   `notifyAuthChanged()`, navigate to `?next=` (safe-path checked) or
   `/dashboard`.
3. If no session (email confirmation enabled): switch to `verify` mode
   ("A verification link has been sent to <email>") with a
   **Resend verification email** button
   (`supabase.auth.resend({ type: 'signup', email })`).
4. The DB trigger `handle_new_user()` creates the `profiles` row from
   `raw_user_meta_data` + a `student_wallets` row atomically (see
   `DATABASE-REQUIREMENTS.md` §1.2). The new backend must create the
   profile atomically with the user regardless of provider.

**Unconfigured mode:** throws `EduReach account registration is not
available until the live account service is configured.` — no local
account creation.

---

## 3. Login behaviour (mode `signin`)

1. `supabase.auth.signInWithPassword({ email, password })`.
2. `supabase.auth.getSession()` → if `access_token` present:
   - Best-effort `POST /api/admin/bootstrap` (promotes the designated
     first admin; failures ignored — "already bootstrapped or not the
     designated account").
   - Probe `GET /api/admin/session` with the token: `ok` → staff.
   - Clear `edureach-admin-student-view` sessionStorage key,
     `notifyAuthChanged()`, navigate to `/admin` if staff, else to the
     safe `?next=` path.
3. Errors surface via `userFacingError()` (e.g. invalid credentials →
   generic message; the frontend does not distinguish "no account" from
   "wrong password" beyond what Supabase returns).

**No lockout, no CAPTCHA, no 2FA prompt at login.** MFA enrolment exists
(`SecurityModal`) but login does not challenge for it in the current
frontend (Supabase would return an `aal` claim; the frontend does not
branch on it). **The new backend should decide explicitly whether MFA
challenge is required at login** — currently it is enrolment-only.

---

## 4. Password reset (modes `forgot` / `reset`)

- **Forgot:** `supabase.auth.resetPasswordForEmail(email, { redirectTo:
  '<origin>/reset-password' })`. The frontend **swallows errors** and
  always shows `If an account exists for this email, you will receive
  password reset instructions.` (no account-existence disclosure).
- **Reset:** listens for `PASSWORD_RECOVERY` auth event → switches to
  `reset` mode. Validates password ≥8 chars + match, then
  `supabase.auth.updateUser({ password })`. Success → back to `signin`
  mode with `Password updated successfully. You can now sign in.`
- **Unconfigured mode:** shows `Password reset email is unavailable in
  local preview mode...` and does not call Supabase.

**New-backend requirement:** reset links must be single-use, time-limited,
and the forgot endpoint must remain enumeration-safe. If owning auth,
implement `POST /auth/password/forgot` + `POST /auth/password/reset`
with the same generic response.

---

## 5. Session management

| Aspect | Current behaviour |
|---|---|
| Session source | `supabase.auth.getSession()` (local) + `onAuthStateChange` subscription (`src/lib/auth.tsx` `AuthProvider`). |
| Auth context | `AuthProvider` exposes `{ user: {id, email, name, avatarUrl, isLocal} \| null, isAuthenticated, isLoading, refreshAuth, signOut }`. `name` derives from `user_metadata.full_name` → `first_name + last_name` → email prefix → `'Student'`. |
| Cross-tab sync | `storage` event listener (keys starting `edureach-`) + custom `AUTH_EVENT` (`notifyAuthChanged` / `dispatchAuthChanged`). |
| Sign-out | `supabase.auth.signOut()` (best-effort try/catch for local-preview sessions), clear `edureach-admin-student-view`, `setUser(null)`, dispatch auth-changed. `ProtectedRoute` then redirects to `/login?next=...`. |
| Sign-out others | `supabase.auth.signOut({ scope: 'others' })` (`SecurityModal`). |
| Password change | `supabase.auth.updateUser({ password })` (`SecurityModal`) + `recordSecurityEvent('password_changed')`. |
| MFA | `mfa.listFactors/enroll/challenge/verify/unenroll` (`SecurityModal`); `profiles.mfa_enabled` flag updated directly. |
| Token refresh | Automatic (Supabase JS). App code never handles refresh tokens. |
| Session expiry UX | API 401 → `EduReachError` kind `auth` → `userFacingError` maps to `Your session has expired. Please sign in again.` |

**Frontend assumptions the new backend must honour:**
- The access token is a **JWT** the server can verify statelessly (or via
  the Auth server). The frontend sends it as a Bearer token and expects
  401 (not a redirect) when it expires.
- `user.id` (UUID) is the stable identity used for ownership checks
  (`expectedUserId` on service submission, attempt ownership, saved items).
  The frontend refuses to submit a service request if
  `user.id !== expectedUserId` ("Your account changed...").
- The frontend **never** sends a user id for authorization — ownership is
  always derived from the token server-side. (The one exception is
  `expectedUserId` on service submission, which is a *consistency check*,
  not an authorization input; the RPC re-checks `auth.uid()`.)

---

## 6. Roles and capabilities

### 6.1 Roles (`src/lib/capabilities.ts` — single vocabulary, shared by browser, server, tests)

| Role | Meaning | Stored value |
|---|---|---|
| `student` | Default. All signed-in users. | `'student'` (also the fallback for unknown values — least privilege). |
| `content_editor` | Editorial staff: news, opportunities, institutions, calendar, services catalogue, CBT content, site content, analytics read, data read. | `'content_editor'` |
| `service_admin` | Service-operations staff: service catalogue read + service-request read/process. | `'service_admin'` |
| `super_admin` | All capabilities. | `'super_admin'` (legacy `'admin'`/`'moderator'` map here). |

- **Legacy mapping:** `admin`, `moderator` → `super_admin` (existing staff
  keep their access; a migration normalises stored values).
- **Retired roles:** `senate_admin`, `campus_agent` → treated as
  `student` (they could read staff rows via RLS but never passed the admin
  gate; now they get no staff capability at all).
- **Unknown values** → `student`.
- Every staff role **also** holds all student capabilities (a staff member
  is still a signed-in person who may use the student dashboard).
  Student capabilities are owner-scoped, so this grants no access to
  another student's data.

### 6.2 Capabilities (30)

**Student (owner-scoped — `OWNER_SCOPED_CAPABILITIES`):**
`profile.read`, `profile.update`, `dashboard.access`, `settings.read`,
`settings.update`, `service_request.create`, `service_request.read_own`,
`cbt.attempt`, `cbt.view_result`.

**News/editorial:** `news.read`, `news.create`, `news.update`,
`news.publish`, `news.delete`.

**Opportunities:** `opportunity.read`, `opportunity.create`,
`opportunity.update`, `opportunity.delete`.

**Institutions:** `institution.read`, `institution.create`,
`institution.update`, `institution.delete`.

**Calendar:** `calendar.read`, `calendar.create`, `calendar.update`,
`calendar.delete`.

**Service catalogue:** `service.read`, `service.create`, `service.update`,
`service.delete`.

**Service requests (staff):** `service_request.read`, `service_request.process`
(read and process are separate so a content editor can never see requests).

**CBT admin:** `cbt.read` (includes question banks + answer keys — staff
only), `cbt.manage`.

**Analytics/audit:** `analytics.read`, `audit.read`.

**Data control:** `data.read`, `data.write`, `data.import`.

**Site content:** `site.read`, `site.update`.

**Account admin:** `user.read`, `user.suspend`, `user.manage_roles`.

### 6.3 Role → capability matrix

| Capability group | student | content_editor | service_admin | super_admin |
|---|---|---|---|---|
| Student (owner-scoped) | ✓ | ✓ | ✓ | ✓ |
| News, opportunities, institutions, calendar, services catalogue | — | ✓ | — (services read only) | ✓ |
| `service_request.read` / `.process` | — | — | ✓ | ✓ |
| `cbt.read` / `cbt.manage` | — | ✓ | — | ✓ |
| `analytics.read` | — | ✓ | — | ✓ |
| `audit.read` | — | — | — | ✓ |
| `data.read` / `data.write` / `data.import` | — | read only | — | ✓ |
| `site.read` / `site.update` | — | ✓ | — | ✓ |
| `user.read` / `user.suspend` / `user.manage_roles` | — | — | — | ✓ |

(`service_admin` also holds `service.read` for the catalogue.)

### 6.4 Enforcement rules (must be reproduced)

1. **Server is the boundary.** Every admin route declares its capability
   via `requireCapability(...)` (`lib/authorization.ts`). Missing token →
   401; insufficient capability → 403 with the generic message (never a
   hint about which role would be allowed). Tests
   (`tests/authorization.test.ts`) prove every privileged route carries a
   capability.
2. **Ownership is separate from capability.** `can(user, capability,
   {ownerId})` requires both the capability *and* `ownerId === user.id`
   for owner-scoped capabilities. Staff read other people's data through
   staff capabilities (`cbt.read`, `service_request.read`), never by
   impersonating ownership.
3. **Ownership failures return 404**, not 403, so resource existence is
   not leaked (CBT attempts, progress, v2 state).
4. **Role is re-read from the database on every request** (`verifyJWT`
   loads `profiles.role`). Client-supplied roles/headers/metadata are
   never trusted. Self-promotion is impossible: the `role` column is not
   in the client-writable column grant, and role changes go only through
   `POST /api/admin/users/:id/role` with `user.manage_roles`.
5. **Bank access is a third layer:** even with `cbt.attempt`, a student
   needs `cbt_bank_candidate_access(exam) = true` (public bank or active
   restricted assignment). Unclassified → false (fail closed).
6. **Audit:** `recordAudit()` writes via the `admin_audit_log` RPC and
   never throws (an audit failure must not fail the operation).

---

## 7. Protected routes and admin restrictions

### 7.1 Student protected routes (`ProtectedRoute`)

Prefixes: `/dashboard`, `/profile`, `/settings`, `/services/track`,
`/track`. Behaviour: loading portal while `isLoading`; redirect to
`/login?next=<encoded path+search+hash>` when unauthenticated (with
loop/double-effect guards). **CBT result routes** (`/dashboard/cbt/results`,
`/cbt/results/:id`) are additionally owner-checked server-side
(`fetchCbtResult` requires `supabase.auth.getUser()` + owner-scoped reads).
**CBT session routes** (`/cbt/session/:id`) are *not* wrapped in
`ProtectedRoute` — the paper endpoint enforces auth (401) and the page
shows the error. Guest practice (`/cbt`, `/cbt/setup/*`) is public.

### 7.2 Admin console (`AdminLayout`)

- Session resolution: `GET /api/admin/session` (server truth) with a
  direct-`profiles` fallback for display only.
- Navigation filtered by `hasCapability()`; deep links without the
  capability render `AdminSectionDenied` ("Every admin API re-checks
  capabilities, so nothing can be reached by editing the URL.").
- `ADMIN_ROUTE_CAPABILITIES` maps each `/admin/*` path to its capability
  (`src/lib/capabilities.ts` `capabilityForAdminPath()`); `/admin`
  overview requires any staff membership.
- Sign-out from the console calls `supabase.auth.signOut()`.

### 7.3 Admin restrictions (server-side)

- `requireStaff`: at least one non-owner-scoped capability, else 403.
- `requireCapability(...caps)`: any-of semantics (e.g. PDF upload accepts
  `data.write` OR `institution.update` OR `cbt.manage`).
- Content-manager CBT tables additionally require `cbt.read` (list) /
  `cbt.manage` (write) via `contentCbtAllowed()` — `data.write` alone
  cannot touch `exam_questions`.
- Question-import routes require `cbt.manage` (the `guard`).
- Restricted-bank writes execute with the **caller's own token**
  (user-scoped client) so the database re-checks authority; the service
  role never classifies a bank or assigns a candidate.
- CBT write RPCs execute with the user-scoped client so `auth.uid()`
  resolves; the service-role client would run as nobody and the RPCs
  refuse. The new backend must derive the actor from the verified token
  in every transaction.

### 7.4 Suspension

`profiles.suspended` (via ban/unban) is set by `user.suspend`. **Gap:**
the current `verifyJWT` does not check `suspended` — a suspended user
with a valid token can still call the API until the token expires.
**The new backend must refuse suspended users at authentication time
(401/403) and ideally revoke sessions on ban.** Recorded as a required
fix, not a behaviour to preserve.

---

## 8. The identity-provider decision (for the new backend)

The new backend must choose one of two options. Both keep the capability
vocabulary, role matrix, and enforcement rules above unchanged.

### Option A — Keep Supabase Auth as identity provider (recommended for phase 1)

- Frontend keeps `supabase.auth.*` unchanged (zero auth rewrite).
- New backend verifies Supabase JWTs (JWKS or HS256 secret) on every
  request, re-reads `role` from its own database, and owns all
  authorization + data decisions.
- The new backend's `users` table mirrors Supabase `auth.users.id` (or
  the backend reads the Supabase user via the Auth Admin API).
- Email delivery (verification/reset) stays with Supabase.
- **Trade-off:** keeps a hosted dependency the rebuild is trying to shed,
  but ships fastest and safest.

### Option B — Own auth in the new backend

- New endpoints: `POST /auth/register`, `POST /auth/verify-email`,
  `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`,
  `POST /auth/password/forgot`, `POST /auth/password/reset`,
  `POST /auth/mfa/*` (enrol/challenge/verify/unenrol).
- Passwords: argon2id hashes; refresh tokens: rotating, httpOnly cookies
  or Bearer (frontend currently uses Bearer — keep Bearer to minimise
  frontend change).
- Requires: email provider (none configured in this repo), credential
  migration plan for existing users (force password reset is the safe
  default), and a frontend auth rewrite (largest single frontend change).
- **Trade-off:** full control, no Supabase dependency; highest risk.

**Either way:** the backend derives the caller only from a verified
token and re-reads `role` from the database on every request. The
frontend's `AuthProvider` contract (`{user, isAuthenticated, isLoading,
refreshAuth, signOut}`) and `ProtectedRoute` behaviour must be preserved.

---

## 9. Frontend assumptions about tokens and identity (checklist for the new backend)

- [ ] Access token is a JWT sent as `Authorization: Bearer <token>`.
- [ ] Expired/invalid token → **401** with a plain-string error body.
- [ ] `user.id` is a stable UUID; ownership checks compare it to row
      `user_id`. The frontend sends `expectedUserId` only as a consistency
      check, never as authorization.
- [ ] The frontend reads `user_metadata` (`full_name`, `first_name`,
      `last_name`, `avatar_url`) for display name/avatar only — never for
      authorization. The new backend's `/me` (or profile) endpoint should
      return the display name so the frontend can stop reading metadata.
- [ ] `onAuthStateChange` events (`PASSWORD_RECOVERY`, sign-in/out) drive
      UI mode switches. If auth moves, the frontend needs an equivalent
      event/refresh mechanism.
- [ ] Local-preview sessions (`isLocal: true`, `edureach-local-user-email`)
      exist for unconfigured environments. The new backend does not need
      to support them, but must not break the unconfigured rendering path
      (honest offline state, no crashes).
- [ ] Admin detection is by `GET /api/admin/session` returning 200 (staff)
      vs 403 (student). Preserve this probe semantics.
- [ ] Bootstrap is by email match (`EDUREACH_ADMIN_BOOTSTRAP_EMAIL`),
      rate-limited, one-time. Preserve the endpoint + semantics.

---

# Part E — CBT Backend Requirements

> **Source document:** `CBT-BACKEND-REQUIREMENTS.md` (Part E of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A–D, F–G within this package.

---

# EduReach Hub — CBT Backend Requirements

> **Purpose.** The complete CBT workflow the new backend must implement:
> exam/bank configuration, subject selection, compulsory-English rules,
> question retrieval and ordering, answer saving, timer/deadline handling,
> attempt recovery, submission, server-side scoring, result persistence,
> guest practice, question confidentiality, and concurrent-session
> restrictions. Existing frontend request/response expectations are
> preserved verbatim where practical (see `API-REQUIREMENTS.md` §3–§5 for
> the wire contract).
>
> **Verified against:** `pages/ExamSetupPage.tsx`, `pages/CbtSessionPage.tsx`,
> `pages/CbtPage.tsx`, `pages/CbtPracticeEntryPage.tsx`,
> `pages/CbtResultsPage.tsx`, `src/lib/cbt-config.ts`,
> `src/lib/cbtAnswerQueue.ts`, `src/lib/useCbtPageWriter.ts`,
> `src/lib/cbtProtocolValidation.ts`, `src/lib/api.ts` (CBT section),
> `server.ts` CBT handlers, and the CBT migrations
> (`20261002120000_cbt_practice_and_mock_modes.sql`,
> `20261022090000_cbt_question_serving_rules.sql`,
> `20261022091500_cbt_mock_paper_spec.sql`,
> `20261022093000_cbt_deadline_grace.sql`,
> `20261025120000_cbt_submit_grace_120.sql`,
> `20261107120000_cbt_attempt_protocol_fence.sql`,
> `20261107130000_cbt_v2_server_lifecycle.sql`,
> `20261107140000_cbt_v2_answer_gateway.sql`,
> `20261107150000_cbt_single_writing_session.sql`).

---

## 1. Exam and bank configuration

### 1.1 Banks (`cbt_exams`)

- A bank is one row in `cbt_exams` (see `DATABASE-REQUIREMENTS.md` §3.1).
  `exam_body` ∈ `JAMB | WAEC | NECO | POST-UTME` (canonical uppercase).
  POST-UTME banks carry `institution_id` (required); other bodies null it.
- `duration_minutes` is the bank's default duration (5–240 in the new
  schema). `mock_question_count` + `mock_subject_quota` define the fixed
  mock paper when present.
- `format_status` (`verified | partially_verified | unverified`) +
  `official_guidance_url` + `format_notes` + `guidance_year` describe the
  exam format provenance shown in the setup wizard. They do not affect
  serving.
- `is_active=false` banks are invisible in the catalogue, setup, start,
  paper, and guest flows.

### 1.2 Bank classification (fail closed)

- Every bank must have a `cbt_bank_security` row (`public` or
  `restricted` + `correction_release_at`). **No row = unclassified =
  inaccessible**: excluded from `GET /api/cbt/exams` (including counts),
  `GET .../subjects` → 404, start → 404, paper → 404, guest → 404.
- `public` banks: anyone (including guests) may list metadata, start
  attempts (signed-in), and use guest practice.
- `restricted` banks: only users with an **active** candidate assignment
  may access. Revocation takes effect immediately for all subsequent
  operations (re-checked inside every write transaction).
- Classification is staff-chosen (`cbt.manage`) and immutable once set.
  `correction_release_at` (restricted only) is future-only on set and can
  never move earlier.
- **Policy-unavailable fails closed with 503** (`CBT service is
  temporarily unavailable.`), never by falling back to open access.

### 1.3 Subject catalogue vs. bank availability

- `cbt_subject_catalog` is the governed subject list per exam body
  (advisory for the wizard).
- The **authoritative** servable list for a bank is derived from actual
  `exam_questions` rows (`review_status != 'rejected'`), aggregated by
  canonical subject key with a display label. `GET .../subjects` returns
  this + `totalQuestions` + `review` counts + `mock` spec + `rules`.
- The wizard (`ExamSetupPage`) renders from `GET .../subjects` and
  validates with the same rules the server enforces. The server is
  authoritative; the wizard is a preview.

---

## 2. Subject selection and compulsory-English rules

### 2.1 Canonicalisation

All subject comparisons use the canonical key (`normalizeSubject()`):
trim, collapse `[-_]+` to space, lowercase, and map
`use of english | english language | english → english`.
Display names are never rewritten. The server must canonicalise
identically (dedupe, compulsory checks, planning, availability).

### 2.2 Compulsory subjects

- **JAMB (UTME): Use of English is compulsory in both practice and mock.**
  Enforced in the wizard (`compulsorySubjectKeys()`), in the Express
  pre-check, and in the start RPC. Error (422):
  `Use of English is compulsory for JAMB UTME. Include it in your subject
  combination.`
- **WAEC, NECO, POST-UTME: no compulsory subject.** English is selectable,
  never forced. (The wizard previously gated Start on English presence for
  all bodies — a bug that was fixed by gating only when
  `compulsoryKeys.length > 0`. Do not regress this.)
- `GET .../subjects` returns `rules.compulsorySubjects` (canonical keys)
  + `rules.compulsoryMissing` (true when the bank has no English pool, so
  the wizard can block Start with an honest message). The wizard prefers
  the server's `rules` over its local `compulsorySubjectKeys()`.

### 2.3 Subject-count limits

- General: `maxSubjects` from `cbt_limits` (frontend default 9; old SQL
  said 6 — **the new backend must use one value everywhere; recommend 9**).
- JAMB: at most 4 subjects (English + 3 others), in both modes.
- WAEC/NECO mocks: at least 4, at most 9.
- POST-UTME mocks: at least 4.
- Practice: at least 1 subject (no minimum beyond that).

### 2.4 Mock combination rules (`mockCombinationError`)

- JAMB mock: exactly 4 subjects including English.
- WAEC/NECO mock: at least 4 subjects.
- POST-UTME mock: at least 4 subjects.
- Practice: flexible (1+ subjects, student-sized).

---

## 3. Modes: practice vs. mock

| Aspect | Practice | Mock |
|---|---|---|
| Size | Student-chosen `questionCount` (5–100) | Bank's paper (`mock_question_count` / `mock_subject_quota`), or full bank |
| Duration | Student-chosen (5–240 min), or pace-derived (`durationForQuestionCount`) | Bank default (`mockDurationMinutes`, default 120) |
| Subjects | Student-chosen (1+) | Governed combination (§2.4) |
| Quota | Proportional across chosen subjects | Fixed quota (JAMB: English 60 + 40×3) |
| Resume | Resumable in-progress attempt returned on re-start | Same |

The frontend `CbtMode` is `'practice' | 'mock'`; `mode` defaults to
`practice` in the setup page (unless `?mode=mock`).

---

## 4. Paper planning (deterministic, server-authoritative)

The server plans the paper at start time and **freezes** it into
`cbt_attempts.question_ids` (ordered UUID array). The frontend
`previewPlan()` mirrors this algorithm for display; the server plan is
authoritative and the two are compared before submission.

**Algorithm (from `plan_cbt_paper` + `previewPlan`):**
1. Preserve the student's subject order. Drop subjects with zero available
   questions (the caller reports them as uncovered).
2. Target = `min(requested total, total available)`.
3. If a subject quota exists (JAMB mock): assign required questions first
   (capped by availability and target), trim from the end if over target.
4. If no quota and `target >= subject count`: give every subject 1 question.
5. Distribute the remainder one at a time to the subject with the smallest
   used-share (`quota / available`), capacity-aware, deterministic.
6. Materialise subject-by-subject in student order, each block ordered by
   `exam_questions.position, id`, limited to the quota.
7. Positions are the array order (1-based). `subject_plan` is derived:
   `[{subject, questions, first, last}]`.

**JAMB pace:** 180 questions / 120 minutes. Practice duration =
`ceil(count / 180 * 120)` clamped to 5–240 (`durationForQuestionCount`).
Question-count choices are the presets `[10,20,30,40,50,60,80,100]`
filtered to `[minQuestions, min(maxQuestions, bankTotal)]`, plus the bank
total itself when servable (`questionCountOptions`).

---

## 5. Attempt start

**Endpoint:** `POST /api/cbt/exams/:examId/attempts` (§3.1 in API doc).
Rate limit: 60 starts / 10 min per user (per-user, not per-IP — a school
lab is one IP behind NAT).

**Server steps:**
1. Authenticate + require `cbt.attempt`.
2. Canonicalise + dedupe subjects; validate count limits, JAMB English,
   mock combination, practice question-count limits (422 on failure).
3. Check bank exists, `is_active`, and `candidate_access` (404 otherwise).
4. Call the start logic (transaction): if an in-progress attempt exists
   for this user+exam, return it with `resumed: true` (200). Otherwise
   plan the paper (§4), freeze `question_ids`, compute `subject_plan`,
   `selected_subjects`, `duration_minutes`, `expires_at =
   started_at + duration`, insert the attempt (201).
5. Return `CbtConfiguredStart`.

**Idempotency:** re-starting with the same configuration while an attempt
is in progress returns the same attempt (no duplicate). The frontend
navigates to `/cbt/session/<id>` immediately after start.

---

## 6. Question retrieval (paper)

**Endpoint:** `GET /api/cbt/attempts/:attemptId/paper` (§3.2).

- Owner check (`user_id = caller`) + bank-access re-check per request
  (revocation stops paper access immediately) → 404 on mismatch.
- Expiry check: if `expires_at` passed (plus grace), mark expired via the
  owner-scoped expiry RPC and return 409 `This CBT attempt has expired.`
- Protocol: stored `protocol` selects the response. Legacy attempts →
  `{version:1}` via the paper RPC. v2 attempts → `{version:2,
  scope:'local-rehearsal'}` **only** when the rehearsal gate is open;
  v2 attempt without the gate → 503. The frontend validates the protocol
  object strictly (`CbtProtocolUnavailableError` otherwise).
- Questions are returned **without** `correct_option`/`explanation`:
  `{position, subject, id, text, options[4]}`. The frozen `question_ids`
  order defines positions; a missing question (deleted mid-attempt) →
  409 `This attempt requires review.` (fail closed, never re-plan).
- `serverTime` (server clock ISO string) is returned so the client timer
  uses server time, not the device clock.
- `savedAnswers` (draft) + `questionIndex` (resume position) are returned
  for recovery.

---

## 7. Answer saving

### 7.1 Legacy (v1) draft — the production path

**Endpoint:** `PATCH /api/cbt/attempts/:attemptId/draft` (§3.3).

- Body: `{ answers: Record<position, 0-based index>, questionIndex? }`.
- **Idempotent:** re-saving the same draft succeeds as a no-op. The
  frontend debounces saves (`queueSave` in `CbtSessionPage`) and also
  keeps a `localStorage` pending snapshot (`edureach-cbt-pending:<id>`)
  as a recovery aid.
- Validation: `answers` must be an object; each value must be an integer
  0–3 (or absent = unanswered); positions must be within the frozen
  paper. Invalid → 400.
- Expiry: saving after `expires_at` (+ grace) → 409 + mark expired.
- Protocol mismatch (v2 attempt via v1 draft) → 409.
- The draft is stored in `cbt_attempts.answers_draft` (+
  `current_question`). The new backend must keep this shape (JSONB object
  keyed by 1-based position string).

### 7.2 V2 versioned answers — rehearsal only (fenced)

**Endpoints:** `GET .../state`, `POST .../session`,
`PATCH .../answer`, `POST .../finalize` (§5 in API doc). All return 503
in production. When the rehearsal gate is open:

- **State:** `{protocol:2, revision, answers, status, questionIds}`.
  The client verifies the frozen ID-to-position mapping before replaying
  any persisted operation (`validateCbtJournalPaper`).
- **Writing session (lease):** `POST .../session` with `{protocol:2,
  requestKey, takeover}`. Creates/resumes/takes over the single active
  writing session. `takeover:false` with an active session →
  `takeover_required` (409). Takeover revokes the old session and
  increments `generation`. Replaying a `requestKey` returns the recorded
  outcome (never reactivates a revoked session).
- **Answer operation:** `PATCH .../answer` with `{protocol:2,
  expectedRevision, operationKey, questionId, selected, sessionId,
  sessionGeneration}`. Outcomes: `accepted` (revision incremented),
  `replayed` (same `operationKey` + same input → recorded outcome),
  `conflict` (stale `expectedRevision` → current revision + answers
  returned), `expired`, `closed`, `session_revoked` (stale lease →
  `CBT_SESSION_REVOKED`). Same key + different input → refuse.
- **Finalize:** always 503 (`CBT finalization is unavailable pending
  recovery verification.`) — a browser seal cannot prove the absence of
  offline work on other devices.
- **Client journal:** `CbtAnswerQueue` (IndexedDB) persists operations
  with `pending | acknowledged | conflicted | resolved-server |
  superseded | closed` statuses. The server revision accounts only for
  operations accepted by *this* server; it cannot reveal unregistered
  offline work on another device. Conflicts require explicit review —
  never silent overwrite.

**New-backend requirement:** implement the v1 draft path fully. Implement
the v2 schema (`cbt_v2_operations`, `cbt_v2_writing_sessions`,
`candidate_answer_revision`) and the rehearsal endpoints behind the same
dev-only gate, **or** omit v2 entirely and always return
`protocol:{version:1}` (the frontend degrades cleanly). **Do not enable
v2 globally without an explicit release decision.**

---

## 8. Timer and deadline handling

- **Authoritative deadline:** `cbt_attempts.expires_at` (server clock).
  The client countdown is display-only; `serverTime` from the paper
  response corrects device-clock skew.
- **Auto-submit:** when the client countdown hits 0, `CbtSessionPage`
  auto-submits exactly once (`autoSubmitStarted` ref). The server still
  enforces the deadline — a late submit is scored only within the grace
  window, otherwise 409 expired.
- **Submit grace:** 120 seconds after `expires_at` (`cbt_submit_grace`).
  The new backend must define its grace explicitly and apply it
  consistently to draft saves, paper reads, session creation, and submit.
- **Expiry marking:** owner-scoped, lock-after-check
  (`cbt_expire_owned_attempt` equivalent). It can only transition
  `in_progress → expired`; it never alters answers or reopens a result.
  If the RPC is missing/fails, the server logs a warning and does **not**
  fall back to a privileged table update (migration-first deployment).
- **Stale-attempt sweep:** `expire_stale_cbt_attempts` equivalent for
  abandoned in-progress attempts (the new backend should run this as a
  scheduled job).

---

## 9. Attempt recovery

- **Resume:** `GET .../paper` returns `savedAnswers` + `questionIndex` +
  `expiresAt`. The session page restores answers and position.
- **Re-start:** `POST .../attempts` with an in-progress attempt returns
  it with `resumed: true` (same id, same frozen paper, same deadline —
  the timer does not restart).
- **History resume:** `GET /api/cbt/attempts` marks `resumable: true` for
  in-progress attempts; `ContinuePracticeCard` links back to the session.
- **Local pending snapshot:** `CbtSessionPage` writes
  `edureach-cbt-pending:<attemptId>` on every change and removes it only
  after the server draft save succeeds (best-effort compare; localStorage
  has no atomic CAS). On load, the snapshot is merged with server state.
- **V2 journal recovery:** IndexedDB operations are projected onto server
  state (`projectCbtJournal`); unknown/conflicting histories throw
  `CBT journal requires review.` — never inferred.
- **Result recovery:** after submit, the result is cached in localStorage
  (`cbt-result-<id>`) so the scorecard survives a reload even if the
  result RPC is unavailable. `fetchCbtResult` falls back to the
  owner-scoped `cbt_attempts` row + paper when the RPC has no rows, and
  only uses the local breakdown when its score agrees with the server
  score.

---

## 10. Submission and server-side scoring

**Endpoint:** `POST /api/cbt/attempts/:attemptId/submit` (§3.4).

- Body: `{ answers: Record<position, 0-based index> }`.
- **Server-authoritative:** scoring runs against the frozen
  `question_ids` in a single transaction with the attempt row locked.
  The client never computes the score. `examId` is not accepted (the
  attempt id is the identity; the legacy `POST /api/cbt/submit` that
  accepted `examId` is superseded — do not re-implement it).
- **Scoring:** `correct = (selected_option == correct_option)` per
  question; `score = round(correct / total * 100, 2)`. Unanswered =
  incorrect. `breakdown` entries:
  `{question (position), subject?, selected (0-based|null), correct
  (0-based), explanation?, isCorrect?}`.
- **Idempotent:** a retried submit returns the stored result (same
  score/breakdown). Submitting an already-submitted attempt without a
  stored result → 409.
- **Result persistence:** `score`, `correct_answers`, `total_questions`,
  `submitted_at`, `status='submitted'` on the attempt + per-question
  `cbt_answers` rows (`selected_option`, `is_correct`). The frontend
  caches the response in localStorage and navigates to the results page.
- **Errors:** 400 (answers missing/not an object), 409 (expired / no
  result produced), 503 (unrecognised — never 400, so the client shows
  "connection problem, press Submit again").

---

## 11. Result persistence and review

- **Result read:** `fetchCbtResult(attemptId)` tries (in order):
  1. localStorage (guest ids or unconfigured),
  2. RPC `get_cbt_result` (owner-scoped),
  3. fallback: owner-scoped `cbt_attempts` row + `cbt_exams` row + paper
     (subject breakdown attached from the frozen paper),
  4. localStorage scan for the exact attempt id (guest reopen after
     sign-out).
- **New-backend replacement:** `GET /api/cbt/attempts/:attemptId/result`
  **[PROPOSED]** returning `CbtResultPayload`:
  `{attempt: {id, exam_id, score, correct_answers, total_questions,
  submitted_at, mode, duration_minutes, subjects}, exam, answers:
  [{question_id, selected_option, is_correct}], questions: [{id,
  position, subject, question_text, option_a..d, correct_option,
  explanation}], subjects, plan}`. Answer keys/explanations are included
  **only** for submitted attempts (and, for restricted banks, only after
  `correction_release_at` — see §12).
- **Delete:** `DELETE /api/cbt/attempts/:attemptId` deletes the caller's
  own attempt/result (guest/local ids handled client-side).

---

## 12. Guest practice

- **Serving:** `GET /api/cbt/exams/:examId/guest-questions` (legacy) +
  `POST /api/cbt/guest-submit` (§4 in API doc). **Public banks only** —
  restricted/unclassified → 404 with no question read performed.
- **Scoring:** server-side against the bank's questions (paper selected
  by `subjects` + `paperSeed`). Score = `round(correct/total*100, 2)`.
  Attempt id is synthetic (`guest-cbt-<ts>-<rand>`) and **not persisted**
  server-side; the result is cached in localStorage by the caller.
- **Confidentiality (critical):** corrections are released **per
  attempted question only**. `correct`/`explanation` are `null` for
  unattempted questions. An empty submission (`{"answers":{}}`) must
  return **no keys at all** — this was a disclosed-key vulnerability that
  was fixed; do not regress it. Rate limit: 30/10 min.
- **No guest attempt persistence:** guest results are browser-owned.
  The new backend must not create attempt rows for guests.

---

## 13. Question confidentiality

| Rule | Enforcement |
|---|---|
| Students never receive `correct_option`/`explanation` before permitted release. | Paper/draft/catalogue responses exclude keys. Result responses include keys only for submitted attempts (guest: per-attempted-question; restricted: after `correction_release_at`). |
| Unclassified banks fail closed. | No row in `cbt_bank_security` → no catalogue listing, no counts, no subjects, no start, no paper, no guest questions. 404 (student) / 503 (policy unavailable). |
| Restricted banks require active assignment. | `candidate_access` checked on every read/write (catalogue, subjects, start, paper, draft, submit, progress, v2). Revocation is immediate. |
| Provenance guard. | Question text existing in a restricted bank cannot be added to a public/unclassified bank (403). Bank moves refused (403). Import commit re-checks. |
| No generic question listing for students. | The only student question reads are the frozen paper (no keys) and the post-submission result (keys). Admin question listing requires `cbt.read`. |
| Refusals never echo content. | Error bodies contain no question text, fingerprint, bank title, SQLSTATE, or raw DB error. |

---

## 14. Concurrent session restrictions

- **One active writing session per attempt** (v2): partial unique index
  `(attempt_id) WHERE status='active'`. Takeover revokes the previous
  session and increments `generation`; stale-session writes are rejected
  with `session_revoked` / `CBT_SESSION_REVOKED`.
- **One in-progress attempt per student per exam** (v1 + v2): re-start
  resumes instead of duplicating.
- **Answer idempotency:** v1 draft saves are idempotent (same draft =
  success). V2 operations are idempotent on `operation_key` (same key +
  same input = replayed outcome; same key + different input = refuse).
- **Revision ordering (v2):** `expectedRevision` must equal the current
  `candidate_answer_revision`, else `conflict` with current state
  returned. One accepted answer per revision (partial unique index).
- **Submission idempotency:** retried submit returns the stored result.
- **Service-request idempotency** (adjacent): `submission_key` replays
  return the existing request.

---

## 15. Frontend expectations checklist (new backend must satisfy)

- [ ] `GET /api/cbt/exams` lists only public banks with availability counts.
- [ ] `GET /api/cbt/exams/:id/subjects` returns bank payload with
      `limits`, `review`, `mock`, `rules` (compulsory + missing flag).
- [ ] `POST .../attempts` validates subjects/mode/counts/duration and
      returns 201 (new) / 200 (resumed) with `plan` + `expiresAt`.
- [ ] `GET .../paper` returns frozen paper without keys + `serverTime` +
      strict `protocol` object (`{version:1}` in production).
- [ ] `PATCH .../draft` is idempotent; 409 on expiry/protocol mismatch.
- [ ] `POST .../submit` scores server-side against the frozen paper and
      is idempotent on retry.
- [ ] `POST .../abandon`, `DELETE ...`, `GET /api/cbt/attempts` behave as
      specified.
- [ ] Guest submit releases keys only for attempted questions; public
      banks only; rate-limited.
- [ ] V2 routes return 503 in production (fence preserved).
- [ ] All CBT errors use the §12 vocabulary in `API-REQUIREMENTS.md`;
      unrecognised errors → 503, never 400.
- [ ] Answer indices are 0-based; positions are 1-based; timestamps are
      ISO-8601 UTC.

---

# Part F — Frontend Integration Plan

> **Source document:** `FRONTEND-INTEGRATION-PLAN.md` (Part F of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A–E, G within this package.

---

# EduReach Hub — Frontend Integration Plan

> **Purpose.** How the new Express backend can replace the existing
> backend **without redesigning the frontend**. The frontend is preserved;
> integration is a sequence of small, reversible repointings, each verified
> against the existing test suite.
>
> **Principle:** the frontend's wire contract (paths, shapes, error
> vocabulary, auth transport) is frozen. The new backend conforms to it.
> Frontend changes are limited to (a) repointing the API base, (b)
> replacing direct Supabase calls with REST calls, and (c) optionally
> replacing Supabase Auth — each as a separate, independently shippable
> step.

---

## 1. What the frontend expects (frozen contract)

| Concern | Frontend expectation | Source |
|---|---|---|
| API base | `/api/*` in dev, `/.netlify/functions/api/*` in prod (`apiUrl()` rewrites). | `src/lib/apiBase.ts` |
| Auth transport | `Authorization: Bearer <Supabase JWT>`; 401 = expired/invalid. | `src/lib/api.ts` `authHeaders()` |
| Success shape | Plain objects (`{items}`, `{item}`, `{attempt}`, `{report}`, ...), no envelope. | `src/lib/api.ts` throughout |
| Error shape | `{ error: "<string>" }` + HTTP status; `userFacingError()` normalises. | `lib/errors.ts`, `src/lib/failures.ts` |
| Error vocabulary | Exact messages in `API-REQUIREMENTS.md` §12 (CBT branches on message text). | `server.ts`, `lib/errors.ts` |
| Answer indices | 0-based (0=A..3=D); positions 1-based. | `src/lib/cbt-config.ts`, `src/lib/api.ts` |
| Timestamps | ISO-8601 UTC strings. | Everywhere |
| Rate limits | `RateLimit-*` headers + `Retry-After`; 429 plain-string body. | `lib/rate-limit.ts` |
| Security headers | `Cache-Control: no-store` on `/api/*`; CSP/HSTS in prod. | `server.ts` |
| CBT protocol | Paper `protocol` is strictly `{version:1}` or `{version:2, scope:'local-rehearsal'}`; anything else → `CbtProtocolUnavailableError`. | `src/lib/api.ts` `fetchCbtAttemptPaper` |
| V2 fence | V2 routes 503 in production; frontend degrades to v1. | `server.ts` `cbtV2LocalRehearsalEnabled()` |
| Unconfigured mode | `isSupabaseConfigured=false` → honest offline/preview rendering, no crashes. | `src/lib/supabase.ts` |

---

## 2. Existing API client functions (no frontend change needed)

All of these already call the same-origin API via `jsonFetch`/`adminApiFetch`
and will work against the new backend **unchanged** if it serves the same
paths/shapes:

| Frontend function(s) | Endpoint(s) |
|---|---|
| `fetchUpcoming` | `GET /api/upcoming` |
| `fetchCbtExamsWithAvailability`, `fetchCbtBank`, `startConfiguredCbt`, `fetchCbtAttemptPaper`, `saveConfiguredCbtDraft`, `submitConfiguredCbt`, `abandonConfiguredCbt`, `deleteCbtAttempt`, `fetchCbtHistory` | `GET /api/cbt/exams`, `GET /api/cbt/exams/:id/subjects`, `POST /api/cbt/exams/:id/attempts`, `GET /api/cbt/attempts/:id/paper`, `PATCH .../draft`, `POST .../submit`, `POST .../abandon`, `DELETE ...`, `GET /api/cbt/attempts` |
| `fetchCbtV2State`, `openCbtV2WritingSession`, `sendCbtV2Operation` | `GET/POST/PATCH /api/cbt/v2/attempts/:id/*` (503 in prod — fence preserved) |
| `fetchPastQuestionResources`, `fetchPublicPdfDocuments` | `GET /api/past-questions/resources`, `GET /api/public/documents` |
| `fetchOpportunities`, `fetchOpportunity` | `GET /api/opportunities[/:id]` |
| `fetchAdminServices`, `createAdminService`, `updateAdminService`, `deleteAdminService` | `GET/POST/PATCH/DELETE /api/admin/services[/:id]` |
| `fetchAdminOpportunities`, `create/update/deleteAdminOpportunity` | `GET/POST/PATCH/DELETE /api/admin/opportunities[/:id]` |
| `fetchAdminAnalytics`, `fetchAdminUsers`, `fetchAdminServiceRequests`, `updateAdminServiceRequest`, `fetchAdminUserActivity`, `setUserSuspended`, `updateAdminUserRole`, `bootstrapAdmin` | `GET /api/admin/analytics`, `GET /api/admin/users[/:id/activity]`, `POST .../ban|unban|role`, `GET/PATCH /api/admin/service-requests[/:id]`, `POST /api/admin/bootstrap` |
| `fetchAdminNews`, `create/update/deleteAdminNews`, `fetchNewsroomCandidates`, `approve/rejectNewsroomCandidate`, `runNewsroomIngest`, `fetchNewsroomRuns` | `GET/POST/PATCH/DELETE /api/admin/news[/:id]`, `GET/POST /api/admin/newsroom/*` |
| `fetchAdminCalendarItems`, `create/update/deleteAdminCalendarItem` | `GET/POST/PATCH/DELETE /api/admin/calendar-items[/:id]` |
| `fetchAdminInstitutions`, `create/update/deleteAdminInstitution` | `GET/POST/PATCH/DELETE /api/admin/institutions[/:id]` |
| `uploadAdminImage`, `uploadAdminPdf`, `fetchAdminPdfBank`, `routeAdminPdf` | `POST /api/admin/uploads`, `POST /api/admin/pdf-bank/upload`, `GET /api/admin/pdf-bank`, `PATCH .../route` |
| `fetchAdminQuestionImports`, `fetchAdminQuestionImport`, `updateAdminQuestionImport`, `uploadAdminQuestionImport`, `retry/update/review/commit/deleteAdminQuestionImport`, `fetchAdminQuestionImportSource` | `GET/POST/PATCH/DELETE /api/admin/question-imports[/:id[/items/:itemId/review|commit|retry|source]]` |
| `fetchAdminCbtExams`, `updateAdminCbtExam`, `deleteAdminCbtExam` (+ `adminApiFetch` direct calls in `AdminCbtPage`) | `GET/POST/PATCH/DELETE /api/admin/cbt/exams[/:id]`, `GET/POST /api/admin/cbt/exams/:id/questions`, `PATCH/DELETE /api/admin/cbt/questions/:id` |
| `fetchAdminSiteContent`, `saveAdminSiteSettings`, `saveAdminSitePage`, `fetchAdminSiteRevisions`, `restoreAdminSiteRevision` | `GET /api/admin/site-content`, `PUT .../settings/:key`, `PUT .../pages/:slug`, `GET .../revisions`, `POST .../restore/:revision` |
| `fetchAdminBanks`, `fetchAdminBankCandidates`, `fetchAdminBankHistory`, `searchAdminBankCandidates`, `classifyAdminBank`, `setAdminBankRelease`, `assign/revokeAdminBankCandidate` | `GET /api/admin/cbt/banks[/:id/candidates|history]`, `GET /api/admin/cbt/bank-candidates`, `PATCH .../classification|release`, `POST/DELETE .../candidates[/:candidateId]` |
| `trackEvent` | `POST /api/analytics/event` |
| `loadSiteContent` | `GET /api/site-content` |
| `useAdminHealth` | `GET /api/health/ready` |

**Action:** none. The new backend must serve these paths with these shapes.
The only frontend touch is the API base (see §4, step 1).

---

## 3. Existing direct Supabase calls (must be repointed or deliberately kept)

| Direct call | Caller file(s) | Repointing effort |
|---|---|---|
| `supabase.auth.*` (signUp/signIn/signOut/reset/update/resend/getSession/getUser/onAuthStateChange/mfa) | `AuthPageV2`, `auth.tsx`, `SecurityModal`, `AdminLayout`, `api.ts` (`authHeaders`) | **Keep** if Option A (Supabase Auth stays). Replace only under Option B (see §5). |
| `supabase.from('profiles').upsert/select/update` | `AuthPageV2`, `ProfileCompletionPage`, `StudentDashboardV2`, `CbtResultsPage`, `SecurityModal` | Medium: add `GET/PATCH /api/me` + result-slip profile fields; repoint 5 call sites. |
| `supabase.from('service_catalog').select` | `api.ts` (`fetchServices`/`fetchService`), `StudentDashboardV2` | Low: `fetchServices`/`fetchService` already have server equivalents (§2.3–2.4); switch them to `jsonFetch` and delete the direct reads. |
| `supabase.from('institutions').select` | `SchoolFinderPage`, `SchoolDetailsPage`, `StudentDashboardV2`, `fetchPostUtmeInstitutions` | Low–medium: add catalogue endpoints; repoint 4 call sites. |
| `supabase.from('news_articles').select` | `api.ts` (`fetchNews`/`fetchNewsItem`) | Low: switch to `GET /api/news[/:slug]`; delete the 3-tier column-fallback logic. |
| `supabase.from('cbt_exams').select` | `api.ts` (`fetchCbtExams`, `fetchCbtResult` fallback) | Low: `fetchCbtExams` → `GET /api/cbt/exams`; result fallback → `GET .../result` (proposed). |
| `supabase.from('cbt_attempts').select` | `StudentDashboardV2`, `fetchCbtResult` fallback | Low: `GET /api/cbt/attempts` (exists) + proposed result endpoint. |
| `supabase.from('cbt_subject_catalog').select` | `api.ts` (`fetchCbtSubjectCatalog`) | Low: proposed `GET /api/catalogue/subjects` (or fold into bank payload). |
| `supabase.from('service_requests').select` (own) | `StudentDashboardV2` | Low: proposed `GET /api/service-requests/mine`. |
| `supabase.rpc('submit_service_request_idempotent')` | `api.ts` (`submitServiceRequest`) | Low: proposed `POST /api/service-requests`; one function to repoint. |
| `supabase.rpc('get_cbt_result')` | `api.ts` (`fetchCbtResult`) | Low: proposed `GET /api/cbt/attempts/:id/result`; one function to repoint (fallbacks deleted). |
| `supabase.from('student_saved_items'/'student_notifications'/'student_cgpa_*'/'student_security_events')` | `studentDashboard.ts` | Medium: proposed `/api/me/*` endpoints; one module to repoint. `student_security_events` client insert should be **deleted** (server-side audit only). |

**Total frontend surface to repoint:** ~15 call sites across 8 files
(`src/lib/api.ts`, `src/lib/studentDashboard.ts`, `pages/AuthPageV2.tsx`,
`pages/ProfileCompletionPage.tsx`, `pages/StudentDashboardV2.tsx`,
`pages/SchoolFinderPage.tsx`, `pages/SchoolDetailsPage.tsx`,
`pages/CbtResultsPage.tsx`, `src/components/dashboard/SecurityModal.tsx`).
No page redesign, no route changes, no component changes.

---

## 4. Safe incremental integration sequence

Each step is independently shippable and reversible. **Do not combine
steps.** Verify with `npm run typecheck && npm test` (unit) after each
frontend touch, and with the CBT/auth security tests before each backend
cutover.

### Step 0 — Backend parity (no frontend change)

- Build the new Express backend serving **all** §2 endpoints with the
  frozen shapes + error vocabulary + rate limits + headers.
- Fresh PostgreSQL schema from `DATABASE-REQUIREMENTS.md`; fresh
  migrations; seed catalogue content (services, subjects, institutions).
- Contract-test the new backend against the frontend's expected shapes
  (reuse `tests/api.test.ts`, `tests/cbt-*.test.ts`,
  `tests/authorization.test.ts`, `tests/question-provenance-refusal.test.ts`,
  `tests/guest-cbt-disclosure.test.ts` as behavioural specs — port the
  assertions, not the Supabase fixtures).
- **Exit criteria:** every §2 endpoint returns the documented shape;
  CBT invariants (frozen paper, fail-closed banks, per-question guest
  release, idempotent draft/submit) pass.

### Step 1 — API base repoint (one-line frontend change)

- Point the frontend at the new backend host. Options:
  - (a) Keep same-origin: deploy the new backend behind the same origin
    (Netlify function replacement or reverse proxy) so `/api` and
    `/.netlify/functions/api` both route to it. **Zero frontend change.**
  - (b) Change `API_BASE_PATH` in `src/lib/apiBase.ts` to the new host
    (e.g. `https://api.edureachhub.example`). Requires CORS on the new
    backend (`FRONTEND_ORIGIN`) + `connect-src` CSP update in `server.ts`
    / `public/_headers`.
- **Exit criteria:** all §2 calls succeed against the new backend;
  `GET /api/health/ready` reports `ready`.

### Step 2 — Public reads off Supabase (low risk)

- Repoint `fetchServices`/`fetchService` → `GET /api/services[/:slug]`,
  `fetchNews`/`fetchNewsItem` → `GET /api/news[/:slug]`,
  `fetchCbtExams` → `GET /api/cbt/exams`,
  `fetchCbtSubjectCatalog` → proposed subjects endpoint,
  school pages → proposed catalogue endpoints.
- Delete the news column-fallback logic and the direct reads.
- **Exit criteria:** public pages render with Supabase PostgREST disabled
  (only Auth + Storage remain).

### Step 3 — Student data off Supabase (medium risk)

- Add `GET/PATCH /api/me`, `GET /api/service-requests/mine`,
  `POST /api/service-requests`, `GET /api/cbt/attempts/:id/result`,
  `GET/PUT/DELETE /api/me/saved-items`, `GET/POST /api/me/notifications`,
  `GET/POST /api/me/cgpa`.
- Repoint `submitServiceRequest`, `fetchCbtResult`, `StudentDashboardV2`
  reads, `studentDashboard.ts`, profile pages, result slip.
- Delete the `student_security_events` client insert (server-side only).
- **Exit criteria:** dashboard, profile, service submission, and results
  work with PostgREST disabled.

### Step 4 — Auth decision (highest risk — separate release)

- **Option A (keep Supabase Auth):** no frontend change. New backend
  verifies Supabase JWTs. Steps 2–3 already removed PostgREST; Auth +
  Storage are the only remaining Supabase dependencies.
- **Option B (own auth):** implement `/auth/*`, migrate credentials
  (force password reset), rewrite `AuthPageV2` + `auth.tsx` + `SecurityModal`
  + `AdminLayout` session resolution. Ship as its own release with a
  rollback plan. **Do not attempt Option B in the same release as Steps
  1–3.**

### Step 5 — Storage migration (medium risk)

- Move `past-questions`, `resource-files`, `admin-content` buckets to the
  new storage (S3-compatible / Vercel Blob / Supabase Storage kept).
- Repoint signed-URL generation to the new backend (frontend already
  receives URLs; no frontend change if the backend returns the same
  `{url, path, bytes}` / `{href}` shapes).
- **Exit criteria:** uploads, PDF bank, import sources, and public
  document delivery work against the new storage.

### Step 6 — Decommission

- Remove Supabase PostgREST/Storage (if Option B) or keep Auth-only
  (if Option A). Remove `server.ts`, `lib/`, `src/server/`,
  `supabase/migrations/` from the frontend repo (archive separately).
- Keep `vite.config.ts` privileged-key guard + `client-secret-guard`
  (now guarding the new backend's secrets).

---

## 5. Required API compatibility (backend must guarantee)

1. **Paths:** every §2 path in `API-REQUIREMENTS.md`, both `/api` and
   `/.netlify/functions/api` prefixes (strip the latter if present).
2. **Shapes:** plain-object success bodies with the exact field names
   (snake_case for DB-mirrored fields, camelCase for CBT payloads — the
   frontend mixes both; do not "fix" this).
3. **Errors:** `{ error: "<string>" }` + status; exact CBT message
   vocabulary; unrecognised CBT errors → 503.
4. **Auth:** Bearer JWT; 401/403 semantics; ownership → 404.
5. **Headers:** `Cache-Control: no-store` on `/api/*`; `RateLimit-*` +
   `Retry-After`; security headers (CSP/HSTS/X-Frame-Options) in prod.
6. **CBT protocol:** paper `protocol` strictly `{version:1}` in prod;
   v2 routes 503; answer indices 0-based; positions 1-based.
7. **Idempotency:** draft saves, submit retries, service-request
   `submission_key`, import checksum dedupe — all replay-safe.
8. **Pagination/limits:** news 30, dashboard 50, content-manager 500,
   import 2,000 rows, bank questions paged with `hasMore`/`nextPosition`.

---

## 6. Frontend changes that may eventually be needed (not required for cutover)

| Change | Why | When |
|---|---|---|
| `API_BASE_PATH` → new host | Only if not keeping same-origin (Step 1b). | Cutover (optional). |
| Repoint ~15 direct Supabase call sites | Remove PostgREST dependency (Steps 2–3). | Post-cutover, incremental. |
| `AuthPageV2` + `auth.tsx` rewrite | Only under Option B (own auth). | Separate release. |
| `fetchCbtResult` simplification | Delete RPC + fallback chain once `GET .../result` exists. | With Step 3. |
| `fetchNews` simplification | Delete column-fallback once `GET /api/news` is authoritative. | With Step 2. |
| `studentDashboard.ts` repoint | Once `/api/me/*` exists. | With Step 3. |
| CSP `connect-src` update | If API host changes. | With Step 1b. |
| `VITE_SUPABASE_*` removal | Only under Option B. | With Step 4B. |

**No changes needed to:** routes, pages, components, CBT session UX,
setup wizard, admin console UI, calculators, search, SEO, PWA, or static
data files.

---

## 7. Rollback strategy

- Steps 1–3 are reversible by reverting the repointed functions (each
  step touches disjoint call sites). Keep the old Supabase project live
  until Step 6.
- The new backend must support running **alongside** the old one during
  migration (different DB, same frontend contract) so traffic can be
  shifted per-endpoint.
- CBT attempts in flight during cutover: the new backend's frozen-paper
  model means in-flight attempts must be migrated with their
  `question_ids` + drafts, or allowed to expire on the old backend. Do
  not attempt to re-plan in-flight papers.

---

# Part G — Backend Implementation Brief

> **Source document:** `BACKEND-IMPLEMENTATION-BRIEF.md` (Part G of this package).
> The complete document follows verbatim. Cross-references to sibling
> filenames refer to Parts A–F within this package.

---

# EduReach Hub — Backend Implementation Brief

> **Purpose.** A concise but comprehensive implementation specification for
> the **new backend repository** (Express.js + TypeScript + fresh
> PostgreSQL + REST + Vercel-compatible). This brief is self-contained:
> an agent with only this handoff package and the new repository should be
> able to build the backend without access to the frontend repo.
>
> **Companion documents:** `FRONTEND-SYSTEM-INVENTORY.md` (what exists),
> `API-REQUIREMENTS.md` (wire contract — **authoritative for paths/shapes**),
> `DATABASE-REQUIREMENTS.md` (schema — **authoritative for tables**),
> `AUTHENTICATION-AND-PERMISSIONS.md` (auth — **authoritative for roles**),
> `CBT-BACKEND-REQUIREMENTS.md` (CBT — **authoritative for CBT rules**),
> `FRONTEND-INTEGRATION-PLAN.md` (cutover sequence).

---

## 1. Non-negotiable requirements

1. **Independent backend.** Do not copy the existing `server.ts`,
   `supabase/migrations/`, RPCs, RLS policies, or candidate files. Fresh
   schema, fresh migrations, fresh code. Reproduce *behaviour*, not
   *implementation*.
2. **Frontend is the contract.** Paths, shapes, error vocabulary, auth
   transport, and CBT protocol in `API-REQUIREMENTS.md` are frozen.
3. **Server-authoritative everything sensitive:**
   - All authorization decisions enforced server-side (capability +
     ownership + bank policy, re-checked inside every transaction).
   - Students never receive answer keys before permitted release.
   - Unclassified banks fail closed (404 student / 503 policy-unavailable).
   - Answer saving is idempotent; CBT submission/scoring is
     server-authoritative against the frozen paper.
   - Attempt deadlines enforced server-side (server clock only).
   - One active writing session per attempt (server-issued session
     generations/leases); stale-session writes rejected.
   - Administrative operations are auditable (in-transaction audit rows).
4. **V2 fence:** do not enable a global CBT v2 writing protocol without
   an explicit release decision. Production serves `protocol:{version:1}`;
   v2 routes return 503.
5. **Vercel-compatible:** stateless request handlers, no in-process-only
   state for correctness (rate limiting must be durable or explicitly
   best-effort), cold-start-safe, no long-lived connections assumed.

---

## 2. Stack and project setup

| Concern | Choice |
|---|---|
| Runtime | Node.js `>=22` (match frontend `.nvmrc`), TypeScript strict. |
| Framework | Express 4 (match frontend) + `serverless-http` for Vercel. |
| DB access | `pg` Pool + Drizzle ORM (or Kysely). **Every mutation in `withTransaction()`.** No dynamic SQL from request bodies. |
| Validation | Zod (request + response schemas per route). |
| Auth | Option A (verify Supabase JWTs via JWKS) or Option B (own auth) — see auth doc §8. **Decide before writing auth code.** |
| Storage | S3-compatible object storage (or Vercel Blob). Three private buckets/prefixes: `import-sources`, `resources`, `admin-media` (one public). |
| Testing | Vitest (unit + integration with ephemeral Postgres) + Playwright (contract smoke against the frontend shapes). |
| Lint/format | ESLint + Prettier; `tsc --noEmit` in CI. |
| Deploy | Vercel (functions) + Neon/Supabase Postgres (or any managed Postgres). `vercel.json` with function rewrites for `/api/*` and `/.netlify/functions/api/*` → the Express app. |

**Env contract (new backend — define in code, validate at boot):**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection (single privileged role, backend-only). |
| `JWT_SECRET` / `SUPABASE_JWKS_URL` / `SUPABASE_URL` | required (per auth option) | Token verification. |
| `FRONTEND_ORIGIN` | required | CORS allowlist. |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_IMPORTS`, `STORAGE_BUCKET_RESOURCES`, `STORAGE_BUCKET_MEDIA` | required | Object storage. |
| `EDUREACH_SITE_URL` | recommended | Canonical origin for sitemap/robots. |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | optional | First-admin bootstrap (one-time). |
| `PORT`, `NODE_ENV` | optional | Runtime. |
| `CBT_V2_LOCAL_REHEARSAL` | optional (dev only) | Same dev-only gate semantics as the frontend repo. |

---

## 3. Recommended directory structure

```
backend/
├─ src/
│  ├─ index.ts                  # Express app factory (exported for serverless)
│  ├─ server.ts                 # Local listen (PORT) — not used on Vercel
│  ├─ config.ts                 # Env parsing + validation (fail fast, never log secrets)
│  ├─ db/
│  │  ├─ client.ts              # pg Pool + Drizzle instance
│  │  ├─ schema/                # Drizzle table definitions (one file per domain)
│  │  └─ migrate.ts             # Migration runner
│  ├─ modules/
│  │  ├─ health/                # /health, /health/ready, /sitemap.xml, /robots.txt
│  │  ├─ auth/                  # /auth/* (Option B) or token verification (Option A)
│  │  ├─ me/                    # /me, /me/profile, /me/saved-items, /me/notifications, /me/cgpa
│  │  ├─ catalogue/             # /catalogue/*, /services, /news, /opportunities, /upcoming
│  │  ├─ banks/                 # /cbt/exams, /cbt/exams/:id/subjects (public bank reads)
│  │  ├─ attempts/              # /cbt/exams/:id/attempts, /cbt/attempts/:id/paper|draft|submit|abandon
│  │  ├─ scoring/               # Submission scoring + result reads (may merge into attempts)
│  │  ├─ guest/                 # /cbt/guest-submit (+ guest-questions if kept)
│  │  ├─ v2/                    # /cbt/v2/attempts/:id/* (fenced rehearsal)
│  │  ├─ serviceRequests/       # /service-requests, /service-requests/mine
│  │  ├─ imports/               # /admin/question-imports/*
│  │  ├─ admin/                 # /admin/* (users, requests, news, institutions, services, calendar, site, pdf-bank, content-manager)
│  │  ├─ bankSecurity/          # /admin/cbt/banks/* (classification, candidates)
│  │  ├─ audit/                 # Audit writer + /admin/audit reads
│  │  ├─ notifications/         # Server-side notification creation
│  │  ├─ storage/               # Object-storage adapter + signing
│  │  └─ platform/              # Rate limiting, jobs, analytics ingestion
│  ├─ http/
│  │  ├─ middleware.ts          # Headers, CORS, compression, request-id, error handler
│  │  ├─ auth.ts                # authenticate + requireCapability + ownership helpers
│  │  └─ errors.ts              # AppError + renderer ({ error: string } shape)
│  └─ lib/                      # Pure helpers (ids, clock, hashing, redaction, canonicalisation)
├─ drizzle/                     # Fresh migration history (0001_*.sql, ...)
├─ tests/
│  ├─ unit/                      # Pure logic (planning, canonicalisation, scoring, taxonomy)
│  ├─ integration/               # Route + real Postgres (ephemeral)
│  └─ security/                  # Authorization matrix, CBT invariants, confidentiality
├─ vercel.json
└─ package.json
```

**Module rules:**
1. One module owns one table family. Cross-module reads go through the
   owning module's service, never its tables.
2. Every service entry point takes an `Actor` (verified user + capabilities)
   and checks capability + ownership + bank policy inside the transaction.
3. Routes are dumb: parse (Zod) → call service → map result → map error.
   Routes never touch the DB; services never touch `req`/`res`.
4. Side effects (audit, notifications, storage deletes) happen in the same
   transaction as the mutation, or via an outbox row — never fire-and-forget.
5. Each module: `<name>.routes.ts`, `<name>.service.ts`,
   `<name>.schema.ts`, `<name>.repo.ts`.

---

## 4. Database entities (summary — see DATABASE-REQUIREMENTS.md for full spec)

| Domain | Tables |
|---|---|
| Identity | `users`, `profiles`, `student_security_events` |
| Catalogue | `institutions`, `cbt_subject_catalog` |
| Banks | `cbt_exams`, `exam_questions`, `cbt_bank_security`, `cbt_bank_candidate_assignments` |
| Attempts | `cbt_attempts`, `cbt_answers`, `cbt_v2_operations`, `cbt_v2_writing_sessions` |
| Imports | `question_imports`, `question_import_items` |
| Services | `service_catalog`, `service_requests`, `service_guides` |
| Content | `news_articles`, `opportunities`, `calendar_items` (+ newsroom tables only if ingestion is in scope) |
| Portal | `student_saved_items`, `student_notifications`, `student_cgpa_terms`, `student_cgpa_courses` |
| Files | `document_bank`, `past_question_resources` |
| Site/ops | `site_settings`, `site_pages`, `site_page_revisions`, `site_analytics_events`, `admin_audit_logs`, `scheduled_job_runs` |

**Do not create:** wallets/payments, Campus Feed, legacy course uploads,
programme catalogue (unless product requires them — see database doc §8).

**Key constraints to implement:** frozen `question_ids` per attempt;
`UNIQUE (exam_id, position)`; bank-move refusal; provenance guard;
fail-closed classification; one active writing session (partial unique
index); idempotency keys (`submission_key`, `operation_key`,
`request_key`); optimistic concurrency (`updated_at` / `expectedUpdatedAt`);
service-request status CHECK; audit append-only.

---

## 5. API routes (summary — see API-REQUIREMENTS.md for full contract)

| Group | Routes |
|---|---|
| Platform | `GET /health`, `GET /health/ready`, `GET /sitemap.xml`, `GET /robots.txt` |
| Public | `GET /cbt/exams`, `GET /cbt/exams/:id/subjects`, `GET /services[/:slug[/guide]]`, `GET /upcoming`, `GET /news[/:slug]`, `GET /opportunities[/:id]`, `GET /public/documents`, `GET /past-questions/resources`, `GET /site-content`, `POST /analytics/event` |
| CBT (auth) | `POST /cbt/exams/:id/attempts`, `GET /cbt/attempts/:id/paper`, `PATCH .../draft`, `POST .../submit`, `POST .../abandon`, `DELETE ...`, `GET /cbt/attempts`, `GET /cbt/attempts/:id/result` (proposed) |
| Guest | `POST /cbt/guest-submit` (+ `GET /cbt/exams/:id/guest-questions` if kept) |
| V2 (fenced) | `GET/POST/PATCH /cbt/v2/attempts/:id/state|session|answer|finalize` (503 in prod) |
| Student | `GET/PATCH /me`, `GET /service-requests/mine`, `POST /service-requests`, `GET/PUT/DELETE /me/saved-items`, `GET/POST /me/notifications`, `GET/POST /me/cgpa` (proposed) |
| Admin | `GET /admin/session`, `POST /admin/bootstrap`, `GET /admin/users[/:id/activity]`, `POST .../ban|unban|role`, `GET/PATCH /admin/service-requests[/:id]`, `GET /admin/analytics`, `GET/POST/PATCH/DELETE /admin/cbt/exams[/:id[/questions]]`, `PATCH/DELETE /admin/cbt/questions/:id`, `GET/PATCH /admin/cbt/banks/*`, `GET/POST/PATCH/DELETE /admin/news[/:id]`, `GET/POST /admin/newsroom/*` (if in scope), `GET/POST/PATCH/DELETE /admin/calendar-items|institutions|services|opportunities`, `GET/PUT/DELETE /admin/services/:id/guide`, `POST /admin/uploads`, `GET/POST/PATCH /admin/pdf-bank/*`, `GET/PUT/POST /admin/site-content/*`, `GET/POST/PATCH/DELETE /admin/content-manager/*` (replace with explicit endpoints), `GET/POST/PATCH/DELETE /admin/question-imports/*`, `GET /admin/jobs`, `GET /admin/integrity` |

**Versioning:** serve the frozen contract at `/api` (and
`/.netlify/functions/api` for compatibility). If a breaking change is ever
needed, introduce `/api/v2` and serve both in parallel for one frontend
release. Never remove/rename a field inside a version.

---

## 6. Security requirements

1. **Authentication:** verify the JWT on every non-public route; derive
   the actor only from the verified token; re-read `role` from the DB on
   every request. Never trust client-supplied roles/headers/metadata.
2. **Authorization (3 layers, all required):** route guard (capability) →
   service guard (ownership/bank policy inside the transaction) →
   database constraints (FKs, CHECKs, unique indexes, triggers where the
   old system proved them necessary).
3. **Capabilities:** reuse the exact 30-capability vocabulary + 4-role
   matrix from `AUTHENTICATION-AND-PERMISSIONS.md`. Owner-scoped
   capabilities require a matching owner; staff never impersonate owners.
4. **Ownership failures → 404** (never 403) for attempts/progress/results.
5. **Bank policy:** fail closed on unclassified; re-check candidate access
   inside every CBT transaction (lock the policy row so revocation cannot
   be overtaken mid-transaction).
6. **Confidentiality:** no keys in paper/draft/catalogue responses; result
   keys only post-submission (guest: per-attempted-question; restricted:
   after `correction_release_at`); provenance guard on question writes;
   bank moves refused; refusals never echo content.
7. **CBT integrity:** frozen paper; server-side scoring in one locked
   transaction; server-clock deadlines + documented grace; idempotent
   drafts/submits; single writing session with generations; stale writes
   rejected.
8. **Input safety:** Zod-validate every request; parameterised queries
   only; HTML sanitisation on news/site bodies at render (frontend) +
   validation at write (backend); HTTPS-only URLs; file magic-byte +
   size validation; no PII/question text/keys in logs.
9. **Rate limiting:** reproduce the frontend repo's per-route limits +
   headers (see inventory §12). Durable (DB/Redis) for sensitive routes;
   per-user bucketing for CBT starts/uploads/imports (school-lab NAT).
10. **Headers:** `Cache-Control: no-store` on `/api/*`; CSP/HSTS/
    `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy`/
    `Permissions-Policy` in production; `X-Robots-Tag: noindex` on
    private paths; `X-Request-Id` on every response.
11. **Suspension:** refuse suspended users at authentication time; revoke
    sessions on ban (fix the current gap).
12. **Audit:** every admin mutation writes an in-transaction audit row;
    reads require `audit.read`; no keys/question text/PII in audit metadata.

---

## 7. Validation requirements

- **Every route:** Zod request schema (types, ranges, enums, string
  lengths, URL formats) + Zod response schema (contract tests).
- **CBT-specific:** subjects canonicalised + deduped; question counts in
  `cbt_limits`; durations in range; answer values integers 0–3; positions
  within the frozen paper; UUID formats for ids/keys; `expectedRevision`
  safe-integer ≥0; `sessionGeneration` ≥1.
- **Admin-specific:** `role` enum; service-request status enum;
  `visibility` enum + future-only `releaseAt` for restricted;
  `expected_updated_at`/`expectedUpdatedAt` present for optimistic
  concurrency; import `paperYear` 1954–2100; file sizes/types.
- **Error mapping:** Zod failures → 422 with field messages in
  `details.fields` (safe, schema-validated); domain refusals → the §12
  vocabulary in `API-REQUIREMENTS.md`; unknown errors → 500/503 with
  `requestId` only (never SQL/stack/PII).

---

## 8. Testing requirements

| Layer | What to test | Source of truth |
|---|---|---|
| Unit | Paper planning, subject canonicalisation, compulsory/mock rules, scoring, pace/duration, analytics taxonomy, capability matrix, error mapping. | `src/lib/cbt-config.ts`, `src/lib/capabilities.ts`, `tests/cbt-*.test.ts` |
| Integration | Every route: happy path + auth (401) + capability (403) + ownership (404) + validation (422) + rate limit (429). CBT: start→paper→draft→submit→result round-trip; resume; expiry; abandon; delete. | `API-REQUIREMENTS.md` |
| Security | Authorization matrix (every admin route × every role); bank fail-closed (unclassified/restricted/revoked); provenance refusal; guest per-question release (empty submit leaks nothing); v2 fence (503 in prod); suspension refusal; audit presence. | `tests/authorization.test.ts`, `tests/question-provenance-refusal.test.ts`, `tests/guest-cbt-disclosure.test.ts`, `tests/restricted-bank-*.test.ts` |
| Concurrency | Double-submit idempotency; draft replay; v2 operation replay/conflict; writing-session takeover + stale-write rejection; import commit atomicity (partial failure rolls back); service-request `submission_key` replay. | `tests/cbt-answer-queue*.test.ts`, `tests/service-request-idempotency.test.ts` |
| Contract | Response shapes match the frontend types (`CbtBankPayload`, `CbtAttemptPayload`, `CbtSubmitResponse`, `Admin*` types). | `src/lib/api.ts` types |
| Load/smoke | Catalogue + paper + submit under load (k6 equivalents exist in `scripts/load/k6/`); health/readiness. | `scripts/load/` |

**CI gates:** `tsc --noEmit`, unit + integration + security suites,
contract tests, and a frontend-shape smoke test must all pass before any
cutover step (see integration plan §4).

---

## 9. Deployment requirements (Vercel)

- **Functions:** Express app exported for `serverless-http`; `vercel.json`
  rewrites `/api/*` and `/.netlify/functions/api/*` to the function.
  Keep function timeouts ≥30 s (import extraction, newsroom runs) or move
  long work to background jobs with polling (the frontend already polls
  import status).
- **Database:** managed Postgres (Neon/Supabase/RDS). Connection pooling
  (PgBouncer) for serverless; `statement_timeout`,
  `idle_in_transaction_session_timeout`, `lock_timeout` set per connection.
- **Storage:** S3-compatible with presigned PUT (or backend-proxied
  uploads preserving the JSON `dataUrl` contract). Signed GET URLs ≤300 s.
- **Cron:** daily jobs (newsroom if in scope, stale-attempt sweep,
  analytics retention 90 d, opportunity expiry) via Vercel Cron or
  pg_cron, recorded in `scheduled_job_runs`.
- **Observability:** structured JSON logs with `requestId`; error tracking;
  uptime probe on `/health`; readiness probe on `/health/ready` (DB +
  schema checks).
- **Environments:** `preview` (ephemeral DB + seeded catalogue) and
  `production` (migrated DB, no seed data). Migrations run before deploy
  (migration-first; the frontend's CBT handlers assume the schema exists
  and fail closed with 503 otherwise).

---

## 10. Migration and integration phases

| Phase | Deliverable | Frontend touch |
|---|---|---|
| **0. Foundation** | Repo scaffold, env contract, DB client, error/auth middleware, health/readiness, CI. | None. |
| **1. Identity + catalogue** | Users/profiles/roles, institutions, subjects, services, news, opportunities, calendar, site content, analytics ingestion. | None (Step 1 of integration plan). |
| **2. CBT core (v1)** | Banks, questions, classification, attempts, paper, draft, submit, scoring, results, history, guest. | None. |
| **3. Admin** | Users, service requests, CBT admin, bank security, news, institutions, services+guides, calendar, site, PDF bank, imports, content-manager replacements, jobs/integrity. | None. |
| **4. Portal data** | Saved items, notifications, CGPA, `/me` endpoints. | Repoint direct Supabase calls (Steps 2–3). |
| **5. V2 rehearsal (optional)** | V2 schema + fenced endpoints behind the dev-only gate. | None (frontend already degrades). |
| **6. Cutover** | Deploy alongside old backend; shift traffic per-endpoint; decommission. | API base repoint (Step 1). |
| **7. Auth migration (optional, separate release)** | Own auth (Option B) + credential migration. | Auth rewrite (Step 4B). |

**Data migration note:** question banks, institutions, and catalogue
content must be migrated from the old database (export/import with
provenance preserved). Attempts in flight at cutover must be migrated
with their frozen `question_ids` + drafts, or allowed to expire — never
re-planned. Audit history should be archived, not necessarily migrated.

---

## 11. Acceptance criteria

- [ ] All `API-REQUIREMENTS.md` §2–§10 endpoints implemented with frozen
      shapes + error vocabulary.
- [ ] All `DATABASE-REQUIREMENTS.md` tables/constraints implemented in a
      fresh migration history.
- [ ] All `AUTHENTICATION-AND-PERMISSIONS.md` rules enforced (capability
      matrix, ownership→404, fail-closed banks, suspension refusal).
- [ ] All `CBT-BACKEND-REQUIREMENTS.md` invariants hold (frozen paper,
      server scoring, deadlines, idempotency, single writer, guest
      confidentiality, v2 fence).
- [ ] Test suites in §8 pass in CI.
- [ ] Frontend integration Steps 1–3 complete with no page/component
      redesign.
- [ ] Vercel deployment with health/readiness green.

---

# Appendix — Verification checklist

Use this checklist in the new backend repository to confirm the handoff
was fully implemented. Each item maps to a section in Parts A–G.

## Documents

- [ ] This consolidated package (`BACKEND-HANDOFF-PACKAGE.md`) is present
      in the new repository and readable without the frontend repo.
- [ ] All seven parts (A–G) are present and untruncated.

## Contract (Part B)

- [ ] Every endpoint in Part B §1–§10 is implemented with the frozen
      path, method, request/response shape, and error vocabulary.
- [ ] Both `/api` and `/.netlify/functions/api` prefixes are accepted.
- [ ] Success bodies are plain objects (no envelope); errors are
      `{ error: string }` + HTTP status.
- [ ] Rate-limit headers (`RateLimit-*`, `Retry-After`) and
      `Cache-Control: no-store` on `/api/*` are present.
- [ ] Unrecognised CBT errors return 503, never 400.

## Data (Part C)

- [ ] Fresh PostgreSQL schema + fresh migration history (no copied
      Supabase migrations/RPCs/RLS/candidates).
- [ ] All tables, constraints, indexes, and rules in Part C are
      implemented (frozen paper, provenance guard, fail-closed
      classification, idempotency keys, optimistic concurrency, audit
      append-only).
- [ ] Dormant tables (wallets, Campus Feed, legacy uploads) are omitted
      unless the product explicitly requires them.

## Auth (Part D)

- [ ] Identity-provider decision (Option A or B) is recorded and
      implemented.
- [ ] 30-capability vocabulary + 4-role matrix enforced server-side on
      every route; ownership failures return 404.
- [ ] Role re-read from the DB on every request; `user_metadata` never
      trusted; self-promotion impossible.
- [ ] Suspended users refused at authentication time; sessions revoked
      on ban.
- [ ] Bootstrap endpoint + `GET /api/admin/session` probe semantics
      preserved.

## CBT (Part E)

- [ ] Bank classification fail-closed; restricted access via active
      assignment only; revocation immediate.
- [ ] JAMB compulsory English enforced; WAEC/NECO/POST-UTME have no
      compulsory subject.
- [ ] Deterministic paper planning; frozen `question_ids`; server-side
      scoring in one locked transaction.
- [ ] Server-clock deadlines + documented grace; idempotent drafts and
      submits; single writing session with generations.
- [ ] Guest scoring releases keys only for attempted questions; public
      banks only.
- [ ] V2 routes return 503 in production (fence preserved).

## Integration (Part F)

- [ ] Steps 1–3 complete (base repoint, public reads, student data) with
      no page/component redesign.
- [ ] Auth migration (if Option B) shipped as a separate release.
- [ ] Storage migrated with signed URLs ≤300 s; frontend shapes
      (`{url, path, bytes}`, `{href}`) preserved.

## Build (Part G)

- [ ] Directory structure, module rules, validation, testing, and Vercel
      deployment per Part G.
- [ ] CI gates green: typecheck, unit + integration + security suites,
      contract tests, frontend-shape smoke test.
- [ ] Acceptance criteria in Part G §11 all checked.

---

*End of consolidated package. Original seven documents remain in
`docs/backend-handoff/` alongside this file in the frontend repository;
this file alone is sufficient for transfer to the new backend repository.*
