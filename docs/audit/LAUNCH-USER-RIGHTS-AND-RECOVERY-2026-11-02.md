# User rights, recovery and remaining launch work

**Decision: NOT READY FOR LAUNCH.** This is a working engineering plan, not a
legal opinion, production-readiness certification, deletion implementation or
approval to merge or deploy. It supplements
`LAUNCH-RECONCILIATION-2026-11-02.md` and the existing staging and operations
runbooks. The user selected **both** self-service deletion where safe and an
administrator-reviewed path where human handling is needed.

## Reuse and impact audit

| Area | Existing implementation and duplicate check | Current behavior and gap | Minimal direction / impact / verification |
| --- | --- | --- | --- |
| Account and data deletion | Individual saved items and CBT results have deletion flows; the CMS contact page describes data requests. No full account deletion endpoint, request queue or confirmed complete erasure was found. | P0/P1: deleting a Supabase user alone would not prove all data is handled and could cascade through shared records. Legal retention, backup recovery and deployed dependencies are not established. | Design a single authenticated request lifecycle that supports self-service for eligible accounts and reviewed exceptions. Do not add a misleading completion control. Exercise ownership, recent reauthentication, confirmation, concurrency, failure/retry and all data stores in isolated tests and staging. |
| Error reporting | `ConnectionBanner`, `src/lib/failures.ts`, `AsyncState`, page-specific retries, `ErrorBoundary`, API liveness `/api/health` and dependency readiness `/api/health/ready` already exist. | The generic offline copy promised that all work was stored and automatically synced. 403 and 401 both implied an expired session; missing DB relations/functions looked like a missing record. Monitoring and incident communication are not established. | Reuse and correct the existing messages. Test real offline/online transitions, known failures, safe retry, keyboard and assistive announcements. Distinguish liveness from dependency readiness; neither establishes the health of every feature. |
| CBT saves and submissions | The existing session owns drafts, debounce, retry, submission, confirmation and timer; API uses the existing owner-scoped save RPC. | A missing token could resolve a save without sending it. Storage exceptions were swallowed while the UI claimed local saving. A timeout/503 can leave the server submission outcome unknown. Separate potential ordering/race issues still need reproduction: overlapping saves can complete out of order, and a prior response can clear a newer pending draft. | Reject unauthenticated saves; report uncertain outcomes honestly without claiming automatic sync or completed submission. Reproduce same-tab, multi-tab, network, persistence and submission races; apply a coordinated server-enforced version/idempotency design only after tracing deployed writers and migration compatibility. No scoring or production data change here. |
| User-owned content | Student profile, service requests, CBT, saved items, security events, notifications, notes and wallet-related records already exist. | Local schema links can cascade, including campus posts and comments; active requests and shared content require careful treatment. Some records are linked indirectly or lack FKs. | Inventory every live relationship and downstream consumer; avoid deleting other people's contributions. Decide per data class whether to delete, de-identify, retain under an approved rule or review manually. Verify with synthetic data, including unrelated users. |
| Consent and legal content | Existing preference key/customization and policy CMS; #32's separate refund page also exists. | Durable revocation under unwritable storage, refund CMS reconciliation, privacy notices and Nigerian legal review remain open. | Preserve existing controls, fail closed, do not invent retention periods, paid terms, contacts or commitments. Test browser traffic, multiple tabs/reloads and storage failures. |
| Operations | Existing release, backup and staging runbooks, analytics/security audits and CI. | Staging inactive; live policy/schema drift, failed PR #33 Netlify checks and authoritative CI for this working tree are unresolved. | Restore staging through the already assigned owner process; inventory drift read-only, rehearse backups and migration order/rollback, run true authenticated journeys and monitoring/incident drills, then request explicit approval. |

## Deletion dependency inventory — local schema replay only

A PGlite replay of the current repository migrations was inspected without real
user records. It is **not** an inventory of production Auth, Storage, backups or
external integrations. Direct foreign keys in the replay show:

- `auth.users` cascades to `profiles` and CBT attempts; profiles cascade to
  service requests, student saved items, CGPA, notifications, security events,
  wallets/transactions, campus posts/comments/likes and material notes. Nested
  references and data owned by other users must also be mapped before action.
- `admin_audit_logs.admin_user_id` restricts Auth deletion; news authors, CBT
  exam creators and newsroom reviewers have non-cascading references. Several
  editor/uploader references are `SET NULL`. Staff and shared-content accounts
  cannot be assumed to be eligible for self-service deletion.
- `site_analytics_events.user_id` and session IDs have no direct foreign key in
  this replay. Other `user_id`-like columns may also lack direct FKs. An Auth
  cascade therefore cannot demonstrate complete deletion or anonymization.
