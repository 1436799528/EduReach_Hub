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
