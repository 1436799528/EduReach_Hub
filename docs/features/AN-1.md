# Feature: AN-1 — Analytics taxonomy, payloads and retention

Status: **delivered** (2026-10-01). This specification was written before the
code, per `docs/architecture/08-FEATURE-TEMPLATE.md`. Evidence is at the end.

## Purpose

The catalogue entry is blunt: *"Product decisions are being made on six events;
also a privacy requirement"*. Both halves are true today.

**Six events.** `page_view`, `service_view`, `service_submit`, `cbt_start`,
`cbt_submit`, `search` — declared once in a TypeScript union in `src/lib/api.ts`
and a second time as an inline regular expression in `server.ts`. Nothing ties
the two together, nothing ties either to the call sites, and nothing ties any of
them to a document. A seventh event cannot be added without editing three places
and remembering to.

**A privacy requirement.** The ingest endpoint stores whatever `metadata` object
it is handed:

```ts
metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}
```

No key allowlist, no type check, no length cap. What the product currently sends
through that door is the raw search query — `{ q: term.slice(0, 120) }` — which is
then rendered back in the admin console under "Top searches". A student searching
for their own name, their result slip, a school and a matriculation number has
written personal data into a table with no retention window, and an administrator
with `analytics.read` can read it.

AN-1 makes the taxonomy the single source of truth, makes every payload a
declared, validated shape, stops the free-text leak at the door, gives the raw
rows a retention window that is actually executable, and puts a check in the gate
so the taxonomy cannot drift again.

It is not a reporting feature. The admin console already has a read path
(`admin_dashboard_metrics`, `admin_activity_breakdown`); AN-1 changes what may be
*stored*, not what the console looks like — with one exception, the raw-terms
panel, which has nothing left to render and is replaced by the two numbers that
still answer the question it was there to answer.

## User

- **Primary (indirect):** the student whose searches, service visits and CBT
  attempts are recorded. They never see this feature; they are protected by it.
  The promise to them is narrow and must stay narrow: no free text they typed,
  no identity beyond a session id and (when signed in) their user id, and raw
  rows deleted after a fixed window.
- **Secondary:** the administrator with `analytics.read` (content planning) and
  the platform owner (funnel decisions). They get a defined funnel vocabulary
  instead of six names of unknown completeness.
- **Not a user:** third parties. No event leaves the system, there is no vendor
  script, and this feature adds no dependency.

## User Flow

Unchanged for the student. Every event is fire-and-forget: `trackEvent` returns
`void`, failures are swallowed, and no UI waits on a request. The only flows that
gain events are three pages that already exist (`/news/<slug>`, `/schools/<id>`,
`/cbt/setup/*`) and one interaction that already exists (opening a notification
on the dashboard), where the analytics call rides along with the action.

## Screens

No new screens and no new components. One existing panel changes its numbers:

| Screen | Before | After |
|---|---|---|
| `/admin/analytics` → "Audience focus" → *Top searches* | The literal query each student typed | **Searches** (count in the window) and **Zero-result searches** (count where the results were empty) — the two signals the panel was actually used for |

Everything else on the console is untouched.

## Routes

None added. The event names are not routes and get no URL.

## Components

| Component | Change |
|---|---|
| `src/lib/analyticsTaxonomy.ts` (**new**) | The taxonomy itself: every event with its funnel, purpose, declared metadata keys (type, cap, meaning) and retention window; `validateAnalyticsMetadata()`; `analyticsEventNames`; `isAnalyticsEvent()` |
| `src/lib/api.ts` | `TelemetryEvent` is derived from the taxonomy instead of declared beside it; `trackEvent` validates against it (defence in depth — the server still refuses anything undeclared); `search` sends no free text |
| `server.ts` | `POST /api/analytics/event` validates through the taxonomy: declared event, declared keys only, per-key type and cap, total payload cap; `path` loses its query string; `referrer` is reduced to origin + path |
| `pages/SearchPage.tsx` | `search` carries `{ query_length, result_count }` instead of `{ q }` |
| `pages/NewsArticlePage.tsx` | `news_view` when an article resolves |
| `pages/SchoolDetailsPage.tsx` | `school_view` when a school resolves |
| `pages/ExamSetupPage.tsx` | `cbt_setup_view` when a setup wizard opens |
| `pages/StudentDashboardV2.tsx` | `notification_open` when a notification is opened |
| `src/lib/errorTelemetry.ts` (**P2-2**) | `client_error` from the route ErrorBoundary and the global `error` / `unhandledrejection` listeners — constructor name and source only, never the message |
| `supabase/migrations/20261001120000_analytics_retention.sql` (**new**) | `created_at` index, `prune_site_analytics_events(p_days)`, and the replacement `admin_activity_breakdown` that no longer returns query text |
| `scripts/analytics-retention.ts` (**new**) | `npm run analytics:retention` — prints what would be pruned; `--apply` deletes. Refuses to run without service-role credentials |
| `scripts/analytics-audit.ts` (**new**) | The static gate: taxonomy ↔ emit sites ↔ server ↔ this document |
| `pages/AdminAnalyticsPage.tsx` | The search panel described above |
| `docs/architecture/02-DATA-MODEL.md` | The table's row loses "no retention policy yet" and gains the real posture |

