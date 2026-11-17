# Institution intelligence (BASE-3) — implementation record

Status: **schema, importer, API and review console implemented; nothing imported
or published in production.** The two migrations in this work are additive and
unapplied to production.

This document records what was built, why each decision was made, what the system
refuses to do, and what an operator still has to do. It is the companion to
`docs/data/INSTITUTION-DATA-FOUNDATION.md` (the design) and
`docs/data/INSTITUTION-COVERAGE.md` (the generated coverage report).

## 1. What exist today that this had to work around

Production (`gjdfatwcoosyuhakrrhh`) holds 329 institutions across 37 states, all
with `institution_type = 'university'`, all `is_verified = true`, one website URL,
one admission portal, no student portal, no `cutoff_marks`, no
`institution_course_offerings`, 28 faculties, 33 departments, 33 programmes and 17
`edureach_sources` rows. The live `institutions` table has 16 columns against the
repository's 7, so the local schema is a subset of production — every new
migration therefore extends, never redefines.

Consequences that shaped the design:

- `is_verified` means "someone ticked the identity", not "someone checked a
  threshold". It is never used as evidence of research.
- A single `school_name` and a single website cannot carry leadership, campuses,
  units, offerings, routes, requirements, benchmarks and guides. Those need their
  own tables, each fact with its own source and its own review state.
- Production has no `programmes` FK to hang offerings on, so the offering table
  stores its own `programme_name`, `award_level` and optional
  `national_programme_code`, and `programme_id` stays nullable with **no FK**: a
  reconciliation job compares rows instead of the database refusing an insert.

## 2. Schema (migration `20261117120000_institution_intelligence.sql`)

Sixteen tables plus one view, all additive. The migration explicitly extends the hosted legacy `institution_profiles` table; `CREATE TABLE IF NOT EXISTS` alone does not upgrade an existing table. Legacy `edureach_sources` was created
back in the prototype and exists in production; the migration creates it only when
absent, inside a `do` block guarded by `to_regclass`, so replaying on production
leaves it and its policies untouched.

| Area | Tables |
| --- | --- |
| Identity | `institution_aliases` |
| Profile | `institution_profiles` |
| Leadership | `institution_leadership` |
| Structure | `institution_campuses`, `institution_academic_units` |
| Offerings | `institution_programme_offerings` |
| Admission | `institution_admission_routes`, `institution_programme_requirements` |
| Benchmarks | `institution_admission_benchmarks` |
| National policy | `national_admission_policies` |
| Guides | `institution_portal_guides`, `institution_portal_guide_steps` |
| Provenance | `edureach_sources`, `institution_fact_evidence` |
| Student | `student_admission_goals`, `student_admission_goal_attempts` |
| Reporting | view `institution_intelligence_completeness` |

Design points worth keeping:

- **Verification and publication are separate editorial acts.** The legacy `institution_profiles.profile_status` completeness field is preserved, while the new `publication_status` controls visibility. Existing rows default to `draft`.
- **Benchmarks carry their own scale** (`benchmark_value`, `score_scale_min`,
  `score_scale_max`, `value_unit`) and never share a column with a UTME score.
  Aggregates are 0–100, UTME scores 0–400, and the schema will happily store both
  because they are different rows with different scales — the reader, not the
  column, is what stops them being compared.
- **`minimum_utme_scale` defaults to 400** on requirements, because a UTME minimum
  without a stated scale is unreadable.
- **`institution_fact_evidence` is the audit trail of claims**: entity, field,
  claimed value, source URL, applicable session, review state, reviewer and note.
  A field cannot become verified without a row here saying who checked what.
- **No implicit merge.** The Calabar duplicate
  (`1e7e9cdd-…` / `255e4ba4-…`) is resolved by an alias row; no delete, no merge.
- Branded `check` constraints only (e.g. `institution_profiles_verification_status_check`)
  so tests and operators can name what failed.
- RLS: public reads are limited to verified + published rows; writes are staff-only
  through `public.is_staff(auth.uid())`; `authenticated` never receives broad write
  grants (`scripts/rls-posture.ts` fails the build otherwise).

