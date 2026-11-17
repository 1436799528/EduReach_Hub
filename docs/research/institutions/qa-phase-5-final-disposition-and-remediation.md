# Institution QA — Final Disposition and Consolidated Remediation

**Repository:** `1436799528/EduReach_Hub`  
**Branch:** `data/institution-intelligence-foundation`  
**Audit date:** 17 November 2026  
**Scope:** Institution inventory rows 1–329, NUC identity reconciliation, Calabar database dependencies, targeted application references, production migration provenance, and a safe remediation plan.

## Executive decision

The institution research pass and the currently executable QA phases are complete. The inventory contains 329 database rows, while the current NUC nationwide directory table reports 328 universities. The strongest explanation for the one-row difference is a duplicate Calabar identity:

- **Retain as canonical:** `University of Calabar`, UUID `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc`, acronym `UNICAL`, slug `university-of-calabar`.
- **Treat as a duplicate alias candidate:** `University of Calabar, Calabar`, UUID `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967`, no acronym, slug `university-of-calabar-calabar`.

The secondary record has no dependent rows in the 25 direct institution-FK relationships checked. The canonical record has 68 direct dependent rows and a populated academic-content hierarchy. The recommended outcome is to canonicalize the directory display and route resolution while preserving the old label and slug as an alias. Do **not** delete either database row as part of this audit.

No production data, schema, application code, or migration history was changed.

## Consolidated phase results

### Phase 1 — Structural inventory audit

- All 329 inventory rows parsed successfully.
- All rows had non-empty school name, state, institution ID, and generic institution type.
- No duplicate UUIDs were found.
- No exact duplicate normalized institution names were found.
- One strong semantic duplicate candidate was identified: the two University of Calabar rows.
- The inventory has 37 distinct state/FCT labels.
- The schema has no ownership field; `institution_type = university` does not distinguish federal, state, and private ownership.
- The live NUC nationwide directory reports 328 universities: 77 federal, 69 state, and 182 private.
- The NUC page contains inconsistencies between its nationwide table and geopolitical-zone listings. The nationwide list includes Gombe State University, while the zone listing uses a different Gombe institution label and includes Pen Resource University, which does not appear in the nationwide list. The NUC state-university count also needs cautious treatment because the page's 69-state total differs from a separate NUC announcement referring to a 70th state-owned university.

**Interpretation:** 329 database rows versus 328 NUC nationwide entries is consistent with one duplicate identity, but the NUC page's internal inconsistencies mean this count alone is not proof that every other institution record is correct.

### Phase 2 — NUC identity reconciliation

The 329 inventory rows were mapped sequentially against the NUC nationwide directory. The nationwide table contains one University of Calabar entry, displayed as **University of Calabar, Calabar**. The inventory's two Calabar rows resolve to the same institution identity.

Other name and source inconsistencies were recorded rather than silently rewritten, including spelling/punctuation differences and Gombe/Anambra source issues. The row mapping is a provisional identity reconciliation, not a claim that every institution's legal status, ownership, or programme accreditation has been independently verified.

### Phase 3 — Database dependency audit

The production database contains 25 foreign-key constraints that point directly to `public.institutions(id)`.

The two Calabar rows currently have the following direct dependencies:

| Dependent table | Canonical row | Secondary row |
|---|---:|---:|
| `faculties` | 28 | 0 |
| `programmes` | 33 | 0 |
| `edureach_announcements` | 3 | 0 |
| `ask_solutions` | 2 | 0 |
| `grading_schemes` | 1 | 0 |
| `profiles` | 1 | 0 |
| All other institution-FK tables checked | 0 | 0 |
| **Total direct dependent rows** | **68** | **0** |

The remaining checked direct-FK tables were `academic_records`, `academic_sessions`, `admission_records`, `campus_posts`, `cbt_exams`, `course_mapping_requests`, `cutoff_marks`, `department_course_reps`, `document_bank`, `edureach_deadlines`, `edureach_exams`, `edureach_tasks`, `edureach_verification_queue`, `institution_course_offerings`, `institution_curriculum_courses`, `letter_templates`, `past_question_resources`, `school_fees`, and `service_requests`.

