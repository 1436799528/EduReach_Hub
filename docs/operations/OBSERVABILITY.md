# EduReach Hub — Observability

What the system can tell you when something breaks, what it cannot, and what to do
about the gap. Written against the code as it is, not as it should eventually be.

**Local release candidate:** optional analytics are suspended, including the
consent-gated `client_error` transport. The health and existing server-side
operational paths are not intentionally disabled, but they do not replace browser
error monitoring. Classify and approve a privacy-safe essential monitoring design
before launch; do not treat this note as proof of a working alert service.

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
→ 200 { "status": "ready", checks: { server, supabase_configured, database, cbt_protocol_schema }, database_latency_ms }
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

## Structured server events (OBS-2)

Everything the server reports about itself now goes through `lib/observability.ts`.
Before it, ninety-odd call sites wrote `console.error('Admin news create error:', error)`
— free text, a raw driver object, no severity a machine could sort on, and no way to
tell which request produced it.

**One event is one line, one JSON object:**

```json
{"ts":"2026-11-19T15:02:11.482Z","level":"error","service":"edureach-api",
 "env":"production","event":"cbt.submit_failed","request_id":"01JABCDEF0123456789",
 "attempt_id":"5f6c…","error_name":"PostgrestError","error_code":"PGRST202"}
```

| Field | Meaning |
|---|---|
| `ts` | ISO-8601 UTC |
| `level` | `debug` · `info` · `warn` · `error` · `critical` |
| `service` / `env` | always `edureach-api`, and `production` or `development` |
| `event` | dotted, stable, lower snake case — never interpolated with a value |
| `commit` | deploy reference when the platform provides one (`COMMIT_REF`) |
| `request_id` | correlation id; the one on the `X-Request-Id` response header |
| … | event-specific context: ids, counts, durations, `error_name`/`error_code` |

**Levels mean what they say.**

| Level | Use | Stream |
|---|---|---|
| `debug` | per-request detail, off by default in practice | stdout |
| `info` | a lifecycle point worth keeping: startup, a completed background run | stdout |
| `warn` | recoverable and expected in small numbers: a refusal, a degraded dependency, a slow request | stderr |
| `error` | a request or job failed and the caller saw an error | stderr |
| `critical` | the process cannot continue correctly: a boot failure, an uncaught exception | stderr |

`warn` and above go to **stderr** so a platform that separates streams can alert on the
error stream alone without parsing the request log.

**Event names are a fixed vocabulary.** `area.subject_action`, where the area is
`http`/`auth`/`cbt`/`admin`/`api`/`question_import`/`question_banks`/`institutions`/
`site_content`/`newsroom`/`scheduled_job`/`health`/`process`/`server`/`audit`/`sitemap`/
`ratelimit`/`notifications`. A name never contains an id or a message, so counting them
is meaningful.

**What is emitted today** (the full list is the `log.*` calls in `server.ts`, `lib/`,
`src/server/` and `netlify/functions/`; `tests/observability.test.ts` keeps new code on
this path):

| Area | Events | Fires when |
|---|---|---|
| HTTP | `http.server_error`, `http.denied`, `http.slow`, `http.unhandled_exception` | a response finished 5xx, 401/403, took ≥ 5 s (`OBS_SLOW_REQUEST_MS`), or an exception reached the error handler |
| Auth | `auth.verify_failed`, `auth.refused_unauthenticated`, `auth.refused_missing_capability` | a bearer token did not verify, or a capability guard refused |
| Health | `health.degraded`, `health.recovered` | readiness changed state, plus a 10-minute reminder while it stays degraded |
| CBT | `cbt.start_failed`, `cbt.paper_failed`, `cbt.draft_save_failed`, `cbt.submit_failed`, `cbt.guest_submit_failed`, `cbt.abandon_failed`, `cbt.question_report_failed`, `cbt.regrade.failed`, `cbt.regrade.preview_failed`, `cbt.expiry_marking_unavailable`, `cbt.question_provenance_refused` | a simulation, save, submission, grading or report operation failed |
| Question import | `question_import.{upload,commit,retry,review,item_update,update,delete,list,detail,source,publish,publication,failure}_failed` | any step of the import and publish pipeline |
| Question banks | `question_banks.{inventory,candidate_list,candidate_search,history,classification,release_change,assignment,revocation}_failed` | restricted-bank administration failed |
| Institutions | `institutions.{read,list,detail,review_queue,profile_write,academic_unit_create,academic_unit_write,programme_create,programme_write,requirement_write,admission_route_write,evidence_review}_failed`, `institutions.cache_refresh_failed` | intelligence reads, writes, or a stale-cache refresh |
| Content | `site_content.*`, `app.content_manager_*`, `app.newsroom_*`, `newsroom.refresh_failed`, `sitemap.source_unavailable` | CMS reads/writes, newsroom runs, sitemap sources |
| Public API | `api.{news,news_article,services,service,upcoming,opportunities,opportunity_detail,past_question_resources,cbt_exams_list,cbt_history,cbt_delete,guest_cbt_question}.failed` | a public read failed |
| Admin | `admin.<area>.failed` (users, roles, bans, news, calendar, services, service guide, institutions, opportunities, CBT exams and questions, PDFs, uploads, question reports, bootstrap, analytics, job status) | an admin mutation or read failed |
| Background | `scheduled_job.succeeded`, `scheduled_job.failed`, `newsroom.refresh_completed`, `newsroom.source_failed` | the daily Netlify function |
| Lifecycle | `server.starting`, `server.listening`, `server.start_failed`, `process.uncaught_exception`, `process.unhandled_rejection` | boot and crash |
| Audit | `audit.write_failed` | `admin_audit_logs` could not be written — a compliance gap, not a cosmetic one |
| Meta | `ratelimit.throttled`, `log.suppressed` | a limiter refused a request; a repeat was collapsed and the count reported |

