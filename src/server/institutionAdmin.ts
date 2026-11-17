/**
 * Institution review centre: the rules, kept separate from Express.
 *
 * Everything in this file is pure: validation, the publication gate, the
 * completeness checklist and the queue filters. The route handlers in
 * `institutionIntelligence.ts` call these functions, and the tests call the same
 * functions directly — so "publishing requires verification" is proven once,
 * not asserted in prose and hoped for in three different handlers.
 *
 * Two editorial rules shape the whole module:
 *
 *   1. **Nothing is discarded.** A field or programme with no verified source is
 *      still returned to the administrator. Only the *public* view filters on
 *      verification and publication.
 *   2. **Publication is not verification.** `publication_status = 'published'`
 *      is refused unless `verification_status = 'verified'`; the database
 *      enforces the same rule in
 *      `20261118120000_institution_review_gate.sql`, so an API mistake cannot
 *      slip past it.
 */

export const VERIFICATION_STATUSES = [
  'unresearched',
  'discovered',
  'in_review',
  'verified',
  'disputed',
  'outdated',
  'unpublished_by_institution',
] as const;

export const PUBLICATION_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PROFILE_SECTIONS = ['identity', 'history', 'portals', 'images', 'verification'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = /^(\d{4})\/(\d{4})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface Validation<T> {
  ok: boolean;
  value?: T;
  error?: string;
  /** Present when the only problem is the publication gate. */
  gate?: boolean;
}

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isPublicationStatus(value: unknown): value is PublicationStatus {
  return typeof value === 'string' && (PUBLICATION_STATUSES as readonly string[]).includes(value);
}

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID.test(value);
}

export function isAdmissionSession(value: unknown): boolean {
  const match = SESSION.exec(String(value ?? '').trim());
  return Boolean(match) && Number(match![2]) === Number(match![1]) + 1;
}

/**
 * The publication gate. Verification is a statement about evidence; publication
 * is a statement about whether students may see it. The second is only allowed
 * once the first is true.
 */
export function publicationGate(
  verification: string | null | undefined,
  publication: string | null | undefined,
): Validation<null> {
  if (publication !== 'published') return { ok: true };
  if (verification === 'verified') return { ok: true };
  return {
    ok: false,
    gate: true,
    error: `Cannot publish while the verification status is ${humanStatus(verification)}. Verify the facts and their source first, then publish.`,
  };
}

export function humanStatus(value: string | null | undefined): string {
  return String(value || 'unresearched').replace(/_/g, ' ');
}

/* -------------------------------------------------------------------------- */
/* Field cleaning                                                             */
/* -------------------------------------------------------------------------- */

function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\r\n/g, '\n').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function requiredText(value: unknown, max: number, label: string): Validation<string> {
  const cleaned = text(value, max);
  if (!cleaned) return { ok: false, error: `${label} is required.` };
  return { ok: true, value: cleaned };
}

export function cleanUrl(value: unknown, label = 'URL'): Validation<string | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  const raw = String(value).trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > 2048) return { ok: false, error: `${label} is too long.` };
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    if (/\s/.test(raw)) return { ok: false, error: `${label} cannot contain spaces.` };
    return { ok: true, value: raw };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: `${label} must be a full https:// address or a path on this site.` };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: `${label} must use http:// or https://.` };
  }
  if (url.username || url.password) {
    return { ok: false, error: `${label} must not contain a username or password.` };
  }
  return { ok: true, value: url.toString() };
}

function boolOrNull(value: unknown, label: string): Validation<boolean | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'boolean') return { ok: false, error: `${label} must be yes or no.` };
  return { ok: true, value };
}

function integerOrNull(value: unknown, min: number, max: number, label: string): Validation<number | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `${label} must be a whole number between ${min} and ${max}.` };
  }
  return { ok: true, value: parsed };
}

function numberOrNull(value: unknown, min: number, max: number, label: string): Validation<number | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `${label} must be a number between ${min} and ${max}.` };
  }
  return { ok: true, value: parsed };
}

function dateOrNull(value: unknown, label: string): Validation<string | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const raw = String(value).trim();
  if (!DATE.test(raw) || Number.isNaN(Date.parse(raw))) return { ok: false, error: `${label} must be a date (YYYY-MM-DD).` };
  return { ok: true, value: raw };
}

function stringList(value: unknown, maxItems: number, maxLength: number, label: string): Validation<string[]> {
  const input = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!input) return { ok: false, error: `${label} must be a list.` };
  const list: string[] = [];
  for (const entry of input) {
    const cleaned = String(entry ?? '').trim();
    if (!cleaned) continue;
    if (cleaned.length > maxLength) return { ok: false, error: `${label} has an entry that is too long.` };
    if (!list.includes(cleaned)) list.push(cleaned);
  }
  if (list.length > maxItems) return { ok: false, error: `${label} has too many entries (maximum ${maxItems}).` };
  return { ok: true, value: list };
}

