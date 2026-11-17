import { readFileSync } from 'node:fs';

/**
 * Research batch -> import payload.
 *
 * This module is deliberately pure: it reads a batch file, validates it against
 * a directory of known institutions, and produces the payload that
 * `public.institution_import_apply(jsonb, boolean)` consumes. It opens no
 * connection and writes nothing, so the same mapping is used by the CLI, the
 * dry run and the tests.
 *
 * The rules it enforces before anything reaches the database:
 *
 *   * every referenced source key exists in the batch's own `sources` list;
 *   * every institution resolves to exactly one catalogue row (by UUID first,
 *     then by exact canonical name — never a fuzzy match, never a guess);
 *   * a session is `YYYY/YYYY` and the two years are consecutive;
 *   * a benchmark's value sits on the scale the institution published;
 *   * a benchmark type and an office name must be one of the recognised values,
 *     or the row is rejected with a reason instead of being coerced;
 *   * nothing is published: publication is a separate editorial decision.
 *
 * Anything the batch does not know stays `null`. A missing cut-off is reported
 * as missing, not as zero, and the national minimum is never copied into a
 * programme slot.
 */

export interface DirectoryEntry {
  institutionId: string;
  canonicalName: string;
  acronym?: string | null;
}

export interface ValidationIssue {
  entity: string;
  key: string;
  reason: string;
}

export interface ImportSummaryCounts {
  inserted: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
  skipped_verified: Record<string, number>;
  rejected: Array<{ entity: string; key: string; reason: string }>;
}

export interface ImportPayload {
  batchId: string;
  researchDate: string;
  sources: Array<{ sourceKey: string; name: string; url: string; authority?: string; sourceType?: string }>;
  profiles: any[];
  leadership: any[];
  campuses: any[];
  academicUnits: any[];
  offerings: any[];
  routes: any[];
  requirements: any[];
  benchmarks: any[];
  guides: any[];
  nationalPolicies: any[];
}

export interface TransformResult {
  payload: ImportPayload | null;
  issues: ValidationIssue[];
  counts: Record<string, number>;
}

const SESSION = /^(20\d{2})\/(20\d{2})$/;
const HTTPS = /^https:\/\/[^\s]+$/i;

/** Benchmark aliases that mean the same published fact. Unknown types are rejected. */
const BENCHMARK_TYPES: Record<string, string> = {
  national_minimum: 'national_minimum',
  national_tolerable_minimum: 'national_minimum',
  institution_utme_eligibility: 'institution_utme_eligibility',
  institution_threshold: 'institution_utme_eligibility',
  programme_utme_minimum: 'programme_utme_minimum',
  programme_minimum: 'programme_utme_minimum',
  screening_aggregate: 'screening_aggregate',
  departmental_screening_aggregate: 'screening_aggregate',
  departmental_merit: 'departmental_merit',
  catchment: 'catchment',
  elds: 'elds',
  post_utme_test: 'post_utme_test',
  other: 'other',
};

/** Office aliases. A post-specific deputy office keeps its published title. */
const OFFICE_KEYS: Record<string, { key: string; title: string }> = {
  chancellor: { key: 'chancellor', title: 'Chancellor' },
  pro_chancellor: { key: 'pro_chancellor', title: 'Pro-Chancellor' },
  vice_chancellor: { key: 'vice_chancellor', title: 'Vice-Chancellor' },
  deputy_vice_chancellor: { key: 'deputy_vice_chancellor', title: 'Deputy Vice-Chancellor' },
  deputy_vice_chancellor_academics: { key: 'deputy_vice_chancellor', title: 'Deputy Vice-Chancellor (Academics)' },
  deputy_vice_chancellor_administration: { key: 'deputy_vice_chancellor', title: 'Deputy Vice-Chancellor (Administration)' },
  rector: { key: 'rector', title: 'Rector' },
  provost: { key: 'provost', title: 'Provost' },
  president: { key: 'president', title: 'President' },
  registrar: { key: 'registrar', title: 'Registrar' },
  bursar: { key: 'bursar', title: 'Bursar' },
  university_librarian: { key: 'university_librarian', title: 'University Librarian' },
  other: { key: 'other', title: 'Other office' },
};

