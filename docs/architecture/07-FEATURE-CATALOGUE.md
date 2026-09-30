# 07 — Feature Catalogue, Dependencies and Build Order

Status legend: ✅ built · 🟡 partial · 🔴 specified, not built · ⚪ out of scope.

## Delivered product surface (Phase 0–8 of the build order)

| ID | Feature | Where | Status | Notes |
|---|---|---|---|---|
| AUTH-1 | Sign up, sign in, verification, password recovery, session persistence | `pages/AuthPageV2.tsx`, `src/app/ProtectedRoute.tsx`, `src/lib/auth.tsx` | ✅ | Supabase Auth; fail-closed when unconfigured |
| AUTH-2 | Account suspension | `/api/admin/users/:id/ban`, `/unban` | ✅ | Server-side, audit-logged |
| PROF-1 | Academic profile (institution, faculty, department, level, matric) | `pages/ProfileCompletionPage.tsx`, `profiles` | ✅ | Collects only what services and personalisation use |
| DASH-1 | Student workspace with four tabs | `pages/StudentDashboardV2.tsx` | ✅ | Overview, My Requests, My CBT, Tools & Saved |
| NEWS-1 | Public news feed and article page | `/news`, `/news/:slug`, `src/lib/api.ts` | ✅ | Provenance + freshness surfaced |
| NEWS-2 | Newsroom CMS | `/admin/news`, `AdminRichTextEditor` | ✅ | Drafts, preview, quality gate, image upload |
| NEWS-3 | Ingestion pipeline + review queue | `src/server/newsroom/*`, `AdminNewsroomQueue` | ✅ | PR #11: discovery → dedupe → gate → publish/queue |
| NEWS-4 | Provenance, freshness and expiry | migration `20260930120000`, `expire_stale_news()` | ✅ | Expired content leaves the feed, stays linkable |
| OPP-1 | Opportunities catalogue + admin | `/jobs`, `/admin/opportunities` | ✅ | Categories, deadlines, active flag |
| OPP-2 | Deadline enforcement | `close_expired_opportunities()` | ✅ | Past-deadline rows retire automatically |
| INST-1 | Institution directory + detail | `/schools`, `/schools/:slug` | ✅ | NUC-sourced; no fabricated programmes/fees |
| INST-2 | Institution admin | `/admin/schools` | ✅ | — |
| SVC-1 | Service catalogue + service pages | `/services`, `/services/:slug` | ✅ | Live slugs only; others show coming-soon |
| SVC-2 | Application wizard with validation | `/services/apply/:slug` | ✅ | 4 live services |
| SVC-3 | Request tracking (authenticated) | `/dashboard/services` | ✅ | Owner-scoped; no public reference lookup |
| SVC-4 | Processing queue, statuses, notes, audit | `/admin/queue`, `/api/admin/service-requests/*` | ✅ | Status vocabulary enforced by constraint |
| CBT-1 | Exam selection, setup, subject-aware papers | `/cbt`, `/cbt/setup/:exam` | ✅ | English 60 / others 40, alias normalisation |
| CBT-2 | Attempt engine with resume and server scoring | `/cbt/practice`, `start_/submit_cbt_attempt_for_subjects` | ✅ | Answer keys server-only |
| CBT-3 | Guest practice with server scoring | `/api/cbt/guest-submit` | ✅ | Rate-limited |
| CBT-4 | Results and result slip | `/cbt/results`, `CbtResultSlip` | ✅ | Guest scorecard + saved attempts |
| CBT-5 | Exam and question-bank admin | `/admin/cbt` | ✅ | Content management only; bank population is operational |
| TOOL-1 | Screening calculator | `/screening-calculator` | ✅ | Client-side, documented formula |
| TOOL-2 | CGPA calculator with saved terms | `/tools/cgpa-calculator`, `student_cgpa_*` | ✅ | Saved per student |
| SRCH-1 | Cross-entity search | `/search` | 🟡 | Covers services/updates/etc. from loaded datasets; not yet a server-side index |
| SAVE-1 | Saved items | `student_saved_items`, dashboard tab | 🟡 | `item_type` predates the opportunities model (see SA-3) |
| NOTF-1 | In-app notification store + display | `student_notifications`, dashboard | ✅ | Service-request status triggers land in the dashboard card (NTF-1); deadline reminders still need a preferences model |
| AN-1 | Product analytics | `/api/analytics/event`, `site_analytics_events` | 🟡 | Six event names; no retention policy; taxonomy incomplete |
| ADMIN-1 | Console: dashboard, analytics, users, content, catalogue, data control | `/admin/*` | ✅ | Desktop-first |
| ADMIN-2 | Bulk data import/export | `/admin/content-manager` | ✅ | Row-level validation, 2,000-row cap |
| OPS-1 | Durable rate limiting | `lib/rate-limit.ts`, `check_rate_limit` | ✅ | PR #11 |
| OPS-2 | Readiness and dependency health | `/api/health/ready` | ✅ | PR #11 |
| OPS-3 | Content integrity report | `content_integrity_report()`, `/api/admin/integrity` | ✅ | PR #11 |
| OPS-4 | Newsroom operations runbook | `docs/NEWSROOM_PIPELINE.md`, CLI | ✅ | `newsroom:run|check|integrity` |

## Open work, dependency-ordered