/** Merge structured O'/A'Level edits into the stored object without dropping other keys. */
export function mergeLevelRequirements(
  current: unknown,
  patch: unknown,
  label: string,
): Validation<Record<string, unknown> | undefined> {
  if (patch === undefined) return { ok: true, value: undefined };
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: `${label} must be an object with credits and subjects.` };
  }
  const body = patch as Record<string, unknown>;
  if ('credits' in body) {
    const credits = integerOrNull(body.credits, 0, 12, `${label} credits`);
    if (!credits.ok) return { ok: false, error: credits.error };
    if (credits.value === null) delete base.credits;
    else base.credits = credits.value;
  }
  if ('subjects' in body) {
    if (body.subjects === null) delete base.subjects;
    else {
      const subjects = stringList(body.subjects, 12, 80, `${label} subjects`);
      if (!subjects.ok) return { ok: false, error: subjects.error };
      base.subjects = subjects.value;
    }
  }
  if ('summary' in body) {
    const summary = text(body.summary, 2000);
    if (summary === null) delete base.summary;
    else base.summary = summary;
  }
  return { ok: true, value: base };
}

/* -------------------------------------------------------------------------- */
/* Profile sections                                                          */
/* -------------------------------------------------------------------------- */

const PROFILE_FIELDS: Record<ProfileSection, readonly string[]> = {
  identity: ['official_name', 'ownership', 'institution_category', 'year_established', 'city', 'postal_address', 'country'],
  history: ['history_summary', 'overview', 'mission', 'vision', 'mandate'],
  portals: ['official_website_url', 'admission_portal_url', 'student_portal_url', 'postgraduate_portal_url'],
  images: ['logo_url', 'hero_image_url'],
  verification: ['verification_status', 'publication_status', 'review_note', 'source_url'],
};

/** Directory fields on `institutions` that the identity section may correct. */
const DIRECTORY_FIELDS = ['school_name', 'acronym', 'state', 'institution_type', 'website_url'] as const;

const OWNERSHIPS = ['federal', 'state', 'private', 'other', 'unknown'] as const;
const CATEGORIES = [
  'university', 'polytechnic', 'monotechnic', 'college_of_education', 'college_of_agriculture',
  'college_of_nursing', 'innovation_enterprise_institute', 'other',
] as const;

export interface ProfilePatchResult {
  profile: Record<string, unknown>;
  directory: Record<string, unknown>;
  /** Effective statuses after the patch, for the response and the audit entry. */
  verification: VerificationStatus;
  publication: PublicationStatus;
}

export interface ProfileReviewState {
  verification_status?: string | null;
  publication_status?: string | null;
}