No personal profile identifiers or student information are included in this report. The single linked profile's institution label is also `University of Calabar`.

**Delete behavior:** the canonical institution row is protected by RESTRICT relationships from `faculties` and `profiles`. Other institution relationships include CASCADE, SET NULL, or RESTRICT actions. A direct delete is therefore not an acceptable cleanup method.

### Phase 4 — Application and migration-reference audit

The targeted application files inspected show:

1. The profile-completion path stores the selected school as a free-text `profiles.school` value; the inspected flow does not set `profiles.institution_id`.
2. The built-in starter institution option contains `University of Calabar (UNICAL)` only.
3. The School Finder queries `public.institutions`, orders by school name, and renders returned records without Calabar-specific alias grouping.
4. The School Finder card uses the database row ID as the record key; it does not collapse aliases.
5. The institution detail route resolves by normalized school name or acronym and creates different detail slugs for the two names.
6. The institution intelligence schema file is a design draft. Its proposed aliases table is not proof that such a production table exists or has been deployed.
7. The targeted application files did not contain a hardcoded reference to the secondary Calabar UUID or slug.

**Audit limitation:** this was a targeted source review of the main institution/profile/finder/detail paths and relevant schema/migration documents, not a complete line-by-line audit of every application file, external integration, cached URL, or user bookmark. Therefore, the absence of a hardcoded reference in those inspected files is not proof that no external or uninspected reference exists.

### Phase 5 — Deep data integrity and migration provenance

#### Academic hierarchy attached to canonical UNICAL

The canonical institution has:

- 28 faculty/unit records.
- 33 departments under those faculties.
- 33 directly linked programmes.
- 189 courses attached through the programme/department hierarchy.
- 184 resources attached to those courses.
- Zero orphan programme-to-faculty/department links in the targeted hierarchy check.

The 33 departments and 33 programmes are concentrated in five faculty records:

| Faculty | Departments | Programmes |
|---|---:|---:|
| Faculty of Engineering | 8 | 8 |
| Faculty of Allied Medical Sciences | 5 | 5 |
| Faculty of Arts | 9 | 9 |
| Faculty of Basic Medical Sciences | 5 | 5 |
| Faculty of Management Sciences | 6 | 6 |
| **Total** | **33** | **33** |

The other 23 faculty/unit records currently have no linked departments or programmes in these checks. Some names in the 28-record set refer to institutes or non-teaching units rather than conventional academic faculties. These records need separate verification against the university's current official structure; they should not be deleted or reclassified merely to make the counts look cleaner.

No course questions, past-question rows, student course registrations, course outlines, or department course-representative rows were found in the inspected UNICAL course hierarchy query. This does not affect the presence of the 189 courses and 184 resources.

#### Strong migration-timestamp correlation

The two institution rows have creation timestamps that exactly match the time encoded in two production migration versions:

| Institution row | Database `created_at` (UTC) | Matching production migration ledger entry |
|---|---|---|
| Canonical `University of Calabar` | 2026-08-21 18:36:12.504586 | `20260821183612 — production_seed_unical_verified_data_v4` |
| Secondary `University of Calabar, Calabar` | 2026-09-20 16:52:07.856122 | `20260920165207 — seed_nuc_universities_2026` |

This exact timestamp correlation is strong evidence that the canonical row was created by the UNICAL seed and the secondary row was introduced during the later NUC-wide seed. The original SQL source for those historical seed migrations is not present in the inspected research branch, so the exact insert/upsert logic cannot be verified. The source file for `seed_nuc_universities_2026` also returned not found when checked directly in the repository.

The production migration ledger contains 209 entries, while the inspected research branch contains 90 SQL migration files. Several historical UNICAL/NUC seed migrations recorded in production are absent from this branch, including:

