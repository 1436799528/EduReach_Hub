# UI-8 · Thin focus, Post-UTME back, arrow cards, live news and a centred mobile shell

**Status:** delivered
**Surfaces:** every form and search field, `/`, `/news`, `/past-questions`,
`/cbt`, `/jobs`, `/school-finder`, `/schools/:slug`, `/screening-calculator`.
**Touches:** `src/styles/a11y.css`, `src/edu-portal.css`,
`src/components/ExamSimulatorGrid.tsx`, `pages/HubHomePage.tsx`,
`pages/NewsPage.tsx`, `pages/PastQuestionsPage.tsx`, `pages/CbtPage.tsx`,
`pages/JobsPage.tsx`, `pages/SchoolFinderPage.tsx`,
`src/components/HubLayout.tsx`, `src/components/CookieConsent.css`,
`src/auth-page.css`.

---

## 1. Focus follows the control

- The blue "ink line" that appeared after a click is gone. Keyboard focus now
  draws a **2px ring with no offset** directly on the control's own edge, so it
  follows the field's radius instead of floating outside it. A global
  `box-shadow: none` stops the old glow from doubling the line.
- Inside the shared search fields (`site-search`, `er-filter-search`,
  `hub-global-search`, `hub-search`, library and school-finder searches) the
  inner input's outline is suppressed. The **container** draws a 1px navy
  ring with `:focus-within`, so a search box highlights as one box rather than
  the bare input inside it.
- Focus rings on the dark header and bottom navigation switch to a light tone
  so they stay visible against navy.

## 2. Post-UTME is a main simulator again

- `ExamSimulatorGrid` keeps four main cards: JAMB, WAEC, NECO and **Post-UTME**.
  The Post-UTME card is first-class (`post-utme-main`) and points at the real
  flow, `/cbt/setup/post-utme`, where the student picks a verified school and a
  paper. A live catalogue row still replaces its fallback, so it never appears
  twice.

## 3. One arrow instead of competing CTAs

- Simulator feet, news cards, exam-material cards, past-question cards, CBT
  cards, job cards and school-finder results use a single **thin arrow**
  (`.er-card-arrow`). The old "Open set-up", "Practice", "Open" and "View"
  button pairs are gone; the cards' titles and badges already explain them.
- The arrow slides 3px on hover, under `(hover: hover) and (pointer: fine)`.

## 4. Cards move on hover

- Public card surfaces — simulators, news, materials, featured items, banks,
  opportunities, school-finder results, school details, screening results and
  the sidebar/home cards — lift **3px** with a soft shadow on pointer devices.
  Motion is disabled under `prefers-reduced-motion: reduce`.
- The effect is attached to the card itself, so links inside it keep their own
  hover states.

## 5. News cards are back, current stories only

- `/` and `/news` render `NewsCard` again. Both lists drop expired notices with
  `isArticleCurrent` (expired/archived/superseded status or a past `expires_at`)
  and sort by `published_at` newest first; the home feed keeps the latest four.
- If every stored story is stale, the page says so instead of showing an empty
  grid. The freshness badge on each row still comes from `newsFreshness`.

## 6. Mobile fits, it does not redesign

- The simulator grid stops being a horizontal carousel at ≤640px and becomes a
  single column of the same cards at 176px, stacked in reading order. Card
  shapes, radii and contents are unchanged; only the grid fits the viewport.
- Footer columns are centred at every breakpoint: the brand spans a centred
  two-column row at ≤900px and one column at ≤640px. No column is left hanging
  on one side.
- The cookie settings pill keeps the same surface, border and shadow on hover
  and active, so it no longer looks like a hover card.

## 7. CBT in the middle

- The mobile bottom bar is Home · News · **CBT** · Services · Account. CBT is
  the centre grid column, 1.25× wider, 56px tall, filled navy with a 22px icon
  and a 14px radius — the primary action, not another equal tab.

## 8. Payload

The work removed dead UI CSS that no page referenced (old guide strip,
simulator/bank CTA buttons, auth intro/benefit rules, the retired home-updates
block) rather than raising a budget. `BUDGETS` in `scripts/perf-audit.ts` is
unchanged.

## 9. Verification

`npx tsc --noEmit` 0 · `npm test` 1037/1037 · `npm run build` OK ·
`npm run perf:audit` 10/10 (critical path 211.0 KB ≤ 211, all chunks
355.8 KB ≤ 356, CSS 50.5 KB ≤ 51) · `npm run a11y:audit` 0 blocking /
6 informational.