export function validateProfileSection(
  section: string,
  body: unknown,
  current: ProfileReviewState,
): Validation<ProfilePatchResult> {
  if (!(PROFILE_SECTIONS as readonly string[]).includes(section)) {
    return { ok: false, error: 'Unknown profile section.' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Send the section as an object of fields.' };
  }
  const input = body as Record<string, unknown>;
  const allowed = section === 'identity'
    ? [...PROFILE_FIELDS.identity, ...DIRECTORY_FIELDS]
    : PROFILE_FIELDS[section as ProfileSection];
  // Directory columns are not "unknown" outside identity: they have a home, and
  // the message below says where it is. Everything else is a typo or a field the
  // form does not own.
  const directoryHere = section === 'identity' ? [] : DIRECTORY_FIELDS as readonly string[];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key) && !directoryHere.includes(key));
  if (unknown.length) {
    return { ok: false, error: `Unknown field${unknown.length === 1 ? '' : 's'} for ${section}: ${unknown.join(', ')}.` };
  }
  if (!Object.keys(input).length) return { ok: false, error: 'No fields to save.' };

  const profile: Record<string, unknown> = {};
  const directory: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(input)) {
    switch (key) {
      case 'official_name': {
        const value = text(raw, 240);
        if (!value) return { ok: false, error: 'Official name cannot be empty.' };
        profile.official_name = value;
        break;
      }
      case 'ownership': {
        if (raw !== null && !(OWNERSHIPS as readonly string[]).includes(String(raw))) {
          return { ok: false, error: 'Ownership must be federal, state, private, other or unknown.' };
        }
        profile.ownership = raw === null ? null : String(raw);
        break;
      }
      case 'institution_category': {
        if (raw !== null && !(CATEGORIES as readonly string[]).includes(String(raw))) {
          return { ok: false, error: 'Choose a known institution category.' };
        }
        profile.institution_category = raw === null ? null : String(raw);
        break;
      }
      case 'year_established': {
        const value = integerOrNull(raw, 1800, 2100, 'Year established');
        if (!value.ok) return { ok: false, error: value.error };
        profile.year_established = value.value;
        break;
      }
      case 'city': profile.city = text(raw, 120); break;
      case 'postal_address': profile.postal_address = text(raw, 600); break;
      case 'country': {
        const value = text(raw, 80) ?? 'Nigeria';
        profile.country = value;
        break;
      }
      case 'history_summary': profile.history_summary = text(raw, 8000); break;
      case 'overview': profile.overview = text(raw, 6000); break;
      case 'mission': profile.mission = text(raw, 4000); break;
      case 'vision': profile.vision = text(raw, 4000); break;
      case 'mandate': profile.mandate = text(raw, 4000); break;
      case 'official_website_url':
      case 'admission_portal_url':
      case 'student_portal_url':
      case 'postgraduate_portal_url': {
        const value = cleanUrl(raw, key.replace(/_/g, ' '));
        if (!value.ok) return { ok: false, error: value.error };
        profile[key] = value.value;
        break;
      }
      case 'logo_url':
      case 'hero_image_url': {
        const value = cleanUrl(raw, key.replace(/_/g, ' '));
        if (!value.ok) return { ok: false, error: value.error };
        profile[key] = value.value;
        break;
      }
      case 'review_note': profile.review_note = text(raw, 2000); break;
      case 'source_url': {
        const value = cleanUrl(raw, 'Source URL');
        if (!value.ok) return { ok: false, error: value.error };
        profile.source_url = value.value;
        break;
      }
      case 'verification_status': {
        if (!isVerificationStatus(raw)) return { ok: false, error: 'Choose a known verification status.' };
        profile.verification_status = raw;
        break;
      }
      case 'publication_status': {
        if (!isPublicationStatus(raw)) return { ok: false, error: 'Choose draft, in review, published or archived.' };
        profile.publication_status = raw;
        break;
      }
      default: break;
    }
  }

  // Identity also corrects the directory row: the name a student sees in search.
  if (section === 'identity') {
    const directoryInput = input as Record<string, unknown>;
    if ('school_name' in directoryInput) {
      const value = requiredText(directoryInput.school_name, 200, 'Institution name');
      if (!value.ok || !value.value) return { ok: false, error: value.error };
      directory.school_name = value.value;
    }
    if ('acronym' in directoryInput) directory.acronym = text(directoryInput.acronym, 30);
    if ('state' in directoryInput) directory.state = text(directoryInput.state, 80);
    if ('institution_type' in directoryInput) directory.institution_type = text(directoryInput.institution_type, 60);
    if ('website_url' in directoryInput) {
      const value = cleanUrl(directoryInput.website_url, 'Website URL');
      if (!value.ok) return { ok: false, error: value.error };
      directory.website_url = value.value;
    }
  } else if (Object.keys(input).some((key) => (DIRECTORY_FIELDS as readonly string[]).includes(key))) {
    return { ok: false, error: 'Institution name, acronym, state and type are edited in the identity section.' };
  }

  const verification = (profile.verification_status as VerificationStatus | undefined)
    ?? (isVerificationStatus(current.verification_status) ? current.verification_status : 'unresearched');
  const publication = (profile.publication_status as PublicationStatus | undefined)
    ?? (isPublicationStatus(current.publication_status) ? current.publication_status : 'draft');
  const gate = publicationGate(verification, publication);
  if (!gate.ok) return { ok: false, error: gate.error, gate: true };

  return { ok: true, value: { profile, directory, verification, publication } };
}

/* -------------------------------------------------------------------------- */
/* Programme, unit, route and requirement edits                              */
/* -------------------------------------------------------------------------- */

const UNIT_TYPES = ['faculty', 'college', 'school', 'institute', 'centre', 'department', 'division', 'other'] as const;
const ENTRY_MODES = ['UTME', 'DIRECT_ENTRY', 'JUPEB', 'IJMB', 'PRE_DEGREE', 'DIPLOMA', 'ND', 'HND', 'TRANSFER', 'OTHER'] as const;

export interface OfferingState {
  id?: string;
  institution_id?: string;
  verification_status?: string | null;
  publication_status?: string | null;
  academic_unit_id?: string | null;
}

export interface ProgrammePatch {
  values: Record<string, unknown>;
  verification: VerificationStatus;
  publication: PublicationStatus;
}

