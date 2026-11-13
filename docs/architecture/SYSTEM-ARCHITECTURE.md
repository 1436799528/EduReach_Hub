# SYSTEM ARCHITECTURE — EduReach Hub backend rebuild

Status: **proposal for approval** (Milestone 001, discovery and architecture).
Nothing in this document has been implemented, deployed or applied to a database.

Source of truth for the *current* system is the existing repository
(`1436799528/EduReach_Hub`, branch `main` at `ac66747` plus the unmerged working
tree). Everything below labelled **Observed** was read from that repository.
Everything labelled **Proposed** is a decision to be confirmed in Milestone 002.

---

## 1. Current system as inspected (Observed)

### 1.1 Frontend

| Aspect | Observation |
| --- | --- |
| Framework | React 19 + TypeScript 5.8, client-rendered SPA built with Vite 6 (`vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/App.tsx`). |
| Routing | Hand-rolled route table in `src/app/routes.tsx` with `ProtectedRoute` and lazy page imports; ~46 pages in `pages/`. |
| Styling | Layered plain CSS (`src/*.css` plus per-feature files such as `src/bank-security.css`, `src/admin.css`), documented in `docs/architecture/STYLESHEET_LAYERS.md`. No CSS framework. |
| Components | 28 shared components in `src/components` (nav, cards, dialogs, banners, cookie consent, connection banner). |
| Data layer | `src/lib/api.ts` (~2000 lines, 94 exported functions) wrapping `fetch`; `src/lib/supabase.ts` creating a browser Supabase client. |
| Tests | `node --test` suites in `tests/` (975 assertions-level tests at the last run) plus Playwright E2E specs (`tests/e2e`), axe accessibility checks, custom perf/a11y/RLS/schema audits in `scripts/`. |

The browser talks to **two** backends today:

1. **Supabase directly** (`src/lib/supabase.ts`): `auth.*` for sign-in/sign-up/
   session/reset, 13 direct table reads (profiles, institutions,
   student_notifications, student_saved_items, student_cgpa_courses,
   student_security_events, service_requests, service_catalog, cbt_attempts) and
   2 RPC calls — all gated by Supabase RLS.
2. **The Express API** in `server.ts` (~4000 lines, ~70 routes), bundled by
   esbuild and served in production as a Netlify Function
   (`netlify/functions/api.ts` via `serverless-http`, path prefix
   `/.netlify/functions/api`, rewritten from `/api/*` in `netlify.toml`).

### 1.2 Existing backend

| Aspect | Observation |
| --- | --- |
| Runtime | Node 22, Express 4, TypeScript compiled with esbuild; `GET /api/health` and `GET /api/health/ready` are the readiness surfaces. |
| Database access | `@supabase/supabase-js` with the **service-role key** for privileged queries, and a caller-scoped client (`getUserScopedSupabase`) for RPCs that must run as the signed-in user (bank security, CBT v2 gateways). |
| Business logic location | Split three ways: Express handlers, SECURITY DEFINER PostgreSQL functions (CBT start/submit/scoring, import publication, bank policy, audit), and RLS policies. The database is the authorization boundary for CBT and bank policy. |
| Validation | Hand-rolled per route (`if (!question_text?.trim() …)`), no shared schema library. |
| Errors | `{ error: string }` bodies, occasionally `{ error, code }`; HTTP status chosen per route; messages normalised by `lib/errors.ts` and `src/lib/failures.ts` in the browser. |
| Auth | Supabase Auth (email + password, email confirmation, password reset). Admin authority is resolved server-side from `profiles.role` into an application role (`student`, `content_editor`, `service_admin`, `super_admin`, with legacy `admin`/`moderator` mapped to `super_admin`) and a capability list (`src/lib/capabilities.ts`). |
| Rate limiting | In-process sliding window (`lib/rate-limit.ts`) plus a durable `check_rate_limit` RPC; rules: admin-bootstrap 5/15m, guest-cbt-submit 30/10m, cbt-start 60/10m, admin-upload 20/10m, admin-import 10/10m, admin-newsroom-run 6/1h, analytics 240/m, general 1200/m. |
| Storage | Supabase Storage buckets: `past-questions` (private import sources), `resource-files` (private, signed URLs), `admin-content` (public images/PDFs). |
| Notifications | In-app only: `student_notifications` rows written by `src/server/notifications.ts` on service-request status changes. **No email/SMS provider is present in the repository** — notification emails are not implemented today. |
| Newsroom | Ingestion pipeline (`src/server/newsroom/*`), `news_sources`/`news_ingest_runs`/`news_ingest_candidates`, a `daily-news-refresh` Netlify scheduled function, and a `pg_cron` job that expires stale news on the hosted project. |
| Database size | 85 migration files in `supabase/migrations`, 52 tables classified by `scripts/rls-posture.ts`; the hosted project reports **88** public tables and **195** ledger rows, i.e. the lineages diverged. |

