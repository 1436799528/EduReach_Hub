# EduReach Hub — mobile audit

**Date:** 16 November 2026 (UTC)  
**Branch:** `arena/83ba49ac-edureach-hub`  
**Status:** **Partially verified.** Source-level, accessibility, interaction, and performance checks pass. Rendered mobile geometry and browser accessibility remain unverified because Playwright Chromium is not installed and its download is blocked in this environment.

## Scope

Reviewed the mobile shell and bottom navigation, common public pages, CBT simulator cards, form sizing, responsive overflow coverage, the notification trigger and delete actions, and the existing mobile accessibility/performance gates. No production services or student data were accessed.

## Findings

### M1 — Rendered-device verification is blocked

The focused `mobile-chromium` Playwright run was attempted for the simulator-card and route-overflow tests. Both stopped before opening a page: Playwright's Chromium headless executable is missing at `/home/user/.cache/ms-playwright/...`. The earlier browser install attempt failed to reach `cdn.playwright.dev` (`ECONNRESET`). These are **environment launch failures**, not failing layout assertions.

**Impact:** Actual viewport wrapping, clipping, browser zoom, touch hit areas, and rendered axe results cannot be certified from this run. GitHub Actions installs Chromium in its production-check workflow; rerun the mobile project there or in an environment with the pinned browser available.

### M2 — Mobile regression coverage is broader, but still awaits execution

The home page and school finder already had rendered overflow checks. I added a narrow-screen sweep for `/`, `/services`, `/news`, `/cbt`, `/past-questions`, and `/login` at 320, 360, 375, and 390 CSS pixels. I also removed an opt-in environment gate from the mobile simulator-card test: it already provides its own mocked bank API response, so it should run in the normal mobile E2E project.

**Status:** The new browser tests are added in this working tree, but remain unexecuted because of M1.

## Checks that did run

- 64 focused source-level tests passed, covering mobile/a11y posture, interaction states, responsive reservation rules, and site/home experience.
- `npm run typecheck` passed.
- Static accessibility audit: 0 blocking findings (6 informational).
- Static performance audit: 10/10 budgets passed.
- The floating notification trigger is 32×32 CSS pixels on fine pointers and 44×44 on coarse pointers, with no border or filled card surface.
- Delete controls use a 30×30 visual control with a small glyph on fine pointers; coarse pointers retain a transparent 44×44 target. Desktop/mobile dashboard, history, and result actions share the unboxed treatment.
- The existing Playwright tests also check 16px mobile form text, 44px mobile navigation/search controls, compact footer clearance, and home overflow across 320–1280px; the school finder is checked at 375px. Those browser assertions were not rerun here.

## Next verification

Run the mobile Chromium project after the browser is available:

```bash
npx playwright install chromium
npx playwright test tests/e2e/site.spec.ts --project=mobile-chromium
```

Then run the mobile performance and rendered axe checks through the full CI gate. Until those run, the report is a source-level mobile audit, **not** a completed rendered-device certification.
