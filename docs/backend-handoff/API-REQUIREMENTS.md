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
