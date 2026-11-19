# EduReach Hub — monitoring, error aggregation and alerts

Companion to [OBSERVABILITY.md](OBSERVABILITY.md). That document describes what
the application records; this one describes the services that watch it, what they
are allowed to receive, and what is still waiting on an account or a decision.

Status: **application side implemented; no account created, no paid plan
activated, no data leaving the process.** Every integration below is inert until
its credential is set.

---

## Approved scope

| Decision | State |
|---|---|
| External uptime monitoring for `/api/health` and `/api/health/ready` | Probe implemented (`scripts/uptime-check.ts` + `.github/workflows/uptime.yml` as an interim); **external provider needs an account** |
| Africa-based vantage point, Nigeria preferred | **Requires a provider choice** — the provider table below is the decision |
| Sentry for application error aggregation, subject to a privacy review | **Implemented and inert**; needs a DSN |
| Alerts for downtime, readiness failures, crashes, grading/submission failures, audit-write failures | Rules specified below; **need the destination** |
| Notifications to maintainers only, no public detail | Enforced by configuration: no status page, no public dashboard, no shared link |
| Paid log aggregation, public status page, full APM, extra vendors | **Not approved, not started** |

`docs/operations/OBSERVABILITY.md` remains the record of truth for what the server
emits; nothing in this document adds a second logging pipeline.

---

## 1. Uptime monitoring

### The probe contract (any provider can implement this)

| | Liveness | Readiness |
|---|---|---|
| URL | `https://edureachhub.netlify.app/api/health` | `https://edureachhub.netlify.app/api/health/ready` |
| Method | `GET` | `GET` |
| Healthy | HTTP 200 **and** body `{"status":"ok"}` | HTTP 200 **and** body `{"status":"ready"}` |
| Unhealthy | anything else, or no response | HTTP 503 (fail-closed) |
| Interval | 5 minutes | 5 minutes |
| Timeout | 15 s | 15 s |
| Confirm before alerting | 2 consecutive failures | 3 consecutive failures, or 5 minutes of 503 |
| Locations | one African probe **plus** one global probe | same |
| Alert recipients | maintainers only (email; add a chat channel only if the owner wants one) | same |
| Recovery | notify on recovery, once | same |

Two numbers matter more than the rest: **confirm across locations** (a single
probe with a bad route reports a false outage) and **check from Africa** (guide
8.7). A monitor that only checks from Virginia says nothing about a student in
Lagos.

### Why readiness is not alerted on yet

The deployed project currently answers **503 `degraded`** on `/api/health/ready`
because `cbt_attempts.protocol` is not applied in production (`cbt_protocol_schema`
fails, `database` passes). That is the known KNOWN-1 blocker, not an outage:

- the interim workflow reports readiness but only fails the run when
  `UPTIME_READINESS_STRICT=1`;
- the external provider should be configured for readiness **after** that
  migration lands, or pointed at it immediately with readiness alerts muted — the
  second is worse, because a muted check is forgotten.

Do not weaken the check to make it green. Readiness is right; the database is
behind.

### Provider options (prices read 19 November 2026 — re-verify at signup)

| Provider | Free tier | Free tier has an African probe? | African locations | Smallest paid plan for an African probe |
|---|---|---|---|---|
| **NodePing** | None — 15-day trial | n/a | **Lagos (NG)**, Johannesburg (ZA), Cairo (EG) since Feb 2026 | **Personal, $10/month**, unlimited SMS/email alerts, 1-minute checks |
| **Site24x7** | Free plan is web-only (1 site, limited locations) | No | **Lagos (NG)**, Nairobi (KE), Johannesburg + Cape Town (ZA), Cairo (EG) | **Web Uptime $10/month** ($9 annual): 25 sites, 1-minute polling, 32 locations |
| **Uptime.com** | Historically free for a small monitor count | Partly — but **Lagos is being decommissioned** (announced for 6 Nov 2026) | Cape Town + Johannesburg remain | Paid tiers |
| **Better Stack** | 10 monitors, 3-minute checks | **No** | US/EU/Asia | ~$29/month |
| **UptimeRobot** | 50 monitors, 5-minute checks | **No** | US/EU/Asia | ~$7–9/month (no African probe) |
| **Checkly** | 10 uptime + API checks, 2-minute checks | Not documented | — | Hobby is free but location list must be verified |
| **EishUp** (eishup.africa) | Unknown | Yes — African-first | South Africa ×4, **Nigeria**, Kenya, Mauritius | Unknown; local provider, smallest footprint |

