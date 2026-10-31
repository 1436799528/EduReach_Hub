# Launch audit baseline — 31 October 2026

This is a **partial audit**, not a release approval. Repository inspected at main
`b2e0a6c8c32d017eabbaa6572976c81a19efcc2c`; work is on
`arena/258c802c-edureach-hub`. Existing detailed audit history and staging
procedures are in `docs/audit/VERIFICATION-AUDIT.md` and
`docs/operations/STAGING_VERIFICATION_RUNBOOK.md`. Do not infer live behaviour
from their historical results.

## Coordination and release status

- Main was fetched; the session branch began at its tip. Open PR #31 changes
  secret-key precedence; PR #32 covers privacy preferences and refund content.
  Neither changes dependencies. PR #32 was not draft when inspected despite its
  description requesting draft status; its quality gate and Netlify preview
  checks reported failure. Its separate `pages/RefundPolicyPage.tsx` needs review
  against the owner's requirement to extend the existing administrator-managed
  policy system (`site_pages`, `pages/LegalPage.tsx`, `pages/AdminSitePage.tsx`),
  rather than establish a second static policy source. No PR was modified.
- No release, merge, deployment, production DDL or data write was performed.
  Netlify project state, credits, and current live deployment were not verified.
- The connected Supabase account lists the production project as active and
  `EduReach-Hub-Staging` as inactive. No staging restoration was requested. The
  local process has no configured Supabase credentials and sandbox egress does
  not include Supabase; the management connector allowed limited metadata reads.

## Security dependency repair audit

| Item | Evidence / decision |
| --- | --- |
| Existing implementation | npm lockfile and `npm run audit:ci`; no new dependency or security tooling. |
| Location | `package-lock.json`, `package.json`, Express JSON parsers in `server.ts` and `src/server/question-import/routes.ts`; Vite build and jsdom-based tests. |
| Duplicate check | Open PRs #31 and #32 do not change the lockfile. |
| Current behaviour | Before repair `npm run audit:ci` reported four vulnerable packages: body-parser and undici high, qs and Vite moderate. Advisory severity alone does not establish exploitability in this application. |
| Gap | Locked releases fall within current npm advisory ranges. |
| Classification / solution | **Repair:** compatible lockfile-only updates: body-parser 1.20.8 → 1.20.9, qs 6.16.0 → 6.16.2, undici 8.11.2 → 8.12.3, Vite 6.4.4 → 6.4.5. No new direct dependency, package range or major-version change. |
| Impact | Server request parsing, test-only jsdom's HTTP dependency, and Vite build/dev tooling. No schema, data, design or integration change. |
| Verification | Clean `npm ci`; typecheck; unit suite; build; performance, analytics, schema, migration, RLS, accessibility and npm audits. Browser and hosted integration gates remain outstanding below. |

## Findings requiring follow-up

1. **Privacy and consent — open.** On the inspected main, `src/lib/api.ts`
   `trackEvent` sends first-party events without an opt-in check; page views and
   other event paths call it. The analytics taxonomy audit verifies event and
   retention consistency, **not consent**. PR #32 proposes consent controls but
   must be reviewed for all transmission paths, persistence failures, accessible
   settings, and no retrospective transmission before merging. Privacy/terms,
   age eligibility, data mapping, deletion, provider inventory and Nigerian
   legal review remain unverified.
2. **Production schema drift — open.** Read-only `pg_class` metadata returned
   86 public ordinary/partitioned tables, all with RLS enabled. This does not
   prove the policies, grants or functions are safe. Targeted `to_regclass`
   checks found no production tables named `student_notifications`,
   `student_saved_items`, `student_cgpa_courses`, `student_cgpa_terms`,
   `student_security_events`, `student_wallets`, `student_wallet_transactions`,
   `admin_audit_logs` or `payment_events`; the offline RLS audit classifies those
   names in its replayed schema. Whether corresponding application features are
   used or fail requires further investigation. Do not assume these tables should
   simply be created: reconcile existing production equivalents and migration
   history first. The production migration ledger was read, but has not been
   comprehensively reconciled with repository files.
