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