const OWNERSHIP: Record<string, string> = {
  federal: 'federal', state: 'state', private: 'private', other: 'other', unknown: 'unknown',
};

const CATEGORY: Record<string, string> = {
  university: 'university', polytechnic: 'polytechnic', monotechnic: 'monotechnic',
  college_of_education: 'college_of_education', college_of_agriculture: 'college_of_agriculture',
  college_of_nursing: 'college_of_nursing', innovation_enterprise_institute: 'innovation_enterprise_institute',
  other: 'other',
};

const ENTRY_MODES = new Set(['UTME', 'DIRECT_ENTRY', 'JUPEB', 'IJMB', 'PRE_DEGREE', 'DIPLOMA', 'ND', 'HND', 'TRANSFER', 'OTHER']);

const GUIDE_TYPES: Record<string, string> = {
  admissions: 'admissions',
  post_utme: 'post_utme',
  direct_entry: 'direct_entry',
  jamb_caps: 'jamb_caps',
  acceptance: 'acceptance',
  clearance: 'clearance',
  fees: 'fees',
  student: 'student_portal',
  student_and_clearance: 'student_portal',
  student_portal: 'student_portal',
  course_registration: 'course_registration',
  results: 'results',
  website_navigation: 'website_navigation',
  other: 'other',
};

const ACTING: Record<string, string> = {
  substantive: 'substantive',
  substantive_as_published: 'substantive',
  acting: 'acting',
  interim: 'interim',
  designate: 'designate',
};

export function isSession(value: unknown): boolean {
  const match = SESSION.exec(String(value ?? ''));
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

/** Fields that would publish research before a reviewer has seen it. */
export function assertNotPublished(batch: any): string[] {
  const forbidden: string[] = [];
  const walk = (node: any, path: string) => {
    if (Array.isArray(node)) return node.forEach((child, index) => walk(child, `${path}[${index}]`));
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (/^(published|publicationStatus|publication_status)$/i.test(key) && value !== false && value !== 'draft') {
        forbidden.push(`${path}.${key}`);
      }
      walk(value, `${path}.${key}`);
    }
  };
  walk(batch, 'batch');
  return forbidden;
}