- Profile avatar data may be an external URL or uploaded image data in the
  profile flow; separately inventory Storage buckets, ownership, object paths,
  service-request attachments, logs, authentication metadata, exports, backups,
  vendors and any indirect identifiers in JSON fields. Do not delete shared
  assets solely because an account is recorded as an editor or uploader.
- The production schema was already found to drift from the repository; live
  effective grants, policies, triggers, FK actions, storage ownership and all
  external processors must be mapped before implementation is approved.

## Retention and dependency matrix — 2026-11-04 local replay

This is an inventory and **proposed review direction**, not an approved retention
policy or a deletion implementation. No retention periods or legal grounds have
been established here. The local replay found 31 direct foreign keys into Auth,
profiles, CBT attempts and shared campus posts; it is not a complete live
inventory. Each row requires owner and qualified legal/security approval.

| Category / repository location | Identity relationship and risk | Proposed handling pending decisions | Approval / verification |
| --- | --- | --- | --- |
| Auth user, `profiles` | Auth deletion cascades to profile and several dependent tables; auth metadata can hold personal data. | Review eligibility and remove only after all dependent steps are confirmed. | Fresh authentication, explicit confirmation, owner/security review; real Auth staging. |
| `cbt_attempts`, `cbt_answers` | Auth cascade removes attempts and answer rows. The isolated CBT revision candidate would add operation records cascading with attempts if ever adopted. | Review deletion/anonymization and exam-history requirements; do not infer a retention period. | Product/legal decision, staged scoring/history and retry tests. |
| `service_requests`, `student_notifications`, `student_saved_items`, CGPA, security events, wallet tables | Profile cascades; request JSON, admin notes, notifications and metadata may contain personal information. | Review active operations, financial/operational exceptions and retention; do not blindly cascade. | Legal/operator decision and cross-user synthetic dependency tests. |
| `campus_posts`, comments, likes | Author cascade removes posts, and post deletion cascades to other users' comments/likes. | Administrator review for shared contributions; preserve other users and platform content unless an approved policy says otherwise. | Product/legal approval and multi-user cascade rehearsal. |
| `admin_audit_logs`, `edureach_audit_logs` | Auth admin FK can restrict deletion; generic JSON may contain indirect identifiers. | Review appropriate minimized audit retention/de-identification and last-admin safeguards. | Security/legal decision and explicit audit integrity tests. |
| `news_articles`, `cbt_exams`, imports, guides, `site_pages` and settings | Creator/reviewer/uploader links may restrict Auth deletion or be set null; content may be shared. | Review references and preserve shared educational/editorial content; never delete content solely because an account is linked. | Content owner/security approval and tests. |
| `site_analytics_events`, `edureach_deadlines`, `edureach_exams`, `payment_events` | User IDs or JSON may be indirectly identifying and are not all protected by direct FKs. Analytics has a repository retention job, not a deletion approval. | Inventory real fields, processors and indirect identifiers; decide delete, anonymize or retain per category. | Legal/operator review and synthetic verification. |
| `storage.objects` and bucket paths; `resource-files`, `past-questions`, `admin-content`, `campus-uploads` | Objects can be shared or platform-owned. Metadata, uploader IDs and URLs do not establish exclusive ownership. Profile avatars can be URLs or embedded data. | Inventory actual buckets, references, ownership and external URLs; never remove shared objects merely because of uploader identity. | Storage owner/security approval and staged partial-failure/retry tests. |
| Browser drafts, consent, logs, exports, backups and external processors | Some are outside the relational FK graph or absent from this replay. | Review independent cleanup and backup/restore reapplication; never claim immediate erasure from all backups. | Legal/operator and processor agreements; restore rehearsal. |

No self-service erasure, reviewed exception queue or completion mechanism has
been implemented. Adding a request table without approved identity retention,
review capabilities and recovery semantics would itself create an unmanaged
personal-data store. Continue implementation only after those constraints are
resolved; do not call a request submitted or deletion completed without durable
confirmation.

## Selected deletion workflow — design and acceptance criteria

1. **Identify and explain.** Provide an accessible account/privacy entry point
   only once it is real. Describe the scope, irreversible effects, active
   requests, retention exceptions and backups using approved legal wording.
   Do not claim that deletion has occurred merely because a form was submitted.
2. **Authenticate and confirm.** A user acts only for their own server-verified
   identity; require recent reauthentication appropriate to the configured auth
   methods, an explicit confirmation and CSRF/origin/rate-limit protections.
   Never expose a service key or allow a caller to specify someone else's ID.
3. **One lifecycle, two paths.** The server evaluates eligibility using the
   approved dependency/retention rules. Eligible accounts can proceed through
   self-service. Staff accounts, unresolved ownership, active operations or
   approved exceptions go to a capability-restricted administrator review
   queue. A review request must be stored durably and acknowledged only after
   persistence; an unavailable queue must report failure without a fake ticket.
