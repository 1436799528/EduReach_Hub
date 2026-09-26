# EduReach Hub — Full Audit (26 September 2026)

**Date:** 26 September 2026
**Branch:** `arena/01a0dcd9-edureach-hub` (cut from `main` @ `e9b113f`)
**Scope:** post-release verification of the squashed `main`, the "Require real Supabase registration and sign-in" change, backend/migration dependency coverage, security boundaries, functional smoke checks, and repo/GitHub state.

## Release decision

**Code gate: PASS after this pass's fixes.**
**Deployment gate: PASS WITH DATA DEPENDENCY — one new P1 caution.**

The application code, build, routing, API boundaries and auth fail-closed behavior are release-ready. The one significant finding is that **the Supabase migration history cannot recreate parts of the backend that the running server depends on** (`admin_dashboard_metrics`, `admin_bootstrap_first_admin`, `edureach_audit_logs`, `edureach_deadlines`, `edureach_exams`, plus the never-migrated base tables). A guarded backfill migration for the server-owned objects is included in this pass; the live project must still be verified after applying it.

## 1. Where we are (repo & GitHub state)

| Item | State |
|---|---|
| `main` | Single squashed commit `e9b113f` "Require real Supabase registration and sign-in" (history was squashed; CI ran both predecessor commits today: "Remove fake local authentication sessions", then the current head) |
| CI (`EduReach production checks`) | **Green** on `main` (run 36227462985: lint + build, 24s) |
| Open PRs | None. PR #4 "Release EduReach Hub production-ready changes" merged 2026-09-25 |
| Working tree | Clean before this pass; this audit adds fixes on `arena/01a0dcd9-edureach-hub` |
| Since `FULL_AUDIT_2026-09-25.md` | Auth no longer creates or accepts local preview sessions: registration/sign-in throw an honest error until live Supabase is configured; the client session resolver returns real Supabase sessions only |

## 2. Verification evidence (run in this workspace)

