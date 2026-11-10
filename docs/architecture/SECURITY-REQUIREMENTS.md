# SECURITY REQUIREMENTS — backend rebuild

Status: **requirements** (Milestone 001). These are acceptance criteria, not
descriptions of implemented behaviour. Each requirement names how it will be
verified, because the rebuild is only as good as the tests that fail when a
requirement is removed.

Carried forward unchanged from the established restricted-bank/CBT work; nothing
here weakens an existing guarantee.

---

## 1. Non-negotiables

| # | Requirement | Verification |
| --- | --- | --- |
| S1 | No public disclosure of restricted question-bank answers, options or explanations. | Security suite: every read path × (guest, unassigned student, assigned student, staff) with answer-key assertions. |
| S2 | An unclassified bank fails closed: no questions, no paper, no result, no guest practice. | Same matrix; a bank with no classification row returns 404/0 rows, never "public by default". |
| S3 | Candidate access is only via explicit, individual assignment. No bulk assignment, no inferred groups, no "all staff" access. | Route surface has no bulk endpoint; DB has no role-based read of restricted content. |
| S4 | Correction-release times are server-controlled and stored in the database; a client clock never influences release. | Test that changes the client-supplied time and asserts identical output; release decided by SQL `now()`. |
| S5 | Authorization is enforced in the database/backend, not in the UI. | Every admin route tested with a forged role claim; nav hiding is UX only. |
| S6 | One active writing session per attempt. | Database partial unique index; concurrent session tests (two clients, one winner). |
| S7 | Deadlines are server-authoritative. | Attempt deadline stored at start; answer/submit refused after `now() > deadline_at` regardless of client state. |
| S8 | Answer saving is idempotent. | Replayed `operationKey` returns the recorded response; the answer row has one write. |
| S9 | Finalization and scoring are atomic and server-authoritative. | One transaction, attempt row locked; concurrent submits produce one result; break the transaction and the test fails. |
| S10 | No silent answer loss. | Draft queue is persisted client-side and every accepted write is acknowledged; rejected writes surface a visible error; reconciliation test. |
| S11 | Scoring is never client-authoritative. | The submit payload may carry answers only; the score is computed from `question_options` server-side; a forged score field is ignored (tested). |
| S12 | No service-role/privileged credential in the frontend bundle. | Bundle scan in CI for `SERVICE_ROLE`/secret patterns; env contract keeps them server-only. |
| S13 | Account deletion is a separate, controlled workflow. | Deletion requests are reviewed, scheduled, audited; no inline delete; PII handling documented. |
| S14 | Administrative actions are auditable. | Every admin mutation writes an audit row in the same transaction; a test asserts the row for each route. |

---

## 2. Authorization matrix (target)

`R` read, `W` write, `—` denied. "Owner" means the caller must own the row.

| Resource | guest | student | content_editor | service_admin | super_admin |
| --- | --- | --- | --- | --- | --- |
| Public catalogue/content | R | R | R | R | R |
| Public bank practice (guest) | R | R | R | R | R |
| Restricted bank questions | — | owner-assigned only | via bank policy only | — | via bank policy only |
| Own attempt (draft/paper/submit) | — | R/W owner | — | — | — |
| Own results | — | R owner, post-release | — | — | — |
| Bank classification / release | — | — | W (`cbt.manage`) | — | W |
| Candidate assignment | — | — | W (`cbt.manage`) | — | W |
| Question import / publication | — | — | W (`cbt.manage`) | — | W |
| Service requests (personal data) | — | own only | — | W (`service_request.process`) | W |
| Users / roles / suspension | — | — | — | — | W (`user.role`, `user.suspend`) |
| Audit log read | — | — | — | — | `audit.read` |
| Site content publication | — | — | `site.publish` | — | W |

Rules: the role → capability map is **code** (not a table); a capability check is
never sufficient on its own for restricted content — the bank policy is re-checked
inside the transaction; owner-scoped capabilities require a resource.

---

## 3. Restricted-bank rules (must not regress)

1. **Classification is explicit and immutable.** A bank is `public` or
   `restricted` only after an administrator decides. There is no default, no
   inference from `is_active`, import source, review status or prior exposure.
   Changing a classification is a separately reviewed lifecycle operation.
2. **A restricted bank requires a future correction release time** at
   classification; the API rejects `public` with a release time and `restricted`
   without one.
3. **Release can move later, never earlier once passed.** Backdating is refused;
   an already-released bank cannot be re-embargoed (the data is already out).
4. **Revocation and release changes serialise against in-flight writes.**
   Authorization takes a `for share` lock on the bank policy row (and the caller's
   live assignment) so a revocation cannot commit between an operation's check and
   its write. An operation already authorized may finish; every later one is
   denied.
5. **Publication requires** an explicitly classified destination and an approving
   administrator whose role is re-read from the database — never from the request
   payload. An unclassified destination publishes nothing.
6. **A reviewed import cannot be re-pointed between differently classified
   banks.**
7. **Question provenance:** identical question text may not be created or edited
   into a non-restricted bank when a restricted bank already holds it. The guard
   is content-identity only — it does not detect paraphrase, and it does not
   classify historical questions. Copying public text into a restricted bank
   remains allowed.

## 4. CBT integrity rules

