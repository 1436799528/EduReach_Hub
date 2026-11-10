# FRONTEND INTEGRATION MAP

Status: **inspection + mapping** (Milestone 001). The frontend repository was
read only. No frontend file was modified, and no frontend build, deployment or
environment variable was touched.

This document answers one question: **what does the current frontend depend on,
and what must the new backend provide for it to keep working?**

---

## 1. How the frontend reaches a backend today

```
page/component
   ├─ src/lib/api.ts ──────────────► /api/*  ──(dev) tsx server.ts
   │                                        └─(prod) /.netlify/functions/api/*  (netlify.toml rewrite)
   ├─ src/lib/supabase.ts ─────────► Supabase PostgREST (RLS-gated)
   │                                └─ Supabase Auth (sign-in, session, reset)
   └─ src/lib/studentDashboard.ts ─► Supabase PostgREST + RPC
```

- **94 exported functions** in `src/lib/api.ts` call the Express API.
- **13 direct browser table reads** (`src/lib/api.ts`, `src/lib/studentDashboard.ts`)
  plus **2 RPCs** go straight to Supabase and bypass Express entirely:
  `profiles`, `institutions`, `student_notifications`, `student_saved_items`,
  `student_cgpa_courses`, `student_security_events`, `service_requests`,
  `service_catalog`, `cbt_attempts` (+ `cbt_bank_candidate_access` style RPCs).
- **6 auth operations** are called on the Supabase browser client:
  `signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`,
  `resetPasswordForEmail`, `updateUser`.
- Every authenticated request builds headers from the Supabase session
  (`authHeaders()` in `src/lib/api.ts`).

**Consequence for the rebuild:** the frontend cannot be pointed at the new
backend by changing a base URL alone. The 13 direct reads and the auth calls must
be redirected to new endpoints, and that is frontend work scheduled in a later
milestone (see §6).

---

## 2. Feature → current backend dependency

