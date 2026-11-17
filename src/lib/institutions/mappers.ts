/**
 * Mappers: database-shaped rows → the frontend contract.
 *
 * Two directions, clearly separated:
 *
 *  * `mapDirectoryRow` reads only columns that exist in the deployed
 *    `public.institutions` table today. It is the adapter that keeps the
 *    directory working before the intelligence schema lands.
 *  * the `mapIntelligence*` functions parse the institution-intelligence
 *    payload the server will return once
 *    `20261117120000_institution_intelligence.sql` is applied and verified.
 *    They are pure and safe to ship now because nothing calls them until the
 *    repository's capability gate says the schema is live.
 *
 * Neither direction invents a value. Every field that is absent in the row is
 * `null` in the model, and `null` renders as "not published yet".
 */

import { aliasNamesFor, identityAliasFor } from './aliases';
import {
  institutionSlug,
  isInstitutionId,
  normalizeAcademicUnitType,
  normalizeAliasType,
  normalizeAssessmentMethod,
  normalizeBenchmarkType,
  normalizeCampusType,
  normalizeCategory,
  normalizeEntryMode,
  normalizeJsonObject,
  normalizeNumber,
  normalizeOwnership,
  normalizePortalGuideType,
  normalizeScore,
  normalizeSession,
  normalizeText,
  normalizeTextArray,
  normalizeUrl,
  normalizeVerificationStatus,
  normalizeYear,
  sortSessions,
} from './normalizers';
import {
  emptySection,
  type AcademicUnit,
  type AdmissionBenchmark,
  type AdmissionRoute,
  type Campus,
  type InstitutionAlias,
  type InstitutionProfile,
  type InstitutionSection,
  type InstitutionSummary,
  type PortalGuide,
  type PortalGuideStep,
  type ProgrammeOffering,
  type ProgrammeRequirement,
  type SourceEvidence,
} from './types';

/**
 * The columns of `public.institutions` that exist in production today.
 *
 * Adding a column here is a deployment-contract change: it must be checked
 * against the applied migrations first. See `repository.ts`.
 */
export const INSTITUTION_DIRECTORY_COLUMNS =
  'id,school_name,acronym,state,institution_type,website_url,slug,admission_portal_url,student_portal_url,post_utme_available,post_utme_method,post_utme_source_url,post_utme_verified' as const;

/** A row as Supabase returns it. Every field may be absent or null. */
export type InstitutionRow = Record<string, unknown>;

/**
 * One directory row → one public institution identity.
 *
 * `ownership` is always `null` here: the deployed table has no ownership
 * column, and nothing in this function is willing to infer one from the name.
 */
export function mapDirectoryRow(row: InstitutionRow): InstitutionSummary | null {
  const id = normalizeText(row.id);
  const name = normalizeText(row.school_name);
  if (!id || !name) return null;

  const websiteUrl = normalizeUrl(row.website_url);
  const postUtmeMethod = normalizeText(row.post_utme_method);
  const postUtmeAvailable = row.post_utme_available === true && row.post_utme_verified === true;

  return {
    id,
    name,
    acronym: normalizeText(row.acronym),
    state: normalizeText(row.state),
    institutionType: normalizeText(row.institution_type),
    category: normalizeCategory(row.institution_type),
    // No ownership column exists in the deployed schema. Unknown, not guessed.
    ownership: normalizeOwnership(null),
    websiteUrl,
    admissionPortalUrl: normalizeUrl(row.admission_portal_url),
    studentPortalUrl: normalizeUrl(row.student_portal_url),
    slug: normalizeText(row.slug) ?? institutionSlug(name),
    aliases: mapAliases(row, name),
    postUtme: postUtmeAvailable
      ? {
          available: true,
          method: postUtmeMethod === 'cbt' || postUtmeMethod === 'handwritten' ? postUtmeMethod : null,
          sourceUrl: normalizeUrl(row.post_utme_source_url),
        }
      : null,
    // The legacy `is_verified` flag is not field-level evidence, so a website
    // is only "verified" when the row itself carries a usable official URL.
    verifiedWebsite: websiteUrl !== null,
    // No institution has published intelligence rows until the schema is
    // deployed and a researched batch has been imported and reviewed.
    intelligencePublished: false,
  };
}

