# Supabase migration-history reconciliation

**Status: unresolved — do not run `supabase db push` against production until this plan is completed.**

## Evidence captured 2026-10-16

- Live project: `gjdfatwcoosyuhakrrhh`.
- Remote migration ledger: **173 entries**.
- Repository migration directory on `arena/01a10833-edureach-hub`, after the new reconciliation migration: **56 files**.
- **28** local migration versions are not present verbatim in the remote ledger.
- Of those 28, **23** have a clear same-name remote ledger entry under a different version timestamp. Examples:
  - local `20260916000000_application_integration_seed.sql` ↔ remote `20260915200936 / application_integration_seed`
  - local `20260916010000_cbt_news_rls.sql` ↔ remote `20260915185555 / 20260915_cbt_news_rls`
  - local `20261003170000_create_academic_catalogue_and_daily_quiz.sql` ↔ remote `20261004202655 / 20261003170000_create_academic_catalogue_and_daily_quiz`
  - local `20261003190000_opportunity_discovery_engine.sql` ↔ remote `20261004202656 / 20261003190000_opportunity_discovery_engine`
- **4** local versions had no exact version match or clear name match in the remote ledger, plus the baseline migration whose purpose is to replace older history. These need file-by-file source and behavior review.
- The remote ledger also contains many historical entries not represented as individual local files. The repository's `20260830000000_baseline_core_schema.sql` appears to be an intentional schema baseline, but it has not been proven to be a valid replacement for every absent historical migration.

The remote ledger records the creation migration and the opportunity migration under later version numbers than the timestamps in their local filenames. It also records `remove_legacy_client_policies_from_academic_catalogue` at `20261004202746`, but no file with that exact version exists in the repository snapshot inspected.

## Rules

1. **Do not directly edit** `supabase_migrations.schema_migrations`, delete ledger rows, reset production, or run `supabase migration repair` as a shortcut.
2. Do not assume matching names prove matching SQL. Fetch the relevant source from Git history where available and compare behavior.
3. Classify every local-only version as one of:
   - same migration already applied remotely under a different timestamp (rename/reconcile only after source equivalence is established);
   - intentionally local/unapplied work (must remain pending);
   - genuinely new migration (must be later than all reconciled versions);
   - duplicate or superseded migration (requires an explicit, reviewed disposition).
4. Classify remote-only history as either covered by the baseline, intentionally retained historical ledger, or missing source. Do not invent old migration SQL from names alone.
5. Reconcile on a disposable Supabase branch or clean local replay first. Run the repository migration/schema/RLS/backup checks and compare the resulting schema, policies, functions, grants, indexes, and row counts with production.
6. Only after source equivalence and replay are proven, prepare a written repair sequence for the remote ledger. Get an owner-reviewed backup/PITR checkpoint and restore rehearsal before applying that sequence.
7. Apply the new forward-only schema reconciliation migration only after the historical ordering plan is approved. It preserves rows and fails closed when current data violates required constraints.

## New forward-only schema correction

`20261016160000_reconcile_live_catalogue_and_service_request_contract.sql` aligns the CCMAS programme/catalogue constraints, daily quiz columns and bounds, course reference, discipline index, and service-request insert policy. A live-data preflight on 2026-10-16 returned zero rows violating its required-field, uniqueness, provenance, vocabulary, quiz-bound, or service-reference checks. This is **preflight evidence, not proof the migration has been applied**.

## Acceptance criteria

- Every local migration version has a documented disposition.
- No unexplained pending migrations remain when comparing local and remote.
- A clean replay succeeds from empty database to latest schema.
- Staging schema, grants, RLS policies, functions, indexes, and expected seed/data counts match the approved contract.
- `npm run ci` and the dedicated migration/schema/RLS/backup checks pass on the exact commit proposed for `main`.
- Production migration history and schema are rechecked after the approved rollout.
