# EduReach Netlify production variables

Netlify holds the deployment's variable values — this repository holds the
classification. The two must agree, and the rule that decides the scope is simple:
**a value the browser bundle inlines belongs to the build; a value that grants
access belongs to the functions.**

Full classification (PUBLIC / PRIVATE / SECRET / SENSITIVE_OPERATIONAL /
DEVELOPMENT_ONLY) and the invariants that are asserted in CI:
[`docs/ENVIRONMENT-VARIABLES.md`](ENVIRONMENT-VARIABLES.md).

## 1. What to configure

| Variable | Netlify scope | Secret? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **Builds** (and Runtime only if the API runs here) | **No** | Public project origin. It is inlined into the JS bundle, so it is public by definition. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Builds** | **No** | Publishable/anon key. Every request it makes is subject to RLS. |
| `SUPABASE_SECRET_KEY` | **Functions** only | **Yes** | Server key. Never in Builds: a build-only process has no reason to read it. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Functions** only | **Yes** | Legacy alias of the above. Keep one, not both, where possible. |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | **Functions** only | **Yes** | Administrative control, not a credential. Delete it once the first administrator exists. |
| `EDUREACH_SITE_URL` | Runtime | No | Canonical origin for sitemap/canonical URLs. |

`VITE_` prefix always means "shipped to the browser". Never put a secret behind it.
`scripts/client-secret-guard.ts` refuses such a build, and it checks the value as
well as the name, so a privileged key pasted into a `VITE_` variable fails the
build instead of shipping.

## 2. Secret scanning: keep it on

Netlify's secret scanning stays enabled. Do not set `SECRETS_SCAN_ENABLED=false`,
do not omit files or directories from it, and do not safelist a detected value to
make a build pass: a value only trips the scan when it genuinely appears in
repository content or build output, and the fix is to remove it there.

When the scan fails, it names the variable and the file. Treat that as a defect in
the repository, not in the platform, and fix it in this order:

1. Replace the literal value with a placeholder (`<project-ref>`,
   `noreply@your-domain`, `[GOOGLE_CLIENT_SECRET]`) — documentation never needs the
   real value.
2. If the value is in committed source, rotate the credential when it was a
   credential, then remove it (see section 4).
3. Re-run the deploy. Never re-run with scanning disabled.

If the detected value is a **public** value (project origin, publishable key) and
the variable is flagged secret in the site settings, the flag is the defect — see
section 3.

## 3. A public value flagged as secret cannot be un-flagged

Netlify does not allow the secret flag to be removed from an existing variable. A
public value stuck behind that flag will keep failing the scan (and is misleading
in every audit), so classify it again under a name that cannot be misread:

1. Create `EDUREACH_PUBLIC_SUPABASE_URL` — scope **Builds**, secret **No** — with
   the same project origin.
2. Create `EDUREACH_PUBLIC_SUPABASE_KEY` — scope **Builds**, secret **No** — with
   the publishable key.
3. Deploy. `scripts/client-env-check.ts` and `vite.config.ts` read these names as
   a documented fallback, so the bundle is configured exactly as before.
4. Once the deploy is verified, delete the obsolete `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY` entries **without reading their values**. The
   repository supports either set of names; there is no migration window.

Do not create a new Supabase key to escape a mistaken flag, and never print a
value from the Netlify console into an issue, a commit or a chat.

## 4. If a real credential was ever exposed

Rotate first, then clean up: issuing a replacement key at the provider invalidates
the exposure immediately, whereas removing a file from `main` does not remove it
from history, caches or clones. Update the variable with the new value, confirm the
old one no longer works, then remove the value from the repository. Full procedure:
[`SECURITY.md`](../SECURITY.md).

## 5. First administrator

The first administrator is bootstrapped only when all three hold:

1. no `admin`/`super_admin` exists;
2. the signed-in Supabase account email exactly matches
   `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` (compared server-side, never sent to the
   browser);
3. the server-side endpoint calls the locked database function
   `admin_bootstrap_first_admin`.

An anonymous visitor cannot reach it (a bearer token is required and resolved with
Supabase), an ordinary student cannot promote themselves (the email must match and
the account must still be the designated one), and an existing administrator cannot
be replaced (the database function refuses once a privileged role exists). Remove
the variable after the first successful bootstrap; leaving it set keeps a
recovery door open.

## 6. Analytics

Enable Netlify Web Analytics separately in
Project configuration > Analytics & metrics > Analytics.

EduReach also records selected application events through
`/api/analytics/event` for the in-app administrative dashboard.
