# CBT legacy schema: an explicit opt-in, never an inferred mode

`GET /api/health/ready` probes for `cbt_attempts.protocol` with a zero-row
`select protocol limit 0`. The probe never reads candidate data; it only asks
whether the column the CBT paper route needs exists.

## The rule

1. **Missing column → not ready (503).** A database error such as `42703`
   (`column ... does not exist`) means the repository's migrations have not been
   applied. Readiness must not report `ready` for a schema the application
   needs, because a deploy gate or uptime monitor would then treat a known
   schema gap as a healthy state.
2. **Legacy mode is opt-in.** A deployment that deliberately runs the older CBT
   schema sets `CBT_LEGACY_SCHEMA=1`. Only then does the same probe report
   `checks.cbt_protocol_schema = { ok: true, detail: 'CBT operating in legacy-only mode (CBT_LEGACY_SCHEMA).' }`.
3. **Never inferred from the error, the environment or the host.** The earlier
   behaviour treated *any* missing-column error as evidence that legacy mode was
   intended. That inverted the burden of proof: a failed migration looked
   identical to a deliberate rollback.

## Current state of the hosted project

Audited 2026-11-17 against the production project: `cbt_attempts` has 22 columns
and **no `protocol` column**. The `cbt_v2_*` migrations exist in
`supabase/migrations/` but are not applied to production. With the fail-closed
default, production would report `degraded` on the next deploy unless it sets
`CBT_LEGACY_SCHEMA=1` (deliberate legacy) or applies the v2 migrations as a
separate, reviewed rollout. That decision belongs to the operator; it is not
made by this repository automatically.

## What this does not claim

- The probe does not prove migrations, triggers or grants.
- It does not enable the CBT v2 answer routes. Those stay behind
  `cbtV2LocalRehearsalEnabled()`, which is a local rehearsal gate and never a
  rollout switch.
- It does not alter exam integrity: marking, ownership, deadlines and
  server-side duration are unchanged.
