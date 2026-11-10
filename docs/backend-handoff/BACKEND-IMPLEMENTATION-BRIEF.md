# EduReach Hub — Backend Implementation Brief

> **Purpose.** A concise but comprehensive implementation specification for
> the **new backend repository** (Express.js + TypeScript + fresh
> PostgreSQL + REST + Vercel-compatible). This brief is self-contained:
> an agent with only this handoff package and the new repository should be
> able to build the backend without access to the frontend repo.
>
> **Companion documents:** `FRONTEND-SYSTEM-INVENTORY.md` (what exists),
> `API-REQUIREMENTS.md` (wire contract — **authoritative for paths/shapes**),
> `DATABASE-REQUIREMENTS.md` (schema — **authoritative for tables**),
> `AUTHENTICATION-AND-PERMISSIONS.md` (auth — **authoritative for roles**),
> `CBT-BACKEND-REQUIREMENTS.md` (CBT — **authoritative for CBT rules**),
> `FRONTEND-INTEGRATION-PLAN.md` (cutover sequence).

---

## 1. Non-negotiable requirements

1. **Independent backend.** Do not copy the existing `server.ts`,
   `supabase/migrations/`, RPCs, RLS policies, or candidate files. Fresh
   schema, fresh migrations, fresh code. Reproduce *behaviour*, not
   *implementation*.
2. **Frontend is the contract.** Paths, shapes, error vocabulary, auth
   transport, and CBT protocol in `API-REQUIREMENTS.md` are frozen.
3. **Server-authoritative everything sensitive:**
   - All authorization decisions enforced server-side (capability +
     ownership + bank policy, re-checked inside every transaction).
   - Students never receive answer keys before permitted release.
   - Unclassified banks fail closed (404 student / 503 policy-unavailable).
   - Answer saving is idempotent; CBT submission/scoring is
     server-authoritative against the frozen paper.
   - Attempt deadlines enforced server-side (server clock only).
   - One active writing session per attempt (server-issued session
     generations/leases); stale-session writes rejected.
   - Administrative operations are auditable (in-transaction audit rows).
4. **V2 fence:** do not enable a global CBT v2 writing protocol without
   an explicit release decision. Production serves `protocol:{version:1}`;
   v2 routes return 503.
5. **Vercel-compatible:** stateless request handlers, no in-process-only
   state for correctness (rate limiting must be durable or explicitly
   best-effort), cold-start-safe, no long-lived connections assumed.

---

## 2. Stack and project setup

| Concern | Choice |
|---|---|
| Runtime | Node.js `>=22` (match frontend `.nvmrc`), TypeScript strict. |
| Framework | Express 4 (match frontend) + `serverless-http` for Vercel. |
| DB access | `pg` Pool + Drizzle ORM (or Kysely). **Every mutation in `withTransaction()`.** No dynamic SQL from request bodies. |
| Validation | Zod (request + response schemas per route). |
| Auth | Option A (verify Supabase JWTs via JWKS) or Option B (own auth) — see auth doc §8. **Decide before writing auth code.** |
| Storage | S3-compatible object storage (or Vercel Blob). Three private buckets/prefixes: `import-sources`, `resources`, `admin-media` (one public). |
| Testing | Vitest (unit + integration with ephemeral Postgres) + Playwright (contract smoke against the frontend shapes). |
| Lint/format | ESLint + Prettier; `tsc --noEmit` in CI. |
| Deploy | Vercel (functions) + Neon/Supabase Postgres (or any managed Postgres). `vercel.json` with function rewrites for `/api/*` and `/.netlify/functions/api/*` → the Express app. |

