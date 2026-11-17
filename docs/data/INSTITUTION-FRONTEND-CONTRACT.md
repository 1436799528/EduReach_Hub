# Institution frontend contract

**Status:** implemented on the institution-research branch. Frontend readiness
only — **no migration was applied, no row was imported, merged or deleted, and
no production Supabase data was modified.**

This note is the contract between the browser and the institution data. It
answers three questions: what the frontend renders today, what it will render
once the intelligence tables exist, and what has to be true before the switch is
turned on.

## 1. The one rule behind all of it

Two schemas are in play and they are not the same schema:

| Schema | State | Used by the frontend |
| --- | --- | --- |
| `public.institutions` (329 rows) | **deployed** | Yes, always |
| `institution_profiles`, `institution_aliases`, `institution_campuses`, `institution_academic_units`, `institution_programme_offerings`, `institution_admission_routes`, `institution_programme_requirements`, `institution_admission_benchmarks`, `institution_portal_guides`, `institution_portal_guide_steps`, `institution_leadership`, `institution_fact_evidence`, `student_admission_goals`, `national_admission_policies` | **not applied** (`20261117120000_institution_intelligence.sql`) | No — gated |

So the frontend reads the directory that exists and reports every richer
section as `not_imported`. That is a true statement about the product, not a
placeholder someone forgot to fill.

There is no runtime probe, no `try/catch` around a missing-table error and no
browser-side schema introspection. The switch is one reviewed constant.

## 2. Where the code lives

```
src/lib/institutions/
  types.ts              the typed models (see §3)
  normalizers.ts        one canonical form per concept; nothing is inferred
  aliases.ts            canonical identity resolution (University of Calabar)
  mappers.ts            database rows → the frontend models
  selectors.ts          search, filter, de-duplication, route resolution
  repository.ts         the data-access boundary and the deployment gate
  admissionSelection.ts the nine-step flow and its honesty rules
  profileInstitution.ts profile ↔ canonical institution id
  index.ts              the public surface

src/components/institutions/
  TrustBadge.tsx              verified / awaiting / not imported / unavailable
  InstitutionProfileView.tsx  the profile sections
```

Every institution read in the app — the finder (`pages/SchoolFinderPage.tsx`),
the details page (`pages/SchoolDetailsPage.tsx`), the dashboard finder card
(`src/components/dashboard/SchoolFinderCard.tsx`), the Post-UTME setup
(`pages/ExamSetupPage.tsx`) and profile completion
(`pages/ProfileCompletionPage.tsx`) — goes through this module. No page issues
its own `supabase.from('institutions')` query.

## 3. The typed models

| Model | Source today | Source after the import |
| --- | --- | --- |
| `InstitutionSummary` | `institutions` row | unchanged |
| `InstitutionProfile` | mapped from the directory, all sections empty | `institution_profiles` + the section tables |
| `InstitutionAlias` | acronym + reconciliation records | `institution_aliases` |
| `Campus` | — | `institution_campuses` |
| `AcademicUnit` | — | `institution_academic_units` (faculties/colleges/schools/institutes/centres **and** departments, split by `unit_type`) |
| `ProgrammeOffering` | — | `institution_programme_offerings` |
| `AdmissionRoute` | — | `institution_admission_routes` |
| `ProgrammeRequirement` | — | `institution_programme_requirements` |
| `AdmissionBenchmark` | — | `institution_admission_benchmarks` |
| `PortalGuide` (+ `PortalGuideStep`) | — | `institution_portal_guides` + `_steps` |
| `SourceEvidence` | — | `institution_fact_evidence` (staff-only; public surfaces see the source URL attached to each fact) |

Two modelling decisions matter:

* **Ownership is a researched value, never a deduction.**
  `normalizeOwnership()` accepts only `federal | state | private` and returns
  `null` for everything else. It never looks at the institution's name, state or
  type. Until the profile rows are imported, `ownership` is `null` for all 329
  institutions and the finder shows no ownership pill and disables the filter.
* **A section without rows is not a fact.** `InstitutionSection<T>` carries a
  `state` (`available | empty | awaiting_review | not_imported | unavailable`)
  and `items` is empty in every state except `available`, so the UI cannot
  accidentally render "0 programmes" as a statement about the institution.

## 4. How the frontend will connect to the future tables

The connection is one constant and one function.

```ts
// src/lib/institutions/repository.ts
export const INSTITUTION_INTELLIGENCE_DEPLOYED = { applied: false };
```

`fetchInstitutionProfile()` reads the directory row (always), then:

* when `institutionIntelligenceDeployed()` is `false` → returns
  `mapProfileFromDirectory(summary)`: the identity plus sections all marked
  `not_imported`;