3. **Service workflow — open.** `src/lib/api.ts` inserts service requests directly
   via Supabase, while `pages/ServiceApplyPage.tsx` validates fields in the client.
   The checked-in migration `20261016160000_reconcile_live_catalogue_and_service_request_contract.sql`
   requires an active catalogue entry in the insert policy; read-only live
   `pg_policies` metadata showed `service_requests_insert_own` checks user and
   submitted status but not the active-service condition. Validate backend/data
   constraints, ownership, duplicate handling and live migration drift in staging.
   `server.ts` validates admin status transitions after reading a request, then
   updates by id without an old-status condition; concurrent administrative
   updates may overwrite a transition and produce misleading audit/notification
   history. This is a code-review finding, not a reproduced live incident.
4. **CBT and accounts — incomplete verification.** Existing setup and database
   migrations include JAMB English and 180/120/60+40 rules, plus separate
   simulator configurations and owner-scoped attempt mechanisms. Unit and
   database-replay tests are useful but do not prove a real authenticated session,
   recovery, grading or role isolation against staging or production.
5. **Accessibility, PWA, email, licensing, privacy rights and production** —
   incomplete. Static accessibility audit is not a manual WCAG 2.2 AA review;
   automated browser checks, keyboard/screen-reader checks, installation,
   communications delivery, vendor/asset licensing, legal review and live release
   verification remain to be done.

## Verification in this session

| Check | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed after lockfile update. |
| `npm run typecheck` | Passed. |
| `npm test` | 749 passed, 0 failed after the update. |
| `npm run build` | Passed as an unconfigured preview build, **not a production integration build**. |
| `npm run perf:audit` | 10/10 passed. |
| `npm run analytics:audit` | Passed taxonomy and 90-day consistency checks; does not establish consent or actual retention job execution. |
| `npm run schema:audit`, `npm run migrations:checklist` | Passed offline; 74 migration files listed. |
| `npm run rls:audit` | 50/50 replayed public tables classified, no findings; not a production policy audit. |
| `npm run a11y:audit` | 0 blocking, 5 informational; static only. |
| `npm run audit:ci` | 0 reported vulnerabilities after the update. |
| `npm run ci` | Baseline stopped at Playwright because the Chromium executable was absent. The full gate was not passed. Post-update browser and mobile performance suites were not run. |
| `npm run prod:validate` | Failed local environment requirements; live connectivity skipped. This says nothing about production's configured secrets. |
| Supabase management metadata | Health endpoint reported services healthy; read-only schema/policy checks above. Health is not end-to-end verification. |

## Placeholder population inventory — 31 October 2026

This is an initial inventory, not a claim that every existing row has been
reviewed. Production counts below were obtained using read-only aggregate queries;
no production data or configuration was changed. The application has no
central, consistently enforced `is_placeholder` / `placeholder_note` mechanism
on the inspected content tables. Placeholder counts cannot be inferred from
ordinary content counts.

| Area and consumers | Existing source / admin surface | Observed state and safe action |
| --- | --- | --- |
| Homepage updates and news (`/`, `/news`) | `news_articles`; `/admin/news`, existing generic content manager | 24 production rows (15 published, 9 unpublished). Review existing records first; clearly identified placeholders must remain unpublished until there is an enforced safe editorial process. Homepage composition and tool links are currently code-owned. |
| Scholarships, jobs and grants (`/jobs`) | `opportunities`; `/admin/opportunities` and content manager | 2 rows (1 active). Avoid inventing sponsors, eligibility, deadlines or links; use inactive draft placeholders only once admin identification and publishing safeguards are designed. |
| Services and instructions (`/services`, forms) | `service_catalog`, `service_guides`; `/admin/services` | 24 services (4 active), zero database guide overrides. Public form pages fall back to built-in `src/data/serviceGuides.ts` if no published override exists. Admin can edit guide overrides; a draft override is hidden from the public. Audit the existing guide and image provenance before copying or replacing it. |
| CBT exams / subject choice | `cbt_exams`, `cbt_subject_catalog`, `exam_questions`; `/admin/cbt`, import tools | 7 exam rows (4 active), 310 active subject rows, 1,610 question rows. Counts do not establish availability, rights, accuracy or verified provenance. Do not create fake exam questions; audit subject-catalogue admin coverage separately. |
| Past papers and learning documents | `document_bank`, `past_question_resources`; `/admin/pdf-bank` and question import | Both tables have zero rows. A real, appropriately licensed file and source verification are required; a fabricated storage path is not a usable placeholder. |
| Calendar / announcements | `edureach_deadlines`, `edureach_exams`; `/admin/content` | 5 deadline records and 0 exam-event records. Do not invent dates. Inspect visibility/status enforcement and user relationships before seed design. |
| Institution information | `institutions`; `/admin/schools` and content manager | 329 rows. Do not create fictitious institutions or accreditation. Verify record-level provenance and referenced relationships before editing or deletion. |
| Privacy, terms, cookies, accessibility, disclaimer, contact | `site_pages`, `site_page_revisions`, `site_settings`; `/admin/site` | Six pages are published and marked `review_state = pending`; four settings rows. Legal review is not confirmed. Refund is absent from the existing policy slugs and is being addressed separately in open PR #32; its static-page approach requires coordination with the existing CMS. Do not overwrite policies or contacts. |
| FAQs, support, about and other homepage text | `pages/ComingSoonPage.tsx`, `pages/HubHomePage.tsx`, site settings and product configuration | `/support` is a coming-soon route; no verified independent FAQ/about database CMS was established in this audit. Avoid inventing a separate system or implying the feature is complete. Examine actual needs and extend an existing store only where justified. |
| Notifications and student dashboard | `student_notifications` in repo code; dashboard | Production metadata reports the table absent. Notifications, accounts, requests, attempts, results, saved items and transactions are genuine user data, not seed targets. Reconcile schema rather than creating fake activity. |
| Forms, authentication and calculators | Existing code, profile and operational records | Real configuration/ownership and test accounts are required; placeholders cannot establish that workflows function. Do not create fake students or requests. |

