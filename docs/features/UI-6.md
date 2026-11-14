# UI-6 · Reporting-led admin, student analytics and calculator rebuilds

**Status:** delivered
**Surfaces:** every `/admin/*` route, `/dashboard`, `/tools/cgpa-calculator`,
`/screening-calculator`, `/cbt`, `/cbt/setup/:exam`, `/past-questions`.
**Touches:** `src/components/admin/AdminKit.tsx`, `src/admin-analytics.css`,
`src/student-dashboard.css`, `src/screening-calculator.css`,
`src/components/dashboard/CgpaCalculatorCard.tsx`,
`src/lib/studentDashboard.ts`, `src/components/ExamSimulatorGrid.tsx`,
`pages/Admin*Page.tsx`, `pages/StudentDashboardV2.tsx`,
`pages/ScreeningCalculatorPage.tsx`, `pages/CbtPage.tsx`,
`pages/ExamSetupPage.tsx`.

---

## 1. What changed

- **One analytics language.** `AdminKit` now exposes tone-aware `AdminSummary`
  cards and an `AdminPageReport` wrapper. Admin surfaces use a light grey canvas,
  white 14px-radius panels, a quiet navigation rail and 10px action buttons.
  Charts are CSS/SVG only: `AdminDonut` draws composition from real totals and
  no chart package was added.
- **Every admin route reports on its own rows.** Content Manager, Newsroom,
  Opportunities, Services, Service Queue, Schools, CBT, Bank Security, Question
  Imports, Users, Analytics, Data Control Center, Site & Policies and PDF Bank
  each render a report built from the data it already fetched. No page invents a
  trend the API did not return; Bank Security keeps its existing summary strip.
- **Student progress analytics.** `/dashboard` now adds latest CBT score, current
  CGPA, open service requests and profile completion, plus a CGPA-by-saved-term
  chart. `fetchCgpaSnapshots` reads the existing `student_cgpa_terms` table; the
  table has no scale column, so stored terms are treated as 5.0 records and local
  4.0 snapshots stay device-only, exactly as before.
- **CGPA calculator.** 4.0/5.0 segmented switch, an editorial result panel,
  roomy per-field labels, and a save area that is not a row of button-looking
  tiles.
- **Screening calculator.** Deliberately different from the CGPA workspace: a
  form column beside a deep-navy gauge panel, formula choice as descriptive
  tiles, and contributions expressed as bars.
- **CBT catalogue truth.** `ExamSimulatorGrid` and `/cbt` no longer apply a
  second `question_count >= 5` filter that could hide banks the API returned.
  Availability is stated on the card; the setup/bank payload remains the final
  arbiter. The duplicate "No active CBT question bank" notice on the setup page
  was removed because the context-specific notice already covers the state.
- **Spacing.** Interactive cards get real padding and relaxed line height;
  guide/link rows get 44px targets. Borrowed cards keep their own action styling
  rather than a filled primary button inside a card.

## 2. Data honesty

Reports count only the rows already loaded by the page and say so where the API
is capped (for example the 200-record queue). Nothing is extrapolated, and no
availability decision is made in two places.

## 3. Verification

`npx tsc --noEmit` 0 · `npm test` 1035/1035 · `npm run build` OK ·
`npm run perf:audit` 10/10 (all chunks ≤ 356 KB) · `npm run a11y:audit`
0 blocking / 6 informational · `npm run schema:audit` clean · route checks 200.
