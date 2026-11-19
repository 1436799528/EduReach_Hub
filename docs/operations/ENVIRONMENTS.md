# Environments

Status: **two environments exist, one is deployed.** Production is live on
Netlify against Supabase `EduReach-V1`; staging has a Supabase project but no
hosted build, so no code runs in it yet. There is no third environment.

This page is the single place that answers "which database does this build talk
to, and what has to be set for it to work". It lists variable **names and
presence only** — no value from this repository, or from any provider, belongs
in a document, a log or a commit.

## 1. The three environments

| | Development | Staging | Production |
|---|---|---|---|
| Who uses it | maintainer, locally | QA / reviewer | students and staff |
| Runs where | `npm run dev` on `http://localhost:3000` (`PORT`) | **not deployed yet** | Netlify site `aa0aef85-2371-48ec-9569-3dcacb7cfe47` → `https://edureachhub.netlify.app` |
| Runtime | Vite dev server + Express in one process | Netlify Functions (same Express app) once built | Netlify Functions (`netlify/functions/api.ts`) + `dist/` static |
| Supabase project | `EduReach-Hub-Staging` (`kilkvajanoesqtzclsrs`, eu-central-1) **or** a local Supabase CLI stack | `EduReach-Hub-Staging` (`kilkvajanoesqtzclsrs`, eu-central-1) | `EduReach-V1` (`gjdfatwcoosyuhakrrhh`, eu-west-1) |
| Data | disposable | disposable, no real student data | real |
| `VITE_EMAIL_VERIFICATION_ENABLED` | `false` (unchanged; see §5) | `true` — the staging project requires confirmation | `false` — see §5 |
| Scheduled newsroom job | not scheduled | not scheduled | `netlify/functions/daily-news-refresh.ts` (`@daily`) |

`ArbsOdd` (`huqvshwirmywinikvrnf`) is an **inactive** Supabase project. It is not
an environment; nothing may point at it.

Staging deliberately does **not** share production's database. It is also not a
full replica: see §6 before trusting it for schema work.

## 2. Branch and deploy flow

Repository: `1436799528/EduReach_Hub` — the source of truth for everything that
runs in production.

```
change on a short-lived branch  →  PR to main  →  GitHub Actions gate  →  merge
      →  Netlify builds main  →  QA against production (or staging once built)
```