- `20260821183612 production_seed_unical_verified_data_v4`
- `20260821220852 seed_unical_faculty_directory_2026`
- `20260821222051 populate_unical_engineering_departments_programmes_v2`
- `20260821222135 populate_unical_verified_programme_catalogue_core_faculties_v2`
- `20260920165207 seed_nuc_universities_2026`

This may reflect a migration re-baseline or incomplete migration-file retention; it must be reconciled deliberately. Do not run the research branch's migrations against production or attempt to replay missing seed migrations until the repository/production migration-history relationship is resolved.

## Final disposition

| Item | Decision | Reason |
|---|---|---|
| Canonical UNICAL UUID `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` | **Retain** | Owns the populated hierarchy and 68 direct dependent rows |
| Secondary Calabar UUID `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` | **Preserve temporarily; mark as alias candidate** | Zero direct dependencies found, but row deletion is unnecessary and route/history compatibility is not fully audited |
| Display in public institution directory | **Show one canonical identity** | Avoid duplicate Calabar search results |
| Legacy label `University of Calabar, Calabar` | **Preserve as alias** | Matches the NUC display spelling and may be used by historical links |
| Legacy slug `university-of-calabar-calabar` | **Redirect/resolve to canonical detail** | Prevents two detail pages for one institution |
| Academic hierarchy | **Retain pending official-structure validation** | Current records contain units with no departments/programmes and require source review |
| Production row deletion/merge | **Do not execute in this audit** | Migration provenance, external references, and complete source scan are not yet resolved |

## Safe implementation sequence

1. **Resolve migration history first.** Compare the 209 production ledger entries with the current repository migration history. Establish whether the branch is a deliberate baseline, a partial history, or a divergent migration lineage. Do not replay the missing seeds.
2. **Introduce explicit canonical identity and aliases.** Use a canonical institution reference and an alias mapping for the alternate name and slug. The existing design draft may be used as a starting point, but verify the actual live schema before implementing it.
3. **Update application resolution.** Institution search should return canonical records only. Detail routing should resolve the legacy slug and alternate name to the canonical record. Profile selection should persist a canonical `institution_id` where appropriate instead of relying only on free text.
4. **Preserve compatibility.** Keep the legacy UUID/slug mapping available until URL, external integration, cache, and historical-data checks are complete. A soft-deprecated alias is safer than an immediate delete.
5. **Validate academic hierarchy separately.** Verify the 28 faculty/unit records, 33 departments, and 33 programmes against the current official UNICAL structure. Do not infer accreditation from a faculty or programme listing.
6. **Run before/after checks.** Confirm one public Calabar result, both names resolve to the same institution, the legacy slug redirects, the 68 current direct dependencies remain attached to the canonical row, and no profile or academic records are lost.
7. **Only consider physical deletion after approval.** If deletion is eventually required, snapshot the source row and dependencies, remap any newly discovered references, test FK/unique constraints, and execute a reviewed reversible migration with post-change verification.

## Completion and non-actions

**Completed:** 329-row inventory structure audit; 329-row NUC identity mapping; direct database dependency checks across 25 institution foreign keys; targeted application-reference review; academic hierarchy checks; migration timestamp/provenance review; and consolidated remediation decision.

**Not performed:** no row update, row deletion, merge, schema DDL, RLS/policy change, application-code edit, migration replay, or production deployment. The research branch only receives this documentation report.

## Prior QA records

- `docs/research/institutions/qa-phase-1-inventory-reconciliation.md`
- `docs/research/institutions/qa-phase-2-nuc-identity-reconciliation.md`
- `docs/research/institutions/qa-phase-3-calabar-dependency-audit.md`
- `docs/research/institutions/qa-phase-4-application-reference-audit.md`
- Research batches: `group-002-primary-research-101-150.md`, `151-200.md`, `201-250.md`, `251-300.md`, and `301-329.md`