| ID | Feature | Why it is next | Depends on | Status | Size |
|---|---|---|---|---|---|
| **BASE-1** ✅ | Reproducible baseline schema (`profiles`, `service_catalog`, `service_requests` + the objects the history assumed) | **Delivered:** baseline migration so a fresh project applies end to end, signup-trigger and institutions-column repairs, `npm run schema:audit` + 12 tests, two idempotent renames (`docs/features/BASE-1.md`) | — | 🔴 | S |
| **BASE-1b** | RLS posture for the six tables the repository defines no policy for (`courses`, `resources`, `campus_post_comments`, `campus_post_likes`, `student_wallets`, `edureach_notifications`) | A baseline may not guess a security boundary; the audit names them and production's state is still unknown | BASE-1 | 🟡 | S |
| **ROLE-1** ✅ | Capability layer (role split deferred) | **Delivered:** `resource.action` capabilities enforced on every privileged endpoint, ownership-aware `can()`, capability-aware console, role-assignment endpoint, retired half-roles, migration + 17 tests (`docs/features/ROLE-1.md`). Remaining: assign the narrower roles to real accounts | — | 🔴 | S |
| **SEO-1** ✅ | Sitemap, robots, per-route canonical, Open Graph, structured data | **Delivered:** server-driven sitemap + `X-Robots-Tag` matrix, canonical aliases, JSON-LD (`docs/features/SEO-1.md`, commit `7c56830`) | — | 🔴 | M |
| **NTF-1** ✅ | Notification triggers: service status change, deadline approaching | **Delivered (status half):** one notification per real status transition, rendered on the student dashboard. Deadline reminders need a per-student tracking/preferences model and stay with SA-3 (`docs/features/NTF-1.md`) | ROLE-1 (service admin role) | 🔴 | M |
| **SA-3** | Align saved items with `opportunities` (add `opportunity` item type + save affordance) | Students cannot currently save an opportunity from its own surface | — | 🟡 | S |
| **AN-1** | Analytics taxonomy: full event set, documented payloads, retention policy | Product decisions are being made on six events; also a privacy requirement | — | 🟡 | M |
| **INT-1** | CBT bank validation gate + population runbook | The engine is strong; the content is the product | Content/editorial work | 🟡 | L (operational) |
| **INT-2** | Opportunity verification workflow (`last_verified_at` maintenance) | Fresh data is the product promise | — | 🟡 | S |
| **INT-3** | Institution enrichment from verified sources | Students want programmes/cutoffs/fees, which must be sourced, not invented | Data sourcing | 🔴 | L |
| **SRCH-2** | Server-side search (full-text or indexed) | Client-side datasets will not scale with the newsroom running daily | AN-1 optional | 🔴 | M |
| **PRIV-1** | Privacy policy, terms, disclaimer/independence statement pages | Required before scale; also a trust feature | — | 🔴 | S |
| **PRIV-2** | Data export/deletion, analytics retention, cookie/analytics notice | Nigerian data-protection compliance | PRIV-1 | 🔴 | M |
| **UPL-1** | Upload hardening review (MIME/extension/size, SVG policy, orphan cleanup) | Admin uploads exist; the current validation depth must be confirmed and tightened | — | 🟡 | S |
| **A11Y-1** | Accessibility verification pass (keyboard, screen reader, contrast, CBT-specific) | Responsive testing is not accessibility testing | — | 🔴 | M |
| **PERF-1** | Core Web Vitals measurement on production | Performance is assumed, not measured | Deployment decision D5 | 🔴 | M |
| **OBS-1** | Scheduled-run monitoring and alerting | A daily job that fails silently is worse than no job | Deployment decision D5 | 🟡 | S |
| **TEST-1** ✅ | CI quality gate: prove the full gate actually runs (typecheck, tests, schema audit, build, E2E) plus a real PostgreSQL migration replay | **Delivered:** `npm run ci` is the authoritative gate, the workflow runs each stage as a named step, and a `migration-replay` job applies every migration to a scratch PostgreSQL and verifies the objects the application uses (`docs/features/TEST-1.md`) | — | 🔴 | M |
| **PAY-1** | Fee model, terms, refunds — only if monetisation is agreed | Payments schema exists with no product | D2 decision | ⚪ | — |

## Dependency graph (next three features)

```
BASE-1 (baseline schema) ✅
   └── ROLE-1 (capabilities + roles)
          └── NTF-1 (service notifications)
                 └── AN-1 (notification + funnel events)

SEO-1 (independent)
SA-3  (independent)
```

## Recommended next feature

**Delivered:** SEO-1 (2026-09-30, commit `7c56830`), ROLE-1 (2026-09-30,
capability layer), NTF-1 (2026-09-30, service status notifications), BASE-1
(2026-09-30, reproducible baseline schema) and TEST-1 (2026-09-30, CI quality
gate with a real PostgreSQL migration replay). Each was documented in
`docs/features/` before its code, as the process requires. **The next feature is
unselected** — the highest-value candidates are BASE-1b (RLS posture for the six
tables with no policy), AN-1 (analytics taxonomy) and A11Y-1/PERF-1.

Whichever is chosen is implemented alone, end to end, and documented with
`08-FEATURE-TEMPLATE.md` before code is written — including its routes, data,
backend rules, states, edge cases, analytics, notifications and tests.
