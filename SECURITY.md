# Security policy

EduReach Hub holds student records, CBT attempts and exam answers, service
requests and payment references. Security reports are welcome and are handled
privately.

## Reporting a vulnerability

**Do not open a public GitHub issue, pull request, discussion or comment for a
security problem.** A public issue is a public exploit.

Send a private report through one of these channels:

1. GitHub's private reporting: **Security → Report a vulnerability** on this
   repository (Security Advisories). This is the preferred channel.
2. If that is unavailable, email the maintainer address listed in the repository
   profile and put `SECURITY` in the subject line.

Please include:

- what the issue is and which part of the platform it affects (site, API, database
  policy, storage, auth);
- steps to reproduce, or a proof of concept, with **synthetic** accounts only;
- the impact you believe it has, and whether you have seen any real user data;
- how we can reach you, and whether you want to be credited.

**Never include a real credential, a real student's data, or a working
authorization token in a report.** Describe it, do not attach it; if a credential
is involved, say which *kind* it is (for example "a Supabase service-role key") and
where it appeared (file, path, URL), not the value.

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement | 3 working days |
| Initial assessment and severity | 7 working days |
| Fix or documented mitigation for CRITICAL / HIGH | 30 days |
| Fix or documented mitigation for MEDIUM | 90 days |
| Public note (only with your agreement) | after the fix is deployed |

If a credential may be exposed, we rotate it first and investigate second: a
replacement key at the provider invalidates the exposure immediately, whereas
deleting a file from `main` does not remove it from history, caches or clones.

Please give us the agreed window before publishing, and do not test against real
student accounts, run destructive queries, or upload real documents. If you need
test data, ask and we will arrange an isolated environment.

## Scope

In scope:

- the web application and its API routes (authentication, authorization, CBT,
  service requests, uploads, notifications);
- Row Level Security policies, database functions and storage policies of the
  hosted Supabase project;
- anything that exposes one student's data to another, or exposes administrative
  data or configuration to a normal account;
- exposure of a credential in the repository, the built bundle or a public
  endpoint.

Out of scope:

- reports that require a compromised device, a browser extension or physical
  access;
- social engineering of the maintainers;
- denial of service through raw traffic volume (tell us, but it is a platform
  concern);
- missing hardening headers with no demonstrated impact (still welcome as a note);
- findings in third-party services themselves — report those to Supabase, Netlify,
  Google or SendGrid.

## Our own guarantees

These are commitments, and each one is checked by the repository rather than
asserted here:

1. **No credential in client output.** The build refuses privileged values in
   client-exposed configuration and scans the finished artefacts before they are
   published.
2. **No credential in the repository.** Every tracked file and every commit is
   scanned; exceptions are narrow, path-scoped and printed on every run.
3. **Server-side authorization.** A role or capability supplied by a browser is
   never trusted; every privileged route re-resolves the caller.
4. **Row Level Security on.** Every exposed table has RLS enabled, and a table with
   no policy is denied to client roles rather than open — see
   [`docs/security/RLS-POLICY-MATRIX.md`](docs/security/RLS-POLICY-MATRIX.md).
5. **Errors are not debug output.** Public responses carry a message, not a stack
   trace, a SQL error or a database internal.

Read [`docs/ENVIRONMENT-VARIABLES.md`](docs/ENVIRONMENT-VARIABLES.md) for how each
variable is classified, and [`docs/audit/README.md`](docs/audit/README.md) for what
may be written in a public audit document.

## For contributors

Before you push:

```bash
npm run security:scan     # tracked files: credential patterns + env contract
npm run security:check    # the same, plus every commit ever made
npm run build             # includes the client guard and the artefact scan
```

Do not:

- disable or narrow a security check to make a build pass;
- add `SECRETS_SCAN_ENABLED=false`, or exclude a directory from scanning;
- add a broad allowlist entry in `.security/secret-scan-allowlist.json` (entries are
  scoped to one rule and one path, with a reason);
- weaken an RLS policy or remove an authorization check to make a test pass;
- commit an `.env` file, a database dump, a user export or a real credential.

Detailed internal findings, the live configuration inventory and incident notes are
kept outside this repository on purpose (`SECURITY.md` is the only security document
that describes the system's posture publicly).
