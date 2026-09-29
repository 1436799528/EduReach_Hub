# EduReach Hub — User Workflow & Journey Audit (2026-09-29)

**Repository:** `1436799528/EduReach_Hub`  
**Branch:** `arena/01a0eef0-edureach-hub`  
**Baseline Commit:** `174aae5ea891373ba8505476183ca3115c6d61d5`  
**Audit Date:** 2026-09-29  

---

## 1. Real User Journey Audits (12 Core Workflows)

### Journey 1: Anonymous Nigerian Student Landing on `/` → Exploring Services & CBT
- **Steps Executed:**
  1. Load `/`.
  2. Inspect top navigation (`Home`, `CBT Practice`, `Services`, `News`, `Grants`, `Talk to Us`), search bar, quick-action tiles, CBT simulator cards, service cards, news feed, and school finder preview.
- **5-Second Nigerian Student Test:**
  - *Can a student immediately tell what EduReach does?* **Yes** — JAMB/WAEC/NECO/Post-UTME CBT, NELFUND loan support, result checking, JAMB slip printing, school finder, and education news are visible above the fold.
- **Workflow Completion Findings:**
  - **Defect 1 (P0):** `ExamSimulatorGrid` on `/` calls `fetch(apiUrl('/api/cbt/exams'))` (`src/components/ExamSimulatorGrid.tsx:58`), which returns `404` from `server.ts`. As a result, the home page never receives active CBT exam UUIDs from Supabase and links to `/cbt/setup/jamb` without `?exam=<uuid>`.
  - **Defect 2 (P0):** In a built production bundle running on `server.ts` (`npm start`), `API_BASE_PATH` is `/.netlify/functions/api`, which `server.ts` does not normalize to `/api`. Thus `POST /.netlify/functions/api/analytics/event` returns `404` on every page load, and `GET /.netlify/functions/api/*` falls through to `index.html`.

---

### Journey 2: Student Starting a CBT Exam (`/cbt` → `/cbt/setup/:exam` → `/cbt/practice` → `/cbt/results`)
- **Steps Executed:**
  1. Navigate to `/cbt` or `/jamb` / `/waec` / `/neco` / `/post-utme`.
  2. Click an exam card to open `/cbt/setup/jamb`, `/cbt/setup/waec`, `/cbt/setup/neco`, or `/cbt/setup/post-utme`.
  3. Select course/track, subjects, and duration; click `Start Timed Practice`.
  4. Enter `/cbt/practice`, answer questions, use scientific calculator, flag a question, submit paper, and view `/cbt/results`.
