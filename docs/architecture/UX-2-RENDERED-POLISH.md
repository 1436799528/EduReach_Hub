# UX-2 — rendered visual/QA polish

**Branch:** `arena/c839064e-edureach-hub`  
**Base:** `d048916` (`main`)  
**Scope:** student shell, dashboard, profile, search, notifications, CBT entry,
login, and the full admin console — measured in a real Chromium renderer at
320, 360, 390, 430, 768, 1280 and 1440 CSS pixels.  
**Rule followed:** a defect is closed only when a rendered page (screenshot and
computed styles) shows the fix. Source reading alone was not accepted as
evidence.

---

## 1. Method and evidence

### Sweep harness

`.ux2-audit.mjs` drives a production build (`npm run build:e2e-client`) against
`npm start` on `127.0.0.1:3100`. It covers **21 routes × 7 widths = 147 rendered
states**:

- **Student (6):** `/dashboard`, `/dashboard/cbt`, `/cbt`, `/profile`, `/login`,
  `/search?q=jamb`
- **Admin (15):** `/admin`, `/admin/users`, `/admin/queue`, `/admin/news`,
  `/admin/analytics`, `/admin/cbt`, `/admin/services`, `/admin/schools`,
  `/admin/opportunities`, `/admin/content`, `/admin/content-manager`,
  `/admin/question-imports`, `/admin/banks`, `/admin/pdf-bank`, `/admin/site`

For each state the harness records:

- `documentElement.scrollWidth` vs `innerWidth` (page-level overflow);
- every element whose painted box crosses the viewport edge, with its nearest
  class and right edge;
- interactive targets below 44 × 44;
- clipped text and page errors.

Admin routes are mocked at the API boundary (session, analytics, jobs, news,
queue) so the console renders its real layout without a live Supabase project.
The analytics mock carries the complete payload shape
(`metrics`, `activity.topPages`, `activity.serviceViews`, `activity.cbtStarts`,
`activity.eventsTotal`, `serviceSubmits[].path`); an incomplete mock previously
made the route look like it crashed. The jobs mock uses array-valued
`health.missing/stale/failing`, matching the page's `.map()` calls.

### Browser

Chromium 153 was inflated from `@sparticuz/chromium` into `/tmp/al2023` and run
with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium`. No system package
manager, CDN install or `npx playwright install` was used.

Evidence lives in:

- `test-results/ux2/report.json` — the 147-row dataset;
- `test-results/ux2/final-*.png` — the screenshots cited below;
- `test-results/ux2/student-*.png`, `admin-*.png` — the complete width sweep.

---

## 2. Final rendered result

| Area | Result |
| :--- | :--- |
| Student pages, 7 widths | **0** page-level overflows, **0** element overflows |
| Admin pages, 7 widths | **0** page-level overflows |
| Admin element overflows | **33 of 105** states, every one a `<th>` inside a labelled, horizontally scrollable `.admin-table-wrap`; `documentElement.scrollWidth === innerWidth` in all 147 states |
| React route errors | **0** |
| Student header at 320 px | brand 138 px, `scrollWidth === 320`; bell/avatar/menu inside the viewport |
| Student header at 390 px | bell 36 × 36, profile trigger 44 × 44 at x = 288, "My Requests" hidden |
| Analytics KPI strip | 3 × 2 at ≥ 781 px, 2 × 3 below; no orphan card |
| Dashboard KPI strip | 3 × 2 at ≥ 781 px, 2 × 3 below; "Unavailable" no longer breaks mid-word |
| Admin narrow tables | table body uses the existing stacked rows on phones; desktop half-width cards now shrink instead of hiding columns behind a scrollbar |

The only console noise in a preview build is expected:
`ERR_CONNECTION_CLOSED`, `ERR_NAME_NOT_RESOLVED` and 401/503 responses from the
unconfigured Supabase project.

---

## 3. Defects found and fixed

### 3.1 Shell and mobile header

**390 px header crowding.** The header carried the wordmark, search, bell,
"My Requests", avatar and menu. At 390 px the right side ran past the container.
The requests link is now hidden below 430 px (`.hub-requests-link`), the profile
trigger keeps its 44 px hit area without its name, and the remaining controls
fit. Evidence: `test-results/ux2/student-cbt-390-header-fixed.png`.

**320 px header overflow.** Even after hiding the requests link, the full
wordmark plus four 44 px controls produced a 355 px right edge in a 320 px
viewport. Below 360 px the wordmark image is 30 px tall and the shell gap is
6 px; the touch targets stay 44 px. The page now reports
`scrollWidth === 320`. Evidence: `final-cbt-320.png`.

**Mobile drawer touch targets.** Drawer rows were bare text links roughly 16 px
tall. They are now 44 px rows with a hover surface, and the close control is a
44 × 44 button. This closed Playwright's `target-size` failure in
`tests/e2e/a11y.spec.ts` (mobile drawer, open).

### 3.2 Student profile

- **Photo controls were unlabelled floating text.** "Use my initials instead"
  rendered as plain text between the avatar and the URL field, and "Choose
  photo" had no clear button shape. Both now sit in one `.profile-photo-actions`
  cluster with a real border, a 32 px desktop height (44 px under a coarse
  pointer) and the URL field directly underneath. On phones they sit two-up. Evidence:
  `final-profile-1440.png`, `final-profile-390.png`.
- **Cancel was a blank white block.** The compact button reset removed the
  border from `.hub-outline-btn`. The profile header now declares its own
  secondary button surface and edge, so Cancel is visibly a control.
- **Avatar colour was a hash pick from crimson/navy/amber/teal.** A student's
  initials could be painted with the destructive crimson or the logo navy for
  no semantic reason. Initials now use the action green `#174A3A`, matching the
  dashboard avatar.