### 1.3 Verified weaknesses of the current split

- The browser holds a publishable Supabase key and talks to PostgREST directly,
  so table-level RLS — not the Express API — is the boundary for those 13 read
  paths.
- The Express layer holds the service-role key, which bypasses RLS; every safety
  property therefore depends on each handler remembering to check.
- Business rules live in three languages (TypeScript, PL/pgSQL, SQL policies) with
  no single schema for validation, so a route, an RPC and a policy can disagree.
- The Netlify function is a single 4000-line module: slow cold starts, no module
  boundary, and no shared request-context/error pipeline.
- Migration lineage is unreconciled (195 hosted vs 85 repository), so the running
  schema cannot be rebuilt from the repository.

---

## 2. Target architecture (Proposed)

### 2.1 Topology

```
 Browser (React SPA, unchanged repository)
        │  HTTPS, JSON, Bearer <access token>
        ▼
 api.edureach.<domain>/api/v1/*          ← new Express app on Vercel (Node runtime)
        │  pg Pool (single privileged role, SSL)
        ▼
 PostgreSQL (fresh project, new migration history, Drizzle-managed)
        │
        ├── S3-compatible object storage (or Supabase Storage) — private buckets + signed URLs
        └── background/worker endpoints (Vercel Cron) for import jobs and retention
```

Three deployables, independently versioned:

| Deployable | Repository | Runtime | Notes |
| --- | --- | --- | --- |
| Frontend | `EduReach_Hub` (unchanged) | Vercel static | Only change in a later milestone: `VITE_API_BASE_URL` and removal of the Supabase browser client. |
| Backend | `EduReach-Hub-Backend` (to be created) | Vercel Node functions | One Express app mounted at `/api/v1`. |
| Database | managed PostgreSQL | — | Fresh project; no data copied from the old database without a separate approved migration. |

### 2.2 Application structure

```
EduReach-Hub-Backend/
├─ api/                     # Vercel entrypoint(s) only
│  └─ index.ts              # export default handler = serverless-http(app)
├─ src/
│  ├─ app.ts                # express app assembly (no listen)
│  ├─ server.ts             # local listen only
│  ├─ config/               # env parsing (Zod), constants, feature flags
│  ├─ db/
│  │  ├─ client.ts          # pg Pool, transaction helper
│  │  ├─ schema/            # Drizzle tables, split per module
│  │  └─ migrations/        # drizzle-kit SQL, numbered, immutable
│  ├─ modules/
│  │  ├─ auth/              # token verification, session, current actor
│  │  ├─ users/             # profiles, roles, suspension, deletion requests
│  │  ├─ catalogue/         # institutions, programmes, subjects, exam types
│  │  ├─ banks/             # classification, candidate assignment, release
│  │  ├─ questions/         # questions, options, provenance guard
│  │  ├─ attempts/          # start, paper, drafts, writing sessions, answers
│  │  ├─ scoring/           # submission, scoring, results, history
│  │  ├─ imports/           # upload, extraction, review, publication
│  │  ├─ admin/             # cross-cutting admin operations
│  │  ├─ audit/             # audit writer + read API
│  │  ├─ notifications/     # in-app notifications
│  │  ├─ storage/           # object storage adapter, signing
│  │  └─ platform/          # health, readiness, jobs, meta
│  ├─ http/                 # middleware, error handler, request context
│  └─ lib/                  # pure helpers (ids, clock, hashing, redaction)
├─ tests/
│  ├─ unit/                 # pure logic, schema, mappers
│  ├─ integration/          # route + real Postgres (ephemeral)
│  └─ security/             # authorization matrix, CBT invariants
├─ drizzle.config.ts
├─ vercel.json
└─ package.json
```

