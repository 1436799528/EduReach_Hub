# EduReach Hub — Authentication and Permissions

> **Purpose.** How sign-up, login, password reset, sessions, roles, and
> permissions work today, and what the new backend must reproduce.
> Verified against `pages/AuthPageV2.tsx`, `src/lib/auth.tsx`,
> `src/lib/supabase.ts`, `src/lib/capabilities.ts`, `lib/auth.ts`,
> `lib/authorization.ts`, `pages/AdminLayout.tsx`,
> `src/app/ProtectedRoute.tsx`, and `server.ts` guards.

---

## 1. Identity provider today: Supabase Auth

- **Provider:** Supabase Auth (GoTrue) — email/password only. No OAuth, no
  magic links, no phone OTP.
- **Client:** `src/lib/supabase.ts` → `createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true,
  detectSessionInUrl: true } })`. The session (access JWT + refresh token)
  is persisted in browser storage under the default Supabase key
  (`sb-<ref>-auth-token`).
- **Server verification:** `lib/auth.ts` `verifyJWT(token)` calls
  `supabase.auth.getUser(token)` (validates signature + expiry against the
  Supabase Auth server), then loads `profiles.role` + `full_name` and
  resolves capabilities. **The server never trusts `user_metadata` or
  `app_metadata` for authorization** (except as a last-resort fallback in
  `AdminLayout` when the API is unreachable — and even there, only to
  *display* the console; every API call re-checks server-side).
- **Token transport:** `Authorization: Bearer <access_token>` header on
  every authenticated API call (`authHeaders()` in `src/lib/api.ts`).
  No cookies, no CSRF tokens, no refresh-token handling in app code
  (Supabase JS auto-refreshes).

---

## 2. Sign-up behaviour (`pages/AuthPageV2.tsx`, mode `signup`)

**Frontend validation (before any network call):**
- `firstName`, `lastName` required.
- `email` must contain `@`.
- `phone` must have ≥10 digits (Nigerian number).
- `password` ≥8 characters; `confirmPassword` must match.
- `termsAgreed` must be true.
- `accountType` ∈ `student|parent|teacher` (default `student`).

**Flow:**
1. `supabase.auth.signUp({ email, password, options: { data: {
   first_name, last_name, full_name, phone, account_type, terms_agreed:
   true } } })`.
2. If a session is returned immediately (`signUpData.session?.user` —
   email confirmation disabled): upsert `profiles` row
   `{ id, full_name, phone, role: 'student' }` (direct PostgREST write),
   `notifyAuthChanged()`, navigate to `?next=` (safe-path checked) or
   `/dashboard`.
3. If no session (email confirmation enabled): switch to `verify` mode
   ("A verification link has been sent to <email>") with a
   **Resend verification email** button
   (`supabase.auth.resend({ type: 'signup', email })`).
4. The DB trigger `handle_new_user()` creates the `profiles` row from
   `raw_user_meta_data` + a `student_wallets` row atomically (see
   `DATABASE-REQUIREMENTS.md` §1.2). The new backend must create the
   profile atomically with the user regardless of provider.

**Unconfigured mode:** throws `EduReach account registration is not
available until the live account service is configured.` — no local
account creation.

---

## 3. Login behaviour (mode `signin`)