**Recommendation:** one paid African probe is unavoidable — every free tier that
has an African location is either unknown or being withdrawn.

- **Cheapest credible:** NodePing Personal, **$10/month**, Lagos + Johannesburg,
  unlimited alerts, no per-alert cost. Adds one vendor.
- **If a second service is unwelcome:** Site24x7 Web Uptime, **$10/month**, covers
  Lagos and Nairobi in one product; it is a bigger product than needed.

Given the "no additional vendors, no paid infrastructure without approval" rule,
this is the decision to take: **$10/month at one provider, or stay on the free
interim probe**. The rollback is trivial either way — one monitor, one URL pair.

### The interim probe (already in the repository, no account, no cost)

- `scripts/uptime-check.ts` — probes both endpoints, exits 1 when liveness fails
  (or readiness fails with `--strict-readiness`), prints a JSON summary with
  `--json`.
- `.github/workflows/uptime.yml` — runs it every 15 minutes on `main`, writes a
  run summary, and fails the run on a liveness failure so the repository's
  watchers (maintainers, on a private repository) are notified.

**What it cannot do:** GitHub schedules are best-effort and can be delayed or
dropped, the runner is not in Africa, and one failure pages without confirmation
from another region. It is a stopgap that works today, not the guide's monitoring.

### Environment

| Variable | Purpose |
|---|---|
| `PROBE_BASE_URL` | probe target, default `https://edureachhub.netlify.app` |
| `UPTIME_READINESS_STRICT` | `1` makes a readiness failure fatal for the probe |
| `UPTIME_TIMEOUT_MS` | per-probe timeout, default 15000 |

---

## 2. Error aggregation (Sentry)

### What is implemented

`lib/errorTracking.ts` — inert without `SENTRY_DSN`:

- the SDK is imported **only** when a DSN is set, so an unconfigured deployment
  never loads it and its startup path is unchanged;
- `lib/observability.ts` keeps writing the one sanitised JSON line per event and
  hands the same record, plus the original exception, to a registered forwarder.
  One pipeline, not two;
- forwarding is deliberately narrow: **error/critical only**, and only for a
  documented allowlist (`http.server_error`, `http.unhandled_exception`,
  `process.uncaught_exception`, `process.unhandled_rejection`,
  `server.start_failed`, the CBT start/paper/save/submit/guest-submit events,
  both regrade events, `audit.write_failed`, `scheduled_job.failed`,
  `newsroom.refresh_failed`) — or any event that carries a real exception;
- one issue per event name, plus route and status where they exist, so counts
  mean "how often" rather than "how many different strings";
- two volume caps (see quota, below).

Route-level admin failures are **not** forwarded individually: each also produces
`http.server_error` with the route and status, and forwarding both would double
every incident in the tracker.

### The privacy review (what a third party receives)

Enforced in code, not by convention — `redactSentryEvent` plus the SDK's own
collection switches:

| Data | Setting |
|---|---|
| User identity (`user.*`, emails, IP addresses) | `dataCollection.userInfo: false`, and `user` is deleted in `beforeSend` |
| Cookies | `dataCollection.cookies: false`, deleted in `beforeSend` |
| Request headers (incl. `authorization`, `cookie`) | `dataCollection.httpHeaders: false`; only method + path are kept |
| Request/response bodies | `dataCollection.httpBodies: []` |
| Query strings | `dataCollection.urlQueryParams: false`; the path is kept, the query is dropped |
| Breadcrumb payloads (fetch URLs, console arguments) | `beforeBreadcrumb` keeps category/level/time/path-shaped message only |
| Contexts (OS, device, cloud resource) | deleted — fingerprinting surface with no operational value |
| Server name / hostname | deleted |
| Stack-frame local variables and source context | `stackFrameVariables: false`, `frameContextLines: 0` |
| `extra` (our own context) | run through the same key-name redactor the log uses (`token`, `secret`, `password`, `authorization`, … → `[redacted]`, strings capped at 300) |
| Performance traces | `tracesSampleRate: 0` — tracing is the unapproved APM item |
| Release/environment | the commit reference only (7–12 hex characters) |

What is **kept** is what makes the service worth having: the exception type, the
message, the stack trace, the event name, the request id, and the sanitised
context (ids, counts, SQLSTATE). A maintainer resolves a report to the same
`request_id` that appears in the platform log and the student's screenshot.

`tests/error-tracking.test.ts` asserts all of the above, including that a bearer
token and a query string never appear in a forwarded payload.

### Quota and cost

| | Value |
|---|---|
| Plan | Sentry **Developer — $0**, no card |
| Allowance | 5,000 errors/month, **one user seat**, 30-day lookback, email alerts |
| Overage behaviour | events beyond the quota are **dropped** for the rest of the month (no surprise invoice) |
| Our caps | **30 events/hour** and **150 events/day** |
| Worst case | 150 × 31 = **4,650/month** — the free allowance is unreachable by construction |

Two consequences worth stating plainly:

1. **One seat.** With the free plan only one maintainer can open the dashboard.
   Email alert rules still deliver to an address, and additional recipients need
   the Team plan ($26/month billed annually, 50,000 errors). If more than one
   maintainer must investigate, that is a cost decision, not a code change.
2. **Capped events are not lost.** The structured log line is still written; only
   the aggregated copy is dropped. Our own log remains the complete record.

### Environment

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | setting it activates the tracker; empty keeps it off |
| `SENTRY_MAX_EVENTS_PER_HOUR` | default 30 |
| `SENTRY_MAX_EVENTS_PER_DAY` | default 150 |

**Do not commit a DSN.** It is a public-by-design ingest key, but treating it as a
secret keeps the configuration uniform with every other credential and prevents a
staging project from writing into production.

---

## 3. Alert rules

Create these once the account exists. Every rule notifies maintainers only; there
is no public status page and no shared dashboard link.

### From the uptime provider

| Rule | Condition | Severity |
|---|---|---|
| Site down | liveness fails on 2 consecutive checks from 2+ locations | page |
| Cannot serve | readiness 503 on 3 consecutive checks, or 5 minutes | page |
| Recovered | any monitor returns to healthy | info, once |

### From Sentry (issue alerts, filtered by the `event` tag)

| Rule | Query | Threshold | Severity |
|---|---|---|---|
| Crash | `event:process.uncaught_exception` OR `event:process.unhandled_rejection` OR `event:server.start_failed` | any new issue | page |
| Server failures | `event:http.server_error` | > 20 events in 5 min, or a new route/status pair | page |
| Unhandled exception in a route | `event:http.unhandled_exception` | any | page |
| Submission failures | `event:cbt.submit_failed` OR `event:cbt.guest_submit_failed` | > 5 in 10 min, or any new issue | page |
| Grading / regrade failures | `event:cbt.regrade.failed` OR `event:cbt.regrade.preview_failed` | any apply failure | page |
| Session start / save failures | `event:cbt.start_failed` OR `event:cbt.paper_failed` OR `event:cbt.draft_save_failed` | > 5 in 10 min | investigate |
| Audit write failures | `event:audit.write_failed` | any | investigate — compliance gap |
| Scheduled job failed | `event:scheduled_job.failed` OR `event:newsroom.refresh_failed` | any | investigate |

