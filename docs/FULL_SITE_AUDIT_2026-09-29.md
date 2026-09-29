# EduReach Hub — Full Frontend & User-Workflow Audit (2026-09-29)

**Repository:** `1436799528/EduReach_Hub`  
**Branch:** `arena/01a0eef0-edureach-hub`  
**Baseline Commit:** `174aae5ea891373ba8505476183ca3115c6d61d5`  
**Audit Date:** 2026-09-29  
**Phase 0 Compliance:** Created prior to any code modification (`git status` clean).  
**Companion Matrices:**  
- `docs/EDUREACH_ROUTE_MATRIX_2026-09-29.md`  
- `docs/EDUREACH_USER_WORKFLOW_AUDIT_2026-09-29.md`

---

## 1. Executive Summary & Baseline Verdict

**Pre-Fix Production Readiness Verdict:** `NOT READY` (Moving to `READY WITH CONDITIONS` after P0–P3 frontend & API-wiring fixes; final live production readiness depends on live Supabase credentials and populated question banks).

### Why the Baseline Build Was `NOT READY`
1. **P0 — CBT Workflow Failure (`"This CBT is not ready yet. Please choose another available question bank."`):**
   - `ExamSimulatorGrid.tsx` on `/` calls `fetch(apiUrl('/api/cbt/exams'))`, which returns `404` because `server.ts` has no `GET /api/cbt/exams` endpoint.
   - `ExamSetupPage.tsx` defaults WAEC/NECO first subject to `'Use of English'` while the WAEC/NECO option list uses `'English Language'`, and allows launching `/cbt/practice` with a synthetic non-UUID `practice-exam-*` ID when no active exam bank exists, immediately failing inside the exam hall with `"This CBT is not ready yet. Please choose another available question bank."`.
   - `AdminCbtPage.tsx` and `server.ts` (`POST /api/admin/cbt/exams/:examId/questions`) do not set `exam_questions.subject` to the parent exam's subject (or expose a `subject` field), causing questions created in `/admin/cbt` to default to `subject = 'General'` and fail subject-matching in `get_cbt_questions_for_subjects` and `selectCbtPaperQuestions`.
   - `fetchCbtAttemptProgress` and `saveCbtAttemptProgress` in `src/lib/api.ts` call `/api/cbt/attempts/:attemptId/progress`, which does not exist in `server.ts` (404).
2. **P0 — Production API Base Path Mismatch Under Standalone Node (`npm start`):**
   - `src/lib/apiBase.ts` rewrites `/api/*` to `/.netlify/functions/api/*` in production builds (`import.meta.env.PROD`), but `server.ts` only mounts routes at `/api/*` without stripping `/.netlify/functions`. Under `npm start`, every `POST /.netlify/functions/api/*` 404s and every `GET /.netlify/functions/api/*` falls through to `dist/index.html`.
3. **P0 — Admin Bulk CSV Import Unreachable in UI (`/admin/content-manager`):**
   - `AdminContentManagerPage.tsx` parses uploaded CSVs into `pendingImport` state and tells the admin *"Preview ready: X row(s). Review the first rows below, then confirm the import"*, but **never renders `pendingImport` or a button calling `confirmImport()` in the JSX**.
4. **P0 — Mobile Horizontal Overflow on `/schools` (`390px` and `375px`):**
   - Verified in headless Chromium: `/schools` overflows horizontally by `+37px` at `390px` and `+52px` at `375px` because `.school-finder-result-card` (`width: 421px`) and `.school-finder-search-row` lack mobile responsive rules in `src/edu-portal.css`.
5. **P1 — Raw HTML Tags Displayed to Users on `/events`, `/jobs`, and `/admin/content`:**
   - `AdminContentPage.tsx` and `AdminOpportunitiesPage.tsx` use `AdminRichTextEditor` (which saves HTML strings like `<p>...</p>`), but `EventsPage.tsx`, `JobsPage.tsx`, and `AdminContentPage.tsx` render `item.description` as plain text in JSX, exposing literal HTML tags to students.
6. **P1 — Opportunities (`/jobs`) Category Filter Desynchronization & Expired Deadlines:**
   - `JobsPage.tsx` filters by `['ALL', 'scholarship', 'internship', 'campus', 'part-time']`, whereas `AdminOpportunitiesPage.tsx` and `server.ts` only allow `['scholarship', 'grant', 'job', 'fellowship', 'competition']`. Admin-published grants, jobs, fellowships, and competitions cannot be filtered by category, and past deadlines are not marked as `Expired`.