/**
 * Search aliases for a directory row.
 *
 * The directory has no alias table, so the only aliases available are the
 * institution's own acronym and any name recorded by the identity
 * reconciliation layer (for example the second University of Calabar row).
 */
export function mapAliases(row: InstitutionRow, name: string): InstitutionAlias[] {
  const aliases: InstitutionAlias[] = [];
  const acronym = normalizeText(row.acronym);
  if (acronym) {
    aliases.push({ name: acronym, type: 'acronym', preferredDisplay: false, status: 'unresearched' });
  }
  for (const aliasName of aliasNamesFor(normalizeText(row.id) ?? '')) {
    if (aliasName.toLowerCase() === name.toLowerCase()) continue;
    aliases.push({
      name: aliasName,
      type: 'alternate_name',
      preferredDisplay: false,
      status: 'unresearched',
    });
  }
  return aliases;
}

/**
 * A directory identity → a full profile whose richer sections are all
 * `not_imported`.
 *
 * This is the honest shape of the product today: the institution is in the
 * directory, and every institution-intelligence section is waiting on a
 * backend migration and import that have not been applied.
 */
export function mapProfileFromDirectory(summary: InstitutionSummary): InstitutionProfile {
  return {
    ...summary,
    officialName: null,
    yearEstablished: null,
    overview: null,
    city: null,
    postalAddress: null,
    profileStatus: 'none',
    profileVerificationStatus: 'unresearched',
    profileVerifiedAt: null,
    campuses: emptySection<Campus>('not_imported'),
    academicUnits: emptySection<AcademicUnit>('not_imported'),
    departments: emptySection<AcademicUnit>('not_imported'),
    programmeOfferings: emptySection<ProgrammeOffering>('not_imported'),
    admissionRoutes: emptySection<AdmissionRoute>('not_imported'),
    programmeRequirements: emptySection<ProgrammeRequirement>('not_imported'),
    benchmarks: emptySection<AdmissionBenchmark>('not_imported'),
    portalGuides: emptySection<PortalGuide>('not_imported'),
    sources: emptySection<SourceEvidence>('not_imported'),
    sessions: [],
    readError: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Institution intelligence (future schema)                                    */
/* -------------------------------------------------------------------------- */

/**
 * The payload returned by `GET /api/institutions/:id/intelligence`
 * (`fetchInstitutionIntelligence` in `src/lib/api.ts`, served by
 * `src/server/institutionIntelligence.ts`).
 *
 * The server has already applied the published-and-verified filter, so these
 * rows are the public layer. Modelled here so the frontend contract exists and
 * is tested before the tables are deployed.
 */
export interface InstitutionIntelligencePayload {
  institution?: InstitutionRow | null;
  aliases?: InstitutionRow[] | null;
  profile?: InstitutionRow | null;
  leadership?: InstitutionRow[] | null;
  campuses?: InstitutionRow[] | null;
  academicUnits?: InstitutionRow[] | null;
  offerings?: InstitutionRow[] | null;
  admissionRoutes?: InstitutionRow[] | null;
  programmeRequirements?: InstitutionRow[] | null;
  benchmarks?: InstitutionRow[] | null;
  portalGuides?: InstitutionRow[] | null;
  nationalPolicies?: InstitutionRow[] | null;
  caveats?: string[] | null;
}

/** Published-and-verified rows only; anything else never reaches a student. */
function publicRows(rows: InstitutionRow[] | null | undefined): InstitutionRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    const status = normalizeVerificationStatus(row.verification_status);
    const publication = normalizeText(row.publication_status);
    // Rows without a publication_status (campuses, academic units) are gated
    // by verification alone, which is what their RLS policy does too.
    return status === 'verified' && (publication === null || publication === 'published');
  });
}

function section<T>(rows: InstitutionRow[] | null | undefined, map: (row: InstitutionRow) => T | null): InstitutionSection<T> {
  const source = Array.isArray(rows) ? rows : [];
  const published = publicRows(source);
  if (!published.length) {
    return emptySection<T>(source.length ? 'awaiting_review' : 'empty');
  }
  const items = published.map(map).filter((item): item is T => item !== null);
  return { state: items.length ? 'available' : 'awaiting_review', items };
}