Migration `20261117121000_institution_import_function.sql` adds
`public.institution_import_apply(p_payload jsonb, p_dry_run boolean default true)`:
one transaction, all-or-nothing, returning per-table insert/update/skip counts and
rejections. A dry run raises the sentinel `P0001 __INSTITUTION_IMPORT_DRY_RUN__` and
returns its report through `pg_exception_detail`, so nothing is written even if a
later statement was wrong.

## 3. Importer

- `scripts/institutions/researchBatch.ts` — validates and normalises a batch:
  source keys resolved from an institution's own sources first, then the admission
  portal host, then the website host, with known landing paths (`/home.php`,
  `/about.php`); unresolved institution names are **blocking**, because importing
  around them would create orphan research.
- `scripts/institutions/importResearchBatch.ts` — dry run by default; `--apply`
  requires `INSTITUTION_IMPORT_ENV=development|staging`, non-production
  `NODE_ENV`, and a target ref that is not the hard-coded production ref.
- `scripts/institutions/coverageReport.ts` — writes
  `data/institutions/coverage-report.json` and `docs/data/INSTITUTION-COVERAGE.md`.

Batch 001 (University of Calabar, FUHSI) produced: 17 sources, 2 profiles, 4
leadership offices, 27 academic units, 14 offerings, 4 admission routes, 2
programme requirement sets, 105 benchmarks, 4 portal guides, 8 national policies.
The only rejections are units whose name does not state their official type
(UNICAL Library, Non-Teaching; FUHSI Allied Health Sciences, Basic Medical
Sciences, Sciences) — the importer refuses to infer "faculty" from a name.

## 4. API and console

`src/server/institutionIntelligence.ts` is the single institution API. Every
public list names its own filters because the server uses the service role and
RLS does not apply to it; every admin response is `Cache-Control: private, no-store`.

| Route | Gate | Behaviour |
| --- | --- | --- |
| `GET /api/institutions/:id/intelligence` | none | public; assembled once, cached (below), **filters `verified` + `published` per table itself** |
| `GET /api/admin/institution-intelligence/review` | `institution.read` | evidence awaiting review, offerings/benchmarks/guides in review, completeness roll-up, headline summary, filter options |
| `GET /api/admin/institution-intelligence/institutions` | `institution.read` | the filtered institution list, one row per institution with its checklist |
| `GET /api/admin/institution-intelligence/institutions/:id` | `institution.read` | everything an editor needs for one institution in one response (profile, units, programmes, routes, requirements, guides, evidence, sources, reviewers, checklist, gate state) |
| `GET /api/admin/institution-intelligence/cache` | `institution.read` | process-local cache counters and the response policy |
| `PATCH …/institutions/:id/profile` | `institution.update` | one section at a time (`identity`, `history`, `portals`, `images`, `verification`); identity also patches the directory row; only the changed fields are written |
| `POST …/institutions/:id/units`, `PATCH …/units/:id` | `institution.update` | one academic unit per save, with parent/type/slug collision checks |
| `POST …/institutions/:id/programmes`, `PATCH …/programmes/:id` | `institution.update` | one programme per save, with its own verification and publication |
| `PATCH …/routes/:id` | `institution.update` | one admission route; a closing date cannot precede an opening date |
| `PATCH …/requirements/:id` | `institution.update` | one requirement set; a minimum score cannot exceed its scale |
| `PATCH …/evidence/:id` | `institution.update` | a decision, a note, or a replacement source — never a deletion |
| `GET`/`PUT /api/student/admission-goal` | `dashboard.access` | one goal per student, keyed by session identity |
| `POST /api/student/admission-goal/attempts/:id` | `dashboard.access` | links a submitted attempt, ownership enforced by the query |

`src/server/institutionAdmin.ts` holds the pure rules the handlers call:
`publicationGate`, the seven verification states, the four publication states,
the section allowlists, the unit/route/requirement validators, the checklist and
the queue filters. They are tested directly in
`tests/institution-admin-rules.test.ts`.

### 4a. The publication gate is enforced twice