- **Root-Cause Trace of `"This CBT is not ready yet. Please choose another available question bank."`:**
  - **Origin:** `lib/errors.ts:25` maps any error matching `/no questions|question bank/i` to `'This CBT is not ready yet. Please choose another available question bank.'`.
  - **Trigger Chain A — Non-UUID Fallback Exam ID:** In `pages/ExamSetupPage.tsx:107`, when `targetExam` is `null` (because no active `cbt_exams` row matches `exam` or `fetchCbtExams()` returned `[]`), `ExamSetupPage` still allows clicking `Start Timed Practice` and passes `exam = targetExam?.id || 'practice-exam-${exam}'` in the URL! When `CbtPracticePage.tsx` calls `fetchCbtQuestions('practice-exam-jamb', subjects)` or `startCbt('practice-exam-jamb', ...)`, the backend/Supabase rejects the non-UUID or returns `404 CBT question bank is not configured.` / `404 CBT exam not found.`, which `userFacingError` turns into `"This CBT is not ready yet. Please choose another available question bank."` AFTER the student has already configured their subjects and entered the exam hall!
  - **Trigger Chain B — Subject Name Mismatch between Setup UI and `exam_questions`:**
    - In `pages/ExamSetupPage.tsx:66`, `subjects` state initializes to `['Use of English', 'Mathematics', 'Physics', 'Chemistry']` regardless of whether `exam` is `jamb`, `waec`, `neco`, or `post-utme`.
    - For `waec` and `neco`, `secondaryOptions` (`src/data/examPreparation.ts:44-50`) uses `'English Language'`, NOT `'Use of English'`. Unless the student changes the secondary track dropdown, `subjects[0]` remains `'Use of English'`.
    - Furthermore, when an admin creates a CBT exam in `/admin/cbt` and adds questions, `AdminCbtPage.tsx` does NOT expose a `subject` input on questions! All questions created via `/admin/cbt` get the database column default `subject = 'General'` (from `20260928190000_cbt_subject_aware_papers.sql`), while the exam record itself has `cbt_exams.subject` (e.g., `'Use of English'` or `'Mathematics'`).
    - Then, when `get_cbt_questions_for_subjects(p_exam_id, p_subjects)` or `selectCbtPaperQuestions(rows, examBody, subjects)` runs, it filters `lower(trim(q.subject)) = lower(trim(r.subject))`. Because `q.subject` is `'General'` (or doesn't match the 4 selected subjects), 0 questions match! Both `server.ts:742` and the RPC throw `'No questions are available for the selected subjects.'` / `'This CBT exam has no questions for the selected subjects.'`, which `userFacingError` translates to `"This CBT is not ready yet. Please choose another available question bank."`!
  - **Trigger Chain C — Missing Progress Endpoint:** `fetchCbtAttemptProgress` and `saveCbtAttemptProgress` in `src/lib/api.ts:615,639` call `/api/cbt/attempts/:attemptId/progress`, which does not exist in `server.ts` (404 on every question navigation / answer save for signed-in users).

---

### Journey 3: Past Questions & Study Materials (`/past-questions`, `/jamb`, `/waec`, `/neco`, `/post-utme`)
- **Steps Executed:**
  1. Visit `/past-questions`.
  2. Filter by exam (`JAMB`, `WAEC`, `NECO`, `POST-UTME`) and search by subject/course.
  3. Click a past-question card or syllabus material card.
- **Workflow Completion Findings:**
  - Cards on `/past-questions` and `ExamHubPage` link to `/cbt/setup/:exam?subject=...` with CTA `"Practice in CBT"`.
  - However, on `/cbt/setup/:exam`, the `?subject=` query parameter passed from `/past-questions` is **ignored** (`ExamSetupPage.tsx` only reads `?course=`, `?track=`, `?school=`, and `?exam=`, never `?subject=`)! So clicking `"JAMB Physics Past Questions"` on `/past-questions` opens `/cbt/setup/jamb?subject=Physics` without selecting Physics or matching a Physics question bank!

---

### Journey 4: Requesting a Guided Student Service (`/services` → `/services/:slug` → `/dashboard/services`)
- **Steps Executed:**
  1. Visit `/services`, filter by category or search.
  2. Click a service card (e.g. `NELFUND Student Loan`, `WAEC / NECO / JAMB Result Checker`, `JAMB Original Result Slip`, `Admission Letter Guide`).
  3. Read official requirements, official portal link, and fill the guided service request form on `/services/:slug`.
  4. Submit form and receive reference code (`ER-XXXXXXXX`), WhatsApp follow-up link, and dashboard tracker link.
- **Workflow Completion Findings:**
  - **Defect 1 (P1):** `src/app/routes.tsx:16` hardcodes `liveServiceSlugs = new Set(['nelfund-loan', 'results', 'jamb-slip', 'admission-letters'])`. If an admin creates a new service in `/admin/services` (or edits an existing service) that uses the in-app service page `/services/:slug` or `/services/apply/:slug`, `routes.tsx` sends it to `ComingSoonPage` instead of `ServiceApplyPage`!
  - **Defect 2 (P2):** On `ServiceApplyPage.tsx`, when a generic/admin-created service is opened, `ServiceApplyPage` should gracefully render a general service request form if the slug is not one of the 4 specialized presets, rather than failing or showing Coming Soon.

---

### Journey 5: Searching the Portal (`/search`)
- **Steps Executed:**
  1. Use header search bar or visit `/search?q=...`.
  2. Click search result items and use browser Back/Forward buttons.
- **Workflow Completion Findings:**
  - **Defect (P1):** `SearchPage.tsx` searches static `src/data/services.ts` (23 hardcoded entries, 11 of which point to `ComingSoonPage` routes such as `/admission/cut-off-marks`, `/admission/caps`, `/tools/cgpa-calculator`, `/services/transcript`, `/support`) instead of also indexing live services from `fetchServices()`, live opportunities from `fetchOpportunities()`, and institutions from the School Finder!

---

### Journey 6: School & Course Finder (`/schools` → `/schools/:slug`)
- **Steps Executed:**
  1. Visit `/schools`, search by school name/acronym/course, filter by state.
  2. Click a school card to open `/schools/:slug`.
  3. Inspect school details, official website link, and course context.
- **Workflow Completion Findings:**
  - **Defect 1 (P0 — Responsive):** On mobile viewports (`390px` and `375px`), `/schools` has horizontal overflow (`+37px` at `390px`, `+52px` at `375px`) because `.school-finder-result-card` and `.school-finder-search-row` lack mobile responsive rules in `src/edu-portal.css`.
  - **Defect 2 (P1 — Direct Navigation & Data):** `SchoolDetailsPage.tsx` only reads URL query parameters (`?name=...&acronym=...&state=...&type=...&website=...`). If a user visits `/schools/unilag` directly (or refreshes a clean slug link without query params, or when `institutions`, `faculties`, `departments`, `programmes` exist in Supabase), `SchoolDetailsPage` does not query Supabase `institutions` (or starter institutions by slug/acronym) and immediately shows `"Institution record not found"`!

---

### Journey 7: Scholarships, Grants & Student Jobs (`/jobs`)
- **Steps Executed:**
  1. Click `Grants` in top nav or visit `/jobs`.
  2. Filter by category and search by keyword.
  3. Open an opportunity modal or external application link.
- **Workflow Completion Findings:**
  - **Defect 1 (P1 — Category Filter Desync):** Admin console (`AdminOpportunitiesPage.tsx` and `server.ts`) creates opportunities with categories `['scholarship', 'grant', 'job', 'fellowship', 'competition']`. However, `JobsPage.tsx:31` renders filter buttons for `['ALL', 'scholarship', 'internship', 'campus', 'part-time']`! Consequently, admin-published `grant`, `job`, `fellowship`, and `competition` opportunities cannot be filtered by their category on `/jobs`.
  - **Defect 2 (P1 — Expired Deadlines):** `JobsPage.tsx` displays `item.deadline` raw without checking whether the deadline has passed (`new Date(item.deadline) < today`). Expired scholarships/opportunities appear as active open listings with no `Expired` badge or warning.
  - **Defect 3 (P1 — Raw HTML in Descriptions):** `AdminOpportunitiesPage.tsx` uses `AdminRichTextEditor` (which saves HTML like `<p>Requirements...</p>`) for `opportunity.description`. `JobsPage.tsx:168,266` renders `{item.description}` as plain text in JSX, exposing raw HTML tags (`<p>`, `<strong>`, `<ul>`) to students!

---

### Journey 8: Education News & Events (`/news`, `/news/:slug`, `/events`)
- **Steps Executed:**
  1. Visit `/news`, filter by category, search, and open `/news/:slug`.
  2. Visit `/events` to inspect upcoming exam dates and registration deadlines.
- **Workflow Completion Findings:**
  - **Defect 1 (P1 — Raw HTML on `/events` and `/admin/content`):** `AdminContentPage.tsx` uses `AdminRichTextEditor` for deadline/exam `description`, storing HTML. Both `EventsPage.tsx:86` and `AdminContentPage.tsx:194` render `{item.description}` as literal text in JSX, displaying raw `<p>...</p>` tags to users!
  - **Defect 2 (P2 — Plain-Text URLs in News Articles):** In `NewsArticlePage.tsx:114-122`, when an article body (or plain-text paragraph) contains a raw URL (`https://...`), it is not linkified into a clickable `<a>` tag.

---

### Journey 9: Student Authentication (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`)
- **Steps Executed:**
  1. Visit `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
  2. Switch modes and verify URL synchronization (`?next=` preservation).
  3. Test unconfigured fail-closed behavior and configured sign-in redirect.
- **Workflow Completion Findings:**
  - **Defect (P1):** `AuthPageV2.tsx:239` calls `fetch('/api/admin/session')` directly instead of `apiUrl('/api/admin/session')`.

---

### Journey 10: Profile Completion & Editing (`/profile`, `/profile?edit=1`)
- **Steps Executed:**
  1. Complete academic profile fields (Institution, Course/Programme, Department, Faculty, Level, Session, Admission Year, Expected Graduation Year).
  2. Click `Save & Open Dashboard`.
  3. Re-open `/profile` to view read-only summary card and click `Edit Profile` (`/profile?edit=1`).
- **Workflow Completion Findings:**
  - **Defect (P2):** The submit button on `ProfileCompletionPage.tsx:1058` is labeled `"Save & Open Dashboard"` and the success banner says `"Profile completed successfully! Redirecting to your student dashboard…"`, but line 336 redirects to `'/profile'` instead of `'/dashboard'` (when not in `?edit=1` mode)!

---

### Journey 11: Student Dashboard & Tools (`/dashboard`, `/dashboard/services`, `/dashboard/cbt`, `/dashboard/tools`, `/screening-calculator`)
- **Steps Executed:**
  1. Navigate across Overview, My Requests, My CBT, and Tools & Saved tabs.
  2. Test CGPA Calculator (`CgpaCalculatorCard`), School Shortlister (`SchoolFinderCard`), and Screening Calculator (`/screening-calculator`).
- **Workflow Completion Findings:**
  - **Defect 1 (P1):** Public links to `/tools/cgpa-calculator` (from `src/data/services.ts` and `SearchPage`) land on `ComingSoonPage`, even though a full, working CGPA Calculator (`CgpaCalculatorCard`) already exists in the codebase!
  - **Defect 2 (P1):** `StudentDashboardV2.tsx:298` calls raw `fetch('/api/admin/session')` instead of `apiUrl('/api/admin/session')`.

---

### Journey 12: Admin Operations Console (`/admin/*`)
- **Steps Executed:**
  1. Inspect `AdminLayout` navigation, `AdminDashboardPage`, `AdminQueuePage`, `AdminCbtPage`, `AdminNewsPage`, `AdminContentPage`, `AdminOpportunitiesPage`, `AdminSchoolsPage`, `AdminServicesPage`, `AdminUsersPage`, `AdminAnalyticsPage`, `AdminContentManagerPage`.
- **Workflow Completion Findings:**
  - **Defect 1 (P0 — Broken Bulk CSV Import in `/admin/content-manager`):** In `AdminContentManagerPage.tsx`, `importCsv()` parses a CSV file into `pendingImport` state and displays `"Preview ready: X row(s). Review the first rows below, then confirm the import."` — but `pendingImport` and `confirmImport()` are **never rendered anywhere in the JSX**! Admins cannot confirm or complete any CSV import.
  - **Defect 2 (P1 — Missing Subject Field on CBT Questions in `/admin/cbt`):** `AdminCbtPage.tsx` does not allow setting or editing `subject` on individual questions in `exam_questions` (nor does `server.ts` persist `subject` on question POST/PATCH, instead defaulting to `'General'`). Because `get_cbt_questions_for_subjects` and `selectCbtPaperQuestions` match questions by `exam_questions.subject`, questions added in `/admin/cbt` fail to match student-selected subjects unless `subject` defaults to the parent exam's `subject` or is editable per question!
  - **Defect 3 (P2 — Missing Sidebar Link & Page Titles):** `AdminLayout.tsx` sidebar has no link to `/admin/content-manager` (it is only reachable from a quick tile on `/admin`). `src/lib/pageMeta.ts` is missing titles for `/admin/content`, `/admin/opportunities`, `/admin/schools`, `/admin/services`, `/admin/content-manager`, and `/dashboard/profile`.
  - **Defect 4 (P2 — Table Column Mismatch in `AdminUsersPage.tsx`):** `AdminUsersPage.tsx` renders 8 `<th>` columns (`Name`, `Institution`, `Department`, `Level`, `Role`, `Profile`, `Joined`, `Actions`), but `TableSkeleton` and the empty state row use `colSpan={7}`.

---

## 2. User Freedom & Rights Audit

| User Right | Current Behaviour | Audit Verdict |
|---|---|---|
| **Right to Exit / Go Back** | Every page (`AuthPageV2`, `ExamSetupPage`, `CbtPracticePage`, `CbtResultsPage`, `SchoolDetailsPage`, `NewsArticlePage`, `ServiceApplyPage`, `ComingSoonPage`) has a visible back/return control, and browser `popstate` is wired in `App.tsx` and `StudentDashboardV2.tsx`. | **Pass** |
| **Right to Browse Without Forced Login** | `/`, `/cbt`, `/cbt/setup/*`, `/cbt/practice` (guest mode), `/past-questions`, `/services`, `/services/*`, `/schools`, `/news`, `/events`, `/jobs`, `/screening-calculator`, `/search` work without forcing login. | **Pass** |
| **Right to Clear / Reset Filters** | `/schools`, `/news`, `/jobs`, `/services`, `/past-questions`, `/search` allow clearing search/category filters. | **Pass** |
| **Right to Honest Status (No Fake Data)** | Unconfigured environments fail closed on auth (`AuthPageV2`) and show honest empty/fallback states without fabricating student records or fake PDFs. | **Pass** |
| **Right to Safe Error Messages** | `userFacingError` in `lib/errors.ts` strips SQL, PostgREST, stack traces, and `[object Object]`. | **Pass** |