| Frontend feature | Pages / modules | Current dependency | New endpoint |
| --- | --- | --- | --- |
| Public home, news, opportunities | `HubHomePage`, `NewsPage`, `NewsArticlePage`, `OpportunitiesPage` | `/api/news`, `/api/opportunities`, direct Supabase reads | `GET /content/news`, `/content/opportunities` |
| Service catalogue | `ServicesCatalogPage`, `ServiceApplyPage` | `/api/services`, direct `service_catalog` read | `GET /catalogue/services` |
| Institution finder / details | `SchoolFinderPage`, `SchoolDetailsPage` | `/api/upcoming`, `/api/admin/institutions`, direct `institutions` + `ccmas_*` reads | `GET /catalogue/institutions` |
| Past questions / resources | `PastQuestionsPage`, `ExamHubPage` | `/api/past-questions/resources`, `/api/public/documents` | `GET /content/documents` |
| Student sign-up / sign-in / reset | `AuthPageV2`, `ProfileCompletionPage` | Supabase Auth | unchanged (option A) or `/auth/*` (option B) |
| Student session bootstrap | `ProtectedRoute`, `AuthProvider` | Supabase `getSession` + `/api/admin/session` (staff) | `GET /me` |
| Student profile edit | `ProfileCompletionPage`, dashboard | direct `profiles` update (RLS) | `PATCH /me/profile` |
| Student dashboard / progress | `StudentDashboardV2`, `src/lib/studentDashboard.ts` | direct reads: `cbt_attempts`, `student_saved_items`, `student_cgpa_courses`, `student_notifications`, `student_security_events`; `/api/cbt/attempts` | `GET /cbt/attempts`, `/me/notifications`, `/me/security-events` |
| CGPA calculator / saved courses | `CgpaCalculatorPage` | direct `student_cgpa_*` tables | `GET/PUT /me/cgpa` (new, to be specified) |
| Subject / exam configuration | `ExamSetupPage`, `CbtPracticeEntryPage` | `/api/cbt/exams`, `/api/cbt/exams/:id/subjects`, `/api/catalogue/subjects` | `GET /cbt/exams`, `GET /cbt/exams/:id/subjects` |
| Question retrieval (practice) | `CbtSessionPage` | `POST /api/cbt/exams/:id/attempts`, `GET /api/cbt/attempts/:id/paper` | same paths under `/cbt` |
| Guest practice | `CbtPage`, guest flow | `GET /api/cbt/exams/:id/guest-questions`, `POST /api/cbt/guest-submit` | `/practice/*` |
| Answer saving (v1) | `useCbtPageWriter`, `cbtAnswerQueue` | `PATCH /api/cbt/attempts/:id/draft` | same |
| Answer saving / writing (v2) | `useCbtPageWriter` (v2 branch), `cbtProtocolValidation`, `cbtReconciliation` | `POST …/session`, `PATCH …/answer`, `GET …/state`, `POST …/finalize` | `/cbt/v2/…` (unchanged vocabulary) |
| Submission and scoring | `CbtSessionPage`, `CbtResultsPage` | `POST /api/cbt/attempts/:id/submit` | same |
| Results and history | `CbtResultsPage`, dashboard | `GET /api/cbt/attempts/:id/result`, `/api/cbt/attempts`, `GET /api/cbt/attempts/:id/progress` | same |
| Attempt deletion / abandon | `CbtResultsPage`, session page | `DELETE /api/cbt/attempts/:id`, `POST …/abandon` | same |
| Admin login / console shell | `AdminLayout`, `AdminDashboardPage` | Supabase Auth + `/api/admin/session` | `GET /admin/session` |
| Admin CBT banks / questions | `AdminCbtPage` | `/api/admin/cbt/exams*`, `/api/admin/cbt/questions*` | same |
| Admin bank security | `AdminBankSecurityPage` | `/api/admin/cbt/banks*` (new routes) | same |
| Admin question import | `AdminQuestionImportPage` | `/api/admin/question-imports*` | `/admin/imports*` |
| Admin users | `AdminUsersPage` | `/api/admin/users*` | same |
| Admin service requests | `AdminQueuePage` | `/api/admin/service-requests*` | same |
| Admin news / newsroom | `AdminNewsPage` | `/api/admin/news*`, `/api/admin/newsroom/*` | same |
| Admin content manager | `AdminContentManagerPage` | `/api/admin/content-manager/*` | same |
| Admin site content | `AdminSitePage` | `/api/admin/site/*` | same |
| Admin media | `AdminPdfBankPage`, uploads | `/api/admin/uploads`, `/api/admin/pdf-bank*` | same |
| Analytics (student) | `trackEvent` | `/api/analytics/event` | `POST /analytics/events` (consent-gated) |
| SEO surfaces | crawlers | `/api/sitemap.xml`, `/api/robots.txt`, `/robots.txt`, `/sitemap.xml` | decision pending (§6) |
| Health banner | `ConnectionBanner` | `/api/health`, `/api/health/ready` | `/health`, `/health/ready` |

---

## 3. Function-by-function mapping of `src/lib/api.ts`

Grouped; each line is `current function → proposed endpoint`. Where the current
function calls the Express API, only the path changes.

**Public content**: `fetchNews`, `fetchNewsItem` → `GET /content/news[/:slug]`;
`fetchOpportunities`, `fetchOpportunity` → `GET /content/opportunities[/:id]`;
`fetchServices`, `fetchService` → `GET /catalogue/services[/:slug]`;
`fetchPublicPdfDocuments` → `GET /content/documents`;
`fetchPastQuestionResources` → `GET /content/documents?type=past-question`;
`fetchUpcoming` → `GET /content/upcoming`.

**Catalogue**: `fetchCbtExams`, `fetchCbtExamsWithAvailability`, `fetchCbtBank` →
`GET /cbt/exams`; `fetchCbtSubjectCatalog` → `GET /catalogue/subjects`.

