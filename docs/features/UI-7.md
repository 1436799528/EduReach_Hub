# UI-7 · Calmer sign-up, readable legal links, exam-first home and a four-column news grid

**Status:** delivered
**Surfaces:** `/register`, `/login`, `/verify-email`, `/`, `/news`,
`/past-questions`, `/dashboard` (Tools), `/screening-calculator`,
`/cbt/setup/:exam` (Post-UTME).
**Touches:** `pages/AuthPageV2.tsx`, `src/auth-page.css`,
`src/components/CookieConsent.tsx`, `src/components/CookieConsent.css`,
`pages/HubHomePage.tsx`, `src/components/ExamSimulatorGrid.tsx`,
`pages/NewsPage.tsx`, `src/components/NewsSections.tsx`,
`pages/PastQuestionsPage.tsx`, `pages/ScreeningCalculatorPage.tsx`,
`src/components/dashboard/CgpaCalculatorCard.tsx`,
`pages/ExamSetupPage.tsx`, `src/edu-portal.css`, `src/student-dashboard.css`.

---

## 1. Account creation

- The age/terms agreement now sits **directly above the submit button**. The
  paragraph above it is one sentence; the long "what we collect / open in a new
  tab" disclosure is gone.
- Terms of Service and Privacy Notice are real, visibly underlined links with a
  3px focus ring; they open in a new tab so a half-filled form is not lost.
- The "use email, phone, Google or Apple" sub-heading is removed. Sign-up keeps
  only the mode tabs and the fields they need.
- Parent and teacher options read exactly "not available yet" — no explanation
  about dashboards being built and no contact link.
- **Email registration now has the same code step as phone registration.**
  After `signUp` returns no session, `/verify-email` accepts a 6-digit code and
  calls `verifyOtp({ email, token, type: 'signup' })`. The emailed link remains
  usable. The Supabase "Confirm signup" template must include the token for the
  code to arrive; the UI states that a code was sent only after a successful
  sign-up response.
- The cookie panel no longer changes background on hover. Its legal links are
  underlined, keyboard-focusable and open in a new tab; the floating settings
  pill keeps the same surface on hover.

## 2. Scores, calculators and CBT

- The screening calculator caps **both fields at 400**, enforced while typing
  rather than only in the calculation. Post-UTME values up to 100 are read as a
  percentage (the usual printed scale); values above 100 are read on a 400
  scale, so neither convention becomes an impossible aggregate. Both fields use
  numeric keyboards and documented hints.
- The CGPA calculator now owns the full Tools width. Its estimate is a deep-navy
  panel with the same large value, contribution rule and quiet footnote as the
  screening calculator; the old half-width column that made the course table
  look squeezed is gone.
- Selected CBT subjects keep removal, but the action is an **icon-only X**
  (36px, labelled `Remove <subject>` for assistive technology). The subject
  group and Post-UTME school selectors use one labelled field style instead of
  inline admin-form styles; the school copy is one line plus the verified
  source link.

## 3. Home, past questions and news

- The home page names **JAMB, WAEC and NECO** again in an "Exam materials" row,
  each linking to its filtered past-question view. The CBT catalogue also keeps
  those three main examinations visible even while a bank is being prepared;
  a live catalogue card replaces its fallback, so cards never duplicate.
- `/past-questions` keeps every exam body, including school-specific Post-UTME
  materials. Exam matching is normalised (`POST UTME`, `Post-UTME`, `postutme`
  all match), which is what made the Post-UTME filter appear broken. A live
  result count confirms the filter and search state.
- The library toolbar is a full-width search row above a filter row, so the
  search can no longer look pinned to one side.
- News cards use **four columns like the CBT simulators**, on both `/news` and
  the home updates feed. Unlike the simulator grid they wrap — 4 → 2 → 1 — and
  never become a horizontal scroller.

## 4. Verification

`npx tsc --noEmit` 0 · `npm test` 1036/1036 · `npm run build` OK ·
`npm run perf:audit` 10/10 (critical path 210.8 KB ≤ 211, all chunks
355.9 KB ≤ 356) · `npm run a11y:audit` 0 blocking / 6 informational ·
`npm run schema:audit` no blocking findings · 15 sampled routes 200.
