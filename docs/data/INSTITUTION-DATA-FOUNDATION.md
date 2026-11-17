# Institution Intelligence Data Foundation

**Status:** design and research foundation; not yet applied to the production database  
**Research date:** 16 November 2026  
**Scope:** all institutions already represented in `public.institutions`, reconciled against the current NUC Nigerian University System registry.

## 1. Production baseline and known data-quality problems

The production Supabase project currently contains 329 institution rows across 37 states. They are all marked `is_verified = true`, but this flag must not be interpreted as verification of every profile field. At the time of this audit:

- Only 1 of 329 institutions has a populated official website URL.
- Only 1 of 329 has a populated admission portal URL.
- 0 of 329 have a populated student portal URL.
- `cutoff_marks` has 0 rows.
- `institution_course_offerings` has 0 rows.
- 28 `faculties`, 33 `departments`, and 33 `programmes` are linked to only one institution (University of Calabar), not distributed over the entire directory.
- `national_programme_catalogue` has 138 sourced programme rows, but a national programme catalogue is not proof that a particular institution offers that programme.
- University of Calabar occurs twice: the canonical `University of Calabar` record and `University of Calabar, Calabar`. These must be reconciled without deleting/merging either row until references are inspected.
- The current NUC Nigerian University System page reports 328 universities (77 federal, 69 state, 182 private). The 329-row local directory therefore needs reconciliation against NUC's current registry, including institution status, aliases, new approvals and duplicate records.

The existing `is_verified` flag must remain untouched until its historical meaning is established. A new field-level and profile-level verification model is required.

## 2. Data principles

1. Never invent a Vice-Chancellor, Chancellor, faculty, department, programme, campus, portal URL, admission method, subject combination, cut-off or application deadline.
2. Distinguish **national minimum**, **institution UTME eligibility threshold**, **programme UTME threshold**, **post-UTME screening aggregate**, **departmental merit cut-off**, and **catchment/ELDS cut-off**. They are not interchangeable.
3. Every fact that can change must have a source URL, source publisher, publication/session information, a verification timestamp and a status.
4. Store admission requirements by entry mode and academic session. UTME, Direct Entry, JUPEB, IJMB, pre-degree and transfer routes have different requirements.
5. A missing or unpublished field is represented as missing/unpublished, never a guessed default.
6. Public profiles expose only verified, current records. Pending, reported, disputed, outdated or secondary-source-only claims stay out of the verified public layer.
7. Preserve the existing university academic curriculum structures used for course registration. Admission offerings for other institutions must not be inserted into the UNICAL-linked curriculum tables simply to make them appear populated.

## 3. Data domains to build

### A. Institution identity and profile

Retain `institutions` as the canonical directory identity. Add an institution profile extension for:

- Official name, acronym and accepted aliases
- Ownership/type and NUC identity/status
- Year established and legal/charter date where separately known
- Main location and official contact channels
- Detailed overview and independently sourced history
- Vision, mission and mandate
- Official website, admission portal, student portal, postgraduate portal and other relevant gateways
- Profile completeness and field-level verification metadata

Do not treat an aggregator, search result or unofficial portal as an official school domain.

### B. Leadership

Use effective-dated leadership records for:

- Chancellor (where the institution has one)
- Vice-Chancellor / Rector / Provost / President, according to institution type
- Pro-Chancellor / Council Chair
- Deputy Vice-Chancellors
- Registrar
- Other principal officers where useful

Store role, name, start/effective date, end date, acting/substantive status, source, checked date and verification status. Never infer a Chancellor from a ceremonial visitor or appointing authority.

### C. Campuses and academic structure

Build separate campus records and classify organisational units explicitly:

- Faculty
- College
- School
- Institute
- Centre
- Department
- Division / service unit

A university webpage's navigation heading is not sufficient evidence to classify every item as a faculty. Reconcile the existing UNICAL records: its current directory includes institutes and non-teaching units alongside academic faculties, and names differ from the historical local seed.

### D. Institutional programme offerings

Create institution-specific programme offerings. A programme in the NUC national catalogue or CCMAS catalogue is not automatically offered by each school.

Each offering must link, where possible, to:
- Institution
- Academic unit / faculty / school
- Department
- National programme identity
- Credential/degree award
- Delivery mode and location
- Active/inactive status and applicable admission session
- Official source and verification status

### E. Admission routes and programme entry requirements

Represent admission routes per institution and session, including:

- UTME / JAMB
- Direct Entry (DE)
- JUPEB
- IJMB
- Pre-degree / foundation
- Diploma / ND / HND / other accepted qualifications
- Transfer routes when officially available

Separate the *method of assessment* from the *mode of entry*. Screening may be online document review, portal-based screening, CBT, physical verification, interview, departmental test or a combination. Keep unknown as unknown.

Programme requirements should support:
- UTME subject combination
- O'Level subjects, grade thresholds and sitting limits
- A'Level / JUPEB / IJMB / ND / HND qualifications
- First-choice requirement / change-of-institution policy
- Special programme conditions, waivers and notes
- Source, session, publication date, verification state