export function validateProgrammePatch(body: unknown, current: OfferingState): Validation<ProgrammePatch> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the programme fields as an object.' };
  const input = body as Record<string, unknown>;
  const allowed = [
    'programme_name', 'programme_code', 'academic_unit_id', 'degree_title', 'award_level',
    'duration_years', 'admission_session', 'is_active', 'verification_status',
    'publication_status', 'source_url', 'review_note',
  ];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { ok: false, error: `Unknown programme field: ${unknown.join(', ')}.` };
  if (!Object.keys(input).length) return { ok: false, error: 'No fields to save.' };

  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    switch (key) {
      case 'programme_name': {
        const value = requiredText(raw, 240, 'Programme name');
        if (!value.ok || !value.value) return { ok: false, error: value.error };
        values.programme_name = value.value;
        break;
      }
      case 'programme_code': values.programme_code = text(raw, 60); break;
      case 'degree_title': values.degree_title = text(raw, 200); break;
      case 'award_level': values.award_level = text(raw, 80); break;
      case 'academic_unit_id': {
        if (raw !== null && raw !== '' && !isUuid(raw)) return { ok: false, error: 'Choose a valid academic unit.' };
        values.academic_unit_id = raw === '' ? null : raw;
        break;
      }
      case 'duration_years': {
        const value = numberOrNull(raw, 0.5, 15, 'Duration');
        if (!value.ok) return { ok: false, error: value.error };
        values.duration_years = value.value;
        break;
      }
      case 'admission_session': {
        if (raw !== null && raw !== '' && !isAdmissionSession(raw)) {
          return { ok: false, error: 'Admission session must look like 2026/2027.' };
        }
        values.admission_session = raw === '' ? null : raw;
        break;
      }
      case 'is_active': {
        if (typeof raw !== 'boolean') return { ok: false, error: 'Active must be yes or no.' };
        values.is_active = raw;
        break;
      }
      case 'verification_status': {
        if (!isVerificationStatus(raw)) return { ok: false, error: 'Choose a known verification status.' };
        values.verification_status = raw;
        break;
      }
      case 'publication_status': {
        if (!isPublicationStatus(raw)) return { ok: false, error: 'Choose draft, in review, published or archived.' };
        values.publication_status = raw;
        break;
      }
      case 'source_url': {
        const value = cleanUrl(raw, 'Source URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.source_url = value.value;
        break;
      }
      case 'review_note': values.review_note = text(raw, 2000); break;
      default: break;
    }
  }

  const verification = (values.verification_status as VerificationStatus | undefined)
    ?? (isVerificationStatus(current.verification_status) ? current.verification_status : 'unresearched');
  const publication = (values.publication_status as PublicationStatus | undefined)
    ?? (isPublicationStatus(current.publication_status) ? current.publication_status : 'draft');
  const gate = publicationGate(verification, publication);
  if (!gate.ok) return { ok: false, error: gate.error, gate: true };

  return { ok: true, value: { values, verification, publication } };
}

