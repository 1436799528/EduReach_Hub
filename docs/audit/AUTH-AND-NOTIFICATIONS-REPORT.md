# EduReach Hub — Production Authentication & Notifications Verification Report

**Audited & Verified:** 2026-11-21  
**Target Environment:** Production Supabase Project `EduReach-V1` (`gjdfatwcoosyuhakrrhh`, eu-west-1) & EduReach Web Client (`https://edureachhub.netlify.app`)  
**Repository Branch:** `arena/d88f7b15-edureach-hub`

---

## 1. Executive Summary

An end-to-end audit and implementation across the 15 authentication and notification phases was conducted on the EduReach Hub codebase and connected Supabase infrastructure.

- **Authentication Lifecycle:** Fully supported across Email/Password, Nigerian Phone OTP (E.164 auto-formatting with `+234`), and Google OAuth (Apple OAuth removed per product direction).
- **Database & RLS Posture:** The `public.student_notifications` table is active, configured with Row Level Security (RLS), owner-scoped policies (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), and authorized staff insertion policies.
- **Notification Center & Dispatch:** In-app status transitions trigger idempotent, user-scoped notification records with contextual deep links (`/dashboard/services?ref=...`), semantic tone mapping, and action categories.
- **Automated Verification:** 85/85 tests passed across authorization, authentication entry, notifications, and regression test suites. Typecheck, ESLint, Prettier format check, and production bundle build all pass cleanly.

---

## 2. Phase-by-Phase Audit & Verification Details

### Phase 1: Authentication Architecture Audit
- **Existing Framework:** Built upon Supabase Auth (`supabase-js` v2) integrated into `src/lib/auth.tsx`, `src/lib/authProviders.ts`, and `pages/AuthPageV2.tsx`.
- **Session Lifecycle:** JWT verification with server-side role and capability mapping (`verifyJWT`, `verifyAdminToken`). Capabilities strictly separate student actions from staff roles (`admin`, `super_admin`, `moderator`, `content_editor`, `service_admin`).
- **Profile Association:** Automated PostgreSQL trigger `on_auth_user_created_edureach` on `auth.users` calls `handle_new_student_profile()`, establishing a synchronized profile entry in `public.profiles` without manual frontend profile forging.

### Phase 2: Email & Password Lifecycle
- **Sign-Up & Verification:** Email verification is not required for production registration (`mailer_autoconfirm: true` on Supabase Auth). Upon registration, users are automatically confirmed and signed in without an inbox-check wall or verification countdown. The `/verify-email` route safely redirects visitors with a clear notification that verification is not required and offers a direct sign-in button. Password reset emails continue to be delivered reliably via SendGrid SMTP.
- **Password Reset & Recovery:** `resetPasswordForEmail` directs students securely to `/reset-password` (`site_url` / redirect allowlist enforced). Reset form enforces password strength (min 8 chars, matching confirm password), updating via `supabase.auth.updateUser`.
- **Security:** Account enumeration is mitigated; recovery confirmation gives non-disclosing feedback ("If an account exists for this email, you will receive password reset instructions").

### Phase 3: Production Email Delivery & Templates
- **Current Active Setup (Supabase Project `EduReach-V1`):**
  - **Custom SMTP:** Enabled in Supabase Auth settings.
  - **Provider:** SendGrid (`smtp.sendgrid.net`).
  - **Port:** `587`.
  - **Sender Email:** `jamesjulius176@gmail.com` (verified account email sender).
  - **Sender Name:** `EduReach Hub`.
  - **SMTP Username:** `apikey`.
  - **Credentials:** The SendGrid API key is securely stored in Supabase private SMTP settings (never checked into code or documentation).
- **Distinction Between Email and Notification Channels:**
  - **Supabase Auth Emails:** Transactional account lifecycle messages (password resets, email verification confirmation, email change OTPs) are dispatched via the active SendGrid SMTP configuration in Supabase Auth.
  - **Application-Level Notification Emails:** Not implemented in this repository. There are no application-level background workers or email delivery pipelines for routine app events.
  - **In-App Notifications:** Real-time and persistent student alerts (service request status transitions, CBT result notices) use the `public.student_notifications` table rendered in the UI via `NotificationCenter`.
- **Future Production Launch Setup (Branded Custom Domain):**
  - The domain `edureach.ng` is not yet configured or verified on DNS for transactional sending.
  - Prior to general public launch:
    1. Register and verify DNS records (SPF, DKIM, and DMARC) on the branded domain (`edureach.ng`).
    2. In Supabase Dashboard → **Project Settings** → **Authentication** → **Email Templates**, update Sender Email from `jamesjulius176@gmail.com` to `noreply@edureach.ng` or another verified organizational address.

