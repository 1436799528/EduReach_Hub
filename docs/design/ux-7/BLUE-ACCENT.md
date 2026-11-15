# Blue accent follow-up

**Status:** implemented on the UX-7 branch; not deployed.
**Date:** 2026-11-13
**Scope:** colour tokens and the surfaces that named the old green directly. No
layout, navigation, CBT protocol, data or copy changes.

## 1. Decision

The deep green action colour (`#174A3A`) was replaced by cobalt blue
**`#1E40AF`**. The reason is semantic, not decorative: blue now owns every
primary action, while green is reserved for **Passed, Correct and Completed**.
A student can tell at a glance whether a green surface is a result rather than
something to press.

`#1E40AF` was chosen over the lighter cobalt `#1D4ED8` because it keeps a clear
step between the resting, hover and pressed fills while clearing WCAG AA with
white text at every step.

## 2. Palette

All values live in `src/styles/theme.css`; component sheets consume the tokens.

| Role | Token | Value | Contrast |
| :--- | :--- | :--- | :--- |
| Primary | `--er-primary` | `#1E40AF` | 8.72:1 with white |
| Hover | `--er-primary-hover` | `#1E3A8A` | 10.36:1 with white |
| Pressed | `--er-primary-active` | `#172554` | 14.69:1 with white |
| Border | `--er-primary-border` | `#1E3A8A` | — |
| Border hover | `--er-primary-border-hover` | `#172554` | — |
| Border pressed | `--er-primary-border-active` | `#0F172A` | — |
| Focus | `--er-primary-focus` | `#1E40AF` | 8.72:1 on white |
| Selected surface | `--er-primary-soft` | `#EEF2FF` | 7.8:1 for primary text |
| Selected edge | `--er-primary-soft-border` | `#C7D2FE` | — |
| Navigation selection | `--er-nav-active-bg` | `#EEF2FF` | 7.8:1 for primary text |
| Academic surface | `--er-surface-academic` | `#EEF2FF` | — |
| Elevated / deep | `--er-surface-elevated` / `--er-surface-deep` | `#E0E7FF` / `#C7D2FE` | — |

White text on the resting fill is **8.72:1**, comfortably above the 4.5:1 AA
floor; the focus ring clears the 3:1 non-text requirement on both white and the
selected surface.

## 3. Semantic split

- **Blue:** primary buttons, primary links, selected navigation, tabs, filters,
  steps, selected answer options, current-question outline, form focus and
  `accent-color`, score ring and subject bars.
- **Green:** Passed, Correct, Completed, saved/success notices, valid fields and
  the bank-security “public/permitted” state. The old semantic status tokens
  (`--er-status-success`, `--er-success`) were not changed.
- **Crimson:** unchanged. Brand accent and destructive actions only.

The CBT result is the clearest check: the score ring and subject bars are blue,
while the **Correct** count and mark stay green.

## 4. What changed

- `src/styles/theme.css`: primary ramp, navigation selection, academic surfaces.
- `src/styles/a11y.css`: focus-ring fallback.
- `src/styles/brand-actions.css`, `src/styles/ux5-product.css`: fallbacks,
  shadows and the home resume strip.
- Legacy brand blues that predated the green action colour were consolidated on
  `#1E40AF` (`hub.css`, `admin.css`, `admin-analytics.css`, `compact-portal.css`,
  `auth-page.css`, `edu-portal.css`, `screening-calculator.css`,
  `student-dashboard.css`, `site-search.css`, `CookieConsent.css`, card/avatar
  accents). The wordmark navy token `--er-brand-navy: #0A3E83` is deliberately
  unchanged; it is a logo colour, not the action colour.
- `src/bank-security.css`: actions and selection are blue; the
  public/permitted state remains green.
- `index.html`: browser theme colour follows the action blue.
- Contract tests `tests/brand-colors.test.ts` and
  `tests/interaction-states.test.ts` now pin the blue ramp.
- Current specs were updated: `docs/COLOR_THEME_SPEC.md`,
  `docs/design/ux-5/design-system.md`, `docs/DESIGN_RULES.md`,
  `docs/PAGE_QUALITY_GATE.md`, the UX-5 architecture summary, the UX-6 action
  wording and the UX-7 case study.

Historical audit documents keep their original green values; they describe the
state of the product at the time they were written.

## 5. Verification

Run on the UX-7 branch after the change:

| Gate | Result |
| :--- | :--- |
| `npm run typecheck` | pass |
| `npm test` | 1069 passed, 0 failed, 0 skipped |
| `npm run build` | pass |
| `npm run perf:audit` | 10/10; CSS 49.8/51 KB, critical 213.2/214 KB, all chunks 365.3/366 KB |
| `npm run a11y:audit` | 0 blocking, 6 informational |
| Playwright full suite, desktop + mobile | 293 passed, 29 skipped |
| Playwright site + a11y, desktop + mobile | 165 passed, 5 skipped |
| `mobile-perf`, `/past-questions` | LCP 2324 ms, CLS 0 |

Evidence is in [`evidence/after-blue/`](evidence/after-blue/): guest and
signed-in home, dashboard overview at 1440/390, My CBT, setup, a scored result
and a live session. The earlier `evidence/after/` set is kept as the UX-7
before-accent record and still shows the green accent.

**Not verified:** no hosted deployment, no real-user testing, no live admin
console or configured CBT question bank. The signed-in and result captures use
the local preview account and a synthetic result payload; they exercise the
real rendered UI, not production data.
