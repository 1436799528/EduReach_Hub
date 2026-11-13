# Launch engineering evidence — 2026-11-04

**NOT READY — critical work remains.** This records local work only. Nothing here authorizes a deployment, merge, hosted migration, live account deletion or deadline change.

## Audit and implementation boundary

| Existing system / duplicate check | Gap | Minimal change / impact | Evidence |
| --- | --- | --- | --- |
| Existing privacy preference, cookie UI, analytics client and server ingestion; one shared availability gate added, not a parallel tracker | Storage failure could leave old permission active in another tab; rejecting locally was not durable | Temporarily disable optional collection locally on client and server; invalidate legacy opt-ins; keep rejection and settings available. Browser `client_error` telemetry is also suspended, so essential monitoring needs a reviewed alternative. Existing analytics are not erased. | 132 focused Node and 6 desktop/mobile browser tests passed after hard-off; see full run below. No deployment. |
| Existing CBT full-draft save/submit RPCs and scorer; candidate extends these concepts rather than adding another client writer | Concurrent snapshots, stale tabs and ambiguous acknowledgements can overwrite accepted work | Non-deployable isolated `supabase/candidates/cbt_revision_protocol.sql`: per-question expected-revision update, owner check, operation-key replay/conflict ledger, and finalization of accepted server draft via the existing scorer. The current app and legacy/direct writers do **not** use it. | Five PGlite tests and a disposable PostgreSQL multi-connection lock/replay/conflict/finalization race rehearsal passed. Not end-to-end or hosted evidence. |
| Existing Auth/profile cascades, shared campus content, audit logs, storage and analytics; no existing deletion workflow located | Naive Auth deletion can destroy other users' contributions, be blocked by audit FKs or leave indirect identifiers; policy unknown | Inventory and retention-decision matrix in `LAUNCH-USER-RIGHTS-AND-RECOVERY-2026-11-02.md`; no real deletion operation implemented. Synthetic dependency tests explicitly reproduce two major failure modes. | Local migration replay: 31 selected direct/indirect FK relationships and 55 identity/JSON/storage columns inventoried. Two PGlite dependency tests pass. Full live schema, processors and policy still need review. |

The candidate must **not** be applied as a migration: legacy/direct/privileged writers bypass revisions, the client has no conflict/reconciliation integration, and operation-ledger retention, abuse limits and rollout/rollback remain undecided. Preserve official deadlines and the existing 120-second submission grace. Test timed and manual submission, retries, late commits and old clients before any approved rollout. The earlier CBT/privacy bulk report records a historical state; its proposal to choose whether to disable analytics has since been superseded by the explicit temporary hard-off above.

## Verification and limitations

- Local `npm run ci`: typecheck, **799/799** Node tests, schema audit, all **78** migrations listed, build, performance **10/10** (334.6/336 KB gzip), analytics audit, **194** desktop/mobile Chromium tests passed with **20 skipped**, mobile performance **1/1**, RLS audit, static accessibility **0 blocking / 5 informational**, dependency audit **0 vulnerabilities**. Run completed before the additional deletion dependency test was added; that test separately passed **2/2** and typecheck passed again. The test models a synthetic database, not actual Auth/Storage services.
- Disposable PostgreSQL candidate rehearsal used three separate connections and synthetic data after applying the local migration set. It verified waiting/locking, duplicate answer replay, stale conflicts, write-versus-finalize ordering, finalization replay and rejection of late writes. It is not staging evidence and does not cover the legacy client paths.
- Local built preview started without a hosted database and responded HTTP 200. A separate local Chromium smoke opened Customize and confirmed the suspension notice is visible and Accept optional is disabled; automated browser suite above also ran the built app. Configured-service tests use synthetic interceptions; neither authenticates against real Supabase.
- Supabase project listing showed named staging **inactive** and production active; no hosted writes or production testing. Remote PR #33 remains open/conflicting and has not been merged. Historical hosted CI does not validate this uncommitted reconciliation. Authoritative GitHub CI and hosted deploy preview for this exact work remain unavailable until an authorized push/PR workflow and appropriate permissions are arranged.
- Historical migrations include potentially broad seed/cleanup statements. Do not replay blindly against real content. No hosted rollback or storage restore was rehearsed.

## Staging/UAT checklist — NOT RUN

Run only after the owner verifies a disposable, non-production staging target and approves the relevant staged writes; follow `docs/operations/STAGING_VERIFICATION_RUNBOOK.md`.

- [ ] Confirm app and CLI project identities independently; establish isolated synthetic accounts and storage, capture migration ledger, backups and rollback plan.
- [ ] Review migration compatibility, privileges/RLS and every legacy/privileged CBT write path before applying a finished protocol; test older clients and rollback with no loss of accepted answers.
- [ ] Use separate real authenticated sessions for concurrent question changes, retries/ambiguous network loss, conflict resolution, multi-tab recovery, timer expiration, grace, duplicate and late submission, scoring and immutable final state.
- [ ] Verify the deployed analytics hard-off with real network inspection across reloads, storage failure and multiple tabs; validate essential monitoring and historical-data handling separately.
- [ ] After policy and implementation approval, test ownership, recent authentication/confirmation, request durability, admin authorization and audit, exceptions, shared contributions, storage, partial failures/retries, backups and truthful completion using synthetic identities only.
- [ ] Exercise service request and admin journeys, genuine-content preservation, accessibility and mobile performance; retain run IDs, screenshots, logs and explicit pass/fail/blocked results without secrets.
- [ ] Run authoritative GitHub CI and an authorized hosted preview on the exact reviewed commit; record all approvals required by the 22-stage lifecycle and qualified legal review. Do not infer readiness from a local pass.

## Owners and unresolved decisions

Engineering: integrate and secure the CBT protocol across all writers, implement account deletion only once a safe approved policy exists, restore essential security observability, and provide transaction/hosted tests. Project owner: arrange disposable staging, hosting/CI access, operational backup and monitoring evidence, and review shared-content behavior. Qualified legal/privacy reviewer: decide retention, exceptions, processors, backups and Nigerian-law implications. Product/security owners: approve authorization, user messaging and lifecycle gates. None of these approvals has been recorded here.
