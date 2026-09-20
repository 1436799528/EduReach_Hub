# EduReach Netlify production variables

The frontend already has:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Add these under Netlify > Project configuration > Environment variables:

| Variable | Scope | Secret |
|---|---|---|
| VITE_SUPABASE_URL | Functions, Runtime | No |
| SUPABASE_SECRET_KEY | Functions, Runtime | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Functions, Runtime | Legacy fallback only |
| PAYSTACK_SECRET_KEY | Functions, Runtime | Yes |
| EDUREACH_ADMIN_BOOTSTRAP_EMAIL | Functions, Runtime | Yes |
| WHATSAPP_API_ENDPOINT | Functions, Runtime | Yes if an API provider is configured |
| WHATSAPP_API_TOKEN | Functions, Runtime | Yes if an API provider is configured |

Do not add SUPABASE_SECRET_KEY or PAYSTACK_SECRET_KEY with a VITE_ prefix. VITE_ variables are intended for values shipped to browser code.

After changing variables, trigger a new production deploy.

## First administrator

The first administrator is bootstrapped only when:
1. no admin/super_admin exists;
2. the signed-in Supabase account email exactly matches EDUREACH_ADMIN_BOOTSTRAP_EMAIL;
3. the server-side bootstrap endpoint calls the locked database function.

This avoids the security problem of making whichever person happens to register first an administrator.

## Paystack

PAYSTACK_SECRET_KEY is used only by the server for initialization, verification and webhook signature validation.

Paystack webhook URL:
https://edureachhub.netlify.app/api/webhooks/paystack

## Analytics

Enable Netlify Web Analytics separately in:
Project configuration > Analytics & metrics > Analytics.

EduReach also records selected application events through /api/analytics/event for the in-app administrative dashboard.
