# OBS-2 — structured server events, request ids and crash reporting

Status: **implemented** (working guide 4.9 "observability early" and 8.7
"dashboards and alerts"; approval item C, application side). The alerting half of
8.7 needs an external service and remains unapproved — see [Remaining](#remaining-the-half-that-needs-an-external-service).

## Why

An operator's two questions are "what is broken" and "which request was it". The
application could answer neither. Ninety-odd call sites wrote
`console.error('Admin news create error:', error)`: free text plus a raw SDK
object, with no severity a machine could sort on, no correlation id, and no guard
against a driver message that quotes a column value. A student reporting "it
failed when I submitted" was unanswerable without grep.

The guide's rule is narrow on purpose: *structured logs with request ids; never
passwords or full tokens; basic metrics; alert-worthy conditions identified and
documented.* This feature is the first half of that sentence and stops at the
boundary the second half requires permission for.

## What already existed (audited first, kept)

Nothing here was replaced. The audit found six working systems, each with a
different job, and no second logging architecture was introduced:

| System | Job | Kept |
|---|---|---|
| `/api/health`, `/api/health/ready` | liveness; fail-closed dependency probe incl. the CBT protocol schema | unchanged payload |
| `src/lib/errorTelemetry.ts` | browser errors → `client_error` analytics event, name-only, capped 10/session, consent-gated, PROD-only | unchanged |
| `src/server/jobRuns.ts` + `scheduled_job_runs` | background job history, `scheduled_job_status()`, `missing`/`stale`/`failing` verdicts | unchanged; the function that writes them now also logs |
| `site_analytics_events` + `src/lib/analyticsTaxonomy.ts` | product events through an allowlist | unchanged; operational events do **not** go here |
| `admin_audit_logs` via `recordAudit()` | who changed what | unchanged; its own failures are now visible |
| `lib/rate-limit.ts` | request throttling with a log callback | callback now emits a structured event |

## What was missing

- no correlation id anywhere in the request path;
- no severity, no event vocabulary, no machine-parseable line;
- raw error objects in logs (message included), and no size or key bounds;
- the catch-all error handler answered 500 and logged **nothing**, and there was
  no Express error middleware to reach it;
- readiness had no transitions: a monitor saw a 503, the log saw nothing;
- boot, crash and unhandled rejection were invisible;
- no documented alert thresholds and no statement of what needs a destination.

## What was implemented

`lib/observability.ts` (~280 lines, no dependency):

- **`log.debug|info|warn|error|critical`** → one JSON line
  `{ ts, level, service: 'edureach-api', env, event, commit?, …context }` on
  stdout, or stderr for `warn` and above.
- **`sanitizeContext`** — a deny-list on key names (`authorization|auth|cookie|
  token|secret|password|apikey|api_key|service_role|session|jwt|bearer|
  signature|credential`) replaced with `[redacted]` at every depth, strings capped
  at 300 characters, objects at 24 keys and 2 levels, arrays summarised.
- **`errorFacts`** — `error_name`, a short `error_code` (SQLSTATE / PostgREST) and
  an HTTP `error_status`. Never the message.
- **`requestIdFor`** — `x-nf-request-id` → `x-request-id` → `x-correlation-id` →
  uuid, each accepted only if it matches `^[A-Za-z0-9._:-]{8,64}$`.
- **`EventRateLimiter`** — collapses repeats per key and reports
  `log.suppressed` with the count when the window reopens.
- **`createReadinessReporter`** — `health.degraded` / `health.recovered` on
  transition plus a 10-minute reminder, not one line per poll.
- **`setLogSink`** — the test seam that makes all of the above assertable.

Wired into the server:

- request-correlation middleware (sets `X-Request-Id`, `res.locals.requestId`),
  emitting `http.server_error`, `http.denied` and `http.slow` (threshold
  `OBS_SLOW_REQUEST_MS`, default 5000 ms); route shapes replace uuids with `:id`
  and drop query strings;
- `apiErrorHandler` now emits `http.unhandled_exception` at `critical` for a 500
  rather than answering silently;
- authorization: `auth.verify_failed`, `auth.refused_unauthenticated`,
  `auth.refused_missing_capability` (capability names logged, response copy
  unchanged) and `audit.write_failed` when an audit row cannot be written;
- every CBT failure path: start, paper, draft save, submit (v2 and legacy), guest
  submit, abandon, question report, regrade preview/apply, expiry marking and the
  provenance refusals;
- every remaining `console.error`/`console.warn` in `server.ts`, `src/server/**`,
  `lib/authorization.ts` and `netlify/functions/` (question import, restricted
  banks, institution intelligence, site content, notifications, the scheduled
  job, sitemap sources), each with a named event and, where a response exists,
  its `request_id`;
- lifecycle: `server.starting`, `server.listening`, `server.start_failed`, plus
  `process.uncaught_exception` (`uncaughtExceptionMonitor`, which observes without
  changing what Node does) and `process.unhandled_rejection` (logged, then
  rethrown so the fatal default survives).

A source-scan test keeps new server code off `console.error`; the one permitted
free-text line is the fatal boot error, which prints the thrown error to a process
that has no request context and never prints a configuration value.

## Conventions

| Rule | Detail |
|---|---|
| Name | `area.subject_action`, lower snake case, fixed vocabulary, never interpolated with an id or a message |
| Level | `debug` request detail · `info` lifecycle · `warn` recoverable/expected-in-small-numbers · `error` a request or job failed · `critical` the process cannot continue correctly |
| Context | ids (`request_id`, `attempt_id`, `exam_id`, `question_id`, `import_id`), counters, durations, `error_name`/`error_code` — never values a user typed |
| Response copy | unchanged and generic; the log is the specific half |
| Where it goes | the platform's stdout/stderr; nothing is shipped to a third party |

## Events now observable

HTTP (`server_error`, `denied`, `slow`, `unhandled_exception`), auth
(`verify_failed`, `refused_unauthenticated`, `refused_missing_capability`),
health (`degraded`, `recovered`), CBT (11 lifecycle events), question import (13),
restricted banks (8), institutions (13), site content and CMS (12), public API
(12), admin mutations (every area), background (`scheduled_job.*`,
`newsroom.*`, `sitemap.source_unavailable`), lifecycle (5), audit
(`audit.write_failed`), meta (`ratelimit.throttled`, `log.suppressed`). The full
table is in [OBSERVABILITY.md](../operations/OBSERVABILITY.md).

## Health and readiness

No behaviour change, deliberately. `/api/health` is still a dependency-free
liveness answer; `/api/health/ready` still performs a real single-row read, still
probes the CBT protocol column with a zero-row schema-cache read, still honours
`CBT_LEGACY_SCHEMA=1` as an explicit opt-in, and still returns 503 when any check
fails. The response body is byte-identical. What changed is that a transition into
and out of degradation is now a log line, so the outage is visible in the log and
not only to whoever polls.

Nothing was loosened to make a monitor green. The known production blocker
(`cbt_attempts.protocol` missing → 503 `degraded`) still reports exactly that.

## Sensitive-data protections

Redaction by key name, size bounds, ids-not-values, and error facts instead of
error messages — the last one matters most, because a Postgres or fetch error
message is where a column value or a tokenised URL ends up. The log never receives
a password, a token, a service-role key, an answer key, a student's name, an
email, a question body or a chosen option. `tests/observability.test.ts` and
`tests/request-correlation.test.ts` assert the redaction and that a bearer token
never appears in a line.

## Tests

| File | What it pins |
|---|---|
| `tests/observability.test.ts` (9) | line format and fields, level→stream routing, redaction, size bounds, `errorFacts` without a message, id preference and the rejection of a non-id-shaped header, collapse + suppressed count, readiness transitions/reminder, and the source scan |
| `tests/request-correlation.test.ts` (4) | against the real Express app: a 401 carries the same `X-Request-Id` as its `http.denied` record, a platform id is reused, a bearer token never appears, route shapes contain no uuid |
| `tests/headers.test.ts` (updated) | excludes `X-Request-Id` from the shared security-header baseline: a per-request value cannot be a static line in `public/_headers` |

## Verification

`npm run ci`, in order, on the commit that introduced this feature:

| Step | Result |
|---|---|
| `typecheck` | clean |
| `lint` | 0 errors, 110 warnings (92 `no-explicit-any` in source + 18 reviewed `exhaustive-deps`, unchanged from item A) |
| `format:check` | clean over the enforced scope |
| unit + integration tests | **1350 pass, 1 skipped, 0 fail** (1351) |
| `schema:audit` / `migrations:checklist` | no blocking findings; 96/96 migrations listed |
| `build` | client + `build/server.cjs` ok |
| `perf:audit`, `analytics:audit`, `rls:audit`, `a11y:audit`, `audit:ci` | every budget passes; allows no blocking findings; 70/70 tables classified; 0 blocking a11y findings; 0 vulnerabilities |
| `test:e2e` | 318 passed, 30 skipped (desktop + mobile) |
| `e2e:perf` | 1 passed — LCP 2164 / 1824 / 2256 ms, CLS ≤ 0.0017 |

Also repaired while here: item A's `lint`/`format:check` scripts called ESLint and
Prettier without ever declaring them, so a clean `npm ci` would have failed the
CI gate. The seven devDependencies are now pinned exactly and the lock file is
additive only.

## Remaining: the half that needs an external service

Identified, documented with thresholds, and **not started** — no account, no SDK,
no vendor code, because choosing one is the owner's decision:

1. a **log destination** (Netlify's function log retention is the current limit);
2. **error aggregation** (grouping `http.server_error`/`process.*` into issues);
3. **uptime checks** on `/api/health` and `/api/health/ready`, including the
   guide's vantage point **from Africa**;
4. **alert routing** and the guide's **public status page**;
5. **metrics/APM** (optional, larger): request rate, p95 latency, database
   connection count as time series — the events carry the data, nothing stores it.

The recommended threshold table (site down, readiness ≥ 503, error-rate spike,
crash, submission/autosave/grading failures, auth-failure burst, audit-write
failure, job missed) is in [OBSERVABILITY.md](../operations/OBSERVABILITY.md).

## Guide items left unresolved

- 8.7's "grading queue growth" and "database connections near limit" have no
  dedicated measurement. The smallest honest fixes are named in OBSERVABILITY.md
  and both need a decision (a query in the health path, or a metrics backend).
- 4.9's "basic metrics" is satisfied in the sense of emitted events, not stored
  time series — that is the APM item above.
- 8.7's public status page is unbuilt by decision, not by oversight.
