# API CONTRACT — `/api/v1`

Status: **proposal** (Milestone 001). No endpoint below exists yet; the current
backend has ~70 unversioned `/api/*` routes and the browser also reads Supabase
directly. This document is the target contract and the compatibility baseline for
the rebuild. Every observed behaviour quoted here was read from the current
repository; nothing was invented.

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `https://<backend-host>/api/v1` (production host is **not** configured in this milestone). |
| Transport | HTTPS, JSON (`application/json; charset=utf-8`). Multipart only for uploads. |
| Versioning | Path segment. Additive changes stay in `v1`; breaking changes get `v2`, served in parallel for one frontend release. |
| Auth | `Authorization: Bearer <access token>` on every non-public route. Public: catalogue, news, opportunities, services, health, guest practice. |
| Actor | Derived only from the verified token; the server re-reads role/capabilities from the database on every request. |
| Idempotency | Mutating CBT and request-creation routes take a client-generated `operationKey` (UUID v4) or `Idempotency-Key` header; replays return the recorded response, never a second write. |
| Concurrency | Versioned resources take `expectedVersion` (or `If-Match`); mismatch → `409 stale_review` / `conflict`. |
| Time | All timestamps ISO-8601 UTC with `Z`. Numeric answer indices are 0-based, matching the current frontend. |
| Pagination | `?limit=&cursor=` (opaque cursor) or `?page=&pageSize=` where the current UI already pages by number. Responses: `{ items, nextCursor, hasMore }`. |
| Rate limits | Per-route, per-actor; headers `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`; `429 rate_limited`. |
| Tracing | Every response carries `X-Request-Id`; error bodies repeat it as `requestId`. |

### 1.1 Success envelope

Plain objects/arrays, **not** wrapped, so the existing frontend shapes survive:

```json
{ "items": [ ... ], "hasMore": false, "nextCursor": null }
```

### 1.2 Error envelope

```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have permission to perform this action.",
    "requestId": "rq_01H...",
    "details": { "fields": { "releaseAt": "must be in the future" } }
  }
}
```

Rules:

- `code` is stable and documented (§6); clients branch on it, not on `message`.
- `message` is operator-facing prose, never SQL, stack traces, column names or PII.
- Refusals never echo the refused content (no question text, no fingerprint, no
  bank title, no raw database error).
- `details` is optional, schema-validated and safe; validation errors put field
  messages there.

---

## 2. Public endpoints

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/health` | liveness | none |
| GET | `/health/ready` | readiness (db, schema marker, storage) | none |
| GET | `/catalogue/institutions` | school finder list/search | none |
| GET | `/catalogue/institutions/:id` | institution detail | none |
| GET | `/catalogue/subjects` | subject catalogue by exam type | none |
| GET | `/catalogue/exams` | bank summaries with availability | none |
| GET | `/catalogue/services` | service catalogue | none |
| GET | `/catalogue/services/:slug` | service detail + guide | none |
| GET | `/content/news` | news list | none |
| GET | `/content/news/:slug` | article | none |
| GET | `/content/opportunities` | scholarships/jobs | none |
| GET | `/content/pages/:slug` | policy/legal pages | none |
| GET | `/content/documents` | public PDF documents | none |
| GET | `/practice/exams/:bankId/guest-questions` | guest practice paper (public banks only) | none |
| POST | `/practice/guest-submit` | guest answers → score + corrections (public banks only) | none |

Guest practice is deliberately unauthenticated — the current product exposes it —
but it must resolve **only** explicitly `public` banks and must never read
questions for a `restricted` or unclassified bank (fail closed, `404` with no
detail, and no question read performed).

---

## 3. Account and session

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/me` | — | `{ user: { id, email, fullName, role, capabilities, profileCompleted } }` |
| PATCH | `/me/profile` | `{ fullName?, phone?, schoolId?, programmeId?, level?, matricNumber?, session? }` | updated profile |
| POST | `/me/avatar` | multipart image | `{ avatarUrl }` |
| POST | `/me/deletion-request` | `{ reason? }` | `{ requestId, status: 'pending_review' }` |
| GET | `/me/notifications` | — | `{ items: [...], unread }` |
| POST | `/me/notifications/:id/read` | — | `{ ok: true }` |
| GET | `/me/security-events` | — | recent events for the caller |

Auth endpoints depend on the identity decision (`SYSTEM-ARCHITECTURE.md` §2.5):

