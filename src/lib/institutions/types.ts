/**
 * Institution intelligence — the frontend data contract.
 *
 * Why this file exists
 * --------------------
 * Three institution surfaces (the finder, the details page and the future
 * admission-selection flow) each used to read `public.institutions` directly
 * with their own column list. That made two promises impossible to keep:
 *
 *   1. that the app keeps working against the schema that is actually
 *      deployed today, and
 *   2. that the richer institution-intelligence schema
 *      (`supabase/migrations/20261117120000_institution_intelligence.sql`,
 *      **not applied to production**) can be switched on later without a
 *      second frontend rewrite.
 *
 * So every institution read goes through this contract. Two rules govern it:
 *
 *   * A value that has not been researched is `null`, never a default, never
 *     a guess. Ownership in particular is *not* inferred from a school's name
 *     or state — `University of Calabar` being federal is a researched fact,
 *     not a deduction from the word "University".
 *   * A section with no rows is an empty section, and an empty section means
 *     "not published yet". It never means "this institution has none".
 *
 * Verification is field-level. A row existing in `public.institutions` is not
 * evidence that anything in it has been checked: the legacy `is_verified`
 * column is deliberately not modelled as a truth signal anywhere here.
 */

/** Ownership classes the institution-intelligence schema allows. */
export const OWNERSHIPS = ['federal', 'state', 'private'] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  federal: 'Federal',
  state: 'State',
  private: 'Private',
};

/**
 * Institution categories. Broader than ownership and independent of it: a
 * polytechnic can be federal, state or private.
 */
export type InstitutionCategory =
  | 'university'
  | 'polytechnic'
  | 'monotechnic'
  | 'college_of_education'
  | 'college_of_agriculture'
  | 'college_of_nursing'
  | 'innovation_enterprise_institute'
  | 'other';

/**
 * Field-level verification, exactly as the schema's `verification_status`
 * check constraint defines it. `unresearched` is the honest default: nothing
 * here treats a missing status as "verified".
 */
