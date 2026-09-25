# EduReach Hub — Public Release Audit & Systematic QA

**Date:** 25 September 2026  
**Branch:** `arena/01a0cae6-edureach-hub`  
**Scope:** architecture, routing, student-facing pages, service workflows, authentication, CBT, backend/API boundaries, RLS-sensitive paths, error states, Nigerian student UX, mobile/admin responsiveness and production readiness.

## Release decision

**Code gate: PASS after fixes.**  
**Deployment gate: PASS WITH DATA DEPENDENCY.**

No unresolved source-level `FAIL` remains in the reviewed runtime. A real release still depends on applying the latest Supabase migrations, configuring production credentials and completing one authenticated staging click-through with real rows. The unconfigured local preview is deliberately not treated as equivalent to production persistence.

### Status meanings

- **PASS** — the route or workflow is implemented and internally consistent in the current branch.
- **PASS WITH DATA DEPENDENCY** — the UI and boundary are ready, but live content, Supabase Auth/RLS, production question banks, news, institutions or external services must be configured.
- **CONTROLLED COMING SOON** — the route is intentionally resolved to an honest unavailable state; it does not pretend that a missing catalogue or data source exists.
- **FAIL** — a release-blocking broken, misleading or unsafe implementation. None remain after the fixes recorded below.

## 1. Current branch inventory

| Area | Runtime source | Audit result |
|---|---|---|
| App entry and route transitions | `src/main.tsx`, `src/app/App.tsx` | Central SPA resolver, history interception, hash scrolling, page titles, Suspense and error boundary present — **PASS** |
| Route inventory | `src/app/routes.tsx` | Public, auth, dashboard, CBT, service, news, opportunities and admin paths are centralized — **PASS** |
| API/server | `server.ts`, `middleware.ts`, `lib/auth.ts` | Same-origin Express API, protected admin/user operations and production static fallback — **PASS** |
| Client data boundary | `src/lib/api.ts`, `src/lib/supabase.ts` | Supabase mode and explicitly labelled local-preview mode are separate — **PASS WITH DATA DEPENDENCY** |
| Student data | `src/data/`, `supabase/migrations/` | Maintainable catalogues; no exhaustive fabricated school/document/past-question claim — **PASS WITH DATA DEPENDENCY** |
| Shared visual system | `src/components/`, `src/edu-portal.css`, `src/admin.css`, `src/student-dashboard.css` | Exam/service/content identity classes, readable card sizing and mobile strips are shared — **PASS** |
| Release documentation | `README.md`, `docs/ROUTES.md`, this report | Route and tracking language reconciled with the dashboard-only tracking decision — **PASS** |

The earlier dirty workspace was preserved; no reset, branch switch or stash deletion was performed. The current branch remains `arena/01a0cae6-edureach-hub`.

## 2. Route and page inventory

### Public and student-facing routes