**Student CBT**: `startConfiguredCbt` → `POST /cbt/exams/:id/attempts`;
`fetchCbtAttemptPaper` → `GET /cbt/attempts/:id/paper`;
`saveConfiguredCbtDraft` → `PATCH /cbt/attempts/:id/draft`;
`submitConfiguredCbt` → `POST /cbt/attempts/:id/submit`;
`abandonConfiguredCbt` → `POST /cbt/attempts/:id/abandon`;
`deleteCbtAttempt` → `DELETE /cbt/attempts/:id`;
`fetchCbtHistory` → `GET /cbt/attempts`;
`fetchCbtResult` → `GET /cbt/attempts/:id/result`;
v2: `fetchCbtV2State`, `openCbtV2WritingSession`, `sendCbtV2Operation` →
`/cbt/v2/attempts/:id/{state,session,answer,finalize}`.

**Service requests**: `submitServiceRequest` → `POST /service-requests`
(idempotency key preserved); (history via `/me/service-requests`).

**Account**: no function today (the pages use Supabase directly) → new
`GET /me`, `PATCH /me/profile`, `GET /me/notifications`.

**Admin**: all `fetchAdmin*`, `create*`, `update*`, `delete*`, `upload*`,
`route*`, `approve*`, `reject*`, `run*`, `commit*`, `classify*`, `assign*`,
`revoke*`, `setAdminBankRelease`, `searchAdminBankCandidates` map 1:1 to the
`/admin/*` table in `API-CONTRACT.md` §5, with the same method and body shape.

**Analytics**: `trackEvent` → `POST /analytics/events`.

**Direct Supabase calls that need new endpoints** (these have no HTTP route
today, so they are the real gap):

| Today (browser → Supabase) | New endpoint | Notes |
| --- | --- | --- |
| `profiles` select/update | `GET /me`, `PATCH /me/profile` | profile rows currently readable via RLS own-row policy |
| `institutions` select | `GET /catalogue/institutions` | public read |
| `student_notifications` select/update | `GET /me/notifications`, `POST /me/notifications/:id/read` | |
| `student_saved_items` | `GET/POST/DELETE /me/saved-items` (new, to be specified) | |
| `student_cgpa_courses`, `student_cgpa_terms` | `/me/cgpa` (new) | |
| `student_security_events` | `GET /me/security-events` | |
| `service_requests` select | `GET /me/service-requests` | |
| `service_catalog` select | `GET /catalogue/services` | already duplicated by the API |
| `cbt_attempts` select | `GET /cbt/attempts` | already duplicated by the API |
| `cbt_bank_candidate_access` RPC | `GET /cbt/exams/:id/access` | **not yet defined** — needs a contract decision |

---

## 4. Compatibility risks (must be resolved before implementation)