export const VERIFICATION_STATUSES = [
  'unresearched',
  'discovered',
  'in_review',
  'verified',
  'unpublished_by_institution',
  'disputed',
  'outdated',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Statuses a public student surface is allowed to present as fact. */
export const PUBLIC_TRUSTED_STATUSES: readonly VerificationStatus[] = ['verified'];

/** Statuses that mean "researched but not yet authoritative". */
export const PENDING_STATUSES: readonly VerificationStatus[] = ['discovered', 'in_review', 'disputed', 'outdated'];

/**
 * Why a section is the way it is.
 *
 *  * `available`          — rows exist and are published facts.
 *  * `empty`              — the schema is live and was queried; there are no
 *                           published rows for this institution.
 *  * `awaiting_review`    — rows exist but none are published yet.
 *  * `not_imported`       — the institution-intelligence schema is not
 *                           deployed, so nothing was queried. This is the
 *                           state of the whole feature today.
 *  * `unavailable`        — the lookup failed; the UI says so and offers a
 *                           retry rather than rendering a blank panel.
 */
export type SectionState = 'available' | 'empty' | 'awaiting_review' | 'not_imported' | 'unavailable';

/** A compact, always-attributable reference to where a fact came from. */
export interface SourceReference {
  label: string;
  url: string | null;
  /** ISO date. The date the fact was last checked, not the date it was published. */
  verifiedAt?: string | null;
  status?: VerificationStatus;
}

/** One sourced fact plus its provenance. */
export interface Sourced<T> {
  value: T;
  status: VerificationStatus;
  source?: SourceReference | null;
  lastVerifiedAt?: string | null;
}

/**
 * A section of an institution profile.
 *
 * `items` is empty in every state except `available`, so a UI cannot
 * accidentally render "0 programmes" as a fact about the institution.
 */
export interface InstitutionSection<T> {
  state: SectionState;
  items: T[];
  /** Admission session the rows apply to, when the section is session-scoped. */
  session?: string | null;
  /** Human-readable explanation shown with the section. */
  note?: string;
}

export function emptySection<T>(state: SectionState, note?: string): InstitutionSection<T> {
  return { state, items: [], note };
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export const ALIAS_TYPES = ['acronym', 'alternate_name', 'former_name', 'official_variant', 'duplicate_candidate'] as const;
export type AliasType = (typeof ALIAS_TYPES)[number];

export interface InstitutionAlias {
  name: string;
  type: AliasType;
  /** Whether this alias is the institution's preferred public display name. */
  preferredDisplay: boolean;
  status: VerificationStatus;
}

/**
 * One public institution identity.
 *
 * `id` is the canonical `public.institutions.id` UUID. Everything else on the
 * frontend keys off it: names change, slugs change, ids are the only stable
 * handle an alias can safely resolve to.
 */
export interface InstitutionSummary {
  id: string;
  name: string;
  acronym: string | null;
  state: string | null;
  institutionType: string | null;
  category: InstitutionCategory | null;
  /**
   * Ownership as researched and published. `null` means unknown — the schema
   * has no ownership column today, so this is `null` for every institution
   * until the intelligence import lands.
   */
  ownership: Ownership | null;
  /** An http(s) URL. Anything else is dropped, never repaired or guessed. */
  websiteUrl: string | null;
  admissionPortalUrl: string | null;
  studentPortalUrl: string | null;
  /** URL-safe identity handle, derived from the canonical name. */
  slug: string | null;
  /** Alternate names that should resolve to this institution. */
  aliases: InstitutionAlias[];
  /** Post-UTME screening, only when the institution's own method is verified. */
  postUtme: {
    available: boolean;
    method: 'cbt' | 'handwritten' | null;
    sourceUrl: string | null;
  } | null;
  /** True only when the official website URL itself is a published fact. */
  verifiedWebsite: boolean;
  /**
   * Whether this institution has published, verified intelligence rows.
   *
   * `false` for every institution today: the schema is undeployed and nothing
   * has been imported. This is the flag a "Verified" mark keys off, so a mark
   * can never appear just because a directory row exists.
   */
  intelligencePublished: boolean;
}

/* -------------------------------------------------------------------------- */
/* Structure                                                                   */
/* -------------------------------------------------------------------------- */

export const CAMPUS_TYPES = ['main', 'permanent', 'temporary', 'satellite', 'teaching_hospital', 'study_centre', 'other'] as const;
export type CampusType = (typeof CAMPUS_TYPES)[number];

export interface Campus {
  id: string;
  name: string;
  type: CampusType;
  address: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  status: VerificationStatus;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

export const ACADEMIC_UNIT_TYPES = ['faculty', 'college', 'school', 'institute', 'centre', 'department', 'division', 'other'] as const;
export type AcademicUnitType = (typeof ACADEMIC_UNIT_TYPES)[number];

/**
 * Faculties, colleges, schools, institutes, centres and departments.
 *
 * `unitType` is explicit. A heading on a university website is not evidence
 * that the thing under it is a faculty, and the importer refuses to guess one
 * from a name — this type carries that refusal into the UI.
 */
export interface AcademicUnit {
  id: string;
  parentUnitId: string | null;
  type: AcademicUnitType;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  status: VerificationStatus;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

export interface ProgrammeOffering {
  id: string;
  academicUnitId: string | null;
  campusId: string | null;
  name: string;
  code: string | null;
  degreeTitle: string | null;
  awardLevel: string | null;
  durationYears: number | null;
  deliveryMode: string | null;
  /** Admission session this offering applies to, e.g. `2026/2027`. */
  session: string | null;
  /**
   * Institutional recognition vs programme accreditation. NUC listing a
   * university says nothing about whether this programme is accredited, and
   * the UI must never let the first stand in for the second.
   */
  accreditationStatus: 'unknown' | 'accredited' | 'not_accredited' | 'awaiting_verification';
  status: VerificationStatus;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Admission                                                                   */
/* -------------------------------------------------------------------------- */

export const ENTRY_MODES = ['UTME', 'DIRECT_ENTRY', 'JUPEB', 'IJMB', 'PRE_DEGREE', 'DIPLOMA', 'ND', 'HND', 'TRANSFER', 'OTHER'] as const;
export type EntryMode = (typeof ENTRY_MODES)[number];

export const ENTRY_MODE_LABELS: Record<EntryMode, string> = {
  UTME: 'UTME',
  DIRECT_ENTRY: 'Direct Entry',
  JUPEB: 'JUPEB',
  IJMB: 'IJMB',
  PRE_DEGREE: 'Pre-degree',
  DIPLOMA: 'Diploma',
  ND: 'ND',
  HND: 'HND',
  TRANSFER: 'Transfer',
  OTHER: 'Other',
};

/** How an institution assesses candidates — distinct from how they enter. */
export const ASSESSMENT_METHODS = ['cbt', 'handwritten', 'online_screening', 'document_review', 'interview', 'departmental_test', 'other'] as const;
export type AssessmentMethod = (typeof ASSESSMENT_METHODS)[number];

export const ASSESSMENT_METHOD_LABELS: Record<AssessmentMethod, string> = {
  cbt: 'CBT',
  handwritten: 'Handwritten / paper',
  online_screening: 'Online screening',
  document_review: 'Document review',
  interview: 'Interview',
  departmental_test: 'Departmental test',
  other: 'Other',
};

export interface AdmissionRoute {
  id: string;
  session: string;
  entryMode: EntryMode;
  /** The method(s) of assessment, which are not the mode of entry. */
  assessmentMethods: AssessmentMethod[];
  firstChoiceRequired: boolean | null;
  changeOfInstitutionAllowed: boolean | null;
  applicationUrl: string | null;
  opensOn: string | null;
  closesOn: string | null;
  eligibilityNotes: string | null;
  status: VerificationStatus;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  lastVerifiedAt: string | null;
}

export interface ProgrammeRequirement {
  id: string;
  programmeOfferingId: string;
  admissionRouteId: string | null;
  session: string;
  entryMode: EntryMode;
  /**
   * UTME subjects as published. English is shown as compulsory only when the
   * official rule (JAMB IBASS) requires it — enforced by
   * `englishCompulsoryFor()` in `admissionSelection.ts`, never assumed.
   */
  utmeSubjects: string[];
  englishCompulsory: boolean;
  oLevelRequirements: Record<string, unknown>;
  aLevelRequirements: Record<string, unknown>;
  otherRequirements: Record<string, unknown>;
  /** Programme UTME minimum, on its own declared scale. */
  minimumUtmeScore: number | null;
  minimumUtmeScale: number | null;
  firstChoiceRequired: boolean | null;
  notes: string | null;
  status: VerificationStatus;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  lastVerifiedAt: string | null;
}

export const BENCHMARK_TYPES = [
  'national_minimum',
  'institution_utme_eligibility',
  'programme_utme_minimum',
  'screening_aggregate',
  'departmental_merit',
  'catchment',
  'elds',
  'post_utme_test',
  'other',
] as const;
export type BenchmarkType = (typeof BENCHMARK_TYPES)[number];

export const BENCHMARK_TYPE_LABELS: Record<BenchmarkType, string> = {
  national_minimum: 'National minimum',
  institution_utme_eligibility: 'Institution UTME eligibility',
  programme_utme_minimum: 'Programme UTME minimum',
  screening_aggregate: 'Screening aggregate',
  departmental_merit: 'Departmental merit cut-off',
  catchment: 'Catchment',
  elds: 'ELDS',
  post_utme_test: 'Post-UTME test',
  other: 'Other',
};

/**
 * A typed admission benchmark.
 *
 * `scoreScaleMin`/`scoreScaleMax` are part of the value, not decoration: a
 * 0-400 UTME score and a 0-100 screening aggregate must never be placed in the
 * same column or compared without an explicit conversion.
 */
export interface AdmissionBenchmark {
  id: string;
  institutionId: string;
  programmeOfferingId: string | null;
  session: string;
  type: BenchmarkType;
  label: string;
  value: number;
  scoreScaleMin: number;
  scoreScaleMax: number;
  categoryKey: string;
  stateCategory: string | null;
  /** An eligibility floor is not a competitive cut-off; the UI must say which. */
  isEligibilityFloor: boolean;
  calculationMethod: string | null;
  notes: string | null;
  status: VerificationStatus;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  lastVerifiedAt: string | null;
}

export const PORTAL_GUIDE_TYPES = [
  'website_navigation',
  'admissions',
  'post_utme',
  'direct_entry',
  'jamb_caps',
  'acceptance',
  'clearance',
  'fees',
  'student_portal',
  'course_registration',
  'results',
  'other',
] as const;
export type PortalGuideType = (typeof PORTAL_GUIDE_TYPES)[number];

export interface PortalGuideStep {
  stepNumber: number;
  title: string;
  instruction: string;
  officialUrl: string | null;
  documents: string[];
  warning: string | null;
}

export interface PortalGuide {
  id: string;
  type: PortalGuideType;
  title: string;
  session: string | null;
  portalUrl: string | null;
  summary: string | null;
  safetyNote: string | null;
  steps: PortalGuideStep[];
  status: VerificationStatus;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Evidence                                                                    */
/* -------------------------------------------------------------------------- */

export const EVIDENCE_ENTITY_TYPES = [
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
] as const;
export type EvidenceEntityType = (typeof EVIDENCE_ENTITY_TYPES)[number];

/**
 * A piece of source evidence.
 *
 * Students see the public subset: the source, the session it applies to and
 * the date it was checked. The reviewer's notes stay on the staff surface.
 */
export interface SourceEvidence {
  id: string;
  institutionId: string;
  entityType: EvidenceEntityType;
  entityId: string | null;
  fieldKey: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  applicableSession: string | null;
  status: VerificationStatus;
  checkedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A profile is a summary plus typed sections.
 *
 * Every section starts `not_imported` today. That is a true statement about
 * the deployed schema, not a placeholder for a value someone forgot to fill.
 */
export interface InstitutionProfile extends InstitutionSummary {
  officialName: string | null;
  yearEstablished: number | null;
  overview: string | null;
  city: string | null;
  postalAddress: string | null;
  profileStatus: 'draft' | 'in_review' | 'published' | 'archived' | 'none';
  profileVerificationStatus: VerificationStatus;
  profileVerifiedAt: string | null;

  campuses: InstitutionSection<Campus>;
  academicUnits: InstitutionSection<AcademicUnit>;
  departments: InstitutionSection<AcademicUnit>;
  programmeOfferings: InstitutionSection<ProgrammeOffering>;
  admissionRoutes: InstitutionSection<AdmissionRoute>;
  programmeRequirements: InstitutionSection<ProgrammeRequirement>;
  benchmarks: InstitutionSection<AdmissionBenchmark>;
  portalGuides: InstitutionSection<PortalGuide>;
  sources: InstitutionSection<SourceEvidence>;

  /** Sessions for which this institution has published admission facts. */
  sessions: string[];
  /**
   * Set when a section could not be read. The UI surfaces this instead of
   * rendering an empty panel that looks like a fact.
   */
  readError?: string | null;
}
