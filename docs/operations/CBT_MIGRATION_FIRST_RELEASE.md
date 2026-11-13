# CBT migration-first release procedure

**Status:** operator procedure for a future separately approved release; not a deploy gate, authorization, or evidence that any target has passed. Netlify's build (`netlify.toml`) and the repository CI do not verify the destination database. `/api/health/ready` only probes the protocol column through PostgREST and is neither a deployment gate nor a complete migration, trigger or privilege check. A merge may trigger deployment depending on external configuration: verify and, if necessary, pause that automation **before merge**. Do not assume the repository can control it.

The current application **cannot safely provide legacy paper loading against the pre-protocol schema**: it requires the stored `cbt_attempts.protocol` before invoking either reader, and returns 503 when it cannot classify an attempt. This is a deliberate failure, not pre-migration backward compatibility. Do not infer legacy from a missing column or route a v2 attempt through the legacy RPC. **The verified migration/schema must precede the application release and traffic.**

## 1. Preconditions and approvals

1. Identify the release artifact and exact target independently, including environment, project, database identity, traffic path, operator, reviewer and rollback owner. Prevent merge-triggered or other automatic deployment until the gate below is signed off. Keep v2 creation and public finalization disabled. A role or schema check alone does not authorize enabling either.
2. Read `CBT_STAGING_VALIDATION_PREPARATION.md`, `STAGING_VERIFICATION_RUNBOOK.md`, `BACKUP_AND_RESTORE.md`, and the migration/rollback SQL. Obtain separate authorization for any hosted access, migration, staging test, traffic change or restoration. This document does not grant it. Quiesce affected traffic and scheduled jobs as required by the reviewed change plan; preserve existing attempts and offline-work risk. Never use real student attempts as test data.
3. Before changes, obtain a verified backup with a documented recovery point, permissions, encryption and retention under existing policy; independently test restoration to a verified disposable destination, checking representative legacy/v2 attempt, session, answer, roles/grants, triggers and ledger state. Record recovery-time/data-loss limits and who can restore. Stop if backup, restoration, target identity or exclusive access is uncertain. Do not expose credentials in tickets/logs.
4. Capture the exact migration ledger, schema/role/ownership/privilege fingerprints, existing deployment identifier and relevant service health. Reconcile **all 83 files in this release** against that target, not just a row count. Version prefixes `20260903` (six files), `20260919` (five) and `20260920` (three) are duplicated: a version row alone cannot establish each file was applied. Reconcile names, actual definitions and independently recorded prior execution evidence; stop on unresolved drift. Do not fabricate ledger entries, blindly replay history, run `supabase db reset`, or use a blind `supabase db push`.

## 2. Approved migration and order

Review the whole release's dependency graph and effects, not only CBT files. The CBT chain requires the preceding schema, serving rules, frozen-paper planner, privileges and deadline/grace migrations, including `20261022090000_cbt_question_serving_rules.sql`, `20261025120000_cbt_submit_grace_120.sql`, and `20261104120000_cbt_owner_expiry.sql`. Apply the reviewed pending files in their reviewed order, with these four CBT files in this exact order:

1. `20261107120000_cbt_attempt_protocol_fence.sql` — discriminator, role boundary, immutable protocol, question/attempt/answer guards and legacy RPC fences.
2. `20261107130000_cbt_v2_server_lifecycle.sql` — v2 revision, operation ledger and core lifecycle.
3. `20261107140000_cbt_v2_answer_gateway.sql` — restricted answer gateway role.
4. `20261107150000_cbt_single_writing_session.sql` — sessions, leased answer gateway, replacement of earlier unleased gateway and closure of public finalization.

The four are dependent; do not expose traffic in a partially applied state. Applying the column alone is insufficient. Use the reviewed target-specific migration mechanism and record file-level evidence; do not assume duplicate filenames can be pushed with an ordinary version-only ledger. A migration or verification failure means **stop**, preserve evidence, and follow the independently approved recovery plan; do not proceed to app deployment.

Guest practice corrections expose correct choices for attempted questions. Confidential examinations must use a restricted question bank that cannot be reached by public guest-scoring or other unauthorized answer-bearing paths. Such separation is not implemented or tested; do not claim confidential high-stakes readiness. Preserve the existing public-practice correction behavior.

## 3. Database verification — before app deployment

A database reviewer, connected to the independently verified target with appropriate read-only catalog permissions, runs `supabase/ci/production-validation.sql` and reviews every result, especially checks 8 and 9. This script also emits informational data and is not a complete proof of definitions, role membership or history. Do not treat `unresolved`, errors or omitted checks as passes. The following are additional read-only inspection recipes; no question text, answers or user data are needed.

### Ledger and discriminator

```sql
-- Inspect all rows, not merely a count; compare each with the reviewed 83-file manifest.
select version, name from supabase_migrations.schema_migrations order by version, name;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='cbt_attempts' and column_name='protocol';
select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid=to_regclass('public.cbt_attempts') and contype='c';
```