7. **P1 — School Details Page (`/schools/:slug`) Ignores Slug & Database Records:**
   - `SchoolDetailsPage.tsx` only reads URL query parameters (`?name=...&acronym=...`). Direct navigation to `/schools/unilag` or `/schools/:slug` without query parameters fails to look up the institution from Supabase `institutions` (or starter institutions) and does not surface linked `faculties`, `departments`, or `programmes`.
8. **P1 — Service Catalogue, Search & Tools Desynchronization:**
   - `src/app/routes.tsx` restricts `/services/:slug` and `/services/apply/:slug` to 4 hardcoded slugs (`liveServiceSlugs`), sending any admin-created in-app service to `ComingSoonPage`.
   - `SearchPage.tsx` searches only static `src/data/services.ts` and `fetchNewsArticles()`, ignoring live `fetchServices()`, `fetchOpportunities()`, and `institutions`.
   - `/tools/cgpa-calculator` renders `ComingSoonPage` even though a complete `CgpaCalculatorCard` component already exists.

---

## 2. Complete Page-by-Page Audit

| Page / Component | Route(s) | 5-Second Nigerian Student Test | Supported Actions | Issues Identified |
|---|---|---|---|---|
| `HubHomePage.tsx` | `/` | **Pass** — Clear Nigerian exam & student service portal layout | Search, open CBT setup, open services, read news, check deadlines, preview schools & grants | `ExamSimulatorGrid` calls non-existent `/api/cbt/exams` (404) instead of `fetchCbtExams()`. |
| `ExamHubPage.tsx` | `/jamb`, `/waec`, `/neco`, `/post-utme` | **Pass** — Tailored to each Nigerian exam body | Pick course/track/school, launch CBT setup, open past questions & syllabus | Links to `/cbt/setup/:exam` work; needs seamless subject handoff when `?subject=` is used. |
| `CbtPage.tsx` | `/cbt` | **Pass** — Shows 4 exam bodies + live question banks + active attempt resume | Select exam category, select specific question bank, resume unfinished attempt | If student clicks a category without a live bank in Supabase, setup page allows starting a broken attempt instead of disabling start with a clear notice. |
| `ExamSetupPage.tsx` | `/cbt/setup/:exam` | **Pass** — Familiar JAMB/WAEC/Post-UTME subject & timer setup | Select course/track/school, pick subjects, pick duration, launch `/cbt/practice` | 1) WAEC/NECO default subject `'Use of English'` mismatches `'English Language'`. 2) Ignores `?subject=` query param from `/past-questions`. 3) Allows starting with synthetic `practice-exam-*` ID when no live bank exists. 4) Does not pre-populate/align subjects with the selected exam bank's actual subjects. |
| `CbtPracticePage.tsx` | `/cbt/practice` | **Pass** — Authentic CBT hall with timer, palette, calculator, keyboard shortcuts | Answer A–D, flag, navigate, use scientific calculator, submit paper, offline queue | Calls missing `/api/cbt/attempts/:id/progress` endpoint; shows generic `"This CBT is not ready yet"` when subjects don't match `exam_questions.subject`. |
| `CbtResultsPage.tsx` | `/cbt/results`, `/dashboard/cbt/results*` | **Pass** — Official result slip layout + per-question review | Print / Save PDF (`window.print()`), review explanations, retake test | Works well; print stylesheet hides chrome cleanly. |
| `PastQuestionsPage.tsx` | `/past-questions` | **Pass** — Filterable past-question & syllabus directory | Filter by exam body, search by subject/course, launch CBT practice | Passes `?subject=...` to `/cbt/setup/:exam`, which `ExamSetupPage` previously ignored. |
| `ServicesCatalogPage.tsx` | `/services` | **Pass** — Clear service directory with category tabs | Search services, filter by category, open guided service page | Works when API is reachable; needs `server.ts` `/.netlify/functions/api` normalization for standalone production builds. |
| `ServiceApplyPage.tsx` | `/services/:slug`, `/services/apply/:slug`, `/nelfund`, `/results-checker`, `/jamb-slip` | **Pass** — Step-by-step official requirements + support request form | Fill service-specific fields, submit request, copy reference code, open WhatsApp / Dashboard tracker | Restricted to 4 hardcoded slugs in `routes.tsx`; should also support any active admin-created service slug from `service_catalog`. |
| `SchoolFinderPage.tsx` | `/schools` | **Pass** — Nigerian universities/polytechnics/colleges directory | Search by name/acronym/course, filter by state, open school details | Mobile horizontal overflow (`+37px` at `390px`, `+52px` at `375px`) in `.school-finder-result-card` and `.school-finder-search-row`. |
| `SchoolDetailsPage.tsx` | `/schools/:slug` | **Partial** — Shows school card when navigated from `/schools`, fails on direct slug visit | View school metadata, open official website/admission/student portals, launch Post-UTME CBT | Only reads URL query params (`?name=...`); does not query `institutions`, `faculties`, `departments`, or `programmes` by slug/acronym. |
| `ScreeningCalculatorPage.tsx` | `/screening-calculator` | **Pass** — UTME + O'Level + Post-UTME aggregate calculator | Enter UTME score, 5 O'Level grades, Post-UTME score, ratio preset, compute aggregate | Fully functional client-side tool. |
| `NewsPage.tsx` | `/news` | **Pass** — Clean education newsroom | Filter by category, search headlines, open article | Works cleanly with honest empty state. |
| `NewsArticlePage.tsx` | `/news/:slug` | **Pass** — Distraction-free article view | Read article, click source link, browse related news | Plain-text URLs (`https://...`) in article body paragraphs are not auto-linked into clickable `<a>` links. |
| `EventsPage.tsx` | `/events` | **Pass** — Exam dates & registration deadlines | Filter All / Exams / Deadlines | Renders raw HTML tags from `item.description` as literal text. |
| `JobsPage.tsx` | `/jobs` | **Pass** — Scholarships, grants & student roles | Filter by category, search, view details modal, open official application link | 1) Filter pills don't match backend categories (`grant`, `job`, `fellowship`, `competition`). 2) Expired deadlines not badged as `Expired`. 3) Raw HTML tags in `item.description` rendered as literal text. |
| `SearchPage.tsx` | `/search` | **Pass** — Instant portal search | Search query, click results, browser back/forward | Uses static `src/data/services.ts` instead of combining live `fetchServices()`, `fetchOpportunities()`, and `institutions`. |
| `ComingSoonPage.tsx` | `/nabteb`, `/support`, `/tools*`, `/admission*` | **Partial** — Honest placeholder, but blocks `/tools/cgpa-calculator` | Return home, browse related links | `/tools/cgpa-calculator` and `/cgpa-calculator` should render a working public CGPA Calculator page using `CgpaCalculatorCard` instead of `ComingSoonPage`. |
| `AuthPageV2.tsx` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | **Pass** — Clean student/parent/teacher auth card | Sign in, register, request reset, set new password, resend verification | Raw `fetch('/api/admin/session')` instead of `apiUrl('/api/admin/session')`. |
| `ProfileCompletionPage.tsx` | `/profile`, `/profile/complete`, `/dashboard/profile` | **Pass** — Nigerian academic profile fields | Upload/set avatar, select institution/course/department/faculty/level/session/years, save | After clicking `"Save & Open Dashboard"` on initial completion, redirects to `/profile` instead of `/dashboard`. |
| `StudentDashboardV2.tsx` | `/dashboard*`, `/settings` | **Pass** — Compact student workspace | View overview, track requests, review/resume CBT, use CGPA & School tools, manage saved items & security | Raw `fetch('/api/admin/session')` instead of `apiUrl('/api/admin/session')`. |
| `AdminDashboardPage.tsx` | `/admin` | **Pass** — Operations Control console | View KPIs, process active queue, inspect audit trail & telemetry | Works cleanly. |
| `AdminQueuePage.tsx` | `/admin/queue` | **Pass** — Service queue processor | Filter by status, transition request status, add/edit internal admin note | Works cleanly. |
| `AdminCbtPage.tsx` | `/admin/cbt` | **Partial** — CBT exam & question manager | Create/edit/toggle/delete exams, add/edit/delete questions | Question form lacks `subject` field (and `server.ts` doesn't default `exam_questions.subject` to the exam's `subject`), breaking subject-filtered CBT papers. |
| `AdminNewsPage.tsx` | `/admin/news` | **Pass** — Newsroom CMS | Create/edit/publish/feature/delete news, upload image, preview | Works cleanly. |
| `AdminContentPage.tsx` | `/admin/content` | **Pass** — Deadlines & exam dates manager | Create/edit/delete deadlines & exam dates | Table row displays raw HTML tags from `item.description`. |
| `AdminOpportunitiesPage.tsx` | `/admin/opportunities` | **Pass** — Scholarships & grants manager | Create/edit/toggle/delete opportunities | Table description/details work, but public `/jobs` page needs HTML sanitization & matching category pills. |
| `AdminSchoolsPage.tsx` | `/admin/schools` | **Pass** — Institutions directory manager | Search, create/edit/delete institutions | Works cleanly. |
| `AdminServicesPage.tsx` | `/admin/services` | **Pass** — Service catalogue manager | Create/edit/toggle/delete services | Works cleanly. |
| `AdminUsersPage.tsx` | `/admin/users` | **Pass** — Student account manager | Search users, view activity modal, suspend/unsuspend | Table has 8 columns in `<thead>` but `colSpan={7}` on empty/loading states. |
| `AdminAnalyticsPage.tsx` | `/admin/analytics` | **Pass** — Operational analytics | View queue composition, traffic bars, funnels, audit trail | Works cleanly. |
| `AdminContentManagerPage.tsx` | `/admin/content-manager` | **Broken Import** — Bulk CSV & table manager | Select resource, export CSV, download template, import CSV, CRUD rows | CSV import sets `pendingImport` state but **never renders the preview or `confirmImport` button** in JSX! Also missing from `AdminLayout` sidebar. |