4. **Recoverable execution.** Treat DB, Auth and Storage as separate failure
   domains rather than pretending they form one transaction. Use an idempotent,
   auditable, resumable process with narrowly scoped permissions, duplicate and
   concurrency protection, explicit in-progress/failed/manual-review/completed
   states, and non-sensitive logs. No completion until every required step is
   confirmed. Define how the user can obtain status without retaining an active
   account or exposing identity; avoid promising an unconfigured email channel.
5. **Retention and backups.** Qualified counsel and the operator must approve
   categories and grounds, any retention durations, processor obligations,
   notices and a restore/deletion replay procedure. Do not invent durations or
   claim immediate removal from immutable backups. Review how account deletion
   interacts with active requests, shared content and the last administrator.
6. **Proof before enablement.** Synthetic tests cover owner isolation, cross-user
   refusal, staff restrictions, fresh auth, confirmation/cancellation, repeated
   calls, races, storage/auth/db outages, partial retries, deletion of indirect
   references, preservation of other users/shared content, accurate receipt and
   backup restore. Repeat with real Auth/Storage/RLS in staging and obtain legal,
   security and operational approval before any production activation.

This workflow is **not implemented yet**. The existing contact CMS is not proof
that a monitored deletion-request channel or reviewed queue exists.

## Ordered launch gates

1. **P0 — user data integrity and rights:** design/implement and independently
   test the deletion lifecycle; reproduce and fix CBT save ordering and
   submission uncertainty; enforce service-request capabilities and versioning
   at the actual database write boundary; protect genuine data and shared links.
2. **P0 — privacy and security:** fix durable consent revocation for failure and
   cross-tab/reload cases; reconcile effective RLS/grants/roles, safe logs,
   storage permissions, auth flows and hosted drift. Obtain qualified review of
   deletion/retention, policy wording and any legally required exceptions.
3. **P1 — usable failure and recovery:** test each critical user journey's real
   network, server, auth, validation, timeout and dependency failures. Ensure
   pending work is not called saved, success is not invented, retry is safe and
   an accessible, monitored support/incident route is actually configured.
   Monitor liveness, dependencies and critical transactions without logging
   personal or sensitive input; assign owners and rehearse incidents/rollback.
4. **P1 — staging and data:** restore the separate staging environment, compare
   migration ledger/effective schema, rehearse backup and rollback, then test
   real student/admin authorization, deletion, notifications, CBT scoring,
   service requests, content publication and imports with synthetic data. Review
   genuine content sources; no blanket deletion or production test records.
5. **Release controls:** authoritative CI and an approved working preview must
   pass on the exact reviewed commit; resolve competing PR coordination, review
   security/accessibility/performance and legal content; obtain explicit merge
   and deployment authorization and perform post-release monitoring. A green
   local suite, one health endpoint or a few browser widths is not launch proof.

No merge, deployment, hosted migration or production deletion is authorized by
this plan. The last reported PR #33 quality gate applies to its own head and
not this local reconciliation.

## Local implementation and verification in this update

- The existing offline notice and shared failure copy no longer promise that
  all actions are locally stored and automatically synced. Connection loss and
  reconnection were exercised in Chromium; browser connectivity is only a device
  signal, not a guarantee that the server or every dependency is working.
- The shared classifier and API client distinguish HTTP 401 from 403; direct
  missing-relation/function codes are treated as backend failures. The CBT
  session no longer claims pending answers are definitely stored or that an
  unconfirmed submission never arrived, and its end confirmation distinguishes
  answered questions from saved changes.
- The existing authenticated CBT draft function now throws when no bearer
  session exists instead of resolving as a successful save without a request.
  A local API regression test checks that failure. A mocked browser session
  tested failed draft and submission responses with local pending-draft storage
  blocked. These tests do not exercise live Auth, the deployed RPC, cross-tab
  concurrency, a real timeout after a server commit, or backend monitoring.
- On this unconfigured working tree: typecheck and **766/766** local
  unit/integration tests passed; schema, 75-migration checklist, analytics,
  offline RLS, static accessibility and dependency audits passed (static a11y
  has five informational findings; npm audit reported zero known
  vulnerabilities). Build and strict performance budgets passed (10/10; entry
  98.5 KB, CSS 50.9 KB, critical path 208.2 KB, all JS 334.0 KB).
- Desktop/mobile Chromium: **176 passed, 2 skipped**, including four tests
  for offline recovery and mocked CBT failure; separate throttled mobile
  performance: **1 passed**. These are local, unconfigured tests, not a hosted
  deletion, staging, CI, WCAG certification or production readiness result.