**Existing management limitations:** schema metadata shows no common placeholder
fields in the inspected content tables. Existing admin operations differ by
resource; central search/filter, safe replacement, publication checks, destructive
confirmation and persistence need per-path verification. The generic content
manager is an additional write path that must be considered when designing any
publication guard. Draft states alone do not prove placeholders cannot be
accidentally activated. Deletion must be evaluated against foreign keys and real
user records; a generic delete-all operation would be unsafe.

**Environment:** `EduReach-Hub-Staging` is inactive as of this check. PGlite
migration replay is available for isolated PostgreSQL tests but is not a hosted
Supabase project and cannot verify real Auth, Storage, RLS behaviour or an admin
browser session. Staging restoration and any resulting cost need owner approval.
No placeholders were inserted during this audit. A production seed must be
reviewed and separately approved, idempotent, non-overwriting, and must not run as
part of ordinary migrations or deploys.

**Owner input required:** verified support and privacy contact channels; operator
identity and legal review; authentic announcements/opportunities and their
sources, terms and dates; rights-cleared learning documents and exam content;
verified service instructions and screenshots; and decisions on which existing
code-owned areas should become editable. Avoid placeholder email addresses,
fictional partnerships, payments and fabricated student activity.

### News-only implementation prepared locally

**Classification:** extend the existing `news_articles` table and Newsroom CMS;
no new content system. The optional seed proposes exactly one unpublished editorial
prompt, explicitly labelled `[PLACEHOLDER]`, requesting a verified update and
source. It has **not** been applied to any hosted project.

**Safety and limits:** `20261031120000_news_placeholder_safety.sql` adds marker
and note columns with a database check that marked rows remain unpublished and
have a note. Existing rows default to unmarked, not automatically classified.
The Newsroom PATCH API requires the boolean `confirm_placeholder_replacement` to
clear a marker and requires saving the replacement as a draft before publication.
The confirmation records the editor's assertion; it cannot prove the content is
real or verified. The generic manager rejects marker fields, while the database
check blocks publication of a still-marked article through any writer. A privileged
SQL writer can still clear the marker; access and change review remain essential.

A `BEFORE DELETE` trigger checks referencing foreign keys for marked rows and
blocks deletion if linked rows exist; unknown composite/non-ID references fail
closed. The trigger uses a security-definer function with a fixed search path;
the migration owner must be able to read every referencing table despite RLS.
Existing ordinary unmarked news deletion behaviour is unchanged. PostgreSQL
concurrency/isolation and hosted permission/RLS behaviour have **not** been
verified; conduct the concurrent-link/delete rehearsal below before relying on
this in production. Do not disable the guard or delete related genuine records to
make a seed or rollback succeed.