No component is renamed, no page is redesigned, and no dependency is added.

## User Actions

For the student: none that are visible. Opening an article, a school page, a CBT
setup wizard or a notification now also records that they did — which is exactly
what the six existing events already do on their pages.

For the administrator: the same actions in the console. Nothing new to click.

## Button Logic

Not applicable — no button, menu or form behaviour changes. The admin search
panel is read-only in both shapes.

## Data

**Storage:** `site_analytics_events` (unchanged shape). No column is added or
dropped; what changes is which rows may reach it and for how long they stay.

**Taxonomy (the single source of truth).** Eleven events across five funnels. Every
`metadata` key is declared with a type and a cap; anything else is dropped before
the insert.

| Event | Funnel | Purpose | Metadata (type, cap) |
|---|---|---|---|
| `page_view` | discovery | Which pages are reached, by route | — |
| `search` | discovery | That a search happened and whether it found anything | `query_length` (number), `result_count` (number) |
| `news_view` | discovery | Which published articles are actually read | `slug` (string, 160), `category` (string, 40, optional) |
| `school_view` | discovery | Which institutions students look up — evidence for INT-3 sourcing order | `schoolId` (string, 64) |
| `service_view` | service | Which service pages attract demand | `slug` (string, 80) |
| `service_submit` | service | Which services are completed, not just browsed | `slug` (string, 80) |
| `cbt_setup_view` | cbt | Which exam bodies reach the setup wizard | `mode` (string, 20) |
| `cbt_start` | cbt | Which banks are actually attempted | `examId` (string, 64), `examTitle` (string, 120) |
| `cbt_submit` | cbt | Attempt completion — the denominator for `cbt_start` | `examId` (string, 64) |
| `notification_open` | notification | Whether NTF-1's notifications are read, not just delivered | `status` (string, 30) |
| `client_error` | reliability | That a page failed in the browser (P2-2) — an alert, not a trace | `source` (string, 24, required), `kind` (string, 64) |

`search` deliberately does **not** carry the query. The two numbers answer the
product question ("are people searching, and is the catalogue answering?") and
carry none of the personal data the literal term did. A student's search box is
where they type their name, their school and their problem; it is not a report.

**Retention:** raw rows are pruned after **90 days** by
`prune_site_analytics_events(90)`. The window is in the taxonomy
(`RETENTION_DAYS`), asserted against the function's default by the audit, and
stated in this document — three places that must agree, which is why a test
checks them. Aggregates the console shows are 24-hour and 14-day windows, so
pruning cannot change a number anyone has already seen.

**No new data, no export, no third party.**

## Data Source

Everything is derived from actions the application already performs; no event is
recorded that does not correspond to a real user action with a real call site.
The audit fails if a declared event has no emitter, and fails if an emitter names
an undeclared event — so the table above and the code cannot drift apart.

## Backend

`POST /api/analytics/event` (same route, same rate limit, same 204-on-failure
behaviour — analytics must never break a page):

1. Resolve `event_name` against the taxonomy; undeclared → 400 (unchanged
   contract, now derived from one list instead of an inline regex).
2. Validate `metadata`: keep declared keys only; drop wrong types; truncate
   strings to their declared cap; reject nested objects and arrays; refuse the
   payload above 2 KB.
3. Sanitise the surroundings: `path` loses its query and fragment (a URL query
   can carry a token or an email), `referrer` keeps origin + path only, the
   `user_agent` cap drops to 200 characters.
4. Insert with the service role, as today.

New database objects (one migration): an index on `created_at` for the prune and
the window counts, `prune_site_analytics_events(p_retention_days int default 90)`
returning the number of deleted rows (service-role only, revoked from `public`,
`anon`, `authenticated`), and a `create or replace` of `admin_activity_breakdown`
whose search data is counts instead of terms.

## Security

- **No free text.** The only user-typed value the system ever received was the
  search query. It is gone from the client, from the taxonomy and — with the
  replacement RPC — from the console. Validation is an allowlist, so a future
  client mistake or an attacker's crafted body cannot reintroduce it: an
  undeclared key is dropped, not stored.
