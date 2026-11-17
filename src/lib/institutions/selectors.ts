/**
 * Institution selectors — pure search, filter and de-duplication.
 *
 * Kept out of the pages so the finder, the dashboard card and the details page
 * behave identically, and so the rules are testable without a browser.
 *
 * The de-duplication rule is the important one: when two directory rows are
 * known to be the same institution, the alias row is hidden from the listing
 * and its name becomes a search alias for the canonical row. No row is deleted,
 * merged or rewritten — this is a read-path decision only.
 */

import { canonicalInstitutionId, isSuppressedDuplicate } from './aliases';
import { institutionSlug, isInstitutionId } from './normalizers';

export { institutionSlug };
import type { InstitutionSummary, Ownership } from './types';

export interface InstitutionFilter {
  term: string;
  state: string | null;
  ownership: Ownership | null;
  /** Free-text match against `institution_type`. */
  type: string | null;
}

export const EMPTY_FILTER: InstitutionFilter = { term: '', state: null, ownership: null, type: null };

/** Everything a student may reasonably type to find this institution. */
export function institutionSearchText(institution: InstitutionSummary): string {
  return [
    institution.name,
    institution.acronym,
    institution.state,
    institution.institutionType,
    institution.slug,
    ...institution.aliases.map((alias) => alias.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Every whitespace-separated token must appear somewhere in the haystack, so
 * “calabar unical” and “unical calabar” both work. A trailing comma or a
 * different word order is not a reason to miss the institution.
 */
export function matchesTerm(institution: InstitutionSummary, term: string): boolean {
  const tokens = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = institutionSearchText(institution);
  return tokens.every((token) => haystack.includes(token));
}

/** True when the term matched an alias rather than the canonical name. */
export function matchedViaAlias(institution: InstitutionSummary, term: string): boolean {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return false;
  const inName = institution.name.toLowerCase().includes(trimmed);
  return !inName && institution.aliases.some((alias) => alias.name.toLowerCase().includes(trimmed));
}

export function matchesFilter(institution: InstitutionSummary, filter: Partial<InstitutionFilter>): boolean {
  if (filter.term !== undefined && !matchesTerm(institution, filter.term)) return false;
  if (filter.state && institution.state !== filter.state) return false;
  // An ownership filter can only ever narrow to institutions whose ownership
  // is actually published. With an unknown-ownership directory it matches
  // nothing rather than guessing a category from the name.
  if (filter.ownership && institution.ownership !== filter.ownership) return false;
  if (filter.type) {
    const type = String(institution.institutionType || '').toLowerCase();
    if (!type.includes(filter.type.toLowerCase())) return false;
  }
  return true;
}

/**
 * Hide the duplicate copy of an institution whose canonical row is present.
 *
 * The alias row is dropped from the *listing* only. Its id still resolves, and
 * its names are carried by the canonical row through `aliases`.
 */
export function deduplicateInstitutions<T extends InstitutionSummary>(institutions: T[]): T[] {
  const ids = institutions.map((institution) => institution.id);
  return institutions.filter((institution) => !isSuppressedDuplicate(institution.id, ids));
}

export function searchInstitutions<T extends InstitutionSummary>(
  institutions: T[],
  filter: Partial<InstitutionFilter> = {},
): T[] {
  return deduplicateInstitutions(institutions).filter((institution) => matchesFilter(institution, filter));
}

/** Canonical name order, then state, so the listing is stable between loads. */
export function sortInstitutions<T extends InstitutionSummary>(institutions: T[]): T[] {
  return [...institutions].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
      String(a.state || '').localeCompare(String(b.state || ''), 'en', { sensitivity: 'base' }),
  );
}

export function statesOf(institutions: InstitutionSummary[]): string[] {
  return Array.from(
    new Set(institutions.map((institution) => institution.state).filter((state): state is string => Boolean(state))),
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/**
 * Ownership values that actually occur in this result set.
 *
 * The finder offers a control for each one present and says nothing about
 * ownership when none is — it never offers a filter that would return an
 * empty list because the data has not been imported.
 */
export function ownershipsOf(institutions: InstitutionSummary[]): Ownership[] {
  const present = new Set(
    institutions.map((institution) => institution.ownership).filter((value): value is Ownership => value !== null),
  );
  return (['federal', 'state', 'private'] as const).filter((value) => present.has(value));
}

/** Institution types present in the set, normalised for a filter control. */
export function typesOf(institutions: InstitutionSummary[]): string[] {
  return Array.from(
    new Set(
      institutions
        .map((institution) => institution.institutionType)
        .filter((type): type is string => Boolean(type)),
    ),
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export interface DirectoryFacets {
  states: string[];
  ownerships: Ownership[];
  types: string[];
}

export function facetsOf(institutions: InstitutionSummary[]): DirectoryFacets {
  return {
    states: statesOf(institutions),
    ownerships: ownershipsOf(institutions),
    types: typesOf(institutions),
  };
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a route segment to one institution.
 *
 * Accepts, in order: a canonical UUID, an alias UUID that maps to a canonical
 * row, an exact slug, and an acronym. Returns the canonical row in every case,
 * so `/schools/university-of-calabar-calabar` and `/schools/university-of-calabar`
 * reach the same institution.
 */
export function resolveInstitution<T extends InstitutionSummary>(
  institutions: T[],
  slugOrId: string,
): T | null {
  const raw = decodeURIComponent(slugOrId || '').trim();
  if (!raw) return null;

  // A UUID is an identity, not a slug. An alias UUID resolves to the row the
  // reconciliation layer says it belongs to.
  if (isInstitutionId(raw)) {
    const canonical = canonicalInstitutionId(raw);
    const byCanonicalId = institutions.find((institution) => institution.id.toLowerCase() === canonical.toLowerCase());
    if (byCanonicalId) return byCanonicalId;
  }

  const byId = institutions.find((institution) => institution.id.toLowerCase() === raw.toLowerCase());
  if (byId) {
    const canonical = canonicalInstitutionId(byId.id);
    if (canonical !== byId.id) {
      const canonicalRow = institutions.find((institution) => institution.id === canonical);
      if (canonicalRow) return canonicalRow;
    }
    return byId;
  }

  const normalized = institutionSlug(raw);
  const bySlug = institutions.find(
    (institution) => institution.slug && institutionSlug(institution.slug) === normalized,
  );
  if (bySlug) return bySlug;

  const byName = institutions.find((institution) => institutionSlug(institution.name) === normalized);
  if (byName) return byName;

  const byAcronym = institutions.find(
    (institution) => institution.acronym && institutionSlug(institution.acronym) === normalized,
  );
  if (byAcronym) return byAcronym;

  // Last resort: a row whose known alias matches. This is what lets the
  // University of Calabar's second name keep resolving after reconciliation.
  const byAlias = institutions.find((institution) =>
    institution.aliases.some((alias) => institutionSlug(alias.name) === normalized),
  );
  return byAlias ?? null;
}

/** Resolve a free-text school name (a profile's `school` column) to a row. */
export function resolveInstitutionByName<T extends InstitutionSummary>(
  institutions: T[],
  name: string,
): T | null {
  const raw = name.trim();
  if (!raw) return null;
  const exact = institutions.find(
    (institution) => institution.name.trim().toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return exact;
  const slug = institutionSlug(raw);
  return (
    institutions.find((institution) => institutionSlug(institution.name) === slug) ??
    institutions.find((institution) =>
      institution.aliases.some((alias) => institutionSlug(alias.name) === slug),
    ) ??
    null
  );
}
