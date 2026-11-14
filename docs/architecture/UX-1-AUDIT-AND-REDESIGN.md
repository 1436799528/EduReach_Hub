# UX-1 — product design, UX architecture and frontend audit

**Branch:** `arena/c839064e-edureach-hub`  
**Base:** `d048916` (`main`)  
**Scope:** student site, student dashboard, profile, CBT/results/services workflows,
public profile, admin console, design tokens, shared components, responsive and
state behaviour.  
**Reference:** DesignMotion patterns were used as a principles reference only;
EduReach's own identity, routes and workflows were preserved.

This report follows the required order: student app → admin app → design system
→ functional verification → responsive widths → performance → accessibility →
test counts → remaining problems → git state.

---

## 1. Student app

### What was wrong

1. **The overview explained the product instead of showing it.** The first
   screen was a gradient welcome card, a four-card "report" strip with coloured
   icon squares, a quick-action row of four competing links, a "what matters
   now" block, then charts. A student had to read headings and paragraphs
   before reaching a number.
2. **Two different visual languages.** `student-dashboard.css` said 10 px card
   radius, `dash-report-card` said 14 px, the CGPA panel said 16 px. The page
   background was `#faf8ff` (a pale purple), the KPI icons were blue/green/
   amber/violet, and selected sidebar navigation was crimson.
3. **Analytics was a secondary card.** Trend, subject bars and distribution
   were hidden inside a "Your progress" card with a paragraph of methodology,
   below the welcome card and KPI strip.
4. **The empty state was a paragraph of apology.** With no scored paper the page
   rendered a long explanation and a large "Start practice" button, instead of
   an honest short state.
5. **Report-strip detail repeated the label.** "Latest CBT score … First scored
   paper in this sample" and "Latest result" appeared as two different blocks
   for the same fact, alongside "latest CBT result" in Recent activity.
6. **Destructive actions were underlined text links**, not recognisable icon
   controls with a 44 px touch target.
7. **Home page had two search fields** — the global header search and the home
   search — competing for the same task.
8. **Shell navigation stopped at the four tabs.** Results, past questions,
   services and calculators were only reachable through cards or the CBT tab.

### What changed

- **Identity-first overview** (`pages/StudentDashboardV2.tsx`):
  - `James Aponi ✓ / Your learning overview` header, with the verified mark
    derived from the account's confirmed email, not a hard-coded badge.
  - `Needs attention` is a compact count-led block and only renders when there
    is something actionable.
  - Four neutral KPI blocks: average score, latest score (+ semantic change
    chip), papers scored, open requests.
  - One `Performance` surface with score trend, subject averages (with
    `↑/+14 pts` change chips and band labels), latest result, score distribution
    and CGPA trend when a saved term exists.
  - Compact strengths / needs-practice / next-step row, driven by
    `summarizePerformance()`.
  - If nothing is scored: **`Not enough activity yet`** and one primary action.
    No fabricated zeros, no invented streak or percentile.
- **Retired the four quick-action links.** Navigation owns navigation; the
  sidebar now exposes Study (past questions, results, services, calculators)
  plus account links.
- **One latest-result block.** The KPI, latest-result panel and recent activity
  now use the same `performance.latest` object; the duplicate report strip is
  gone.
- **Search:** the home page owns its quiet search field; the global header
  search is suppressed on `/` so there is one search per screen. Suggestions,
  debounce, keyboard selection, empty/loading/error states and highlighting
  remain in the existing `SiteSearch` component.
- **Delete:** result rows now use a compact trash icon (`aria-label`,
  `title`, 36 px desktop / 44 px coarse pointer) → explicit
  `Delete this result?` confirmation → `Deleting…` → server confirmation →
  `Result deleted…` notice. Nothing auto-deletes.
- **Dead CSS removed:** `src/dashboard-v2.css` and
  `src/hub-portal-tuning.css` contained no selectors used by any page. Removing
  them eliminated the old student-portal/auth-v2 visual language and freed more
  than 8 KB raw CSS. Their two live status-badge rules moved to
  `src/styles/type-system.css`.

