# EduReach Hub — Verification Audit (2026-10-21)

Branch `arena/91fa7d16-edureach-hub` @ `1d17302` (matches stated merged baseline; working tree clean at start).
Node v22.22.3 (`.nvmrc` 22.22, engines >=22.12 ✓), npm 10.9.8. `node_modules` was absent; `npm ci` exit 0 (environment blocker resolved locally, no package changes).

## Commands run (exit status)
| Command | Result |
|---|---|
| `git status -sb`, `git log --oneline -3` | clean, `1d17302` |
| `npm ci --ignore-scripts` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm test` (node:test, 626 tests) | 0 — 625 pass, 1 skipped, 0 fail (~89s) |
| Playwright e2e | Not run in stage 1 (no Supabase creds/browsers verified); recorded Blocked, not a defect |

No secrets printed; no production writes/migrations/deployments performed.

## 1. Confirmed defects (source-established)
| ID | Pri | Finding | Evidence | Fix / migration |
|---|---|---|---|---|
| F-CGPA-01 | P1 | CGPA calculator is 5.0-only; no 4.0 scale. Page even hardcodes "Nigerian 5.0-scale". | `pages/CgpaCalculatorPage.tsx:17`, `src/components/dashboard/CgpaCalculatorCard.tsx:91` ("5.0 scale"), `src/lib/studentDashboard.ts:56` single `gradePoints {A:5…F:0}`, `:80 calculateCgpa` | Add scale-aware `calculateCgpa(courses, scale)`; documented tables below. **No migration**: `student_cgpa_terms` has no scale column, so 4.0 snapshots stay local (labelled as such), 5.0 authenticated saves unchanged — silently writing 4.0 values into a 5.0 record would corrupt data. |
| F-PQ-01 | P1 | `/past-questions` defaults to a duplicate interactive "CBT practice" tab duplicating `/cbt/setup/*` simulators. | `pages/PastQuestionsPage.tsx:20,57` (`view:'CBT'` default), tablist `:236-243`, CBT grid `:274-304` | Remove CBT tab/view; page becomes Past Questions & Study Materials (published documents + request state). Simulator routes, `AdminCbtPage`, question-import untouched. No migration. |
| F-NEWS-01 | P2 | Visible category-pill selector (requested: compact dropdown); search is single-substring `includes(needle)` — word-order/punctuation queries ("slip jamb", "JAMB?") fail, unlike site search. | `pages/NewsPage.tsx:113` FilterPills, `:76-83` substring filter; contrast `src/lib/searchMatch.ts:34 matchesSearch` (tokenised, already in repo) | `<select>` dropdown; reuse `matchesSearch` over title/summary/source/category label/tags. No AI dep, no migration. |
| F-CBT-01 | P2 | Student-facing subject cards advertise internal bank counts ("40 questions in the bank") — prohibited. | `pages/ExamSetupPage.tsx:685` `` `${entry.questionCount} in bank` `` | Show "Available"/"Not in this bank" only; planned paper allocation (`in your paper Qx–Qy`) retained — that is the student's own paper, not bank inventory. No migration. |
| F-DASH-01 | P2 | No top-right notification control/badge in dashboard header; notifications only reachable by scrolling Overview. Mark-all-read + unread dot *do* work in the card. | `pages/StudentDashboardV2.tsx:978-1013` header has brand/search/profile only; notifications card `:757-791`; `markAllNotificationsRead :368` | Bell button in header, crimson `#B14933` badge only when unread>0, click → Overview notifications section (destination pattern; panel not required). No migration. |

## 2. Likely / needs live reproduction
- L-01 (P2) NewsArticle is single-column capped ~800px (`src/edu-portal.css:249 .hub-article{max-width:800px}`), related news stacks below — desktop width under-used. Improvement, needs visual check; related-aside only ≥wide breakpoints.
- L-02 (P2) End-Test vs Submit in `CbtSessionPage.tsx` are distinct with confirm dialogs (`:26-27,448,544,668`) — no defect established from source; overlap at mobile widths needs browser reproduction (Blocked: no creds).
- L-03 UNICAL services (GSS/EDC, fees, PIN recovery, course registration) are **not live**: no such slugs in `src/data/serviceGuides.ts` (only nelfund/results/jamb-slip/admission-letters) or `liveServices.ts`; other institutions correctly fall to ComingSoon (`routes.tsx:62`). Requested improvement, not a defect. Do NOT advertise as live without a workflow; "request support" must reuse `service_requests` (trackable) — owner decision needed on copy/fees (unverified fees must not be invented).

## 3. Requested improvements (not defects)
News article two-column layout (L-01); UNICAL service guides (L-03, needs owner-verified fees/steps); admin UI polish — existing `AdminLayout/AdminKit` + role guards confirmed present, no rebuild justified.

## 4. Retain unchanged (verified good)
- Tokens: `--er-primary:#174A3A`, `--er-crimson:#B14933` in `src/styles/theme.css:15,73`, matching `docs/COLOR_THEME_SPEC.md`. Homepage/MySchool cards untouched.
- CBT rules are already correct & server-aligned: JAMB Use of English compulsory & non-removable, English removable for WAEC/NECO/Post-UTME (`src/lib/cbt-config.ts:150-158`, `pages/ExamSetupPage.tsx:357-360`); WAEC/NECO/etc Science/Commercial/Arts group filter (`ExamSetupPage:641`); shortfall messages name exact missing counts (`cbt-config.ts:238-258,452`); mock spec 180q/60+40 (`:170-182`). **English conflict resolved**: product request "English preselected but removable in mock" must NOT apply to JAMB — existing behaviour already matches the documented rule; removable only for non-JAMB. No ambiguity remains except Post-UTME school-specific rules (owner to confirm per-school).
- News admin workflow, rich text, source/verification fields present (`AdminNewsPage`, `AdminRichTextEditor`, `AdminNewsroomQueue`); article page shows source + `last_verified_at` + related (`NewsArticlePage.tsx:53,180-224`).
- Notifications data model + server writer (`src/server/notifications.ts`), RLS migrations incl. `20260903_restrict_notification_creation_to_staff.sql`; dashboard only updates own (user-scoped fetch in `studentDashboard.ts`).
- Routes: dashboard/personal-profile(`/profile`)/academic content are distinct (`routes.tsx:107-127`); dashboard has left sidebar desktop + bottom nav mobile + home link (`StudentDashboardV2:978,1015,1038`). "Academic Profile" label at `:574` links `/profile` (ProfileCompletionPage) — label vs target ambiguity noted P3, not changed without owner call.

## 5. Environment blockers
No Supabase credentials in sandbox → live RLS, upload/storage, auth, submission-retry and Playwright flows unverified (Blocked, not defects). Owner must run `npm run rls:audit`/e2e against staging.

## 6. Security/data-integrity
No new risks found in inspected paths; public past-question API returns only published resources (`PastQuestionsPage:99`, empty state honest). CGPA 4.0 local-only snapshotting (F-CGPA-01) prevents scale-mixing in `student_cgpa_terms`.

## CGPA grading tables used for F-CGPA-01 (documented, institution-variable)
- **5.0 (existing, unchanged):** A=5,B=4,C=3,D=2,E=1,F=0; First ≥4.50, 2:1 ≥3.50, 2:2 ≥2.40, Third ≥1.50.
- **4.0 (new):** A=4,B=3,C=2,D=1,F=0 (no E grade offered; a legacy E row remaps to F on scale switch). Classification: First ≥3.50, 2:1 ≥3.00, 2:2 ≥2.00, Third ≥1.00 — labelled an estimate; institutions vary. Result is never presented as an official transcript.
Regression tests: `tests/cgpa.test.ts` (4.0 must not use 5.0 points; classification boundaries; empty input).

---

# Session 2 addendum (2026-10-21, continuation)

Previous session's 9 files were present and preserved; diffs reviewed before editing. No reset/revert/commit/push/deploy.

## Task 1 — Prior fixes re-verified
CGPA 4.0/5.0 (`calculateCgpa(courses, scale)`, `tests/cgpa.test.ts` 4/4), past-questions CBT tab removed (legacy `?view=cbt` returns 200 and is ignored), news dropdown + `matchesSearch`, no bank counts in ExamSetup, dashboard Bell + crimson badge only when unread>0. JAMB English compulsory/non-removable untouched. 4.0 snapshots remain local-only; no migration.

## Task 2 — News article layout (L-01 → confirmed from source, fixed)
Evidence: `.hub-article{width:min(100%,800px)}` in a 920px `hub-narrow` container; related stories stacked below (`NewsArticlePage.tsx`). Browser/screenshot reproduction **not performed** (see Blocked) — defect is source-established, not visually reproduced.
Fix: `er-article-layout` grid — article (max 800px, full column ≥1024px) + `er-article-aside` (related, sticky, 320px) rendered **only when related exist** (no ad/blank reservation, no invented ads); single column <1024px; hero `aspect-ratio:16/9` reserves space (no CLS). Tests: `tests/news-article-layout.test.ts`.

## Task 3 — Mobile CBT End Test (L-02 → concrete code defect found, fixed)
No browser reproduction possible (Blocked), but source-established defects at ≤900px (`src/cbt-engine.css`): (1) `.er-exam-tool-label{display:none}` made End Test an icon-only button **with no `aria-label`** in `CbtSessionPage.tsx` (Calculator/Questions had labels, End Test did not); (2) `.er-exam-bar-controls{flex-wrap:nowrap;overflow-x:auto}` could push End Test off-screen at ~320px; (3) its target was 36px. Fix: `aria-label="End test"`, controls wrap, End Test keeps text label, `margin-left:auto`, 44px target. Submit/End-Test distinction, deadlines, server authority unchanged. Regression tests in `tests/news-article-layout.test.ts`. **Viewport matrix 320/375/390/768 still requires a real browser — not claimed as done.**

## Task 4 — Admin refinement (focused, no architecture change)
Existing sidebar/topbar/AdminKit/capability gating audited and retained. Two justified fixes in `src/admin.css`: (a) active nav used crimson tint — per `COLOR_THEME_SPEC.md` §2/2b the current-item state is the green surface; `.admin-nav-link.active` now `#174A3A`. (b) Mobile nav was a 2-column grid stacking the whole console above content; now one horizontally scrollable 44px row, group labels hidden on mobile. Authorization/roles/routes untouched.

## Task 5 — Dashboard vs profile (no change; documented)
`/profile` (`ProfileCompletionPage`, headed "Academic Profile & Preferences", `:414`) genuinely contains personal identity/contact/photo/preferences **and** institution/faculty/department/programme/level (§ fields 9–18). The "Academic Profile" label at `StudentDashboardV2:574` is therefore substantially accurate, and dashboard (activity/requests/CBT/tools/notifications) is already distinct. Smallest safe correction if owner wants stricter separation: rename label to "Profile & Academic Details" — a copy change only. **No route changed; awaiting owner preference.**

## Task 6 — UNICAL services (not published; owner content required)
Still absent from `serviceGuides.ts`/`liveServices.ts` — correctly not live. Owner must supply before any guide ships: official portal URLs, verified step-by-step instructions, eligibility, required documents, fees (or "free"), turnaround, and who operates it. Never request portal/banking passwords. Non-UNICAL institutions keep "Coming soon"; a trackable request must reuse the existing `service_requests` workflow (admin queue already exists) — implementation awaits owner-approved copy.

## Task 7 — Security/staging
- `npm run rls:audit` **ran locally: exit 0, 48 public tables classified, 0 findings** (static classification audit; it is not a live-DB probe).
- Playwright: **Blocked** — `Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-1243/...`; `npx playwright install chromium` cannot reach the download CDN from this sandbox. Owner/staging: run `npx playwright install chromium && npm run test:e2e` (config already blanks Supabase env, port 3100).
- Live auth/RLS/upload/CBT-retry/notification-ownership checks need staging `VITE_SUPABASE_URL`, publishable key, service-role key (server-only) per `.env.production.example`, plus synthetic accounts. No secrets printed; nothing run against production.

## Session-2 test evidence
`npx tsc --noEmit` 0 · `npm test` **634 pass / 0 fail / 0 skipped** (630 prior + 4 new) · `npm run build` 0 · `schema:audit` 0 · `perf:audit` 0 · `rls:audit` 0 · route smoke on built server: `/`, `/past-questions`, `?view=cbt`, `/tools/cgpa-calculator`, `/cbt/setup/waec`, `/admin` all 200 (`/news` 301 canonical redirect). Playwright e2e: blocked as above.

## Session 3 — Service-guide step images (owner-reported)
Owner reported step images in service previews did not match the step text. Verified by viewing the assets: `waec-result.png` is a "No WAEC Result? Can I still get admission?" graphic (used as a result-checker image), `graduates.jpg` is a graduation celebration (used for "prepare your documents"), `campus.jpg` illustrated unrelated portal steps. Fix in `src/data/serviceGuides.ts`: remapped all 16 steps across nelfund-loan/results/jamb-slip/admission-letters to step-matched images (official NELFUND notice for eligibility; students-with-documents for preparation; new step-specific `public/news/photos/step-*.webp` for online application, result checking, printed slip, acknowledgement, guided support). Alt text rewritten to describe the actual image. Images compressed to the repo perf budget (total raster 320.9KB ≤ 320KB budget in `scripts/perf-audit.ts`); `waec-result.png` recompressed/renamed `waec-result.jpg` (no code references remained). Guard: `tests/service-guide-images.test.ts` (files exist, no mismatched photos, unique per guide). Style reference shared: `docs/STYLE-DASHBOARD-ADMIN-PROFILE.md`.

## Session 4 — Image provenance + profile separation
Owner direction applied strictly: **no generic/illustrative image may masquerade as an official portal screenshot.** Every guide step now declares `imageKind` (`official-document|illustration|photo`) and `imageSource` in `src/data/serviceGuides.ts`, rendered as a badge + caption beside the exact step (`pages/ServiceApplyPage.tsx`): "Official document" only for the verified NELFUND public notice (shown `object-fit:contain` so its text is not cropped); generated step images are labelled "Illustration — not an official portal screenshot"; stock-style photos labelled "Photo". Broken images now show an "Image unavailable" fallback instead of a broken icon.
**Services in the owner's table that do not exist as EduReach services** (school-fees payment, GSS/EDC registration, online course registration, portal PIN recovery): NOT created. Verified starting point only: `https://portal.unical.edu.ng/` (fetched 2026-10-21) confirms UNICAL itself offers school-fee payment, course registration ("compulsory courses pre-selected"), admission-status PIN and PIN-help (`/admission/pin-help`, `/payments/find`) on its own portal — EduReach has no integration or authorization there, and GSS/EDC specifics were not verified on that page. Publishing guides requires the owner to confirm: exact GSS/EDC process, fees, eligibility, and that EduReach may republish UNICAL screenshots. WAEC/NECO result steps use labelled illustrations for the same reason (no verified official-portal screenshot captured; browser tooling unavailable).
**Profile separation (Task E):** `/profile` summary now renders distinct "Personal profile" (name/email/phone) and "Academic profile" (institution/level/programme/department/faculty/session/years) groups — same page/data/routes, no duplication, no invented records. CGPA/results/performance stay on the dashboard/tools where the real data lives.
Dashboard/admin style direction (`#174A3A`/`#B14933`, sidebar/bottom-nav, admin sections) was already applied in Sessions 1–3 and unchanged here; Dribbble/Pinterest links used as direction only, nothing copied.

## Session 5 — Real portal screenshots for service guides (owner-supplied references)
Owner instructed: use the references they sent, do not generate. All AI-generated/drawn mockups from the interrupted session were deleted. Genuine screenshots were retrieved from the public tutorials in the owner's research, visually inspected, and checked field-by-field against the live official portals (fetched 2026-10-21): WAECDIRECT (Examination Number/Year/Examination/PIN/Serial No/Submit — via masterwaec.com), NECO (Examination Year/Type/Token/Registration number/Check Result — via technext24.com), JAMB e-Facility login (via smartjamb.com) and Myschool slip-service screen (Enter Reg. Number, GSM No or email / Generate Examination Slip). Rejected after viewing: a 2022 JAMB slip still showing a real candidate's centre/seat/LGA, exam-hall and stock photos, NELFUND marketing infographics with unverified claims (₦20,000/funds-in-30-days), vendor (Peyflex) screens. Results guide split into distinct WAEC (4 steps) and NECO (4 steps) sequences with section headings. NELFUND steps corrected to the verified portal.nelf.gov.ng flow (Get Started → Nigerian? → verify educational information → verify student status with JAMB); the in-account loan-request screens could not be verified, so those steps, the WAEC result window, JAMB slip print view, and the admission-letter screens use clearly labelled placeholders ("Placeholder" badge; no generated mockups). Assets: `public/images/service-guides/*.webp`, all local, compressed; old generated `step-*.webp` photos deleted. Image usage: screenshots are from third-party tutorials of public portal pages, contain no candidate data, and are source-labelled in the UI caption; owner should confirm tutorial-site permission for commercial reuse or replace with self-captured screenshots from the official portals (same filenames).

## Session 6 — Admin service-guide management (2026-10-21)
Owner decision: guides must be manageable from the Admin Dashboard instead of code edits, seeded by the verified-screenshot guides already shipped. Built on the existing catalogue/capability stack — no new router, auth or storage system:
- Migration `20261026120000_service_guides.sql`: `public.service_guides` (one row per `service_catalog.service_key`, cascade delete; steps as bounded JSONB array; `status` draft/published). RLS enabled, no client grants or policies — all access goes through capability-checked server endpoints, so hidden buttons are never the only guard. Registered in `scripts/rls-posture.ts` (server-only), `supabase/ci/verify-migrations.sql` and `supabase/ci/production-validation.sql` (expected version + object check); operator counts reconciled to 73 migrations / 49 tables / 583 columns / 49 RLS tables.
- Server (`server.ts`): `GET /api/services/:slug/guide` serves only published overrides and returns `{guide:null}` on any failure; `GET/PUT/DELETE /api/admin/services/:serviceId/guide` require `service.read`/`service.update`, validate payloads server-side (1–24 steps, recognised image kinds, HTTPS or site-relative image URLs, bounded text), audit-log every save/reset, and deleting a guide restores the built-in default instead of breaking the route. `service.update` was added to the existing `/api/admin/uploads` capability list so guide editors can upload screenshots to the existing `admin-content` bucket. Built-in form services remain undeletable at the catalogue API, so their routes/WhatsApp flows cannot be broken by guide or catalogue edits.
- Admin UI (`pages/AdminServicesPage.tsx`): per-service "Guide" editor — eyebrow/summary/safety note, draft/publish state, per-step section/title/instructions, image URL or upload, image type (portal screenshot vs official document vs illustration/photo/placeholder), source credit, alt text, reorder, add/delete, live-page link, and an in-editor preview. Editor starts from the built-in guide (loaded lazily so the shared API module and student first-load bundle do not grow); "Reset to built-in guide" removes the override.
- Public page (`pages/ServiceApplyPage.tsx`): fetches the published override and falls back to the built-in verified guide on any failure/offline — current students see no change until an admin publishes.
- Perf: critical path unchanged (210.0 KB ≤ 210 KB) after keeping admin guide code out of the shared API module; total-JS budget raised deliberately 330 → 334 KB (documented in `scripts/perf-audit.ts`) for the lazy admin-only editor chunk. Migration is written but NOT applied to any hosted database from this session; until it is applied, the public endpoint returns no override and built-in guides render as before.

## Session 7 — Merge, Supabase sync and security tightening (2026-10-21)
Secret-exposure sweep before merging: no JWTs, service-role keys or hardcoded credentials in source, `public/`, the built bundle or tracked env files (only `.env.example`/`.env.production.example` placeholders are tracked; `.env*` is gitignored). The server already validates that its key is a real service-role key (`lib/supabase-config.ts`) and the browser only ever receives publishable/anon keys. Added defence in depth: the browser client (`src/lib/supabase.ts`) now inspects the JWT role claim and refuses a service-role key outright, falling through to the unconfigured state — the key is never logged. Removed verifiably dead `.pin-vault`/`.pin-code` CSS (no TSX references) to keep the perf gate green without raising the critical-path budget.

## Session 8 — Remaining release issues (2026-10-22)

Branch `arena/069ae800-edureach-hub` @ `f8ec28f`, working tree clean at start. No
production access, no migration applied, no deployment. Each item below states
what was verified and what was not.

### 1. Mobile LCP

Reproduced instead of re-read: a Chromium build was made usable in this
environment (the sandbox has no browser download CDN, so a local Chromium binary
was paired with its own shared libraries and pointed at via the
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` the config already supported), the app was
built and served with `npm start`, and `tests/e2e/perf.spec.ts` measured the Pixel
7 profile. All three routes were over, not just two: `/` 5 384 ms, `/news`
5 260 ms, `/past-questions` 6 496 ms, 863–896 KB transferred.

Cause: the Express server applied cache and security headers but **no
compression**, so the entry chunk (337 KB), the render-blocking stylesheet
(292 KB) and the Supabase chunk (216 KB) arrived at full size on a 1.6 Mbps
link. Netlify compresses the hosted build, which is why the production site did
not show it; self-hosted (`Dockerfile` → `npm start`) and the measurement both
paid it in full. Fix: `app.use(compression({ threshold: 1024 }))` in
`server.ts` (brotli/gzip, `Vary: Accept-Encoding`, small JSON untouched).
Result: LCP 1 704 / 1 660 / 2 076 ms and 221–236 KB on the same profile.
The gate now enforces LCP ≤ 3 s and transfer ≤ 400 KB (was 8 s / 1.2 MB), asserts
the entry script and stylesheet are compressed, and measures the three routes
serially in a dedicated `mobile-perf` project (`npm run e2e:perf`) because
running beside the functional suite measured the runner (3.5 s) rather than the
page. Details: `docs/features/PERF-1.md`, "Mobile LCP investigation".

### 2. Migration checklist

`supabase/ci/production-validation.sql` check 8 was `count(*) >= 74` against a
number typed into the file, and check 9 named a hand-picked list of release
versions; a newly added migration was in neither. Check 8 now carries a generated
list of every file in `supabase/migrations/` (74), compared to
`supabase_migrations.schema_migrations` by version and then by prefix-stripped
name. `npm run migrations:checklist` is a new CI stage that fails when a file is
unlisted, when an entry has no file, when a 14-digit version is claimed twice, or
when an entry disagrees with its file; `--write` regenerates the list. Ten tests
in `tests/migration-checklist.test.ts` cover both directions, including running
the SQL against a real PostgreSQL (PGlite) with a synthetic ledger: it fails when
one migration is omitted and passes when all are present. Nothing was applied to
any database and no ledger row was edited.

### 3. Supabase live verification

`npm run prod:validate` reports `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `NODE_ENV` unset,
skips the connectivity group, and names the SQL artefact for the checks PostgREST
cannot run. No credentials exist here and none were requested. The full split of
local vs. authenticated checks, the safety rules and the ordered procedure are in
`docs/SUPABASE_LIVE_VERIFICATION.md`. No live result is claimed anywhere.

### Verification run in this session

`npx tsc --noEmit` 0 · `npm test` 660/660 · `npm run schema:audit` no blocking
findings · `npm run migrations:checklist` 74/74 · `npm run rls:audit` 50/50 tables
0 findings · `npm run a11y:audit` 0 blocking / 5 informational ·
`npm run analytics:audit` all agree · `npm run build` 0 · `npm run perf:audit`
10/10 · Playwright functional suite 158 passed / 2 skipped (both are the
documented "no exam available without live content" a11y case) ·
`npm run e2e:perf` passed on all three routes.

Not run: anything against the hosted Supabase project, anything against the
deployed site (this sandbox cannot reach either), and `npm run audit:ci` is
network-dependent and belongs to CI. Playwright needed
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `LD_LIBRARY_PATH` locally because the
browser download CDN is unreachable; CI installs its own browser and needs
neither.

## Session 9 — Windows verification run: three platform defects fixed (2026-10-22)

The owner ran the staging checks on Windows 11 (Git Bash / MSYS2) against the
live project. Four things failed; three were defects in this repository, not in
the environment, and are fixed in this session. No production writes, no
migration, no deployment.

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | `npm run schema:audit` → **138 blocking findings** on Windows, `no blocking findings` on Linux | The audit's patterns anchor on `\n`; Git for Windows writes CRLF (`core.autocrlf=true`). Reproduced exactly by converting the 74 migration files to CRLF: 138 findings; restored immediately. | `scripts/schema-audit.ts` reads SQL and code through a normalising reader; `scripts/perf-audit.ts` normalises `index.html` and `public/_headers` too. `collectCodeUsage` also tolerates a missing `server.ts`. Regression test in `tests/schema.test.ts` runs a CRLF and an LF migration history through the audit and requires identical answers. |
| 2 | `npm start` → `'NODE_ENV' is not recognized…`, and both Playwright suites failed to start their web server | `start` was the POSIX prefix `NODE_ENV=production node build/server.cjs`. | `scripts/start.mjs` sets `NODE_ENV` in Node before requiring `build/server.cjs`; works in PowerShell, cmd and bash. Docker (already `ENV NODE_ENV=production`) unchanged. |
| 3 | `npm run analytics:retention` (no `--apply`) **called the deleting RPC** | `executeRetention` was only added later; the script called `prune_site_analytics_events()` on both paths and printed its answer as a plan. | A dry run now issues one read-only `count` query (`head: true`) and cannot reach a mutating RPC. Six tests in `tests/analytics-retention.test.ts`; the first asserts the fake client's `rpc` was never called. |
| 4 | `npm error Missing script: "e2e:perf"` | The owner was on `main`; the script exists only on this branch. | Not a defect — switching to the branch is the fix. |

**Data finding, not fixed (needs owner approval — it is a production data decision):**
`npm run duplicate:audit` examined 1 000 questions and reported **376 exact
duplicate groups**. Two exam rows (`d37a0c7c…` and `edef5d4f…`) hold the same ten
"General" questions, and ten vocabulary questions repeat across three "Use of
English" banks. The script deletes nothing; deduplicating is an editorial
decision with a reviewed migration, not a script run.

**Smaller data observations from the same report:** `news.unknown_categories: 16`
(none of the 16 published articles uses a category label the code recognises),
`institutions.missing_website: 328` of 329, `opportunities.active_without_deadline: 1`.
All read-only findings; none is a release blocker.

**Verified after the fixes (Linux, this sandbox):** `npx tsc --noEmit` clean ·
`npm test` **667/667** (660 before this session + 6 retention + 1 CRLF) · `schema:audit` no blocking findings with LF **and** with CRLF ·
`perf:audit` 10/10 (also with CRLF `_headers`) · `npm start` serves
`/api/health` 200 and the SPA shell 200.

## Session 10 — the verification ran against production (2026-10-22, continued)

`npm run env:check` (added this session) reports the owner's `.env` project
reference as `gjdfatwcoosyuhakrrhh` — the production project named in this
repository's own audit documents. That reframes session 9's evidence:

- **Safe, and now confirmed against production:** `prod:validate` (21 passed,
  1 failed only because `NODE_ENV` was not exported), storage bucket visibility,
  table reachability, CBT/news/opportunity data integrity, `newsroom:integrity`,
  `duplicate:audit`, `schema:audit` after the CRLF fix, `perf:audit` 10/10.
- **Never run against production:** account creation, password reset, CBT
  attempts answer-saving, uploads, admin edits, `analytics:retention --apply`.
  None was run. The manual walkthrough in the staging plan must not be run until
  `.env` points at a staging project.
- **One command did write-capable work by mistake:** `analytics:retention`
  without `--apply` called `prune_site_analytics_events()` against production on
  2026-10-22 at 10:50 and at 09:31. Both runs reported `0 row(s)` deleted, and
  the window (90 days; cutoff 2026-07-24) is older than every row in
  `site_analytics_events` (593 rows, all recent). No data was lost. The defect is
  fixed in `41e3c7e` and pinned by `tests/analytics-retention.test.ts`.
- **`NODE_ENV` must not be added to `.env`:** the dev server reads the same file,
  so a production value there would make `npm run dev` serve the stale build.
  Provide it per command; `npm start` sets it itself.

New in this session: `npm run env:check` (`scripts/env-check.ts`,
`tests/env-check.test.ts`, 6 tests) classifies the configured project and states
what is safe against it, and `npm start` now explains a missing dependency
(`npm ci`) instead of printing a bare `MODULE_NOT_FOUND` stack trace.

Production data findings from the read-only run, none changed: 376 exact
duplicate question groups (two exam rows share ten General questions; ten
vocabulary items repeat across three Use of English banks) · 16 of 16 published
news articles use an unrecognised category · 328 of 329 institutions have no
website · 1 active opportunity has no deadline · 1 610 exam questions,
7 CBT exams, 24 news rows, 329 institutions, 593 analytics events.

## Session 11 — Can the Arena environment test Supabase? No (2026-10-22)

The owner reported adding the Vite Supabase URL to the branch. It is not visible
to any process in this environment: the shell (17 variables, none matching
SUPA/VITE/SB_/ARENA), a live-preview process, a `.env` file on disk, the tracked
tree on this branch, and the usual secret mounts all show nothing. Separately —
and independently decisive — this sandbox cannot reach Supabase at all: github
and npm answer 200, `*.supabase.co` and `supabase.com` answer **000** (DNS
resolves, the connection is refused).

So every live capability is **blocked**, not failed: URL/key configuration,
client and server connectivity, database reads, sign-up/sign-in, CBT question
loading, answer saving, uploads and role permissions. Test accounts do not exist
and cannot be created here. The full matrix is
`docs/SUPABASE_ENVIRONMENT_CAPABILITY.md`.

What did run, and passed: `npm test` 677 (676 pass, 1 skip — the perf self-check
that needs `dist/`, which is built later in the gate) · `schema:audit` no blocking
findings · `migrations:checklist` 74/74 · `rls:audit` 50/50 · `a11y:audit`
0 blocking, 5 informational · `build` · `perf:audit` 10/10 · Playwright 158
passed / 2 skipped · `e2e:perf` passed (LCP 1 796 / 1 672 / 2 088 ms,
221–236 KB) · `prod:validate` correctly reports `skipped` rather than `pass`.

Two small honesty improvements this session:

- `npm run env:check -- --probe` now also reports **network** reachability, with
  no key attached (a 401 is the proof; no response is reported as "cannot reach
  Supabase"). Ten tests, including one that an unreachable host is never reported
  as configured.
- `prod:validate` used to say "no service-role key in this environment" even when
  a key was set but was not a service-role key. It now names the actual problem:
  `missing: a usable server secret key (one is set but it is not a
  service-role/secret key)`.

Nothing was written to any database; no migration, deployment, email, upload or
security setting was touched.

## Session 12 — Independent audit: the two failing tests, and what they hid (2026-10-22)

Baseline `1ba3a73` (matches `origin/arena/069ae800-edureach-hub`), tree clean,
`npm ci --ignore-scripts` exit 0. No deploy, no merge, no migration, no production
write; no secret was read or printed.

### The reported failures were line endings, and only line endings

An informal reading of the two failures was "the asset-cache rule and the
capability assertion are broken". They are not. Every file in the repository (398
of them, excluding `node_modules`/`dist`/build output) was converted to CRLF and
the whole suite was run: **677 tests, 674 pass, 2 fail** — `tests/headers.test.ts`
#8 and `tests/site-content.test.ts` #15, and nothing else. Both assertions were
anchored on a literal `\n`:

- `tests/headers.test.ts:115` — `/assets/*\n((?:\s{2}[^\n]+\n)+)` matched nothing on
  a CRLF checkout, so the extracted block was `''` and the cache rule was never
  examined.
- `tests/site-content.test.ts:248` — `/'site\.read',\n\s+'site\.update',/`.

Both tests now normalise line endings at their single read point
(`readFileSync(...).replace(/\r\n?/g, '\n')`) and keep the same demands. Verified
by converting the twelve files those tests read to CRLF again: **138/138 pass**.

### Confirmed defects fixed

| ID | Pri | Finding | Evidence | Fix |
|---|---|---|---|---|
| AUD-1 | P2 | `scripts/client-env-check.ts` loaded **no** `.env`, so it disagreed with the bundler it guards: a correct `.env` still printed `WARN … Missing: VITE_SUPABASE_URL, …`, and `CONTEXT=production` refused a correctly configured build (`exit 1`). Netlify was unaffected (env in the build environment); local and self-hosted production builds were. | script had zero `dotenv` references; reproduced with a temporary `.env`: `WARN … Missing` exit 0, and `CONTEXT=production` exit 1 | `import 'dotenv/config'`, like the six other operator scripts. A variable already in the environment still wins. |
| AUD-2 | P3 | `pages/StudentDashboardV2.tsx:336` resolved a role through `app_metadata?.role \|\| user_metadata?.role`. `user_metadata` is writable by the account holder. The value only drives the dashboard's own "Admin Console" link and role label, and every admin call is authorised server-side, so this was not an authorisation bypass — but it was the one client surface still reading a self-granted role, and `pages/AdminLayout.tsx` already documents why that must not happen. | grep over `src`/`pages`/`components`/`lib` | The `app_metadata`-only fallback, matching the console shell; the profile row (`profiles.role`) still wins. |
| AUD-3 | P3 | `tests/api.test.ts` enumerated `app._router.stack` (Express-4 internal). On Express 5 the list is empty and the entire unauthenticated-401 sweep becomes zero tests that still report green. | the enumeration had no assertion that it found anything | Reads `_router` then `router` (the Express-4 `router` getter throws, so it must stay second) and asserts three known admin routes were discovered. |
| AUD-4 | P3 | The CSP's `connect-src` was never asserted: `https://*.supabase.co` and `wss://*.supabase.co` are two separate sources, and folding them together or dropping `wss:` would silently break Realtime with no test to notice. | `tests/headers.test.ts` checked `script-src`/`object-src`/`frame-ancestors` only | New test compares the `connect-src` source list in `server.ts` and `public/_headers`, requires both origins, and rejects any token that looks like two merged origins. |
| AUD-5 | P3 | `tests/site-content.test.ts` #15 proved the two capability literals existed *somewhere* in `capabilities.ts`. Deleting `'site.update'` from the vocabulary still passed, because the content editor's grant list contains the same adjacent pair. | mutation: deleting the vocabulary entry left the suite green | The two regions (vocabulary, content-editor grant list) are now asserted separately. |

### Verification (this branch, after the fixes)

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | **683 tests, 683 pass, 0 fail** (677 before; +6 regression tests, and the `dist/`-dependent perf self-check now runs because `build` ran first) |
| `npm run schema:audit` | 0 | no blocking findings |
| `npm run migrations:checklist` | 0 | 74/74 |
| `npm run build` | 0 | 344.80 kB / 101.51 kB gzip |
| `npm run perf:audit` | 0 | 10/10 budgets |
| `npm run analytics:audit` | 0 | taxonomy, call sites, server and document agree |
| `npm run rls:audit` | 0 | 50 tables, 50 classified, 0 findings |
| `npm run a11y:audit` | 0 | 0 blocking, 5 informational |
| `npm run audit:ci` | 0 | 0 vulnerabilities (also `npm audit` full tree) |
| `npm run test:e2e` | 0 | 158 passed, 2 skipped |
| `npm run e2e:perf` | 0 | LCP 1 700 / 1 696 / 1 972 ms, 221–236 KB |
| `npm run env:check` | 0 | "not configured" — correct for this sandbox |
| `npm run prod:validate` | 1 | **environment, not code**: four required variables unset; the live checks are reported `skipped`, never `pass` |
| Supabase live checks | — | **BLOCKED** — `*.supabase.co` is unreachable from this sandbox (000), no credentials are present |

### Audit sweeps that found nothing new

Every `/api/admin/*` route (including `src/server/siteContent.ts` and
`src/server/question-import/routes.ts`) is capability-guarded; `verifyJWT` uses
`auth.getUser` plus the trusted `profiles` row and fails closed; `get_cbt_result`
still scopes on `auth.uid()`; 72 `SECURITY DEFINER` functions pin `search_path`;
the CBT draft/submit RPCs all select the attempt by `user_id = auth.uid()`; no
`eval`/`new Function`; `dangerouslySetInnerHTML` only through `sanitizeRichHtml`;
uploads sniff bytes rather than trusting the declared MIME type; a build with a
marker service-role key in the environment leaves no trace in `dist/`, while the
publishable key is inlined as intended; `.env` is git-ignored and no secret is
tracked.

### Not changed, and why

The two `StudentDashboardV2` display values, the CSP itself and the header files
are untouched — the CSP was verified byte-identical in both places and correct,
so there was nothing to "fix" there. Production data findings from Session 10
(376 duplicate question groups, 16/16 news articles with an unrecognised
category, 328/329 institutions without a website, one opportunity with no
deadline) are content decisions, not code defects, and remain open.

## Session 13 — PR #30 review, item by item (2026-10-22)

Branch `arena/069ae800-edureach-hub` @ `76f9d8f` at the start (tree clean, matches
the remote). No deployment was attempted: **Netlify deployment credits have
expired**, so the deploy-preview status is `BLOCKED`, not "passing" and not
"failing". No Supabase credentials exist here and `*.supabase.co` is unreachable,
so every live check stays `BLOCKED`. No migration, production write, deploy or
secret handling occurred.

### What was re-verified rather than assumed

| Area | How | Result |
|---|---|---|
| `.env` for local builds | temporary `.env` only → guard prints `ok`; `CONTEXT=production` → exit 0 | passes (was the AUD-1 defect) |
| explicit env wins over `.env` | shell variable + stale `.env` → shell value used; dotenv never overwrites | passes |
| production build fails when unconfigured | empty `.env` + `CONTEXT=production` → exit 1, names both variables | passes |
| route discovery is not vacuous | mutation: force the layer list to `[]` → the suite fails with `route discovery missed GET /api/admin/session` | passes |
| CSP origins | mutation: concatenate `https://*.supabase.co` + `wss://…` into one token → tests 4 and 9 fail; mutation: delete `wss://` → both fail | passes |
| capabilities | mutation: delete `'site.update'` from the vocabulary, then from the editor grant list → test 15 fails both times | passes |
| analytics retention | dry run issues one `head: true` count and **no** RPC (`tests/analytics-retention.test.ts` asserts `calls.rpc` is empty); only `--apply` reaches `prune_site_analytics_events` and `recordJobRun` | passes |
| migration checklist | 74/74; per-file comparison plus duplicate/malformed/missing-entry detection; SQL artifact contains no mutating statement (keyword scan after stripping comments and literals) | passes |
| compression | live server: `/` brotli with `Vary: Accept-Encoding`; `/api/health` (36 B) uncompressed with `Content-Length` intact; hashed asset `immutable` + brotli; range request returns 206 **uncompressed**; 404 keeps `no-store` | passes |

### Findings this session

| ID | Pri | Finding | Evidence | Disposition |
|---|---|---|---|---|
| AUD-6 | **P2** | The browser's defence-in-depth key screen (`src/lib/supabase.ts`) only decoded a JWT payload looking for `"role":"service_role"`. Supabase's current secret keys (`sb_secret_…`) are not JWTs, so that check silently returned false: pasting one into `VITE_SUPABASE_PUBLISHABLE_KEY` would have inlined a full RLS-bypassing key into the public bundle, while `lib/supabase-config.ts` on the server already treated the same prefix as a secret. | the screen was one JWT-only expression; no test covered it | **Fixed**: predicate extracted to `src/lib/supabaseKey.ts`, refuses `sb_secret_` and service-role JWTs, passes `sb_publishable_`/anon, never throws; `tests/supabase-key.test.ts` (5 tests), mutation-checked |
| AUD-7 | P3 | The env contract states "a secret must never be a `VITE_` variable" but nothing asserted it, for a primary name or an alias. | `src/lib/envContract.ts` header vs `tests/prod-validate.test.ts` (it checked only that client vars carry the prefix) | **Fixed**: new invariant test; mutation (renaming the service-role key to `VITE_…`) turns it red |
| AUD-8 | P3 | `npm run ci` — the authoritative gate — ran `schema:audit` but not `rls:audit` or `a11y:audit`, two deterministic offline audits the repository ships (3 s and 2 s). `docs/architecture/STYLESHEET_LAYERS.md` already described `a11y:audit` as "in the gate". | `package.json` `ci` string; `tests/ci.test.ts` stage list | **Fixed**: both stages added to `ci` (before the network-dependent `audit:ci`) and to the required-stage list |
| AUD-9 | P3 (risk) | `extractZip` decompresses each entry (`entry.async('uint8array')`) and only then checks the 20 MB per-file / 80 MB total caps, so a crafted archive can allocate far more memory than the caps imply before being rejected. | `src/server/question-import/extract.ts:326-335` | **Not changed**: the path needs the `data.import` capability and is rate-limited; a pre-decompression size check relies on JSZip internals. Recorded for a reviewed follow-up rather than fixed blind |
| AUD-10 | P3 (limitation) | In check 8 of `supabase/ci/production-validation.sql`, six legacy migrations share the 8-digit version `20260903`. A single ledger row with that version satisfies the version arm of the match for all six, so up to five unrecorded files could read as recorded. | `production-validation.sql:151-238`; the six files | **Reported, not changed**: tightening it could turn a currently-correct production report into a false `fail`, and the live ledger cannot be inspected from here (see the reconciliation document's rule 2). Recommended once a staging ledger is available |

### Production-content findings — rechecked, still owner decisions

- **376 duplicate question groups** — the last live run of `duplicate:audit`
  (this script is read-only and reports `BLOCKED` without credentials). The
  repository's exact-duplicate migration removed only rows that were identical in
  text, options and key *and* unreferenced (12 rows, applied 2026-10-18), and
  deliberately does not act on near-duplicates. So the count is consistent with
  the code, and deleting more is a **content decision**.
- **16/16 published news articles with an unrecognised category** — **partly
  superseded**. `20261002130000_news_category_contract.sql` derives an indexed
  `category_slug` for every article, so filtering no longer depends on the stored
  label matching a slug. What remains is editorial: labels such as `NABTEB` map to
  a slug with no filter chip. This is **content/vocabulary**, not a code defect.
- **328/329 institutions without a website** — unchanged; filling them is a
  **data-entry decision** (`institutions.website_url` is optional by design).
- **One active opportunity without a deadline** — unchanged; whether a deadline
  is mandatory is a **product decision**, and the opportunity itself is published
  and visible.

None of the four was edited. Each needs an approved decision and, where a rule is
wanted rather than a cleanup, a forward-only migration.

### Verification (this branch, after the fixes)

`npm run ci` — the whole gate, with the two new stages — exited **0**:
`typecheck` 0 · `npm test` **689 pass / 0 fail / 0 skipped** · `schema:audit` 0 ·
`migrations:checklist` 74/74 · `build` 0 · `perf:audit` 10/10 ·
`analytics:audit` 0 · `test:e2e` 158 passed / 2 skipped · `e2e:perf` 1 passed
(LCP 1 700 / 1 696 / 1 972 ms) · `rls:audit` 50/50 · `a11y:audit` 0 blocking /
5 informational · `audit:ci` 0 vulnerabilities. Run separately: `env:check` 0
("not configured" — correct here), `prod:validate` **1** (four required variables
unset; live checks reported `skipped`, never `pass`).
