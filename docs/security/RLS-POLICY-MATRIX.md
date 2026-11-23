# RLS posture: what "enabled with no policies" means here

Supabase's Security Advisor reports tables with **RLS enabled and no policies** as
a warning. In this project that state is, for every table it is reported on,
**intentional**: it is a deny-all posture for data that only the server (service
role) may touch. Adding a permissive policy to silence the warning would create the
vulnerability the warning is trying to prevent.

Verified read-only on the production project on 2026-11-23: every table below has
`rowsecurity = true`, zero policies, **and no table privileges for `anon` or
`authenticated`**, so neither role can read, write or even attempt a row.

## The four categories

| Category | Meaning | Correct action |
|---|---|---|
| Deny-all, server-only | The browser must never query it. The API reads/writes it with the service role, after its own authorization. | Keep as is. Do not add a policy. |
| Public read, server write | Content students may read. | A `SELECT` policy for `anon`/`authenticated` **and** a `GRANT SELECT`; writes stay server-side. Add only if the browser genuinely queries the table directly. |
| Owner-scoped | A student's own rows. | Policy on `auth.uid()`, with `GRANT` for the needed verbs. |
| Obsolete | Nothing reads it. | Drop it in a reviewed migration. |

## Tables reported (public schema)

All nineteen are **deny-all, server-only**. None is obsolete, and none is missing a
policy: each is read or written exclusively through an API route that has already
authorised the caller and uses the service-role client.

| Table | Why it is server-only |
|---|---|
| `admin_audit_logs` | The administrative audit trail. Read by `/api/admin/*`; a client policy would let an administrator (or a compromised administrator session) read or forge audit rows directly. |
| `admin_content_versions` | Editorial history, including unpublished drafts. |
| `cbt_bank_security` | Bank visibility, restricted access and release timing. Client read would disclose embargoed exams. |
| `ccmas_disciplines`, `ccmas_programmes`, `national_programme_catalogue` | Reference catalogues joined server-side into institution and programme responses. |
| `daily_quizzes`, `daily_quiz_questions` | Quiz content and answer keys before release. |
| `document_bank` | Generated-document records tied to individual students. |
| `exam_questions` | Legacy exam answer-key table. Verified: `anon` and `authenticated` hold no `SELECT`. |
| `news_ingest_candidates`, `news_ingest_runs`, `news_sources` | Newsroom pipeline state, including rejected candidates and crawler configuration. |
| `question_import_items`, `question_imports` | Import staging for the question bank, including unapproved questions. |
| `rate_limit_hits` | Rate-limit bookkeeping; client access would let a caller erase their own hits. |
| `service_guides` | Service workflow copy, joined into `/api/services/*` responses. |
| `site_analytics_events` | Aggregated analytics with per-event paths; the admin console reads aggregates, not rows. |
| `site_page_revisions` | Pre-publication page revisions. |

## Other schemas

- `auth.*` (17 tables) and `private.*` (4 tables: institution research staging and
  batches): deny-all by design. `private` is not exposed through PostgREST at all.
- `realtime.messages`: RLS enabled with no policy. This application does not use
  Realtime subscriptions, so deny-all is correct.

## Tables that are readable by design

`institutions`, `news_articles`, `opportunities`, `site_settings`, `site_pages`,
`courses`, `cutoff_marks` and the institution catalogue tables have read policies
for `anon`/`authenticated`; writes are staff-gated by policy **and** by
`SECURITY DEFINER` guard triggers (`prevent_role_escalation`,
`prevent_question_moderation_escalation`, `guard_resources_update`,
`guard_profile_role`). `site_settings` holds four public keys only — `brand`,
`contact`, `footer`, `social` — and no administrative configuration.

## Functions

`SECURITY DEFINER` functions are the other half of the posture: a policy is checked
before a function runs, and a function runs with the caller's rights *unless* it is
`SECURITY DEFINER`. Every such function in this project:

- pins `search_path` (empty, `pg_catalog`, or `pg_catalog, public`);
- resolves the caller from `auth.uid()` and refuses when there is no caller or the
  row is not theirs;
- is granted to `authenticated` and/or `service_role`, not to `PUBLIC` or `anon`.

The 2026-11-23 audit found three exceptions (two puzzle-shaped helpers and one
trigger function that were executable by `anon`) and two functions without a pinned
`search_path`. They are corrected by
`supabase/migrations/20261123150000_security_boundary_hardening.sql`, which changes
grants only. `supabase/ci/production-validation.sql` section 11 now checks the
property directly, so a regression is a failed deployment check rather than a
warning nobody read.

## Verifying

```sql
-- read-only; paste into the Supabase SQL editor
select schema, table, anon_select, auth_select
from (
  select n.nspname as schema, c.relname as table,
         has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
         has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and c.relrowsecurity
    and (select count(*) from pg_policy p where p.polrelid = c.oid) = 0
    and n.nspname = 'public'
) t order by table;
```

`npm run rls:audit` covers the repository side of the same question.