- `npm ci` — **PASS** (Node 22.22.3, npm 10.9.8).
- `npm run lint` (`tsc --noEmit`) — **PASS**, re-run **PASS** after fixes.
- `npm run build` — **PASS** (Vite client + bundled `dist/server.cjs`; stable react/supabase vendor chunks), re-run **PASS** after fixes.
- Dev-server deep links — `/`, `/services`, `/schools`, `/schools/university-of-lagos`, `/profile`, `/past-questions`, `/jobs`, `/cbt`, `/cbt/setup/jamb`, `/cbt/practice`, `/news`, `/events`, `/dashboard`, `/admin`, `/admin/analytics`, `/nabteb`, `/login`, `/register`, `/verify-email`, unknown route — all **SPA 200**.
- Production-mode smoke from `dist/server.cjs` (no Supabase env) — same deep links **200**, health **200**, `/api/admin/session` **401**, unknown `/api/not-real` **404 JSON**, CSP header present.
- API boundary checks (unconfigured mode) — `/api/admin/session` **401**, `/api/admin/analytics` **401**, `POST /api/admin/bootstrap` without Supabase **503** ("not configured", fail-closed), `/api/cbt/exams/foo/questions` **404**, `/api/services/course-finder` **404** (allowlist holds), `/api/upcoming` **200 `{items:[]}`**, unknown API **404 JSON**.
- Security headers — CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` present on both page and API responses; `public/_headers` matches the Express set.
- Static asset scan for `/icons/*` and `/news/photos/*` — **0 missing references**.
- Static source scan — no `href="#"`, TODO/FIXME or lorem-ipsum placeholders in application source.
- Scientific calculator engine assertions (`2+3*4`, `2^3^2`, `sin(30)`, `2(3+1)`, `-2^2`, `sqrt(9)`, `15%`) — **7/7 PASS**.
- Guest CBT boundary re-verified in source: `guest-questions` selects question text/options only (no `correct_option`); scoring happens server-side in `guest-submit`; answers validated as integers 0–3; correct answers are revealed only in the post-submission payload (accepted answer-review behavior).
- Analytics endpoint — event names restricted to the allowlist, all inputs length-capped, silently 204 when unconfigured.
- Netlify guard — `server.ts` only calls `app.listen` when `NETLIFY` is unset, so the serverless function import is safe; Dockerfile runs as `node`, builds from `npm ci`.

## 3. Findings and fixes in this pass

### F1 (HIGH — fixed): migration history does not create server-owned backend objects

Cross-checking every table/RPC the server and client touch against `supabase/migrations/`:

| Dependency | Used by | Created by any migration? |
|---|---|---|
| `cbt_exams`, `cbt_attempts`, `cbt_answers`, `exam_questions`, `news_articles`, `admin_audit_logs`, `edureach_material_notes`, `payment_events`, `student_*` tables | server/client | **Yes** |
| RPCs `get_cbt_questions`, `get_cbt_result`, `start_cbt_attempt`, `submit_cbt_attempt`, `admin_audit_log` | server/client | **Yes** |
| RPC `admin_dashboard_metrics()` | `GET /api/admin/analytics` | **No — missing** |
| RPC `admin_bootstrap_first_admin(uuid, text)` | `POST /api/admin/bootstrap` (documented first-admin flow) | **No — missing** |
| Table `edureach_audit_logs` | analytics audit feed read | **No — missing** |
| Tables `edureach_deadlines`, `edureach_exams` | `GET /api/upcoming` (home noticeboard feed) | **No — missing** |
| Base tables `profiles`, `service_requests`, `service_catalog`, `institutions`, `site_analytics_events` | server/client everywhere | **No — only ALTER/RLS statements exist; the `CREATE TABLE` statements are not in the repo** |

Consequences if migrations are applied to a fresh/rebuilt project: admin analytics 503s, the documented first-admin bootstrap 500s, and the home "upcoming deadlines/exams" feed 503s. On the current live project these objects evidently exist out-of-band, which is why staging worked — but the repo cannot reproduce its own backend.

**Fix in this pass:** `supabase/migrations/20260926000000_backfill_missing_server_dependencies.sql`
- Creates `edureach_audit_logs`, `edureach_deadlines`, `edureach_exams` **only if absent**, with the exact columns the APIs select; RLS enabled with **no client policies** (browser-deny), explicit `service_role` grants.
- Creates `admin_dashboard_metrics()` **only when missing** (`to_regprocedure` guard), `SECURITY DEFINER`, empty `search_path`, every table reference wrapped in `to_regclass` guards, returning exactly the keys `AdminAnalyticsPage` renders (`users`, `admins`, `service_requests`, `pending_requests`, `completed_requests`, `rejected_requests`, `events_24h`, `sessions_24h`, `events_7d`, `cbt_attempts`, `cbt_submitted`, `average_cbt_score`, `institutions`, `active_services`, `published_news`, `audit_events`).
- Creates `admin_bootstrap_first_admin(uuid, text)` **only when missing**, locked semantics: returns false if any staff/admin role already exists, otherwise promotes the target profile to `super_admin`; execute granted to `service_role` only. The server keeps its own gates (configured email match + valid bearer session) ahead of the RPC.

Because every statement is guarded, applying this on the live project (which already has these objects) must be a no-op; on a fresh project it produces working versions. **Still required:** apply and verify on the live project, and generate a full baseline-schema dump (`supabase db dump`) so the base tables (`profiles`, `service_requests`, `service_catalog`, `institutions`, `site_analytics_events` and their column sets) finally live in version control. That baseline is the remaining reproducibility gap and is deliberately not guessed in this pass.

### F2 (MEDIUM — fixed): audit-trail table mismatch in admin analytics

`/api/admin/analytics` read `edureach_audit_logs`, while the `admin_audit_log` RPC (the only writer in the repo) writes `admin_audit_logs` — audit events recorded through the app could never appear in the analytics feed on a repo-consistent database. **Fix:** the endpoint now reads both tables tolerantly (missing table ⇒ contributes nothing), merges and sorts by `created_at`, and returns the same response shape.

### F3 (LOW — fixed): dead local-auth remnants in `src/lib/auth.tsx`

After "Remove fake local authentication sessions", `readLocalUser()`/`readStoredProfile()` and the `localPreview` imports became unreachable dead code (nothing writes `edureach-local-user-email` any more; `resolveCurrentUser()` returns Supabase sessions or `null`). **Fix:** removed. `user.isLocal` stays in the type and page-level guards as a defensive always-false check.

### F4 (LOW — fixed): stale verify-mode copy

`/verify-email` still said "This local preview account is ready on this device…", which contradicts the new fail-closed auth. **Fix:** replaced with honest copy — email verification needs the live account service; none is configured in the current environment.

### Observations (no action required this pass)

- `.env.production.example` contains the real Supabase **project URL** with a placeholder key. The URL is public-by-design in browser code; acceptable, but rotate the project URL if it is considered sensitive.
- CI checks lint + build only; there is no automated migration-drift check. Once the baseline dump lands, a CI job applying migrations to a scratch Postgres would close the F1 class of bug permanently.
- Guest CBT submit reveals correct answers only after submission — consistent with the intended answer-review UX; no pre-submit leak found.
- `middleware.ts` `requireAdmin` and `lib/auth.ts` `verifyJWT` are unchanged and correct: role resolution is server-side from `profiles`, admin check via `verifyAdminToken`.

## 4. Route/page inventory

No routes were added, removed or re-scoped since `FULL_AUDIT_2026-09-25.md`. All classifications there carry forward unchanged (**PASS** / **PASS WITH DATA DEPENDENCY** / **CONTROLLED COMING SOON** as documented). This pass re-verified the SPA fallback (all sampled deep links 200), the branded 404, the protected-route redirect chain (`/dashboard`, `/profile`, `/settings`, `/services/track`, `/track`), and that registration/sign-in now fail closed with explicit messages until live Supabase is configured.

## 5. Updated release checklist (delta from 2026-09-25)

1. Apply `20260926000000_backfill_missing_server_dependencies.sql` to the live project and confirm it reports no unintended changes; re-test `/api/admin/analytics`, `/api/upcoming` and the bootstrap flow with `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` set.
2. Generate and commit a baseline schema dump from the live project so the five base tables (and any other out-of-band objects) enter version control (F1 residual).
3. Verify on the live project after migration: Security Advisor clean, SECURITY DEFINER owners/`search_path`/`EXECUTE` privileges intact, leaked-password protection enabled, Auth redirect URLs set.
4. Run the authenticated staging click-through from the 09-25 checklist (registration → verification → profile → four service submissions → CBT ownership → admin queue/news/CBT → sign-out) at mobile and desktop widths.
5. Confirm Netlify env vars (`SUPABASE_SECRET_KEY`, `EDUREACH_ADMIN_BOOTSTRAP_EMAIL`, optional WhatsApp) and `_headers`/SPA behavior on the production hostname.

**Final classification:** the branch is code-complete and audit-clean after the fixes above; the remaining work is data/configuration on the live Supabase project plus the staging click-through. It should not be represented as a fully live release until items 1–5 are done.
