# EduReach Hub — Full Audit, 21 Sep 2026

Method: scripted checks (link resolution, asset existence, API coverage,
button/form handler scan) plus targeted code review. All counts were produced
by script, not estimated.

## 1. Links & routes — PASS

- **37 static internal hrefs resolve, 0 dead.** 9 dynamic (template) hrefs
  (`/news/:slug`, `/services/apply/:key`, `/cbt/practice?exam=`,
  `/dashboard/cbt/results?attempt=`, `/services/track?ref=`, wa.me) all map
  to live route prefixes.
- Canonical discipline: content links use `/cbt`, `/jobs`, `/services/track`,
  `/screening-calculator`, `/login`, `/register`. Legacy aliases
  (`/past-questions`, `/scholarships`, `/track`, `/calculator`, `/signin`,
  `/signup`, `/events`) still route correctly for bookmarks.
- No `TODO` / `FIXME` / `lorem` anywhere in `src` or `pages`.

### Page inventory

Live: `/`, `/cbt` (+`?mode=` filter), `/cbt/practice`, `/cbt/results`,
`/dashboard/cbt/results`, `/screening-calculator`, `/services`,
`/services/track`, `/services/apply/:slug` (5 live workflows), `/nelfund`,
`/results`, `/news`, `/news/:slug`, `/jobs`, `/jamb`, `/waec`, `/neco`,
`/post-utme`, auth (signin/signup/forgot/reset/verify), `/profile`,
`/dashboard` + 10 tabs, `/admin` + 6 sections.
Honest stubs (real panel, working back-links, never 404): `/nabteb`,
`/schools`, `/support`, `/admission*`, `/tools*`, non-live service slugs.
Honest 404 (`NotFoundPage`) with Home/CBT/Services links.

## 2. Icons & cards — PASS (after this batch's fixes)

- 13 image refs in code, **0 missing on disk**.
- **All 32 cartoon SVGs deleted.** Remaining imagery: 5 real exam-body marks,
  5 real news photos, 1 rebranded crimson ER app tile.
- Identity system: brand-named cards show real official marks; every other
  live card/service/tool/role resolves to a specific Lucide glyph + label —
  the generic fallback is unreachable for known values.
- Overlap/distortion fixed: height-driven mark images (wide logos letterbox,
  never squash), labels truncate, mini-tiles icon-only, sim-grid logos
  `object-fit:contain`, banner art converted to photo tile.
- Post-UTME uses the real JAMB mark: no universal Post-UTME logo exists
  (each university runs its own screening); Post-UTME is the JAMB admission
  pipeline, distinguished by POST-UTME/SCREENING labelling.

## 3. Client ↔ API coverage — PASS

17 distinct client `/api/*` paths, 28 server routes, **0 uncovered**.
Admin news CRUD (`GET/POST/PATCH/DELETE /api/admin/news`) added with
slug management and audit logging.

## 4. Buttons & forms — PASS

- 0 dead buttons (2 flags were implicit submits inside `onSubmit` forms).
- Every `<form>` has an `onSubmit` handler.
- Return navigation: global `PageBar` (Back/Home) on all public pages
  except home; local back-links on article/tracker/soon/404 pages;
  admin student-preview banner with return-to-admin.

## 5. Admin portal — IN PLACE (needs backend session)

Operations dashboard, analytics, service queue (status workflow),
CBT question bank, scratch-card inventory (audited PIN reveal),
student accounts, **newsroom CMS** (write/edit/publish/delete + cover
preview). All mutations are admin-gated server-side.

## 6. Auth — IN PLACE

Signin/signup/forgot/reset/verify with canonical URL sync (recovery
tokens + `?next=` preserved), working resend, show/hide on all password
fields, local offline fallback when Supabase is unconfigured.

## 7. PWA / meta — PASS

Title, description, viewport, crimson theme-color, favicon, manifest
(PWA tile rebranded to crimson ER, shortcuts to CBT + tracker).

## 8. NOT IN PLACE (gaps, ordered)

1. **Live backend config.** Admin CRUD, newsroom persistence, CBT engine,
   vouchers, profiles and the news feed run on local fallbacks until
   Supabase env + migrations are applied in production. Nothing fabricates
   data; features degrade honestly.
2. **Stub sections await real content:** NABTEB hub, School Finder,
   Student Support, `/admission/*`, `/tools/*`, and service slugs beyond
   the 5 live workflows.
3. **Payments:** `/api/payments/*` + wallet-verify endpoints exist; Paystack
   keys and end-to-end checkout must be verified in staging.
4. **No automated test suite.** Verification is currently `tsc` + `vite
   build` + HTTP checks. Recommend adding at least the link/asset/API
   scripts from this audit as CI checks.
5. **Events:** `/events` aliases `/news`; no dedicated events feed yet.
6. **Imagery depth:** 5 shared news photos + per-article `image_url` support;
   add per-story photos in the newsroom as stories grow.