For UTME subject combinations, JAMB IBASS is the primary authority. English Language is selected by default by IBASS. An institution's own page may supplement but should not silently override JAMB eligibility requirements.

### F. Admission benchmarks and cut-offs

Use a typed benchmark model. Each row should identify:

- Institution and programme (when programme-specific)
- Admission session
- Benchmark kind: national minimum, institution UTME eligibility, programme UTME minimum, screening aggregate, departmental merit, catchment/ELDS, post-UTME test or other
- Numeric value and score scale (for example 0–400 or 0–100)
- Category / catchment state / ELDS grouping
- Whether the value is an eligibility floor or a competitive cut-off
- Source, publication date, verification date and status

Do not put JAMB's general national minimum in a field displayed as a department-specific cut-off. Do not compare a 0–400 UTME score to a 0–100 aggregate without converting through an explicitly defined formula.

The existing `cutoff_marks` table has useful legacy fields but lacks a complete score-type/scale model. Preserve it for compatibility and build a richer canonical benchmark layer; add a compatibility view or carefully map existing verified records later.

### G. Portal guides

Store structured, versioned navigation guides for:
- Website navigation
- Admission application
- Post-UTME/DE screening
- Admission status and JAMB CAPS
- Acceptance and clearance
- School-fee payment
- Student portal activation/login
- Course registration and results

Each guide step needs a label, action, official URL, required information/documents, notes, warning, order, session/effective date and source. Never instruct students to send passwords, OTPs, card data or payment credentials to EduReach. Payments must remain on the institution's verified portal.

### H. Student admission goal and practice alignment

Add a private student admission-goal model containing:

- Owner/profile
- Target exam (UTME/JAMB, WAEC, NECO, Post-UTME or another supported route)
- Intended institution
- Intended programme
- Entry mode and admission session
- Student's intended score target (optional, distinct from the school's published threshold)
- Selected programme requirement and benchmark references
- Goal status and created/updated timestamps

When a student selects JAMB + institution + programme:
1. Resolve the current JAMB IBASS subject combination for that programme and entry mode.
2. Display the applicable O'Level and other programme requirements.
3. Display the national minimum separately from the institution/programme-specific thresholds.
4. Display aggregate cut-offs with their correct 0–100 scale and category.
5. Recommend practice using the required subject mix and relevant exam content.
6. Track scored attempts against the student's target and show the gap to the target.
7. Explain that practice scores estimate readiness; they do not predict or guarantee admission.

Link each practice attempt to the active goal when the student is using goal-directed practice. Do not treat a generic mock test as goal-specific unless its subjects and scoring model match the selected goal.

## 4. Source-of-truth hierarchy

| Data | Primary source |
|---|---|
| Institution recognition, classification, official name and registry | Current NUC Nigerian University System |
| UTME subject combinations and programme eligibility | JAMB IBASS |
| National minimum score and admission policy | JAMB current policy releases |
| Vice-Chancellor, Chancellor, faculties, departments, campuses, current programmes | Institution's own official website |
| Session-specific admission process and programme cut-offs | Institution's official admissions notice / approved document |
| Portal navigation | Current official institution portal |
| Secondary admissions guides | Discovery only; not final verification |

A NUC directory entry is useful for discovery, but it may be stale for current office holders. Example: the NUC Federal Universities page still lists Prof. Florence Banku Obi as UNICAL VC, while the current UNICAL official history/about page identifies Professor Offiong Efanga Offiong. The current school source takes precedence for its own active office holder.

## 5. Verification states

Use explicit states such as:

- `unresearched`
- `discovered`
- `in_review`
- `verified`
- `unpublished_by_institution`
- `not_applicable`
- `disputed`
- `outdated`

A profile is not "verified" simply because one website URL or the institution identity is verified. Verification is field-level; profile completeness is calculated separately.

## 6. Research batch 001

The accompanying `data/institutions/research-batch-001.json` is an initial evidence batch for:

- University of Calabar (UNICAL)
- Federal University of Health Sciences, Ila-Orangun (FUHSI)

It contains sourced information, source URLs and explicit gaps. It is a research/import candidate, not a statement that every field has already been inserted into the production database.

## 7. Delivery sequence

1. Reconcile the current 329 institution records against the current NUC list; identify real duplicates, aliases, renamed schools and newly recognised institutions.
2. Add and test the additive schema in a non-production database branch. Preserve current tables and all existing records.
3. Seed verified institutional identity and official website URLs.
4. Research and publish institution profile and leadership facts in batches.
5. Import faculties/colleges, departments, campuses and institution-specific programme offerings.
6. Ingest entry modes, JAMB subject combinations and O'Level/A'Level requirements.
7. Import session- and programme-specific benchmarks with units, categories and source documents.
8. Build structured portal guides.
9. Add student admission goals, goal-aware simulator selection and progress-to-target tracking.
10. Add admin review tools for sources, data status, changes and expiry.

No production migration, production data import or destructive reconciliation is authorised by this design document. Each deployment step requires schema tests, RLS tests, data-quality checks, and release verification.