export function transformBatch(
  batch: any,
  directory: DirectoryEntry[],
  options: { batchId?: string } = {},
): TransformResult {
  const issues: ValidationIssue[] = [];
  const counts: Record<string, number> = {
    sources: 0, profiles: 0, leadership: 0, academicUnits: 0, offerings: 0,
    routes: 0, requirements: 0, benchmarks: 0, guides: 0, nationalPolicies: 0,
  };

  let unresolvedInstitution = false;
  const byId = new Map(directory.map((entry) => [entry.institutionId.toLowerCase(), entry]));
  const byName = new Map<string, DirectoryEntry[]>();
  for (const entry of directory) {
    const key = entry.canonicalName.toLowerCase().replace(/\s+/g, ' ').trim();
    byName.set(key, [...(byName.get(key) ?? []), entry]);
  }

  const sourceByKey = new Map<string, any>(
    (batch.sources ?? []).map((source: any) => [String(source.sourceKey), source]),
  );
  for (const source of batch.sources ?? []) {
    if (!HTTPS.test(String(source.url ?? ''))) {
      issues.push({ entity: 'edureach_sources', key: String(source.sourceKey ?? '?'), reason: 'source url must be https' });
    }
  }
  counts.sources = (batch.sources ?? []).length;

  /**
   * The batch cites a home page and an "about" page, not the bare origin, so an
   * exact URL match is not enough. Resolution is still deterministic: exact URL,
   * then the institution's own landing page, then the first source on its host.
   */
  const sourceKeyForUrl = (url: unknown): string | null => {
    if (!url) return null;
    const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/\/$/, '');
    const target = normalize(url);
    for (const [key, source] of sourceByKey) {
      if (normalize(source.url) === target) return key;
    }
    let host = '';
    try { host = new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return null; }
    const onHost = [...sourceByKey.entries()].filter(([, source]) => {
      try { return new URL(String(source.url)).hostname.replace(/^www\./, '') === host; } catch { return false; }
    });
    const landing = onHost.find(([, source]) => {
      try { return ['', '/', '/home.php', '/index.php', '/about', '/about.php'].includes(new URL(String(source.url)).pathname); } catch { return false; }
    });
    return (landing ?? onHost[0])?.[0] ?? null;
  };

  const sourceId = (sourceKey: unknown, entity: string, key: string): string | null => {
    const source = sourceByKey.get(String(sourceKey));
    if (!source) {
      issues.push({ entity, key, reason: `unknown sourceKey ${String(sourceKey ?? '(none)')}` });
      return null;
    }
    if (!HTTPS.test(String(source.url ?? ''))) {
      issues.push({ entity, key, reason: `source ${String(sourceKey)} is not https` });
      return null;
    }
    return source.url;
  };

  const resolveInstitution = (raw: any, entity: string, key: string): DirectoryEntry | null => {
    const id = typeof raw === 'string' ? raw : raw?.institutionId;
    if (id && byId.has(String(id).toLowerCase())) return byId.get(String(id).toLowerCase())!;
    const name = typeof raw === 'string' ? raw : raw?.canonicalName;
    if (name) {
      const matches = byName.get(String(name).toLowerCase().replace(/\s+/g, ' ').trim()) ?? [];
      if (matches.length === 1) return matches[0];
      unresolvedInstitution = true;
      issues.push({
        entity,
        key,
        reason: matches.length === 0
          ? `no catalogue row is named "${name}"`
          : `${matches.length} catalogue rows are named "${name}"; reconcile them before importing`,
      });
      return null;
    }
    unresolvedInstitution = true;
    issues.push({ entity, key, reason: 'no institutionId and no canonicalName' });
    return null;
  };

  const payload: ImportPayload = {
    batchId: options.batchId ?? String(batch.researchDate ?? 'unlabelled'),
    researchDate: String(batch.researchDate ?? new Date().toISOString().slice(0, 10)),
    sources: (batch.sources ?? []).map((source: any) => ({
      sourceKey: source.sourceKey,
      name: source.name,
      url: source.url,
      authority: source.authority,
      sourceType: source.sourceType,
    })),
    profiles: [],
    leadership: [],
    campuses: [],
    academicUnits: [],
    offerings: [],
    routes: [],
    requirements: [],
    benchmarks: [],
    guides: [],
    nationalPolicies: [],
  };

  for (const institution of batch.institutions ?? []) {
    const entry = resolveInstitution(institution.institutionId, 'institutions', String(institution.canonicalName ?? '?'));
    if (!entry) continue;
    const institutionId = entry.institutionId;
    const label = entry.canonicalName;
    const profile = institution.profile ?? {};

    // ---------------------------------------------------------------- profile
    const profileSource = sourceId(
      institution.profileSourceKey
        ?? institution.sources?.profile
        ?? sourceKeyForUrl(institution.officialWebsite)
        ?? sourceKeyForUrl(profile.aboutUrl),
      'institution_profiles',
      label,
    );
    if (profileSource && (institution.officialWebsite || profile.mission || profile.historySummary)) {
      payload.profiles.push({
        institutionId,
        officialName: institution.canonicalName,
        ownership: OWNERSHIP[String(institution.ownership ?? '').toLowerCase()] ?? null,
        institutionCategory: CATEGORY[String(institution.institutionType ?? 'university').toLowerCase()] ?? null,
        yearEstablished: profile.yearFounded ?? null,
        historySummary: profile.historySummary ?? null,
        overview: profile.overview ?? null,
        mission: profile.mission ?? null,
        vision: profile.vision ?? null,
        mandate: profile.mandate ?? null,
        city: profile.location ?? null,
        officialWebsiteUrl: institution.officialWebsite ?? null,
        admissionPortalUrl: institution.admissionPortal ?? null,
        studentPortalUrl: institution.studentPortal ?? null,
        sourceUrl: profileSource,
      });
      counts.profiles += 1;
    }

    // ------------------------------------------------------------- leadership
    const leadership = [...(institution.leadership ?? [])];
    // A chancellor whose name was never verified stays null: it is not imported.
    for (const person of leadership) {
      const office = OFFICE_KEYS[String(person.role ?? '')];
      if (!office) {
        issues.push({ entity: 'institution_leadership', key: `${label}:${person.role}`, reason: 'unrecognised office role' });
        continue;
      }
      if (!person.name) {
        issues.push({ entity: 'institution_leadership', key: `${label}:${person.role}`, reason: 'no published name' });
        continue;
      }
      const url = sourceId(person.sourceKey, 'institution_leadership', `${label}:${person.role}`);
      if (!url) continue;
      payload.leadership.push({
        institutionId,
        officeKey: office.key,
        officeTitle: person.officeTitle ?? office.title,
        fullName: person.name,
        actingStatus: ACTING[String(person.actingStatus ?? 'substantive')] ?? 'unknown',
        startsOn: person.startsOn ?? null,
        endsOn: person.endsOn ?? null,
        isCurrent: true,
        sourceUrl: url,
      });
      counts.leadership += 1;
    }

    // ---------------------------------------------------------- academicUnits
    const units = institution.academicUnits ?? {};
    for (const rawName of units.items ?? []) {
      const name = String(rawName).trim();
      const prefix = /^(faculty of|college of|school of|institute of|centre for|department of)\b/i.exec(name);
      const unitType = !prefix ? null
        : /^faculty/i.test(prefix[1]) ? 'faculty'
        : /^college/i.test(prefix[1]) ? 'college'
        : /^school/i.test(prefix[1]) ? 'school'
        : /^institute/i.test(prefix[1]) ? 'institute'
        : /^centre/i.test(prefix[1]) ? 'centre'
        : 'department';
      if (!unitType) {
        // A grouping that the source does not classify is not promoted into a
        // faculty. It is reported so a researcher can confirm the nomenclature.
        issues.push({
          entity: 'institution_academic_units',
          key: `${label}:${name}`,
          reason: 'unit name does not state its official type; classification pending',
        });
        continue;
      }
      const url = sourceId(units.sourceKey, 'institution_academic_units', name) ?? (units.sourceUrl ?? null);
      if (!url) continue;
      payload.academicUnits.push({ institutionId, unitType, unitName: name, sourceUrl: url });
      counts.academicUnits += 1;
    }

    // --------------------------------------------------------------- routes
    const admission = institution.admission ?? {};
    const session = admission.session;
    if (!isSession(session)) {
      issues.push({ entity: 'institution_admission_routes', key: label, reason: `session "${String(session)}" is not YYYY/YYYY` });
    }
    for (const route of admission.routes ?? []) {
      const entryMode = String(route.entryMode ?? '').toUpperCase();
      if (!ENTRY_MODES.has(entryMode)) {
        issues.push({ entity: 'institution_admission_routes', key: `${label}:${route.entryMode}`, reason: 'unrecognised entry mode' });
        continue;
      }
      if (!isSession(session)) continue;
      const url = route.sourceKey
        ? sourceId(route.sourceKey, 'institution_admission_routes', `${label}:${entryMode}`)
        : sourceId(institution.sources?.admissions ?? route.sourceKey, 'institution_admission_routes', `${label}:${entryMode}`);
      if (!url) continue;
      payload.routes.push({
        institutionId,
        admissionSession: session,
        entryMode,
        assessmentMethods: route.assessment ?? [],
        firstChoiceRequired: route.firstChoiceRequired ?? null,
        applicationUrl: route.applicationUrl ?? null,
        sourceUrl: url,
      });
      counts.routes += 1;
    }

    // ------------------------------------------------------------- offerings
    const programmeNames = new Set<string>();
    for (const item of admission.programmeMinimumUtmeScores ?? []) programmeNames.add(String(item.programme));
    for (const item of admission.aggregateCutoffs?.records ?? []) programmeNames.add(String(item.programme));
    for (const item of admission.programmeRequirements ?? []) programmeNames.add(String(item.programmeName));
    for (const name of programmeNames) {
      if (!name || name === 'undefined') continue;
      payload.offerings.push({
        institutionId,
        programmeName: name,
        admissionSession: isSession(session) ? session : null,
        sourceUrl: sourceByKey.get(String(sourceKeyForUrl(institution.officialWebsite)))?.url ?? null,
      });
      counts.offerings += 1;
    }

    // ---------------------------------------------------------- requirements
    for (const requirement of admission.programmeRequirements ?? []) {
      const url = sourceId(requirement.sourceKey, 'institution_programme_requirements', String(requirement.programmeName));
      if (!url || !isSession(session)) continue;
      const entryMode = String(requirement.entryMode ?? '').toUpperCase();
      if (!ENTRY_MODES.has(entryMode)) {
        issues.push({ entity: 'institution_programme_requirements', key: String(requirement.programmeName), reason: 'unrecognised entry mode' });
        continue;
      }
      payload.requirements.push({
        institutionId,
        programmeName: requirement.programmeName,
        admissionSession: session,
        entryMode,
        utmeSubjects: requirement.utmeSubjects ?? [],
        oLevelRequirements: requirement.oLevel ? { ...requirement.oLevel, sourceKey: requirement.sourceKey } : {},
        aLevelRequirements: requirement.aLevel ?? {},
        otherRequirements: requirement.pathways ? { pathways: requirement.pathways } : {},
        minimumUtmeScore: requirement.minimumUtmeScore ?? null,
        minimumUtmeScale: requirement.minimumUtmeScale ?? 400,
        firstChoiceRequired: requirement.firstChoiceRequired ?? null,
        sourceUrl: url,
      });
      counts.requirements += 1;
    }

    // ------------------------------------------------------------ benchmarks
    const pushBenchmark = (raw: any, origin: string) => {
      const type = BENCHMARK_TYPES[String(raw.benchmarkType ?? '')];
      if (!type) {
        issues.push({ entity: 'institution_admission_benchmarks', key: `${label}:${origin}`, reason: `unrecognised benchmark type "${String(raw.benchmarkType)}"` });
        return;
      }
      const scaleMax = Number(raw.scaleMaximum ?? raw.scoreScaleMaximum ?? 400);
      const scaleMin = Number(raw.scaleMinimum ?? 0);
      const value = Number(raw.value ?? raw.score);
      if (!Number.isFinite(value) || !Number.isFinite(scaleMax) || value > scaleMax || value < scaleMin) {
        issues.push({ entity: 'institution_admission_benchmarks', key: `${label}:${origin}`, reason: `value ${raw.value ?? raw.score} is outside its ${scaleMin}-${scaleMax} scale` });
        return;
      }
      const url = sourceId(raw.sourceKey, 'institution_admission_benchmarks', `${label}:${origin}`);
      if (!url) return;
      if (!isSession(raw.session ?? session)) {
        issues.push({ entity: 'institution_admission_benchmarks', key: `${label}:${origin}`, reason: 'benchmark session is not YYYY/YYYY' });
        return;
      }
      payload.benchmarks.push({
        institutionId,
        programmeName: raw.programmeName ?? null,
        admissionSession: raw.session ?? session,
        benchmarkType: type,
        benchmarkLabel: raw.label ?? `${type.replace(/_/g, ' ')} (${origin})`,
        benchmarkValue: value,
        scoreScaleMin: scaleMin,
        scoreScaleMax: scaleMax,
        categoryKey: raw.category ?? 'general',
        stateCategory: raw.stateCategory ?? null,
        isEligibilityFloor: type === 'institution_utme_eligibility',
        notes: raw.note ?? null,
        sourceUrl: url,
      });
      counts.benchmarks += 1;
    };

    for (const benchmark of admission.benchmarks ?? []) pushBenchmark({ ...benchmark, session: benchmark.session ?? session }, 'published threshold');

    const admissionSourceKey = institution.sources?.admissions
      ?? sourceKeyForUrl(institution.admissionPortal)
      ?? sourceKeyForUrl(institution.officialWebsite);

    for (const item of admission.programmeMinimumUtmeScores ?? []) {
      if (!item.programme) continue;
      pushBenchmark({
        benchmarkType: 'programme_utme_minimum',
        programmeName: item.programme,
        value: item.score,
        scaleMaximum: item.scaleMaximum ?? 400,
        session,
        category: 'general',
        sourceKey: item.sourceKey ?? admissionSourceKey,
        label: `UTME minimum (${item.programme})`,
      }, 'programme minimum');
    }

    const aggregates = admission.aggregateCutoffs;
    if (aggregates?.records?.length) {
      for (const record of aggregates.records) {
        for (const category of aggregates.categories ?? []) {
          const score = record[category];
          if (score === null || score === undefined) continue;
          const isState = category !== 'merit';
          pushBenchmark({
            benchmarkType: aggregates.benchmarkType ?? 'screening_aggregate',
            programmeName: record.programme,
            value: score,
            scaleMaximum: aggregates.scoreScaleMaximum ?? 100,
            session: aggregates.session ?? session,
            category: isState ? 'state_catchment' : 'merit',
            stateCategory: isState ? category : null,
            sourceKey: aggregates.sourceKey,
            label: `${isState ? category : 'Merit'} screening aggregate`,
          }, `${record.programme}:${category}`);
        }
      }
    }

    // ---------------------------------------------------------------- guides
    for (const guide of institution.portalGuides ?? []) {
      const guideType = GUIDE_TYPES[String(guide.portal ?? 'other')];
      if (!guideType) {
        issues.push({ entity: 'institution_portal_guides', key: `${label}:${guide.portal}`, reason: 'unrecognised guide type' });
        continue;
      }
      const url = sourceId(guide.sourceKey, 'institution_portal_guides', `${label}:${guide.portal}`);
      if (!url) continue;
      payload.guides.push({
        institutionId,
        guideType,
        title: guide.title ?? `${label} ${guideType.replace(/_/g, ' ')} guide`,
        admissionSession: guide.session ?? (isSession(session) ? session : null),
        portalUrl: guide.portalUrl ?? institution.admissionPortal ?? institution.studentPortal ?? null,
        summary: guide.stageNote ?? null,
        safetyNote: guide.safetyNote ?? null,
        steps: (guide.steps ?? []).map((step: any) => (typeof step === 'string' ? { instruction: step } : step)),
        sourceUrl: url,
      });
      counts.guides += 1;
    }
  }

  // ---------------------------------------------------------- national policy
  const policy = batch.nationalAdmissionPolicy;
  if (policy) {
    const url = sourceId(policy.sourceKey, 'national_admission_policies', 'national policy');
    if (url) {
      for (const minimum of policy.minimumTolerableScores ?? []) {
        payload.nationalPolicies.push({
          authority: policy.authority,
          admissionSession: policy.policyCycle,
          institutionCategory: minimum.institutionCategory,
          entryMode: 'UTME',
          policyType: 'minimum_tolerable_utme_score',
          numericValue: minimum.score,
          valueUnit: 'utme_score',
          notes: policy.notes ?? null,
          sourceUrl: url,
        });
        counts.nationalPolicies += 1;
      }
      if (policy.minimumAdmissionAge != null) {
        payload.nationalPolicies.push({
          authority: policy.authority,
          admissionSession: policy.policyCycle,
          institutionCategory: 'university',
          entryMode: 'UTME',
          policyType: 'minimum_admission_age',
          numericValue: policy.minimumAdmissionAge,
          valueUnit: 'years',
          notes: policy.notes ?? null,
          sourceUrl: url,
        });
        counts.nationalPolicies += 1;
      }
    }
  }

  // Publication is an editorial act, never an import side effect.
  const published = assertNotPublished(batch);
  for (const path of published) {
    issues.push({ entity: 'institutions', key: path, reason: 'research batch must not assert a publication state' });
  }

  // An institution that cannot be identified is a blocking failure: importing
  // the rest of the batch around it would create research nobody can attach to
  // a record, and the next batch would duplicate it.
  const blocking = published.length > 0 || payload.sources.length === 0 || unresolvedInstitution;
  return { payload: blocking ? null : payload, issues, counts };
}

export function loadBatch(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}