- **The page bar repeated the page heading.** `/profile` and `/profile/complete`
  were labelled "Academic Profile Completion" / "Academic Profile" in the
  global return bar while the page's `<h1>` said "Complete your profile". The
  bar now reads "Profile", so it acts as a breadcrumb instead of a duplicate
  heading.
- **Photo URL field had no visible focus.** The `outline: none` reset had no
  matching indicator and failed the static accessibility audit. The reset was
  removed and a `:focus-visible` green ring added.

### 3.3 Student dashboard

- **Trend line was grey while its area fill was green.** The polyline and
  mid-points now use `#174A3A`; only the final point carries the semantic
  up/down colour.
- **Responsive table duplication was re-checked.** The desktop `<table>` and the
  mobile `.dash-rows` are both present by design; `.dash-mobile-only` is
  `display: none` above the breakpoint. The full sweep rendered one shape at a
  time at 1440/768/390, so this is not a duplicate-content defect.
- **Recent-activity tables** retain the same local-preview notice, status
  wording and row actions. No data behaviour changed.

### 3.4 Admin console

- **Six KPI cards were squeezed into one row.** On a 1440 px dashboard the
  auto-fit strip produced six ~170 px tracks; the word "Unavailable" broke as
  "Unavail / able", and analytics left one card noticeably narrower. Both
  summaries are now explicitly three columns at desktop and two at ≤ 780 px.
  Evidence: `final-admin-dashboard-1440.png`, `final-admin-analytics-1440.png`.
- **Half-width table cards hid columns.** The global `.admin-table` minimum
  width of 820 px forced a horizontal scrollbar inside ~520 px cards; the
  dashboard's Needs Attention table lost Age/Action off-screen at 1440 px. A
  table inside `.admin-two-col` now shrinks with its card
  (`min-width: 0`) and uses 10 px cells. All five columns fit on the desktop
  screenshot; narrow screens still use the stacked row layout.
- **Bars were decorative orange/blue.** Neutral volume bars on the dashboard,
  analytics and service funnels used amber or blue, reading as warnings. The
  default is now the action green; amber is reserved for an actual exception.
  Evidence: `final-admin-analytics-1440.png`, `final-admin-dashboard-1440.png`.
