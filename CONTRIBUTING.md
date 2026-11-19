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
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint, whole repository
npm run format:check # Prettier, enforced scope (see "Lint and formatting")
npm test            # unit and integration
npm run build       # client + server bundle, client env guard
```

CI runs `npm run ci`, which adds the schema audit, migration checklist, perf
budget, analytics audit, Playwright on desktop and mobile, RLS and a11y audits,
and `npm audit`. It must be green before merge.

## Lint and formatting

Two tools, two jobs. ESLint finds defects; Prettier decides layout. Neither is a
style debate, and neither may be satisfied by disabling a rule without a reason
written next to it.

```bash
npm run lint          # eslint .
npm run lint:fix      # eslint . --fix (safe fixes only)
npm run format        # prettier --write . (enforced scope)
npm run format:check  # what CI runs
```

Both run inside `npm run ci`, and a dedicated CI step runs them first so a lint
failure is named in seconds rather than buried in a 15-minute job.

**What ESLint enforces.** `@typescript-eslint` recommended (unused code, unsafe
patterns), `eslint:recommended`, Rules of Hooks, `prefer-const`, `eqeqeq`
(`== null` only), and `no-empty` (an empty block must say why it is empty).
`react-hooks/exhaustive-deps` is a warning, not an error: several effects
deliberately run on a narrower dependency list to avoid render loops, and each of
those carries a written justification at the call site. Warnings are visible on
every run and are reviewed, but they do not fail the build.

**Deliberate rule exceptions**, each with its reason in the code:

| Where | Rule | Why |
| --- | --- | --- |
| `server.ts`, `src/lib/html-sanitize.ts`, `src/server/questionReports.ts` | `no-control-regex` | The control characters are exactly what is being stripped. |
| `scripts/rehearse-cbt-real-supabase.mjs` | `no-unsafe-finally` | Every throw in that `finally` is caught by a sibling handler in the same block; none escapes. |
| `tests/**` | `@typescript-eslint/no-explicit-any` | Test doubles stand in for Supabase and Express shapes; `any` is the point of a fake. |
| All components | React Compiler rules (`set-state-in-effect`, `refs`, `purity`, `immutability`) | They describe a different component architecture; enabling them would mean rewriting working screens. |

**Formatting scope.** `.prettierrc.json` sets the standard: single quotes, 120
columns, 2-space indent, trailing commas, LF. `format:check` currently covers the
server, the tooling, the configuration and the workflows. The application shell
(`pages/`, `src/components/`, `src/app/`, `src/lib/`), the stylesheets and
`tests/` are listed in `.prettierignore` for a specific reason: around thirty
tests read a `.tsx`/`.css` file and match a formatted fragment of it, so
reformatting that layer fails those tests, and repairing them means rewriting
working assertions. That is a separate, reviewable change — not something to slip
into a formatting pass. Until then, run `npm run format` after editing files in
the enforced scope, and keep new client files consistent with their neighbours.

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