---

## 2. Admin app

### What was wrong

1. **Decorative colour on operational data.** `AdminSummary` rendered an empty
   coloured `<i>` square for every tone even when no icon was supplied. The
   dashboard used blue/amber/green/violet/blue/green KPI cards. Admin account
   rows used a crimson shield square. Colour carried no meaning.
2. **Quick tiles duplicated the sidebar** and pushed the queue below the fold.
3. **Two different button systems.** `.admin-btn` was a 44 px pill with a blue
   drop shadow; `.admin-btn.secondary` was a full-width transparent control;
   page-header/card secondaries were a third variant.
4. **Sidebar selection was navy** (`#0a3e83`) and did not use the action tokens.
5. **No way to find a page by keyboard** in a console with 15 destinations.
6. **"Live" was only an API health pill** in the top bar, not a statement about
   the data timestamp.
7. **Long explanatory copy** in Analytics ("Daily trend lines … are not
   supplied … comparisons are omitted") read like an engineering note.

### What changed

- **`AdminSummary` is now a neutral summary strip.** It renders an icon only
  when one is supplied; tone no longer paints an empty square. `Metric` follows
  the same rule.
- **KPI icons neutral**, with status colour reserved for status.
- **Quick tiles removed**; the queue and attention list move up. The sidebar is
  the navigation.
- **Canonical admin controls** in `src/admin.css`: 40 px, 8 px radius, no drop
  shadow; secondary is white with a neutral edge; destructive is a quiet
  crimson-bordered control, not a giant red fill; success uses the primary green.
- **Sidebar selection uses the green action tokens** with a pale green surface.
- **`AdminQuickFind`** (`src/components/admin/AdminQuickFind.tsx`) is a
  keyboard-first page finder in the top bar. It searches only destinations the
  current administrator's capabilities already allow; Arrow keys, Enter, Escape,
  `role="combobox"`, `aria-activedescendant`, and a no-match state are included.
  It is hidden below 900 px, where the drawer is the navigation.
- **Overview header** now reads `Overview / Queues, platform health and recorded
  activity.` with a green `● Live` timestamp and the refresh control.
- **Analytics copy shortened**; missing data still reads as `Unavailable`, never
  as zero. Donut segments now use the green action colour for open work,
  semantic green for completed and crimson for rejected/cancelled.
- **Tables** retain horizontal scrolling inside their own region (the existing
  `role="region"` wrapper) rather than forcing the page wider; the top bar and
  summary strip collapse to a grid at mobile widths.

---

## 3. Design system

### Tokens (`src/styles/theme.css`)

- Primary action moved from logo navy `#0A3E83` to **deep green `#174A3A`**.
  Hover `#123C2F`, pressed `#0D2E24`, soft `#EDF5F0`, edge `#CFE4D8`.
- Secondary is a quiet white control: edge `#D8DEE5`, label `#475467`, hover
  surface `#F7F9F8`.
- Page background moved from purple-tinted `#FAF8FF` to neutral `#F7F8F7`;
  secondary text from warm brown `#5B403B` to neutral `#475467`.
- Logo navy `#0A3E83`, logo blue `#1D9BE0` and logo red `#E3232D` remain brand
  marks, not action colours.
- Crimson `#B14933` remains the destructive/attention accent only.

### Buttons

| Role | Treatment |
| :--- | :--- |
| Primary | Deep green fill, white label, 40–44 px, 8 px radius, one per surface |
| Secondary | White surface, neutral border, dark-grey label; used for nearly every non-primary action |
| Destructive | Compact icon control or quiet crimson-bordered action; explicit confirmation |
| Disabled | Neutral grey, no hover/lift, `not-allowed` |
| Busy | Keeps the action colour, label changes (`Saving...`), `aria-busy` |

`src/styles/brand-actions.css` remains the single owner of action colours. It
was updated, not duplicated.

### Cards

`.dash-card`, `.dash-kpi`, `.dash-chart-panel`, `.profile-panel`, `.admin-card`
and `.admin-summary` share one rhythm: white surface, 1 px neutral border,
10–12 px radius, restrained shadow, 14–20 px padding. Colour lives inside data
(change chips, bands, status), not on the card surface.

### Status

Status tokens remain semantic: success, warning, error and info. `.badge-*`
rules moved into `type-system.css`; status classes no longer depend on a dead
legacy sheet. Unread notification is crimson; selected navigation is green;
admin KPI icons are neutral.

### Stylesheets

The global set went from 18 to **16** sheets. `src/main.tsx`,
`tests/stylesheet-layers.test.ts` and
`docs/architecture/STYLESHEET_LAYERS.md` were updated together.

---

## 4. Functional verification

### Profile persistence — root cause and fix

**Symptom:** saving the profile reported failure or appeared to save only
locally; a refresh showed old values.

**Root cause (live database):** `public.is_staff(uuid)` was created outside the
repository with EXECUTE revoked from `authenticated`. PostgreSQL evaluates every
permissive policy that applies to an `UPDATE`, including
`"Staff can update profiles"`, which calls `is_staff(auth.uid())`. The policy
evaluation therefore failed with `42501: permission denied for function
is_staff`, and the row never changed. The browser surfaced a generic failure and
kept local cache values, which made the save look partially successful.

**Fix applied:**

1. New repository migration
   `supabase/migrations/20261113120000_repair_profile_write_policy.sql`.
2. Both `is_staff()` overloads redefined with the same role list and
   caller-scoped behaviour: an authenticated caller is only ever answered for
   `auth.uid()`, even if a UUID argument is supplied. This avoids turning the
   grant into an "is this UUID an admin?" oracle.
3. `EXECUTE` granted to `authenticated` and `service_role`; revoked from
   `public` and `anon`.
4. Applied to the hosted project `gjdfatwcoosyuhakrrhh` and recorded in its
   migration ledger as `20261113120000`.
5. The missing `20261113000000_public_profiles.sql` was applied to the hosted
   project as well: `public_profile`, `public_profile_slug`, the slug format
   check, the unique partial index and the two-column UPDATE grant. It is
   recorded in the ledger.
6. Verified with a transaction that impersonated the owner JWT and ran the same
   `profiles` UPDATE: it returned the row instead of `42501` (transaction rolled
   back). Authenticated now has EXECUTE on both overloads; `anon` does not.
7. UI copy now says `Couldn’t save your profile. Try again.` instead of
   embedding a PostgREST/database message. Success says
   `Profile saved successfully` and the save bar shows
   `Unsaved changes → Save changes → Saving... → Saved`.

**What was not changed:** the save chain still resolves the user id at save time,
still uses UPDATE-first with the minimal INSERT fallback, still writes local cache
only after server acceptance, and still does not grant browser updates outside
the existing columns.

### Public profile

- `/u/:slug` remains outside `ProtectedRoute`.
- The server selects an explicit whitelist and strips `id` from the response.
- The page renders only name, institution, programme, level, avatar and the
  derived verified mark; no email, phone, matric number, JAMB registration,
  results or notifications.
- Disabled/unknown slugs return the API's 404 and the page's "Profile link
  unavailable" state.
- The missing live columns that made the feature fail in production are now
  present.

### Auth and workflows

- Auth page remains a utility screen: sign-in/sign-up tabs, email/phone, password
  reveal, inline validation, crimson only for errors, 16 px mobile inputs via
  `a11y.css`.
- CBT, question serving, scoring, timer and answer persistence were not
  rewritten.
- Result deletion uses the server response before removing the row; failures
  keep the row and announce the reason.
- Service request and saved-item flows were not changed.

---

## 5. Responsive widths

**Method:** source-level audit at 320, 360, 390, 430, 768, 1024, 1280 and 1440
plus the existing CSS breakpoints. No browser binary is installed in this
sandbox, so this section is a code/layout audit, not a screenshot pass.

Changes made:

- Student KPI grid: 4 columns → 2 at 900 px → 1 at 520 px.
- Analytics grid: 2 columns → 1 at 900 px; the wide trend panel stops spanning.
- Overview actions become full-width at 520 px; profile name collapses to the
  avatar; header gap tightens.
- Student shell hides sidebar and header search at 768 px and uses the existing
  bottom navigation; content bottom padding stays 76 px for the bar.
- Profile identity row wraps, facts fall to one column at 760 px, save bar
  remains sticky inside the form.
- Admin top bar becomes a two-row grid with a menu button below 900 px; summary
  strip uses auto-fit; main padding drops to 16 px; tables scroll inside their
  own region.
- Delete icon becomes 44 × 44 under `pointer: coarse`.
- `a11y.css` keeps 16 px form text and 44 px coarse-pointer controls.

**Not verified:** actual rendered overflow at each width, keyboard tab order in a
real browser, and safe-area behaviour on iOS. Those require Playwright/Chromium,
which could not launch (see §8).

---

## 6. Performance

Measured after the final build:

| Check | Result | Budget |
| :--- | ---: | ---: |
| Entry chunk (gzip) | 46.2 KB | ≤ 100.0 KB |
| Supabase chunk (gzip) | 53.0 KB | ≤ 60.0 KB |
| Bundle CSS (gzip) | 45.1 KB | ≤ 51.0 KB |
| Critical path (gzip) | 205.7 KB | ≤ 211.0 KB |
| All chunks (gzip) | 355.9 KB | ≤ 356.0 KB |
| Largest image | 41.2 KB | ≤ 64.0 KB |
| Raster images | 310.4 KB | ≤ 320.0 KB |
| Other checks | pass | — |

`npm run perf:audit` reports **10/10 pass**. Removing the two dead stylesheets
is the main reason the CSS and critical-path figures fell; the dashboard rewrite
was kept inside the existing chunk budgets by deleting the old report/quick-action
markup and CSS rather than layering overrides.

---

## 7. Accessibility

- `npm run a11y:audit`: **0 blocking, 6 informational** (all decorative empty
  `alt` images, each next to a visible label).
- Focus ring: 2 px green (`#174A3A`) with `outline-offset: 0`, `a11y.css` last.
- Search remains a combobox with `aria-expanded`, `aria-controls`,
  `aria-activedescendant`, debounce status and empty/error messages.
- Admin page finder is a combobox with listbox options, active descendant,
  Escape/Arrow/Enter handling, and only capability-filtered destinations.
- Delete confirmation is announced with `role="group"` and an explicit label;
  the success/failure notice is `role="status" aria-live="polite"`.
- Save bar state is `role="status" aria-live="polite"`.
- Reduced motion: existing `prefers-reduced-motion` rules still disable shimmer,
  spinner and health-pill animation; no new animations were added.
- One icon library: lucide-react.

---

## 8. Test counts and commands

Commands actually run on this branch:

| Command | Result |
| :--- | :--- |
| `npm run typecheck` | **pass**, 0 errors |
| `npm test` | **1043 / 1043 pass**, 0 fail, 0 skipped |
| `npm run build` | **pass** |
| `npm run perf:audit` | **10 / 10 pass** |
| `npm run a11y:audit` | **0 blocking**, 6 informational |
| `npm run schema:audit` | **no blocking findings** |
| `npm run analytics:audit` | **7 / 7 pass** |
| `npm run rls:audit` | **52 / 52 public tables classified**, 0 findings |
| `npm run migrations:checklist` | **87 / 87 migrations listed** |
| `npm run audit:ci` | **0 vulnerabilities** |
| `npm run prod:validate` | expected environment failure: required `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` and `NODE_ENV` are not set in this sandbox; **0 passed, 1 failed, 2 skipped** (no secrets printed) |
| `npm run test:e2e` | **not executable here**: Chromium is not installed (`Executable doesn't exist at …/chrome-headless-shell`). Playwright reported 300 failed and 20 skipped, all at browser launch. |
| `npm run ci` | not claimed as a pass: it includes the e2e and mobile-performance stages that cannot launch a browser in this sandbox |

New tests: `tests/ux-audit.test.ts` (6 assertions) covers overview order, the
analytics-first structure, semantic colour, profile save copy, admin page finder,
and the `is_staff` grant.

---

## 9. Remaining problems

1. **Hosted production is still behind the repository by 11 migrations.** The
   live ledger ends at `20261023155533` apart from the two migrations applied
   here. The outstanding files start at `20261026120000_service_guides.sql` and
   include the CBT serving/deadline, question import, service boundary and CBT
   v2 migrations. I did not replay them blindly against a populated project.
   Reconcile each one and apply through a reviewed release process. Until then,
   deployed CBT and service behaviour may not match `main`.
2. **No rendered browser pass.** Chromium is unavailable, so screenshots,
   actual 320/360/390/430/768/1024/1280/1440 overflow checks, keyboard-only
   walkthroughs and the mobile-performance project were not run. The code-level
   responsive audit above is not a substitute.
3. **Admin tables on phones still scroll horizontally.** They keep their
   labelled `role="region"` wrapper, but a row-to-card transformation needs
   per-table column labels and was not attempted globally.
4. **Profile avatar is a data URL in the profile payload**, not an uploaded
   object. Persistence of the URL now works, but a large data URL is a poor
   long-term storage shape; move it to Supabase Storage in a dedicated change.
5. **Admin analytics has no daily time series.** The current API returns 24-hour
   and 7-day totals plus a 14-day activity window, not a day-by-day series, so no
   trend line was drawn. Adding one requires an API aggregation, not a client
   fabrication.
6. **Public profile needs a real signed-out smoke test** against the hosted API
   after the migration; the policy/table precondition is fixed, but this sandbox
   cannot make arbitrary HTTPS requests to the deployed site.
7. **Two dead legacy CSS files were removed, but other sheets remain.** The
   consolidation plan in `docs/architecture/STYLESHEET_LAYERS.md` is still
   staged; do not concatenate blindly without the visual suite that does not yet
   exist.

---

## 10. Git state

- Branch: `arena/c839064e-edureach-hub`
- Base: `d048916` (merge of PR #39)
- Working tree at report time: 30 modified files, 2 deleted files, 3 new files
  (including this report and `tests/ux-audit.test.ts`).
- No `git reset --hard`, `git clean -fd`, force push or staging environment was
  used.
- Hosted database changes: two additive, idempotent migrations
  (`public_profiles`, `repair_profile_write_policy`); no student row was deleted
  or rewritten. The RLS impersonation test ran in a rolled-back transaction.

---

## Phase summary

| Phase | Outcome |
| :--- | :--- |
| Discover | Route map, 46 pages, 40 components, 28 → 16 global sheets, analytics/profile/admin contracts |
| Audit | P0 profile write failure, P1 palette drift and decorative colour, P1 narrative dashboard, P1 duplicate search, P1 admin control inconsistency, P2 mobile/state gaps |
| Design system | Green action token, neutrals, quiet secondary, semantic status, one card/button rhythm |
| Application shell | Student header/sidebar/bottom nav; admin header/sidebar/page finder |
| Student dashboard | Analytics-first overview, KPI blocks, trend/subject/distribution, honest empty state |
| Student profile | Identity-first view, skeleton load, compact save states, persistence fixed end-to-end |
| Student workflows | Delete icon + confirmation + server result; search and navigation unified |
| Admin shell | Neutral summary, live timestamp, page finder, compact controls |
| Admin analytics | Honest missing-data copy, real recorded activity, semantic donuts/bars |
| Responsive | 4→2→1 grids, mobile shell, 44 px coarse targets, admin grid top bar |
| State pass | Skeletons, inline busy labels, safe error copy, specific success copy, live regions |
| Performance | 10/10 budgets, CSS 45.1 KB, critical path 205.7 KB, all chunks 355.9 KB |
| Final consistency | Tests, audits, docs and this report updated together |
