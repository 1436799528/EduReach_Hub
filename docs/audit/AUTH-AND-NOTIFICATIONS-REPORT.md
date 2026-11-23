# EduReach Hub — Authentication & Notifications Release Verification

**Verified:** 2026-11-21
**Scope:** the EduReach web client, the server API and the production Supabase Auth
project.
**Status:** public-release safe summary.

> **Why this file changed (2026-11-23).** The previous revision recorded live
> deployment values — the production project hostname, the transactional sender
> address and provider connection details — as prose. A deployment secret scan
> correctly matched two of those values against variables configured in the
> hosting platform, and the production build failed. Values that a platform treats
> as protected are never written into documentation, examples or test fixtures;
> this revision keeps the verification conclusions and drops the operational
> detail. See `docs/audit/README.md` for the rule and
> `docs/ENVIRONMENT-VARIABLES.md` for how each variable is classified.

---

## 1. Executive summary

An end-to-end review of the authentication and notification phases was completed
against the codebase and the connected Supabase project.

- **Authentication lifecycle:** email/password, Nigerian phone OTP (E.164
  normalisation) and Google OAuth are supported. Apple OAuth is retired from both
  client screens and provider configuration.
- **Sessions:** JWTs are short-lived, refresh-token rotation is enabled, and every
  privileged API route re-resolves the caller's role and capabilities on the
  server rather than trusting anything the browser sends.
- **Notifications:** `public.student_notifications` is owner-scoped by Row Level
  Security (read/insert/update/delete restricted to the signed-in student) with a
  separate staff-insert policy for authorised roles.
- **Redirect safety:** the `?next=` parameter is validated to a same-origin path;
  protocol-relative, absolute and `javascript:`/`data:` targets fall back to the
  dashboard.
- **Verification:** the authorization, authentication-entry, notification and
  regression suites pass (85/85 at the time of review). Typecheck, lint, format
  check and the production bundle build were clean.

---

## 2. What was verified

### 2.1 Authentication architecture

Supabase Auth (`supabase-js` v2) is integrated through `src/lib/auth.tsx`,
`src/lib/authProviders.ts` and `pages/AuthPageV2.tsx`. Server-side verification
lives in `server.ts` (`verifyJWT`, `verifyAdminToken`), and capabilities are
derived from the stored application role — never from a request body, a query
parameter or client storage.

Profiles are created by a PostgreSQL trigger on `auth.users`, so a browser cannot
forge a profile row for another user.

### 2.2 Email/password, recovery and verification

- Registration signs the user in directly; email confirmation is disabled at the
  provider by an explicit product decision.
- `/verify-email` explains that verification is not required and offers a sign-in
  link instead of showing a dead end.
- Password recovery uses `resetPasswordForEmail` with a redirect restricted by the
  provider's allow-list, and the confirmation message is deliberately
  non-disclosing so the form cannot be used to enumerate accounts.
- The reset form requires a minimum length and a matching confirmation.

### 2.3 Transactional email

Transactional account mail (recovery, address changes) is delivered through the
provider's custom SMTP configuration. **Provider host, sender address, username
and credential are managed in the Supabase dashboard only.** They are not
recorded in this repository, in the environment contract, or in any test fixture.
A branded sending domain is a pre-launch task for the owner; DNS (SPF/DKIM/DMARC)
must be verified before the sender address is changed.

Application-level email is not implemented: no background mail worker exists in
this repository. In-app notifications are the only application notification
channel and are stored in `public.student_notifications`.

### 2.4 Google OAuth

The Google provider is enabled in Supabase Auth. The client ID and client secret
are stored in the provider's server-side configuration; the repository only
records the placeholder names `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in
`docs/` guidance for the owner. The authorised redirect URI is the project's
`/auth/v1/callback` endpoint, and the authorised JavaScript origin is the site
origin, both configured in Google Cloud Console rather than in this repository.

### 2.5 Account linking

Email addresses are the canonical identity in `auth.users`. Profile rows attach
to `profiles(id)` with a foreign key to `auth.uid()`; manual linking is disabled
at the provider, so an unverified account cannot attach itself to an existing
identity.

### 2.6 Notification system

`public.student_notifications` stores a UUID primary key, a cascading foreign key
to `profiles(id)`, title, body, type, deep link, read timestamp and JSON metadata.
Access is owner-scoped, with a staff-insert policy limited to authorised
application roles. Status transitions are idempotent: a retried patch does not
duplicate a notification. Student-facing copy never includes internal notes or
database columns.

### 2.7 Error handling and redirect security

Provider and network failures are translated into actionable student messages
(`src/lib/errors.ts`, `src/lib/authProviders.ts`); raw provider or database errors
are not returned to the client. `getSafeNextPath()` rejects `//`, `/\`, and any
protocol scheme, and falls back to `/dashboard`.

### 2.8 Verification suite

- `node --import tsx --test tests/auth.test.ts tests/auth-entry.test.ts tests/authorization.test.ts tests/notifications.test.ts tests/auth-notification-verification.test.ts`
  — 85/85 passed.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (warnings pre-existing).
- `npm run format:check` — clean.
- `npm run build` — production bundle and server build succeeded.

---

## 3. Owner checklist (no values recorded here)

| Provider | Setting | Where it is managed |
|---|---|---|
| Google Cloud | Authorised redirect URI + JavaScript origin | Google Cloud Console |
| Supabase Auth | Google provider client ID/secret | Supabase dashboard (server side) |
| Supabase Auth | Custom SMTP host, sender, credential | Supabase dashboard (server side) |
| Supabase Auth | Compromised-password protection, password policy | Supabase dashboard → Authentication → Policies |
| Custom domain DNS | SPF, DKIM, DMARC before changing the sender | DNS provider |

Each of these is server-side configuration. None of them belongs in the
repository, a `.env.example`, a test fixture, or this document.