**Env contract (new backend — define in code, validate at boot):**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection (single privileged role, backend-only). |
| `JWT_SECRET` / `SUPABASE_JWKS_URL` / `SUPABASE_URL` | required (per auth option) | Token verification. |
| `FRONTEND_ORIGIN` | required | CORS allowlist. |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_IMPORTS`, `STORAGE_BUCKET_RESOURCES`, `STORAGE_BUCKET_MEDIA` | required | Object storage. |
| `EDUREACH_SITE_URL` | recommended | Canonical origin for sitemap/robots. |
| `EDUREACH_ADMIN_BOOTSTRAP_EMAIL` | optional | First-admin bootstrap (one-time). |
| `PORT`, `NODE_ENV` | optional | Runtime. |
| `CBT_V2_LOCAL_REHEARSAL` | optional (dev only) | Same dev-only gate semantics as the frontend repo. |

---

## 3. Recommended directory structure

```
backend/
├─ src/
│  ├─ index.ts                  # Express app factory (exported for serverless)
│  ├─ server.ts                 # Local listen (PORT) — not used on Vercel
│  ├─ config.ts                 # Env parsing + validation (fail fast, never log secrets)
│  ├─ db/
│  │  ├─ client.ts              # pg Pool + Drizzle instance
│  │  ├─ schema/                # Drizzle table definitions (one file per domain)
│  │  └─ migrate.ts             # Migration runner
│  ├─ modules/
│  │  ├─ health/                # /health, /health/ready, /sitemap.xml, /robots.txt
│  │  ├─ auth/                  # /auth/* (Option B) or token verification (Option A)
│  │  ├─ me/                    # /me, /me/profile, /me/saved-items, /me/notifications, /me/cgpa
│  │  ├─ catalogue/             # /catalogue/*, /services, /news, /opportunities, /upcoming
│  │  ├─ banks/                 # /cbt/exams, /cbt/exams/:id/subjects (public bank reads)
│  │  ├─ attempts/              # /cbt/exams/:id/attempts, /cbt/attempts/:id/paper|draft|submit|abandon
│  │  ├─ scoring/               # Submission scoring + result reads (may merge into attempts)
│  │  ├─ guest/                 # /cbt/guest-submit (+ guest-questions if kept)
│  │  ├─ v2/                    # /cbt/v2/attempts/:id/* (fenced rehearsal)
│  │  ├─ serviceRequests/       # /service-requests, /service-requests/mine
│  │  ├─ imports/               # /admin/question-imports/*
│  │  ├─ admin/                 # /admin/* (users, requests, news, institutions, services, calendar, site, pdf-bank, content-manager)
│  │  ├─ bankSecurity/          # /admin/cbt/banks/* (classification, candidates)
│  │  ├─ audit/                 # Audit writer + /admin/audit reads
│  │  ├─ notifications/         # Server-side notification creation
│  │  ├─ storage/               # Object-storage adapter + signing
│  │  └─ platform/              # Rate limiting, jobs, analytics ingestion
│  ├─ http/
│  │  ├─ middleware.ts          # Headers, CORS, compression, request-id, error handler
│  │  ├─ auth.ts                # authenticate + requireCapability + ownership helpers
│  │  └─ errors.ts              # AppError + renderer ({ error: string } shape)
│  └─ lib/                      # Pure helpers (ids, clock, hashing, redaction, canonicalisation)
├─ drizzle/                     # Fresh migration history (0001_*.sql, ...)
├─ tests/
│  ├─ unit/                      # Pure logic (planning, canonicalisation, scoring, taxonomy)
│  ├─ integration/               # Route + real Postgres (ephemeral)
│  └─ security/                  # Authorization matrix, CBT invariants, confidentiality
├─ vercel.json
└─ package.json
```

**Module rules:**
1. One module owns one table family. Cross-module reads go through the
   owning module's service, never its tables.
2. Every service entry point takes an `Actor` (verified user + capabilities)
   and checks capability + ownership + bank policy inside the transaction.
3. Routes are dumb: parse (Zod) → call service → map result → map error.
   Routes never touch the DB; services never touch `req`/`res`.
4. Side effects (audit, notifications, storage deletes) happen in the same
   transaction as the mutation, or via an outbox row — never fire-and-forget.
5. Each module: `<name>.routes.ts`, `<name>.service.ts`,
   `<name>.schema.ts`, `<name>.repo.ts`.

---

## 4. Database entities (summary — see DATABASE-REQUIREMENTS.md for full spec)

| Domain | Tables |
|---|---|
| Identity | `users`, `profiles`, `student_security_events` |
| Catalogue | `institutions`, `cbt_subject_catalog` |
| Banks | `cbt_exams`, `exam_questions`, `cbt_bank_security`, `cbt_bank_candidate_assignments` |
| Attempts | `cbt_attempts`, `cbt_answers`, `cbt_v2_operations`, `cbt_v2_writing_sessions` |
| Imports | `question_imports`, `question_import_items` |
| Services | `service_catalog`, `service_requests`, `service_guides` |
| Content | `news_articles`, `opportunities`, `calendar_items` (+ newsroom tables only if ingestion is in scope) |
| Portal | `student_saved_items`, `student_notifications`, `student_cgpa_terms`, `student_cgpa_courses` |
| Files | `document_bank`, `past_question_resources` |
| Site/ops | `site_settings`, `site_pages`, `site_page_revisions`, `site_analytics_events`, `admin_audit_logs`, `scheduled_job_runs` |

**Do not create:** wallets/payments, Campus Feed, legacy course uploads,
programme catalogue (unless product requires them — see database doc §8).

**Key constraints to implement:** frozen `question_ids` per attempt;
`UNIQUE (exam_id, position)`; bank-move refusal; provenance guard;
fail-closed classification; one active writing session (partial unique
index); idempotency keys (`submission_key`, `operation_key`,
`request_key`); optimistic concurrency (`updated_at` / `expectedUpdatedAt`);
service-request status CHECK; audit append-only.

---

## 5. API routes (summary — see API-REQUIREMENTS.md for full contract)

| Group | Routes |
|---|---|
| Platform | `GET /health`, `GET /health/ready`, `GET /sitemap.xml`, `GET /robots.txt` |
| Public | `GET /cbt/exams`, `GET /cbt/exams/:id/subjects`, `GET /services[/:slug[/guide]]`, `GET /upcoming`, `GET /news[/:slug]`, `GET /opportunities[/:id]`, `GET /public/documents`, `GET /past-questions/resources`, `GET /site-content`, `POST /analytics/event` |
| CBT (auth) | `POST /cbt/exams/:id/attempts`, `GET /cbt/attempts/:id/paper`, `PATCH .../draft`, `POST .../submit`, `POST .../abandon`, `DELETE ...`, `GET /cbt/attempts`, `GET /cbt/attempts/:id/result` (proposed) |
| Guest | `POST /cbt/guest-submit` (+ `GET /cbt/exams/:id/guest-questions` if kept) |
| V2 (fenced) | `GET/POST/PATCH /cbt/v2/attempts/:id/state|session|answer|finalize` (503 in prod) |
| Student | `GET/PATCH /me`, `GET /service-requests/mine`, `POST /service-requests`, `GET/PUT/DELETE /me/saved-items`, `GET/POST /me/notifications`, `GET/POST /me/cgpa` (proposed) |
| Admin | `GET /admin/session`, `POST /admin/bootstrap`, `GET /admin/users[/:id/activity]`, `POST .../ban|unban|role`, `GET/PATCH /admin/service-requests[/:id]`, `GET /admin/analytics`, `GET/POST/PATCH/DELETE /admin/cbt/exams[/:id[/questions]]`, `PATCH/DELETE /admin/cbt/questions/:id`, `GET/PATCH /admin/cbt/banks/*`, `GET/POST/PATCH/DELETE /admin/news[/:id]`, `GET/POST /admin/newsroom/*` (if in scope), `GET/POST/PATCH/DELETE /admin/calendar-items|institutions|services|opportunities`, `GET/PUT/DELETE /admin/services/:id/guide`, `POST /admin/uploads`, `GET/POST/PATCH /admin/pdf-bank/*`, `GET/PUT/POST /admin/site-content/*`, `GET/POST/PATCH/DELETE /admin/content-manager/*` (replace with explicit endpoints), `GET/POST/PATCH/DELETE /admin/question-imports/*`, `GET /admin/jobs`, `GET /admin/integrity` |

**Versioning:** serve the frozen contract at `/api` (and
`/.netlify/functions/api` for compatibility). If a breaking change is ever
needed, introduce `/api/v2` and serve both in parallel for one frontend
release. Never remove/rename a field inside a version.

---

## 6. Security requirements

1. **Authentication:** verify the JWT on every non-public route; derive
   the actor only from the verified token; re-read `role` from the DB on
   every request. Never trust client-supplied roles/headers/metadata.
2. **Authorization (3 layers, all required):** route guard (capability) →
   service guard (ownership/bank policy inside the transaction) →
   database constraints (FKs, CHECKs, unique indexes, triggers where the
   old system proved them necessary).
3. **Capabilities:** reuse the exact 30-capability vocabulary + 4-role
   matrix from `AUTHENTICATION-AND-PERMISSIONS.md`. Owner-scoped
   capabilities require a matching owner; staff never impersonate owners.
4. **Ownership failures → 404** (never 403) for attempts/progress/results.
5. **Bank policy:** fail closed on unclassified; re-check candidate access
   inside every CBT transaction (lock the policy row so revocation cannot
   be overtaken mid-transaction).
6. **Confidentiality:** no keys in paper/draft/catalogue responses; result
   keys only post-submission (guest: per-attempted-question; restricted:
   after `correction_release_at`); provenance guard on question writes;
   bank moves refused; refusals never echo content.
7. **CBT integrity:** frozen paper; server-side scoring in one locked
   transaction; server-clock deadlines + documented grace; idempotent
   drafts/submits; single writing session with generations; stale writes
   rejected.
8. **Input safety:** Zod-validate every request; parameterised queries
   only; HTML sanitisation on news/site bodies at render (frontend) +
   validation at write (backend); HTTPS-only URLs; file magic-byte +
   size validation; no PII/question text/keys in logs.
9. **Rate limiting:** reproduce the frontend repo's per-route limits +
   headers (see inventory §12). Durable (DB/Redis) for sensitive routes;
   per-user bucketing for CBT starts/uploads/imports (school-lab NAT).
10. **Headers:** `Cache-Control: no-store` on `/api/*`; CSP/HSTS/
    `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy`/
    `Permissions-Policy` in production; `X-Robots-Tag: noindex` on
    private paths; `X-Request-Id` on every response.
11. **Suspension:** refuse suspended users at authentication time; revoke
    sessions on ban (fix the current gap).
12. **Audit:** every admin mutation writes an in-transaction audit row;
    reads require `audit.read`; no keys/question text/PII in audit metadata.

---

## 7. Validation requirements

- **Every route:** Zod request schema (types, ranges, enums, string
  lengths, URL formats) + Zod response schema (contract tests).
- **CBT-specific:** subjects canonicalised + deduped; question counts in
  `cbt_limits`; durations in range; answer values integers 0–3; positions
  within the frozen paper; UUID formats for ids/keys; `expectedRevision`
  safe-integer ≥0; `sessionGeneration` ≥1.
- **Admin-specific:** `role` enum; service-request status enum;
  `visibility` enum + future-only `releaseAt` for restricted;
  `expected_updated_at`/`expectedUpdatedAt` present for optimistic
  concurrency; import `paperYear` 1954–2100; file sizes/types.
- **Error mapping:** Zod failures → 422 with field messages in
  `details.fields` (safe, schema-validated); domain refusals → the §12
  vocabulary in `API-REQUIREMENTS.md`; unknown errors → 500/503 with
  `requestId` only (never SQL/stack/PII).

---

## 8. Testing requirements

| Layer | What to test | Source of truth |
|---|---|---|
| Unit | Paper planning, subject canonicalisation, compulsory/mock rules, scoring, pace/duration, analytics taxonomy, capability matrix, error mapping. | `src/lib/cbt-config.ts`, `src/lib/capabilities.ts`, `tests/cbt-*.test.ts` |
| Integration | Every route: happy path + auth (401) + capability (403) + ownership (404) + validation (422) + rate limit (429). CBT: start→paper→draft→submit→result round-trip; resume; expiry; abandon; delete. | `API-REQUIREMENTS.md` |
| Security | Authorization matrix (every admin route × every role); bank fail-closed (unclassified/restricted/revoked); provenance refusal; guest per-question release (empty submit leaks nothing); v2 fence (503 in prod); suspension refusal; audit presence. | `tests/authorization.test.ts`, `tests/question-provenance-refusal.test.ts`, `tests/guest-cbt-disclosure.test.ts`, `tests/restricted-bank-*.test.ts` |
| Concurrency | Double-submit idempotency; draft replay; v2 operation replay/conflict; writing-session takeover + stale-write rejection; import commit atomicity (partial failure rolls back); service-request `submission_key` replay. | `tests/cbt-answer-queue*.test.ts`, `tests/service-request-idempotency.test.ts` |
| Contract | Response shapes match the frontend types (`CbtBankPayload`, `CbtAttemptPayload`, `CbtSubmitResponse`, `Admin*` types). | `src/lib/api.ts` types |
| Load/smoke | Catalogue + paper + submit under load (k6 equivalents exist in `scripts/load/k6/`); health/readiness. | `scripts/load/` |

**CI gates:** `tsc --noEmit`, unit + integration + security suites,
contract tests, and a frontend-shape smoke test must all pass before any
cutover step (see integration plan §4).

---

## 9. Deployment requirements (Vercel)

- **Functions:** Express app exported for `serverless-http`; `vercel.json`
  rewrites `/api/*` and `/.netlify/functions/api/*` to the function.
  Keep function timeouts ≥30 s (import extraction, newsroom runs) or move
  long work to background jobs with polling (the frontend already polls
  import status).
- **Database:** managed Postgres (Neon/Supabase/RDS). Connection pooling
  (PgBouncer) for serverless; `statement_timeout`,
  `idle_in_transaction_session_timeout`, `lock_timeout` set per connection.
- **Storage:** S3-compatible with presigned PUT (or backend-proxied
  uploads preserving the JSON `dataUrl` contract). Signed GET URLs ≤300 s.
- **Cron:** daily jobs (newsroom if in scope, stale-attempt sweep,
  analytics retention 90 d, opportunity expiry) via Vercel Cron or
  pg_cron, recorded in `scheduled_job_runs`.
- **Observability:** structured JSON logs with `requestId`; error tracking;
  uptime probe on `/health`; readiness probe on `/health/ready` (DB +
  schema checks).
- **Environments:** `preview` (ephemeral DB + seeded catalogue) and
  `production` (migrated DB, no seed data). Migrations run before deploy
  (migration-first; the frontend's CBT handlers assume the schema exists
  and fail closed with 503 otherwise).

---

## 10. Migration and integration phases

| Phase | Deliverable | Frontend touch |
|---|---|---|
| **0. Foundation** | Repo scaffold, env contract, DB client, error/auth middleware, health/readiness, CI. | None. |
| **1. Identity + catalogue** | Users/profiles/roles, institutions, subjects, services, news, opportunities, calendar, site content, analytics ingestion. | None (Step 1 of integration plan). |
| **2. CBT core (v1)** | Banks, questions, classification, attempts, paper, draft, submit, scoring, results, history, guest. | None. |
| **3. Admin** | Users, service requests, CBT admin, bank security, news, institutions, services+guides, calendar, site, PDF bank, imports, content-manager replacements, jobs/integrity. | None. |
| **4. Portal data** | Saved items, notifications, CGPA, `/me` endpoints. | Repoint direct Supabase calls (Steps 2–3). |
| **5. V2 rehearsal (optional)** | V2 schema + fenced endpoints behind the dev-only gate. | None (frontend already degrades). |
| **6. Cutover** | Deploy alongside old backend; shift traffic per-endpoint; decommission. | API base repoint (Step 1). |
| **7. Auth migration (optional, separate release)** | Own auth (Option B) + credential migration. | Auth rewrite (Step 4B). |

**Data migration note:** question banks, institutions, and catalogue
content must be migrated from the old database (export/import with
provenance preserved). Attempts in flight at cutover must be migrated
with their frozen `question_ids` + drafts, or allowed to expire — never
re-planned. Audit history should be archived, not necessarily migrated.

---

## 11. Acceptance criteria

- [ ] All `API-REQUIREMENTS.md` §2–§10 endpoints implemented with frozen
      shapes + error vocabulary.
- [ ] All `DATABASE-REQUIREMENTS.md` tables/constraints implemented in a
      fresh migration history.
- [ ] All `AUTHENTICATION-AND-PERMISSIONS.md` rules enforced (capability
      matrix, ownership→404, fail-closed banks, suspension refusal).
- [ ] All `CBT-BACKEND-REQUIREMENTS.md` invariants hold (frozen paper,
      server scoring, deadlines, idempotency, single writer, guest
      confidentiality, v2 fence).
- [ ] Test suites in §8 pass in CI.
- [ ] Frontend integration Steps 1–3 complete with no page/component
      redesign.
- [ ] Vercel deployment with health/readiness green.