Require the individually reconciled ledger evidence for all four exact CBT files and dependencies; the `protocol` column must be text, NOT NULL, default legacy, with a validated constraint allowing only `legacy` and `v2`. Check the actual definition, not just the constraint name. `20261107150000` supersedes the 140000 five-argument gateway; inspecting the intermediate schema is not sufficient.

### Triggers, indexes and table boundaries

```sql
select c.relname as table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
  and c.relname in ('cbt_attempts','cbt_answers','exam_questions','cbt_exams')
  and t.tgname like 'cbt_protocol_%'
order by c.relname,t.tgname;
select indexname,indexdef from pg_indexes
where schemaname='public' and tablename in ('cbt_v2_writing_sessions','cbt_v2_operations')
order by tablename,indexname;
select c.relname, c.relrowsecurity, c.relforcerowsecurity, r.rolname as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_roles r on r.oid=c.relowner
where n.nspname='public' and c.relname in ('cbt_attempts','cbt_answers','exam_questions','cbt_v2_operations','cbt_v2_writing_sessions');
```

Compare the definitions and owners to the reviewed migration and target fingerprint: attempt and answer row guards; question update/delete guard; truncate guards for attempts, answers, questions and exams must all be enabled with the expected events/functions. Confirm the unique partial active-session index, operation uniqueness/revision constraints, RLS and expected policies. Verify no ordinary application role can modify protected tables or bypass the guard via effective grants/RLS. Trigger names or `relrowsecurity=true` alone do not prove that their bodies, ownership or policies are correct.

### Functions, role ownership and effective permissions

```sql
select p.oid::regprocedure as signature, r.rolname as owner, p.prosecdef,
       p.proconfig, p.proacl, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='public' and p.proname in (
 'cbt_start_configured_internal','start_cbt_attempt_configured','cbt_start_attempt_legacy','cbt_start_attempt_v2',
 'start_cbt_attempt','start_cbt_attempt_for_subjects','get_cbt_attempt_paper','save_cbt_attempt_draft',
 'submit_cbt_attempt_configured','submit_cbt_attempt','submit_cbt_attempt_for_subjects',
 'delete_cbt_practice_attempt','abandon_cbt_attempt','delete_cbt_attempt','cbt_expire_owned_attempt',
 'cbt_protocol_attempt_guard','cbt_protocol_answer_guard','cbt_protocol_question_guard','cbt_protocol_truncate_guard',
 'cbt_v2_transition','cbt_v2_session_gateway','cbt_v2_answer_gateway',
 'cbt_candidate_answer','cbt_candidate_answer_core','cbt_candidate_answer_leased',
 'cbt_candidate_finalize','cbt_candidate_finalize_core','cbt_candidate_finalize_leased')
order by p.oid::regprocedure::text;

select r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolbypassrls
from pg_roles r where r.rolname in ('anon','authenticated','service_role','cbt_v2_client','cbt_v2_executor','cbt_v2_answer_gateway');
select m.rolname as member, r.rolname as granted_role
from pg_auth_members am join pg_roles r on r.oid=am.roleid
join pg_roles m on m.oid=am.member
where r.rolname in ('cbt_v2_client','cbt_v2_executor','cbt_v2_answer_gateway')
order by r.rolname,m.rolname;

-- NULL means the signature is absent and is a failure, not a false privilege.
with checks(role_name, signature, expected) as (values
 ('authenticated','public.cbt_v2_session_gateway(uuid,uuid,boolean)',true),
 ('anon','public.cbt_v2_session_gateway(uuid,uuid,boolean)',false),
 ('service_role','public.cbt_v2_session_gateway(uuid,uuid,boolean)',false),
 ('authenticated','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)',true),
 ('anon','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)',false),
 ('service_role','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)',false),
 ('authenticated','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)',false),
 ('anon','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)',false),
 ('service_role','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)',false),
 ('authenticated','public.cbt_candidate_answer_core(uuid,uuid,integer,bigint,uuid,uuid)',false),
 ('authenticated','public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid)',false),
 ('authenticated','public.cbt_candidate_finalize_core(uuid,bigint,uuid,uuid)',false),
 ('authenticated','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)',false),
 ('service_role','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)',false),
 ('cbt_v2_client','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)',false),
 ('cbt_v2_answer_gateway','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)',false)
), actual as (
 select role_name, signature, expected, to_regprocedure(signature) as object_id,
        has_function_privilege(to_regrole(role_name),to_regprocedure(signature),'EXECUTE') as allowed
 from checks
)
select *, (object_id is not null and allowed is not distinct from expected) as pass
from actual order by signature,role_name;
select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)') is null as obsolete_gateway_absent;

-- PUBLIC grants apply to every role, including future roles.
select p.oid::regprocedure as signature, x.privilege_type
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
where n.nspname='public' and (p.proname like 'cbt_v2_%' or p.proname like 'cbt_candidate_%')
  and x.grantee=0 and x.privilege_type='EXECUTE';
```