export interface UnitState {
  id?: string;
  institution_id?: string;
  unit_type?: string | null;
  verification_status?: string | null;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function validateUnitPatch(
  body: unknown,
  current: UnitState,
  siblings: Array<{ id: string; unit_type: string; slug: string; parent_unit_id: string | null }>,
): Validation<Record<string, unknown>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the academic unit fields as an object.' };
  const input = body as Record<string, unknown>;
  const allowed = ['unit_type', 'unit_name', 'parent_unit_id', 'description', 'website_url', 'is_active', 'verification_status', 'source_url', 'review_note'];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { ok: false, error: `Unknown academic unit field: ${unknown.join(', ')}.` };
  if (!Object.keys(input).length) return { ok: false, error: 'No fields to save.' };

  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    switch (key) {
      case 'unit_type': {
        if (!(UNIT_TYPES as readonly string[]).includes(String(raw))) return { ok: false, error: 'Choose a known unit type.' };
        values.unit_type = String(raw);
        break;
      }
      case 'unit_name': {
        const value = requiredText(raw, 200, 'Unit name');
        if (!value.ok || !value.value) return { ok: false, error: value.error };
        values.unit_name = value.value;
        values.slug = slugify(value.value);
        break;
      }
      case 'parent_unit_id': {
        if (raw !== null && raw !== '' && !isUuid(raw)) return { ok: false, error: 'Choose a valid parent unit.' };
        if (raw && current.id && raw === current.id) return { ok: false, error: 'A unit cannot be its own parent.' };
        values.parent_unit_id = raw === '' ? null : raw;
        break;
      }
      case 'description': values.description = text(raw, 2000); break;
      case 'website_url': {
        const value = cleanUrl(raw, 'Website URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.website_url = value.value;
        break;
      }
      case 'is_active': {
        if (typeof raw !== 'boolean') return { ok: false, error: 'Active must be yes or no.' };
        values.is_active = raw;
        break;
      }
      case 'verification_status': {
        if (!isVerificationStatus(raw)) return { ok: false, error: 'Choose a known verification status.' };
        values.verification_status = raw;
        break;
      }
      case 'source_url': {
        const value = cleanUrl(raw, 'Source URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.source_url = value.value;
        break;
      }
      case 'review_note': values.review_note = text(raw, 2000); break;
      default: break;
    }
  }

  // The hierarchy is real: a unit's position is (parent, type, slug), and the
  // database has a unique index for it. Say so here in words an editor can act on.
  const effectiveParent = 'parent_unit_id' in values ? values.parent_unit_id as string | null : current.id
    ? siblings.find((unit) => unit.id === current.id)?.parent_unit_id ?? null
    : null;
  const effectiveType = String(values.unit_type ?? current.unit_type ?? '');
  const effectiveSlug = String(values.slug ?? (current as { slug?: string }).slug ?? '');
  const clash = siblings.find((unit) => unit.id !== current.id
    && unit.unit_type === effectiveType
    && unit.slug === effectiveSlug
    && (unit.parent_unit_id ?? null) === (effectiveParent ?? null));
  if (clash) return { ok: false, error: 'Another unit already has that name under the same parent. Rename it or choose a different parent.' };

  return { ok: true, value: values };
}

export function validateRoutePatch(body: unknown, current: { opens_on?: string | null; closes_on?: string | null; verification_status?: string | null; publication_status?: string | null }): Validation<{ values: Record<string, unknown>; verification: VerificationStatus; publication: PublicationStatus }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the admission route fields as an object.' };
  const input = body as Record<string, unknown>;
  const allowed = [
    'admission_session', 'entry_mode', 'assessment_methods', 'first_choice_required',
    'change_of_institution_allowed', 'application_url', 'opens_on', 'closes_on',
    'eligibility_notes', 'verification_status', 'publication_status', 'source_url', 'review_note',
  ];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { ok: false, error: `Unknown admission route field: ${unknown.join(', ')}.` };
  if (!Object.keys(input).length) return { ok: false, error: 'No fields to save.' };

  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    switch (key) {
      case 'admission_session': {
        if (!isAdmissionSession(raw)) return { ok: false, error: 'Admission session must look like 2026/2027.' };
        values.admission_session = String(raw).trim();
        break;
      }
      case 'entry_mode': {
        if (!(ENTRY_MODES as readonly string[]).includes(String(raw))) return { ok: false, error: 'Choose a known entry mode.' };
        values.entry_mode = String(raw);
        break;
      }
      case 'assessment_methods': {
        const list = stringList(raw, 10, 80, 'Assessment methods');
        if (!list.ok) return { ok: false, error: list.error };
        values.assessment_methods = list.value;
        break;
      }
      case 'first_choice_required':
      case 'change_of_institution_allowed': {
        const value = boolOrNull(raw, key.replace(/_/g, ' '));
        if (!value.ok) return { ok: false, error: value.error };
        values[key] = value.value;
        break;
      }
      case 'application_url': {
        const value = cleanUrl(raw, 'Application URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.application_url = value.value;
        break;
      }
      case 'opens_on':
      case 'closes_on': {
        const value = dateOrNull(raw, key === 'opens_on' ? 'Opening date' : 'Closing date');
        if (!value.ok) return { ok: false, error: value.error };
        values[key] = value.value;
        break;
      }
      case 'eligibility_notes': values.eligibility_notes = text(raw, 4000); break;
      case 'verification_status': {
        if (!isVerificationStatus(raw)) return { ok: false, error: 'Choose a known verification status.' };
        values.verification_status = raw;
        break;
      }
      case 'publication_status': {
        if (!isPublicationStatus(raw)) return { ok: false, error: 'Choose draft, in review, published or archived.' };
        values.publication_status = raw;
        break;
      }
      case 'source_url': {
        const value = cleanUrl(raw, 'Source URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.source_url = value.value;
        break;
      }
      case 'review_note': values.review_note = text(raw, 2000); break;
      default: break;
    }
  }

  const opens = 'opens_on' in values ? values.opens_on as string | null : current.opens_on ?? null;
  const closes = 'closes_on' in values ? values.closes_on as string | null : current.closes_on ?? null;
  if (opens && closes && closes < opens) return { ok: false, error: 'The closing date cannot be before the opening date.' };

  const verification = (values.verification_status as VerificationStatus | undefined)
    ?? (isVerificationStatus(current.verification_status) ? current.verification_status : 'unresearched');
  const publication = (values.publication_status as PublicationStatus | undefined)
    ?? (isPublicationStatus(current.publication_status) ? current.publication_status : 'draft');
  const gate = publicationGate(verification, publication);
  if (!gate.ok) return { ok: false, error: gate.error, gate: true };

  return { ok: true, value: { values, verification, publication } };
}

export interface RequirementState {
  admission_session?: string | null;
  entry_mode?: string | null;
  utme_subjects?: string[] | null;
  o_level_requirements?: unknown;
  a_level_requirements?: unknown;
  minimum_utme_scale?: number | null;
  verification_status?: string | null;
  publication_status?: string | null;
}

export function validateRequirementPatch(
  body: unknown,
  current: RequirementState,
): Validation<{ values: Record<string, unknown>; verification: VerificationStatus; publication: PublicationStatus }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the requirement fields as an object.' };
  const input = body as Record<string, unknown>;
  const allowed = [
    'admission_session', 'entry_mode', 'utme_subjects', 'o_level', 'a_level',
    'minimum_utme_score', 'minimum_utme_scale', 'first_choice_required', 'notes',
    'verification_status', 'publication_status', 'source_url', 'review_note',
  ];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { ok: false, error: `Unknown requirement field: ${unknown.join(', ')}.` };
  if (!Object.keys(input).length) return { ok: false, error: 'No fields to save.' };

  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    switch (key) {
      case 'admission_session': {
        if (!isAdmissionSession(raw)) return { ok: false, error: 'Admission session must look like 2026/2027.' };
        values.admission_session = String(raw).trim();
        break;
      }
      case 'entry_mode': {
        if (!(ENTRY_MODES as readonly string[]).includes(String(raw))) return { ok: false, error: 'Choose a known entry mode.' };
        values.entry_mode = String(raw);
        break;
      }
      case 'utme_subjects': {
        const list = stringList(raw, 8, 60, 'UTME subjects');
        if (!list.ok) return { ok: false, error: list.error };
        values.utme_subjects = list.value;
        break;
      }
      case 'o_level': {
        const merged = mergeLevelRequirements(current.o_level_requirements, raw, "O'Level requirements");
        if (!merged.ok) return { ok: false, error: merged.error };
        values.o_level_requirements = merged.value;
        break;
      }
      case 'a_level': {
        const merged = mergeLevelRequirements(current.a_level_requirements, raw, "A'Level requirements");
        if (!merged.ok) return { ok: false, error: merged.error };
        values.a_level_requirements = merged.value;
        break;
      }
      case 'minimum_utme_score': {
        const scale = 'minimum_utme_scale' in input
          ? Number(input.minimum_utme_scale)
          : Number(current.minimum_utme_scale ?? 400);
        const value = numberOrNull(raw, 0, Number.isFinite(scale) ? scale : 400, 'Minimum UTME score');
        if (!value.ok) return { ok: false, error: value.error };
        values.minimum_utme_score = value.value;
        break;
      }
      case 'minimum_utme_scale': {
        const value = numberOrNull(raw, 1, 1000, 'UTME scale');
        if (!value.ok) return { ok: false, error: value.error };
        if (value.value === null) return { ok: false, error: 'The UTME scale is required when a minimum score is recorded.' };
        values.minimum_utme_scale = value.value;
        break;
      }
      case 'first_choice_required': {
        const value = boolOrNull(raw, 'First-choice requirement');
        if (!value.ok) return { ok: false, error: value.error };
        values.first_choice_required = value.value;
        break;
      }
      case 'notes': values.notes = text(raw, 4000); break;
      case 'verification_status': {
        if (!isVerificationStatus(raw)) return { ok: false, error: 'Choose a known verification status.' };
        values.verification_status = raw;
        break;
      }
      case 'publication_status': {
        if (!isPublicationStatus(raw)) return { ok: false, error: 'Choose draft, in review, published or archived.' };
        values.publication_status = raw;
        break;
      }
      case 'source_url': {
        const value = cleanUrl(raw, 'Source URL');
        if (!value.ok) return { ok: false, error: value.error };
        values.source_url = value.value;
        break;
      }
      case 'review_note': values.review_note = text(raw, 2000); break;
      default: break;
    }
  }

  const score = 'minimum_utme_score' in values ? values.minimum_utme_score as number | null : (current as { minimum_utme_score?: number | null }).minimum_utme_score ?? null;
  const scale = 'minimum_utme_scale' in values ? values.minimum_utme_scale as number | null : current.minimum_utme_scale ?? 400;
  if (score !== null && scale !== null && score > scale) {
    return { ok: false, error: 'The minimum UTME score cannot be higher than the scale it is recorded on.' };
  }

  const verification = (values.verification_status as VerificationStatus | undefined)
    ?? (isVerificationStatus(current.verification_status) ? current.verification_status : 'unresearched');
  const publication = (values.publication_status as PublicationStatus | undefined)
    ?? (isPublicationStatus(current.publication_status) ? current.publication_status : 'draft');
  const gate = publicationGate(verification, publication);
  if (!gate.ok) return { ok: false, error: gate.error, gate: true };

  return { ok: true, value: { values, verification, publication } };
}