**Noise control.** Refusals, 5xx bursts and readiness polls are ordinary events in ones
and twos and an incident in hundreds, so `EventRateLimiter` collapses repeats per
`route`/`status`/`key` and reports the suppressed count when the window reopens
(`log.suppressed`). A degraded readiness that persists is re-reported once every ten
minutes, not once per poll.

**Correlation.** Every request gets an id from `requestIdFor`: `x-nf-request-id` if the
platform sent one (that is what a Netlify log search uses), else `x-request-id`, else
`x-correlation-id`, else a fresh uuid. An inbound id is only trusted when it matches
`^[A-Za-z0-9._:-]{8,64}$` — a header must not be able to inject a value into every line
of a request. The id is echoed on `X-Request-Id`, so a student's screenshot of a failed
request and the log line carry the same value. Route shapes replace uuids with `:id` so
cardinality stays bounded.

```bash
# everything that happened during one request
netlify logs:function api | grep 01JABCDEF0123456789
# every failure in the last hour, worst first
... | jq -c 'select(.level=="error" or .level=="critical") | {ts,event,request_id}'
```

### What is never logged

The sanitiser is a deny-list on **key names**, applied to every context object, at every
depth it walks: a key matching `authorization|auth|cookie|token|secret|password|passwd|
apikey|api_key|service_role|session|jwt|bearer|signature|credential` is replaced with
`[redacted]` rather than dropped (a silently missing field is how a new leak ships). On
top of that:

- **Errors are reduced to facts.** `errorFacts` keeps `name`, a short `code` (SQLSTATE /
  PostgREST) and an HTTP `status`. The message is never logged: that is exactly where a
  driver quotes a column value, a fetch error carries a URL with a token, and a Postgres
  error quotes the offending row.
- **Strings are capped at 300 characters, objects at 24 keys and 2 levels.** Deeper
  structures become `[object]`/`[array:n]`.
- **No PII, no answers, no answer keys.** Context carries ids (`attempt_id`, `exam_id`,
  `question_id`, `import_id`, `user_id` where an operator needs it) and counters —
  never a name, an email, a question body, a chosen option or a key letter.