Compare **each required signature, body, security-definer setting, fixed search path and owner** to reviewed migrations and approved fingerprints, including legacy start/paper/draft/submit/abandon/delete/expiry protocol refusals. Require `cbt_start_attempt_v2` and session gateway to be owned by `cbt_v2_executor`, and the seven-argument answer gateway by `cbt_v2_answer_gateway`; internal executor/gateway roles must be NOLOGIN/NOINHERIT and must not be assumable by runtime application roles. Inspect transitive as well as direct role memberships and `PUBLIC` privileges. Do not rely solely on `proacl`: evaluate effective `has_function_privilege` and `has_table_privilege` for `anon`, `authenticated`, `service_role` and actual runtime login roles, including inherited grants. Confirm that authenticated can execute only the intended session and seven-argument answer gateways, cannot directly execute core/leased finalization or create v2 attempts; anon and service role cannot execute those gateways; ordinary roles cannot execute internal answer/finalization cores or mutate v2/session tables. `cbt_v2_client` may execute the old unleased signatures only because their final definitions explicitly raise errors; it must not be granted to an application login. The five-argument answer gateway must be absent. Check internal finalization has no browser/application grant; the SQL executor's own authority is not a public finalization path.

Inspect `pg_get_functiondef` for all referenced triggers and functions against the reviewed source and fingerprint, not just existence, name or owner. Confirm actual grants, owners, RLS policies, schema cache and role graph on the target; source audits and disposable rehearsal do not establish them. No v2 creation or application finalization is authorized by this procedure.

## 4. Application deployment and post-deployment checks

Only after the reviewed ledger/schema/permission checks, restore rehearsal, release approval and full required CI succeed may an authorized owner deploy the exact reviewed application artifact. Confirm the application is pointed at the same verified target, the protocol column is visible in its actual PostgREST schema cache, the local-rehearsal flag does not enable v2 on hosted/production, and no app/runtime role has gained v2-creation membership. The deploy system must be configured or operationally controlled to prevent the app going live before these prerequisites; a readiness probe by itself cannot do so.

On separately authorized **disposable staging**, verify real Auth/JWT/PostgREST/role/RLS behavior, owner and wrong-owner legacy paper, legacy draft/reload and guest correction with synthetic content; verify malformed IDs, missing-metadata fail-closed behavior in a separate incompatible disposable target, legacy RPC refusal for v2, safe v2 paper fields and frozen membership, deactivated-bank resume, session/takeover/stale write and recovery/retry. Exercise v2 only under a separately reviewed test path; the production app's guard must not be weakened. Verify public finalization remains unavailable. Capture results and schema cache behavior without logging secrets or answers.

After a separately authorized deployment, observe readiness and relevant error rates without changing student data. Any production test involving users, attempts, scoring or other mutation requires its own authorization and safe test plan; otherwise rely on approved staging evidence and non-mutating operational checks. Confirm guest correction and legacy availability, and verify the exact artifact and target. Do not call this staging validation complete until actual Supabase—not the local compatibility adapter—passes.

## 5. Stop and rollback

Stop or withhold traffic if target identity, backup/restore, ledger, trigger/constraint/function fingerprint, effective privileges, schema cache, readiness, legacy behavior or monitoring is inconsistent. Involve the release and database owners; preserve logs and pending work. A previously approved application artifact may be redeployed only after its compatibility with the **current** database and retained attempts has been reviewed; never use an old client to mutate v2. Application rollback does not undo database migrations.

Do not automatically reverse these migrations. The SQL rollbacks are destructive, outside normal migration replay, and require separate authorization, continuous traffic quiescence and a verified recovery plan. If independently approved, dependency order is session `20261107150000` → gateway `20261107140000` → lifecycle `20261107130000` → fence `20261107120000`. The session rollback refuses existing session history **or** v2 attempts; fence/lifecycle refuse v2 attempts, and role membership can also block rollback. The session rollback temporarily restores the old unleased authenticated answer gateway and restricted-client finalization privilege. Do not reopen traffic or stop at that intermediate state; complete the approved sequence and independently verify the resulting roles, grants, functions and legacy compatibility. Do not erase history/attempts or weaken checks to force it. In-flight destructive rollback safety and hosted restoration are not proven; use the approved backup/restoration plan when appropriate.

No checked-in rollback is provided for `20261031120000_news_placeholder_safety.sql`, `20261102190000_service_request_write_boundary.sql`, `20261102200000_service_request_student_field_boundary.sql`, `20261102210000_service_request_idempotency_candidate.sql`, or `20261104120000_cbt_owner_expiry.sql`. Reversing the four CBT migrations does not reverse these five. Review their data, grants and client dependencies and establish an independently approved recovery plan before applying them; do not invent a rollback or treat backup availability alone as tested restoration.
