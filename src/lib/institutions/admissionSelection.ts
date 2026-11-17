/**
 * The student admission-selection workflow.
 *
 * Nine steps, in the order a student walks them:
 *
 *   1. examination / admission route     6. verified subject combination
 *   2. institution                       7. O'Level and other requirements
 *   3. programme                         8. score thresholds and screening
 *   4. admission session                 9. official application instructions
 *   5. entry mode
 *
 * This module encodes the honesty rules that keep that flow from misleading
 * anybody. Each rule exists because the tempting shortcut is wrong:
 *
 *   * JAMB IBASS is the authority for UTME subject combinations. An
 *     institution page may add context; it never silently overrides eligibility.
 *   * English is compulsory *where the official rule requires it*
 *     (`englishCompulsoryFor`). It is not added to every combination.
 *   * A national minimum is a policy floor, not a departmental cut-off.
 *     `isDepartmentalCutoff` exists so the two can never be rendered alike.
 *   * A UTME score (0-400) and a screening aggregate (0-100) live on different
 *     scales. `areSameScale` refuses to compare them.
 *   * An old session's requirement is not the current one. `isCurrentSession`
 *     is explicit about which session "current" means.
 *   * A screening formula is displayed only if the institution published one.
 *     There is no default, no "typical" weighting, no estimate.
 *
 * Nothing here invents a subject list, a formula or a threshold. Every value
 * that reaches the screen has to arrive as a row from the institution's own
 * published data.
 */

import { normalizeSession, sortSessions } from './normalizers';
import {
  BENCHMARK_TYPE_LABELS,
  ENTRY_MODE_LABELS,
  type AdmissionBenchmark,
  type AdmissionRoute,
  type EntryMode,
  type ProgrammeOffering,
  type ProgrammeRequirement,
} from './types';

/** JAMB's own eligibility system, the authority for UTME combinations. */
export const UTME_SUBJECT_AUTHORITY = {
  name: 'JAMB IBASS',
  label: 'JAMB Integrated Brochure and Syllabus System',
  url: 'https://eligibility.jamb.gov.ng/',
} as const;

export const ADMISSION_SELECTION_STEPS = [
  'exam_route',
  'institution',
  'programme',
  'session',
  'entry_mode',
  'subject_combination',
  'requirements',
  'benchmarks',
  'application',
] as const;

export type AdmissionSelectionStep = (typeof ADMISSION_SELECTION_STEPS)[number];

export const ADMISSION_SELECTION_LABELS: Record<AdmissionSelectionStep, string> = {
  exam_route: 'Examination or admission route',
  institution: 'Institution',
  programme: 'Programme',
  session: 'Admission session',
  entry_mode: 'Entry mode',
  subject_combination: 'Subject combination',
  requirements: "O'Level and other requirements",
  benchmarks: 'Score thresholds and screening',
  application: 'Official application instructions',
};

export interface AdmissionSelection {
  examRoute: 'JAMB_UTME' | 'WAEC' | 'NECO' | 'POST_UTME' | null;
  institutionId: string | null;
  programmeOfferingId: string | null;
  session: string | null;
  entryMode: EntryMode | null;
}

export const EMPTY_ADMISSION_SELECTION: AdmissionSelection = {
  examRoute: null,
  institutionId: null,
  programmeOfferingId: null,
  session: null,
  entryMode: null,
};

