# Session 7 — Production schema reconciliation (2026-10-21)

## Scope and safety

This addendum records a read-only review of production project `gjdfatwcoosyuhakrrhh` after merge commit `b5bf31f` (PR #27). The requested password settings were deliberately left for the owner to change in Supabase Auth.

No production migrations, schema writes, data writes, or deployments were performed during this review. Production has a separate legacy migration lineage; do not apply the repository's hardening migrations in bulk.

## Confirmed live observations

- The `service_guides` table exists in production. Its recorded connector migration version is `20261021101514`; RLS is enabled, with no client policies or client grants as intended for server-only access.
- `public.edureach_audit_logs` exists.
- `public.admin_audit_logs`, the `public.admin_audit_log` RPC, and `public.handle_new_user()` are absent.
- The live auth trigger on `auth.users` is `on_auth_user_created_edureach`, calling `public.handle_new_student_profile`. Therefore, the absence of the older `handle_new_user` name alone is not evidence that signup is broken; preserve the live trigger until its implementation and behaviour have been verified.
- Among the production tables sampled in this review, only `edureach_audit_logs` and `service_guides` were present from the requested list; the absence of other repo-classified tables must be reconciled against actual live callers before creating them.
- The Supabase security advisor reported: a mutable search path on `public.cbt_submit_grace`; `public.plan_cbt_paper(uuid,text[],integer,jsonb)` executable by `anon` as SECURITY DEFINER; and 17 RLS-enabled tables without policies. Several no-policy tables are intentionally server-only, so these notices require per-object review rather than blanket policy creation.
- The `service_guides` RLS/no-client-grant posture is intentional because access is mediated by capability-checked server endpoints.

## Required follow-up, in order

1. **Audit logging:** inspect the exact server RPC call and the live `edureach_audit_logs` schema. Decide whether to restore a compatibility RPC writing to the existing table, or add the canonical `admin_audit_logs` table plus RPC. Do not silently swallow failed audit writes on sensitive admin actions. Any migration must be idempotent, server-only, capability-safe, and tested against a staging clone first.
2. **Signup:** inspect `handle_new_student_profile`, its trigger, and recent signup errors. Do not recreate `handle_new_user` by name without evidence it is required by current code.
3. **Table drift:** for each of the ten reported missing tables, map current code references, live data ownership, and the intentional September wallet/payment removals. Restore only tables that current production code requires; do not recreate retired wallet/payment systems merely to satisfy a stale expected-schema list.
4. **Function hardening:** inspect `cbt_submit_grace` and `plan_cbt_paper` definitions and intended caller roles, then prepare narrowly scoped grant/search-path migrations with regression tests.
5. Re-run production validation and security advisors after each reviewed migration; record actual outcomes and rollback steps.

## Not done

- No production schema reconciliation has been applied.
- No missing table/function has been created or dropped.
- No RLS policies or grants have been changed in this session.
- Supabase Auth minimum password length and leaked-password protection were left to the owner as requested.
- This is a source-of-truth audit note, not a claim that production and repository schema are aligned.
