# UX-8 — one search, one action system, one page measure

UX-8 is a consolidation pass, not a visual redesign. The card system, the
typography scale, the blue action accent and the compact footer from UX-7 are
unchanged in intent. This document records what became canonical, what was
removed, and which existing tests were rewritten because they pinned the old
duplicates.

## Decision recorded before the colour work

The UX-8 brief names **deep green `#174A3A`** as the primary action colour. The
shipped and reviewed UX-7 decision is **blue `#1E40AF`**, with green reserved
for success. This pass keeps the shipped blue. It does not silently replace a
reviewed decision, and it does not add a second "UX-8 green" palette. A future
green direction is a token change (`--er-primary`, hover and active), not a
component rewrite.

While tracing that conflict, one real defect surfaced: `src/edu-portal.css`
still declared `:root { --er-primary: #b14933 }` **after** `theme.css`. That
late duplicate turned the primary token crimson on public pages even though the
token layer, the tests and the UX-7 case study said blue. The duplicate root
block and its crimson `.hub-primary-btn:hover` were removed. There is now one
definition of `--er-primary` in `src/styles/theme.css`.

## Canonical search

One component (`src/components/SiteSearch.tsx`) and one stylesheet
(`src/site-search.css`) serve five placements:

| Placement | Mount | Width rule |
| :--- | :--- | :--- |
| header | `HubLayout` | 250 px, hidden below 1240 px (the shell's header-fit rule) |
| drawer | `HubLayout` | full width of the drawer |
| home | `HubHomePage` | share of the greeting row, capped at 380 px; 100% below 768 px |
| page | `SearchPage` | 100% of the 820 px reading column |
| dashboard | `StudentDashboardV2` | `min(440px, 100%)`, hidden below 768 px |

Shared, not per-variant:

- 48 px minimum height (50 px rendered with the 1 px border and 2 px padding);
  44 px minimum submit target.
- 9 px radius, 16 px leading search icon, same icon position.
- 14 px field type, same placeholder colour and truncation behaviour.
- Same neutral submit treatment (`#f1f5f9` / `#334155`) — search is a utility,
  not the page's primary action.
- Same focus ring in the primary token, drawn on the control rather than the
  raw input.
- Same clear control. The native WebKit search cancel button is suppressed so
  Chromium, Safari and the product's own clear button cannot appear together.
- Same submit label: `Search`. The old `submitLabel="Go"` overrides on the
  header and dashboard were removed along with the prop.
- Same keyboard, suggestion, loading, partial-failure and empty states.

The seven older search treatments that had no markup left were deleted rather
than kept as fallbacks: `.hub-search`, `.hub-home-search`,
`.hub-global-search`, `.hub-mobile-search`, `.hub-desktop-search`,
`.ms-search-input`, `.edureach-dash-search`, `.student-search`,
`.er-search-page-form` and `.er-site-search-page-form`.

`src/components/ui/FilterSearch.tsx` remains separate on purpose. It filters a
list in place; it is not the navigation search.

## Primary actions

`src/styles/brand-actions.css` remains the only layer that decides button
colour. One `:is(...)` primary set now covers:

- `.hub-primary-btn`
- `.er-exam-submit`
- `.er-exam-submit-primary`
- `.auth-submit` (excluding its secondary modifier)

It defines rest, hover, pressed, disabled and busy. The disabled group also
covers `.admin-btn`, `.dash-btn-primary`, `.auth-v2-submit`, `.er-exam-next`
and `.er-exam-end`.

`pages/CbtSessionPage.css` no longer hardcodes `#1E40AF` / `#1E3A8A`; it uses
`--er-primary` and `--er-primary-hover`. Exam submit, auth submit, dashboard
submit and the public primary all read the same token. There is no page-specific
primary fill in the source any more.

Secondary controls remain the existing white surface with a neutral edge. The
card system, selected states, destructive styles and success styles are
untouched.

## One page measure

`src/styles/theme.css` is now the only place that defines page width and
gutters:

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--page-max-width` | 1180 px | the product container |
| `--page-max-detail` | 920 px | index/detail columns (`hub-narrow`) |
| `--page-max-reading` | 820 px | policy pages and search (`er-reading-container`) |
| `--page-max-form` | 760 px | setup, calculator and apply forms |
| `--page-max-compact` | 640 px | short message pages |
| `--page-gutter` | 28 px | desktop |
| `--page-gutter-tablet` | 20 px | ≤1024 px |
| `--page-gutter-mobile` | 16 px | ≤640 px |
| `--section-gap` | 32 px | page rhythm |
| `--content-gap` | 16 px | related copy |

`.hub-container` and `.hub-home-container` share one rule. At 1440 px it renders
130 px inset / 1180 px wide; at 1080 px it is 20 px inset / 1040 px wide; at
390 px it is 16 px inset / 358 px wide; at 320 px it is 16 px inset / 288 px
wide. No page stretches past 1180 px.

Removed conflicting overrides:

- `compact-design-system.css`: `1240px !important`, `100% - 20px !important`,
  `100% - 16px !important`.
- `compact-structural.css`: `1180px !important` on `.hub-container` and
  `.hub-home-container`, and the `100% - 12px !important` mobile rule.
- `compact-portal.css`: duplicate `.hub-container` widths and the
  `.hub-global-compact` 1440 px override.
- `home-card-first.css`: the `1240px !important` home container.
- `edu-portal.css`: `.er-container` 1120 px (the home markup now uses
  `.hub-home-container`).
- `ux5-product.css`: the ≤640 px container revert.
- `cbt-engine.css`: duplicate `.hub-container` max-width.
- `myschool-clean.css`: the dead `.edureach-landing > .hub-container` widths.

Page-level inline `maxWidth` numbers were replaced with the named classes:
CBT practice (720 → form), CGPA calculator (760 → form), Coming Soon (640 →
compact), Events (820 → reading), Past Questions (980 → detail), Service Apply
(760 → form), NotFound (600 → compact) and Search (940 → reading). Layout
numbers now live in CSS once.

## Footer pages and footer navigation

Privacy, Terms, Cookies, Contact and About use `.er-legal-page` +
`.hub-container .er-legal-container`: an 820 px measure centred inside the
1180 px container. At 1440 px the column is x=310, w=820 (before: x=130,
w=1180 with the text pinned to the left). At 1024 px it is x=102, w=820. At
768/430/390/360/320 it fills the container with normal gutters.

Search uses the same reading measure and section rhythm, so a policy page and
the search page no longer disagree about where a document lives.

The About page's `About EduReach` eyebrow was removed. It rendered outside
`.hub-page`, so the existing rule that hides page eyebrows did not reach it.

Footer navigation is now two named groups in one landmark
(`Footer: company and policies`):

- company: About, Contact
- policies: Terms, Privacy, Cookies, Cookie settings

Desktop shows a hairline between the groups. At ≤640 px the groups keep their
internal spacing and the divider while both fit on one line; at ≤360 px the
divider is dropped because the second group necessarily wraps. Footer heights:
57 px at 1440, 95 px at 768, 143 px at 390/430, 189 px at 320/360 (the extra row
is the wrapped policy group, not padding).

## Cleanup log

Measured, not estimated:

- Source diff: **30 files, +204 / −308 lines (net −104)**.
- Bundle CSS (gzip): **49.3 KB → 47.9 KB**.
- Entry chunk: **48.6 KB** unchanged.
- Critical path (gzip): **212.3 KB → 210.9 KB**.
- All chunks (gzip): **365.3 KB → 365.4 KB** (within the 366 KB budget).

Removed from CSS (all with zero TSX references before deletion):

- 10 legacy search selectors listed above; their focus/placeholder/a11y
  participation and the duplicate `:root` groups were removed with them.
- The abandoned `.er-banner` / `.er-banner-art` home banner rules and their
  media variants.
- `.hub-home-footer-callout` (already absent from the home markup).
- `.hub-footer*`, `.hub-auth-*`, `.hub-field`, `.hub-full-btn` and
  `.hub-auth-switch` from the legacy `hub.css`; the `.hub-auth-switch` links
  were also removed from `brand-actions.css` and `edu-portal.css`.
- The legacy `hub.css` `:root` palette and the duplicate 11-variable palettes in
  `compact-portal.css` / `theme.css`. `--hub-*` now survives only for the four
  card-tone variables that have no theme equivalent.
- `.hub-narrow` and `.hub-container` duplicate declarations from `hub.css`.
- `.edureach-landing` container widths and the `.er-container` home width.
- `.student-search` (dashboard drawer), `.edureach-dash-search` (dashboard
  header) and `.ms-search-input` styles.
- The `.hub-desktop-search` media rule.

Tokens consolidated:

- `--er-primary` is defined once (the late crimson override is gone).
- 12 legacy `--hub-*` aliases (11 colours plus the 14 px radius) replaced with their `--er-*` token across CSS.
- New page tokens (nine above) plus `--er-radius-panel: 14px`, which preserves
  the three existing 14 px card/panel radii that would otherwise have been
  rounded down by the 10 px `--er-radius` token.
- Removed unused `--hub-card-gap`, `--hub-border-soft`, `--hub-purple`,
  `--hub-red` and the duplicate unused `--er-density-gap` / `--er-accent`
  block.

Components and files:

- **Files deleted: 0.** No component became orphaned; the replaced search
  treatments were CSS-only, so no `SearchBar` / `GlobalSearch` / `PageSearch`
  components were created or deleted.
- **Components consolidated: 1** — `SiteSearch` now owns the icon, clear action,
  submit label and all states for every placement.
- **Button families folded into the canonical primary set: 2** —
  `.auth-submit` and `.er-exam-submit` / `.er-exam-submit-primary`.
- **Dead TS removed: 0** — `noUnusedLocals` and the component/import scan found
  no genuinely unused exports. The only TS deletions are the removed
  `submitLabel` prop, its two call-site overrides, the dead `hub-field` /
  `ms-search-input` a11y attribution notes and the obsolete footer array split.

Tests rewritten because they pinned the duplicates, not to hide a regression:

- `tests/home-search.test.ts` and `tests/site-experience.test.ts`: assert one
  canonical 48 px height and that variants no longer override it.
- `tests/brand-colors.test.ts`: the curated recolour list now names the
  `:is(...)` primary set; legacy `--hub-*` names are no longer expected.
- `tests/interaction-states.test.ts`: disabled/busy lookups target the primary
  and secondary `:is(...)` groups explicitly.
- `tests/site-content.test.ts`: the footer source is two link groups; the
  rendered landmark is `Footer: company and policies`.
- `tests/e2e/site.spec.ts` and `tests/e2e/legal-review-mocked.spec.ts`: the same
  landmark name.
- `scripts/a11y-audit.ts`: removed two attribution notes for selectors that no
  longer reset an outline.

## Verification

- `npm run typecheck` — clean.
- `npm test` — 1070 / 1070 pass.
- `npm run build` — clean.
- `npm run perf:audit` — 10 / 10.
- `npm run a11y:audit` — 0 blocking, 6 informational.
- Playwright desktop + mobile — 297 passed, 29 skipped (see the gate log below).
- `npm run e2e:perf` — mobile performance gate passes. LCP on `/` measured
  2.30–2.41 s across runs in this session; the gate is comfortably inside its
  budget, but the run-to-run drift is larger than any UX-8 byte change, so the
  comparable numbers are the static budgets below, not a single LCP sample.

No horizontal overflow at 320, 360, 390, 430, 768, 1024, 1280 or 1440 in the
measured matrix (`scrollWidth === innerWidth` on every page).

## Gate log

```
typecheck      pass
test           1070 pass / 0 fail
build          pass
perf:audit     10 / 10
a11y:audit     0 blocking / 6 info
playwright     297 passed / 29 skipped
mobile-perf    pass
```
