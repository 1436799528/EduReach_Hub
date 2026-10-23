# Supabase migration-history reconciliation

**Status: unresolved — do not run `supabase db push` against production until this plan is completed.**

## Evidence captured 2026-10-16

- Live project: `gjdfatwcoosyuhakrrhh`.
- Remote migration ledger: **173 entries**.
- Repository migration directory on `arena/01a10833-edureach-hub`, after the new reconciliation migration: **56 files**.
- **19 filenames use legacy 8-digit prefixes**, not the 14-digit version format used by the live ledger. These also need explicit mapping before any production push.
- Among the 37 files with 14-digit prefixes, **28 local versions are not present verbatim** in the remote ledger.
- Of those 28, **23** have a clear same-name remote ledger entry under a different version timestamp. Examples:
  - local `20260916000000_application_integration_seed.sql` ↔ remote `20260915200936 / application_integration_seed`
  - local `20260916010000_cbt_news_rls.sql` ↔ remote `20260915185555 / 20260915_cbt_news_rls`
  - local `20261003170000_create_academic_catalogue_and_daily_quiz.sql` ↔ remote `20261004202655 / 20261003170000_create_academic_catalogue_and_daily_quiz`
  - local `20261003190000_opportunity_discovery_engine.sql` ↔ remote `20261004202656 / 20261003190000_opportunity_discovery_engine`
- **4** local versions had no exact version match or clear name match in the remote ledger, plus the baseline migration whose purpose is to replace older history. These need file-by-file source and behavior review.
- The full 186-row inventory is in [`MIGRATION_HISTORY_MAP_2026-10-16.csv`](./MIGRATION_HISTORY_MAP_2026-10-16.csv): it maps all 56 local files against the 173 live ledger entries, including 13 local/unmapped or baseline/new cases and 130 remote-only ledger entries. Remote-only entries may be historical or covered by the baseline; that has not been proven.
- The repository's `20260830000000_baseline_core_schema.sql` appears to be an intentional schema baseline, but it has not been proven to be a valid replacement for every absent historical migration.

The remote ledger records the creation migration and the opportunity migration under later version numbers than the timestamps in their local filenames. It also records `remove_legacy_client_policies_from_academic_catalogue` at `20261004202746`, but no file with that exact version exists in the repository snapshot inspected.

## Enforced in the validation script (2026-10-22)

The comparison is no longer uniform, because a shared legacy version cannot
identify a single file. Check 8 of `supabase/ci/production-validation.sql` now
returns three verdicts, and the generated checklist carries a `kind` column that
selects the rule (`scripts/migration-checklist.ts`):

| Kind | Files | Rule |
|---|---|---|
| `unique` | 60 | Ledger row with this version, or with a matching name (the ledger recorded several under a later timestamp). |
| `shared` | 13 — five of the six `20260903` files, five on `20260919`, three on `20260920` | **Name only.** A version match is never evidence: one ledger row would otherwise vouch for every file on that date. |
| `unresolved` | 1 — `20260903_production_security_hardening.sql` | Reported `unresolved` until a ledger row for that file exists. Never `pass`; never a confident `fail`. |

The five `20260903` files with a documented remote version
(`20260903191649`, `20260903191619`, `20260903192620`, `20260903191723`,
`20260903192713`) are matched by name, exactly as the CSV records them.

`20260903_production_security_hardening.sql` remains **unresolved**: the CSV
classifies it `legacy-filename-unmapped`, and the similarly named ledger entry
`20260903191133 / production_security_contract_hardening` is not the same file.
Settling it needs the comparison described in rule 3 of this document, on a
disposable branch — not a guess made here. Until then the validation script says
so out loud instead of reporting a pass.

Editing the ledger is still forbidden (rule 1). These verdicts read the ledger;
they never write to it.

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

`20261016160000_reconcile_live_catalogue_and_service_request_contract.sql` aligns the CCMAS programme/catalogue constraints, daily quiz columns and bounds, course reference, discipline index, and service-request active-service policy. It also restores the missing student portal tables used by `src/lib/studentDashboard.ts`, adds the canonical admin audit table/RPC used by `server.ts`, and keeps CBT answer-key/attempt writes behind server-authoritative RPCs. It intentionally does not recreate retired payment tables/functions. A live-data preflight on 2026-10-16 returned zero rows violating its required-field, uniqueness, provenance, vocabulary, quiz-bound, or service-reference checks. This is **preflight evidence, not proof the migration has been applied**.

## Acceptance criteria

- Every local migration version has a documented disposition.
- No unexplained pending migrations remain when comparing local and remote.
- A clean replay succeeds from empty database to latest schema.
- Staging schema, grants, RLS policies, functions, indexes, and expected seed/data counts match the approved contract.
- `npm run ci` and the dedicated migration/schema/RLS/backup checks pass on the exact commit proposed for `main`.
- Production migration history and schema are rechecked after the approved rollout.