| Step | Rule |
|---|---|
| Integration branch | `main` |
| Working branches | short-lived, e.g. `arena/<id>`, `<feature-name>`; no long-lived `develop` |
| Pull request | required by convention; one review before merge |
| Required CI | `EduReach production checks / quality-gate` (runs `npm run ci`) must be green on the PR |
| Merge | squash or merge commit into `main` |
| Production deploy | Netlify builds `main` (see `docs/DEPLOYMENT_DECISION.md` for the trigger's verification state) |
| Rollback | Netlify **Deploys → Publish deploy** on the last good build (instant, no rebuild). Supabase migrations are forward-only — a bad migration is corrected by a new migration, not by rolling back |

Branch protection cannot be read with the automation token available to this
audit; treat "protection enabled, `quality-gate` required" as **unverified** and
confirm it in repository settings.

## 3. Environment variables — names and presence

Canonical lists: `.env.example` (development) and `.env.production.example`
(production). Never commit a real `.env`; only `*.example` files are tracked.

### Production (Netlify → Functions and Runtime scopes)

| Variable | Scope | Required | Presence |
|---|---|---|---|
| `VITE_SUPABASE_URL` | build + function | yes | **confirmed present** — inferred from a production build that succeeded (`scripts/client-env-check.ts` fails a `CONTEXT=production` build without it) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | build | yes | **confirmed present** — same build guard |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | function only | yes | **confirmed present and working** — `/api/health/ready` reports `database.ok: true` |
| `EDUREACH_SITE_URL` | function | recommended | not verifiable from here; used for absolute links |
| `VITE_EMAIL_VERIFICATION_ENABLED` | build | optional | not set ⇒ code default `false`, which matches the project (§5) |
| `CBT_LEGACY_SCHEMA` | function | optional | not set; see §6 |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | function | one-time | used by the bootstrap path only |

### Staging (to be created when the staging site exists)

Same names, pointed at `kilkvajanoesqtzclsrs`, with
`VITE_EMAIL_VERIFICATION_ENABLED=true`. Nothing is configured yet because there
is no staging site to configure.

### Development

`.env` from `.env.example`. Missing values do not fail the build (the client
guard only enforces in a production context) — the app then runs against the
unconfigured fallbacks, which is what the E2E suite assumes.

### Rules that do not change per environment

- A `VITE_` prefix means **browser-visible**. `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_KEY` must never carry one;
  `scripts/client-secret-guard.ts` fails the build if they do.
- Production and staging must never be given the same Supabase URL + key pair.

## 4. How to check an environment

```bash
npm run prod:validate     # variables, connectivity and migration history for a target
npm run smoke             # exits 0 only when /api/health/ready reports "ready"
curl -s <origin>/api/health/ready   # 200 ready | 503 degraded, per-check JSON
```

`/api/health/ready` names each failing check (`environment`, `supabase`,
`database`, `cbt_protocol_schema`, …) and never echoes a secret.

## 5. Email verification — final setting

| Environment | Supabase `mailer_autoconfirm` | App setting | Effective behaviour |
|---|---|---|---|
| Production | `true` | `VITE_EMAIL_VERIFICATION_ENABLED=false` (default; not set) | **No verification mail.** A signup is confirmed immediately and the student is signed in. This is the intended behaviour for this stage — decided 19 Nov 2026 — and the two settings agree. |
| Staging | `false` | set `true` | Supabase requires confirmation, so the app must show the "check your inbox" path. **Blocked:** the staging project has no SMTP (`smtp_host` empty), so it would rely on Supabase's rate-limited default sender (2 mails/hour) and most signups would never arrive. Configure SMTP before using staging for signup tests. |
| Development | unchanged | unchanged | Left as-is deliberately. |

If production is later switched to real verification, three things move
together: `mailer_autoconfirm` → `false`, a working SMTP sender, and
`VITE_EMAIL_VERIFICATION_ENABLED=true`. Setting only the flag makes the UI wait
for a mail that is never sent; setting only the provider value makes signups
auto-confirm while the UI still asks the student to verify.

## 6. Database state per environment

| | Production `EduReach-V1` | Staging `EduReach-Hub-Staging` |
|---|---|---|
| Public tables in the repository schema | present | present (core set verified: `cbt_attempts`, `exam_questions`, `institutions`, `institution_profiles`, `news_articles`, `service_requests`, `site_pages`, `site_settings`, `scheduled_job_runs`) |
| RLS | 104 tables with RLS, 177 policies | 70 tables with RLS |
| `cbt_attempts.protocol` | **missing** | present |
| Migration history | 212 entries, names do not match repository filenames, newest `20261117075005` | 6 entries — the staging helper functions plus the institution migrations |
| Content | 23 published articles | 0 articles |

Consequences:

1. **Production cannot run CBT v2.** `server.ts` selects `cbt_attempts.protocol`;
   the column is absent, so `/api/health/ready` returns 503 and the readiness
   probe (`npm run smoke`) fails closed. This is the one production schema gap
   found, and it is reported rather than patched — no production DDL was applied
   during this audit.
2. **Staging cannot be used for schema verification yet.** Its ledger has 6
   entries against the repository's 94 migrations, so "did the migrations apply?"
   cannot be answered from it; a schema dump or a fresh replay is needed. Its
   schema does contain the newest institution work and the `protocol` column, so
   it is closer to `main` than production is.
3. Neither environment is used as a disposable test database. Schema rehearsal
   belongs on a scratch project (see
   `docs/operations/STAGING_VERIFICATION_RUNBOOK.md` and
   `docs/operations/BACKUP_AND_RESTORE.md`).

## 7. Open items

| Item | Owner action |
|---|---|
| Production `cbt_attempts.protocol` missing | review the migration that adds it, then apply it to production in a maintenance window |
| Staging has no hosted site | create the Netlify staging site (branch deploy of `main`), then set §3 staging variables |
| Staging mailer | configure SMTP before signup testing |
| Staging migration history | replay the repository migrations against staging (or restore a schema dump) so the ledger matches |
| Branch protection | confirm `quality-gate` is a required check on `main` (API refused with the current token) |
| Netlify deploy trigger | confirm Netlify builds on push to `main`; no Netlify check appears on commits, so it cannot be proven from GitHub |
