# Service submission idempotency: local database candidate

**NOT READY FOR LAUNCH.** This is a partial local candidate, not a deployed fix. The existing student application still performs direct inserts and is not protected by the candidate function.

## Pre-change audit and impact

| Existing implementation / duplicate check | Current gap | Local candidate | Impact and verification |
| --- | --- | --- | --- |
| `ServiceApplyPage`, `submitServiceRequest`, direct `service_requests` insert, generated reference trigger | An insert may commit despite a lost response; retrying creates a duplicate. No equivalent idempotent submit RPC was found. | Add a nullable per-student submission key with a unique partial index and an authenticated RPC. Preserve the existing table, reference trigger, policies, and direct-client workflow. | Synthetic role tests and a disposable local PostgreSQL multi-session race test pass; hosted staging remains necessary. |
| Existing `service_requests` student field boundary and owner RLS | A privileged RPC could bypass the student boundary or expose staff-only fields. | Derive the owner from `auth.uid()`; require an expected user ID solely as a matching assertion, never as the owner. The security-definer function uses an empty search path and returns only id, reference, timestamp and status; no anonymous execution. | Local role tests and release-check drift tests, not hosted Supabase Auth/PostgREST or security approval. Legacy direct inserts still exist and do not supply the key. |
| Existing request draft in session storage | The function cannot help if the browser generates a new key after a timeout or sends changed details under an old key. Storage can fail, users may open multiple tabs, and another account may sign in. | No client wiring in this continuation. Design the key lifetime and storage/account handling separately; fail closed when an unconfirmed request cannot be safely recovered. | Current UI is **not** idempotent. A future client must cover timeouts, reloads, storage failures, account switches and repeated clicks without exposing personal data or falsely confirming success. |
| Existing release checklist and backup rehearsal | New migration and function need drift checks and a safe rollout. | Add the candidate to the release version checklist, a limited read-only schema/index/function privilege check, and rerun synthetic backup/restore. | These checks are not proof of deployed behaviour, review of the full function body, compatibility of all external writers, or production backup recovery. |

## Semantics and limitations

- The RPC rejects null keys, non-object details and client-supplied `reference_code`; the database still creates the reference. It looks up an existing request first, so a committed request remains recoverable after service deactivation. A reused key with changed service/details fails rather than silently confirming different input.
- `ON CONFLICT` and the unique index are intended to serialize simultaneous inserts with the same user/key. A disposable local PostgreSQL multi-connection test passed for a committed winner, a rolled-back first writer and a mismatched concurrent retry; wider isolation/error scenarios and hosted staging are still unverified.
- A follow-up regression showed that comparing current `form_data` could reject the original retry or accept changed details after a privileged edit. The candidate now compares a SHA-256 fingerprint of the original normalized service key and JSONB details. A trigger prevents ordinary updates from altering the stored key or fingerprint. The fingerprint is derived from personal information and must be handled as sensitive; it is not a guarantee of anonymization. Privileged operators can disable triggers or change schema, so external writer and drift review remains mandatory. Direct and privileged inserts without a key are outside the mechanism.
- A per-browser key cannot by itself deduplicate independent submissions in different tabs/devices; do not merge genuinely distinct requests. Key retention and recovery, user-facing cancellation, storage failures, clear-data/account switching, and payload changes require a reviewed UX/security design.
- SQL is an uncommitted local candidate: no hosted migration, production record, merge or deployment was authorized. Review live schema/role drift, index lock/build impact, migration ordering, rollback and legacy compatibility before staging. Do not blindly replay historical migrations against populated data.

## Evidence

The new regression failed before the function existed. The synthetic sequential database test and existing service boundary tests passed locally. The earlier backup fingerprint (592 columns) is superseded by the follow-up rehearsal, which applied **78 migrations**, fingerprinted **50 tables, 593 columns, 53 policies and 50 RLS tables**, and restored synthetic data. It is not a Supabase production backup or restore.

Before the fingerprint follow-up, full local verification was **786/786** unit/integration tests passed;
typecheck, schema audit, generated 78-migration checklist, offline RLS audit,
analytics audit and staged/unstaged Git diff checks passed. The pre-existing
release-check test first flagged a read-only SQL string as a forbidden command;
the check was rewritten using PostgreSQL catalog metadata and the full suite
then passed. The previous unconfigured browser suite and build predate this
SQL-only candidate; no end-to-end client test exists for the new RPC.

## Follow-up: immutable recovery identity and local race rehearsal

