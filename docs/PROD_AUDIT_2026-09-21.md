# EduReach Hub — Production Audit, 21 Sep 2026

Follow-up to `FULL_AUDIT_2026-09-21.md`. Scripted + targeted review.

## 1. Dummy accounts — NONE FOUND, hardening applied

- No hardcoded demo/dummy/test credentials, no seed endpoints, no sample users.
- Offline local sessions are gated by `!isSupabaseConfigured` in both
  `resolveCurrentUser()` and the sign-in catch path — inactive the moment
  production Supabase env is set. Production-safe.
- Removed dead `startLocalSession` export from the auth context.
- Signup no longer writes the profile cache to localStorage when Supabase
  is configured (was unconditional).

## 2. Sign-in / register — issues found and fixed

- Password recovery uses the `PASSWORD_RECOVERY` event → reset mode →
  `updateUser`, errors surfaced honestly. `?next=` redirect is
  open-redirect safe; recovery tokens and `?next=` survive mode switches.
- Profile completion: stripped the remaining visible numbering (9–18) to
  match auth; avatar picker no longer hotlinks 4 Unsplash portraits —
  local initials tiles (muted tones, name-hash) with optional custom URL
  and legacy-unsplash guard. Dashboard renders `avatar_url` only when set.

## 3. Fonts — consistent everywhere

- Inter (`--er-font-sans`) forced on `body` and all form controls.
- Last two `monospace` outliers converted: CBT timer → Inter tabular-nums
  (no digit jitter), tracker reference codes → Inter + letterspacing.

## 4. Orange toned down

- Admin theme `#ff7a00` → `#e56b0b` (buttons, active nav, shadows).
- Tangerine `#F97316` → `#DE6A1F` (footer brand, processing badges).
- Deleted dead navy utility-strip CSS (component was already removed).
- Brand crimson untouched — it is red, not the bright orange in question.

## 5. Breaking ticker removed

Unmounted, component + all CSS deleted, zero references remain.

## 6. Official logo integration — READY, file pending

- New `BrandLogo` component (`/icons/edureach-logo.png`, ER-tile fallback
  until the file lands) mounted in header, auth, dashboard (×2), admin,
  and protected-route loader.
- Sandbox has no HTTPS egress, so the provided CDN URL could not be
  fetched here. **Action:** attach the PNG to the chat; it will be
  installed, previewed, and added to the PWA manifest.

## 7. Buttons — every handler verified

0 stub onClicks, 0 `alert()` calls, 0 dead buttons (2 flags are implicit
submits inside `onSubmit` forms). Wallet top-up (3 triggers → Paystack
inline SDK lazy-load → `/api/wallet/verify`), job applications (wa.me
deep links), CBT/admin/newsroom CRUD all wired to real handlers.
32/32 static hrefs resolve, 0 dead.

## 8. Network — local-first restored

- Deleted dead `cardTheme.ts` (7 external logo hotlinks) and dead
  `constants.ts` (duplicated route truth).
- Only external calls left: Paystack SDK + API (payments),
  Google Fonts (typography), WhatsApp deep links, Supabase (when
  configured). No localhost refs, no tracking pixels.
- Endpoint smoke: `/api/health` 200, unconfigured feeds honest
  `[]`/404, admin routes 401 without token.

## Remaining production actions

1. Attach the official logo PNG.
2. Set Supabase env + run migrations; verify admin bootstrap + newsroom
   persistence + voucher reveal against the live DB.
3. Set Paystack keys; run a live-mode wallet top-up in staging.
4. Click-through QA in a real browser (sandbox is static + endpoint level).
5. Promote these audit scripts to CI checks.