`publication_status = 'published'` requires `verification_status = 'verified'`.
Verification is a statement about evidence; publication is a statement about who
may see it, and the second is refused until the first is true.

1. **In the API** — `publicationGate()` returns `409 { gate: true }` with a
   sentence naming the blocking status.
2. **In the database** — `20261118120000_institution_review_gate.sql` adds
   `public.enforce_institution_publication_gate()`, a `before insert or update`
   trigger on the seven tables that have a publication axis: profiles, programme
   offerings, admission routes, programme requirements, admission benchmarks,
   portal guides and national policies. It raises `check_violation`.

The trigger body reads the row as `jsonb` rather than a typed field, so it is a
no-op on tables with no publication axis. Academic units, leadership, campuses
and aliases are public exactly when verified — there is no second decision to
gate, and a typed body there would have broken every unit write.

### 4b. Cache

| Response | Policy |
| --- | --- |
| public institution intelligence | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` |
| every admin read/write, every student read/write | `private, no-store` |

`src/server/publicCache.ts` provides the assembly cache: one keyed entry per
institution (`institution:{id}:intelligence`), single-flight loading so a cold
cache cannot stampede the database, and stale-while-revalidate inside a ten
minute window. A payload with no published profile is deliberately **not**
stored, so an empty public page cannot outlive the publish that fills it. Any
edit that changes the public page (profile section, unit, programme, route,
requirement, evidence decision) calls `invalidateInstitutionCache(id)`.

### 4c. Console

`pages/AdminInstitutionIntelligencePage.tsx` (`/admin/institution-intelligence`,
capability `institution.read`) is the review centre:

- headline counts for the batch, computed from the rows (zeros are shown as zeros);
- filters for search, institution, state, type, verification, publication,
  admission session, missing information and source availability, applied on the
  server;
- restrained per-section indicators (✓ / ⚠ Review / ⚠ Missing) on each row and in
  the editor header — no warning banners, no score;
- the evidence queue, which disables **Verified** when a row has no source URL and
  requires a written note for every negative decision;
- the coverage table, labelled as a gap list rather than a score.

`src/components/admin/InstitutionReviewEditor.tsx` (lazy-loaded, staff-only) is the
ten-section editor: identity, history/overview/mandate, website and portals,
images, academic units (Faculty → Department → Programme), programmes, admission
routes, entry requirements, sources and evidence, verification and publication.
Each section saves on its own, each programme and unit is edited as its own row,
and the forms are structured fields — there is no raw JSON anywhere in the UI.

## 5. The honesty contract

`src/lib/admissionGoal.ts` is pure and DB-free so the rules can be tested directly:

- practice scores stay on 0–100; `gapToTargetPoints` is `target − average` in
  percentage points;
- an attempt is matched only when the programme's published `utme_subjects` exist;
  otherwise the result is `requirements_unavailable`, never a partial match;
- unmatched attempts never enter the average;
- there is no probability, likelihood or admission-chance field anywhere, and no
  `* 4` projection from practice percentage to a UTME score;
- `describeBenchmark` always prints `value of min–max` plus the session and the
  category, so a 200 on a 0–400 scale can never be read as a 0–100 aggregate.

Tests: `tests/admission-goal.test.ts` (8), `tests/institution-review-ui.test.ts` (7),
`tests/institution-admin-rules.test.ts` (14), `tests/institution-review-server.test.ts`
(11, real handlers against a contract stub), `tests/institution-review-gate.test.ts`
(8, PostgreSQL via PGlite), `tests/public-cache.test.ts` (10),
`tests/institution-import.test.ts` (12), `tests/institution-intelligence-schema.test.ts`
(12), plus the existing `migrations`, `rls-posture`, `schema` and
`migration-checklist` suites.

## 6. Known gaps

- **Coverage in the database is 2 of 329 institutions.** Registry identity facts
  (ownership, year established, official website, the vice chancellor as listed)
  are now researched for **327 of 329** and sit in
  `data/institutions/research-batch-002-registry.json` — see
  [`docs/data/NIGERIAN-UNIVERSITY-REGISTRY-2026-11.md`](../data/NIGERIAN-UNIVERSITY-REGISTRY-2026-11.md).
  They are **not imported**, and would land in review if they were: a fact the
  regulator publishes is `discovered`, not verified. The review queue is still
  nearly empty because nothing has been loaded.
- **Student-facing goal UI is not built.** The API and the honesty layer exist and
  are tested; the dashboard has a card, not a goal editor.
- **No institution has been imported anywhere yet.** The dry run is green; the
  apply step needs a non-production database with both migrations applied first.
- **JAMB IBASS combinations cannot be scraped.** `ibass.jamb.gov.ng` and the
  eligibility checker are form-driven; subject combinations must be captured as
  evidence per institution, programme and cycle.
- **National policy floors are recorded, not compared.** `national_admission_policies`
  holds JAMB/NUC minimums with their own units; no code path mixes them with an
  institution threshold.
- **`cutoff_marks` and `institution_course_offerings` remain empty in production**
  and are deliberately untouched: they are unreviewed legacy surfaces, and the new
  tables supersede them rather than migrate their contents.
- **The public institution payload carries no images.** `logo_url` and
  `hero_image_url` exist on the admin profile view only
  (`src/lib/institutions/{types,repository}.ts`). The review editor previews both
  through the shared image component, but a public profile cannot show a logo
  until the public payload gains the fields and a publication rule for them —
  an API change, not a component change, so it was not folded into this stage.
- **News cards and the article hero moved to the shared image pipeline** (see
  [`docs/features/NEWS-3-NEUTRAL-CARDS.md`](NEWS-3-NEUTRAL-CARDS.md)); the other
  16 raster `<img>` sites still build their own markup. They each declare a
  loading strategy, which is what the perf audit checks, but they do not get the
  CDN's AVIF/WebP variants yet.
- **Performance is build-time only.** Budgets and the current measurements are in
  [`docs/operations/PERFORMANCE.md`](../operations/PERFORMANCE.md); no field
  (Core Web Vitals) data has been collected, because no browser runs in this
  sandbox.

## 7. Staging verification (2026-11-17)

The dedicated non-production staging project has both migrations applied. Its
Supabase recorded execution-time versions `20261117093002` and `20261117093004` in its staging ledger. The canonical repository filenames remain `20261117120000` and `20261117121000` so the project migration checklist and production release tooling retain their established ordering. The migration DDL is idempotent; a later repository-driven staging push may replay it safely. The public institution
directory baseline (329 identity rows and basic portal metadata) was copied from
production with `is_verified=false`; no research profiles, sources, admission
facts, user data or media were copied.

A transactional importer smoke test used the first research batch's 17 source
records and two institution profile records in dry-run mode. The database
reported 17 source inserts and 2 profile inserts, zero rejections, and then
rolled back. Counts before and after remained 0 sources and 0 profiles. This
proves the function accepts the profile payload shape without committing it.
No other research entities were imported.

The review centre (stage 1–3 of this round) is written and rehearsed locally, not
deployed: `20261118120000_institution_review_gate.sql` has been replayed against a
fresh PGlite database by `npm test` and by `tests/institution-review-gate.test.ts`,
but it has **not** been applied to staging or production. `INSTITUTION_INTELLIGENCE_DEPLOYED.applied`
therefore stays `false`, and no institution, programme, unit or fact has been
published anywhere.

## 8. Rollout order

1. Apply `20261117120000`, `20261117121000`, then `20261118120000` to a
   non-production database (`supabase db push` or the CI replay). The third file
   is additive: review columns, the publication-gate triggers on seven tables,
   six review indexes and the `security_invoker` `institution_review_overview`
   view (granted to `service_role` only). It adds no policy and changes no status
   value.
2. `npm run institutions:import` (dry run) → `INSTITUTION_IMPORT_ENV=staging … --apply`.
3. Review in `/admin/institution-intelligence`; publish per field.
4. Only then repeat against production, with the migrations applied first and the
   review console staffed. Imports never publish, so a botched batch is reversible
   by deleting rows that nothing public points at yet.