Each module owns four files: `<name>.routes.ts` (HTTP only), `<name>.service.ts`
(transactional business logic), `<name>.schema.ts` (Zod request/response), and
`<name>.repo.ts` (Drizzle queries). Routes never touch the database directly and
services never touch `req`/`res`.

### 2.3 Module boundaries

Rules enforced in review and by lint:

1. **One module owns one table family.** Cross-module reads go through the
   owning module's service, never through its tables. `attempts` may call
   `banks.hasAccess()`; it may not read `question_bank_security`.
2. **Authorization is a module concern.** Every service entry point takes an
   `Actor` value object and a capability; the repository never decides policy.
   Database-level constraints (triggers, checks, FKs) remain the backstop where
   the old system proved they were necessary (CBT).
3. **HTTP is dumb.** A route's only jobs are: parse (`Zod`), call the service,
   map the result to a response envelope, map an error to a status code.
4. **Side effects are explicit.** Audit writes, notifications and storage
   deletions happen inside the same transaction as the mutation they describe, or
   through an outbox row handled after commit — never fire-and-forget.
5. **No cross-module SQL.** If two modules need one query, that query belongs to
   exactly one of them.

### 2.4 API versioning

- Prefix `/api/v1`. Version is in the path, not a header.
- Additive changes ship inside `v1` (new optional fields, new endpoints).
- Breaking changes ship as `/api/v2` with both served in parallel for at least
  one frontend release.
- Responses never remove or rename a field inside a version; a field marked
  deprecated stays until the next major version, `Deprecation`/`Sunset` headers
  announce removal.
- The existing frontend's reliance on **numeric answer indices**, **position
  numbers** and the CBT protocol envelope is part of v1's frozen contract (see
  `docs/api/API-CONTRACT.md` §7).

### 2.5 Authentication and authorization

**Identity (Proposed, decision required).** Two viable options:

| Option | Shape | Trade-off |
| --- | --- | --- |
| **A. Keep Supabase Auth as the identity provider** *(recommended for phase 1)* | Frontend keeps `supabase.auth`; backend verifies the Supabase JWT (JWKS/HS256 secret) on every request. | Zero change to student sign-up/reset flows and no credential migration; the new backend still owns every *authorization* and database decision. Keeps a hosted dependency the rebuild is trying to shed. |
| **B. Own auth in the backend** | `POST /v1/auth/*` for register/login/refresh/reset, argon2id password hashes, rotating refresh tokens, email verification. | Full control and no Supabase dependency; requires a credential migration plan, email delivery, and a frontend auth rewrite (largest single frontend change). |

Whichever is chosen, the backend derives the caller **only** from a verified
token and re-reads `role` from the database on every request. Client-supplied
roles, metadata claims and headers are never trusted (the current code already
documents that `user_metadata.role` is hostile).

**Authorization model (Proposed, carried forward):**

- Roles: `student`, `content_editor`, `service_admin`, `super_admin`, legacy
  `admin`/`moderator` mapped to `super_admin`.
- Capabilities: the existing 30-entry list in `src/lib/capabilities.ts` becomes
  the backend's single enum (Zod-validated, exported to the frontend types).
