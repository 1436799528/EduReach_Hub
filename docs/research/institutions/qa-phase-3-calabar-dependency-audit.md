# QA Phase 3 — University of Calabar duplicate dependency audit

**Date:** 2026-11-17  
**Scope:** Read-only inspection of the EduReach-V1 Supabase production schema and the two institution UUIDs identified in QA Phase 1/2.  
**Production changes:** None. No INSERT, UPDATE, DELETE, DDL, migration, or storage operation was executed.

## Executive finding

The two inventory records resolve to two distinct rows in `public.institutions`, but only one UUID has dependent rows in the inspected foreign-key relationships.

**Recommended canonical record to retain (provisional):**
- UUID: `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc`
- Name: `University of Calabar`
- Acronym: `UNICAL`
- State: `Cross River`
- Website: `https://www.unical.edu.ng/`
- Slug: `university-of-calabar`
- Verified: `true`

**Secondary duplicate candidate:**
- UUID: `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967`
- Name: `University of Calabar, Calabar`
- Acronym: null
- State: `Cross River`
- Website: null
- Slug: `university-of-calabar-calabar`
- Verified: `true`

This recommendation is based on the populated official website/acronym/slug and the observed references. It is not an instruction to delete or merge either row.

## Database references

The read-only foreign-key catalogue query found 25 public-schema foreign-key constraints referencing `public.institutions(id)`.

For the two UUIDs, actual row-count queries across those referencing tables returned these non-zero results:

| Referencing table | Canonical UUID | Secondary UUID |
|---|---:|---:|
| `ask_solutions` | 2 | 0 |
| `edureach_announcements` | 3 | 0 |
| `faculties` | 28 | 0 |
| `grading_schemes` | 1 | 0 |
| `profiles` | 1 | 0 |
| `programmes` | 33 | 0 |
| **Total non-zero references** | **68** | **0** |

The other institution-FK tables in the catalogue returned no rows for either UUID in this targeted query:
- `academic_records`
- `academic_sessions`
- `admission_records`
- `campus_posts`
- `cbt_exams`
- `course_mapping_requests`
- `cutoff_marks`
- `department_course_reps`
- `document_bank`
- `edureach_deadlines`
- `edureach_exams`
- `edureach_tasks`
- `edureach_verification_queue`
- `institution_course_offerings`
- `institution_curriculum_courses`
- `letter_templates`
- `past_question_resources`
- `school_fees`
- `service_requests`

The catalogue also confirmed FK relationships from `faculties` and `programmes` to other academic structures. Those relationships matter if anyone later proposes moving or consolidating the dependent academic records; this audit did not inspect every downstream row or attempt such a move.

## Referential-action risk

The inspected FK metadata includes different delete actions:
- `RESTRICT` on `profiles.institution_id` and `faculties.institution_id`.
- `CASCADE` on several institution-owned academic and admissions tables.
- `SET NULL` on other relationships.

Therefore, deleting an institution row is not a safe deduplication method. Depending on the child table, deletion could be blocked or could cascade into related data. No delete was attempted.

## Application-code search limitation

A repository code search for the two UUIDs, the secondary slug, and the institution name returned no indexed matches. That search covers the GitHub code-search index/default branch and is not proof that there are no references in the research branch, generated files, runtime configuration, or dynamically constructed queries.

A complete merge plan must separately inspect the active application branch and search all source, migrations, seed data, edge functions, and generated assets for:
- both UUIDs;
- `university-of-calabar`;
- `university-of-calabar-calabar`;
- name-based matching and slug construction.

## Decision and next safe step

1. Keep both rows unchanged for now.
2. Treat `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` as the provisional canonical identity.
3. Before any merge, inspect application code and all database dependencies, including downstream references from the 28 faculties and 33 programmes.
4. If a merge is later approved, prepare a reversible, transaction-scoped migration plan with pre-merge snapshots, collision checks, explicit child-row remapping, and post-merge verification. Do not rely on deleting the secondary row and hoping FK actions preserve data.
5. No production data was modified during this audit.

## Method

- Confirmed project status as `ACTIVE_HEALTHY` and PostgreSQL 17.6.
- Inspected the `public.institutions` columns and both target rows.
- Queried PostgreSQL system catalogues for every public FK referencing `public.institutions(id)`.
- Ran targeted SELECT count queries against the referencing tables for the two UUIDs.
- Searched the repository's available GitHub code-search index for the IDs, slug, and institution name.
