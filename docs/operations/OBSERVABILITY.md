# EduReach Hub — Observability

What the system can tell you when something breaks, what it cannot, and what to do
about the gap. Written against the code as it is, not as it should eventually be.

---

## The two questions, kept separate

**Liveness — "is the process running?"**

```
GET /api/health
→ 200 { "status": "ok", "service": "edureach" }
```

Cheap, no dependencies touched. Answers only whether the process answers. Use it for
"should this instance be restarted".

**Readiness — "can it actually serve requests?"**

```
GET /api/health/ready
→ 200 { "status": "ready", checks: { server, supabase_configured, database }, databaseLatencyMs }
→ 503 { "status": "degraded", ... }
```

Checks that Supabase is configured, performs a real (single-row, `limit 1`) read, and
reports how long it took. Returns 503 when any check fails, so an orchestrator or
uptime monitor can act on the status code alone.

The database probe is deliberately minimal: one row, one table, no aggregation. A
readiness check that runs an expensive query becomes the outage.

**Neither endpoint leaks database detail.** The failure detail is normalised through
`userFacingError`, so a connection string, a role name or a SQL fragment never reaches
a client.

## Scheduled jobs

Every scheduled run writes a row to `scheduled_job_runs`:

| Column | Meaning |
|---|---|
| `job_name` | `newsroom-refresh`, `analytics-retention` |
| `status` | `succeeded`, `partial`, `failed` |
| `started_at` / `finished_at` / `duration_ms` | when, and how long |
| `detail` | operator-safe counters (sanitised — see below) |
| `error` | truncated message, no stack |

`partial` is distinct from `succeeded` on purpose: a newsroom refresh where two of ten
sources failed is not a success, and collapsing it into one status hides the thing an
operator needs to notice.

**Read it:**

```
GET /api/admin/jobs        (requires analytics.read)
```

Returns per job: run count, last success, last failure, failure count, last error, and
a `fresh` flag (last success within 48 hours), plus a `health` verdict:

- **missing** — the job has never recorded a run. This is the important one: a schedule
  that stopped firing produces no error anywhere, and silence is indistinguishable from
  health unless you look for the absence.
- **stale** — recorded, but no success within the window.
- **failing** — the most recent failure is newer than the most recent success.

## Guarantees the recording makes

These are asserted in `tests/job-runs.test.ts`, not asserted in prose:

1. **Recording never fails the job.** A refused insert returns `false`; a throwing
   client is swallowed. A telemetry outage cannot turn a successful newsroom refresh
   into a failed one.
2. **The detail cannot carry a secret.** `sanitizeDetail` keeps numbers, booleans and
   strings up to 200 characters, drops objects and arrays rather than flattening them,
   and bounds the payload to 20 keys. Flattening is how a nested credential ends up in
   a log.
3. **A thrown job error is recorded before it propagates.** `runRecorded` writes the
   `failed` row and then re-throws, so the caller still decides what a failure means —
   but it was written down first.
4. **The job log is server-only.** RLS enabled, one deny-client policy, no grant to
   `anon` or `authenticated` (verified by executing the check against real PostgreSQL
   in `tests/migrations.test.ts`, and classified in `scripts/rls-posture.ts`).
5. **The log is pruned.** `prune_scheduled_job_runs(180)` — longer than the analytics
   window because an operator needs a term of trend, and the rows are small.

## Failures that are observable today

| Failure | Where it shows up |
|---|---|
| Daily newsroom job throws | `scheduled_job_runs` row with `status = 'failed'` + `/api/admin/jobs`; Netlify function logs |
| Some sources fail | `status = 'partial'`, `sourcesFailed` in detail, per-source warnings in the function log |
| Newsroom schedule stops firing | `/api/admin/jobs` reports the job **missing** or **stale** |
| Analytics prune fails | `scheduled_job_runs` row on `--apply` |
| Database unreachable | `/api/health/ready` returns 503 |
| Unauthenticated admin call | 401 from the route guard (`tests/api.test.ts` exercises every admin route) |
| Illegal service status transition | 409 + audit row |
| Notification insert fails | logged, and deliberately does **not** fail the status change |
| CBT bank unusable | `content_integrity_report()` subject coverage, surfaced by `npm run prod:validate` |
| Expired news or opportunities still active | `content_integrity_report()`, surfaced by `npm run prod:validate` |

## What is NOT observable — stated plainly

1. **There is no alerting.** Nothing pushes a notification when a job fails. A failure
   is *recorded* and *visible to anyone who looks*, which is not the same thing. The
   operational substitute until OBS-1's alerting half exists is an external uptime check
   on `/api/health/ready` plus a scheduled poll of `/api/admin/jobs`. **Call it polling,
   not alerting.**
2. **The retention prune is not scheduled.** `prune_site_analytics_events()` is
   implemented, tested and has a CLI, and it records its own run — but nothing calls it
   on a timer. Rows older than 90 days remain until something does.
3. **No APM, no tracing, no error aggregation.** There is no Sentry, no OpenTelemetry,
   no request tracing. Application errors go to `console.error` and therefore to the
   platform's log stream. That was a deliberate choice — the mandate was the smallest
   production-safe layer — but it means debugging a production issue means reading logs.
4. **No client-side error reporting.** A JavaScript exception in a student's browser is
   invisible to the operator.
5. **No database-level monitoring.** Slow queries, connection exhaustion and lock
   contention are not measured. The readiness probe reports one latency number, which is
   a smoke signal, not a trend.
6. **Field performance is not collected.** No RUM, no Web Vitals reporting. Lab numbers
   from CI are regression protection only (see `docs/features/PERF-1.md`).

## Extending it

A new scheduled job should:

1. Add its name to `KNOWN_JOBS` in `src/server/jobRuns.ts` — that is what makes
   "never ran" a finding rather than an absence.
2. Wrap its body in `runRecorded`, or call `recordJobRun` on both paths.
3. Put only counters and short identifiers in `detail`. The sanitiser will drop anything
   else, and a dropped field is a hint the payload was wrong.

## Verification status

**Verified here:** the recording module's behaviour under success, refused insert,
throwing client, and thrown job error; the sanitisation bounds; the health verdict for
missing/stale/failing/recovered jobs (16 tests in `tests/job-runs.test.ts`). The three
new database objects are executed against real PostgreSQL with inserted rows, including
the RLS posture check (`tests/migrations.test.ts`).

**Not verified:** that any of this has run in production. There is no deployed origin,
so no job has ever executed on a schedule and `/api/admin/jobs` has never been called
against live data.