---

## 3. Deep CBT Audit & Trace of `"This CBT is not ready yet. Please choose another available question bank."`

### 3.1 Exact Code Trace
1. **Error Sanitizer Mapping (`lib/errors.ts:25`):**
   ```ts
   if (/no questions|question bank/i.test(raw)) {
     return 'This CBT is not ready yet. Please choose another available question bank.';
   }
   ```
2. **Where the Underlying Errors Originate:**
   - `server.ts:686` (`GET /api/cbt/exams/:examId/guest-questions`): returns `404 { error: 'CBT question bank is not configured.' }` when Supabase is not configured.
   - `server.ts:742` (`GET /api/cbt/exams/:examId/guest-questions`): returns `422 { error: 'This CBT exam has no questions for the selected subjects.' }` when `selectCbtPaperQuestions` finds 0 matching questions.
   - `src/lib/api.ts:555` (`fetchCbtQuestions`): throws `new Error('No questions are available for the selected subjects.')` when `selectPaperQuestionsClient` finds 0 matching questions.
   - `supabase/migrations/20260928190000_cbt_subject_aware_papers.sql:128` (`start_cbt_attempt_for_subjects`): raises `'No questions are available for the selected subjects.'`.
3. **Why Valid or Newly Created Exams Hit This Error:**
   - **Cause 1 (`ExamSimulatorGrid.tsx:58`):** Calls `fetch(apiUrl('/api/cbt/exams'))` which 404s. `exams` stays empty on `/`.
   - **Cause 2 (`AdminCbtPage.tsx` & `server.ts:965`):** When an admin creates an exam (e.g. `exam_body: 'JAMB'`, `subject: 'Use of English'`) and adds questions in `/admin/cbt`, `exam_questions.subject` is not sent by `AdminCbtPage` and not populated from `cbt_exams.subject` by `server.ts`, so Postgres sets `exam_questions.subject = 'General'`. Then when a student selects `['Use of English', 'Mathematics', 'Physics', 'Chemistry']`, `selectCbtPaperQuestions` and `get_cbt_questions_for_subjects` compare `lower(trim(q.subject))` (`'general'`) against the requested subjects — matching **zero** rows!
   - **Cause 3 (`ExamSetupPage.tsx`):**
     - Defaults `subjects[0]` to `'Use of English'` even on `/cbt/setup/waec` and `/cbt/setup/neco` (where the subject list uses `'English Language'`).
     - Does not check what subjects actually exist in the selected exam's question pool (or `targetExam.subject`), so a single-subject bank (e.g. a JAMB Physics or Post-UTME General bank) fails when 4 unrelated default subjects are requested.
     - Allows clicking `Start Timed Practice` even when `targetExam` is `null` (passing `exam=practice-exam-jamb`), which guaranteed a failure on `/cbt/practice`.
   - **Cause 4 (`src/lib/api.ts:615,639`):** `fetchCbtAttemptProgress` and `saveCbtAttemptProgress` call `/api/cbt/attempts/:attemptId/progress` (404).