- **No identity beyond what exists.** The endpoint never accepts a `user_id` from
  the body; it resolves the user from the bearer token, as it already did
  (ROLE-1's rule: never trust client-supplied identity). `session_id` stays a
  random per-tab value.
- **The table stays server-only.** RLS on, no policy, no grant to `anon` or
  `authenticated` (BASE-1b posture, unchanged); the new function is
  service-role-only and `security definer` with an empty `search_path`, matching
  every other function in the schema.
- **Bounded damage.** Rate limiting is unchanged, and payload caps mean the worst
  a single request can add is 2 KB of declared fields.
- **Unchanged:** no event is sent to a third party, no cookie is set beyond the
  existing session id in `sessionStorage`, and `trackEvent` still cannot throw
  into a page.

## States

| State | Behaviour |
|---|---|
| Taxonomy unavailable to a client bundle (it is not — it is bundled) | n/a |
| Unknown event name | Server: 400, nothing stored. Client: `trackEvent` ignores it and logs nothing (it cannot throw) |
| Undeclared metadata key | Dropped silently by the server; the audit makes it a build failure in this repository |
| Value over its cap | Strings truncated to the cap; numbers that are not finite dropped |
| Supabase not configured | Endpoint returns 204 and stores nothing (unchanged local-preview behaviour) |
| Insert fails | 204, error logged server-side (unchanged: analytics never surfaces to the user) |
| Prune script without credentials | Refuses to run, explains which variable is missing, exits non-zero — and `--dry-run` needs no credentials at all |

## Edge Cases

1. **A student searches their own name.** Nothing about the query is stored or
   displayed; the row records that a search happened, how long the term was and
   how many results came back.
2. **A URL with a token in the query** (`?token=…`). `path` is stored without its
   query string, so the token never reaches the table.
3. **A referrer carrying a search term** (`google.com/search?q=…`). Only origin +
   path are kept.
4. **A signed-in student.** The row gains their `user_id` — as before — which is
   why the 90-day window matters: it bounds how long any row can be linked to a
   person.
5. **Retention run twice in a day.** Deleting by `created_at < cutoff` is
   idempotent; the second run deletes what has aged past the line since.
6. **The clock is the database's**, not the script's: the cutoff is computed in
   SQL so a wrong local clock cannot delete the wrong window.
7. **An event added without an emitter, or an emitter without an event** — the
   audit fails the gate and names both sides.

## Analytics

This is the feature. What changes about analytics itself: the event set is
complete for the funnels the console reports, every payload is declared, and the
one payload that contained personal data no longer exists. The instrumentation
does not instrument itself (no event records an event).

## Notifications

One event is added *for* notifications: `notification_open` closes the loop NTF-1
opened. NTF-1 could say a notification was created, written and marked read;
nothing could say whether it was opened. No notification is sent, and no
user-facing message changes.

## Testing

| Layer | Check | Runs |
|---|---|---|
| Unit (node:test) | `tests/analytics.test.ts` — the validator (declared keys kept, undeclared dropped, caps enforced, non-finite numbers dropped, nested objects refused, payload cap, unknown event refused), the retention planner, the taxonomy's own invariants (unique names, non-empty purposes, no free-text keys), and the audit's failure paths run against synthetic trees | `npm test`, locally and in CI |
| Static gate | `npm run analytics:audit` — taxonomy ↔ emit sites ↔ server ↔ this document; fails with the offending file and event named | inside `npm run ci`, straight after `perf:audit`; `tests/ci.test.ts` asserts the stage in the same commit |
| Schema | `tests/schema.test.ts` / `tests/migrations.test.ts` (existing) — the new migration applies in the PostgreSQL replay and the objects it creates exist | `npm test`, in the replay |
| Operational | `npm run analytics:retention -- --dry-run` prints the window and the cutoff; `--apply` requires credentials. Execution is a post-deploy runbook item, because a scheduler is OBS-1's job, not this feature's | manual, after deployment |
| Browser | Not applicable — no user-visible behaviour is added; the existing Playwright suite still asserts that no route throws, which covers `trackEvent` never breaking a page | `npm run test:e2e` |

## Evidence

**What the audit found before anything was written.** Six event names, declared
twice — a TypeScript union in `src/lib/api.ts` and an inline regular expression
in `server.ts` — with nothing tying the two together or to the call sites. The
ingest endpoint stored whatever `metadata` object it was handed (`typeof
req.body.metadata === 'object' ? req.body.metadata : {}`): no key allowlist, no
type check, no cap. Through that door went `{ q: term.slice(0, 120) }` — the
student's literal search query — which was then rendered back in the admin
console in **two** places (`AdminAnalyticsPage` and `AdminDashboardPage`; the
second was found by the typecheck, not by the plan). No retention window of any
kind; the data-model row said so in its own words ("no retention policy yet").
`page_view` had a third problem: it bypassed `trackEvent` entirely with its own
`fetch` and its own duplicate session-id helper in `src/app/App.tsx`, so there
were two ingest paths to keep in agreement.

**What changed.** `src/lib/analyticsTaxonomy.ts` is now the single source of
truth: eleven events across five funnels, each with its purpose and its declared
metadata keys (type, cap, reason). Both the client and `server.ts` validate
through it; the inline regex is gone, and `tests/ci.test.ts` fails the gate if
`npm run analytics:audit` is ever removed from `npm run ci`. `search` sends
`query_length` and `result_count` instead of the term. The stored path loses its
query string and fragment (a token or an email can live there), the referrer
keeps origin and path only, the user agent is capped at 200 characters, and
`user_id` still comes from the bearer token and never from the body. `page_view`
now goes through `trackEvent` with the rest. Four events close real gaps:
`news_view`, `school_view`, `cbt_setup_view` and `notification_open` (the last
closes the loop NTF-1 opened — whether a notification was read, not just
delivered).

**Client error telemetry (P2-2).** `client_error` is the one event whose user
action is not a page view: `src/app/ErrorBoundary.tsx` reports when a route
throws, and `installGlobalErrorReporting()` (called from `src/main.tsx` in
production builds only) captures `error` and `unhandledrejection` outside React.
The payload is a source enum and the error constructor name — deliberately not
the message and not the component stack, both of which can contain whatever the
page was holding. Reports are deduplicated per session and capped, so one broken
render loop cannot become a flood. The admin console reads the same
`site_analytics_events` rows as every other event; nothing new is redacted
because nothing sensitive is sent.

**Retention.** `supabase/migrations/20261001120000_analytics_retention.sql` adds
the `created_at` index, `prune_site_analytics_events(p_retention_days int default
90)` (service-role only, `security definer`, empty `search_path`, cutoff computed
in SQL so the database's clock decides what is old), and replaces
`admin_activity_breakdown` so its search data is counts rather than terms. The
console's two search panels now show searches performed and searches that found
nothing. `tests/migrations.test.ts` proves the new function exists after the full
replay; `scripts/analytics-retention.ts` is the executable unit.

**Tests.** `tests/analytics.test.ts` (26 tests) covers the validator's refusals —
undeclared keys dropped, a search term refused under ten plausible key names,
required fields enforced, strings capped at their declared limit, non-finite
numbers and nested objects dropped, the byte cap — plus the sanitised
path/referrer/user-agent, the retention planner, and every one of the audit's
eight failure paths against synthetic trees.

**Verification.** Local gate at the delivery commit: `npm run typecheck` clean,
`npm test` 300 passing / 0 failing (1 skipped by design in a clean clone), `npm
run schema:audit` no blocking findings, `npm run build` clean, `npm run
perf:audit` every budget passing, `npm run analytics:audit` all eight checks
agreeing. The CI run that gated it is recorded in the completion report.

## Known limitations (declared up front)

1. **The prune needs a scheduler that does not exist yet.** OBS-1 (scheduled-run
   monitoring) is unselected. AN-1 delivers the executable unit, the documented
   window and the runbook step; until something calls it, rows older than 90 days
   remain in the table. Saying otherwise would be a claim about a job nobody runs.
2. **Retention does not rewrite history.** Rows already stored with `q` in
   `metadata` are outside this feature's reach: pruning after 90 days is the
   mechanism that removes them, and a targeted one-off cleanup is an operational
   decision (runbook), not a migration that deletes production rows.
3. **No consent banner and no user-facing control.** PRIV-2 owns the cookie /
   analytics-notice work; AN-1 narrows what is collected but does not add a
   preference surface.
4. **Not a funnel *report*.** The console renders what it rendered before, with
   the search panel's raw terms replaced by counts. Building conversion
   dashboards is a product decision after AN-1's data exists, not this feature.
5. **Events are client-reported.** A determined client can send false events;
   the caps and the rate limit bound the damage, and nothing downstream makes a
   security decision from analytics. Server-side truth lives in
   `service_requests` and `cbt_attempts`, which is where the console's
   transactional metrics come from and why they are unaffected.
6. **The 90-day window is a policy choice, not a measurement.** It is stated
   here, in the taxonomy and in the function default so that changing it is one
   deliberate edit in three agreeing places — the audit will fail if they stop
   agreeing.