Deliberately not alerted: single `warn` lines, 404s, the 401 a logged-out browser
produces, rate-limit refusals in normal volume, and any event on a successful
path. Guide 8.7's "alert on every normal event" trap is the fastest way to make
maintainers ignore alerts.

---

## 4. Grading backlog and ungraded submissions

Guide 8.7 asks for "grading queue growth". The architecture says the phrase does
not apply: **there is no grading queue** — `submit_cbt_attempt_configured` and the
v2 finalise RPC grade inside the submit transaction and write `score` on the same
row. So the measurement is of the two states a queue would have hidden:

| Measurement | Meaning | Threshold |
|---|---|---|
| `stuck_open` | attempts still `in_progress` whose own `expires_at` passed more than 60 minutes ago | alert at **50** |
| `oldest_stuck_minutes` | age of the oldest such attempt | alert at **60** minutes |
| `ungraded_submitted` | `submitted` attempts with `score is null` — should be impossible | alert at **1** |

Where it appears: `GET /api/admin/jobs` (capability `analytics.read`) returns a
`backlog` object next to the job health, and logs `cbt.backlog_alert` (or
`cbt.backlog_unavailable` when a count could not be read). Each read is
independent: a failure reports `null` for that number and is named in
`unavailable`, so a partial answer is never mistaken for a clean one.

Implementation: `src/server/operations.ts`, three single-row aggregates over
`cbt_attempts`, no new table, no new index, no schema change. Tests:
`tests/operations-backlog.test.ts`.

Why this and not a periodic grader: the grader already runs. What was missing was
the evidence that it ran for everyone.

---

## 5. Database connections near the limit

Not implemented in code, on purpose. PostgREST does not expose `pg_stat_activity`,
so the three ways to get a connection count are all commitments the owner has not
approved:

| Option | What it costs | Verdict |
|---|---|---|
| Supabase dashboard → **Reports → Database** (connections), and the pooler's client connections | nothing — the provider already reports it | **Use this; it is the smallest accurate measurement** |
| Supabase project alerts (CPU, memory, disk) to maintainers | provider feature, no new vendor | Recommended alongside it |
| A new `SECURITY DEFINER` RPC reading `pg_stat_activity` | a schema object and a privileged read on a public endpoint | Needs approval; not built |
| Supabase Management API token + a polling job | a new long-lived secret and a new dependency | Needs approval; not built |

Recommended check: once a week during term, and during any incident, look at
connections against the project's pooler limit; treat **80 % sustained for 10
minutes** as the threshold. If this needs to be automatic, the RPC option is the
smallest path — deliberately not taken here because it adds a privileged surface
for a number the provider already draws.

---

## 6. What is deliberately not done

- **Paid log aggregation / long-term log storage** — not approved. The platform's
  own function log plus `scheduled_job_runs` and `admin_audit_logs` cover the
  short term.
- **Public status page** — not approved. Nothing here exposes operational detail
  publicly.
- **Full APM / metrics platform** — not approved; `tracesSampleRate: 0`.
- **Additional monitoring vendors** — one uptime provider (decision above) and
  Sentry, nothing else. Sentry's own uptime/cron monitors are not used: they have
  no African location.

---

## 7. Verification

**Verified locally:** the probe exits 1 on a failing liveness response and 0 on a
healthy one (`scripts/uptime-check.ts` exercised against a local server in the
monitoring tests); the tracker is off without a DSN and loads no SDK; the
forwarding allowlist, the hourly and daily caps, and every redaction rule in the
table above (`tests/error-tracking.test.ts`); the backlog thresholds and their
failure tolerance (`tests/operations-backlog.test.ts`).

**Not verified, because no account exists:** that Sentry ingests these events,
that the alert rules fire, and that an uptime provider notices a real outage.
Those are the first checks after the credentials are added.