### 3.2 Complete Fix Strategy for CBT
1. Update `ExamSimulatorGrid.tsx` to use `fetchCbtExams()` from `src/lib/api.ts` and add a public `GET /api/cbt/exams` endpoint in `server.ts` so both direct API and Supabase client paths work.
2. In `ExamSetupPage.tsx`:
   - Respect `?subject=` query parameter from `/past-questions` and `/jamb` / `/waec` / `/neco`.
   - Initialize WAEC/NECO default compulsory subject to `'English Language'` (and treat `'Use of English'` / `'English Language'` / `'English'` as equivalent English subjects).
   - When `targetExam` is selected and is a single-subject bank (or has `targetExam.subject`), ensure `targetExam.subject` is included in the active subjects list.
   - When `examsLoading` is false and `targetExam` is `null` (no active question bank configured for that exam body), clearly inform the student on the setup page that no live question bank is published yet for that exam body and disable launching a broken `/cbt/practice?exam=practice-exam-*` URL (while still allowing direct navigation to `/cbt/practice` to show its own honest empty state).
3. In `selectPaperQuestionsClient` (`src/lib/api.ts`) and `selectCbtPaperQuestions` (`server.ts`):
   - Normalize English subject aliases (`'use of english'`, `'english language'`, `'english'`) so WAEC/NECO/JAMB English questions match regardless of alias.
   - If an exam bank's questions have `subject = 'General'` (or null) or match the parent exam's `cbt_exams.subject`, fall back to including those questions when no strict per-subject match is found, preventing admin-created single-bank exams from returning 0 questions!