The Newsroom lists 50 records per page with server-side state filtering and title
search, ordered by `updated_at DESC, id DESC`; `Next` uses a lookahead. This
covers more than 200 records in a static dataset. Offset pages are not a snapshot:
concurrent edits/inserts/deletes can move rows between pages, so refresh and
repeat an inventory while writes are paused. The existing PDF selector retains
its prior first-200 behaviour. Manual browser and hosted CRUD are unverified.

**Migration/deployment/recovery plan — review only, not authorization to run:**

1. Reconcile the hosted migration ledger and schema first; this is already a
   release blocker. Confirm `news_articles` has UUID primary key `id`, unique
   `slug`, non-null `published` and `updated_at`, and that proposed column,
   constraint, trigger and function names do not collide with incompatible
   objects. `ADD COLUMN IF NOT EXISTS` does not repair incompatible existing
   definitions. Inventory *all* FKs referencing news, their delete actions,
   RLS, trigger-owner permissions and operational effects. At the read-only
   2026-10-31 inspection, production had the expected ID/slug/published/updated
   fields, no marker columns or same-name function/trigger, and three news-ID
   FKs on `document_bank` and `news_ingest_candidates` using `SET NULL`.
   This partial metadata check is not full production compatibility or ledger
   verification; repeat preflight at deployment time. Check current contents and
   both the seed UUID and slug for collisions, plus any other unique constraints.
2. Verify restorable backups and rehearse the exact migration, seed, normal and
   rollback workflow against a disposable hosted Supabase copy with approved
   access. Test real Auth, RLS, storage, anonymous visibility, generic manager,
   dedicated API, UI refresh, and concurrent reference creation/deletion under
   the transaction isolation levels actually in use. Staging remains inactive
   per owner instruction; local PGlite and mock PostgREST cannot prove these.
3. After independent review, CI, preview and explicit migration authorization,
   apply the migration first via the established ledger-aware deployment process.
   It inserts no content. Verify both column definitions, the exact check
   constraint, trigger/function owner and privileges, FK inventory, news counts
   and publication statuses, and public visibility before deploying the new
   application. New server code selects the new columns and is incompatible with
   an old schema; old application code can run against the additive schema but
   cannot show or deliberately replace markers. Keep editors out during the
   transition and stop if verification fails.
4. Only after **separate approval for this particular row**, run the optional
   seed manually. It uses stable ID `c1e1aedc-8c48-4a6a-a3ea-431ac7856918`
   and `ON CONFLICT DO NOTHING`: either ID or slug collisions are skipped, not
   overwritten, including after a replacement changes its slug. Deleting the row
   permits a later explicit seed to recreate it; never schedule automatic seed
   replay. Check exactly what happened and verify anonymous invisibility.
5. On application failure, freeze relevant editorial writes and roll the app
   back to the previous verified version while **retaining the additive schema,
   check and delete guard**; old UI cannot identify placeholders, so do not resume
   placeholder management there. Verify normal news reads and publication status.
   Do not drop marker columns, constraint or guard while data or new code depends
   on them. A schema reversal or backup restore is a separate, reviewed operation
   with dependency inventory, data preservation, explicit approval and rehearsed
   recovery; removing the guard would re-enable `SET NULL` link changes.

**Local verification:** a PostgreSQL-engine PGlite replay inserts genuine published
and draft fixtures *before* the migration and compares every original field and
status afterward. It checks public-role invisibility, constraint enforcement,
seed reruns, changed slugs, genuine ID/slug collisions, and linked
`document_bank`/`news_ingest_candidates` deletion refusal without changing those
rows or genuine news. Mock API tests check confirmation, manager/import rejection,
authorization, filters and traversal of 235 static articles. These tests do not
prove hosted PostgREST, multi-session races, effective production RLS or UI
persistence. The full local suite passed 753/753 before the final UI and test
refinements; afterward, 46 focused tests, typecheck, preview build, performance
and migration checklist passed. The prior analytics, schema, offline RLS, static
a11y and dependency audits also passed. Browser tests remain blocked by missing
Playwright Chromium; no hosted deployment or seed was performed.

## Release gates

Resolve the existing PR overlap and failing checks; restore or provide an
appropriately isolated staging environment with authorization; reconcile live
schema and migration ledger without blind DDL; run authenticated student/admin,
service, CBT, storage and failure-mode journeys; complete consent, deletion,
legal and accessibility reviews; run the complete CI suite and an approved
Netlify preview; only then consider merge and production verification. No claim
of compliance, security certification or launch readiness is made here.
