# PHASED IMPLEMENTATION PLAN — backend rebuild

Status: **proposal** (Milestone 001). No phase below has started.

Guiding constraints: the frontend keeps working throughout; the old backend stays
authoritative until the replacement passes staging; no production data or
configuration is touched before an approved cutover.

---

## Phase 0 — Approval and repository creation *(blocked, needs a decision)*

**Goal:** an empty, private `EduReach-Hub-Backend` repository with the agreed
skeleton and no application code beyond health checks.

- Owner approves: backend repo visibility (private recommended), database host,
  identity option (`SYSTEM-ARCHITECTURE.md` §2.5), storage provider.
- Create the repository, branch protection on `main`, CI skeleton
  (typecheck + tests + migration diff), `vercel.json`, `.env.example`.
- No database yet; no secrets in the repository.

**Exit criteria:** repository exists, CI runs on an empty commit, plan approved.

---

## Phase 1 — Foundation

**Goal:** a deployable Express app that can talk to a real (disposable) database.

- `src/app.ts`, request context (`requestId`), error handler + envelope, Zod
  config loader, structured logging with redaction.
- Drizzle schema for `auth_users`/`profiles`/`capabilities` code, generated
  `0001_init` migration, migration CI gate.
- `/health`, `/health/ready`, `/ver` (build id), CORS, security headers, rate
  limiter (in-memory first, durable later).
- Ephemeral Postgres in CI; integration harness (start app → apply migrations →
  run a request).

**Exit criteria:** staging deploy answers `/health/ready` against a disposable
database; no business endpoints yet; secrets only in Vercel env.

---

## Phase 2 — Identity and accounts

**Goal:** the frontend can authenticate against the new backend without changing
its auth screens.

- Option A: JWKS/token verification middleware, actor resolution, `GET /me`,
  `PATCH /me/profile`, notifications and security-event reads.
- Option B (if chosen): register/login/refresh/reset endpoints, password hashing,
  email delivery.
- Capability engine + `requireCapability` + owner-scoped checks with tests for
  every role.
- Deletion-request workflow (request + admin review), nothing executing inline.

**Exit criteria:** a staff and a student token both resolve correctly; forged
metadata is ignored (test); `GET /me` matches the current `/api/admin/session`
shape for staff.

---

## Phase 3 — Catalogue and public content

**Goal:** every read-only public screen works against the new backend.

- Institutions, programmes, exam types, subjects, service catalogue, news,
  opportunities, policy pages, public documents.
- SEO decision implemented (`sitemap.xml`/`robots.txt` static or served).
- Public content cached (HTTP `Cache-Control` + a small in-process cache).

**Exit criteria:** contract tests prove byte-compatible shapes for the 20 public
`api.ts` functions; no Supabase reads remain on these screens.

---

## Phase 4 — Question banks, questions and provenance

**Goal:** the bank model is real before any attempt exists.

- `question_banks`, `bank_classifications`, `candidate_assignments`,
  `questions`, `question_options`, `question_provenance_events`.
- Classification/release/assignment services with the immutability, future-only
  and serialization rules; audit rows in-transaction.
- Provenance guard (fingerprint trigger + refusal identifier + mapping) and the
  bank-move refusal.
- Admin endpoints for banks/questions; **no** bulk assignment.

**Exit criteria:** security suite proves unclassified fails closed, release
cannot be backdated, assignment revocation serialises, provenance refusal maps to
`question_provenance_refused` with no content leakage.

---

## Phase 5 — CBT attempts (v1) and results

**Goal:** configured practice and guest practice work end-to-end.

- `attempts`, `attempt_answers`, `answer_revisions`, `attempt_operations`,
  `writing_sessions` (created now, used in phase 6), `attempt_results`.
- Start (idempotent), paper, draft save (idempotent + revision), submit/score
  (atomic, server-side), result (release-aware), history, abandon/delete.
- Guest practice limited to public banks.
- Load test on paper fetch and answer save.

**Exit criteria:** CBT invariant suite green (deadline, idempotency, single
result under concurrency, no key before release); p95 budgets met.

---

## Phase 6 — v2 writing protocol (optional, default off)

**Goal:** the existing v2 client works if the flag is on.

- Writing-session lifecycle (takeover + generation), answer operations with
  revision conflicts, state snapshot, finalize gateway behind a flag.
- Finalization stays `503` in production until reviewed.

**Exit criteria:** v2 suite green in staging; flag off by default; no v2 route
reachable in production.

---

## Phase 7 — Question import and publication

**Goal:** the import pipeline exists with atomic publication.

- Upload (private storage), extraction job (pdf/xlsx/zip), validation, review with
  optimistic concurrency, atomic publication, provenance + classification checks,
  re-point guard.
- Job runner with idempotent claim/retry and visible status.

**Exit criteria:** invalid batch publishes nothing; unclassified destination
publishes nothing; provenance batch rolls back whole; import source never public.

---

## Phase 8 — Admin operations and audit

**Goal:** every admin screen has a backend.

- Users/roles/suspension, service requests, news/newsroom, site content, media
  uploads, pdf bank, content manager, analytics.
- Audit read API; audit coverage test for every mutation; redaction test.
- Remaining rate limits durable; job bookkeeping.

**Exit criteria:** authorization matrix suite covers every admin route; every
mutation produces exactly one audit row; no confidential content in audit rows.

---

## Phase 9 — Frontend integration (separate repository work)

**Goal:** switch the frontend without changing its design or behaviour.

- Add `VITE_API_BASE_URL`; route `src/lib/api.ts` through it.
- Replace the 13 direct Supabase reads and the auth calls (or keep auth, option A).
- Feature-flag per area: content → CBT → admin.
- Remove the Supabase browser client only after everything is green.

**Exit criteria:** the frontend's own test suite and Playwright E2E pass against
staging; no `SUPABASE_SERVICE_ROLE_KEY` in the frontend deployment.

---

## Phase 10 — Staging verification and cutover readiness

**Goal:** evidence that the replacement is at least as safe as the old backend.

- Full staging run with a disposable database and synthetic data: classification,
  assignment, restricted paper, submission, revocation, release, guest practice,
  import + publication, unauthorized access, deletion workflow.
- Concurrency rehearsal (revocation/release vs in-flight writes; double submit).
- Performance, accessibility (frontend unchanged), and fail-closed tests for a
  missing schema.
- Documented rollback: keep the old backend live and switch the frontend flag.

**Exit criteria:** staging sign-off by the owner; a cutover plan with a rollback
that does not depend on data migration.

---

## Phase 11 — Production cutover and decommission (not authorised)

- Connect the production domain, set production environment variables, run a
  smoke test, monitor, then retire the old backend **only** after the agreed
  observation window.
- Data migration (if any) is its own approved project: the old ledger is
  unreconciled (195 hosted versions vs 84 repository files) and must not be
  replayed blindly.

---

## Sequencing dependencies

```
0 ─► 1 ─► 2 ─┬─► 3
             ├─► 4 ─► 5 ─► 6
             └─► 7 ─► 8 ─► 9 ─► 10 ─► 11
```

Phases 3, 4 and 7 can proceed in parallel after phase 2 if staffing allows; phase
5 depends on 4; phase 9 depends on everything it switches over.