4. In `AdminCbtPage.tsx` and `server.ts`:
   - Add a `subject` field to the question form in `AdminCbtPage.tsx` (defaulting to the selected exam's `subject`), and accept `subject` in `POST /api/admin/cbt/exams/:examId/questions` and `PATCH /api/admin/cbt/questions/:questionId` in `server.ts`.
5. In `src/lib/api.ts` (`fetchCbtAttemptProgress` & `saveCbtAttemptProgress`):
   - Query/update `cbt_attempts` and `cbt_answers` directly via Supabase (with safe fallback) instead of calling the non-existent `/api/cbt/attempts/:attemptId/progress` endpoint.

---

## 4. Responsive & Visual System Audit Across 6 Required Viewports

Tested in headless Chromium across `1440×900`, `1280×800`, `1024×768`, `768×1024`, `390×844`, and `375×667`:

| Viewport | Routes Tested | Horizontal Overflow (`scrollWidth > innerWidth`) | Visual / Layout Observations |
|---|---|---|---|
| `1440px` | All 36 public & auth routes | `0px` on all routes | Clean compact container widths (`max-width: 1180px` / `900px`). |
| `1280px` | All 36 public & auth routes | `0px` on all routes | Desktop header nav, search bar, and grids align cleanly. |
| `1024px` | All 36 public & auth routes | `0px` on all routes | Cards wrap cleanly; CBT palette sits beside question card. |
| `768px` | All 36 public & auth routes | `0px` on all routes | Tablet breakpoint switches cleanly to mobile drawer & compact grids. |
| `390px` | All 36 public & auth routes | **`/schools` overflows by `+37px`** (`scrollWidth: 427px`) | `.school-finder-result-card` (`width: 421px`) and `.school-finder-search-row` (`grid-template-columns: minmax(0,1fr) 210px`) overflow narrow screens. |
| `375px` | All 36 public & auth routes | **`/schools` overflows by `+52px`** (`scrollWidth: 427px`) | Same root cause on `/schools`; all other 35 routes have `0px` overflow. |

---

## 5. Prioritized Issue Register (P0 → P1 → P2 → P3)

### P0 — Critical Blockers (Broken Core Flows / Layout Overflow / Unreachable Admin Action)
- **P0-1:** `server.ts` does not normalize `/.netlify/functions/api` to `/api`, breaking API calls in production builds running via `npm start`.
- **P0-2:** `ExamSimulatorGrid.tsx` calls `fetch(apiUrl('/api/cbt/exams'))` (404) instead of `fetchCbtExams()`, and `server.ts` lacks a public `GET /api/cbt/exams` route.
- **P0-3:** CBT setup & question selection mismatch (`ExamSetupPage.tsx`, `src/lib/api.ts`, `server.ts`, `AdminCbtPage.tsx`) triggers `"This CBT is not ready yet. Please choose another available question bank."` due to English alias mismatch (`Use of English` vs `English Language`), `exam_questions.subject` defaulting to `'General'`, and `practice-exam-*` fallback IDs.
- **P0-4:** `AdminContentManagerPage.tsx` parses CSV imports into `pendingImport` state but never renders the import preview or `confirmImport` button in JSX.
- **P0-5:** `/schools` (`SchoolFinderPage.tsx` / `src/edu-portal.css`) overflows horizontally at `390px` (`+37px`) and `375px` (`+52px`).

### P1 — High-Priority Functional & Data-Synchronization Defects
- **P1-1:** `EventsPage.tsx`, `JobsPage.tsx`, and `AdminContentPage.tsx` render rich-text HTML descriptions (`item.description`) as raw text strings (`<p>...</p>`).
- **P1-2:** `JobsPage.tsx` category filter pills (`internship`, `campus`, `part-time`) are out of sync with backend `OPPORTUNITY_CATEGORIES` (`scholarship`, `grant`, `job`, `fellowship`, `competition`), and expired deadlines (`deadline < today`) are not marked as `Expired`.
- **P1-3:** `SchoolDetailsPage.tsx` only reads URL query parameters and does not query Supabase `institutions` (or starter institutions / faculties / departments / programmes) when visited via `/schools/:slug`.
- **P1-4:** `src/app/routes.tsx` restricts `/services/:slug` and `/services/apply/:slug` to 4 hardcoded slugs (`liveServiceSlugs`), blocking admin-created services from using `ServiceApplyPage`.
- **P1-5:** `SearchPage.tsx` only searches static `src/data/services.ts` and news, ignoring live services (`fetchServices()`), opportunities (`fetchOpportunities()`), and schools (`institutions`).
- **P1-6:** `/tools/cgpa-calculator` (and `/cgpa-calculator`) hits `ComingSoonPage` even though `CgpaCalculatorCard` is implemented and ready to serve students.
- **P1-7:** `fetchCbtAttemptProgress` and `saveCbtAttemptProgress` in `src/lib/api.ts` call non-existent `/api/cbt/attempts/:attemptId/progress` (404), and `AuthPageV2.tsx`, `StudentDashboardV2.tsx`, and `trackEvent()` in `src/lib/api.ts` call raw `fetch('/api/...')` without `apiUrl()`.

### P2 — Medium-Priority UX & Workflow Polish
- **P2-1:** `NewsArticlePage.tsx` does not linkify plain-text URLs (`https://...`) inside article paragraphs.
- **P2-2:** `ExamSetupPage.tsx` ignores the `?subject=` query parameter passed from `PastQuestionsPage.tsx`.
- **P2-3:** `ProfileCompletionPage.tsx` redirects to `/profile` instead of `/dashboard` when clicking `"Save & Open Dashboard"` on initial profile completion.
- **P2-4:** `AdminLayout.tsx` sidebar is missing a navigation link to `/admin/content-manager`, and `src/lib/pageMeta.ts` is missing titles for `/admin/content`, `/admin/opportunities`, `/admin/schools`, `/admin/services`, `/admin/content-manager`, `/dashboard/profile`, and `/tools/cgpa-calculator`.
- **P2-5:** `AdminUsersPage.tsx` table has 8 columns in `<thead>` but `colSpan={7}` on loading and empty states.

### P3 — Cleanup & Maintainability
- **P3-1:** `ComingSoonPage.tsx` contains dead conditional `path === '/schools'` (since `/schools` is a live route) and `src/data/services.ts` has stale `ComingSoon` descriptions for routes that now have live equivalents.
- **P3-2:** 15 unused legacy page files in `pages/dashboard/*` and `pages/admin/*` are dead code superseded by `StudentDashboardV2.tsx`, `ProfileCompletionPage.tsx`, and top-level `pages/Admin*Page.tsx`.