/** The first step that still needs an answer. */
export function nextSelectionStep(selection: AdmissionSelection): AdmissionSelectionStep | null {
  if (!selection.examRoute) return 'exam_route';
  if (!selection.institutionId) return 'institution';
  if (!selection.programmeOfferingId) return 'programme';
  if (!selection.session) return 'session';
  if (!selection.entryMode) return 'entry_mode';
  return null;
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sessions with published facts, newest first.
 *
 * `currentSession` is the newest one present, never a hard-coded value: an
 * institution that has not published for this cycle must not have last year's
 * requirements presented as this year's.
 */
export function availableSessions(
  routes: AdmissionRoute[],
  requirements: ProgrammeRequirement[],
  benchmarks: AdmissionBenchmark[],
): string[] {
  return sortSessions([
    ...routes.map((route) => route.session),
    ...requirements.map((requirement) => requirement.session),
    ...benchmarks.map((benchmark) => benchmark.session),
  ]);
}

export function currentSession(sessions: string[]): string | null {
  return sortSessions(sessions)[0] ?? null;
}

/** Whether `session` is the newest published session for this institution. */
export function isCurrentSession(session: string | null, sessions: string[]): boolean {
  if (!session) return false;
  return currentSession(sessions) === normalizeSession(session);
}

/* -------------------------------------------------------------------------- */
/* Subject combinations                                                        */
/* -------------------------------------------------------------------------- */

const ENGLISH_SUBJECT = /^use of english$|^english( language)?$/i;

export function isEnglishSubject(subject: string): boolean {
  return ENGLISH_SUBJECT.test(subject.trim());
}

/**
 * Is English compulsory for this combination?
 *
 * True only when the entry mode is UTME (where JAMB IBASS selects English by
 * default) or when the requirement's own published subject list names it.
 * It is never added silently to a Direct Entry or JUPEB combination, and it is
 * never presented as an EduReach rule — the authority is named alongside it.
 */
export function englishCompulsoryFor(requirement: Pick<ProgrammeRequirement, 'entryMode' | 'utmeSubjects'>): boolean {
  if (requirement.entryMode === 'UTME') return true;
  return requirement.utmeSubjects.some(isEnglishSubject);
}

/**
 * The subjects a student must sit, in published order, with English first for
 * UTME because that is how IBASS presents it.
 */
export function orderedSubjects(requirement: ProgrammeRequirement): string[] {
  const subjects = [...requirement.utmeSubjects];
  if (requirement.entryMode !== 'UTME') return subjects;
  const english = subjects.filter(isEnglishSubject);
  const rest = subjects.filter((subject) => !isEnglishSubject(subject));
  return [...english, ...rest];
}

/* -------------------------------------------------------------------------- */
/* Benchmarks                                                                  */
/* -------------------------------------------------------------------------- */

/** Benchmark kinds that are a competitive cut-off rather than a policy floor. */
const COMPETITIVE_TYPES = ['departmental_merit', 'screening_aggregate', 'catchment', 'elds'] as const;

/** Benchmark kinds that are floors, thresholds or national policy. */
const FLOOR_TYPES = ['national_minimum', 'institution_utme_eligibility', 'programme_utme_minimum', 'post_utme_test'] as const;

/**
 * A departmental cut-off is a competitive value for a specific programme.
 *
 * A JAMB national minimum is a policy floor for a category of institutions. It
 * is never a departmental cut-off, and putting it in that column is exactly the
 * error this predicate exists to prevent.
 */
export function isDepartmentalCutoff(benchmark: AdmissionBenchmark): boolean {
  if ((COMPETITIVE_TYPES as readonly string[]).includes(benchmark.type)) return true;
  return (FLOOR_TYPES as readonly string[]).includes(benchmark.type)
    ? benchmark.isEligibilityFloor === false && benchmark.programmeOfferingId !== null && benchmark.type === 'programme_utme_minimum'
    : false;
}

/** Two benchmarks may only be compared when they share a scale. */
export function areSameScale(a: AdmissionBenchmark, b: AdmissionBenchmark): boolean {
  return a.scoreScaleMin === b.scoreScaleMin && a.scoreScaleMax === b.scoreScaleMax;
}

/**
 * A benchmark rendered with its scale, so `150` can never be read as `150/100`.
 * `150 / 400 UTME`, `50 / 100 aggregate`.
 */
export function formatBenchmark(benchmark: AdmissionBenchmark): string {
  const value = Number.isInteger(benchmark.value) ? String(benchmark.value) : benchmark.value.toFixed(2);
  return `${value} / ${benchmark.scoreScaleMax}`;
}

export function describeBenchmark(benchmark: AdmissionBenchmark): string {
  const label = BENCHMARK_TYPE_LABELS[benchmark.type];
  const qualifier = benchmark.isEligibilityFloor ? 'eligibility floor' : 'cut-off';
  const category = benchmark.stateCategory ? ` · ${benchmark.stateCategory}` : '';
  return `${label} (${qualifier}): ${formatBenchmark(benchmark)}${category}`;
}

/**
 * The screening method as published.
 *
 * `null` when the institution did not publish one. There is no fallback
 * weighting, because a 50/50 JAMB/screening split that the institution never
 * stated is a fabricated score.
 */
export function screeningMethodFor(benchmark: AdmissionBenchmark): string | null {
  const method = benchmark.calculationMethod?.trim();
  return method ? method : null;
}

/* -------------------------------------------------------------------------- */
/* Selection against real rows                                                 */
/* -------------------------------------------------------------------------- */

export interface AdmissionSelectionData {
  offerings: ProgrammeOffering[];
  routes: AdmissionRoute[];
  requirements: ProgrammeRequirement[];
  benchmarks: AdmissionBenchmark[];
}

/** Programmes published for this institution and session. */
export function programmesForSession(data: AdmissionSelectionData, session: string | null): ProgrammeOffering[] {
  if (!session) return data.offerings;
  return data.offerings.filter((offering) => offering.session === session || offering.session === null);
}

/** Entry modes the institution has published a route for, in this session. */
export function entryModesForSession(data: AdmissionSelectionData, session: string | null): EntryMode[] {
  const modes = new Set<EntryMode>();
  for (const route of data.routes) {
    if (session && route.session !== session) continue;
    modes.add(route.entryMode);
  }
  for (const requirement of data.requirements) {
    if (session && requirement.session !== session) continue;
    modes.add(requirement.entryMode);
  }
  return Array.from(modes);
}

export function entryModeLabel(mode: EntryMode): string {
  return ENTRY_MODE_LABELS[mode] ?? mode;
}

/**
 * The requirement that applies to one programme, session and entry mode.
 *
 * Returns `null` rather than the closest match: a requirement from another
 * session is a different requirement.
 */
export function requirementFor(
  data: AdmissionSelectionData,
  selection: Pick<AdmissionSelection, 'programmeOfferingId' | 'session' | 'entryMode'>,
): ProgrammeRequirement | null {
  if (!selection.programmeOfferingId || !selection.session || !selection.entryMode) return null;
  return (
    data.requirements.find(
      (requirement) =>
        requirement.programmeOfferingId === selection.programmeOfferingId &&
        requirement.session === selection.session &&
        requirement.entryMode === selection.entryMode,
    ) ?? null
  );
}

/** Benchmarks that apply to one programme and session. */
export function benchmarksFor(
  data: AdmissionSelectionData,
  selection: Pick<AdmissionSelection, 'programmeOfferingId' | 'session'>,
): AdmissionBenchmark[] {
  if (!selection.session) return [];
  return data.benchmarks.filter((benchmark) => {
    if (benchmark.session !== selection.session) return false;
    if (!selection.programmeOfferingId) return benchmark.programmeOfferingId === null;
    return benchmark.programmeOfferingId === null || benchmark.programmeOfferingId === selection.programmeOfferingId;
  });
}

/** Institution-wide benchmarks for a session (no programme attached). */
export function institutionBenchmarksFor(
  data: AdmissionSelectionData,
  session: string | null,
): AdmissionBenchmark[] {
  if (!session) return [];
  return data.benchmarks.filter((benchmark) => benchmark.session === session && benchmark.programmeOfferingId === null);
}

/**
 * Whether this institution's published screening is CBT.
 *
 * Used to decide whether a playable Post-UTME practice bank may be offered at
 * all: a school that screens on paper does not have a CBT combination to
 * practise, and offering one would be an invention.
 */
export function usesCbtScreening(routes: AdmissionRoute[], session: string | null): boolean {
  return routes.some(
    (route) =>
      (!session || route.session === session) && route.assessmentMethods.includes('cbt'),
  );
}