- **Option A (Supabase Auth kept):** no `/auth/*` routes; the frontend keeps
  `supabase.auth.*` and the backend only verifies tokens. `/me` is the single
  bootstrap call.
- **Option B (backend-owned):** `POST /auth/register`, `/auth/verify-email`,
  `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password/forgot`,
  `/auth/password/reset` — all rate limited, all returning the same token pair
  shape.

---

## 4. Student CBT

### 4.1 Bank discovery and configured practice

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/cbt/exams` | — | `{ items: [{ id, title, examBody, subject, durationMinutes, availability: { subjects: [...], questionCount } }] }` |
| GET | `/cbt/exams/:bankId/subjects` | — | `{ items: [{ subject, questionCount, available }] }` |
| POST | `/cbt/exams/:bankId/attempts` | `{ mode: 'practice'\|'mock', subjects: string[], questionCount?, durationMinutes?, programme?, operationKey }` | `{ attempt: { id, status, deadlineAt, questionCount, revision, bankId } }` |
| GET | `/cbt/attempts/:attemptId/paper` | — | `{ attempt, questions: [{ position, questionId, subject, questionText, options: [4], passage?, marks }], serverTime, protocol: { version: 1 } }` |
| PATCH | `/cbt/attempts/:attemptId/draft` | `{ answers: { [position]: index }, questionIndex?, expectedRevision? }` | `{ revision, savedAt, serverTime }` |
| POST | `/cbt/attempts/:attemptId/submit` | `{ answers: { [position]: index }, operationKey }` | `{ attemptId, score, correctAnswers, totalQuestions, breakdown: [{ question, subject?, selected, correct, explanation? }], status }` |
| POST | `/cbt/attempts/:attemptId/abandon` | `{ operationKey }` | `{ status: 'abandoned' }` |
| DELETE | `/cbt/attempts/:attemptId` | — | `{ ok: true }` (owner-scoped; soft delete) |
| GET | `/cbt/attempts` | `?limit=` | `{ items: [{ id, bankId, bankTitle, status, score, total, startedAt, submittedAt }] }` |
| GET | `/cbt/attempts/:attemptId/result` | — | `{ attempt, score, breakdown }` — `score: null` while embargoed |
| GET | `/cbt/attempts/:attemptId/progress` | — | `{ status, answered, total, deadlineAt, serverTime }` |

Compatibility notes that are part of v1:

- The paper keeps **`position`** (1-based) as the stable question key, because the
  current frontend stores answers keyed by position and its v2 protocol validates
  `Object.keys(answers)` against `questionIds.length`.
- `options` is a 4-element array in paper order, so the UI can keep rendering
  A–D; `correct_option` remains a letter in the submit breakdown.
- `serverTime` is present on every timed response; the client uses it to display
  remaining time and never to decide whether an answer is accepted.

### 4.2 v2 writing protocol (kept, but disabled by default)

The current frontend has a complete v2 client (`openCbtV2WritingSession`,
`sendCbtV2Operation`, `fetchCbtV2State`, revision and operation keys). The
contract preserves it so the frontend does not have to be rewritten:

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/cbt/v2/attempts/:id/state` | — | `{ protocol: 2, revision, answers, status, questionIds }` |
| POST | `/cbt/v2/attempts/:id/session` | `{ protocol: 2, requestKey, takeover }` | `{ outcome: 'created'\|'resumed'\|'takeover_required'\|'revoked'\|'expired', sessionId, generation, revision, answers, status }` |
| PATCH | `/cbt/v2/attempts/:id/answer` | `{ protocol: 2, expectedRevision, operationKey, sessionId, sessionGeneration, questionId, selected }` | `{ outcome: 'accepted'\|'conflict'\|'expired'\|'closed'\|'session_revoked', revision }` |
| POST | `/cbt/v2/attempts/:id/finalize` | `{ protocol: 2, expectedRevision, operationKey, sessionId, sessionGeneration }` | `{ outcome, result? }` |

`POST …/finalize` returns `503 v2_finalization_unavailable` until a reviewed
finalizer exists. This matches the current state: v2 creation/finalization are
disabled and the client must degrade to v1.

---

## 5. Admin endpoints

Every admin route requires a capability; the table lists the **minimum**
capability, and the matrix in `SECURITY-REQUIREMENTS.md` §2 is authoritative.

