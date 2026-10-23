# Can this environment test Supabase? — capability report

**Date:** 22 October 2026
**Branch:** `arena/069ae800-edureach-hub` @ `72937ec` (plus the changes listed at the end)
**Question:** does the Arena execution environment have the configuration and the
network access to test authentication, database queries, CBT loading, answer
saving, uploads and role permissions against Supabase?

**Answer: no. Two independent blockers, either of which is sufficient to stop
every live check.** No value of any key appears anywhere in this document or in
the logs it was produced from.

---

## 1. What is configured here

Checked in four places, because a variable can be injected at more than one:

| Where a variable could come from | Result |
|---|---|
| The shell (`env` — 17 variables total) | no name matching `SUPA`, `VITE`, `SB_`, `ARENA` or `NETLIFY` |
| A process started as a live preview (`start_process`) | same: no matching name |
| A `.env` file on disk (any depth outside `node_modules`) | none exists; only `.env.example` and `.env.production.example`, both placeholders |
| Tracked in Git on this branch (`git ls-tree`) | only the two example files. No commit on this branch has ever added a `.env` |
| Secret mounts (`/run/secrets`, `/var/run/secrets`, `/etc/secrets`, `/secrets`) | none exist |

```
$ npm run env:check
  project reference: (none configured)
  classification:    not configured
  keys present:      url no, publishable no, service-role no
```

If the URL was added through the Arena interface, it did not reach this
execution environment. That is worth saying plainly rather than guessing: the
value is not visible to any process I can start, so no test can use it.

## 2. Which project is configured

**None — so this environment cannot be said to point at production or at
staging.** For the record, the classification tool's own answer when given the
production reference is `PRODUCTION`, and the project used on the owner's own
machine is `gjdfatwcoosyuhakrrhh`, which the repository's audits name as
production. Nothing in the Arena environment is configured to use it.

## 3. Network reachability (the second, harder blocker)

Even with a correct URL and key, this sandbox has no route to Supabase. Egress is
allowlisted to GitHub, npm and PyPI.

| Host | HTTP result |
|---|---|
| `https://github.com` | 200 |
| `https://registry.npmjs.org` | 200 |
| `https://gjdfatwcoosyuhakrrhh.supabase.co/rest/v1/` | **000 — no response** |
| `https://supabase.com` | **000 — no response** |

DNS resolves (`172.64.149.246`), and the TCP/TLS connection is refused, so this
is an egress block rather than a wrong hostname. `npm run env:check -- --probe`
reports it in one line:

```
  No HTTP response (fetch failed). This machine cannot reach Supabase, so no
  live check can run here.
```

## 4. Test-by-test verdict

`Passed` = the check ran here and its assertions held.
`Failed` = the check ran here and something is genuinely wrong.
`Blocked` = the check needs a Supabase project and cannot run from here.

| # | Capability | Verdict | Why |
|---|---|---|---|
| 1 | URL and publishable key configured | **Blocked** | No configuration reaches this environment (§1) |
| 2 | Client talks to the project (auth endpoint reachable) | **Blocked** | No credentials **and** no network route (§3) |
| 3 | Server talks to the project with a service-role key | **Blocked** | `SUPABASE_SERVICE_ROLE_KEY` is not set, and no route exists |
| 4 | Database reads (profiles, catalogues, news, institutions) | **Blocked** | as above |
| 5 | Sign-up / sign-in / session refresh | **Blocked** | needs a live Auth endpoint; also needs an inbox for confirmation mail |
| 6 | CBT question loading (`get_cbt_questions_for_subjects`) | **Blocked** | server RPC against the live project |
| 7 | Answer saving mid-attempt | **Blocked** | writes rows; would need a test project, not production |
| 8 | File uploads (storage buckets) | **Blocked** | needs a live bucket and a test account |
| 9 | Role-based permissions (student vs staff vs admin) | **Blocked** | needs real signed-in sessions for at least three roles |
| 10 | Test accounts exist | **Blocked** | none configured; creating one sends an email and writes rows |
| 11 | Offline proof that the schema the app needs is complete | **Passed** | 74 migrations replay onto a real PostgreSQL (PGlite 18) |
| 12 | Offline proof of RLS classification (50 tables) | **Passed** | `npm run rls:audit` — 50/50 classified, 0 findings |
| 13 | Offline proof that migrations are all in the checklist | **Passed** | `npm run migrations:checklist` — 74/74 |
| 14 | Offline proof the app renders and behaves with no database | **Passed** | Playwright 158 passed / 2 skipped |
| 15 | Mobile performance on the built artefact | **Passed** | LCP 1 796 / 1 672 / 2 088 ms, 221–236 KB |
| 16 | Production build and bundle budgets | **Passed** | build ok, `perf:audit` 10/10 |
| 17 | Environment contract and honest reporting of skipped live checks | **Passed** | `npm run prod:validate` reports `skipped`, never `pass`, for live checks |

## 5. Missing pieces, in the order they would matter

1. **A route to Supabase from wherever the tests run.** Without it nothing else
   matters. Arena's sandbox does not have one; the owner's own machine does.
2. **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_PUBLISHABLE_KEY`** in the
   environment the test process can read (a `.env` file beside `package.json`, or
   exported in the shell that starts it).
3. **`SUPABASE_SERVICE_ROLE_KEY`** for the server-side checks. Never in a `VITE_`
   variable, never in the browser, never in chat or a screenshot.
4. **A project that is not production.** The write-heavy checks in §4 (rows 5–10)
   create accounts, attempts, uploads and analytics events.
5. **Test accounts** for the roles being checked: one student, one staff, one
   admin. There is no way to create a staff or admin account from the public site
   on purpose; it has to be set in the database by someone who owns it.
6. **`EDUREACH_SITE_URL`** and **`EDUREACH_NEWSROOM_USER_AGENT`** (recommended,
   not required) so the sitemap and the newsroom fetches identify themselves.

## 6. What can be done without any of that

Everything in rows 11–17 already runs here and is part of `npm run ci`. It
proves the shape of the system — that the migrations build the schema the code
expects, that every table has a declared access policy, that the app degrades
honestly with no database, and that the bundle is within budget. It cannot prove
that the live project matches, and nothing in this repository claims it does.

The live half needs to run where the network reaches Supabase: on the owner's
machine against a staging project, following
`docs/SUPABASE_LIVE_VERIFICATION.md` §4, with `npm run env:check` before and after
any `.env` edit.

## 7. Reproducing this report

```
npm run env:check -- --probe     # configuration + reachability, no secrets printed
npm run prod:validate            # says "skipped", never "pass", for live checks
npm test                         # offline: schema replay, RLS, routes, budgets
npm run rls:audit                # 50/50 tables classified
npm run migrations:checklist     # 74/74 migrations listed
```

The first two are read-only. None of them writes to a database, applies a
migration, sends an email, uploads a file or changes a security setting.