Before this change, the synthetic regression showed that a privileged edit to
`form_data` made the original retry fail. The candidate now saves a server-side
SHA-256 fingerprint of the original normalized service key and canonical JSONB
details; its update trigger protects both the key and fingerprint from ordinary
updates. Status/note changes still work. The fingerprint is sensitive
personal-data-derived information, and its storage, retention, comparison and
upgrade stability still need privacy/security review.

The optional `scripts/rehearse-service-idempotency-races.mjs` starts an entirely
new local PostgreSQL cluster using a separately installed test-only tool, applies
the repository migrations with platform shims, and uses three connections with
synthetic records. It confirmed the second connection waited on a lock, then
verified one committed row in each of three scenarios: first writer commits,
first writer rolls back, and the conflicting payload differs. This tests real
PostgreSQL transactions, not Supabase Auth/PostgREST, external writers, every
transaction isolation level or end-to-end user behaviour. No hosted database was
contacted. The form remains on the legacy direct insert and no duplicate
prevention is active in the student journey.

Final local checks for this follow-up: **787/787** unit/integration tests,
typecheck, schema audit, generated 78-migration checklist, offline RLS audit and
both Git diff checks passed. The release-validation regression checks missing
identity constraints, a disabled protection trigger and anonymous function
execution. The local PostgreSQL race rehearsal also passed after the fingerprint
change. No application client, hosted migration, staging test or deployment was
performed here.

## Follow-up: account assertion inside the RPC

A form may be prepared while one account is active and sent after the token
changes. The local candidate now takes the expected account ID and refuses a
missing or different value before creating or recovering a row. The ID is an
assertion only; `auth.uid()` remains the actual owner and callers cannot choose
another owner. The new contract first failed because the four-argument function
was absent. Synthetic PostgreSQL role tests now cover mismatched and missing
expected IDs, a missing authenticated identity and attempted recovery under a
changed account. The existing real local PostgreSQL multi-connection rehearsal
passed again for commit, rollback and conflicting-payload races using the new
signature. The release check and its tests use that signature.

This is an uncommitted, unused local candidate. The client still sends a direct
insert and must not be switched until the retry-key lifetime, storage failures,
changed-payload and account-switch behavior are designed and tested. The
assertion is not a substitute for real hosted Auth/RLS/PostgREST verification;
legacy direct writers remain outside the RPC. No migration or data change was
made to any hosted environment.

### Client recovery design constraints (not implemented)

- Persist and verify the exact key **before** sending; if storage or secure key
  generation fails, do not send a request that cannot be retried safely.
- Bind the pending key to the account and service. A retry must use the original
  details, or stop and offer an explicit way to review/restore them; never send
  changed details under an old key and call the response a new submission.
- Retain an unresolved key across reloads and after ambiguous responses. Do not
  interpret an empty My Requests list as proof that a delayed insert cannot
  still commit. Define acknowledgement/starting another request only after a
  confirmed outcome; handle storage failures during cleanup without lying.
- Account changes must be checked both before the request and by the RPC. A
  per-tab key cannot stop genuinely independent submissions from another tab,
  another device or cleared session storage. Avoid claiming otherwise.
- The existing account-scoped draft already contains personal information in
  session storage. A retry snapshot must minimize additional copies and have an
  explicit cleanup and privacy review. Browser storage is not encrypted or an
  authorization boundary. Staging needs actual network-after-commit, reload,
  repeat-click, cross-account and storage-failure tests.

Verification for the account-assertion follow-up: **788/788** local
unit/integration tests passed after the build; typecheck, schema audit, the
78-migration checklist, offline RLS, analytics, static accessibility,
dependency audit and performance budgets passed. The full first run before a
build passed 787 with one build-dependent test skipped; the built rerun passed
all 788. Three independent local PostgreSQL race scenarios passed. Browser
journeys and hosted Auth/PostgREST were not rerun or established by this
SQL-only follow-up.

## Subsequent client integration (local only)

Earlier statements in this document that the form does not call this candidate
are historical. The local client now uses it with a key saved in the existing
account-scoped session draft. This does not close launch: see
`SERVICE-RETRY-RECOVERY-2026-11-02.md` for the audit, end-to-end mock evidence,
staging and migration-first dependencies, and remaining failure scenarios.
The local candidate was subsequently extended to a required five-argument
check-only contract; see `SERVICE-UNAVAILABLE-RECOVERY-2026-11-02.md`. Earlier
four-argument results are historical and do not establish hosted rollout.