| # | Risk | Evidence | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Browser-direct Supabase reads** (13 tables + 2 RPCs) disappear when the new backend owns the database. | `src/lib/api.ts`, `src/lib/studentDashboard.ts` | Dashboard, notifications, CGPA, saved items break silently. | Add the `/me/*` endpoints **before** switching the base URL; keep the old path working during the transition. |
| 2 | **Auth provider coupling.** The frontend imports `@supabase/supabase-js` for sessions. | `src/lib/auth.tsx`, `src/lib/supabase.ts` | If auth moves, every page's `authHeaders()` must change. | Phase 1: keep Supabase Auth (option A). Phase 2: decide on migration. |
| 3 | **API base path** is hard-coded to `/.netlify/functions/api` in production. | `src/lib/apiBase.ts` | New host unreachable until this changes. | Introduce `VITE_API_BASE_URL` with the current value as default; one-file change. |
| 4 | **CBT v1/v2 shape.** `fetchCbtAttemptPaper` throws unless `protocol: {version:1}` is present; v2 validates exact keys. | `src/lib/api.ts` 1666–1752 | A "cleaner" response shape breaks every CBT screen. | Treat §7 of `API-CONTRACT.md` as frozen; contract tests generated from the client validators. |
| 5 | **Answer keying by position.** | `cbtAnswerQueue`, `useCbtPageWriter` | Re-keying to question ids breaks drafts and reconciliation. | Keep `position` as the wire key; `questionId` travels alongside for v2. |
| 6 | **`score: null` vs `0`.** | `CbtResultsPage`, `dashboardCbtStats` | Embargoed results could render as failures. | Contract test asserting `null` for embargoed rows. |
| 7 | **Guest 404-not-403.** | `server.ts` guest handlers | Existence leaks if the rebuild returns 403. | Contract test; explicit rule in the security suite. |
| 8 | **Multipart upload shape.** `/api/admin/uploads`, `/api/admin/pdf-bank/upload`, `/api/admin/question-imports` bypass the JSON body parser. | `server.ts` body-parser ordering | Upload endpoints break if re-mounted after `express.json()`. | Same ordering rule in the new app; test with real multipart. |
| 9 | **Idempotency semantics** for service requests and CBT operations already exist and are relied on. | `submit_service_request_idempotent`, `attempt_operations` | Duplicate submissions or lost answers. | Carry the same `operationKey`/`requestKey` contracts; test replay. |
| 10 | **SEO routes** `/sitemap.xml` and `/robots.txt` are served by the API function. | `netlify.toml` redirects | Crawlers get the SPA fallback. | Decide: generate statically in the frontend build, or serve from the backend with the same paths. |
| 11 | **Error `message` text is user-facing** and asserted in places; adding a `code` is additive but changing messages is not. | `jsonFetch` + `userFacingError` | UI copy regressions. | Keep messages; add `code` additively in v1. |
| 12 | **Rate-limit UI.** The client surfaces `429` with `Retry-After`. | `src/lib/failures.ts` | Silent failures. | Preserve headers and status. |
| 13 | **Capability names** are shared vocabulary in `src/lib/capabilities.ts`. | tests, admin nav | A renamed capability hides or exposes a menu. | Publish the capability enum as a generated type; test equality. |

---

## 5. Environment variables

Current contract (`src/lib/envContract.ts`), which stays valid for the frontend
during the transition:

| Variable | Visibility | Secret | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | client | no | Supabase URL (also read server-side) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (alias `VITE_SUPABASE_ANON_KEY`) | client | no | browser key |
| `SUPABASE_SERVICE_ROLE_KEY` (alias `SUPABASE_SECRET_KEY`) | server | **yes** | privileged access — old backend only |
| `NODE_ENV` | server | no | runtime mode |
| `EDUREACH_SITE_URL` | server | no | canonical origin (SEO, emails) |
| `EDUREACH_NEWSROOM_USER_AGENT` | server | no | ingestion identity |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | server | no | first-admin gate |
| `PORT` | server | no | local listen port |

Variables the **new** backend will need (proposal, not set anywhere yet):
`DATABASE_URL`, `DIRECT_DATABASE_URL` (migrations), `AUTH_JWKS_URL` (option A) or
`JWT_SECRET` (option B), `STORAGE_*` (endpoint, bucket, access key, secret),
`CORS_ALLOWED_ORIGINS`, `CRON_SECRET`, `SENTRY_DSN` (optional), `LOG_LEVEL`.
The frontend will gain exactly one: `VITE_API_BASE_URL`.

**No variable in any environment was read, changed or created by this milestone.**

---

## 6. Ordering recommendation for the frontend cutover

1. **Backend parity first.** Every function in §3 must return the same shape as
   today, verified by contract tests generated from the client's own validators.
2. **Add the missing endpoints** listed in §3's last table; deploy them on the
   new backend while the old one is still authoritative.
3. **Switch one feature at a time** behind a runtime flag, starting with
   read-only content, then CBT, then admin.
4. **Only after** CBT and admin are green on staging, remove the Supabase browser
   client and the `SUPABASE_SERVICE_ROLE_KEY` from the frontend deployment.
5. Keep the old backend running and switch back by flag until the new backend has
   passed staging (`BUILD-STATUS.md`).

---

## 7. What this milestone did to the frontend

Nothing. No file created, edited, moved or deleted in the frontend application
(`pages/`, `src/`, `tests/`, `scripts/`, `netlify/`, `vite.config.ts`,
`package.json`). The only additions are documentation files under `docs/`.
