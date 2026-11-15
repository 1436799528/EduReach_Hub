# Compact footer follow-up

**Status:** implemented on the UX-7 branch; not deployed.
**Date:** 2026-11-13
**Scope:** the shared site footer and the shells that render it. No CBT
protocol, scoring, request or account logic changed.

## 1. Decision

The footer was a second sitemap: four columns, fifteen links, a contact note, a
social strip, a three-line independence disclaimer and a separate policy row.
On a phone it grew past 300 px and sat under the fixed bottom navigation. It is
now **one compact bar** with the identity/copyright line and the destinations a
visitor needs from any screen:

**About · Contact · Terms · Privacy · Cookies · Cookie settings**

The brand name and year still come from site settings. The links are code
because each one resolves to a real route. The independence line stays in the
bar, shortened to one sentence.

## 2. What changed

- `src/components/SiteFooter.tsx` is one flex bar (`er-footer-bar`) instead of a
  four-column grid. The Learn, Explore and Get help columns, the social strip and
  the long contact note are removed.
- `/about` is a real route (`pages/AboutPage.tsx`) and uses the admin-managed
  `footer.about` sentence, so the About link is not a dead end and the sentence
  still has one home.
- `src/edu-portal.css` owns one compact footer block. The old grid, heading,
  bottom-row, mobile and centred-override rules are gone, as are the dead
  WhatsApp/social rules in `src/styles/a11y.css`, `src/styles/ux5-product.css`
  and the 76 px mobile override in `src/cbt-engine.css`.
- `pages/LegalPage.tsx` and `pages/RefundPolicyPage.tsx` no longer render their
  own `er-legal-foot`; those pages were showing two footers inside `HubLayout`.
  `pages/AuthPageV2.tsx` no longer renders `auth-footer`; it uses the shared
  bar. The old auth footer style is removed.
- The shared bar is mounted in `HubLayout` (public and legal pages),
  `AuthPageV2`, `StudentDashboardV2` and every `CbtSessionPage` return state.
  The examination hall still has no site header and no navigation away; the
  compact footer is the one global element at the bottom, so consent and the
  policies remain reachable during a paper.
- `@media print` still hides the footer.

## 3. Mobile and safe areas

- The bar has `padding-bottom: calc(12px + env(safe-area-inset-bottom))`.
- On the dashboard, `.edureach-dash-container` reserves
  `calc(66px + env(safe-area-inset-bottom))` below the footer for the fixed
  `.er-mobile-bottom-nav` (58 px high). The 8 px difference is deliberate: a
  measured 58 px reservation left the footer and nav touching at a fractional
  pixel.
- Public pages keep the existing `.hub-shell` reservation above the bottom nav.
- The footer links stay at 44 × 44 px touch targets through `a11y.css`; the bar
  wraps instead of overflowing. At 390 px the legal row still fits on one line;
  at 320 px it wraps to a second line.

## 4. Rendered measurements

Chromium at 1440 × 1000 and 390 × 844, after dismissing the consent card:

| Surface | Desktop (1440) | Mobile (390) | Narrow (320) |
| :--- | ---: | ---: | ---: |
| Home, About, Terms, CBT | 57 px | 143 px | 187 px |
| Login / auth | 60 px | 147 px | 191 px |
| Dashboard | 60 px | 147 px | 191 px |
| CBT examination hall | 60 px | 147 px | 191 px |

After scrolling to the bottom, public pages end **4 px** above the mobile
bottom nav and the dashboard ends **8 px** above it; no link is covered. The
extra 4 px on the dashboard is the deliberate 66 px reservation described in
§3. At 320 px the legal row wraps to a second line and the footer grows, but the
page still has no horizontal overflow.

## 5. Tests

- `tests/site-content.test.ts` pins the one-bar structure, the five links, the
  consent button, the independence line and the fact that every shell imports
  `<SiteFooter />` while no page keeps a second footer.
- `tests/site-experience.test.ts` keeps the dark-surface contrast checks, adds
  the safe-area rule and rejects the old grid classes.
- `tests/e2e/site.spec.ts` checks the same bar on `/`, `/about`, `/terms`,
  `/cookies`, `/contact` and `/login`, its height, and clearance above the
  mobile bottom nav.
- `tests/e2e/legal-review-mocked.spec.ts` now follows **Terms** through
  `Footer: policies` instead of the removed “Other policies” block.
- `tests/e2e/cbt-failure-mocked.spec.ts` asserts the compact footer is present
  in a live examination.
- Cookie settings remains covered by `tests/e2e/privacy.spec.ts`, which reopens
  the panel from the footer after a reload.

## 6. Gates at this change

- `npm run typecheck`: 0 errors.
- `npm test`: 1070 passed / 0 failed.
- `npm run build`: success.
- `npm run perf:audit`: 10/10 (CSS 49.3 KB of 51 KB; critical path 212.3 KB of
  214 KB; all chunks 365.3 KB of 366 KB).
- `npm run a11y:audit`: 0 blocking / 6 informational.
- Playwright desktop + mobile: **297 passed / 29 skipped**.
- `mobile-perf` profile: passed; `/past-questions` CLS **0** (LCP varies by
  run between roughly 2.2 s and 2.5 s on the throttled profile).