- **Timeline dots were crimson.** Recent Staff Activity painted every audit dot
  with the destructive colour. They are now neutral grey; crimson is used only
  for a rejected/problem status.
- **Muted text failed AA.** `src/admin-analytics.css` painted group labels,
  breadcrumbs, summary detail, chart subtitles and report notes in `#98a2b3`
  (2.57:1 on white). Those roles now use `#5f6f76` (≈ 5.9:1). The rendered
  axe run (`tests/e2e/admin-shell-mocked.spec.ts`) went from 19 contrast
  violations to zero.
- **Card headers collided with actions on phones.** At 390 px the Newsroom
  ingestion copy was squeezed into a 111 px column beside its buttons. Below
  560 px `.admin-card-header` stacks, and the action group gets its own full-width
  row. Evidence: `final-admin-news-390.png`.
- **Page descriptions were clamped to two lines.** `admin-page-header p` was in
  a global `-webkit-line-clamp: 2` rule, so "The site reads the same records"
  became an ellipsis with no way to read the rest. Admin page headers are no
  longer clamped.
- **Page finder looked disabled.** "Find a page" had a grey fill and a grey
  placeholder that read as an inactive field. It is now a white field with a
  neutral edge and `#475467` placeholder text.
- **Drawer close label was ambiguous.** Two controls both announced "Close admin
  menu", which made the accessible name non-unique and broke a strict locator.
  The in-drawer control now says "Close navigation drawer".

### 3.5 Cookie shortcut

The persistent "Cookie settings" pill sat over form fields and the drawer brand
row on 390 px pages. Below 430 px it is now a 44 × 44 icon-only button with an
`aria-label`, so it still meets the touch target without covering a label. The
auth-page variant moved below the preview banner (`top: 80px`) so it no longer
overlaps the notice.

### 3.6 Notifications

While the first fetch was pending, the panel header said "You are up to date"
and the body said "Loading notifications". The header now says "Checking for
updates…" until the first result resolves, then falls back to the unread count,
the honest empty state or the retry state.

---

## 4. Functional checks performed in the renderer

| Check | Result |
| :--- | :--- |
| Header search suggestions | typing "nelfund" shows a suggestion popover; ArrowDown + Enter navigates to `/nelfund` |
| Search empty state | "Nothing on EduReach matches …" with concrete next steps, not a blank page |
| Login required fields | native `required` validation blocks an empty submit; password reveal switches the input to text |
| Notification panel | opens from the bell, reports loading, then the honest failure state when the backend is unavailable |
| Profile photo picker | "Choose photo" opens a file input; "Use initials" clears the URL/photo state |
| 390 header | brand, bell, avatar and menu all inside the viewport; requests link hidden |
| 320 header | no horizontal scroll; brand and 44 px controls fit |
| Admin analytics | renders with the full payload at 1440 and 390; no error card |
| Admin narrow tables | body rows stack on phones; page width stays at the viewport |

The local preview build is intentionally unconfigured, so pages that call the
server show "Unavailable"/"session has expired" while the mock header still says
the operator is signed in. That is a preview-environment limitation, not a
signed-in production state; the API-shaped mocks are what the layout evidence
uses.

---

## 5. Responsive summary

| Width | Student | Admin |
| :--- | :--- | :--- |
| 1440 / 1280 | desktop nav, 3 × 2 KPI summary, half-width tables fit | full sidebar, 3 × 2 KPI, two-column cards |
| 768 | sidebar hidden, bottom nav, single-column cards | drawer navigation, 2-up summary, stacked table bodies |
| 430 / 390 / 360 | 44 px controls, hidden wordmark adjuncts, 44 px cookie icon | drawer, 2-up summary, stacked rows |
| 320 | 30 px wordmark, 44 px controls, no horizontal scroll | drawer, stacked rows, table header scroll only inside its region |

