# Load testing — harness and ladder

Nothing in this directory is part of the build, the bundle or a request path.
It exists so a capacity claim can be reproduced instead of asserted.

Two harnesses, for two different jobs:

| Harness | Tool | Status | Used for |
|---|---|---|---|
| `load-probe.mjs` | Node 22 built-ins only | **Executed.** Produced the committed baseline. | Single-host probe, reproducible anywhere the repo builds. |
| `k6/public-read.js`, `k6/cbt-session.js` | k6 | **Authored, not executed here.** | The formal ladder against staging, from a generator host separate from the target. |

The reason for both: k6 is the right tool (efficient generator, real thresholds,
scenario executors) but its binary is not downloadable in every environment that
builds this repository. The Node probe covers that gap — and, because it shares
the machine with the target, its numbers are a floor, never a capacity claim.

## Rules that apply to every run

1. **Never against production.** `load-probe.mjs` refuses a non-loopback target
   without `--allow-remote`; the k6 scripts refuse one without `ALLOW_REMOTE=1`.
   A staging project with production-shaped data is the only approved target,
   and the approval is explicit, not implied.
2. **Thresholds before the run.** They are in the script or on the command line
   before the first request, and they are labelled provisional in the report.
3. **Do not skip a level.** 25 → 100 → 250 → 500 → 1,000 virtual users; a level
   is only started after the previous one passed.
4. **Stop** on a data-integrity failure (a submit that is accepted but not
   stored, a score that changes on retry, a duplicate attempt), on a 5xx rate
   above threshold, or on cost/provider pressure (Supabase quota, Netlify
   function duration). Stop first, explain after.
5. **A virtual user is a browser tab with think time**, not a request loop. The
   default pause is two seconds. Reporting the loop rate as "users" is the
   error this repository has already made once.

## Ladder

| Level | VUs | Ramp | Hold | Purpose |
|---|---|---|---|---|
| L1 | 25 | 1m | 3m | correctness and baseline latency |
| L2 | 100 | 2m | 5m | first sustained pressure; watch DB pool and p95 |
| L3 | 250 | 2m | 5m | a school's simultaneous exam start |
| L4 | 500 | 3m | 5m | requires a generator host with its own CPU |
| L5 | 1,000 | 3m | 10m | capacity statement; still not a promise |

Each level gets a short burst as a separate run (`RAMP=10s HOLD=30s`) to catch
connection-setup cost and cold starts that a long ramp hides.

## Commands

Baseline on this machine (production build, no database configured):

```bash
npm run build
NODE_ENV=production PORT=3200 node build/server.cjs &
node scripts/load/load-probe.mjs --base-url http://127.0.0.1:3200 --vus 25 --duration 30 --json
node scripts/load/load-probe.mjs --base-url http://127.0.0.1:3200 --vus 100 --duration 30
node scripts/load/load-probe.mjs --base-url http://127.0.0.1:3200 --scenario api --vus 100 --duration 30
```

Staging, with k6 installed on a separate host:

```bash
k6 run --env BASE_URL=https://staging.example --env VUS=1 --env HOLD=30s scripts/load/k6/public-read.js
k6 run --env BASE_URL=https://staging.example --env VUS=25 scripts/load/k6/public-read.js
k6 run --env BASE_URL=https://staging.example --env VUS=100 --env HOLD=5m scripts/load/k6/public-read.js
k6 run --env BASE_URL=https://staging.example --env VUS=25 \
       --env TOKEN=... --env EXAM_ID=... \
       scripts/load/k6/cbt-session.js
```

The CBT script needs a throwaway student account and an exam with at least
`QUESTION_COUNT` approved questions. Do not point it at an exam a real cohort
is sitting.

## What these harnesses cannot see

- Supabase Auth, PostgREST and Postgres behaviour — a local server with no
  credentials answers from empty tables and never reaches the database.
- Netlify's function cold start, concurrency limit and 10 s/26 s timeouts.
- Browser rendering cost: the harness fetches bytes, it does not paint them.
- Real network conditions (3G/4G latency, loss, NAT, shared school bandwidth).

Those gaps are the reason the audit separates **measured**, **estimated** and
**not tested** instead of publishing one number.