| Route / family | Classification | QA finding |
|---|---|---|
| `/` | **PASS WITH DATA DEPENDENCY** | Home search, CBT simulator cards, service links, featured/latest/trending news, upcoming events and grants/tools entry points are present. News and event panels have loading, retry and honest empty states. |
| `/search?q=...` | **PASS** | Searches configured services, exam banks, CBT records, materials, news and opportunities; results identify the match, link directly to the intended destination and scroll/highlight the first result. |
| `/services` | **PASS WITH DATA DEPENDENCY** | Fallback catalogue is exactly the four supported workflows; configured Supabase rows are filtered to the same supported set. Search and no-match states are handled. |
| `/services/apply/:slug`, `/nelfund`, `/results` | **PASS WITH DATA DEPENDENCY** | Four live service forms use maintainable institution options, Nigerian phone validation, step review, safe guidance, reference confirmation and dashboard hand-off. Production submissions require Auth; local preview persists in browser scope. |
| Unsupported `/services/*` and `/services/apply/*` slugs | **CONTROLLED COMING SOON** | Planned/active-but-unsupported catalogue rows cannot fall through to the NELFUND form. The client and public API now share the four-live-service boundary. |
| `/cbt` | **PASS WITH DATA DEPENDENCY** | Live exams load from configured rows; local preview has the maintained practice banks. Exam filters, loading/retry and empty states are present. Cards go directly to exam-specific setup. |
| `/cbt/setup/jamb`, `/waec`, `/neco`, `/post-utme` | **PASS** | Maintained course/subject/school catalogues, duplicate prevention and official-brochure reminders are present. Setup links go directly to the timed hall. |
| `/cbt/practice` | **PASS WITH DATA DEPENDENCY** | Timed exam bar, server-backed attempt ownership/scoring, question palette, keyboard controls, flags, auto-submit, IndexedDB progress and scientific on-screen calculator are present. Production question delivery requires Auth; answer keys are not delivered before submission. |
| `/cbt/results`, `/dashboard/cbt/results/*` | **PASS WITH DATA DEPENDENCY** | Local scorecards and authenticated owned production results have separate paths. Production result RPC is owner/submission constrained. Missing/invalid results show a recovery state. |
| `/past-questions` | **PASS WITH DATA DEPENDENCY** | Visible CBT-practice and PDF/DOC/material modes. Material coverage is configured and limited; each source is anchored to `https://www.scribd.com/home`, `Get now` opens WhatsApp, and CBT links render only when `cbtHref` is configured. |
| `/screening-calculator` | **PASS** | Input ranges, school-method profiles, formula transparency and official-notice reminders prevent the estimate from being presented as an admission decision. |
| `/news`, `/news/:slug` | **PASS WITH DATA DEPENDENCY** | Category filtering, loading/retry/empty states and full article presentation with title, body, author and date are present. The student article does not show a “Published” status. Source/image URLs are scheme-checked before rendering. |
| `/jobs`, `/scholarships` | **PASS WITH DATA DEPENDENCY** | Opportunities and grants are a first-class route/nav/footer destination. The current configured list is small and the Scholarships & Grants filter has an honest verified-unavailable/notify state rather than invented listings. |
| `/events` | **PASS WITH DATA DEPENDENCY** | Dedicated route exists with configured/empty handling; no unsupported event coverage is fabricated. |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | **PASS WITH DATA DEPENDENCY** | Validation, safe `next` paths, password recovery, email verification resend, local-preview disclosure and Supabase Auth handling are present. |
| `/profile`, `/profile/complete`, `/settings` | **PASS WITH DATA DEPENDENCY** | Protected route, maintained Nigerian academic options, profile persistence, security/password/MFA states and local-preview limitations are present. |
| `/dashboard`, `/dashboard/services`, `/dashboard/cbt`, `/dashboard/tools` | **PASS WITH DATA DEPENDENCY** | Dashboard remains limited to Overview, My Requests, My CBT, Tools & Saved and Account. CGPA and School Finder remain in Tools; no wallet or Course Finder UI remains. Requests and CBT history are owner-scoped in production. |
| `/services/track`, `/track` | **PASS** | These are protected compatibility aliases to `/dashboard/services`, not public reference lookups. The retired standalone tracker component and public lookup client path were removed. |

### Controlled unavailable and not-found routes

| Route / family | Classification | Expected behavior |
|---|---|---|
| `/nabteb` | **CONTROLLED COMING SOON** | Clearly says the centre is not launched and points to active preparation/noticeboard areas. |
| `/admission`, `/admission/*`, `/schools` | **CONTROLLED COMING SOON** | No invented school or admission coverage; calculator and verified updates remain available. |
| `/tools`, `/tools/*`, `/support` | **CONTROLLED COMING SOON** | No fake tool/support result; active services and noticeboard remain available. |
| Unknown route | **PASS** | Branded 404 with direct home, CBT and services recovery links. |

### Admin routes

`/admin`, `/admin/analytics`, `/admin/queue`, `/admin/cbt`, `/admin/news` and `/admin/users` are **PASS WITH DATA DEPENDENCY**. They are role-gated through the server `requireAdmin` boundary, retain explicit loading/error/empty states, and the admin mobile layout now keeps account/session controls available instead of hiding logout on narrow screens. Scratch-card/voucher UI and routes remain retired.

## 3. End-to-end workflow checks