* when it is `true` → calls `GET /api/institutions/:id/intelligence`
  (`src/server/institutionIntelligence.ts`, `fetchInstitutionIntelligence()` in
  `src/lib/api.ts`) and merges the published-and-verified rows through
  `mergeIntelligence()`.

The server endpoint already exists and already filters on
`verification_status = 'verified'` and `publication_status = 'published'` for
every table, because it uses the service-role key and RLS does not filter for
it. The frontend therefore never asks the database for unpublished rows.

### Turning it on — the checklist

Flip `INSTITUTION_INTELLIGENCE_DEPLOYED.applied` to `true` only when **all**
of the following are true:

1. `20261117120000_institution_intelligence.sql` and
   `20261117121000_institution_import_function.sql` are applied to the target
   database;
2. the researched batch has been imported **and reviewed** through
   `/admin/institution-intelligence` (the importer writes `in_review`, and
   `in_review` is never shown to a student);
3. `npm run schema:audit`, `npm run rls:posture` and `npm run prod:validate`
   pass against that database;
4. the finder and the details page have been checked on a real device at 320px,
   390px, 768px, 1024px and 1440px.

Nothing else changes: the mappers, the sections and the badges are already
written against the final shape.

## 5. Calabar identity protection

The directory holds two rows for the University of Calabar:

| UUID | Name | Slug |
| --- | --- | --- |
| `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` | University of Calabar | `university-of-calabar` |
| `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` | University of Calabar, Calabar | `university-of-calabar-calabar` |

Neither row is deleted, merged or rewritten. `src/lib/institutions/aliases.ts`
records that they are the same institution and the resolution happens entirely
in the read path:

* the canonical row is the only one listed in the finder (`isSuppressedDuplicate`
  hides the alias row **only while the canonical row is present**, so the alias
  stays reachable if the canonical row is ever missing from a result set);
* the alias row's name and slug resolve to the canonical identity, so
  `/schools/university-of-calabar-calabar` and a search for
  "Calabar, Calabar" both reach the same page;
* the alias name becomes a search alias on the canonical row.

When `institution_aliases` is deployed, the same resolution is driven by that
table; the hardcoded record is the bridge until then.

## 6. Honesty rules the UI enforces

| Rule | Where |
| --- | --- |
| JAMB IBASS is the authority for UTME subject combinations | `UTME_SUBJECT_AUTHORITY`, `admissionSelection.ts` |
| English is compulsory only where the official rule requires it | `englishCompulsoryFor()` — true for UTME, otherwise only when the published list names it |
| A national minimum is not a departmental cut-off | `isDepartmentalCutoff()` |
| UTME (0–400) and aggregate (0–100) scales are never mixed | `areSameScale()`, `formatBenchmark()` |
| A screening formula appears only if the institution published one | `screeningMethodFor()` returns `null` otherwise |
| An old session's requirement is never shown as current | `isCurrentSession()`, `requirementFor()` |
| NUC recognition is not programme accreditation | the programmes section note + `accreditationStatus` |
| A row existing is not verification | `intelligencePublished` must be true for a verified mark |
| A website URL is shown only when it is an absolute http(s) URL | `normalizeUrl()` |
| A school is offered for Post-UTME practice only when EduReach can serve it | `fetchPostUtmeDirectory()` + the bank filter in `ExamSetupPage` |

## 7. Still waiting on the backend

1. **`public.profiles.institution_id` does not exist.** Profile completion
   remembers the canonical id for the session (`profileInstitution.ts`) and
   `institutionIdWrite()` returns `{}` so the save stays valid SQL. The free-text
   `school` column remains what is written, and nothing overwrites a value a
   student already saved. Adding the column is a separate migration.
2. **`institution_aliases` is not deployed**, so alias resolution is driven by
   the reconciliation record in `aliases.ts` rather than by the table.
3. **No institution has published ownership, campuses, units, programmes,
   routes, requirements, benchmarks or portal guides.** Every one of those
   sections renders as `not_imported` and is named once at the bottom of the
   profile as "Not published for this institution yet".
4. **JAMB IBASS combinations must be captured per institution, programme and
   cycle.** They cannot be scraped, so the subject-combination section stays
   hidden until that research is imported.

## 8. Tests

* `tests/institution-frontend.test.ts` — normalizers, alias resolution, search
  and filters, mappers, the deployment gate, the admission rules and the profile
  integration (29 assertions groups).
* `tests/simulator-gradients.test.ts` — the four CBT gradients, their binding to
  the exam type and their contrast (see `docs/features/NEWS-1-GRADIENT-CARDS.md`
  for the news palette, which is deliberately untouched).
* `tests/e2e/institution-and-simulator-gradients.spec.ts` — the gradients in a
  real browser, the finder's honest empty state and the details page.
