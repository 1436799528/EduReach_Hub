# EduReach Hub Institution Intelligence — QA Phase 1: Inventory Reconciliation

**Audit date:** 17 November 2026  
**Source branch:** `data/institution-intelligence-foundation`  
**Source inventory:** `data/institutions/institution-inventory-329.json`  
**Scope:** Structural validation, duplicate detection, and reconciliation against the NUC Nigerian University System (NUS) directory.  
**Safety boundary:** Documentation only. No production Supabase records, identifiers, or admissions data were changed.

## 1. Executive result

The source JSON parses successfully and contains **329 institution rows**. All 329 rows have a non-empty `schoolName`, `state`, `institutionId`, and `institutionType`. All rows currently use `institutionType: university`. The audit found:

- **0 duplicate institution IDs**.
- **0 exact duplicate names** after case-folding, Unicode normalization, punctuation removal, and whitespace normalization.
- **1 strong semantic duplicate candidate:** University of Calabar appears twice under slightly different display names and has two different UUIDs.
- **0 duplicate non-empty website URLs**. This is not a meaningful assurance because most `websiteUrl` fields are null.
- **37 distinct state/FCT labels**.
- **329 rows versus 328 universities** shown by the current NUC NUS directory: a one-row discrepancy requiring reconciliation.

The evidence strongly suggests that the 329-row inventory contains one duplicate University of Calabar record, but this audit does **not** authorize deletion or merging. Foreign-key references, admissions records, student favourites, analytics, and any other dependent data must be inspected before a migration is proposed.

## 2. Strong duplicate candidate — University of Calabar

| Inventory position | Display name | State | Institution UUID | Website |
|---:|---|---|---|---|
| 298 | University of Calabar | Cross River | `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` | `https://www.unical.edu.ng/` |
| 299 | University of Calabar, Calabar | Cross River | `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` | null |

**NUC canonical display name:** University of Calabar, Calabar. The NUC NUS directory lists one University of Calabar entry in Cross River State. The NUC federal-universities page also lists one University of Calabar entry and identifies its official website as `https://www.unical.edu.ng`.

**Proposed canonical display name:** `University of Calabar, Calabar`.

**Proposed action:** Treat row 298 as a duplicate candidate of row 299 (or vice versa) for investigation only. Prefer the row with the matching NUC canonical display name as the proposed canonical row, but do not choose the surviving UUID until dependent-record and historical-usage checks are complete. The website URL on row 298 is useful evidence and should be retained on the eventual canonical record.

**Required before merge/deletion:**
1. Inspect all foreign keys and application references to both UUIDs.
2. Compare admissions, courses/programmes, saved institutions, student applications, and any institution-linked content attached to either UUID.
3. Check which UUID is referenced by production UI routes, analytics, import jobs, and external integrations.
4. Decide whether the duplicate UUID can be safely aliased/redirected or whether a controlled merge migration is required.
5. Preserve a reversible mapping from the retired UUID to the canonical UUID.
6. Obtain explicit review before any production mutation.

## 3. NUC count reconciliation

The NUC's current NUS directory page reports:
- 77 federal universities
- 69 state universities
- 182 private universities
- Total: 328

The same directory page lists a single University of Calabar entry. A separate NUC news item about Jigawa Medical Varsity becoming Nigeria's 70th state-owned university also states that Nigeria then had 328 universities. The NUC's live summary and the news statement therefore contain an internal ownership-count inconsistency (69 versus 70 state universities) while both state the total as 328. Record this as a **NUC source inconsistency**, not as a reason to alter EduReach's ownership classifications without further evidence.

The 329-versus-328 discrepancy is consistent with the duplicate University of Calabar candidate identified above. This is a strong working explanation, not yet a completed row-by-row reconciliation of every inventory item against the live NUC registry.

## 4. Structural checks performed

| Check | Result | Interpretation |
|---|---:|---|
| JSON parse | Pass | File is valid JSON |
| Declared record count | 329 | Matches actual array length |
| Missing `schoolName` | 0 | No blank institution names |
| Missing `state` | 0 | No blank state labels |
| Missing `institutionId` | 0 | No blank UUIDs |
| Missing `institutionType` | 0 | No blank type values |
| Duplicate UUIDs | 0 | All row identifiers are distinct |
| Exact normalized duplicate names | 0 | No byte/format-level name duplicates |
| Semantic duplicate candidates | 1 strong candidate | University of Calabar rows 298 and 299 |
| Non-empty website URL collisions | 0 | Most website fields are null; this test has limited coverage |
| Distinct state/FCT labels | 37 | Includes FCT as a separate location label |
| Institution type values | 329 university | No other type values present |

**Important limitation:** `legacyIsVerifiedFlag` is a historical row-level flag, not proof that the institution's NUC status, current admission notice, programme approval, accreditation, or course requirements have been verified. `profileResearchStatus` and the separate research reports must be interpreted independently.

## 5. Source evidence

1. NUC, Nigerian University System directory: https://enuc.nuc.edu.ng/nus  
   Reports the 77 / 69 / 182 ownership counts and lists University of Calabar, Calabar once.
2. NUC, Federal Universities: https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/  
   Lists University of Calabar once and provides the official institutional website.
3. NUC, “Jigawa Medical Varsity Becomes Nigeria's 70th State-owned University”: https://www.nuc.edu.ng/jigawa-medical-varsity-becomes-nigerias-70th-state-owned-university/  
   States that Nigeria had 328 universities and refers to the 70th state-owned university, exposing a count breakdown inconsistency that should be tracked.

## 6. Next QA work

1. Complete a **row-by-row identity reconciliation** of all 329 inventory rows against the current NUC NUS directory, recording exact match, canonical-name variant, status discrepancy, or not found.
2. Produce a reviewed alias/canonical-name map. Do not overwrite the source names silently.
3. Audit institutional status and ownership/type against NUC records, including newly licensed institutions and name changes.
4. Only after identity reconciliation, begin programme-level validation: NUC programme approval/accreditation evidence and current JAMB IBASS subject combinations must be treated as separate checks.
5. Validate session-specific 2026/2027 admission requirements and cutoffs against primary institutional notices. Never promote a general UTME threshold into a departmental cutoff.

## 7. Release gate

**Not ready for production import.** The inventory is structurally valid, but the one-row count discrepancy and the University of Calabar duplicate candidate must be resolved through a reviewed migration plan. Programme accreditation and JAMB IBASS checks remain separate outstanding work.