### 5.1 Session and operations

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/admin/session` | staff | `{ user: { id, email, fullName, role, capabilities } }` |
| POST | `/admin/session/verify` | staff | `{ authenticated: true }` |
| POST | `/admin/bootstrap` | none (email-locked) | first-admin bootstrap, 5/15m |
| GET | `/admin/analytics` | `analytics.read` | metrics + `audit` (only with `audit.read`) |
| GET | `/admin/audit` | `audit.read` | `?entityType=&entityId=&actorId=&from=&to=&cursor=` |
| GET | `/admin/jobs` | `analytics.read` | job health |

### 5.2 Banks and questions

| Method | Path | Capability | Notes |
| --- | --- | --- | --- |
| GET | `/admin/banks` | `cbt.read` | inventory incl. unclassified |
| PATCH | `/admin/banks/:bankId/classification` | `cbt.manage` | `{ visibility: 'public'\|'restricted', releaseAt? }`; restricted requires a future `releaseAt`; immutable after set |
| PATCH | `/admin/banks/:bankId/release` | `cbt.manage` | `{ releaseAt }`; future-only; backdating refused |
| GET | `/admin/banks/:bankId/candidates` | `cbt.read` | assignments + status |
| POST | `/admin/banks/:bankId/candidates` | `cbt.manage` | `{ candidateId }` — individual only, never bulk |
| DELETE | `/admin/banks/:bankId/candidates/:candidateId` | `cbt.manage` | revoke |
| GET | `/admin/banks/:bankId/history` | `cbt.read` | audit timeline |
| GET | `/admin/bank-candidates` | `cbt.manage` | `?search=` (min 2 chars, bounded 20 rows) |
| GET | `/admin/cbt/exams` | `cbt.read` | bank list |
| POST | `/admin/cbt/exams` | `cbt.manage` | create bank |
| PATCH | `/admin/cbt/exams/:bankId` | `cbt.manage` | update bank (class always `cbt.manage`) |
| DELETE | `/admin/cbt/exams/:bankId` | `cbt.manage` | guarded when content exists |
| GET | `/admin/cbt/exams/:bankId/questions` | `cbt.read` | `?page&pageSize&search&subject&topic&year&review` |
| POST | `/admin/cbt/exams/:bankId/questions` | `cbt.manage` | create question |
| PATCH | `/admin/cbt/questions/:questionId` | `cbt.manage` | update; **never** accepts a bank move |
| DELETE | `/admin/cbt/questions/:questionId` | `cbt.manage` | audited |

### 5.3 Imports

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/admin/imports` | `cbt.read` |
| POST | `/admin/imports` (multipart) | `cbt.manage` |
| GET | `/admin/imports/:importId` | `cbt.read` |
| PATCH | `/admin/imports/:importId` | `cbt.manage` (paper year/subject, only before publication) |
| POST | `/admin/imports/:importId/retry` | `cbt.manage` |
| GET | `/admin/imports/:importId/items` | `cbt.read` |
| PATCH | `/admin/imports/:importId/items/:itemId` | `cbt.manage` (`expectedVersion`) |
| POST | `/admin/imports/:importId/items/:itemId/review` | `cbt.manage` (`action: approve\|reject`, `expectedUpdatedAt`) |
| GET | `/admin/imports/:importId/source` | `cbt.manage` (signed URL, short TTL) |
| POST | `/admin/imports/:importId/commit` | `cbt.manage` (atomic publication) |
| DELETE | `/admin/imports/:importId` | `cbt.manage` |

### 5.4 People, content, media

| Method | Path | Capability |
| --- | --- | --- |
| GET | `/admin/users` | `user.read` |
| GET | `/admin/users/:userId/activity` | `user.read` |
| POST | `/admin/users/:userId/ban` \| `/unban` | `user.suspend` |
| POST | `/admin/users/:userId/role` | `user.role` |
| GET/PATCH | `/admin/service-requests` \| `/:id` | `service_request.read` / `.process` |
| CRUD | `/admin/news`, `/admin/newsroom/*` | `news.read` / `news.publish` |
| CRUD | `/admin/institutions` | `institution.*` |
| CRUD | `/admin/opportunities` | `opportunity.*` |
| CRUD | `/admin/services` | `service.*` |
| GET/PUT | `/admin/services/:id/guide` | `service.update` |
| CRUD | `/admin/calendar-items` | `calendar.*` |
| GET/PUT | `/admin/site/*` | `site.read` / `site.publish` |
| POST | `/admin/uploads` (image/pdf) | `data.write` |
| GET/POST | `/admin/pdf-bank`, `/admin/pdf-bank/upload` | `data.read` / `data.write` |
| GET/POST/PATCH/DELETE | `/admin/content-manager/data/:resource` | `data.read` / `data.write` |
| POST | `/admin/content-manager/import/:resource` | `data.import` |