/** Evidence decisions keep their four blunt outcomes; `unresearched` is not a decision. */
export const EVIDENCE_DECISIONS = ['verified', 'disputed', 'outdated', 'unpublished_by_institution'] as const;
export type EvidenceDecision = (typeof EVIDENCE_DECISIONS)[number];

export function validateEvidencePatch(
  body: unknown,
  current: { source_url?: string | null },
): Validation<{ status?: EvidenceDecision; note?: string | null; source_url?: string | null }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send the review as an object.' };
  const input = body as Record<string, unknown>;
  const allowed = ['status', 'note', 'source_url'];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { ok: false, error: `Unknown review field: ${unknown.join(', ')}.` };

  const result: { status?: EvidenceDecision; note?: string | null; source_url?: string | null } = {};
  let status: EvidenceDecision | undefined;
  if ('status' in input) {
    if (!(EVIDENCE_DECISIONS as readonly string[]).includes(String(input.status))) {
      return { ok: false, error: 'Choose verified, disputed, outdated or withdrawn.' };
    }
    status = String(input.status) as EvidenceDecision;
    result.status = status;
  }
  if ('note' in input) result.note = text(input.note, 2000);
  if ('source_url' in input) {
    const value = cleanUrl(input.source_url, 'Source URL');
    if (!value.ok) return { ok: false, error: value.error };
    result.source_url = value.value;
  }

  const effectiveSource = 'source_url' in result ? result.source_url : current.source_url;
  if (status === 'verified' && !effectiveSource) {
    return { ok: false, error: 'This claim has no source URL, so there is nothing to check it against. Record a source, or mark it disputed and say what is missing.' };
  }
  if (status && status !== 'verified' && !result.note) {
    return { ok: false, error: 'A disputed, outdated or withdrawn claim needs a written reason on record.' };
  }
  if (!Object.keys(result).length) return { ok: false, error: 'No changes to save.' };
  return { ok: true, value: result };
}

