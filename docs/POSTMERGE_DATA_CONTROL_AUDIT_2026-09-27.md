# EduReach Hub — Post-Merge Correction & Data Control Audit

**Date:** 27 September 2026
**Branch:** `arena/01a0dd46-edureach-hub` (cut from `main` @ `cdc811f` “Merge Admin control centre release”)
**Scope:** full post-release audit of the **Admin Control Centre → Supabase → Public Website** chain, executed against the “Post-Merge Correction & Data Control Brief”.

---

## 1. Release decision

**Code gate: PASS** (lint + build green, local smoke tests pass).
**Data gate: PASS WITH DEPLOY DEPENDENCY** — the release must apply migration
`20260927000000_postmerge_data_control.sql` to the live project (it removes the
prototype news rows, deactivates the demo CBT bank, purges any Scribd URLs and
adds the `featured`/`tags` news columns the new code selects).

No mock/demo production content was added anywhere in this pass. Where data does
not exist, the site shows a professional empty state.

---

## 2. NEWS source trace (Brief §1, §20)

Every news card on the live site was traced to its exact source:

| Surface | Component | Source | Verdict |
|---|---|---|---|
| `/news` listing + Featured | `NewsPage` → `fetchNews()` | Supabase `news_articles` (`published = true`, ordered `published_at desc`) | Real DB rows only |
| Homepage “Featured Updates”, “Latest Educational News”, “Trending” | `HubHomePage` → same `fetchNews()` | Same Supabase table — no separate homepage dataset | Same source of truth |
| `/news/:slug` article | `NewsArticlePage` → `fetchNewsItem()` | Same table, single published row | Same source of truth |
| Search results (news) | `SearchPage` → same `fetchNews()` | Same table | Same source of truth |
| **Seeded prototype rows** | `20260915_application_integration_seed.sql` inserted `jamb-update`, `admission-watch`, `funding-alerts` with `published = true` and bodies saying “This is seeded prototype content…” | **These were the mock items visible on the live News page** | **Removed** by `20260927000000_postmerge_data_control.sql` |
| Dead `newsItems` array | `src/data/hubContent.ts` (5 fabricated “guide” stories, never imported) | obsolete mock content | **Deleted** |

There is no `staticNews`/fallback news dataset anywhere; without a configured
backend `fetchNews()` returns `[]` and every surface renders an honest empty
state (“No news content available yet…”).

### News is now a real CMS (Brief §1, §15, §21)

Admin → Newsroom CMS supports: create, save draft, edit, publish, unpublish,
delete, publication date (datetime picker), source/organisation, source URL,
per-article featured image upload (Supabase Storage `admin-content` bucket, URL
stored on the row, preview shown in the editor), rich-text body, preview modal,
feature/unfeature (leads the public Featured block), category (shared category
list below), tags, and DB-driven ordering by publication date.

Publishing passes a quality gate (§21): meaningful title (≥15 chars), excerpt,
substantive body, valid category, valid source URL format — refused otherwise.
Drafts only require a title so work is never lost.

### Categories (Brief §2)

`src/data/newsCategories.ts` is the single source of truth: JAMB & UTME, WAEC,
NECO, NABTEB, Admissions, Universities, Polytechnics, Colleges of Education,
Scholarships & Funding, NELFUND, Post-UTME, School Updates, Examination Updates,
Academic Calendar, General Education — plus legacy-alias mapping so older rows
(`campus`, `funding`, `admission`, …) keep rendering and filtering correctly.
The Admin editor select and the public filter pills both consume this module.

### Unique news images (Brief §3)

The old behaviour — `newsThumbFor(category)` silently recycling 5 bundled stock
photos across every article — is removed. Articles render their own uploaded
image; articles with no image (or broken media) render an intentional neutral
placeholder that never masquerades as article photography. The bundled photos
remain only as static site/banner assets, never as per-article fallbacks.

---

## 3. Scribd removal (Brief §10)

Repository-wide search for `scribd` before this pass found live usage in:

- `src/data/examPreparation.ts` — `SCRIBD_HOME_URL` + `sourceUrl` on every material record → **removed**.
- `pages/PastQuestionsPage.tsx` — Scribd link + “browse Scribd” note → **removed**.
- `pages/SearchPage.tsx` — “browse Scribd” result copy → **removed**.
- Docs references → updated.

Migration `20260927000000_postmerge_data_control.sql` additionally nulls any
Scribd URL stored in live Supabase-backed content records (`news_articles.image_url/source_url`,
`service_catalog.application_url`, `opportunities.link_url`, `institutions.website_url`).
After this pass `grep -ri scribd src pages server.ts supabase/migrations/2026092700*` finds
only the purge migration itself.

---

## 4. Past Questions — first-party flow (Brief §11, §6)

- **CBT tab is now database-driven**: cards map 1:1 to active `cbt_exams` rows
  managed in Admin → CBT Manager. Card → `/cbt/setup/<body>?exam=<id>` → subject
  setup → timed hall starting **that exam's** pool. (The static
  `pastQuestionLibrary` renders only in an unconfigured local preview and is
  documented as such.)