1. `supabase.auth.signInWithPassword({ email, password })`.
2. `supabase.auth.getSession()` → if `access_token` present:
   - Best-effort `POST /api/admin/bootstrap` (promotes the designated
     first admin; failures ignored — "already bootstrapped or not the
     designated account").
   - Probe `GET /api/admin/session` with the token: `ok` → staff.
   - Clear `edureach-admin-student-view` sessionStorage key,
     `notifyAuthChanged()`, navigate to `/admin` if staff, else to the
     safe `?next=` path.
3. Errors surface via `userFacingError()` (e.g. invalid credentials →
   generic message; the frontend does not distinguish "no account" from
   "wrong password" beyond what Supabase returns).

**No lockout, no CAPTCHA, no 2FA prompt at login.** MFA enrolment exists
(`SecurityModal`) but login does not challenge for it in the current
frontend (Supabase would return an `aal` claim; the frontend does not
branch on it). **The new backend should decide explicitly whether MFA
challenge is required at login** — currently it is enrolment-only.

---

## 4. Password reset (modes `forgot` / `reset`)

- **Forgot:** `supabase.auth.resetPasswordForEmail(email, { redirectTo:
  '<origin>/reset-password' })`. The frontend **swallows errors** and
  always shows `If an account exists for this email, you will receive
  password reset instructions.` (no account-existence disclosure).
- **Reset:** listens for `PASSWORD_RECOVERY` auth event → switches to
  `reset` mode. Validates password ≥8 chars + match, then
  `supabase.auth.updateUser({ password })`. Success → back to `signin`
  mode with `Password updated successfully. You can now sign in.`
- **Unconfigured mode:** shows `Password reset email is unavailable in
  local preview mode...` and does not call Supabase.

**New-backend requirement:** reset links must be single-use, time-limited,
and the forgot endpoint must remain enumeration-safe. If owning auth,
implement `POST /auth/password/forgot` + `POST /auth/password/reset`
with the same generic response.

---

## 5. Session management

| Aspect | Current behaviour |
|---|---|
| Session source | `supabase.auth.getSession()` (local) + `onAuthStateChange` subscription (`src/lib/auth.tsx` `AuthProvider`). |
| Auth context | `AuthProvider` exposes `{ user: {id, email, name, avatarUrl, isLocal} \| null, isAuthenticated, isLoading, refreshAuth, signOut }`. `name` derives from `user_metadata.full_name` → `first_name + last_name` → email prefix → `'Student'`. |
| Cross-tab sync | `storage` event listener (keys starting `edureach-`) + custom `AUTH_EVENT` (`notifyAuthChanged` / `dispatchAuthChanged`). |
| Sign-out | `supabase.auth.signOut()` (best-effort try/catch for local-preview sessions), clear `edureach-admin-student-view`, `setUser(null)`, dispatch auth-changed. `ProtectedRoute` then redirects to `/login?next=...`. |
| Sign-out others | `supabase.auth.signOut({ scope: 'others' })` (`SecurityModal`). |
| Password change | `supabase.auth.updateUser({ password })` (`SecurityModal`) + `recordSecurityEvent('password_changed')`. |
| MFA | `mfa.listFactors/enroll/challenge/verify/unenroll` (`SecurityModal`); `profiles.mfa_enabled` flag updated directly. |
| Token refresh | Automatic (Supabase JS). App code never handles refresh tokens. |
| Session expiry UX | API 401 → `EduReachError` kind `auth` → `userFacingError` maps to `Your session has expired. Please sign in again.` |

**Frontend assumptions the new backend must honour:**
- The access token is a **JWT** the server can verify statelessly (or via
  the Auth server). The frontend sends it as a Bearer token and expects
  401 (not a redirect) when it expires.
- `user.id` (UUID) is the stable identity used for ownership checks
  (`expectedUserId` on service submission, attempt ownership, saved items).
  The frontend refuses to submit a service request if
  `user.id !== expectedUserId` ("Your account changed...").
- The frontend **never** sends a user id for authorization — ownership is
  always derived from the token server-side. (The one exception is
  `expectedUserId` on service submission, which is a *consistency check*,
  not an authorization input; the RPC re-checks `auth.uid()`.)

---

## 6. Roles and capabilities

### 6.1 Roles (`src/lib/capabilities.ts` — single vocabulary, shared by browser, server, tests)

| Role | Meaning | Stored value |
|---|---|---|
| `student` | Default. All signed-in users. | `'student'` (also the fallback for unknown values — least privilege). |
| `content_editor` | Editorial staff: news, opportunities, institutions, calendar, services catalogue, CBT content, site content, analytics read, data read. | `'content_editor'` |
| `service_admin` | Service-operations staff: service catalogue read + service-request read/process. | `'service_admin'` |
| `super_admin` | All capabilities. | `'super_admin'` (legacy `'admin'`/`'moderator'` map here). |

- **Legacy mapping:** `admin`, `moderator` → `super_admin` (existing staff
  keep their access; a migration normalises stored values).
- **Retired roles:** `senate_admin`, `campus_agent` → treated as
  `student` (they could read staff rows via RLS but never passed the admin
  gate; now they get no staff capability at all).
- **Unknown values** → `student`.
- Every staff role **also** holds all student capabilities (a staff member
  is still a signed-in person who may use the student dashboard).
  Student capabilities are owner-scoped, so this grants no access to
  another student's data.

### 6.2 Capabilities (30)

**Student (owner-scoped — `OWNER_SCOPED_CAPABILITIES`):**
`profile.read`, `profile.update`, `dashboard.access`, `settings.read`,
`settings.update`, `service_request.create`, `service_request.read_own`,
`cbt.attempt`, `cbt.view_result`.

**News/editorial:** `news.read`, `news.create`, `news.update`,
`news.publish`, `news.delete`.

**Opportunities:** `opportunity.read`, `opportunity.create`,
`opportunity.update`, `opportunity.delete`.

**Institutions:** `institution.read`, `institution.create`,
`institution.update`, `institution.delete`.

**Calendar:** `calendar.read`, `calendar.create`, `calendar.update`,
`calendar.delete`.

**Service catalogue:** `service.read`, `service.create`, `service.update`,
`service.delete`.

**Service requests (staff):** `service_request.read`, `service_request.process`
(read and process are separate so a content editor can never see requests).

**CBT admin:** `cbt.read` (includes question banks + answer keys — staff
only), `cbt.manage`.

**Analytics/audit:** `analytics.read`, `audit.read`.

**Data control:** `data.read`, `data.write`, `data.import`.

**Site content:** `site.read`, `site.update`.

**Account admin:** `user.read`, `user.suspend`, `user.manage_roles`.

### 6.3 Role → capability matrix

| Capability group | student | content_editor | service_admin | super_admin |
|---|---|---|---|---|
| Student (owner-scoped) | ✓ | ✓ | ✓ | ✓ |
| News, opportunities, institutions, calendar, services catalogue | — | ✓ | — (services read only) | ✓ |
| `service_request.read` / `.process` | — | — | ✓ | ✓ |
| `cbt.read` / `cbt.manage` | — | ✓ | — | ✓ |
| `analytics.read` | — | ✓ | — | ✓ |
| `audit.read` | — | — | — | ✓ |
| `data.read` / `data.write` / `data.import` | — | read only | — | ✓ |
| `site.read` / `site.update` | — | ✓ | — | ✓ |
| `user.read` / `user.suspend` / `user.manage_roles` | — | — | — | ✓ |

(`service_admin` also holds `service.read` for the catalogue.)

### 6.4 Enforcement rules (must be reproduced)

1. **Server is the boundary.** Every admin route declares its capability
   via `requireCapability(...)` (`lib/authorization.ts`). Missing token →
   401; insufficient capability → 403 with the generic message (never a
   hint about which role would be allowed). Tests
   (`tests/authorization.test.ts`) prove every privileged route carries a
   capability.
2. **Ownership is separate from capability.** `can(user, capability,
   {ownerId})` requires both the capability *and* `ownerId === user.id`
   for owner-scoped capabilities. Staff read other people's data through
   staff capabilities (`cbt.read`, `service_request.read`), never by
   impersonating ownership.
3. **Ownership failures return 404**, not 403, so resource existence is
   not leaked (CBT attempts, progress, v2 state).
4. **Role is re-read from the database on every request** (`verifyJWT`
   loads `profiles.role`). Client-supplied roles/headers/metadata are
   never trusted. Self-promotion is impossible: the `role` column is not
   in the client-writable column grant, and role changes go only through
   `POST /api/admin/users/:id/role` with `user.manage_roles`.
5. **Bank access is a third layer:** even with `cbt.attempt`, a student
   needs `cbt_bank_candidate_access(exam) = true` (public bank or active
   restricted assignment). Unclassified → false (fail closed).
6. **Audit:** `recordAudit()` writes via the `admin_audit_log` RPC and
   never throws (an audit failure must not fail the operation).

---

## 7. Protected routes and admin restrictions

### 7.1 Student protected routes (`ProtectedRoute`)

Prefixes: `/dashboard`, `/profile`, `/settings`, `/services/track`,
`/track`. Behaviour: loading portal while `isLoading`; redirect to
`/login?next=<encoded path+search+hash>` when unauthenticated (with
loop/double-effect guards). **CBT result routes** (`/dashboard/cbt/results`,
`/cbt/results/:id`) are additionally owner-checked server-side
(`fetchCbtResult` requires `supabase.auth.getUser()` + owner-scoped reads).
**CBT session routes** (`/cbt/session/:id`) are *not* wrapped in
`ProtectedRoute` — the paper endpoint enforces auth (401) and the page
shows the error. Guest practice (`/cbt`, `/cbt/setup/*`) is public.

### 7.2 Admin console (`AdminLayout`)

- Session resolution: `GET /api/admin/session` (server truth) with a
  direct-`profiles` fallback for display only.
- Navigation filtered by `hasCapability()`; deep links without the
  capability render `AdminSectionDenied` ("Every admin API re-checks
  capabilities, so nothing can be reached by editing the URL.").
- `ADMIN_ROUTE_CAPABILITIES` maps each `/admin/*` path to its capability
  (`src/lib/capabilities.ts` `capabilityForAdminPath()`); `/admin`
  overview requires any staff membership.
- Sign-out from the console calls `supabase.auth.signOut()`.

### 7.3 Admin restrictions (server-side)

- `requireStaff`: at least one non-owner-scoped capability, else 403.
- `requireCapability(...caps)`: any-of semantics (e.g. PDF upload accepts
  `data.write` OR `institution.update` OR `cbt.manage`).
- Content-manager CBT tables additionally require `cbt.read` (list) /
  `cbt.manage` (write) via `contentCbtAllowed()` — `data.write` alone
  cannot touch `exam_questions`.
- Question-import routes require `cbt.manage` (the `guard`).
- Restricted-bank writes execute with the **caller's own token**
  (user-scoped client) so the database re-checks authority; the service
  role never classifies a bank or assigns a candidate.
- CBT write RPCs execute with the user-scoped client so `auth.uid()`
  resolves; the service-role client would run as nobody and the RPCs
  refuse. The new backend must derive the actor from the verified token
  in every transaction.

### 7.4 Suspension

`profiles.suspended` (via ban/unban) is set by `user.suspend`. **Gap:**
the current `verifyJWT` does not check `suspended` — a suspended user
with a valid token can still call the API until the token expires.
**The new backend must refuse suspended users at authentication time
(401/403) and ideally revoke sessions on ban.** Recorded as a required
fix, not a behaviour to preserve.

---

## 8. The identity-provider decision (for the new backend)

The new backend must choose one of two options. Both keep the capability
vocabulary, role matrix, and enforcement rules above unchanged.

### Option A — Keep Supabase Auth as identity provider (recommended for phase 1)

- Frontend keeps `supabase.auth.*` unchanged (zero auth rewrite).
- New backend verifies Supabase JWTs (JWKS or HS256 secret) on every
  request, re-reads `role` from its own database, and owns all
  authorization + data decisions.
- The new backend's `users` table mirrors Supabase `auth.users.id` (or
  the backend reads the Supabase user via the Auth Admin API).
- Email delivery (verification/reset) stays with Supabase.
- **Trade-off:** keeps a hosted dependency the rebuild is trying to shed,
  but ships fastest and safest.

### Option B — Own auth in the new backend

- New endpoints: `POST /auth/register`, `POST /auth/verify-email`,
  `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`,
  `POST /auth/password/forgot`, `POST /auth/password/reset`,
  `POST /auth/mfa/*` (enrol/challenge/verify/unenrol).
- Passwords: argon2id hashes; refresh tokens: rotating, httpOnly cookies
  or Bearer (frontend currently uses Bearer — keep Bearer to minimise
  frontend change).
- Requires: email provider (none configured in this repo), credential
  migration plan for existing users (force password reset is the safe
  default), and a frontend auth rewrite (largest single frontend change).
- **Trade-off:** full control, no Supabase dependency; highest risk.

**Either way:** the backend derives the caller only from a verified
token and re-reads `role` from the database on every request. The
frontend's `AuthProvider` contract (`{user, isAuthenticated, isLoading,
refreshAuth, signOut}`) and `ProtectedRoute` behaviour must be preserved.

---

## 9. Frontend assumptions about tokens and identity (checklist for the new backend)

- [ ] Access token is a JWT sent as `Authorization: Bearer <token>`.
- [ ] Expired/invalid token → **401** with a plain-string error body.
- [ ] `user.id` is a stable UUID; ownership checks compare it to row
      `user_id`. The frontend sends `expectedUserId` only as a consistency
      check, never as authorization.
- [ ] The frontend reads `user_metadata` (`full_name`, `first_name`,
      `last_name`, `avatar_url`) for display name/avatar only — never for
      authorization. The new backend's `/me` (or profile) endpoint should
      return the display name so the frontend can stop reading metadata.
- [ ] `onAuthStateChange` events (`PASSWORD_RECOVERY`, sign-in/out) drive
      UI mode switches. If auth moves, the frontend needs an equivalent
      event/refresh mechanism.
- [ ] Local-preview sessions (`isLocal: true`, `edureach-local-user-email`)
      exist for unconfigured environments. The new backend does not need
      to support them, but must not break the unconfigured rendering path
      (honest offline state, no crashes).
- [ ] Admin detection is by `GET /api/admin/session` returning 200 (staff)
      vs 403 (student). Preserve this probe semantics.
- [ ] Bootstrap is by email match (`EDUREACH_ADMIN_BOOTSTRAP_EMAIL`),
      rate-limited, one-time. Preserve the endpoint + semantics.