/* -------------------------------------------------------------------------- */
/* Review checklist and queue                                                */
/* -------------------------------------------------------------------------- */

export type CheckState = 'ok' | 'review' | 'missing';

export interface ReviewCheck {
  key: 'profile' | 'website' | 'units' | 'programmes' | 'admissionDates' | 'utmeRequirements' | 'campusImage' | 'logo' | 'portal';
  label: string;
  state: CheckState;
  detail: string;
}

export interface ReviewSignals {
  profile: {
    official_name?: string | null;
    overview?: string | null;
    verification_status?: string | null;
    publication_status?: string | null;
    official_website_url?: string | null;
  } | null;
  institution: { website_url?: string | null; admission_portal_url?: string | null; student_portal_url?: string | null };
  counts: {
    units: number;
    unitsUnverified: number;
    offerings: number;
    offeringsUnverified: number;
    routes: number;
    routesWithDates: number;
    requirements: number;
    requirementsWithSubjects: number;
  };
  profileImages: { logo_url?: string | null; hero_image_url?: string | null };
  portalUrls: { admission?: string | null; student?: string | null; postgraduate?: string | null };
}

/**
 * The completeness summary an editor reads before touching a field. It is a
 * checklist of what has been recorded, not a quality score: "missing" means
 * "nobody has researched this yet", never "this institution lacks it".
 */
export function reviewChecklist(input: ReviewSignals): ReviewCheck[] {
  const profile = input.profile;
  const profileState: CheckState = profile?.official_name ? 'ok' : profile ? 'review' : 'missing';
  const websiteUrl = profile?.official_website_url || input.institution.website_url;
  const portal = input.portalUrls.admission || input.portalUrls.student || input.portalUrls.postgraduate
    || input.institution.admission_portal_url || input.institution.student_portal_url;

  const countState = (total: number, unverified: number): CheckState => {
    if (!total) return 'missing';
    return unverified > 0 ? 'review' : 'ok';
  };

  return [
    {
      key: 'profile',
      label: 'Profile',
      state: profileState,
      detail: profile ? (profile.official_name ? `${humanStatus(profile.verification_status)} · ${humanStatus(profile.publication_status)}` : 'Profile started; identity fields incomplete') : 'Not researched yet',
    },
    { key: 'website', label: 'Official website', state: websiteUrl ? 'ok' : 'missing', detail: websiteUrl ? 'Recorded' : 'No official website recorded' },
    { key: 'units', label: 'Academic units', state: countState(input.counts.units, input.counts.unitsUnverified), detail: `${input.counts.units} unit${input.counts.units === 1 ? '' : 's'}${input.counts.unitsUnverified ? `, ${input.counts.unitsUnverified} awaiting verification` : ''}` },
    { key: 'programmes', label: 'Programmes', state: countState(input.counts.offerings, input.counts.offeringsUnverified), detail: `${input.counts.offerings} programme record${input.counts.offerings === 1 ? '' : 's'}${input.counts.offeringsUnverified ? `, ${input.counts.offeringsUnverified} awaiting verification` : ''}` },
    { key: 'admissionDates', label: 'Admission dates', state: input.counts.routesWithDates ? 'ok' : input.counts.routes ? 'review' : 'missing', detail: input.counts.routesWithDates ? `${input.counts.routesWithDates} route(s) with dates` : input.counts.routes ? 'Routes recorded without dates — review' : 'No admission route recorded' },
    { key: 'utmeRequirements', label: 'UTME requirements', state: input.counts.requirementsWithSubjects ? 'ok' : input.counts.requirements ? 'review' : 'missing', detail: input.counts.requirementsWithSubjects ? `${input.counts.requirementsWithSubjects} requirement set(s) with subjects` : input.counts.requirements ? 'Requirement rows recorded without subject combinations' : 'Awaiting verification' },
    { key: 'campusImage', label: 'Campus image', state: input.profileImages.hero_image_url ? 'ok' : 'missing', detail: input.profileImages.hero_image_url ? 'Recorded' : 'No campus image recorded' },
    { key: 'logo', label: 'Logo', state: input.profileImages.logo_url ? 'ok' : 'missing', detail: input.profileImages.logo_url ? 'Recorded' : 'No logo recorded' },
    { key: 'portal', label: 'Portal', state: portal ? 'ok' : 'missing', detail: portal ? 'Recorded' : 'No portal URL recorded' },
  ];
}