export function mapAliasRow(row: InstitutionRow): InstitutionAlias | null {
  const name = normalizeText(row.alias_name ?? row.name);
  if (!name) return null;
  return {
    name,
    type: normalizeAliasType(row.alias_type),
    preferredDisplay: row.preferred_display === true,
    status: normalizeVerificationStatus(row.verification_status),
  };
}

export function mapCampusRow(row: InstitutionRow): Campus | null {
  const name = normalizeText(row.campus_name ?? row.name);
  const id = normalizeText(row.id);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: normalizeCampusType(row.campus_type),
    address: normalizeText(row.address),
    city: normalizeText(row.city),
    state: normalizeText(row.state),
    description: normalizeText(row.description),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapAcademicUnitRow(row: InstitutionRow): AcademicUnit | null {
  const name = normalizeText(row.unit_name ?? row.name);
  const slug = normalizeText(row.slug);
  const id = normalizeText(row.id);
  if (!id || !name || !slug) return null;
  return {
    id,
    parentUnitId: normalizeText(row.parent_unit_id),
    type: normalizeAcademicUnitType(row.unit_type),
    name,
    slug,
    description: normalizeText(row.description),
    websiteUrl: normalizeUrl(row.website_url),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapProgrammeOfferingRow(row: InstitutionRow): ProgrammeOffering | null {
  const name = normalizeText(row.programme_name ?? row.name);
  const id = normalizeText(row.id);
  if (!id || !name) return null;
  const accreditation = normalizeText(row.accreditation_status);
  return {
    id,
    academicUnitId: normalizeText(row.academic_unit_id),
    campusId: normalizeText(row.campus_id),
    name,
    code: normalizeText(row.programme_code),
    degreeTitle: normalizeText(row.degree_title),
    awardLevel: normalizeText(row.award_level),
    durationYears: normalizeNumber(row.duration_years),
    deliveryMode: normalizeText(row.delivery_mode),
    session: normalizeSession(row.admission_session),
    // Institutional recognition is not programme accreditation. Unless an
    // accreditation fact has been published, the status stays unknown.
    accreditationStatus:
      accreditation === 'accredited' || accreditation === 'not_accredited'
        ? accreditation
        : 'unknown',
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapAdmissionRouteRow(row: InstitutionRow): AdmissionRoute | null {
  const id = normalizeText(row.id);
  const session = normalizeSession(row.admission_session);
  if (!id || !session) return null;
  return {
    id,
    session,
    entryMode: normalizeEntryMode(row.entry_mode),
    assessmentMethods: normalizeTextArray(row.assessment_methods).map(normalizeAssessmentMethod),
    firstChoiceRequired: typeof row.first_choice_required === 'boolean' ? row.first_choice_required : null,
    changeOfInstitutionAllowed:
      typeof row.change_of_institution_allowed === 'boolean' ? row.change_of_institution_allowed : null,
    applicationUrl: normalizeUrl(row.application_url),
    opensOn: normalizeText(row.opens_on),
    closesOn: normalizeText(row.closes_on),
    eligibilityNotes: normalizeText(row.eligibility_notes),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    sourcePublishedAt: normalizeText(row.source_published_at),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapProgrammeRequirementRow(row: InstitutionRow): ProgrammeRequirement | null {
  const id = normalizeText(row.id);
  const programmeOfferingId = normalizeText(row.programme_offering_id);
  const session = normalizeSession(row.admission_session);
  if (!id || !programmeOfferingId || !session) return null;
  const subjects = normalizeTextArray(row.utme_subjects);
  const scale = normalizeNumber(row.minimum_utme_scale) ?? 400;
  return {
    id,
    programmeOfferingId,
    admissionRouteId: normalizeText(row.admission_route_id),
    session,
    entryMode: normalizeEntryMode(row.entry_mode),
    utmeSubjects: subjects,
    // Only JAMB IBASS makes English compulsory; see `englishCompulsoryFor()`.
    englishCompulsory: false,
    oLevelRequirements: normalizeJsonObject(row.o_level_requirements),
    aLevelRequirements: normalizeJsonObject(row.a_level_requirements),
    otherRequirements: normalizeJsonObject(row.other_requirements),
    minimumUtmeScore: normalizeScore(row.minimum_utme_score, scale),
    minimumUtmeScale: scale,
    firstChoiceRequired: typeof row.first_choice_required === 'boolean' ? row.first_choice_required : null,
    notes: normalizeText(row.notes),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    sourcePublishedAt: normalizeText(row.source_published_at),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapBenchmarkRow(row: InstitutionRow): AdmissionBenchmark | null {
  const id = normalizeText(row.id);
  const institutionId = normalizeText(row.institution_id);
  const session = normalizeSession(row.admission_session);
  const label = normalizeText(row.benchmark_label);
  if (!id || !institutionId || !session || !label) return null;
  const scaleMin = normalizeNumber(row.score_scale_min) ?? 0;
  const scaleMax = normalizeNumber(row.score_scale_max);
  const value = normalizeScore(row.benchmark_value, scaleMax ?? 0, scaleMin);
  if (scaleMax === null || value === null) return null;
  return {
    id,
    institutionId,
    programmeOfferingId: normalizeText(row.programme_offering_id),
    session,
    type: normalizeBenchmarkType(row.benchmark_type),
    label,
    value,
    scoreScaleMin: scaleMin,
    scoreScaleMax: scaleMax,
    categoryKey: normalizeText(row.category_key) ?? 'general',
    stateCategory: normalizeText(row.state_category),
    isEligibilityFloor: row.is_eligibility_floor === true,
    calculationMethod: normalizeText(row.calculation_method),
    notes: normalizeText(row.notes),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    sourcePublishedAt: normalizeText(row.source_published_at),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

export function mapPortalGuideRow(row: InstitutionRow): PortalGuide | null {
  const id = normalizeText(row.id);
  const title = normalizeText(row.title);
  if (!id || !title) return null;
  return {
    id,
    type: normalizePortalGuideType(row.guide_type),
    title,
    session: normalizeSession(row.admission_session),
    portalUrl: normalizeUrl(row.portal_url),
    summary: normalizeText(row.summary),
    safetyNote: normalizeText(row.safety_note),
    steps: mapGuideSteps(row.steps),
    status: normalizeVerificationStatus(row.verification_status),
    sourceUrl: normalizeUrl(row.source_url),
    lastVerifiedAt: normalizeText(row.verified_at),
  };
}

function mapGuideSteps(value: unknown): PortalGuideStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((step): step is InstitutionRow => Boolean(step) && typeof step === 'object')
    .map((step) => ({
      stepNumber: normalizeNumber(step.step_number) ?? 0,
      title: normalizeText(step.title) ?? '',
      instruction: normalizeText(step.instruction) ?? '',
      officialUrl: normalizeUrl(step.official_url),
      documents: normalizeTextArray(step.required_documents),
      warning: normalizeText(step.warning),
    }))
    // A step without both a title and an instruction is an incomplete import,
    // not a step a student should be told to follow.
    .filter((step) => step.title && step.instruction)
    .sort((a, b) => a.stepNumber - b.stepNumber);
}

export function mapEvidenceRow(row: InstitutionRow): SourceEvidence | null {
  const id = normalizeText(row.id);
  const institutionId = normalizeText(row.institution_id);
  const sourceUrl = normalizeUrl(row.source_url);
  const fieldKey = normalizeText(row.field_key);
  if (!id || !institutionId || !sourceUrl || !fieldKey) return null;
  return {
    id,
    institutionId,
    entityType: mapEvidenceEntityType(row.entity_type),
    entityId: normalizeText(row.entity_id),
    fieldKey,
    sourceUrl,
    sourcePublishedAt: normalizeText(row.source_published_at),
    applicableSession: normalizeSession(row.applicable_session),
    status: normalizeVerificationStatus(row.verification_status),
    checkedAt: normalizeText(row.checked_at),
  };
}

function mapEvidenceEntityType(value: unknown): SourceEvidence['entityType'] {
  const text = normalizeText(value);
  const allowed = [
    'institution',
    'profile',
    'leadership',
    'campus',
    'academic_unit',
    'programme',
    'admission_route',
    'programme_requirement',
    'benchmark',
    'portal_guide',
  ];
  return allowed.includes(String(text)) ? (text as SourceEvidence['entityType']) : 'institution';
}

function mapProfileRow(row: InstitutionRow | null | undefined) {
  if (!row) return null;
  return {
    officialName: normalizeText(row.official_name),
    ownership: normalizeOwnership(row.ownership),
    category: normalizeCategory(row.institution_category),
    yearEstablished: normalizeYear(row.year_established),
    overview: normalizeText(row.overview),
    city: normalizeText(row.city),
    postalAddress: normalizeText(row.postal_address),
    profileStatus: (normalizeText(row.profile_status) ?? 'none') as InstitutionProfile['profileStatus'],
    profileVerificationStatus: normalizeVerificationStatus(row.verification_status),
    profileVerifiedAt: normalizeText(row.profile_verified_at),
    websiteUrl: normalizeUrl(row.official_website_url),
    admissionPortalUrl: normalizeUrl(row.admission_portal_url),
    studentPortalUrl: normalizeUrl(row.student_portal_url),
  };
}

/**
 * Merge a verified intelligence payload into a directory identity.
 *
 * Values the payload does not carry keep their directory value; values the
 * payload marks unverified are never promoted over a known one. Ownership
 * comes only from the published profile field — still `null` when the profile
 * is absent.
 */
export function mergeIntelligence(
  summary: InstitutionSummary,
  payload: InstitutionIntelligencePayload,
): InstitutionProfile {
  const profile = mapProfileRow(payload.profile);
  const aliases = (payload.aliases ?? []).map(mapAliasRow).filter((alias): alias is InstitutionAlias => alias !== null);
  const campuses = section(payload.campuses, mapCampusRow);
  const units = section(payload.academicUnits, mapAcademicUnitRow);
  const offerings = section(payload.offerings, mapProgrammeOfferingRow);
  const routes = section(payload.admissionRoutes, mapAdmissionRouteRow);
  const requirements = section(payload.programmeRequirements, mapProgrammeRequirementRow);
  const benchmarks = section(payload.benchmarks, mapBenchmarkRow);
  const guides = section(payload.portalGuides, mapPortalGuideRow);

  return {
    ...summary,
    intelligencePublished: profile?.profileStatus === 'published' && profile?.profileVerificationStatus === 'verified',
    officialName: profile?.officialName ?? summary.name,
    ownership: profile?.ownership ?? summary.ownership,
    category: profile?.category ?? summary.category,
    yearEstablished: profile?.yearEstablished ?? null,
    overview: profile?.overview ?? null,
    city: profile?.city ?? null,
    postalAddress: profile?.postalAddress ?? null,
    websiteUrl: profile?.websiteUrl ?? summary.websiteUrl,
    admissionPortalUrl: profile?.admissionPortalUrl ?? summary.admissionPortalUrl,
    studentPortalUrl: profile?.studentPortalUrl ?? summary.studentPortalUrl,
    aliases: aliases.length ? aliases : summary.aliases,
    profileStatus: profile?.profileStatus ?? 'none',
    profileVerificationStatus: profile?.profileVerificationStatus ?? 'unresearched',
    profileVerifiedAt: profile?.profileVerifiedAt ?? null,
    campuses,
    academicUnits: {
      state: units.state,
      items: units.items.filter((unit) => unit.type !== 'department'),
      note: units.note,
    },
    departments: {
      state: units.state,
      items: units.items.filter((unit) => unit.type === 'department'),
      note: units.note,
    },
    programmeOfferings: offerings,
    admissionRoutes: routes,
    programmeRequirements: requirements,
    benchmarks,
    portalGuides: guides,
    sources: emptySection<SourceEvidence>(
      // Fact-level evidence is staff-only by design; the public surface sees
      // the source URLs attached to the facts themselves.
      'empty',
    ),
    sessions: sortSessions([
      ...routes.items.map((route) => route.session),
      ...requirements.items.map((requirement) => requirement.session),
      ...benchmarks.items.map((benchmark) => benchmark.session),
      ...guides.items.map((guide) => guide.session).filter((session): session is string => session !== null),
    ]),
    readError: null,
  };
}

/** Human-readable note for a legacy slug that resolved through the alias layer. */
export function identityNoteFor(id: string): string | null {
  const entry = identityAliasFor(id);
  if (!entry) return null;
  return entry.note;
}

export { isInstitutionId };