- Three enforcement layers, all required:
  1. Route guard: capability required for the endpoint.
  2. Service guard: ownership or bank policy re-checked inside the transaction.
  3. Database guard: constraints/triggers that make the unsafe state
     unrepresentable (see `DATABASE-DESIGN.md` §6).
- Owner-scoped capabilities (`profile.read`, `cbt.view_result`, …) always require
  a resource; a staff role never implies ownership.

### 2.6 Database access

- Exactly one privileged connection role, held only by the backend
  (`DATABASE_URL`). No browser, no service key in the client bundle.
- `pg` Pool + Drizzle; **every mutation** runs inside `withTransaction()`.
- `statement_timeout`, `idle_in_transaction_session_timeout` and
  `lock_timeout` set per connection; long tasks (imports) run as jobs.
- No dynamic SQL from request bodies; queries are parameterised by Drizzle.
- Row-level security is **not** the primary boundary in the new design (the
  browser never touches Postgres) but is kept where it costs nothing and helps
  defence in depth for the future (see §2.12).

### 2.7 Error-handling conventions

Single error type, single renderer.

```ts
class AppError extends Error {
  code: ApiErrorCode;        // stable, documented, snake_case
  status: number;            // HTTP status
  details?: unknown;         // safe, non-sensitive, schema-validated
  expose: boolean;           // false → generic message + reference id
}
```

- Unknown errors become `500 internal_error` with a `requestId`; the raw error
  goes to logs only.
- Messages are operator-facing sentences, never SQL, stack traces, column names
  or PII. Refusals never echo the content that was refused (see §2.12).
- Response envelope: `{ "error": { "code", "message", "requestId", "details?" } }`.
  Success bodies are plain objects/arrays, not wrapped, to keep the existing
  frontend shape.

### 2.8 Logging and auditing

Two different things, deliberately separate:

- **Operational logs** (stdout, JSON): `requestId`, route, status, duration,
  actor id, tenant-free metadata. Never question text, answer keys, scores before
  release, passwords, tokens, file contents. Redaction list lives in
  `src/lib/redact.ts` and is unit-tested.
- **Audit log** (database, append-only): `admin_audit_logs` equivalent —
  actor, action, entity type/id, before/after policy metadata, request id,
  created_at. Written in the same transaction as the change. No answer keys,
  no question text, no candidate PII beyond an id.
- Audit reads require `audit.read`; audit rows are never updated or deleted by
  the application. Retention is an operational decision (see
  `SECURITY-REQUIREMENTS.md` §6).

### 2.9 File storage

- Object storage with **three private buckets**: `import-sources`, `resources`,
  `admin-media`. Public delivery is by signed URL (short TTL) or by a backend
  proxy route, not by a public bucket.
- Uploads: size/type/server-side-signature checks, virus-scan hook (future),
  content-hash for dedupe, storage key namespaced `env/owner/yyyymm/uuid`.
- The backend is the only holder of storage credentials; the browser receives a
  short-lived presigned PUT or uploads through the backend.

### 2.10 Import processing

`upload → extract → review → publish`, mirroring the observed pipeline but with
server-side jobs:

1. `POST /v1/admin/imports` (multipart or presigned), checksum recorded.
2. Extraction job (`pdf-parse`, `jszip`, `fast-xml-parser` equivalents) writes
   `question_import_items` with validation issues; the raw file stays private.
3. Reviewer edits/approves items (`PATCH …/items/:id` with optimistic
   `expectedVersion`).
4. `POST …/commit` publishes **atomically** in one transaction: destination must
   be classified, every approved item re-validated, duplicates detected, status
   transitions guarded by a row lock; any failure rolls the batch back.

### 2.11 CBT session and answer persistence

The invariants that took several milestones to establish are kept as
first-class backend rules (details in `SECURITY-REQUIREMENTS.md`):

- one paper snapshot per attempt, frozen at start;
- one active writing session per attempt (`unique (attempt_id)` where
  `ended_at is null`, enforced by partial unique index);
