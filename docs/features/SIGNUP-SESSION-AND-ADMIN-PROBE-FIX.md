# Signup session and admin-probe fix

**Date:** 2026-11-18  
**Branch:** `arena/4c35ebe4-edureach-hub`  
**Base:** `3ffd2744bba39b1ab07b07d1626658237f80703d` (`main`, merged PR #62)  
**Status:** implemented locally; not committed, pushed, merged or deployed by this change.

## What was wrong

Two separate post-login behaviours made a new email registration look like an admin-gated loop:

1. `pages/AuthPageV2.tsx` treated **any** authenticated session as a completed auth return. Opening `/register` while already signed in therefore redirected to `?next=` or `/dashboard` before a new email could be submitted. The dashboard then made its staff-session request, which looked like “checking if the new user is an admin first”.
2. `pages/StudentDashboardV2.tsx` called `GET /api/admin/session` for **every** signed-in user, including ordinary students. A student's expected `401`/`403` was swallowed, so the dashboard continued, but the unnecessary staff probe appeared in network traces during first entry.

## What changed

- `pages/AuthPageV2.tsx`: the auth-return/terms-settlement effect now returns immediately in `signup` mode and follows `currentMode` changes. A deliberate `/register` visit stays available even when another session exists; the signup form still records terms, creates the account through `supabase.auth.signUp()`, signs the new account in when needed, and navigates explicitly.
- `pages/StudentDashboardV2.tsx`: resolves the trusted profile role with the shared `resolveAppRole()` / `isStaffRole()` vocabulary before deciding whether to call `/api/admin/session`. Student profiles no longer call a staff-gated endpoint merely to receive an expected denial. Staff profiles still confirm the console session, and every admin API remains server-authorised.
- `tests/auth-entry.test.ts`: adds regression checks that signup has no admin bootstrap/session call, that `/register` is not hijacked by an existing session, that the off-by-default verification switch and sign-in admin routing remain intact, and that the dashboard staff probe is inside the staff-only branch.

## What deliberately did not change

- `src/lib/emailVerification.ts`, `src/vite-env.d.ts`, `.env.example`, `.env.production.example`: the `VITE_EMAIL_VERIFICATION_ENABLED` switch remains off by default and fully reversible.
- Hosted Supabase Auth configuration: signup remains enabled, `mailer_autoconfirm` remains `true`, and verification/OTP settings remain intact. No confirmation settings were re-enabled.
- Hosted Vercel environment variables and the promoted production deployment: no environment or deployment changes were made; production remains on PR #62's merge commit `3ffd274`.
- Sign-in admin bootstrap, first-admin promotion, staff routing, terms consent, phone OTP, OAuth, password reset, verification code infrastructure, mobile layout and design settings.

## Verification

- `node --import tsx --test tests/auth-entry.test.ts`: **10/10**.
- `npm run typecheck`: **0**.
- `npm test`: **1287 tests, 1286 pass, 1 skipped, 0 fail**.
- `npm run build`: **0**; `dist/assets/index-DuAZURSZ.js` 192.15 kB / gzip 53.27 kB.
- `npm run perf:audit`: **10/10**; critical path 213.5 KB ≤ 214 KB.
- `npm run a11y:audit`: **0 blocking, 8 informational**.
- `git diff --check`: **0**.

Browser verification used a temporary local dev server with a mocked Supabase client, not the hosted project:

| Scenario | Result |
|---|---|
| Existing session opens `/register` | Stayed on `/register`; no redirect loop. |
| New email signup while signed in | Reached `/dashboard` with heading “Overview”; new user session stored; **0** admin bootstrap/session requests; no verification UI. |
| New email signup while signed out | Reached `/dashboard` with heading “Overview”; new user session stored; **0** admin bootstrap/session requests; no verification UI. |
| Normal sign-in with the new email | Reached `/dashboard` with heading “Overview”; no verification UI. Sign-in-time admin probes still ran and their failures were ignored, as designed. |
| Direct `/verify-email` | Opened `/login` with “Welcome back”; no verification block. |

The temporary mock server and browser-harness files were removed after verification.