| Workflow | Classification | Result |
|---|---|---|
| Home → exam simulator → exam setup → timed hall → scorecard | **PASS WITH DATA DEPENDENCY** | Direct setup destinations, timer, calculator, flags, keyboard navigation, auto-submit and result recovery are wired. Live Supabase exams/questions require configured data and Auth. |
| Services → guided form → review → submit → reference → My Requests | **PASS WITH DATA DEPENDENCY** | Four supported service keys, populated institution catalogue, form validation, production Auth/RLS insert and dashboard status path are wired. Local mode is browser-scoped only. |
| Search → identified result → direct page/scroll target | **PASS** | Search is a content finder, not a blind redirect. Services, library and search results target the first matching element. |
| News list → complete article → source/share/recovery | **PASS WITH DATA DEPENDENCY** | Article metadata/body, safe source handling, copy-link error handling and not-found recovery are present. |
| Opportunities/grants → configured listing or honest notify state → WhatsApp | **PASS WITH DATA DEPENDENCY** | No fabricated scholarship result is emitted. WhatsApp is an external dependency. |
| Sign up/sign in → protected route → profile/dashboard → sign out | **PASS WITH DATA DEPENDENCY** | Supabase is authoritative in production; local preview intentionally uses browser-scoped records and visibly labels the session. |
| Admin sign in → server role check → queue/CBT/news/user operations | **PASS WITH DATA DEPENDENCY** | Server role check remains authoritative; a profile-role fallback is only used when the local API is unreachable and still requires a connected authenticated account with an explicit admin role. |

## 4. Security and backend boundary findings fixed in this pass

1. **Unsupported direct service application:** `fetchService()` and `submitServiceRequest()` now reject any key outside `nelfund-loan`, `results`, `jamb-slip` and `admission-letters`. The public Express service endpoints apply the same allowlist. This prevents an active future catalogue row from rendering the wrong form variant.
2. **Public CBT question API:** `GET /api/cbt/exams/:examId/questions` now requires a bearer session. The response still contains question text/options only; correct options remain server-side. The Supabase table/RPC hardening remains in place.
3. **Request privacy:** the old public-by-reference tracker component and client function were removed. `/services/track` and `/track` are protected dashboard aliases. Migration `20260925_public_release_security_hardening.sql` revokes the legacy `get_public_service_request(text)` RPC for anon/authenticated roles.
4. **Dashboard RLS gap:** the same migration adds `service_requests_read_own`, so the authenticated My Requests query can read only rows where `user_id = auth.uid()`.
5. **Profile completion permission gap:** the migration restores authenticated update permission for `session` and `matric_number` after the later column-level grant, while preserving staff-controlled `role` boundaries; it also adds an own-profile select policy.
6. **Dropped Course Finder:** the latest migration deactivates the older seeded `course-finder` row so a stale database seed cannot advertise a data-less tool.
7. **API fallthrough:** unknown `/api/*` methods/paths now return JSON 404 instead of the SPA HTML shell.
8. **News URL safety:** admin news create/update accepts only HTTPS or site-relative image/source URLs; article rendering repeats the guard for existing rows.
9. **Security headers:** Netlify and Express now send content-type, referrer, frame, permissions and CSP protections. The CSP allows the intentionally used Supabase, Google Fonts and HTTPS image dependencies.
10. **Mobile admin control:** narrow admin layouts retain email/logout/student-view controls.
11. **Security Advisor RLS findings:** the release migration now makes the intentional browser-deny boundary explicit for `exam_questions` and, when present, `site_analytics_events` and `admin_content_versions`. These tables remain server/RPC-only; the policies do not grant client access.
12. **SECURITY DEFINER review:** the release migration pins the known SECURITY DEFINER routines to an empty `search_path` when they exist, while retaining their existing intended grants. Live verification must still confirm the routine definitions, owners and `EXECUTE` privileges after migration.
13. **Leaked-password protection:** this is a Supabase Auth dashboard setting, not a repository migration. It remains a launch prerequisite and must be enabled under Authentication → Password Security. The exact SQL and dashboard verification steps are recorded in `docs/SUPABASE_SECURITY_CHECKLIST.md`.