- **Materials tab**: no third-party links remain. A configured CBT route is the
  primary card destination; material without an available bank shows EduReach's
  own request channel (WhatsApp helpline) — the proper EduReach
  unavailable/request state, keeping the user inside EduReach.
- Question/exam content management never requires source-code edits: exams,
  durations, active state, questions, options, answer keys, explanations,
  marks and positions are all CRUD-managed in Admin → CBT Manager.

---

## 5. CBT changes (Brief §7, §8, §9)

| Requirement | Implementation |
|---|---|
| No duration on cards | `/cbt` cards and homepage simulator cards no longer show minutes; cards show exam body • subject • title • description |
| Default duration data-driven | `cbt_exams.duration_minutes` is the only source; setup page shows “Default time: N minutes” from the resolved exam (no hard-coded per-page times) |
| Duration choice | Setup page offers durations up to the configured default (min 15); chosen value is passed to the practice hall; signed-in attempts keep the server-enforced expiry (single source of truth) |
| Timer only in session | Countdown starts in the CBT hall after the attempt starts |
| JAMB English integration | Setup/card flows now resolve the **concrete exam id**: explicit `?exam=` deep links win; otherwise the active JAMB exam whose subject contains “English” is preferred, so starting JAMB with Use of English retrieves the approved English pool from `exam_questions`. Admin attaches approved questions in CBT Manager; nothing is invented or rewritten |
| Whole cards clickable | `/cbt` bank cards, past-question cards, material cards are single anchor targets with styled-span CTAs (no nested interactive elements) |

Admin CBT Manager additionally gained: edit exam configuration (title, body,
subject, description, default duration, active state), activate/deactivate, and
delete (blocked with a clear error when student attempts exist, to protect
result history).

---

## 6. Admin console architecture (Brief §13, §14)

- The admin shell (sidebar, top bar, identity, health pill) now mounts **once**
  for all `/admin` routes (`App.tsx` wraps admin routes in a persistent
  `AdminShell`); internal navigation swaps only the keyed content area inside
  `<main>`.
- A module-scoped session cache (15 min TTL) with silent background revalidation
  means the full-page “Verifying administrative access…” screen appears only on
  cold entry with no known session; a cached session renders instantly and is
  revalidated quietly, tearing down only if the server rejects it. Logout clears
  the cache.
- Pages keep their own skeletons/table skeletons for lightweight page-level
  loading.

---

## 7. Whole-card interactivity (Brief §12)

| Card | Before | After |
|---|---|---|
| News row / featured / trending | already anchors | unchanged (single target) |
| Service cards | already whole-card anchors | unchanged |
| CBT question-bank cards | div + tiny “Set up test” link | whole card is the anchor |
| Past-question CBT cards | article + button | whole card is the anchor |
| Material cards | article + two anchors (nested) | whole card is one anchor (CBT route or EduReach request) |
| School finder results | button-only | whole card is the anchor |
| Opportunity cards (live + preview) | div + Apply link | whole card is the anchor |
| Exam simulator cards / link tiles | anchors | unchanged |

No nested interactive elements remain in these cards, so there is no double
navigation or focus-order ambiguity.

---

## 8. Data-source matrix (Brief §5, §17)

| Public Feature | Public route(s) | Source table / API | Admin surface | CRUD | Notes |
|---|---|---|---|---|---|
| News | `/news`, `/`, `/news/:slug`, `/search` | `news_articles` | Admin → Newsroom CMS | Full (+ feature, tags, pub-date, image upload) | P0 done |
| Events / noticeboard | `/events`, `/` | `edureach_deadlines`, `edureach_exams` via `GET /api/upcoming` | Admin → Events & Key Dates | Full | Homepage + Events page share the feed |
| Opportunities | `/jobs` | `opportunities` via `GET /api/opportunities` | Admin → Scholarships & Opportunities | Full | Static preview list only when unconfigured (labelled) |
| Services catalogue | `/services`, home strip | `service_catalog` | Admin → Service Catalogue | Full for link/route services; the 4 built-in form services are protected from deletion (deactivate instead) | Categories/order DB-driven |
| Service workflows | `/services/apply/*` | `service_requests` (+ `service_catalog`) | Admin → Service Queue | Status workflow + notes | 4 live form services (code-defined forms — documented system config) |
| Schools | `/schools`, `/schools/:slug` | `institutions` | Admin → Schools & Institutions | Full | Directory only; programme/fee/cutoff data intentionally not fabricated |
| CBT exams | `/cbt`, `/cbt/setup/*`, `/cbt/practice`, `/past-questions` | `cbt_exams` | Admin → CBT Manager | Full (create/edit/activate/delete) | P0 done |
| CBT questions | practice hall | `exam_questions` | Admin → CBT Manager | Full | Approved content only; licensing rules apply |
| CBT attempts/results | `/cbt/results*`, dashboard | `cbt_attempts`, `cbt_answers` | read via dashboard/analytics | n/a (student-owned records) | Attempts block exam deletion |
| Users | dashboard, profiles | `profiles`, Supabase Auth | Admin → Student Accounts | Suspend/unsuspend + activity view | Role checks server-side |
| Analytics | admin only | `site_analytics_events` (+ `admin_activity_breakdown`) | Admin → Analytics & Reports | Read-only | Real telemetry only; empty = empty |
| Student notes (materials) | dashboard tools | `edureach_material_notes` | n/a — student-owned by design | n/a | Documented non-section |
| JAMB/WAEC/NECO course+subject wizard, Post-UTME school list, screening formulas | setup/calculator pages | code-owned product configuration (`src/data/examPreparation.ts`) | documented system-owned config | n/a | Setup pages carry an official-brochure reminder; not editable data |
| Homepage composition / nav | `/` | code-owned components | documented system-owned config | n/a | Content blocks all read the tables above |

