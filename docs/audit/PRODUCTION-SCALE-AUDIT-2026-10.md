# EduReach Hub — Production Readiness, Scalability and Load Testing Audit

**Date:** 21 October 2026
**Branch:** `arena/7365cc64-edureach-hub` at `99b39e6` (PR #26, unmerged)
**Scope:** read-only audit; no application code, schema, policy, configuration or
production state was changed to produce this document.
**Verdict:** **Not yet ready for "thousands of concurrent users".** The Node/HTTP
layer has measurable headroom; the database, auth and rate-limiting paths do not
have evidence behind them, and two of them contain defects that would fail a real
examination session. Fix the four Stage-1 items, then measure on staging.

---

## 1. What was examined, and how

| Area | Method | Result |
|---|---|---|
| A. Frontend/server performance | production build measured on loopback; bundle inventory; source review of fetch patterns | partly measured, browser rendering **not tested** |
| B. Supabase scalability | all 71 migrations replayed into PGlite; index/RLS/grant inventory queried from `pg_catalog`; query shapes read in `server.ts` | schema verified, **database under load not tested** |
| C. CBT reliability | RPC source read end to end; client save/submit state machine read; failure classification traced | logic verified, **concurrent CBT not tested** |
| D. Auth/account security | `requireUser`, `verifyJWT`, capability resolution, rate-limit keys, RLS on every table | verified by code + catalog |
| E. API resilience | route inventory (87), error mapping, timeouts, process handlers, readiness probe | verified by code; one defect |
| F. Deployment/config | `netlify.toml`, `netlify/functions/api.ts`, `Dockerfile`, `public/_headers`, env contract | host resolved: **Netlify** |
| G. Monitoring/recovery | `docs/operations/*`, scheduled-job runs, error paths | documented gaps, no code change |

**Evidence classes used below** — every row says which one it is:

- **Measured** — produced by a command in this environment, numbers in §5.
- **Verified (code)** — read directly from the source or the schema catalog.
- **Estimated** — arithmetic or reasoning from measured inputs, labelled.
- **Not tested** — could not run here; the blocker is named.

Environment: 2 vCPU Xeon @ 2.60 GHz, 3.9 GB RAM, loopback networking, Node
22.22.3, `NODE_ENV=production node build/server.cjs`, **no Supabase credentials**
(so every data path returns its empty state and no query reaches Postgres).

### Deployment host: resolved

`netlify.toml` builds `npm run build`, publishes `dist`, maps `/api/*` to
`/.netlify/functions/api/:splat`, forces `robots.txt` and `sitemap.xml` through
the function, and falls back to `/index.html`. `netlify/functions/api.ts` wraps
the same Express app in `serverless-http`. **There is no `vercel.json`, no Vercel
configuration and no Vercel dependency anywhere in the repository.** The
Netlify-vs-Vercel ambiguity is closed in favour of Netlify. `Dockerfile` is a
secondary self-host path (`node build/server.cjs`, `USER node`, port 3000) and is
not used by the deployment.

---

## 2. Findings

Severity is about the *student-visible consequence*, not code tidiness.

| ID | Sev | Area | Finding | Evidence | User impact | Proposed fix | Verifying test |
|---|---|---|---|---|---|---|---|
| **H-1** | High | C, D | Rate limits are keyed **per IP** and apply to exam start and the whole API. `cbtStart` = 60 per 10 min; `apiGeneral` = 1,200 per min. | `lib/rate-limit.ts` `clientKey()`; `RATE_LIMIT_RULES`; measured: exactly 1,200 × `200` then 352 × `429` from one IP (§5 run G) | A school lab behind one NAT: the 61st student in 10 minutes cannot start an exam; sustained traffic above 20 req/s gets 429s mid-exam while draft saves are pending | Key authenticated routes by **user id** (`cbt-start:${user.id}`), keep IP only as an unauthenticated fallback; raise/scope `apiGeneral` when a valid token is present | unit test for key selection; probe at 100 VU → 0 × 429 |
| **H-2** | High | C | **Zero grace at expiry.** `submit_cbt_attempt_configured` raises when `expires_at < now()`, and the refusal path marks the attempt `expired`. A submit sent at T−1 s that arrives at T+1 s is discarded and the paper is closed with no score. | SQL `20261002120000` L636–640; `get_cbt_attempt_paper` expires the attempt on read; client auto-submits at `remainingSeconds === 0` | A student loses an entire paper to one second of mobile latency — the exact network profile of the target users | Accept a submit within a bounded grace window (e.g. 120 s) while `status='in_progress'`, record `submitted_at` and a late-margin diagnostic; scoring rules unchanged | SQL regression in PGlite: expiry T−1 s submits and scores; expiry T−1 h refuses |
| **H-3** | High | C, E | A transient database/auth failure during submit is returned as **HTTP 400**. | `server.ts` L2733–2738: unclassified errors fall through to `400` | Monitoring records a client error during an outage; the client's retry classifier sees "unknown", not "server" | Map unclassified server failures to `503` + `Retry-After`; keep 400 for validation only | handler test with a forced RPC error → 503; `failures.ts` classification test |
| **H-4** | Medium | B, E | A **new Supabase client is constructed on every call**; `requireUser()` builds two per authenticated request. | `server.ts` L113, L127; `lib/auth.ts` L36; `netlify/functions/daily-news-refresh.ts`, `src/server/newsroom/run.ts` | Avoidable allocation/GC and a fresh HTTP agent per request on a warm instance; harder to reason about connection use | Module-level singleton per (url, key, mode) with a shared keep-alive agent; keep the user-scoped client per token | unit test that two calls return the same instance; before/after RSS + p95 |
| **H-5** | Medium | B, D | Every authenticated request performs **two sequential round trips** (Auth `getUser`, then `profiles` role read), uncached. | `lib/auth.ts` `verifyJWT` | Authenticated p95 is additive on every call; a 250-user dashboard burst ≈ 500 auth/DB calls per second (**estimated**) | Cache role+capabilities by user id for 30–60 s with bounded size; or carry role in a trusted claim | load test before/after; unit test that a revoked role stops working within the TTL |
| **M-1** | Medium | B | `/api/cbt/exams` reads **every non-rejected `exam_questions` row** (`exam_id, subject`) on every request and aggregates in Node. | `server.ts` L2239 `fetchAllRows` (1,000-row pages) | Cost grows linearly with the question bank; at 50k questions that is 50 PostgREST pages per catalogue view | One `GROUP BY` RPC (`exam_id`, canonical subject) or a 30–60 s cache — public, non-personal data | query plan + p95 before/after |
| **M-2** | Medium | B | `/api/past-questions/resources` calls `createSignedUrl` **once per row**, up to 200 rows. | `server.ts` L2601–2604 `Promise.all(map(createSignedUrl))` | Up to 200 storage round trips per page view; slow and cost-heavy | `createSignedUrls` (batch) or sign only the resource the student opens | timing before/after at 200 rows |
| **M-3** | Medium | E | **No outbound timeout** on Supabase calls. | no `AbortSignal`/`timeout` anywhere in `server.ts`/`lib` | A hung PostgREST request pins the Express request until the platform timeout; on Netlify that is a billed, failed invocation | Wrap the Supabase fetch with a 10 s abort and map to 503 | forced-slow stub test |
| **M-4** | Medium | A, F | The **self-host path serves uncompressed assets**; Netlify compresses at the edge. | `curl -H 'Accept-Encoding: gzip, br'` on `:3200` → no `Content-Encoding` | Docker deployments transfer 373 KB instead of ~110 KB for the entry chunk | Enable compression (or document that a reverse proxy must) | header assertion in the self-host smoke |
| **M-5** | Medium | D | Rate-limit identity **trusts `x-forwarded-for`** and the app never sets `trust proxy`. | `clientKey()`; Express defaults | On the self-host path a client can spoof its identity and bypass every limit; on Netlify the edge overwrites the header | Set `trust proxy` and read only the platform header when `NETLIFY` is set | request with spoofed header is not counted as a new identity |
| **M-6** | Medium | E | No `unhandledRejection` / `uncaughtException` handler. | absent from `server.ts` | Node 22 exits on an unhandled rejection; a stray promise kills a self-hosted instance and drops in-flight requests | Log, then shut down gracefully | fault-injection test |
| **M-7** | Low | C | Scoring counts **all** `cbt_answers` rows for the attempt, while `v_total` counts the frozen paper. | SQL L686 vs the paper loop at L620 | If the two ever diverge (repair, re-plan), a score above 100 % becomes possible | Count through `unnest(question_ids)` | SQL test with an extra answer row |
| **M-8** | Low | G | No error tracker or uptime monitor is configured anywhere in the repository; observability is `console.*` plus `scheduled_job_runs`. | `docs/operations/OBSERVABILITY.md` is honest about this | Nobody is paged when 5xx rises or the site is down | Smallest useful step: uptime check on `/api/health/ready` + a 5xx-rate alert | alert fires on a deliberate 5xx |
| **L-1** | Low | A, B | Public JSON is served `Cache-Control: no-store` (correct for authenticated routes) including routes that are purely public. | `server.ts` L83 | Every catalogue view reaches the origin | Per-route `public, max-age=30, stale-while-revalidate=60` for the three public catalogues | header assertion |
| **L-2** | Low | B | `/api/cbt/exams` returns the exam list without a limit. | `server.ts` L2222–2226 | Bounded today by the number of exams; unbounded by construction | `.limit(200)` | query shape test |

### Verified good (do not regress)

- **RLS on all 48 tables.** 54 policies; 18 tables have RLS enabled with **no**
  policy, i.e. deny-all to `anon`/`authenticated` and reachable only by the
  service role. No table is exposed without RLS. (Replay of all 71 migrations.)
- **No client-side storage writes.** `storage.objects` has SELECT policies only —
  no INSERT/UPDATE/DELETE policy for any bucket — so a browser cannot upload
  directly; every upload passes the server's byte-signature check and 2 MB cap.
  `admin-content` is the only public bucket (read-only). Buckets carry no
  `file_size_limit`/`allowed_mime_types`, which matters only if a write policy is
  ever added.
- **Answer keys are not exposed during an exam.** `get_cbt_attempt_paper` returns
  position, subject, question id, text and options only — no `correct_option`, no
  explanation. The breakdown with keys appears only on the submitted path.
- **Draft and submit are transactionally sound.** Both take `for update` on the
  attempt row; submit is idempotent when already `submitted` (returns the stored
  result), answers upsert on `cbt_answers_attempt_id_question_id_key`, the status
  update is guarded by `and status='in_progress'`, and the score is
  `round(correct/total*100, 2)` over the frozen paper.
- **Cross-student access is blocked**: both RPCs filter `user_id = auth.uid()`.
- **Indexes support the real access paths**: `cbt_attempts(user_id, created_at)`,
  `cbt_answers(attempt_id, question_id)` unique, `exam_questions(exam_id,
  position)`, `news_articles(published, published_at)`,
  `opportunities(category, is_active, deadline)`, `service_requests(status,
  created_at)`. 136 indexes total. No speculative index is recommended.
- Cache policy is consistent between Netlify (`public/_headers`) and Express:
  hashed assets immutable for a year, the shell `no-store`.

---

## 3. CBT correctness, walked end to end

| Step | Behaviour | Verdict |
|---|---|---|
| Paper creation | `plan_cbt_paper` freezes `question_ids` on the attempt; the paper is never re-planned | verified (code) |
| Paper read | Ownership checked, no answer keys, expiry enforced **on read** | verified (code) |
| Answer save | 900 ms debounce, full answer map, `for update` lock, positions outside the paper dropped, values 0–3 only, refused after submit or expiry | verified (code) |
| Interruption | localStorage pending draft; retry on `online` and `visibilitychange`; offline/timeout/server classified as retryable | verified (code) |
| Submit | Idempotent; per-question upsert; unanswered counted incorrect; guarded status update | verified (code) |
| Duplicate submit | Returns the stored score, does not create a second attempt | verified (code + SQL) |
| Failure that is **not** reported as success | Yes — a failed submit never navigates to results | verified (code) |
| **Submit at the expiry boundary** | Refused with no grace; attempt closed; no score | **H-2 defect** |
| **Transient failure during submit** | Returned as 400; client cannot classify it as a server error | **H-3 defect** |
| **Concurrent submissions from 250 students** | Not measured — no database in this environment | **not tested** |

The scoring rule itself (percentage of correct answers over the paper, unanswered
= incorrect, two decimal places) is established behaviour and is **not** proposed
for change.

---

## 4. API surface and resilience inventory

- **87 Express routes**: public reads (health, news, opportunities, services, CBT
  catalogue, past questions, site content, sitemap/robots), student CBT routes
  behind `requireUser('cbt.attempt')`, admin routes behind `requireCapability`,
  and the question-import module.
- **Every async handler is wrapped in `try/catch`** — no route relies on Express 5
  error propagation. There is no 4-argument error middleware, and no process-level
  handler (M-6).
- **Durable rate limiting covers 8 endpoints** (admin bootstrap, analytics event,
  PDF upload, admin uploads, CBT start, guest submit, content import, newsroom
  ingest). Everything else relies on the in-process limiter, which is
  **per warm instance** — on Netlify the effective API ceiling is
  `1,200 × instances` per minute, so the published limit is neither a global cap
  nor a reliable protection (H-1).
- `/api/health` is dependency-free liveness; `/api/health/ready` performs one
  single-row read, returns 503 with a named cause, and reported `degraded`
  correctly in this environment (no credentials). Both are suitable for a monitor.

---

## 5. Measured load results

All runs: local production build on `127.0.0.1:3200`, **no database**. The
generator shares the 2 vCPU with the server, so latency at the highest levels is
inflated by the generator itself. Numbers are a **floor**, never a capacity
claim.

### 5.1 Raw HTTP ceiling (autocannon, no think time)

| Run | Target | Conns | Requests | Rate | p50 | p99 | Errors |
|---|---|---|---|---|---|---|---|
| A | `/` (shell, 1.4 KB) | 25 | 64,971 | 3,249 req/s | 6 ms | 18 ms | 0 |
| B | `/` | 100 | 65,849 | 3,293 req/s | 29 ms | 47 ms | 0 |
| D | entry chunk, 373 KB | 25 | 12,348 | 823 req/s (294 MB/s loopback) | 29 ms | 61 ms | 0 |
| C | `/api/cbt/exams` | 10 | 97,742 attempted | 4,888 req/s attempted | 1 ms | 5 ms | **1,200 × 200, 96,542 × 429** |

Run C is the clearest measurement in this audit: the application was nowhere near
CPU-bound (it accepted 4,888 requests/s), and the **rate limiter cut it off at
exactly 1,200 requests** — the `apiGeneral` limit for a single IP.

### 5.2 User-shaped runs (`scripts/load/load-probe.mjs`, 2 s think time)

| Run | VUs | Mix | Requests | Rate | p50 | p95 | p99 | 429s | Threshold verdict |
|---|---|---|---|---|---|---|---|---|---|
| E | 25 | public | 391 | 12.1/s | 1.6 ms | 7.7 ms | 16.5 ms | 0 | **pass** |
| F | 100 | public | 1,544 | 47.6/s | 1.3 ms | 44.0 ms | 92.6 ms | 0 | **pass** |
| G | 100 | API only | 1,553 | 48.0/s | 0.9 ms | 54.9 ms | 55.8 ms | **352 (22.7 %)** | **fail** |
| H | 250 | public | 2,594 | 116/s | 1.1 ms | 121.9 ms | 226.4 ms | 112 (4.3 %) | **fail** (error rate) |

Reading these honestly:

- The shell and its assets have headroom at every level tested. At 250 virtual
  users the static pages still answered with p95 of 170–223 ms **on a 2-core box
  shared with the generator**; a dedicated origin would do better.
- The API ceiling is not a capacity property of the code — it is the rate limiter.
  Run G reached the limit in 24 seconds and failed a quarter of all requests.
- Server memory: 72.8 MB idle → 122.5 MB after 65k requests → 110 MB after the
  later runs. Growth is GC behaviour, not evidence of a leak; a leak test needs a
  longer soak than this environment allows.

### 5.3 The ladder that still has to run

`scripts/load/k6/` contains the harness for levels L1–L5 (25 → 100 → 250 → 500 →
1,000 VUs), with thresholds declared before the run and a loopback guard that
refuses a remote target unless explicitly allowed. **These scripts have not been
executed**: the k6 binary cannot be downloaded in this environment, and there are
no staging credentials. The committed baseline above comes from the Node probe,
which is why it can be reproduced anywhere the repository builds.

Thresholds (provisional, declared in advance):

| Metric | L1–L2 | L3–L5 |
|---|---|---|
| `http_req_failed` | < 1 % | < 2 % |
| p95 | < 800 ms | < 1,500 ms |
| p99 | < 1,500 ms | < 3,000 ms |
| Submit correctness | 0 mismatches | 0 mismatches |
| Resubmit idempotency | 100 % same score | 100 % same score |

Stop rules: any data-integrity failure, any 5xx rate above threshold, or any
provider-quota pressure. A level is only started after the previous one passes.

---

## 6. Production checks

### Verified pass (this environment)

| Check | Evidence |
|---|---|
| Production build | `npm run build` → `dist` + `build/server.cjs`, 4.7 s |
| TypeScript | `tsc --noEmit` clean |
| Unit/regression suite | 611/611 at `af37d14`; 47/47 across the 4 files touched by `99b39e6` |
| Performance budget | `perf:audit` 10/10 — entry 98.9 KB, CSS 50.5 KB gzip, critical 209.8 KB |
| Accessibility | `a11y:audit` 0 blocking, 4 informational |
| RLS posture | 48/48 tables enabled; 54 policies |
| Answer-key exposure | none on the paper read path |
| Submit idempotency | verified in SQL and in the handler |
| Health semantics | liveness 200; readiness 503 `degraded` with the cause stated |
| Cache headers | hashed assets immutable; shell `no-store`; API `no-store` |
| Upload constraints | byte-signature + 2 MB cap; no client-side storage writes |

### Verified fail (defects above)

H-1 rate-limit keying · H-2 expiry grace · H-3 400-for-503 · H-4 per-call
clients · H-5 uncached auth round trips · M-1 catalogue full scan · M-2 signed-URL
N+1 · M-3 no outbound timeout · M-4 uncompressed self-host assets · M-5 spoofable
forwarded-for · M-6 no process handlers · M-7 unbounded scoring count.

### Skipped / blocked (never reported as passing)

| Check | Blocker |
|---|---|
| Live production behaviour | network egress is restricted here; `curl https://edureachhub.netlify.app/api/health` returns `000` (connection refused by the sandbox), so no production request was made |
| Browser performance (LCP/CLS/TBT, request waterfall) | no Chromium available; `playwright` package present, browsers not installed |
| Database behaviour under load | no Supabase credentials; PGlite replay validates schema, not concurrency |
| Netlify cold start, concurrency limit, function timeout | not observable from here; needs the Netlify dashboard or a deployed run |
| Supabase plan, connection limits, PITR window | needs the project dashboard |
| `npm run smoke`, `prod:validate`, `rls:audit`, `duplicate:audit` against production | need production credentials |
| `backup:rehearsal` proof of a **Supabase** backup | the script proves a local Postgres dump/restore; it says so itself |
| k6 ladder | k6 binary unavailable; no staging target |

---

## 7. Capacity statement

**Tested, this build, this machine:**

- Static shell and assets: 3,249–3,293 requests/s at 100 concurrent connections,
  p99 < 50 ms, zero errors; a 373 KB chunk at 823 requests/s.
- User-shaped public browsing: 100 virtual users at one request per two seconds →
  47.6 req/s, p95 44 ms, zero errors; 250 → 116 req/s, p95 122 ms, 4.3 % throttled.
- The whole API from one IP is capped at **1,200 requests per minute**; above
  ~20 req/s from a shared connection, requests fail with 429.

**Estimated, not tested:** with Supabase in the path, each authenticated request
pays two sequential round trips before the handler's own query. A 250-user
dashboard burst is therefore on the order of 500+ auth/DB calls per second, which
is a plausible ceiling for a small Supabase instance and a plausible source of
p95 spikes. This is arithmetic on the code path, **not a measurement**.

**Not tested at all:** 500 and 1,000 virtual users, concurrent CBT sessions
against a real database, Netlify function concurrency, and behaviour under a
degraded Supabase.

**Conclusion:** the product cannot yet be described as able to serve "thousands of
users". What can be said is narrower and defensible: the HTTP layer on a 2-core
box has headroom well beyond the current audience; the data path has no measured
capacity; and the rate limiter, as configured and keyed, would fail a real school
exam session before the infrastructure would.

---

## 8. Proposed execution plan (approval required before any change)

**Stage 1 — correctness and safety (small, reversible, no schema change except
where noted):**

1. Key rate limits by user for authenticated routes (H-1); keep IP for anonymous.
2. Submission grace window + `late_by_ms` diagnostic (H-2). Migration, additive.
3. Return 503 for unclassified server failures and map it in the client (H-3).
4. Add outbound timeouts (M-3) and shared Supabase clients (H-4).
5. Regression tests beside each change; re-run typecheck, unit suite, build,
   perf and a11y; compare before/after.

**Stage 2 — measurable efficiency (only after Stage 1 passes):**

6. Catalogue `GROUP BY` RPC or short-TTL cache (M-1); batch signed URLs (M-2).
7. Role cache with a bounded TTL (H-5), or a claim-based alternative.
8. Compression on the self-host path (M-4); `trust proxy` (M-5); process handlers
   (M-6); paper-bounded scoring count (M-7).
9. Per-route public caching (L-1).

**Stage 3 — evidence:**

10. Provision a staging Supabase project with production-shaped synthetic data and
    a throwaway cohort of test accounts.
11. Run the k6 ladder 25 → 100 → 250 → 500 → 1,000 from a **separate** generator
    host, with the thresholds above, including a burst run per level, recording
    Supabase and Netlify metrics alongside k6 output.
12. Publish measured capacity, or the level at which it failed, with the failure
    mode.

**Manual owner actions (not executable from the repository):**

- Provide staging credentials and a test cohort.
- Confirm the Netlify plan's function concurrency and timeout, and the Supabase
  plan's connection limit and PITR window, from the dashboards.
- Attach an uptime monitor to `/api/health/ready` and a 5xx alert (smallest useful
  monitoring step).
- Approve (or reject) the grace window in H-2 — it changes exam-boundary behaviour.

**Rollback:** every Stage 1 change is a normal commit on this branch; the
migration is additive and forward-only, and the existing deploy rollback path
(Netlify deploy rollback) is unchanged. No destructive database operation is
proposed.

---

## 9. Artifacts added by this audit

- `scripts/load/load-probe.mjs` — dependency-free probe; refuses remote targets
  without `--allow-remote`; the source of §5.2.
- `scripts/load/k6/public-read.js`, `scripts/load/k6/cbt-session.js` — the ladder
  harness, including submit idempotency and resubmit-score checks.
- `scripts/load/README.md` — workload model, commands, what the harnesses cannot
  see.

No application file was modified. No request was sent to the live site. No
database was written to.