Measured at all seven widths: `docWidth === viewportWidth` on every student and
admin route. Admin `<th>` cells extend past the card on narrow screens only
because their table body intentionally scrolls inside the labelled region.

---

## 6. Gates

All commands were run on this branch after the final code changes.

| Command | Result |
| :--- | :--- |
| `npm run typecheck` | **pass**, 0 errors |
| `npm test` | **1043 / 1043 pass**, 0 fail, 0 skipped |
| `npm run build` | **pass** |
| `npm run build:e2e-client` | **pass** |
| `npm run test:e2e` | **291 passed, 0 failed, 29 skipped** (320 tests) |
| `npm run perf:audit` | **10 / 10 pass** |
| `npm run a11y:audit` | **0 blocking**, 6 informational |
| `npm run schema:audit` | **BASE-1: no blocking findings** |
| `npm run analytics:audit` | **7 / 7 pass** (11 declared/documented events) |
| `npm run rls:audit` | **52 / 52 public tables classified**, 0 findings |
| `npm run migrations:checklist` | **88 / 88 migrations listed** |
| `npm run prod:validate` | expected environment failure: no `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in this sandbox; **0 passed, 1 failed, 2 skipped** |

### Performance detail

| Check | Measured | Budget |
| :--- | ---: | ---: |
| Entry chunk (gzip) | 46.4 KB | ≤ 100.0 KB |
| Supabase chunk (gzip) | 53.0 KB | ≤ 60.0 KB |
| Bundle CSS (gzip) | 45.7 KB | ≤ 51.0 KB |
| Critical path (gzip) | 206.4 KB | ≤ 211.0 KB |
| All chunks (gzip) | 356.6 KB | ≤ 357.0 KB |
| Largest image | 41.2 KB | ≤ 64.0 KB |
| Raster images | 310.4 KB | ≤ 320.0 KB |

No budget was raised in UX-2. The all-chunks figure has only 0.4 KB of
headroom; the next change that adds JavaScript must trim or record a measured
budget change beside the new number.

---

## 7. Remaining problems

1. **Admin table headers still scroll horizontally on phones.** The table body
   is transformed into labelled rows, but the `<th>` row remains a wide scroll
   region inside `.admin-table-wrap`. The page itself never widens
   (`docWidth === vw`), and the region is labelled and focusable. Removing the
   header row entirely would lose column context, so it was left explicit.
2. **Seven migrations remain unapplied in the live project** and were
   deliberately not applied by this pass:
   `20261107120000`, `20261107130000`, `20261107140000`, `20261107150000`,
   `20261108120000`, `20261113120000` (profile write-policy repair) and
   `20261113140000` (avatar storage bucket/policies). The avatar upload path is
   implemented against the new bucket, but it cannot work live until that
   migration is applied in a rehearsed release.
3. **Preview builds show server-unavailable copy while a mock user is signed
   in.** The production build points at an unconfigured Supabase project, so
   analytics, notifications and CBT history return 401/503. The message is
   truthful about the data, but it reads oddly beside a mocked avatar. This is
   an environment limitation, not a rendering defect.
4. **The global return bar remains on profile routes.** It now says "Profile"
   and is useful on deep links, but it is still an extra 51 px band above an
   `<h1>` that already describes the page.
5. **Cookie settings still floats.** At ≤ 430 px it is a 44 px icon, but a fixed
   shortcut will always cover a small part of a long page. Moving it into the
   footer would make it unavailable while scrolling.
6. **The all-chunks budget is effectively at its limit.** 356.6 KB against
   357.0 KB is honest today and fragile tomorrow; do not quietly raise it.

---

## 8. Git state

- Branch: `arena/c839064e-edureach-hub`
- Base: `d048916` (`main`)
- UX-1 commits already on the branch: `705677e`, `3d73b34`, `31396e1`
- UX-2 changes are committed on this branch. No force push, reset, clean or
  staging database was used.
- Hosted database: unchanged by UX-2. The seven migrations listed in §7 are
  local/rehearsal only and were not applied to `gjdfatwcoosyuhakrrhh`.