- answer writes are idempotent operations with a client `operation_key` and a
  monotonic `revision`, stored in `attempt_answers` + `attempt_operations`;
- deadlines are computed from `attempts.deadline_at` in the database, never from
  a client clock;
- submission and scoring happen in one transaction, server-authoritative, with
  the attempt row locked.

`v2` writing/finalization stays **disabled** in production until its
finalization gateway exists; the schema reserves the columns so enabling it is
not a migration.

### 2.12 Security boundaries

| Boundary | Rule |
| --- | --- |
| Browser → backend | Bearer token; every response schema-shaped; no privileged key ever shipped. |
| Backend → database | One role, least privilege that still allows the app (no `BYPASSRLS` if avoidable); RLS retained as a second net for tables the browser might later touch. |
| Question content | Read only through services that enforce bank classification + assignment + release; no generic "list all questions" endpoint. |
| Answer keys | Never returned before correction release; scoring computed in the database/backend, never in the client. |
| Admin | Capability + database re-check; self-promotion impossible (role column not writable by the actor's own request path). |
| Audit | Append-only, `audit.read` only, no content. |
| Secrets | Only in the backend environment; `VITE_*` variables are public by definition. |

### 2.13 Testing strategy

| Layer | Tool | What it proves |
| --- | --- | --- |
| Unit | `node:test` + Zod | pure logic, mappers, redaction, error codes, schema invariants |
| Contract | `node:test` + supertest against `app` with a fake DB | request/response shapes, status codes, error envelope |
| Integration | ephemeral PostgreSQL (container or `pglite` where honest) with real migrations | transactions, constraints, locks, triggers, isolation |
| Security | dedicated suites | authorization matrix for every route × role, CBT invariants (revocation, release, idempotency, deadline), provenance refusal |
| Performance | k6/autocannon smoke | p95 budgets on paper fetch, answer save, submit |
| Migration | `drizzle-kit` diff in CI | no drift between schema and migrations; migrations replay clean on empty DB |

Rule carried from the current repo: every security property has a test that
**fails when the property is removed** (mutation-tested), not merely a happy-path
assertion.

### 2.14 Vercel deployment architecture

- Repository `EduReach-Hub-Backend` → Vercel project `edureach-hub-backend`.
- `api/index.ts` exports the Express app through `serverless-http`; `vercel.json`
  rewrites `/api/*` to it. Keep the function region close to the database.
- Environments: `preview` (per-branch, preview DB), `staging` (integration),
  `production` (custom domain, not connected in this milestone).
- `DATABASE_URL` uses the pooled connection string (PgBouncer/`?pgbouncer=true`);
  migrations run from CI or a one-off job with a direct connection, never from a
  request.
- Cron endpoints for retention/jobs; each is idempotent and authenticates with a
  secret header, not a user token.
- Frontend CORS allowlist per environment; no wildcard with credentials.
- Deploy gates: typecheck → unit/integration → migration diff → build → smoke on
  `/api/v1/health/ready`.

---

## 3. What is unchanged

- The frontend repository, its design system, its routes and its components are
  untouched by this milestone. The frontend keeps working against the old
  backend until the replacement passes staging.
- The old backend (Supabase + `server.ts`) stays in place and authoritative.
- No production data, no production environment variables, no hosted migrations.

## 4. Unresolved decisions

1. Identity provider: Supabase Auth (option A) or backend-owned auth (option B).
2. Storage: keep Supabase Storage or move to S3/R2 (affects signed-URL code only).
3. Hosting of PostgreSQL: Supabase Postgres, Neon, RDS or Vercel Postgres;
   pooled connections and migration credentials differ per choice.
4. Whether the public site's SEO surfaces (`/sitemap.xml`, `/robots.txt`) move
   behind the API or stay statically generated.
5. Newsroom ingestion: keep in the new backend or make it a separate worker.
6. Retention periods for audit rows and import sources (owner decision, not an
   engineering default).
7. Whether v2 CBT writing is enabled in the rebuild or remains disabled.