| Rule | Why |
| --- | --- |
| Paper snapshot frozen at start (`attempts.paper`) | Added or removed questions must not change an in-progress attempt. |
| Answer positions validated against the paper | Prevents writes to questions the candidate never received. |
| `attempt_operations` unique `(attempt_id, operation_key)` | Retries cannot double-write or double-score. |
| `writing_sessions` partial unique on active row | One writer; takeover is explicit and generation-checked. |
| Ambiguous answers rejected at write time | A queued answer with an invalid index never reaches storage silently. |
| Scoring read from `question_options.is_correct` | Single source of truth; no client key. |
| Result embargo before release | `score: null`, not `0`; breakdown withheld until release **and** assignment active. |
| Guest practice restricted to `public` banks | `404`, no question read, no difference in response timing shape. |
| v2 finalization disabled until reviewed | `POST /cbt/v2/…/finalize` returns 503; no half-implemented gateway. |

## 5. Application security requirements

- **Input validation** with Zod at every boundary; unknown keys rejected;
  strings bounded; ids validated as UUIDs; no SQL string interpolation.
- **Output shaping**: responses are explicit DTOs; no `select *` reaches the
  client; answer keys never serialised outside allowed paths.
- **Headers**: `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy`, restrictive `Content-Security-Policy` on API responses,
  CORS allowlist per environment (no wildcard with credentials).
- **Cookie/CSRF**: bearer tokens only in phase 1 (no cookies), so CSRF is not
  applicable; if cookies are introduced, `SameSite=Lax` + double-submit token.
- **Rate limiting**: durable, per actor where authenticated, per IP otherwise;
  the current rule set (bootstrap 5/15m, guest submit 30/10m, cbt start 60/10m,
  upload 20/10m, import 10/10m, general 1200/m) is the baseline.
- **Uploads**: size and MIME allowlist, server-side magic-byte check, content
  hash, private storage, short-lived signed URLs.
- **Secrets**: only in the backend environment; never logged; never in error
  bodies; rotated independently per environment.
- **Dependency hygiene**: `npm audit` in CI, pinned lockfile, no `postinstall`
  scripts from untrusted packages.
- **PII minimisation**: audit rows carry ids, not emails or names; the current
  system writes an account email on `user_ban` and a filename on upload — the
  rebuild must not (see §6).

## 6. Auditing and retention

- Every admin mutation writes `audit_logs` in the same transaction: actor,
  action, entity, before/after policy metadata, request id.
- Audit rows are **append-only**: the app role cannot `update` or `delete`;
  a trigger refuses both. Reads require `audit.read`.
- Refusal events are audited where practical (`bank_classify_denied`,
  `question_provenance_refused`, `question_import_provenance_refused`,
  `question_bank_move_refused`, …).
- No audit row may contain question text, options, answer keys, hashes of them,
  student answers, passwords or tokens. A redaction test asserts this for every
  audit-producing route.
- **Retention is an owner decision, not an engineering default.** The rebuild
  must not invent a period. Required decisions:
  1. how long `audit_logs` are kept and the legal basis;
  2. whether rows must be exportable to cold storage;
  3. whether the old `edureach_audit_logs` table is migrated or frozen read-only;
  4. whether account-deletion anonymises or removes related audit rows.

## 7. Account deletion (separate workflow)

1. The student requests deletion (`POST /me/deletion-request`); the request is
   recorded, never executed inline.
2. An administrator with the right capability reviews it; the account is
   suspended from sign-in immediately.
3. Within the agreed window, PII (name, phone, email, matric number, avatar,
   saved items, notifications) is removed or pseudonymised.
4. Attempts, scores and audit rows are retained with a pseudonymous id, or
   deleted according to the same owner decision as §6.
5. Every step is audited; the flow is idempotent and resumable.

## 8. Threat model highlights

| Threat | Control |
| --- | --- |
| Student scrapes a restricted bank by iterating ids | Bank policy checked per request; unclassified/restricted returns 404 with no question read; rate limiting. |
| Staff member copies restricted text into a public bank | Provenance guard + refused-move trigger + audit. |
| Attacker replays an answer to overwrite after submit | Attempt status lock + operation key + revision. |
| Two tabs write answers concurrently | One writing session; second session requires explicit takeover; revisions detect conflict. |
| Client clock manipulation extends time | Server deadline; client time never used. |
| Forged `role` in JWT metadata | Role read from `profiles`; metadata ignored. |
| Service key exfiltration from the bundle | Key never shipped; CI bundle scan. |
| SQL injection | Drizzle parameterisation; no raw interpolation of request data. |
| Imported file attacks the parser | Size/type limits, isolated parsing, no shell, no HTML rendering of extracted text. |
| Admin account compromise | Capability separation, audit trail, role change requires `user.role`, self-promotion refused by trigger. |
| Data exfiltration through export endpoints | Exports require explicit capabilities and are audited; bounded row counts. |

## 9. Security release gates

A release is blocked if any of the following is not green:

1. authorization matrix suite (every route × role);
2. CBT invariant suite (S6–S11);
3. provenance refusal mapping tests (exact classification, no leakage);
4. audit-coverage test: every admin mutation writes a row;
5. redaction test: no confidential content in logs or audit rows;
6. dependency audit and secret scan;
7. staging end-to-end run with a disposable database.