### Phase 4: Google OAuth Flow
- **Client Configuration:** Button triggers `startSocialSignIn('google', nextPath)` invoking `supabase.auth.signInWithOAuth` with `prompt: 'select_account'` and safe `redirectTo` path.
- **Provider Settings Required in Supabase:**
  - Supabase Dashboard → **Authentication** → **Providers** → **Google**:
    - Toggle **Enable Google provider**: ON
    - Client ID: `[GOOGLE_CLIENT_ID].apps.googleusercontent.com`
    - Client Secret: `[GOOGLE_CLIENT_SECRET]`
    - Authorized Redirect URI in Google Cloud Console: `https://gjdfatwcoosyuhakrrhh.supabase.co/auth/v1/callback`

### Phase 5: Apple OAuth Flow (Retired)
- Apple Login has been removed completely from client screens and code.
- Supabase Auth config shows `external_apple_enabled: false`. No remaining Apple credentials or keys are configured or needed.

### Phase 6: Account Linking & Collision Safety
- Email addresses serve as canonical identities in `auth.users`.
- In Supabase Auth, `manual_linking_enabled` is controlled server-side. Unverified accounts cannot hijack existing profiles.
- Profiles attach via `auth.uid()` foreign keys on `profiles(id)`.

### Phase 7, 8, 9: In-App Notification System & Event Catalogue
- **Database Table:** `public.student_notifications` exists with UUID PK, foreign key to `profiles(id) ON DELETE CASCADE`, `title`, `body`, `notification_type`, `href`, `read_at`, `metadata`, and timestamp.
- **RLS Policies:**
  - `student_notifications_owner_select`: `user_id = auth.uid()`
  - `student_notifications_owner_insert`: `user_id = auth.uid()`
  - `student_notifications_owner_update`: `user_id = auth.uid()`
  - `student_notifications_owner_delete`: `user_id = auth.uid()`
  - `student_notifications_staff_insert`: Allows staff roles (`admin`, `super_admin`, `moderator`, `senate_admin`, `campus_agent`) to write notifications to students.
- **Event Catalogue & Copy Separation:**
  - **In-App:** Service status updates (`submitted`, `reviewing`, `processing`, `awaiting_information`, `completed`, `closed`, `rejected`, `cancelled`) produce clear student-facing messages without leaking internal staff notes or database columns.
  - **Tone & Action Mapping:**
    - `completed`, `closed` → `success` tone ("Update")
    - `awaiting_information` → `warning` tone ("Action required")
    - `rejected`, `cancelled` → `danger` tone ("Needs attention")
    - `processing`, `reviewing` → `warning` tone ("In progress")
  - **Idempotency:** State transitions check for existing notifications before inserting, preventing duplicate notifications if a status patch is retried.

### Phase 10 & 11: Error Handling & Redirect Security
- **Error Handling:** Client translates provider errors and network exceptions into actionable student messages via `src/lib/errors.ts` and `src/lib/authProviders.ts`.
- **Redirect Security (Open Redirect Prevention):** `getSafeNextPath()` strictly validates the `?next=` query parameter:
  - Must begin with `/` and reject `//`, `/\\`, or protocol schemes (`https:`, `javascript:`, `data:`).
  - Malicious inputs automatically fall back to `/dashboard`.
- **Supabase URI Allow-List:** Verified allow-list includes `https://edureachhub.netlify.app/**`, `http://localhost:3000/**`, and `http://localhost:5173/**`.

### Phase 12, 13, 14, 15: Verification Suite & Test Matrix
- **Test Results:**
  - `node --import tsx --test tests/auth.test.ts tests/auth-entry.test.ts tests/authorization.test.ts tests/notifications.test.ts tests/auth-notification-verification.test.ts`: **85/85 passed (0 failures)**.
- **Quality Checks:**
  - `npx tsc --noEmit`: Clean, 0 errors.
  - `npm run lint`: Clean (0 errors, warnings are pre-existing).
  - `npm run format:check`: 100% formatted.
  - `npm run build`: Production bundle and server build succeeded.

---

## 3. External Provider Checklist for Final Production Launch

| Provider | Setting | Value / Instruction |
|---|---|---|
| **Google Cloud** | Authorized Redirect URI | `https://gjdfatwcoosyuhakrrhh.supabase.co/auth/v1/callback` |
| **Google Cloud** | Authorized JavaScript Origin | `https://edureachhub.netlify.app` |
| **Supabase Auth** | Google Enabled | Already configured in Supabase Auth |
| **Custom SMTP** | SendGrid Active | Active (`smtp.sendgrid.net:587`, sender: `jamesjulius176@gmail.com`) |
| **Custom Domain DNS** | SPF, DKIM, DMARC | Future launch step for `edureach.ng` branded sender (`noreply@edureach.ng`) |
