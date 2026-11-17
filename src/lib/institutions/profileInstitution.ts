/**
 * Profile ↔ institution identity.
 *
 * The profile's `school` column is free text and stays free text: institutions
 * outside the directory are real, and a student who typed theirs in must not
 * lose it. What this module adds is the canonical id *alongside* it, so that
 * once the intelligence data lands the student's choice resolves to one stable
 * institution row instead of a string comparison.
 *
 * Three hard rules:
 *
 *   1. Nothing here overwrites an existing `school` value. Ever.
 *   2. Nothing here bulk-updates profile rows.
 *   3. Nothing here writes `institution_id` to the database, because
 *      `public.profiles` has no such column. Adding it is a migration, and this
 *      task applies none. `profileInstitutionColumnDeployed()` is the single
 *      place that fact is recorded, and `institutionIdWrite()` returns an
 *      empty object until it changes — so the save path stays valid SQL.
 */

import { canonicalInstitutionId } from './aliases';
import { isInstitutionId } from './normalizers';
import { resolveInstitutionByName } from './selectors';
import type { InstitutionSummary } from './types';

const STORAGE_PREFIX = 'edureach.institution-selection.v1';

/**
 * The canonical id a student chose, remembered for the next save.
 *
 * Session storage, not a database write: it survives the profile-completion
 * flow without creating a column that does not exist.
 */
export interface InstitutionSelection {
  institutionId: string;
  institutionName: string;
  /** How the id was established: chosen from the live directory, or matched
   *  from a free-text school name that is already in the profile. */
  source: 'directory' | 'matched';
  selectedAt: string;
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Private browsing modes can throw on access; the selection is a
    // convenience, so losing it is not an error the student should see.
    return null;
  }
}

export function rememberInstitutionSelection(userId: string, selection: InstitutionSelection): void {
  const store = safeStorage();
  if (!store || !isInstitutionId(selection.institutionId)) return;
  try {
    store.setItem(storageKey(userId), JSON.stringify(selection));
  } catch {
    /* quota or disabled storage: the selection is not critical */
  }
}

export function readInstitutionSelection(userId: string): InstitutionSelection | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InstitutionSelection;
    if (!parsed || !isInstitutionId(parsed.institutionId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearInstitutionSelection(userId: string): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve a profile's existing free-text school to a canonical institution.
 *
 * `source: 'matched'` and the original string is returned untouched so a caller
 * can record the id without rewriting what the student typed. A name that is
 * not in the directory resolves to `null`, not to a closest guess.
 */
export function matchProfileInstitution(
  institutions: InstitutionSummary[],
  schoolName: string,
): InstitutionSelection | null {
  if (!schoolName.trim()) return null;
  const match = resolveInstitutionByName(institutions, schoolName);
  if (!match) return null;
  return {
    institutionId: canonicalInstitutionId(match.id),
    institutionName: match.name,
    source: 'matched',
    selectedAt: new Date().toISOString(),
  };
}

/** The column the profile row would need for a canonical institution id. */
export const PROFILE_INSTITUTION_ID_COLUMN = 'institution_id';

/**
 * Whether `public.profiles.institution_id` exists in the target database.
 *
 * It does not. This is the backend dependency the profile side of the
 * institution work is waiting on, recorded in one place so the save path has
 * nothing to guess about.
 */
export function profileInstitutionColumnDeployed(): boolean {
  return false;
}

/**
 * The payload fragment for a profile write.
 *
 * Empty while the column is undeployed, so `saveStudentProfile` never sends a
 * column PostgreSQL will reject. When the column lands, this is the only line
 * that changes.
 */
export function institutionIdWrite(selection: InstitutionSelection | null): Record<string, string> {
  if (!selection || !profileInstitutionColumnDeployed()) return {};
  if (!isInstitutionId(selection.institutionId)) return {};
  return { [PROFILE_INSTITUTION_ID_COLUMN]: selection.institutionId };
}
