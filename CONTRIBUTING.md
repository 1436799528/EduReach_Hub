# Contributing

The standard for this repository is [`docs/WORKING_GUIDE.md`](docs/WORKING_GUIDE.md).
Read the stage you are working in before you start; the compliance record in
[`docs/WORKING_GUIDE_COMPLIANCE.md`](docs/WORKING_GUIDE_COMPLIANCE.md) says where
each requirement of that guide currently stands.

## Setup

```bash
npm ci
cp .env.example .env      # fill in your own values; never commit this file
npm run dev               # http://localhost:3000
```

Node 22.x. Tests run without Supabase credentials (the app falls back to
unconfigured mode), so a new contributor can run the whole suite on the first
day.

## Branches and commits

- `main` is always deployable. Never push to it directly.
- Work on a short-lived branch: `feature/autosave-queue`, `fix/timer-resume`.
- Commit messages: `type: what changed`, in the imperative — for example
  `fix: resume an attempt with the remaining server time`.
- Keep pull requests small (roughly under 400 changed lines). A small PR gets a
  real review; a large one gets a rubber stamp.

## Before you open a pull request

```bash
npm run lint        # tsc --noEmit
npm test            # unit and integration
npm run build       # client + server bundle, client env guard
```

CI runs `npm run ci`, which adds the schema audit, migration checklist, perf
budget, analytics audit, Playwright on desktop and mobile, RLS and a11y audits,
and `npm audit`. It must be green before merge.

## What a change must include

- The behaviour the feature contract in `docs/features/` describes.
- A test that fails without the change. Bug fixes always ship with the test that
  would have caught the bug.
- Every state the screen can be in: loading, empty, error, offline.
- No new dependency, schema change or architecture change without the owner's
  approval first.
- Documentation updated in the same PR when behaviour, routes, schema or
  configuration changes: `docs/ROUTES.md`, `docs/DATABASE.md`,
  `docs/operations/ENVIRONMENTS.md`, and the feature contract.

## Rules that are not negotiable

- Never commit a secret. Only `*.example` env files are tracked, and a build
  that exposes a privileged Supabase key fails on purpose.
- Never edit an applied migration. Add a new one.
- Never let the browser decide time, score or access. The server is the
  authority.
- Never remove a test to make a gate pass. Fix the code or fix the test's
  premise, and say which in the pull request.
- Never publish a page that fails the page quality gate
  ([`docs/PAGE_QUALITY_GATE.md`](docs/PAGE_QUALITY_GATE.md)).