---

## 6. Error codes

### 6.1 Transport and auth

| Code | Status | Meaning |
| --- | --- | --- |
| `authentication_required` | 401 | no token |
| `invalid_session` | 401 | token invalid/expired |
| `forbidden` | 403 | authenticated, insufficient capability |
| `not_found` | 404 | absent, or deliberately hidden (restricted/unclassified bank) |
| `rate_limited` | 429 | with `Retry-After` |
| `payload_too_large` | 413 | upload/body limit |
| `unsupported_media_type` | 415 | wrong content type |
| `validation_failed` | 422 | Zod failure, `details.fields` |
| `internal_error` | 500 | masked; `requestId` only |
| `service_unavailable` | 503 | dependency or reviewed database change missing |

### 6.2 Domain

| Code | Status | Meaning |
| --- | --- | --- |
| `bank_unclassified` | 409 | destination bank has no classification (fail closed) |
| `bank_already_classified` | 409 | classification is immutable |
| `release_not_future` | 422 | release time must be in the future |
| `release_cannot_move_earlier` | 409 | release already passed / backdating refused |
| `candidate_not_found` | 404 | assignment target does not exist |
| `assignment_not_restricted` | 409 | assignments only apply to restricted banks |
| `attempt_not_found` | 404 | absent or not owned |
| `attempt_expired` | 409 | past `deadline_at` |
| `attempt_closed` | 409 | already submitted/abandoned |
| `conflict` | 409 | revision mismatch |
| `stale_review` | 409 | optimistic `expectedVersion` mismatch |
| `duplicate_position` | 409 | question position already used |
| `import_not_ready` | 409 | not extracted / nothing approved |
| `import_invalid_batch` | 422 | approved item failed validation; nothing published |
| `question_bank_move_refused` | 403 | moving a question between banks |
| `question_provenance_refused` | 403 | question text already exists in a restricted bank |
| `question_import_provenance_refused` | 403 | an approved batch contains such text; nothing published |
| `v2_finalization_unavailable` | 503 | v2 finalizer not implemented |
| `deletion_pending` | 409 | account has a pending deletion request |

### 6.3 Provenance refusal — exact classification rule

The rebuild must not regress the rule established in the current backend. A
refusal is recognised by **all** of:

1. PostgreSQL SQLSTATE `42501` (the guard's `errcode`), **and**
2. `DETAIL = 'cbt_question_provenance_guard'` (the guard's machine-readable
   marker), or — for servers that do not surface `DETAIL` — the exact guard
   sentence:
   `This question text already exists in a restricted bank. It cannot be added to a public or unclassified bank.`

`42501` **alone is never enough**: permission denials, the import bank-move guard
and the unclassified-bank check all use it. The separate classification gate uses
`DETAIL = 'cbt_question_provenance_guard_missing'` and must map to
`service_unavailable` / `bank_unclassified`, never to a provenance refusal.

Response body (both routes) is exactly:

```json
{ "error": { "code": "question_provenance_refused", "message": "…", "requestId": "…" } }
```

with no question text, fingerprint, bank id/title, SQLSTATE, marker or raw
database error.

---

## 7. Frozen compatibility surface

These are contract items the current frontend depends on; changing them is a
breaking change:

1. Numeric, 0-based answer indices keyed by 1-based **position**.
2. `correct_option` letters (A–D) in submit breakdowns and guest corrections.
3. `serverTime` on timed responses; client never decides expiry.
4. `protocol: { version: 1 }` present on the paper response (the client throws
   `CbtProtocolUnavailableError` without it).
5. CBT v2 outcome vocabulary: `created`, `resumed`, `takeover_required`,
   `revoked`, `expired`, `accepted`, `conflict`, `closed`, `session_revoked`.
6. Guest practice returns `404` (never `403`) for restricted/unclassified banks,
   so existence is not disclosed.
7. Envelope `{ error }` / plain success objects, `items` arrays.
8. `score: null` (not `0`) for an embargoed result.
9. Admin capability names and the `role` → capability mapping.
10. Storage access only through short-lived signed URLs.

---

## 8. Endpoint mapping (summary)

Full per-function mapping, including the browser-direct Supabase calls that have
no HTTP endpoint today, is in `docs/migration/FRONTEND-INTEGRATION-MAP.md`.
