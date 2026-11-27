/**
 * Canonical identity resolution.
 *
 * The production directory contains two rows for the University of Calabar:
 *
 *   * `1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc` — “University of Calabar”, and
 *   * `255e4ba4-b75f-48b1-8ed1-00a7fcb8a967` — “University of Calabar, Calabar”.
 *
 * The canonical row carries 68 dependent rows, and neither row may be deleted
 * or merged by this task. So the resolution happens here, in the read path:
 *
 *   * the canonical row is the only one rendered in the public directory;
 *   * the alternate name and every legacy slug still resolve to it, so an old
 *     bookmarked link keeps working;
 *   * the secondary row's own identity is preserved — it is filtered out of a
 *     listing, never rewritten out of the database.
 *
 * These entries are identity records, not researched facts: they say “these two
 * rows are the same institution”, which is exactly the reconciliation decision
 * `docs/data/INSTITUTION-DATA-FOUNDATION.md` §7 step 1 records. Nothing here
 * claims anything else about either institution.
 */

import { institutionSlug } from './normalizers';

export interface KnownIdentityAlias {
  /** The row the public surfaces must show. */
  canonicalId: string;
  /** Row ids that must resolve to `canonicalId` instead of being listed. */
  aliasIds: string[];
  /**
   * Extra slugs that must resolve to `canonicalId`. Derived in part from the
   * alias row's own name so an existing `/schools/<slug>` link survives.
   */
  aliasSlugs: string[];
  /** Alternate names that must find the canonical row in search. */
  aliasNames: string[];
  /** Shown in the UI when a legacy route is resolved this way. */
  note: string;
}

export const KNOWN_IDENTITY_ALIASES: readonly KnownIdentityAlias[] = [
  {
    canonicalId: '1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc',
    aliasIds: ['255e4ba4-b75f-48b1-8ed1-00a7fcb8a967'],
    aliasSlugs: ['university-of-calabar-calabar'],
    aliasNames: ['University of Calabar, Calabar'],
    note: 'This institution also appears in the directory as “University of Calabar, Calabar”. Both names belong to the same institution.',
  },
];

/** Slug (or UUID) → canonical UUID, for the identities recorded above. */
const SLUG_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const entry of KNOWN_IDENTITY_ALIASES) {
    for (const aliasId of entry.aliasIds) map.set(aliasId.toLowerCase(), entry.canonicalId);
    for (const slug of entry.aliasSlugs) map.set(institutionSlug(slug), entry.canonicalId);
  }
  return map;
})();

/** UUID → the canonical UUID that must be displayed in its place. */
const ID_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const entry of KNOWN_IDENTITY_ALIASES) {
    for (const aliasId of entry.aliasIds) map.set(aliasId.toLowerCase(), entry.canonicalId);
  }
  return map;
})();

/** Canonical UUID → the identity record describing it. */
const CANONICAL_TO_ENTRY: ReadonlyMap<string, KnownIdentityAlias> = new Map(
  KNOWN_IDENTITY_ALIASES.map((entry) => [entry.canonicalId.toLowerCase(), entry]),
);

/** The canonical id for a raw UUID, or the same UUID when there is no alias. */
export function canonicalInstitutionId(id: string): string {
  return ID_TO_CANONICAL.get(id.trim().toLowerCase()) ?? id;
}

/**
 * Verified search aliases for a canonical directory row.
 *
 * The NUC registry (data/institutions/nuc-registry-2026-11-17.json) and the
 * institution's own official site publish names a student may type that the
 * production `school_name` does not carry. These entries are sourced name
 * variants only — they never rename the directory row, never create a second
 * institution, and every name is traceable to the registry record or the
 * institution's official website (see `source`).
 *
 * The first entry: the University of Abuja (UniAbuja) sits at Gwagwalada; the
 * registry lists it as “University of Abuja, Gwagwalada” while the production
 * directory row is “University of Abuja, Abuja” (reconciled in
 * data/institutions/registry-coverage.json as `curated_alias`). Gwagwalada is
 * the campus location, not a separate state university.
 */
export interface VerifiedSearchAlias {
  name: string;
  type: 'acronym' | 'alternate_name' | 'official_variant';
  /** Where this spelling is published, so an alias can be audited. */
  source: string;
}

export const VERIFIED_SEARCH_ALIASES: Readonly<Record<string, readonly VerifiedSearchAlias[]>> = {
  // University of Abuja — production row "University of Abuja, Abuja".
  '9b164365-d366-4ff7-a432-b6713a89cea0': [
    {
      name: 'University of Abuja',
      type: 'official_variant',
      source: 'NUC registry 2026-11-17 (federal row 27) and https://www.uniabuja.edu.ng',
    },
    {
      name: 'University of Abuja, Gwagwalada',
      type: 'official_variant',
      source: 'NUC registry 2026-11-17 (federal row 27, “University of Abuja, Gwagwalada”)',
    },
    {
      name: 'UniAbuja',
      type: 'acronym',
      source: 'https://www.uniabuja.edu.ng',
    },
    {
      name: 'Gwagwalada',
      type: 'alternate_name',
      source: 'NUC registry 2026-11-17 (federal row 27) — Gwagwalada is this university’s campus location',
    },
  ],
};

/** Verified search aliases recorded for a canonical id, or an empty list. */
export function verifiedSearchAliasesFor(id: string): readonly VerifiedSearchAlias[] {
  return VERIFIED_SEARCH_ALIASES[id.trim().toLowerCase()] ?? [];
}

/** The canonical id for a slug, when the slug is a recorded legacy alias. */
export function canonicalIdForSlug(slug: string): string | null {
  return SLUG_TO_CANONICAL.get(institutionSlug(slug)) ?? null;
}

/** The identity record for a canonical id, when one exists. */
export function identityAliasFor(id: string): KnownIdentityAlias | null {
  return CANONICAL_TO_ENTRY.get(id.trim().toLowerCase()) ?? null;
}

/**
 * Search names that belong to a canonical id but are not the canonical row's
 * own `school_name` — the alternate spellings a student may type.
 */
export function aliasNamesFor(id: string): string[] {
  return identityAliasFor(id)?.aliasNames ?? [];
}

/** True when a row is a known duplicate of another row that is also present. */
export function isSuppressedDuplicate(id: string, presentIds: Iterable<string>): boolean {
  const canonical = canonicalInstitutionId(id);
  if (canonical === id) return false;
  const present = new Set(Array.from(presentIds, (value) => value.trim().toLowerCase()));
  // If the canonical row is missing from this result set, the alias row is the
  // only copy the student can reach, so it stays visible.
  return present.has(canonical.toLowerCase());
}
