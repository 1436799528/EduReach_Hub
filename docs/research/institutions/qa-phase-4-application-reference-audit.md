# QA Phase 4 — Calabar application and migration reference audit

**Date:** 17 November 2026  
**Branch inspected:** `data/institution-intelligence-foundation`  
**Scope:** Read-only inspection of the branch tree and targeted application, profile, data, and migration files.  
**Production changes:** None.

## Executive finding

The application paths inspected do not appear to hardcode either Calabar UUID or the secondary slug. The institution directory is database-driven and currently selects all institution rows, while student profile completion stores the institution as a free-text `profiles.school` value. The profile-completion path inspected does not translate a selected school name into `profiles.institution_id`.

This means a duplicate institution row can still surface in the school directory even when the student profile form offers only one UNICAL label. It also means the display-name cleanup and the relational identity cleanup are separate concerns.

## Branch and files inspected

The branch tree was retrieved at commit `3b4e4d3481336ef0f3311403b2c45069aefbd3f3` (tree `9a8882441eb31760fa62617373bf60506fe92c25`). The recursive tree contained 1,101 files.

Targeted source files fetched and inspected:
- `src/data/studentOptions.ts`
- `pages/ProfileCompletionPage.tsx`
- `src/components/dashboard/SchoolFinderCard.tsx`
- `pages/SchoolFinderPage.tsx`
- `pages/SchoolDetailsPage.tsx`
- `src/lib/profileSave.ts`

Targeted database/migration/design files fetched and inspected:
- `supabase/migrations/20260916000000_application_integration_seed.sql`
- `supabase/migrations/20260930160000_institutions_column_repair.sql`
- `docs/data/INSTITUTION-DATA-FOUNDATION.md`
- `docs/data/INSTITUTION-INTELLIGENCE-SCHEMA.sql`
- `docs/migration/FRONTEND-INTEGRATION-MAP.md`

A repository code-search query for both UUIDs, the secondary slug and the institution name returned no indexed matches. GitHub code search is indexed against the default branch, so this result is not treated as proof of absence on the research branch. The branch-specific review therefore relies on the directly fetched files listed above; this is a targeted audit, not a complete line-by-line scan of all 301 application/script/migration code files.

## Findings

### 1. Profile completion uses a text institution value

In `pages/ProfileCompletionPage.tsx`:
- The form derives `finalSchool` from the selected school/custom school.
- The saved profile payload includes `school: finalSchool`.
- The inspected profile save helper updates the `profiles` row using this payload.
- The inspected profile-completion flow contains no mapping from the selected school to an institution UUID and does not set `institution_id`.

The starter option in `src/data/studentOptions.ts` is exactly `University of Calabar (UNICAL)`. There is no second Calabar option in the inspected starter institution list.

### 2. Directory finder selects every database institution row

`pages/SchoolFinderPage.tsx` reads:
`id,school_name,acronym,state,institution_type,website_url`
from `public.institutions`, orders by `school_name`, and limits the result to 400.

The result is rendered from the returned rows. No Calabar-specific exclusion or alias grouping was found in the inspected component.

`src/components/dashboard/SchoolFinderCard.tsx` similarly renders the supplied institution rows and uses the database row ID as the React key. It does not collapse duplicate names or aliases.

**Impact:** If both database rows are present in the returned directory data, both can be displayed. The profile completion dropdown offering one canonical-looking UNICAL label does not prevent the directory duplicate.

### 3. Detail routing is name/slug based, not canonical-alias based

`pages/SchoolFinderPage.tsx` creates a route slug from `school_name`.

`pages/SchoolDetailsPage.tsx` first tries the starter list, then queries `institutions` and selects a live row by normalized `school_name` or acronym. No alias table or canonical institution mapping is used in this path.

Consequently, `University of Calabar` and `University of Calabar, Calabar` can resolve to separate detail routes and separate database rows.

### 4. Proposed institution intelligence schema is additive and not a merge mechanism

`docs/data/INSTITUTION-INTELLIGENCE-SCHEMA.sql` is explicitly marked design draft only and says not to execute on production. It introduces aliases linked to an institution UUID but does not implicitly merge institution rows.

`docs/data/INSTITUTION-DATA-FOUNDATION.md` also explicitly says the two Calabar rows must not be merged/deleted until references have been inspected. Its design principles support retaining the existing academic structures and treating institution identity separately from text labels.

### 5. No hardcoded duplicate UUID found in the targeted files

The exact UUIDs and secondary slug were not present in the targeted files listed above. The available repository code-search index also returned no matches, but because it indexes the default branch this is only supporting evidence, not a branch-wide negative proof.

## Implications for a future correction

A safe resolution should be staged as two distinct changes:

1. **Directory presentation:** Add a reviewed canonical identity/alias resolution layer so the finder displays one preferred institution while retaining historical/alternate names for search. Do not silently deduplicate by fuzzy string matching.
2. **Relational profile identity:** If the product intends to use `profiles.institution_id` as the canonical relation, introduce an explicit mapping from the selected institution record to its UUID and keep `profiles.school` only as a display/backward-compatibility field. Backfill only after verifying existing profile values and intended institution identity.

For the Calabar case, the provisional canonical UUID remains `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc`, because it has the official website, UNICAL acronym, canonical slug, and the 68 dependent rows found in Phase 3. The secondary UUID remains unchanged pending a separately approved remediation.

## Next checks before proposing a migration

- Inspect the full `profiles` row and confirm whether its `institution_id` matches the canonical UUID and whether its `school` text is consistent.
- Inspect downstream references from the 28 faculties and 33 programmes, including departments and any join tables, before considering a move.
- Inspect all migration history that inserts or modifies `public.institutions` and all seed/import scripts. The targeted seed migration inspected did not insert Calabar institution rows.
- Check the active production directory query and UI behavior with both records present; do not change production as part of this research phase.
- Only then prepare a reversible, non-production migration proposal and tests.

## Safety statement

This phase performed repository reads only. No production database records, schema, migrations, or application code were changed.