export interface ReviewOverviewRow {
  institution_id: string;
  school_name: string;
  acronym: string | null;
  state: string | null;
  institution_type: string | null;
  official_name: string | null;
  publication_status: string | null;
  verification_status: string;
  last_checked_at: string | null;
  reviewed_by: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  overview: string | null;
  official_website_url: string | null;
  directory_website_url: string | null;
  admission_portal_url: string | null;
  student_portal_url: string | null;
  postgraduate_portal_url: string | null;
  academic_units: number;
  academic_units_unverified: number;
  programme_offerings: number;
  programme_offerings_unverified: number;
  published_offerings: number;
  admission_routes: number;
  admission_routes_with_dates: number;
  programme_requirements: number;
  programme_requirements_with_subjects: number;
  source_records: number;
  evidence_rows: number;
  evidence_awaiting_review: number;
  evidence_last_checked_at: string | null;
  admission_sessions: string[];
  latest_session: string | null;
  has_official_website: boolean;
  has_logo: boolean;
  has_hero_image: boolean;
  has_portal: boolean;
}

export interface ReviewFilters {
  search?: string;
  state?: string;
  institutionType?: string;
  verification?: string;
  publication?: string;
  session?: string;
  missing?: string;
  source?: string;
}

/** One row per institution; every count is honest, including zero. */
export function reviewChecklistForRow(row: ReviewOverviewRow): ReviewCheck[] {
  return reviewChecklist({
    profile: row.official_name || row.verification_status !== 'unresearched' ? {
      official_name: row.official_name,
      verification_status: row.verification_status,
      publication_status: row.publication_status,
    } : null,
    institution: { website_url: row.directory_website_url, admission_portal_url: row.admission_portal_url, student_portal_url: row.student_portal_url },
    counts: {
      units: row.academic_units,
      unitsUnverified: row.academic_units_unverified,
      offerings: row.programme_offerings,
      offeringsUnverified: row.programme_offerings_unverified,
      routes: row.admission_routes,
      routesWithDates: row.admission_routes_with_dates,
      requirements: row.programme_requirements,
      requirementsWithSubjects: row.programme_requirements_with_subjects,
    },
    profileImages: { logo_url: row.logo_url, hero_image_url: row.hero_image_url },
    portalUrls: {
      admission: row.admission_portal_url,
      student: row.student_portal_url,
      postgraduate: row.postgraduate_portal_url,
    },
  });
}

/**
 * Queue filters. All values are exact slugs except `search` (free text) and
 * `missing` (`any` = at least one missing check, or a checklist key name).
 * `source` is `verified` (every reviewed row has a source) or `missing`.
 */
export function filterReviewRows(
  rows: ReviewOverviewRow[],
  filters: ReviewFilters,
): ReviewOverviewRow[] {
  const search = String(filters.search || '').trim().toLowerCase();
  const missing = String(filters.missing || '').trim();
  return rows.filter((row) => {
    if (search) {
      const haystack = [row.school_name, row.official_name, row.acronym, row.state]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.state && row.state !== filters.state) return false;
    if (filters.institutionType && row.institution_type !== filters.institutionType) return false;
    if (filters.verification && row.verification_status !== filters.verification) return false;
    if (filters.publication && row.publication_status !== filters.publication) return false;
    if (filters.session && !(row.admission_sessions || []).includes(filters.session)) return false;

    const checks = reviewChecklistForRow(row);
    if (missing) {
      if (missing === 'any') {
        if (!checks.some((check) => check.state !== 'ok')) return false;
      } else if (!checks.some((check) => check.key === missing && check.state !== 'ok')) {
        return false;
      }
    }

    if (filters.source === 'verified' && row.evidence_rows === 0) return false;
    if (filters.source === 'missing' && !(row.evidence_awaiting_review > 0)) return false;
    return true;
  });
}

export interface ReviewSummary {
  institutionsAwaitingReview: number;
  programmeRecordsAwaitingVerification: number;
  academicUnits: number;
  sourceRecords: number;
  publishedInstitutions: number;
  institutionsInCatalogue: number;
}

export function summarizeReview(rows: ReviewOverviewRow[], sourceRecords: number): ReviewSummary {
  return {
    institutionsAwaitingReview: rows.filter((row) =>
      row.verification_status !== 'verified'
      || row.evidence_awaiting_review > 0
      || row.programme_offerings_unverified > 0
      || row.academic_units_unverified > 0
    ).length,
    programmeRecordsAwaitingVerification: rows.reduce((total, row) => total + row.programme_offerings_unverified, 0),
    academicUnits: rows.reduce((total, row) => total + row.academic_units, 0),
    sourceRecords,
    publishedInstitutions: rows.filter((row) => row.publication_status === 'published').length,
    institutionsInCatalogue: rows.length,
  };
}

/** The values the admin filter bar offers, derived from the catalogue itself. */
export function filterOptions(rows: ReviewOverviewRow[]) {
  const unique = (values: Array<string | null>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
  return {
    states: unique(rows.map((row) => row.state)),
    institutionTypes: unique(rows.map((row) => row.institution_type)),
    sessions: unique(rows.flatMap((row) => row.admission_sessions || [])).sort().reverse(),
  };
}
