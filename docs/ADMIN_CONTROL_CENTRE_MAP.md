# Admin Control Centre — Database Map & Implementation Status (2026-09-26)

Per the agreed order: **audit DB → map sections → fix backend/API/RLS → CMS/editor → analytics → UI → test**.
This document is the phase-1/2 record: every Admin management area mapped to its real Supabase
tables, its main-site consumer, and its CRUD status. Sections whose tables do not exist are
documented as gaps, not invented.

## 1. Section → table → consumer map

| Admin area | Supabase table(s) | Main-site consumer | CRUD before | CRUD now (this pass) |
|---|---|---|---|---|
| News / announcements | `news_articles` | `/news`, `/news/:slug`, home noticeboard | create/edit/delete/publish via server API (plain text body) | + rich-text body (sanitised HTML), featured image upload to Storage, drafts filter, preview, publish date, typed delete confirm |
| Events & key dates | `edureach_deadlines`, `edureach_exams` | `/events` via `/api/upcoming`, home feed | **none** (tables were even missing from migrations) | full CRUD via new `/api/admin/calendar-items` |
| Schools / institutions | `institutions` (existed out-of-band; CREATE was absent from repo) | `/schools`, `/schools/:slug` (SchoolFinder reads `id,school_name,acronym,state,institution_type,website_url`) | **none** | full CRUD via new `/api/admin/institutions` |
| Service catalogue | `service_catalog` (full table: forms, in-app routes, external links) | `/services` (whole catalogue), `/services/apply/:slug` (form keys only) | read-only → four-key edit | **full CRUD** via `/api/admin/services`: create, edit (title/description/link/route/category/sort/visibility), reorder, show/hide, delete. The four built-in application-form services are protected from deletion (their forms ship with code) but are otherwise fully manageable. Public `/api/services` returns every active row in admin-controlled order; /services category pills derive from the data |
| Service requests (operations) | `service_requests` | student dashboard "My Requests" | list + status transitions | + persistent `admin_note` column, editable from the queue |
| CBT exams / questions | `cbt_exams`, `exam_questions` | `/cbt`, `/cbt/setup/*`, `/cbt/practice`, results | full CRUD via server API (unchanged) | — |
| CBT attempts / results | `cbt_attempts`, `cbt_answers`, `get_cbt_result` RPC | `/cbt/results`, dashboard | counts only (metrics RPC) | counts + per-exam attempt popularity from telemetry |
| Students / users | `profiles` + Supabase Auth + `service_requests` + `cbt_attempts` | `/profile`, dashboards | read/search only | + suspend/unsuspend (real Auth ban via service role), profile-completion indicator, per-student activity drill-down (latest 20 requests + 20 CBT attempts, owner-scoped queries) via `/api/admin/users/:id/activity` |
| Traffic & focus analytics | `site_analytics_events` | internal only | one-way `page_view` inserts | + missing emitters wired (`service_view`, `service_submit`, `cbt_start`, `cbt_submit`, `search`), `admin_activity_breakdown()` RPC, Overview/Analytics rendering |
| Admin audit trail | `admin_audit_logs` (canonical), `edureach_audit_logs` (legacy) | internal | write-only (never rendered) | rendered in Overview + Analytics timelines |
| Content images | Supabase Storage bucket `admin-content` (created by migration, public read) | news/featured images | **none** | upload endpoint `POST /api/admin/uploads` (admin bearer + service role, ≤2 MB, mime-allowlisted) |

| Scholarships / grants / jobs | `opportunities` (migration 20260926220000) | `/jobs` (live when Supabase configured) | none → **full CRUD** via `/api/admin/opportunities` + Admin "Scholarships & Opportunities" page with the rich-text editor; the static directory on /jobs renders only in unconfigured local preview and never mixes with live rows |

## 1b. Fallback content policy (tightened 2026-09-26)

- **News:** the fabricated fallback dataset (photos, authors, full article bodies) was **deleted**. Without a configured backend, news pages show their honest empty state; with one configured, `news_articles` is the only source students read.
- **Services:** the only remaining fallback is the code-defined definition of the four application-form services in unconfigured local preview — product configuration (which forms exist), not content, matching rule 13 ("static configuration belongs in code").
- **Opportunities:** static directory only when no backend is configured; live and static rows are never mixed.
- **Events:** descriptions render sanitized rich HTML authored in the admin editor; plain text remains supported.

## 2. Deliberate non-sections (no invented management UI)

| Area | Why it is not an Admin section |
|---|---|
| Faculties / departments / programmes / courses | No such tables exist; school detail data is part of the maintained static catalogue. Inventing four CRUD screens over non-existent tables would violate the source-of-truth rule. |
| Past-question PDFs | First-party only since 2026-09-27 (Scribd removed): CBT banks are admin-managed in the CBT Manager (`cbt_exams`/`exam_questions`); material cards without a configured bank route to EduReach's own request channel, never a third-party platform (see `docs/DATA_SOURCES.md`). `edureach_material_notes` is student-owned, not staff content. |
| Site settings / nav visibility / homepage content | No `site_settings` table exists; homepage composition is code-owned (component rules). Static configuration belongs in code per the source-of-truth rule. |
| AI content tools | Explicitly out of scope: the CMS is human-controlled. |

## 3. Backend changes in this pass (migration `20260926200000_admin_control_centre_backend.sql`)

1. Guarded `CREATE TABLE public.site_analytics_events` (was referenced by code/RLS migrations but never created in-repo) — server-only: RLS enabled, no client policies.
2. Guarded `CREATE TABLE public.institutions` with exactly the columns the site consumes — public read (anon/authenticated), service-role writes.
3. `alter table service_requests add column if not exists admin_note text`.
4. `admin_activity_breakdown()` SECURITY DEFINER RPC (empty `search_path`, service-role execute only): top pages, top searches, service views/submits, CBT starts by exam over the last 14 days — computed in SQL, never manufactured client-side.
5. Storage bucket `admin-content` (public read) with idempotent bucket insert + policy guards.

All admin writes continue to flow through the Express server with `requireAdmin` (Supabase Auth token → server-side role check → service-role key). RLS is never bypassed from the browser; the browser only ever holds the publishable key.

## 4. Live vs historical

- **Live now** (Overview top): queue counts, recent requests/users/audit — refreshed every 60 s and on manual refresh.
- **Historical focus (14 days)**: telemetry breakdowns labelled as such.
- Supabase Realtime subscriptions are a documented follow-up (requires enabling realtime on tables + RLS review); the dashboard is honest near-real-time, not claimed live-push.

## 5. Staging verification checklist (requires the live project)

For each of News, Events, Schools, Services, Requests, Users:
1. Create in Admin → verify row in Supabase → verify on main site.
2. Edit in Admin → verify Supabase + main site.
3. Delete/archive in Admin → verify removal/archiving and main-site fallback.
4. Upload an image in News → verify object in `admin-content` and public URL renders.
5. Suspend a test account → verify sign-in blocked → unsuspend.
6. Create a catalogue row with a route (e.g. `/schools`) → verify the card appears on /services and routes correctly → hide it → verify it disappears.
7. Publish an opportunity → verify it on /jobs with a configured backend → hide it → verify removal.
8. Confirm the news page shows NO fabricated articles on a configured project (empty until you publish).
