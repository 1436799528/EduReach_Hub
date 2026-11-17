/**
 * Institution normalizers — one canonical form per concept.
 *
 * Two rules matter more than the rest:
 *
 *  * Normalizing never invents. `normalizeOwnership` accepts only an explicit
 *    published value and returns `null` for everything else. "Federal
 *    University of Technology" does not make an institution federal; only a
 *    researched, published ownership row does.
 *  * A URL that is not http(s) is dropped. `www.unical.edu.ng` is not a link,
 *    and turning it into one is how a wrong portal address reaches a student.
 */

import {
  ALIAS_TYPES,
  ACADEMIC_UNIT_TYPES,
  ASSESSMENT_METHODS,
  BENCHMARK_TYPES,
  CAMPUS_TYPES,
  ENTRY_MODES,
  OWNERSHIPS,
  PORTAL_GUIDE_TYPES,
  VERIFICATION_STATUSES,
  type AcademicUnitType,
  type AliasType,
  type AssessmentMethod,
  type BenchmarkType,
  type CampusType,
  type EntryMode,
  type InstitutionCategory,
  type Ownership,
  type PortalGuideType,
  type VerificationStatus,
} from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admission sessions are written `2026/2027`: two consecutive calendar years. */
const SESSION = /^(\d{4})\/(\d{4})$/;

export function isInstitutionId(value: unknown): boolean {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * The URL-safe handle for an institution.
 *
 * This is the single implementation of the rule; `itemKey` in
 * `src/components/dashboard/SchoolFinderCard.tsx` re-exports it so the finder
 * card, the finder page and the details page cannot drift apart.
 */
export function institutionSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Only absolute http(s) URLs survive. Everything else is unknown, not guessed. */
export function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/** Trimmed non-empty text, or `null`. */
export function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 1800 && value <= 2100 ? Math.trunc(value) : null;
  }
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1800 && parsed <= 2100 ? parsed : null;
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Ownership.
 *
 * This function is deliberately unable to infer. It does not look at the
 * institution's name, its state, or any other field — those are the exact
 * shortcuts the data policy forbids. An unrecognized or absent value is
 * `null`, and `null` renders as no ownership badge at all.
 */
export function normalizeOwnership(value: unknown): Ownership | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return (OWNERSHIPS as readonly string[]).includes(normalized) ? (normalized as Ownership) : null;
}

const CATEGORIES: readonly string[] = [
  'university',
  'polytechnic',
  'monotechnic',
  'college_of_education',
  'college_of_agriculture',
  'college_of_nursing',
  'innovation_enterprise_institute',
  'other',
];

/**
 * The institution category.
 *
 * Unlike ownership, this one can be read off the directory's own
 * `institution_type` column, because that column is the directory's statement
 * about itself rather than a researched fact about the institution's owner.
 */
export function normalizeCategory(value: unknown): InstitutionCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (CATEGORIES.includes(normalized)) return normalized as InstitutionCategory;
  if (normalized.includes('polytechnic')) return 'polytechnic';
  if (normalized.includes('college')) {
    if (normalized.includes('nursing')) return 'college_of_nursing';
    if (normalized.includes('agricultur')) return 'college_of_agriculture';
    if (normalized.includes('education')) return 'college_of_education';
    return 'other';
  }
  if (normalized.includes('univers')) return 'university';
  return null;
}

export function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (typeof value !== 'string') return 'unresearched';
  const normalized = value.trim().toLowerCase();
  return (VERIFICATION_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as VerificationStatus)
    : 'unresearched';
}

export function normalizeAliasType(value: unknown): AliasType {
  if (typeof value !== 'string') return 'alternate_name';
  const normalized = value.trim().toLowerCase();
  return (ALIAS_TYPES as readonly string[]).includes(normalized) ? (normalized as AliasType) : 'alternate_name';
}

export function normalizeCampusType(value: unknown): CampusType {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  return (CAMPUS_TYPES as readonly string[]).includes(normalized) ? (normalized as CampusType) : 'other';
}

export function normalizeAcademicUnitType(value: unknown): AcademicUnitType {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  return (ACADEMIC_UNIT_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AcademicUnitType)
    : 'other';
}

export function normalizeEntryMode(value: unknown): EntryMode {
  if (typeof value !== 'string') return 'OTHER';
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (ENTRY_MODES as readonly string[]).includes(normalized) ? (normalized as EntryMode) : 'OTHER';
}

export function normalizeAssessmentMethod(value: unknown): AssessmentMethod {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (ASSESSMENT_METHODS as readonly string[]).includes(normalized)
    ? (normalized as AssessmentMethod)
    : 'other';
}

export function normalizeBenchmarkType(value: unknown): BenchmarkType {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  return (BENCHMARK_TYPES as readonly string[]).includes(normalized) ? (normalized as BenchmarkType) : 'other';
}

export function normalizePortalGuideType(value: unknown): PortalGuideType {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  return (PORTAL_GUIDE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as PortalGuideType)
    : 'other';
}

/**
 * An admission session, e.g. `2026/2027`.
 *
 * A malformed or non-consecutive pair is rejected rather than repaired, so a
 * stale row from an earlier cycle can never be presented as the current one.
 */
export function normalizeSession(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = SESSION.exec(trimmed);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return `${match[1]}/${match[2]}`;
}

/** Sessions newest first. Unparseable values sort last rather than first. */
export function sortSessions(sessions: Iterable<string>): string[] {
  return Array.from(new Set(sessions))
    .filter((session) => normalizeSession(session) !== null)
    .sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4)) || b.localeCompare(a));
}

/**
 * A score and its scale, kept together.
 *
 * A benchmark outside its declared scale is rejected: `250 / 100` is a data
 * error, and displaying it would put a UTME score and an aggregate in the same
 * column.
 */
export function normalizeScore(value: unknown, scaleMax: number, scaleMin = 0): number | null {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  const max = normalizeNumber(scaleMax);
  if (max === null || max <= scaleMin) return null;
  return parsed >= scaleMin && parsed <= max ? parsed : null;
}

/** A JSON object column. Arrays and scalars collapse to an empty object. */
export function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

/** A text column array. Non-strings and duplicates are dropped. */
export function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const text = normalizeText(entry);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}