Everything displaying real data now has Admin CRUD or a documented
system-owned configuration; no public page depends on data an administrator
cannot maintain.

---

## 9. Mock/fallback scan classification (Brief §19)

Repository-wide scan for `mock`, `dummy`, `demo`, `sample`, `placeholder`,
`fallback`, `staticNews`, `scribd`, `lorem`, hard-coded news/CBT/service/school
arrays. Results:

| Item | Classification | Action |
|---|---|---|
| Seeded prototype news rows (3) | **obsolete prototype content in production** | Deleted by migration |
| `newsItems` array in `hubContent.ts` | **obsolete mock code** | Deleted |
| Seeded “EduReach General Practice Demo” exam | prototype content | Deactivated by migration (inspectable/removable in CBT Manager) |
| `fallbackCbtExams` + `practiceQuestions` in `api.ts` | legitimate development fallback | Kept; documented “never rendered when Supabase is configured” |
| `jobs` static list in `hubContent.ts` | legitimate development fallback | Kept; only renders unconfigured, labelled “preview”, never mixed with live rows |
| `fallbackServicesCatalog` (4 form services) in `api.ts` | legitimate development fallback | Kept (product configuration of which forms exist) |
| `fallbackUpcomingItems = []` | legitimate fallback (empty) | Kept |
| `pastQuestionLibrary`, `studyMaterialLibrary`, `postUtmeSchools`, `jambCourses`, subject catalogs, screening formulas | documented system-owned product configuration | Kept; CBT tab now DB-driven in production |
| `services.ts` / `serviceGuides.ts` form definitions | system-owned product configuration | Kept |
| `studentOptions.ts` (dashboard school/course pickers) | system-owned product configuration | Kept |
| Skeleton/placeholder UI copy (“Loading…”, empty states) | legitimate UI | Kept |
| `edureach_material_notes` | student-owned data | Unchanged |
| Scribd references | obsolete dependency | Removed from code; purge migration for DB rows |

No fake users, statistics, activity, results, engagement or “latest” stories
exist or were introduced.

---

## 10. E2E verification checklist (Brief §22)

Items marked **LOCAL** were exercised in this workspace (unconfigured mode:
honest empty states, routing, admin shell behaviour, build). Items marked
**LIVE** require the production Supabase project and must be re-run after
applying the migration.

### News
- [LIVE] Admin creates real article → row in `news_articles` → image uploaded to Storage → publish → appears on `/news`, homepage Latest/Featured, search → whole card opens article → edit → public updates → unpublish → disappears.
- [LOCAL] Empty-state rendering with zero articles; legacy `?category=admission` links still resolve.

### Services
- [LIVE] Admin creates link/route service → appears on `/services` with category → whole card clickable → correct destination.

### CBT
- [LIVE] Admin configures exam + duration + question pool (incl. approved JAMB English questions) → `/cbt` card shows NO duration → setup page shows “Default time: N minutes” → student may choose ≤ default → hall starts with the correct pool; JAMB + Use of English resolves the English pool.
- [LOCAL] Cards/setup/hall flow in preview mode; no durations on cards.

### Past Questions
- [LIVE] Admin adds exam/questions → appears on `/past-questions` CBT tab → setup → start; no Scribd anywhere; whole cards clickable.
- [LOCAL] Materials tab renders EduReach request state; no third-party links.

### Schools / Events / Opportunities
- [LIVE] Admin CRUD in each section reflects on School Finder, `/events` + homepage noticeboard, `/jobs` respectively.

---

## 11. Deploy checklist

1. Apply `supabase/migrations/20260927000000_postmerge_data_control.sql` (prototype news removal, demo exam deactivation, Scribd URL purge, `featured`/`tags` columns + index).
2. Deploy the frontend/server bundle (Netlify function wraps the same `server.ts`).
3. Smoke: `/news` shows an honest empty state (or real articles), `/cbt` cards have no durations, `/past-questions` has no Scribd, `/admin` navigates without re-verification screens.
4. Publish the first real articles through the Newsroom CMS.
