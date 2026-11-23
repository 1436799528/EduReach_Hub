# Audit documents: what may be published here

This directory holds verification and audit records for EduReach Hub. It is part
of a **public** repository, so an audit document is a public document. Write every
one of them for a stranger to read.

## Allowed

- What was checked, when, and with what result (tests, build, typecheck).
- Behaviour that is visible to a user or a contributor: routes, redirects,
  lifecycle, copy rules.
- Table and column names, policy *names*, function *names* — the schema is not a
  secret, and naming it helps a contributor work safely.
- Placeholders: `<project-ref>`, `<your-domain>`, `noreply@<your-domain>`,
  `[GOOGLE_CLIENT_SECRET]`.

## Never allowed

- **The value of any environment variable**, public or private. A hosting platform
  matches values, not just credentials: a project origin or an administrative email
  written into prose will fail a secret scan and can trip a deploy. Use a
  placeholder; the real value belongs in the platform's settings.
- **Personal data:** a sender address, a student's or owner's email, a phone
  number, a screenshot of a dashboard, an API response with rows in it.
- **Provider configuration detail:** SMTP host and port, OAuth client IDs, bucket
  names with signed URLs, project region plus hostname, console URLs that embed a
  project reference.
- **Anything that would help an attacker:** an unpatched authorization gap, a
  working exploit path, a credential that is still valid. That belongs in the
  private security channel — see [`SECURITY.md`](../../SECURITY.md). Write the
  finding, tell the owner, and publish a neutral note here only once it is fixed.

## The rule, in one line

> If a value is configured in a deployment platform, a document may name the
> variable — never the value.

## Checks that enforce this

`npm run security:scan` scans this directory like every other directory for
credential patterns, and `tests/security-boundary.test.ts` fails if a document
reintroduces a full Supabase project hostname or a personal email address.