- **The fatal boot line is the one free-text exception.** A process that cannot start
  has no request context and its message ("refusing a privileged Supabase key", "port in
  use") is the whole diagnostic; it prints the thrown error and nothing from the
  environment. `tests/client-secret-build.test.ts` asserts the key value never appears.

### Crash reporting

`process.on('uncaughtExceptionMonitor')` logs `process.uncaught_exception` **without
changing what Node does next** — the process still dies as it did before. An unhandled
rejection is logged and then rethrown for the same reason: swallowing it here would keep
a broken process alive. These two events are the only signal that cannot arrive through
an HTTP endpoint, so whatever consumes the log must watch stderr rather than poll a URL.

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
| Any 5xx, with the route and the request id | `http.server_error` on stderr + `X-Request-Id` on the response |
| A refused request (401/403) per route | `http.denied`; the capability guard adds `auth.refused_*` |
| A token that does not verify | `auth.verify_failed` (`warn`, collapsed) |
| A slow request (≥ 5 s) | `http.slow` with `duration_ms` |
| A simulation that fails to start / save / submit / grade | `cbt.*_failed` with `attempt_id`, `exam_id` or `question_id` |
| A regrade preview or apply that fails | `cbt.regrade.preview_failed`, `cbt.regrade.failed` |
| An import upload, commit or retry that fails | `question_import.*_failed` with `import_id` |
| An admin mutation that fails | `admin.<area>.failed` with the route's request id |
| An audit row that could not be written | `audit.write_failed` |
| A cache refresh behind a healthy-looking response | `institutions.cache_refresh_failed` |
| The process crashing or failing to boot | `process.uncaught_exception`, `server.start_failed` |

## What is NOT observable — stated plainly

1. **There is no alerting.** Nothing pushes a notification when a job fails. A failure
   is *recorded* and *visible to anyone who looks*, which is not the same thing. The
   operational substitute until OBS-1's alerting half exists is an external uptime check
   on `/api/health/ready` plus a scheduled poll of `/api/admin/jobs`. **Call it polling,
   not alerting.**
2. **The retention prune is not scheduled.** `prune_site_analytics_events()` is
   implemented, tested and has a CLI, and it records its own run — but nothing calls it
   on a timer. Rows older than 90 days remain until something does.
3. **No APM, no tracing, no error aggregation.** There is no Sentry, no OpenTelemetry and
   no span per query. Server events are structured and correlated (`request_id`), and
   they land on the platform's log stream, but **nothing groups them into incidents**:
   the same error is N lines, not one issue with a count. Debugging still means reading
   logs — they are now parseable.
4. **Client-side errors are counted, not inspectable.** `src/lib/errorTelemetry.ts`
   reports a `client_error` analytics event capped at 10 per session, with the source
   enum and the error constructor name only — no message, no stack. It is consent-gated
   and PROD-only, so it is a rate, not a diagnostic. That was a deliberate privacy
   choice; it does not become a stack trace without a decision.
5. **No database-level monitoring.** Slow queries, connection exhaustion and lock
   contention are not measured. The readiness probe reports one latency number, which is
   a smoke signal, not a trend.
6. **Field performance is not collected.** No RUM, no Web Vitals reporting. Lab numbers
   from CI are regression protection only (see `docs/features/PERF-1.md`).

## Alert thresholds (recommended, not wired)

Nothing here notifies anyone yet. These are the conditions worth paging on, the level
they already log at, and the smallest signal that detects each. They are the contract an
alerting integration should implement — not a wish list for new instrumentation.

| Condition | Signal | Threshold | Severity | Notes |
|---|---|---|---|---|
| Site down | `GET /api/health` not 200 | 2 consecutive failures, 1-min interval | **Page** | Liveness only; do not restart-loop on readiness |
| Cannot serve requests | `GET /api/health/ready` ≥ 503 | 3 consecutive failures or 5 min | **Page** | Fail-closed check incl. `cbt_protocol_schema`; never loosen it to go green |
| Error-rate spike | count of `http.server_error` | > 2 % of requests over 5 min, or > 20 in 5 min | **Page** | Absolute floor stops a quiet hour from paging on one error |
| Unhandled exception / crash | `process.uncaught_exception`, `process.unhandled_rejection`, `server.start_failed` | any | **Page** | stderr only; cannot be polled over HTTP |
| Submission failures | `cbt.submit_failed` + `cbt.guest_submit_failed` | > 5 in 10 min or > 2 % of submissions | **Page** | A student loses a completed paper |
| Autosave failures | `cbt.draft_save_failed` | > 5 % of saves over 15 min | **Page** | Silent data loss risk; guide 8.7 |
| Grading / regrade failures | `cbt.regrade.failed`, `cbt.regrade.preview_failed` | any apply failure | **Page** | Results may be wrong |
| Grading queue growth | `scheduled_job_status()` `finished_at` age, or unanswered attempts older than 15 min | > 50 attempts, or any > 1 h | **Investigate** | No table yet; see the gap below |
| Question import failing | `question_import.commit_failed` / `upload_failed` | 3 in 30 min | **Investigate** | Admin-only impact |
| Auth failure burst | `auth.verify_failed` + `http.denied` | > 100 in 5 min from one path | **Investigate** | Also the only early signal of credential probing |
| Audit write failure | `audit.write_failed` | any | **Investigate** | Compliance gap |
| Readiness degraded | `health.degraded` | any transition | **Investigate** | 503 already covers the customer view |
| Database latency | `database_latency_ms` from readiness | > 1 000 ms for 10 min | **Investigate** | Smoke signal, not a trend — see gap |
| Job missed | `/api/admin/jobs` **missing** / **stale** | 2 missed schedules | **Investigate** | Absence has no log line; poll it |
| Slow requests | `http.slow` | > 10 in 5 min on one route | **Tune** | Not a page on its own |

Deliberately **not** alerted: every 401 that a logged-out browser produces, any single
`warn`, 404s, rate-limit refusals in normal volume, and any event on a successful path.

### Where an external service is required

The application side stops here. Everything above is emitted, structured, correlated and
rate-limited; what does not exist is a **destination** and a **decision**. Exactly these
five pieces need a service, an account and an owner:

1. **Log destination.** Netlify keeps function logs for a limited window and offers no
   alerting. A log drain (or any collector) is needed to retain and query events beyond
   that window. Nothing in this repository sends them anywhere else.
2. **Error aggregation.** `http.server_error` and `process.*` are lines, not issues.
   Grouping them (and de-duplicating the same stack) is a product decision about which
   tool — none is installed or configured.
3. **Uptime checks.** `/api/health` and `/api/health/ready` are ready to be polled, but
   nothing polls them, and the guide asks for a vantage point **from Africa** as well as
   the default regions. That choice is also a provider choice.
4. **Alert routing and a status page.** Who is paged, in what channel and at what hour is
   an operational decision, not a code change. The guide's public status page is part of
   the same decision.
5. **Metrics/APM (optional).** Request rate, p95 latency and database connection count
   (guide 8.7) are derivable from the events but not stored as time series. Adding a
   metrics backend is a separate, larger commitment than a log drain.

**Do not add any of these without approval** — no account, no SDK, no vendor-specific
code. The same rule applies to loosening a health check to make a monitor green: a
readiness failure is information, not an obstacle.

### Known instrumentation gaps (smallest fix, not built)

| Gap | Smallest honest fix | Why it is not done now |
|---|---|---|
| Grading-queue depth | one `count(*)` over open attempts in the readiness payload or a job-run detail | needs a schema-independent query review; no new table without approval |
| Database connection count | Supabase dashboard metric, or a `pg_stat_activity` read at the ready endpoint | a privileged read in the health path is a new risk; the dashboard already shows it |
| Query-level tracing | none | that is an APM decision, not a code change |
| Field performance / RUM | a consent-gated Web Vitals event through the existing analytics allowlist | product/privacy decision; the allowlist is deliberate |

## Extending it

A new scheduled job should:

1. Add its name to `KNOWN_JOBS` in `src/server/jobRuns.ts` — that is what makes
   "never ran" a finding rather than an absence.
2. Wrap its body in `runRecorded`, or call `recordJobRun` on both paths.
3. Put only counters and short identifiers in `detail`. The sanitiser will drop anything
   else, and a dropped field is a hint the payload was wrong.

A new route that can fail should:

1. `log.error('<area>.<subject>_failed', { request_id: res.locals?.requestId, ...errorFacts(error) })`
   in its catch block — never `console.error`, never `error.message`.
2. Add the event to the table above and, if it means a customer lost something, to the
   alert thresholds.
3. Keep the response generic while the log stays specific: the caller learns "Unable to
   save that page", the operator learns the route, the request id and the SQLSTATE.

## Verification status

**Verified here:** the recording module's behaviour under success, refused insert,
throwing client, and thrown job error; the sanitisation bounds; the health verdict for
missing/stale/failing/recovered jobs (16 tests in `tests/job-runs.test.ts`). The three
new database objects are executed against real PostgreSQL with inserted rows, including
the RLS posture check (`tests/migrations.test.ts`).

**Verified here (OBS-2, `tests/observability.test.ts`, `tests/request-correlation.test.ts`):**
the line format and stream routing, credential-key redaction, string/key/depth bounds,
`errorFacts` never carrying a message, the correlation-id preference order and its
refusal of a non-id-shaped header, the collapse-and-report behaviour of the rate limiter,
the readiness transition/reminder logic, and — against the real Express app — that a 401
carries the same `X-Request-Id` as its `http.denied` record, that a platform id is
reused, that a bearer token never appears in a record, and that route shapes contain no
uuid. A source-scan test keeps new server code off `console.error`.

**Not verified:** that any of this has run in production. There is no deployed origin,
so no job has ever executed on a schedule and `/api/admin/jobs` has never been called
against live data, and no log drain has ever consumed these events.
