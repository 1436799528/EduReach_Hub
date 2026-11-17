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

Sixteen tables plus one view, all additive. Legacy `edureach_sources` was created
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

- **Every published table carries `verification_status` and
  `publication_status` separately.** "Someone checked it" and "we chose to show
  it" are different editorial acts.
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

`src/server/institutionIntelligence.ts`:

| Route | Gate | Behaviour |
| --- | --- | --- |
| `GET /api/institutions/:id/intelligence` | none | public; **filters `verified` + `published` itself** because the server uses the service role and RLS does not apply to it |
| `GET /api/admin/institution-intelligence/review` | `institution.read` | unreviewed evidence, offerings/benchmarks/guides in review, completeness roll-up |
| `PATCH /api/admin/institution-intelligence/evidence/:id` | `institution.update` | records one of four decisions plus a note, audited with the actor |
| `GET`/`PUT /api/student/admission-goal` | `dashboard.access` | one goal per student, always keyed by session identity |
| `POST /api/student/admission-goal/attempts/:id` | `dashboard.access` | links a submitted attempt, ownership enforced by the query |

`pages/AdminInstitutionIntelligencePage.tsx` (`/admin/institution-intelligence`,
capability `institution.read`) is the review queue. It shows the source link before
the claim, disables **Verified** when a row has no source URL, requires a written
note for every negative decision, and labels the coverage table as a gap list
rather than a score.

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
`tests/institution-import.test.ts` (12), `tests/institution-intelligence-schema.test.ts`
(12), plus the existing `migrations`, `rls-posture`, `schema` and `migration-checklist`
suites.

## 6. Known gaps

- **Coverage is 2 of 329 institutions.** 327 have no researched facts; the review
  queue is therefore nearly empty and the coverage table is nearly all zeros. That
  is the honest state, not a defect.
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

## 7. Rollout order

1. Apply `20261117120000` then `20261117121000` to a non-production database
   (`supabase db push` or the CI replay).
2. `npm run institutions:import` (dry run) → `INSTITUTION_IMPORT_ENV=staging … --apply`.
3. Review in `/admin/institution-intelligence`; publish per field.
4. Only then repeat against production, with the migrations applied first and the
   review console staffed. Imports never publish, so a botched batch is reversible
   by deleting rows that nothing public points at yet.
