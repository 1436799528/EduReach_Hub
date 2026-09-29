# EduReach Hub — Complete Route & Endpoint Matrix (2026-09-29)

**Repository:** `1436799528/EduReach_Hub`  
**Branch:** `arena/01a0eef0-edureach-hub`  
**Baseline Commit:** `174aae5ea891373ba8505476183ca3115c6d61d5`  
**Audit Date:** 2026-09-29  

---

## 1. Frontend Route Inventory (`src/app/routes.tsx` & `src/app/App.tsx`)

### 1.1 Public Student & Information Routes

| Route Pattern | Component | Access | Canonical / Alias | Purpose | Primary Data Source(s) | Audit Status (Pre-Fix) |
|---|---|---|---|---|---|---|
| `/` | `HubHomePage` | Public | Canonical | Student portal landing page: quick actions, exam prep entry, live services, news feed, upcoming deadlines/exams, CBT simulator grid, opportunities, school finder preview | `fetchServices()`, `fetchOpportunities()`, `fetchUpcomingContent()`, `fetchNewsArticles()`, `supabase.from('institutions')`, `ExamSimulatorGrid` | **Partially Broken** (`ExamSimulatorGrid` calls non-existent `GET /api/cbt/exams` → 404) |
| `/jamb` | `ExamHubPage(exam="jamb")` | Public | Canonical | JAMB UTME preparation hub: course-based 4-subject combination picker, CBT setup launch, past questions, admission guide, syllabus materials | `fetchCbtExams()`, `src/data/examPreparation.ts` | **Working** (when live CBT bank exists; falls back cleanly otherwise) |
| `/waec` | `ExamHubPage(exam="waec")` | Public | Canonical | WAEC SSCE preparation hub: secondary track & subject selector, CBT launch, past questions, study materials | `fetchCbtExams()`, `src/data/examPreparation.ts` | **Working** |
| `/neco` | `ExamHubPage(exam="neco")` | Public | Canonical | NECO SSCE preparation hub: secondary track & subject selector, CBT launch, past questions, study materials | `fetchCbtExams()`, `src/data/examPreparation.ts` | **Working** |
| `/post-utme` | `ExamHubPage(exam="post-utme")` | Public | Canonical | Post-UTME screening hub: institution selector, screening method guide, CBT launch, screening calculator link | `fetchCbtExams()`, `src/data/examPreparation.ts` | **Working** |
| `/cbt` | `CbtPage` | Public | Canonical | CBT Practice Centre: exam category cards (JAMB, WAEC, NECO, Post-UTME), live question bank cards, resume-attempt banner | `fetchCbtExams()`, `fetchLatestActiveCbtAttempt()` | **Needs Fix** (`ExamSimulatorGrid` on `/` diverges from `CbtPage`; setup subject mismatch causes `"This CBT is not ready yet"`) |
| `/cbt/jamb` | `RedirectTo("/cbt/setup/jamb")` | Public | Alias → `/cbt/setup/jamb` | Legacy/short JAMB CBT setup link | Client redirect | **Working** |
| `/cbt/waec` | `RedirectTo("/cbt/setup/waec")` | Public | Alias → `/cbt/setup/waec` | Legacy/short WAEC CBT setup link | Client redirect | **Working** |
| `/cbt/neco` | `RedirectTo("/cbt/setup/neco")` | Public | Alias → `/cbt/setup/neco` | Legacy/short NECO CBT setup link | Client redirect | **Working** |
| `/cbt/post-utme` | `RedirectTo("/cbt/setup/post-utme")` | Public | Alias → `/cbt/setup/post-utme` | Legacy/short Post-UTME CBT setup link | Client redirect | **Working** |
| `/cbt/setup/:exam` | `ExamSetupPage` | Public | Canonical (`jamb`, `waec`, `neco`, `post-utme`) | Subject & duration configuration before entering CBT exam hall | `fetchCbtExams()`, `resolveSetupExam()`, `src/data/examPreparation.ts` | **Partially Broken** (WAEC/NECO default subject `'Use of English'` mismatches `'English Language'`; fallback `practice-exam-*` ID triggers `"This CBT is not ready yet"` on `/cbt/practice`; does not inspect available subjects in `exam_questions`) |
| `/cbt/practice` | `CbtPracticePage` | Public & Auth | Canonical | Timed CBT examination hall with scientific calculator, keyboard shortcuts (A/B/C/D/N/P/F/C), question palette, offline queue, auto-submit | `startCbt()`, `fetchCbtQuestions()`, `submitCbt()`, `src/lib/cbt-offline.ts` | **Partially Broken** (`fetchCbtAttemptProgress` / `saveCbtAttemptProgress` call missing `/api/cbt/attempts/:id/progress`; shows `"This CBT is not ready yet"` when setup passes non-UUID fallback or mismatched subjects) |
| `/cbt/results` | `CbtResultsPage` | Public & Auth | Canonical | Official-style CBT result slip, subject breakdown, print/download PDF, and question-by-question answer review | `localStorage` (`cbt-result-*`), `fetchCbtResultDetail()` | **Working** |
| `/past-questions` | `PastQuestionsPage` | Public | Canonical | Searchable & filterable past-question and syllabus library with direct links into CBT setup | `pastQuestionLibrary`, `studyMaterialLibrary` (`src/data/examPreparation.ts`) | **Working** (curated library cards route into `/cbt/setup/:exam`; needs clearer distinction that items launch interactive practice rather than fake PDF downloads) |
| `/services` | `ServicesCatalogPage` | Public | Canonical | Live student services catalogue with category filter and search | `fetchServices()` (`/api/services` + Supabase fallback) | **Needs Fix** (standalone Express server doesn't rewrite `/.netlify/functions/api/*`, causing production build under `npm start` to fall back to static 4 services) |
| `/services/:slug` | `ServiceApplyPage` | Public & Auth | Canonical for `nelfund-loan`, `results`, `jamb-slip`, `admission-letters` | Guided service information, requirements, official portal links, and support request submission form | `fetchServiceBySlug()`, `submitServiceOrder()` | **Needs Fix** (only 4 hardcoded slugs in `liveServiceSlugs` route to `ServiceApplyPage`; any admin-created service without an external URL or custom route hits `ComingSoonPage`) |
| `/services/apply/:slug` | `ServiceApplyPage` | Public & Auth | Alias for `/services/:slug` | Direct service application route used by `ServiceCard` | `fetchServiceBySlug()`, `submitServiceOrder()` | **Needs Fix** (same `liveServiceSlugs` restriction in `src/app/routes.tsx`) |
| `/nelfund` | `ServiceApplyPage("nelfund-loan")` | Public & Auth | Alias → `/services/nelfund-loan` | Short URL for NELFUND Student Loan support | `fetchServiceBySlug()` | **Working** |
| `/results-checker` | `ServiceApplyPage("results")` | Public & Auth | Alias → `/services/results` | Short URL for WAEC/NECO/JAMB result checking service | `fetchServiceBySlug()` | **Working** |
| `/jamb-slip` | `ServiceApplyPage("jamb-slip")` | Public & Auth | Alias → `/services/jamb-slip` | Short URL for JAMB original result slip & admission letter | `fetchServiceBySlug()` | **Working** |
| `/schools` | `SchoolFinderPage` | Public | Canonical | Searchable & state-filterable Nigerian institution directory | `supabase.from('institutions')` + `commonInstitutions` fallback | **Needs Fix** (horizontal overflow +37px at 390px and +52px at 375px; links pass institution metadata only via query string) |
| `/schools/:slug` | `SchoolDetailsPage` | Public | Canonical | Institution profile, portal links, and course context | Query params (`?name=...&acronym=...`) | **Incomplete** (does not query `institutions`, `faculties`, `departments`, `programmes`, or `courses` from Supabase when visited directly or when DB records exist) |
| `/screening-calculator` | `ScreeningCalculatorPage` | Public | Canonical | UTME + O'Level + Post-UTME aggregate screening score calculator | Client-side calculator (`pages/ScreeningCalculatorPage.tsx`) | **Working** |
| `/news` | `NewsPage` | Public | Canonical | Education newsroom with category filter, search, and featured stories | `fetchNewsArticles()` (`/api/news` + Supabase fallback) | **Working** |
| `/news/:slug` | `NewsArticlePage` | Public | Canonical | Full news article reader with sanitized rich HTML and source attribution | `fetchNewsArticleBySlug()` (`/api/news/:slug` + Supabase fallback) | **Needs Fix** (plain-text URLs inside non-HTML or plain text paragraphs are not auto-linked into clickable `<a>` tags) |
| `/events` | `EventsPage` | Public | Canonical | Upcoming examination dates and registration deadlines | `fetchUpcomingContent()` (`/api/upcoming`) | **Needs Fix** (raw HTML tags from `AdminRichTextEditor` in `item.description` are rendered as literal text `<p>...</p>` instead of sanitized HTML/text!) |
| `/jobs` | `JobsPage` | Public | Canonical | Scholarships, grants, fellowships, competitions, and student job listings | `fetchOpportunities()` (`/api/opportunities`) + `src/data/hubContent.ts` | **Needs Fix** (category filter pills `internship`/`campus`/`part-time` do not match backend categories `grant`/`job`/`fellowship`/`competition`; expired deadlines are not marked as Expired; rich HTML descriptions from `AdminRichTextEditor` render raw HTML tags in card/modal!) |
| `/search` | `SearchPage` | Public | Canonical | Unified site search across services, news, exams, schools, and opportunities | Static `src/data/services.ts` + `fetchNewsArticles()` | **Partially Broken** (reads static 23-item `src/data/services.ts` full of `ComingSoon` links instead of live `fetchServices()`, `fetchOpportunities()`, and `institutions`) |
| `/nabteb`, `/support`, `/tools*`, `/admission*`, other `/services/*` | `ComingSoonPage` | Public | Fallback | Placeholder page for unlaunched sections | `src/data/services.ts` | **Needs Consolidation** (`/tools/cgpa-calculator` hits `ComingSoonPage` even though `CgpaCalculatorCard` exists; `/support` hits `ComingSoonPage` instead of providing direct support contact & FAQ; `ComingSoonPage` has dead `path === '/schools'` check) |
| `*` (unmatched) | `NotFoundPage` | Public | 404 Catch-all | Safe 404 page with navigation back to home/services | Static | **Working** |

---

### 1.2 Authentication Routes

| Route Pattern | Component | Access | Canonical / Alias | Purpose | Audit Status (Pre-Fix) |
|---|---|---|---|---|---|
| `/login` | `AuthPageV2(mode="signin")` | Public | Canonical | Student & admin email/password sign-in | **Needs Fix** (calls raw `fetch('/api/admin/session')` instead of `apiUrl('/api/admin/session')`) |
| `/auth` | `AuthPageV2(mode="signin")` | Public | Alias → `/login` | Legacy auth entry (replaces URL to `/login`) | **Working** |
| `/register` | `AuthPageV2(mode="signup")` | Public | Canonical | New student/parent/teacher account registration | **Working** |
| `/signup` | `AuthPageV2(mode="signup")` | Public | Alias → `/register` | Legacy signup entry (replaces URL to `/register`) | **Working** |
| `/forgot-password` | `AuthPageV2(mode="forgot")` | Public | Canonical | Password reset email request | **Working** |
| `/reset-password` | `AuthPageV2(mode="reset")` | Public | Canonical | Password recovery update form | **Working** |
| `/verify-email` | `AuthPageV2(mode="verify")` | Public | Canonical | Email verification confirmation & resend screen | **Working** |

---

### 1.3 Protected Student Routes (`ProtectedRoute`)

| Route Pattern | Component | Access | Canonical / Alias | Purpose | Audit Status (Pre-Fix) |
|---|---|---|---|---|---|
| `/dashboard` | `StudentDashboardV2(initialTab="dashboard")` | Authenticated Student | Canonical | Student dashboard overview: welcome card, saved profile summary, quick actions, latest requests, latest CBT results | **Needs Fix** (calls raw `fetch('/api/admin/session')` without `apiUrl()`) |
| `/dashboard/notifications` | `StudentDashboardV2(initialTab="dashboard")` | Authenticated Student | Alias → `/dashboard` | Legacy notifications route | **Working** |
| `/dashboard/services` | `StudentDashboardV2(initialTab="services")` | Authenticated Student | Canonical | Student service requests tracker (`?ref=` deep-link highlighting) | **Working** |
| `/dashboard/applications` | `StudentDashboardV2(initialTab="services")` | Authenticated Student | Alias → `/dashboard/services` | Legacy applications route | **Working** |
| `/services/track` | `RedirectTo("/dashboard/services")` (inside `ProtectedRoute`) | Authenticated Student | Alias → `/dashboard/services` | Protected service tracking redirect | **Working** |
| `/track` | `RedirectTo("/dashboard/services")` (inside `ProtectedRoute`) | Authenticated Student | Alias → `/dashboard/services` | Short service tracking redirect | **Working** |
| `/dashboard/cbt` | `StudentDashboardV2(initialTab="cbt")` | Authenticated Student | Canonical | Student CBT attempt history, metrics, resume & review links | **Working** |
| `/dashboard/past-questions` | `StudentDashboardV2(initialTab="cbt")` | Authenticated Student | Alias → `/dashboard/cbt` | Legacy dashboard past-questions route | **Working** |
| `/dashboard/cbt/results` | `CbtResultsPage` (inside `ProtectedRoute`) | Authenticated Student | Alias | Protected CBT result viewer | **Working** |
| `/dashboard/cbt/results/:attemptId` | `CbtResultsPage` (inside `ProtectedRoute`) | Authenticated Student | Canonical path param | Direct attempt result viewer | **Working** |
| `/dashboard/tools` | `StudentDashboardV2(initialTab="tools")` | Authenticated Student | Canonical | Student CGPA calculator, school shortlister, and saved items | **Working** |
| `/dashboard/saved` | `StudentDashboardV2(initialTab="tools")` | Authenticated Student | Alias → `/dashboard/tools` | Saved items tab | **Working** |
| `/dashboard/scholarships` | `RedirectTo("/jobs")` | Public/Auth | Alias → `/jobs` | Redirects to opportunities page | **Working** |
| `/profile` | `ProfileCompletionPage` (inside `ProtectedRoute`) | Authenticated Student | Canonical | Academic profile view (`My Profile`) and editor (`?edit=1`) | **Needs Fix** (`handleSubmit` redirects to `/profile` after save even when button says `Save & Open Dashboard`; `/dashboard/profile` missing in `pageMeta.ts`) |
| `/profile/complete` | `ProfileCompletionPage` (inside `ProtectedRoute`) | Authenticated Student | Alias → `/profile` | Post-registration profile completion route | **Working** |
| `/dashboard/profile` | `ProfileCompletionPage` (inside `ProtectedRoute`) | Authenticated Student | Alias → `/profile` | Dashboard profile alias | **Working** |
| `/settings` | `StudentDashboardV2(openSettings=true)` (inside `ProtectedRoute`) | Authenticated Student | Canonical | Opens dashboard with Security & Password modal open | **Working** |
| `/dashboard/settings` | `StudentDashboardV2(openSettings=true)` (inside `ProtectedRoute`) | Authenticated Student | Alias → `/settings` | Dashboard settings alias | **Working** |

---

### 1.4 Admin Console Routes (`AdminLayout` wrapper in `src/app/App.tsx`)

| Route Pattern | Component | Access | Purpose | Audit Status (Pre-Fix) |
|---|---|---|---|---|
| `/admin` | `AdminDashboardPage` | Admin (`verifyAdminSession`) | Operations Control KPIs, active queue, staff audit log, telemetry focus, newest accounts | **Working** (missing sidebar link to `/admin/content-manager` in `AdminLayout.tsx`) |
| `/admin/analytics` | `AdminAnalyticsPage` | Admin | Detailed queue composition, traffic events, funnels, audit trail | **Working** |
| `/admin/queue` | `AdminQueuePage` | Admin | Service request processing queue, status transitions, internal admin notes | **Working** |
| `/admin/cbt` | `AdminCbtPage` | Admin | CBT exam & question pool CRUD | **Needs Fix** (Question form does not expose `subject` field even though `exam_questions.subject` is used by subject-aware CBT papers!) |
| `/admin/news` | `AdminNewsPage` | Admin | Newsroom CMS with rich text editor, image upload, quality gate, preview | **Working** |
| `/admin/users` | `AdminUsersPage` | Admin | Student account directory, profile completion meter, activity modal, suspend/unsuspend | **Needs Fix** (`table` has 8 `<th>` columns in `<thead>` but `TableSkeleton` and empty-state `<td colSpan={7}>` use 7!) |
| `/admin/content` | `AdminContentPage` | Admin | Events & Key Dates (`edureach_deadlines` & `edureach_exams`) CRUD | **Needs Fix** (table renders raw HTML `item.description` from `AdminRichTextEditor` as literal `<p>...</p>` text) |
| `/admin/opportunities` | `AdminOpportunitiesPage` | Admin | Scholarships, grants, jobs, fellowships, competitions CRUD | **Working** |
| `/admin/schools` | `AdminSchoolsPage` | Admin | Institutions directory CRUD | **Working** |
| `/admin/services` | `AdminServicesPage` | Admin | Service catalogue CRUD | **Working** |
| `/admin/content-manager` | `AdminContentManagerPage` | Admin | Bulk CSV import/export and table record editor across 10 Supabase tables | **Broken** (`importCsv` parses CSV into `pendingImport`, but `pendingImport` preview and `confirmImport` button are NEVER rendered in JSX! Also missing from `AdminLayout` sidebar and `pageMeta.ts`) |

---

## 2. Backend API Endpoint Matrix (`server.ts`)

| Method & Path | Auth Gate | Backing Table / RPC | Frontend Caller(s) | Status |
|---|---|---|---|---|
| `GET /api/health` | Public | None | `useAdminHealth()`, Playwright healthcheck | **Working** |
| `POST /api/analytics/event` | Public (rate-limited) | In-memory `analyticsEvents` + `audit_logs` | `App.tsx`, `trackEvent()` in `src/lib/api.ts` | **Needs Fix** (in production builds under `npm start`, `/.netlify/functions/api/analytics/event` 404s because `server.ts` lacks `/.netlify/functions` prefix normalization) |
| `GET /api/services` | Public | `service_catalog` | `fetchServices()` | **Working** |
| `GET /api/services/:slug` | Public | `service_catalog` | `fetchServiceBySlug()` | **Working** |
| `GET /api/opportunities` | Public | `opportunities` | `fetchOpportunities()` | **Working** |
| `GET /api/upcoming` | Public | `edureach_deadlines`, `edureach_exams` | `fetchUpcomingContent()` | **Working** |
| `GET /api/news` | Public | `news_articles` | `fetchNewsArticles()` | **Working** |
| `GET /api/news/:slug` | Public | `news_articles` | `fetchNewsArticleBySlug()` | **Working** |
| `GET /api/cbt/exams/:examId/guest-questions` | Public | `cbt_exams`, `exam_questions` | `fetchCbtQuestions()` (fallback/guest) | **Working** |
| `POST /api/cbt/guest-submit` | Public (rate-limited) | `cbt_exams`, `exam_questions` | `submitCbt()` (guest mode) | **Working** |
| `POST /api/cbt/exams/:examId/start` | `requireUser` | `start_cbt_attempt_for_subjects` / `start_cbt_attempt` | `startCbt()` | **Working** |
| `POST /api/cbt/submit` | `requireUser` | `submit_cbt_attempt_for_subjects` / `submit_cbt_attempt` | `submitCbt()` | **Working** |
| `POST /api/admin/bootstrap` | `verifyJWT` + bootstrap email check | `profiles`, `audit_logs` | `bootstrapAdmin()` | **Working** |
| `GET /api/admin/session` | `requireAdmin` | `profiles` | `AdminLayout`, `AuthPageV2`, `StudentDashboardV2` | **Working** |
| `POST /api/admin/session/verify` | `requireAdmin` | `profiles` | Admin verification | **Working** |
| `GET /api/admin/analytics` | `requireAdmin` | Multiple tables + `analyticsEvents` | `fetchAdminAnalytics()` | **Working** |
| `GET /api/admin/users` | `requireAdmin` | `profiles` + `auth.admin` | `fetchAdminUsers()` | **Working** |
| `GET /api/admin/users/:userId/activity` | `requireAdmin` | `service_requests`, `cbt_attempts` | `fetchAdminUserActivity()` | **Working** |
| `POST /api/admin/users/:userId/ban` | `requireAdmin` | `auth.admin.updateUserById` | `setUserSuspended(id, true)` | **Working** |
| `POST /api/admin/users/:userId/unban` | `requireAdmin` | `auth.admin.updateUserById` | `setUserSuspended(id, false)` | **Working** |
| `GET /api/admin/service-requests` | `requireAdmin` | `service_requests` | `fetchAdminServiceRequests()` | **Working** |
| `PATCH /api/admin/service-requests/:requestId` | `requireAdmin` | `service_requests` | `updateAdminServiceRequest()` | **Working** |
| `GET /api/admin/cbt/exams` | `requireAdmin` | `cbt_exams` | `AdminCbtPage`, `fetchAdminCbtExams()` | **Working** |
| `POST /api/admin/cbt/exams` | `requireAdmin` | `cbt_exams` | `AdminCbtPage` | **Working** |
| `PATCH /api/admin/cbt/exams/:examId` | `requireAdmin` | `cbt_exams` | `updateAdminCbtExam()` | **Working** |
| `DELETE /api/admin/cbt/exams/:examId` | `requireAdmin` | `cbt_exams` | `deleteAdminCbtExam()` | **Working** |
| `GET /api/admin/cbt/exams/:examId/questions` | `requireAdmin` | `exam_questions` | `AdminCbtPage` | **Working** |
| `POST /api/admin/cbt/exams/:examId/questions` | `requireAdmin` | `exam_questions` | `AdminCbtPage` | **Needs Enhancement** (should accept optional `subject` field for subject-aware question pools) |
| `PATCH /api/admin/cbt/questions/:questionId` | `requireAdmin` | `exam_questions` | `AdminCbtPage` | **Needs Enhancement** (should accept optional `subject` field) |
| `DELETE /api/admin/cbt/questions/:questionId` | `requireAdmin` | `exam_questions` | `AdminCbtPage` | **Working** |
| `GET /api/admin/news` | `requireAdmin` | `news_articles` | `fetchAdminNews()` | **Working** |
| `POST /api/admin/news` | `requireAdmin` | `news_articles` | `createAdminNews()` | **Working** |
| `PATCH /api/admin/news/:id` | `requireAdmin` | `news_articles` | `updateAdminNews()` | **Working** |
| `DELETE /api/admin/news/:id` | `requireAdmin` | `news_articles` | `deleteAdminNews()` | **Working** |
| `POST /api/admin/uploads` | `requireAdmin` | Supabase Storage (`admin-content`) | `uploadAdminImage()` | **Working** |
| `GET /api/admin/calendar-items` | `requireAdmin` | `edureach_deadlines` / `edureach_exams` | `fetchAdminCalendarItems()` | **Working** |
| `POST /api/admin/calendar-items` | `requireAdmin` | `edureach_deadlines` / `edureach_exams` | `createAdminCalendarItem()` | **Working** |
| `PATCH /api/admin/calendar-items/:id` | `requireAdmin` | `edureach_deadlines` / `edureach_exams` | `updateAdminCalendarItem()` | **Working** |
| `DELETE /api/admin/calendar-items/:id` | `requireAdmin` | `edureach_deadlines` / `edureach_exams` | `deleteAdminCalendarItem()` | **Working** |
| `GET /api/admin/institutions` | `requireAdmin` | `institutions` | `fetchAdminInstitutions()` | **Working** |
| `POST /api/admin/institutions` | `requireAdmin` | `institutions` | `createAdminInstitution()` | **Working** |
| `PATCH /api/admin/institutions/:id` | `requireAdmin` | `institutions` | `updateAdminInstitution()` | **Working** |
| `DELETE /api/admin/institutions/:id` | `requireAdmin` | `institutions` | `deleteAdminInstitution()` | **Working** |
| `GET /api/admin/services` | `requireAdmin` | `service_catalog` | `fetchAdminServices()` | **Working** |
| `POST /api/admin/services` | `requireAdmin` | `service_catalog` | `createAdminService()` | **Working** |
| `PATCH /api/admin/services/:id` | `requireAdmin` | `service_catalog` | `updateAdminService()` | **Working** |
| `DELETE /api/admin/services/:id` | `requireAdmin` | `service_catalog` | `deleteAdminService()` | **Working** |
| `GET /api/admin/opportunities` | `requireAdmin` | `opportunities` | `fetchAdminOpportunities()` | **Working** |
| `POST /api/admin/opportunities` | `requireAdmin` | `opportunities` | `createAdminOpportunity()` | **Working** |
| `PATCH /api/admin/opportunities/:id` | `requireAdmin` | `opportunities` | `updateAdminOpportunity()` | **Working** |
| `DELETE /api/admin/opportunities/:id` | `requireAdmin` | `opportunities` | `deleteAdminOpportunity()` | **Working** |
| `GET /api/admin/content-manager/resources` | `requireAdmin` | `CONTENT_RESOURCES` | `AdminContentManagerPage` | **Working** |
| `GET /api/admin/content-manager/data/:resourceKey` | `requireAdmin` | 10 whitelisted tables | `AdminContentManagerPage` | **Working** |
| `POST /api/admin/content-manager/data/:resourceKey` | `requireAdmin` | 10 whitelisted tables | `AdminContentManagerPage` | **Working** |
| `PATCH /api/admin/content-manager/data/:resourceKey/:id` | `requireAdmin` | 10 whitelisted tables | `AdminContentManagerPage` | **Working** |
| `DELETE /api/admin/content-manager/data/:resourceKey/:id` | `requireAdmin` | 10 whitelisted tables | `AdminContentManagerPage` | **Working** |
| `POST /api/admin/content-manager/import/:resourceKey` | `requireAdmin` | 10 whitelisted tables | `AdminContentManagerPage` (`confirmImport`) | **Unreachable in UI** (button not rendered in `AdminContentManagerPage.tsx`) |

---

## 3. Missing / Mismatched Frontend-to-Backend Endpoints

| Frontend Call | Location | Problem | Resolution |
|---|---|---|---|
| `fetch(apiUrl('/api/cbt/exams'))` | `src/components/ExamSimulatorGrid.tsx:58` | `server.ts` has no public `GET /api/cbt/exams` endpoint (only `/api/admin/cbt/exams`). Public CBT exams are fetched via `fetchCbtExams()` in `src/lib/api.ts`. | Update `ExamSimulatorGrid.tsx` to use `fetchCbtExams()` from `src/lib/api.ts` (and optionally expose public `GET /api/cbt/exams` in `server.ts`). |
| `GET /api/cbt/attempts/:attemptId/progress` & `PATCH /api/cbt/attempts/:attemptId/progress` | `src/lib/api.ts:615, 639` (`fetchCbtAttemptProgress`, `saveCbtAttemptProgress`) | `server.ts` has no `/api/cbt/attempts/:attemptId/progress` route; every call 404s. Meanwhile `cbt_attempts` has `current_question` and `cbt_answers` table in Supabase. | Use direct Supabase queries on `cbt_attempts` / `cbt_answers` in `fetchCbtAttemptProgress` and `saveCbtAttemptProgress` (matching `fetchLatestActiveCbtAttempt` in `src/lib/api.ts`) so signed-in progress sync works without 404s. |
| `/.netlify/functions/api/*` under `npm start` | `src/lib/apiBase.ts:6` & `server.ts` | Built production frontend rewrites `/api/*` to `/.netlify/functions/api/*`, which Express (`server.ts`) does not strip when running outside Netlify Functions. | Normalize `/.netlify/functions/api` → `/api` in `server.ts` middleware so both Netlify Functions and standalone Node (`npm start`) work identically. |

---

## 4. Dead / Unreachable Legacy Page Files

The following 15 files exist in the repository but are **never imported** by `src/app/routes.tsx` or any other module:

1. `pages/dashboard/ApplicationsPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
2. `pages/dashboard/CbtMockPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
3. `pages/dashboard/DashboardHomePage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
4. `pages/dashboard/NotificationsPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
5. `pages/dashboard/PastQuestionsPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
6. `pages/dashboard/ProfilePage.tsx` (superseded by `pages/ProfileCompletionPage.tsx`)
7. `pages/dashboard/SavedPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
8. `pages/dashboard/ScholarshipsPage.tsx` (superseded by `pages/JobsPage.tsx`)
9. `pages/dashboard/SettingsPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
10. `pages/dashboard/ToolsPage.tsx` (superseded by `pages/StudentDashboardV2.tsx`)
11. `pages/admin/AdminDashboardPage.tsx` (superseded by `pages/AdminDashboardPage.tsx`)
12. `pages/admin/AdminNewsPage.tsx` (superseded by `pages/AdminNewsPage.tsx`)
13. `pages/admin/AdminSchedulePage.tsx` (superseded by `pages/AdminContentPage.tsx`)
14. `pages/admin/AdminTasksPage.tsx` (superseded by `pages/AdminQueuePage.tsx`)
15. `pages/admin/AdminUsersPage.tsx` (superseded by `pages/AdminUsersPage.tsx`)
