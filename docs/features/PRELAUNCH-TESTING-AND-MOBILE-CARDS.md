# Pre-launch testing switch and mobile card fixes

**Date:** 2026-11-18  
**Branch:** `arena/00e3bbdd-edureach-hub`  
**Status:** implemented locally; not pushed, deployed, merged or committed unless a later request asks for it.

## 1. Email verification is disabled for production

Users can create an email/password account and enter the site immediately without mandatory email confirmation:

| Layer | Production state | Description |
|---|---|---|
| Frontend | Unconditional direct registration in `pages/AuthPageV2.tsx`. Users register and are automatically signed in with an active session. Old `/verify-email` links provide a clear notice that verification is not required and direct to login. | Immediate registration flow without inbox confirmation wall. |
| Supabase Auth | Production project `gjdfatwcoosyuhakrrhh` (`EduReach-V1`) has `mailer_autoconfirm=true`, verified with `get_auth_config`. | Passwords and accounts are confirmed on creation; password-reset emails remain active via SendGrid SMTP. |

The original eight-digit OTP verification UI, `verifyOtp({ type: 'signup' })`, resend action and `/verify-email` route remain in `pages/AuthPageV2.tsx` behind the switch. No auth infrastructure was removed. `.env.example`, `.env.production.example` and `src/vite-env.d.ts` document/type the flag.

**Caveat:** `mailer_autoconfirm` applies to new signups. Accounts created before this change that are still unconfirmed are not retroactively confirmed; those testers should sign up again or be confirmed manually. `mailer_allow_unverified_email_sign_ins` remains false. Phone OTP, OAuth, terms consent, CBT and admin auth are unchanged.

## 2. News page fits a phone like the other public pages

The old phone layout reserved a 450px skeleton-height region even when the news feed was empty, then stacked the desktop side rail underneath it where the fixed bottom navigation covered its content.

- `src/styles/ux5-product.css` now collapses `--er-late-min` for empty/error feed states and empty simulator states, so a one-line empty state does not leave a feed-sized blank.
- At `≤620px`, `.hub-side-rail` is hidden. It duplicated the bottom navigation and the Services/News pages; it remains visible on desktop.
- Desktop side rail, news cards, category filter and search are unchanged.

## 3. Homepage simulator cards use the Services phone card setup

`pages/HubHomePage.tsx` now passes four `BUILTIN_SIMULATOR_CARDS` to `ExamSimulatorGrid` with `deferCatalogue`:

- JAMB UTME, WAEC SSCE, NECO SSCE and Post-UTME screening render immediately on first paint, with no skeleton, empty state or homepage catalogue wait.
- Opening a card goes to its setup screen, where the published question bank is resolved only after the click. Practice and the dashboard CBT tab still use the authoritative catalogue through `buildSimulatorCards()`.
- At `≤640px`, only the homepage section uses a two-column, `1 / 1` card grid with the Services card anatomy: brand mark + label, title, clamped description and a compact action line with an arrow. Desktop keeps the standard four-column `219px` cards. Practice/dashboard keep the standard `84px` phone rows.
- No new stylesheet, dependency, whole-card scale, Settings System change or 55% opacity was introduced. Reduced-motion, fixed bottom nav, safe-area and tap-target behaviour are preserved.

The scoped exception is recorded in `docs/features/SIMULATOR-CARD-STANDARD.md`.

## Verification

- `npm run typecheck`: **0**
- `npm test`: **1285 tests, 1284 pass, 1 skipped, 0 fail**
- `npm run build`: **0**; `dist/assets/index-CpsDONzN.js` 192.15 kB / gzip 53.26 kB; built in 14.13s
- `npm run perf:audit`: **10/10**; CSS 47.1 KB ≤ 51 KB; critical path 213.5 KB ≤ 214 KB
- `npm run a11y:audit`: **0 blocking, 8 informational**
- `git diff --check`: **0**
- Supabase `get_auth_config`: `mailer_autoconfirm: true`; `refresh_token_rotation_enabled: true` and other auth settings preserved.

Browser checks against the live dev server (Puppeteer, Playwright e2e not run):

- Phone 390×844 home: four built-in simulator cards, each **175×175**, two columns, `0` skeletons, `0` horizontal-overflow nodes, fixed bottom nav at y786.
- Phone services: the reference cards remain four **175×175** two-column squares.
- Phone news: empty state **138px** high, side rail hidden, `scrollWidth = clientWidth = 390`, `scrollHeight = 844`, no overflow.
- Desktop 1440×900: four simulator cards **286×219**, news side rail `display: grid`, bottom nav `display: none`, no overflow.
- Production registration: `/register` allows immediate sign-up; submitting navigates to `/dashboard` with a stored Supabase session and no verification screen. Direct `/verify-email` explains that email verification is not required and offers a direct path to sign in.