## 5. Data, privacy and production dependency assessment

- Supabase mode is the production path: Auth, RLS, service catalog, service requests, CBT attempt/question/result functions, institutions, saved items, CGPA snapshots and news require the configured project and current migrations.
- Local preview mode is useful for QA only. It scopes profile, service request, CBT progress/result and saved-item records by the entered email where applicable; it is not an identity provider and does not provide production-grade security.
- Service request form data can contain phone, candidate and institution details. It is not exposed through a public reference lookup after the hardening migration; the authenticated dashboard reads only the owner’s rows and staff reads use protected admin APIs.
- Materials, official portal instructions, NELFUND/JAMB/examination-body requirements, school screening formulas and external WhatsApp/Scribd content remain external/data dependencies. Copy consistently tells the student to confirm the current official notice.
- News body is rendered as React text rather than HTML, and article source/image links are restricted to safe URL schemes.

## 6. Validation evidence

Completed on the current workspace after the release fixes; the lint/build/diff checks and the production/dev smoke checks were rerun after the final HTTPS/site-relative URL guard edit:

- `npm run lint` — **PASS** (`tsc --noEmit`).
- `npm run build` — **PASS** (Vite client plus bundled Express server; code-split route chunks generated).
- `git diff --check` — **PASS**.
- Scientific calculator engine assertions (`2+3*4`, `2^3^2`, `sin(30)`, `2(3+1)`, `-2^2`, `sqrt(9)`, `15%`) — **PASS**.
- Static asset reference scan for `/icons/*` and `/news/photos/*` — **0 missing references**.
- Preliminary static navigation/action scan — **107** literal local navigation references, no unmatched references under the route-prefix heuristic, **107** button tags with click/submit behavior, and no `href="#"`, TODO/FIXME or lorem-ipsum placeholders. This is a heuristic and does not replace browser testing.
- Development server smoke checks — `/`, `/search?q=JAMB`, `/past-questions?view=materials`, `/services`, `/jobs`, `/news`, `/cbt`, `/screening-calculator`, `/dashboard`, `/admin`, `/services/apply/unknown` and `/services/apply/nelfund-loan` returned SPA **200** responses.
- Development API smoke checks — `/api/health` **200**, unauthenticated `/api/admin/session` **401**, unauthenticated `POST /api/cbt/submit` **401**, unsupported `/api/services/course-finder` **404**, unknown `/api/not-real` **404 JSON**.
- Production-mode smoke server from the generated `dist/server.cjs` — SPA deep links **200**, health **200**, unknown API **404 JSON**, and security headers present.

A real browser click-through was not available because the sandbox Chromium dependency is unavailable. Manual staging QA is therefore a release prerequisite, not a claimed completed test.

## 7. Release checklist still required outside this sandbox

1. Apply all migrations through `20260925_public_release_security_hardening.sql` to the production Supabase project; verify the own-request/profile permissions with a real student account and verify an admin cannot be demoted through the client.
2. Review the live Supabase Security Advisor after migration: confirm `admin_content_versions`, `exam_questions` and `site_analytics_events` are intentionally server/RPC-only, confirm no unexpected browser grants exist, and review all SECURITY DEFINER owners, `search_path` settings and `EXECUTE` privileges.
3. Enable Supabase Auth leaked-password protection under Authentication → Password Security, then verify password reset, email verification, MFA controls and redirect URLs.
4. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY`; configure Supabase Auth redirect URLs for the production origin.
5. Seed/verify at least one active CBT exam with questions, institution rows, published news rows with author/date/source policy and any live opportunities intended for launch. Empty states are correct if those feeds remain empty.
6. Run an authenticated staging click-through at mobile and desktop widths: registration/verification, profile save, each of the four service submissions, request visibility, CBT start/submit/result ownership, password/MFA controls, admin queue/news/CBT operations and sign-out.
7. Verify Netlify environment variables, SPA/API redirects, `_headers`, service worker cache behavior and external WhatsApp/Scribd/official portal destinations on the final production hostname.

**Final audit classification:** the branch is suitable for a production-oriented staging pass. It should not be represented as a fully live release until the data/configuration checklist above is complete.
