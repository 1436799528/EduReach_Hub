import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The institution frontend contract.
 *
 * These tests exist to keep four promises from quietly breaking:
 *
 *   1. ownership is never inferred — an unknown stays unknown;
 *   2. the two University of Calabar rows resolve to one public identity
 *      without either row being deleted or merged;
 *   3. the frontend keeps working against the schema that is deployed today;
 *   4. a score is never shown without the scale it was published on.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const CANONICAL_CALABAR = '1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc';
const ALIAS_CALABAR = '255e4ba4-b75f-48b1-8ed1-00a7fcb8a967';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '3f1b9d40-0000-4000-8000-000000000001',
    school_name: 'Test University',
    acronym: 'TU',
    state: 'Lagos',
    institution_type: 'University',
    website_url: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Normalizers                                                                 */
/* -------------------------------------------------------------------------- */

test('ownership is never inferred from a name, a state or a type', async () => {
  const { normalizeOwnership } = await import('../src/lib/institutions/normalizers');
  // The tempting shortcut: "Federal University of Technology" → federal.
  for (const guess of [
    'Federal University of Technology',
    'federal',
    'Federal',
    'Lagos State University',
    'state',
    'private',
    'unknown',
    'other',
    null,
    undefined,
    '',
  ]) {
    assert.equal(
      normalizeOwnership(guess),
      // Only the three published values count, and only when they are given.
      ['federal', 'state', 'private'].includes(String(guess).trim().toLowerCase())
        ? String(guess).trim().toLowerCase()
        : null,
      `ownership must not be derived from "${String(guess)}"`,
    );
  }
  assert.equal(normalizeOwnership(null), null, 'the directory has no ownership column, so unknown is the default');
});

test('category may be read from the directory\'s own type column', async () => {
  const { normalizeCategory } = await import('../src/lib/institutions/normalizers');
  assert.equal(normalizeCategory('University'), 'university');
  assert.equal(normalizeCategory('polytechnic'), 'polytechnic');
  assert.equal(normalizeCategory('College of Nursing'), 'college_of_nursing');
  assert.equal(normalizeCategory('Some Other Thing'), null);
});

test('only absolute http(s) URLs survive normalization', async () => {
  const { normalizeUrl } = await import('../src/lib/institutions/normalizers');
  assert.equal(normalizeUrl('https://unical.edu.ng'), 'https://unical.edu.ng');
  assert.equal(normalizeUrl('http://unical.edu.ng/'), 'http://unical.edu.ng/');
  assert.equal(normalizeUrl('www.unical.edu.ng'), null, 'a bare domain is not a link and is never repaired');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl(''), null);
});

test('an admission session must be two consecutive years', async () => {
  const { normalizeSession, sortSessions } = await import('../src/lib/institutions/normalizers');
  assert.equal(normalizeSession('2026/2027'), '2026/2027');
  assert.equal(normalizeSession('2026/2028'), null, 'a non-consecutive pair is rejected, not repaired');
  assert.equal(normalizeSession('2026'), null);
  assert.equal(normalizeSession('next session'), null);
  assert.deepEqual(sortSessions(['2024/2025', '2026/2027', '2025/2026']), ['2026/2027', '2025/2026', '2024/2025']);
});

test('a score outside its declared scale is rejected', async () => {
  const { normalizeScore } = await import('../src/lib/institutions/normalizers');
  assert.equal(normalizeScore(150, 400), 150);
  assert.equal(normalizeScore('250', 100), null, '250/100 is a data error, not a value to display');
  assert.equal(normalizeScore(50, 100), 50);
  assert.equal(normalizeScore(null, 400), null);
});

/* -------------------------------------------------------------------------- */
/* Identity resolution                                                         */
/* -------------------------------------------------------------------------- */

test('the two Calabar rows resolve to one canonical public identity', async () => {
  const { canonicalInstitutionId, isSuppressedDuplicate, canonicalIdForSlug } = await import(
    '../src/lib/institutions/aliases'
  );
  assert.equal(canonicalInstitutionId(ALIAS_CALABAR), CANONICAL_CALABAR);
  assert.equal(canonicalInstitutionId(CANONICAL_CALABAR), CANONICAL_CALABAR, 'the canonical row maps to itself');
  assert.equal(canonicalIdForSlug('university-of-calabar-calabar'), CANONICAL_CALABAR);
  assert.equal(canonicalIdForSlug('University of Calabar, Calabar'), CANONICAL_CALABAR);
  assert.equal(canonicalIdForSlug('university-of-lagos'), null);

  // The alias row is hidden only while the canonical row is present. If the
  // canonical row is missing from a result set, the alias stays reachable.
  assert.equal(isSuppressedDuplicate(ALIAS_CALABAR, [CANONICAL_CALABAR, ALIAS_CALABAR]), true);
  assert.equal(isSuppressedDuplicate(ALIAS_CALABAR, [ALIAS_CALABAR]), false);
});

test('both Calabar UUIDs still exist as records — nothing is deleted or merged', () => {
  const aliases = read('src/lib/institutions/aliases.ts');
  assert.ok(aliases.includes(CANONICAL_CALABAR), 'the canonical UUID is recorded');
  assert.ok(aliases.includes(ALIAS_CALABAR), 'the alias UUID is recorded, not removed');
  assert.match(aliases, /never rewritten out of the database|not merged/, 'the resolution is read-path only');
  const repository = read('src/lib/institutions/repository.ts');
  assert.doesNotMatch(repository, /\.delete\(|\.update\(\{.*school_name/, 'the repository never rewrites a row');
});

test('a legacy Calabar slug resolves to the canonical institution', async () => {
  const { resolveInstitution } = await import('../src/lib/institutions/selectors');
  const directory = [
    {
      id: CANONICAL_CALABAR,
      name: 'University of Calabar',
      acronym: 'UNICAL',
      state: 'Cross River',
      institutionType: 'University',
      category: 'university' as const,
      ownership: null,
      websiteUrl: null,
      admissionPortalUrl: null,
      studentPortalUrl: null,
      slug: 'university-of-calabar',
      aliases: [{ name: 'University of Calabar, Calabar', type: 'alternate_name' as const, preferredDisplay: false, status: 'unresearched' as const }],
      postUtme: null,
      verifiedWebsite: false,
      intelligencePublished: false,
    },
  ];
  assert.equal(resolveInstitution(directory, 'university-of-calabar')?.id, CANONICAL_CALABAR);
  assert.equal(resolveInstitution(directory, 'university-of-calabar-calabar')?.id, CANONICAL_CALABAR);
  assert.equal(resolveInstitution(directory, 'UNICAL')?.id, CANONICAL_CALABAR, 'the acronym resolves too');
  assert.equal(resolveInstitution(directory, ALIAS_CALABAR)?.id, CANONICAL_CALABAR, 'the alias UUID resolves');
  assert.equal(resolveInstitution(directory, 'university-of-lagos'), null);
});

test('search finds a name, an acronym and an accepted alias', async () => {
  const { matchesTerm, searchInstitutions, deduplicateInstitutions } = await import(
    '../src/lib/institutions/selectors'
  );
  const directory = [
    {
      id: CANONICAL_CALABAR,
      name: 'University of Calabar',
      acronym: 'UNICAL',
      state: 'Cross River',
      institutionType: 'University',
      category: 'university' as const,
      ownership: null,
      websiteUrl: null,
      admissionPortalUrl: null,
      studentPortalUrl: null,
      slug: 'university-of-calabar',
      aliases: [{ name: 'University of Calabar, Calabar', type: 'alternate_name' as const, preferredDisplay: false, status: 'unresearched' as const }],
      postUtme: null,
      verifiedWebsite: false,
      intelligencePublished: false,
    },
    {
      id: ALIAS_CALABAR,
      name: 'University of Calabar, Calabar',
      acronym: null,
      state: 'Cross River',
      institutionType: 'University',
      category: 'university' as const,
      ownership: null,
      websiteUrl: null,
      admissionPortalUrl: null,
      studentPortalUrl: null,
      slug: 'university-of-calabar-calabar',
      aliases: [],
      postUtme: null,
      verifiedWebsite: false,
      intelligencePublished: false,
    },
  ];

  const canonical = directory[0];
  assert.ok(matchesTerm(canonical, 'calabar'));
  assert.ok(matchesTerm(canonical, 'unical'), 'the acronym is searchable');
  assert.ok(matchesTerm(canonical, 'Calabar, Calabar'), 'an accepted alias is searchable');
  assert.ok(matchesTerm(canonical, 'unical cross'), 'every token must match, in any order');
  assert.ok(!matchesTerm(canonical, 'lagos'));

  // The finder shows one Calabar, not two.
  const listed = searchInstitutions(directory, { term: 'calabar' });
  assert.equal(listed.length, 1, 'the duplicate row is not listed twice');
  assert.equal(listed[0].id, CANONICAL_CALABAR);
  assert.equal(deduplicateInstitutions(directory).length, 1);
});

test('an ownership filter can only narrow to published ownership', async () => {
  const { searchInstitutions, ownershipsOf } = await import('../src/lib/institutions/selectors');
  const directory = [
    { id: 'a', name: 'Alpha University', acronym: null, state: 'Lagos', institutionType: 'University', category: 'university' as const, ownership: null, websiteUrl: null, admissionPortalUrl: null, studentPortalUrl: null, slug: 'alpha-university', aliases: [], postUtme: null, verifiedWebsite: false, intelligencePublished: false },
    { id: 'b', name: 'Beta University', acronym: null, state: 'Ogun', institutionType: 'University', category: 'university' as const, ownership: 'federal' as const, websiteUrl: null, admissionPortalUrl: null, studentPortalUrl: null, slug: 'beta-university', aliases: [], postUtme: null, verifiedWebsite: false, intelligencePublished: false },
  ];
  assert.deepEqual(ownershipsOf(directory), ['federal'], 'only ownership that is actually published is offered');
  assert.deepEqual(
    searchInstitutions(directory, { ownership: 'federal' }).map((item) => item.id),
    ['b'],
  );
  assert.equal(
    searchInstitutions(directory, { ownership: 'private' }).length,
    0,
    'a filter for ownership nobody has published returns nothing rather than guessing',
  );
});

/* -------------------------------------------------------------------------- */
/* Mappers and the deployment gate                                             */
/* -------------------------------------------------------------------------- */

test('a directory row maps to a summary with unknown ownership', async () => {
  const { mapDirectoryRow, mapProfileFromDirectory } = await import('../src/lib/institutions/mappers');
  const mapped = mapDirectoryRow(row({ website_url: 'https://example.edu.ng' }));
  assert.ok(mapped);
  assert.equal(mapped.ownership, null, 'no ownership column exists, so ownership is unknown');
  assert.equal(mapped.category, 'university');
  assert.equal(mapped.websiteUrl, 'https://example.edu.ng');
  assert.equal(mapped.verifiedWebsite, true, 'a usable URL is the fact, not the legacy is_verified flag');
  assert.equal(mapped.acronym, 'TU');
  assert.equal(mapped.intelligencePublished, false);

  const profile = mapProfileFromDirectory(mapped);
  for (const section of [
    profile.campuses,
    profile.academicUnits,
    profile.departments,
    profile.programmeOfferings,
    profile.admissionRoutes,
    profile.programmeRequirements,
    profile.benchmarks,
    profile.portalGuides,
  ]) {
    assert.equal(section.state, 'not_imported', 'richer sections are not imported yet');
    assert.deepEqual(section.items, []);
  }
});

test('a row without a name or id is dropped rather than half-rendered', async () => {
  const { mapDirectoryRow } = await import('../src/lib/institutions/mappers');
  assert.equal(mapDirectoryRow(row({ id: null })), null);
  assert.equal(mapDirectoryRow(row({ school_name: '   ' })), null);
});

test('the directory query names only deployed columns', async () => {
  const { INSTITUTION_DIRECTORY_COLUMNS } = await import('../src/lib/institutions/mappers');
  const { fetchInstitutionDirectory } = await import('../src/lib/institutions/repository');
  const deployed = [
    'id', 'school_name', 'acronym', 'state', 'institution_type', 'website_url', 'created_at',
    'slug', 'admission_portal_url', 'student_portal_url', 'is_verified', 'updated_at',
    'post_utme_available', 'post_utme_method', 'post_utme_source_url', 'post_utme_verified',
  ];
  for (const column of INSTITUTION_DIRECTORY_COLUMNS.split(',')) {
    assert.ok(deployed.includes(column.trim()), `${column} is not a deployed institutions column`);
  }
  // Tables from the unapplied intelligence migration must not be named here.
  for (const table of [
    'institution_profiles',
    'institution_campuses',
    'institution_academic_units',
    'institution_programme_offerings',
    'institution_admission_routes',
    'institution_programme_requirements',
    'institution_admission_benchmarks',
    'institution_portal_guides',
  ]) {
    assert.ok(!INSTITUTION_DIRECTORY_COLUMNS.includes(table), `${table} is not deployed`);
  }
  assert.equal(typeof fetchInstitutionDirectory, 'function');
});

test('unpublished intelligence sections are never queried while the gate is closed', async () => {
  const repository = await import('../src/lib/institutions/repository');
  const client = {
    from(table: string) {
      // Any query for a table other than the live directory is a failure.
      if (table !== 'institutions') throw new Error(`unexpected table: ${table}`);
      return {
        select(columns: string) {
          assert.ok(columns.includes('school_name'));
          return {
            order() {
              const result = Promise.resolve({ data: [row({ id: CANONICAL_CALABAR })], error: null });
              return Object.assign(result, { limit: () => result });
            },
          };
        },
      };
    },
  } as never;

  assert.equal(repository.institutionIntelligenceDeployed(), false, 'the gate ships closed');
  const profile = await repository.fetchInstitutionProfile(CANONICAL_CALABAR, { client });
  assert.ok(profile, 'the directory identity still resolves');
  assert.equal(profile.campuses.state, 'not_imported');
  assert.equal(profile.benchmarks.items.length, 0);
  assert.deepEqual(profile.sessions, []);
});

test('a non-UUID institution id is refused before any query runs', async () => {
  const { fetchInstitutionProfile } = await import('../src/lib/institutions/repository');
  assert.equal(await fetchInstitutionProfile('../etc/passwd'), null);
  assert.equal(await fetchInstitutionProfile(''), null);
});

test('published intelligence merges without inventing anything else', async () => {
  const { mergeIntelligence, mapDirectoryRow } = await import('../src/lib/institutions/mappers');
  const base = mapDirectoryRow(row({ id: CANONICAL_CALABAR }))!;
  const merged = mergeIntelligence(base, {
    profile: {
      official_name: 'University of Calabar',
      ownership: 'federal',
      year_established: 1975,
      profile_status: 'published',
      verification_status: 'verified',
      overview: 'A federal university in Calabar.',
      official_website_url: 'https://unical.edu.ng',
    },
    aliases: [{ alias_name: 'UNICAL', alias_type: 'acronym', verification_status: 'verified' }],
    campuses: [
      { id: 'c1', campus_name: 'Main Campus', campus_type: 'main', verification_status: 'verified' },
      { id: 'c2', campus_name: 'Teaching Hospital', campus_type: 'teaching_hospital', verification_status: 'in_review' },
    ],
    academicUnits: [
      { id: 'u1', unit_type: 'faculty', unit_name: 'Faculty of Arts', slug: 'faculty-of-arts', verification_status: 'verified' },
      { id: 'u2', unit_type: 'department', unit_name: 'Department of History', slug: 'department-of-history', parent_unit_id: 'u1', verification_status: 'verified' },
    ],
    benchmarks: [
      { id: 'b1', institution_id: CANONICAL_CALABAR, admission_session: '2026/2027', benchmark_type: 'institution_utme_eligibility', benchmark_label: 'Screening threshold', benchmark_value: 150, score_scale_max: 400, is_eligibility_floor: true, verification_status: 'verified' },
      // A value outside its own scale is a data error and must not render.
      { id: 'b2', institution_id: CANONICAL_CALABAR, admission_session: '2026/2027', benchmark_type: 'screening_aggregate', benchmark_label: 'Aggregate', benchmark_value: 250, score_scale_max: 100, verification_status: 'verified' },
      { id: 'b3', institution_id: CANONICAL_CALABAR, admission_session: '2026/2027', benchmark_type: 'departmental_merit', benchmark_label: 'Merit', benchmark_value: 70, score_scale_max: 100, verification_status: 'in_review' },
    ],
  });

  assert.equal(merged.ownership, 'federal', 'ownership arrives from a published profile, not from the name');
  assert.equal(merged.intelligencePublished, true);
  assert.equal(merged.campuses.items.length, 1, 'the in-review campus is not shown as fact');
  assert.equal(merged.campuses.state, 'available');
  assert.equal(merged.academicUnits.items.length, 1);
  assert.equal(merged.departments.items.length, 1, 'departments are separated from faculties');
  assert.equal(merged.benchmarks.items.length, 1, 'an out-of-scale value and an unreviewed one are both dropped');
  assert.equal(merged.benchmarks.items[0].scoreScaleMax, 400);
  assert.deepEqual(merged.sessions, ['2026/2027']);
  assert.equal(merged.aliases.length, 1);
});

/* -------------------------------------------------------------------------- */
/* Admission selection                                                         */
/* -------------------------------------------------------------------------- */

function benchmark(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    institutionId: CANONICAL_CALABAR,
    programmeOfferingId: null,
    session: '2026/2027',
    type: 'national_minimum' as const,
    label: 'JAMB national minimum',
    value: 140,
    scoreScaleMin: 0,
    scoreScaleMax: 400,
    categoryKey: 'general',
    stateCategory: null,
    isEligibilityFloor: true,
    calculationMethod: null,
    notes: null,
    status: 'verified' as const,
    sourceUrl: 'https://jamb.gov.ng',
    sourcePublishedAt: null,
    lastVerifiedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

test('a national minimum is not a departmental cut-off', async () => {
  const { isDepartmentalCutoff } = await import('../src/lib/institutions/admissionSelection');
  assert.equal(isDepartmentalCutoff(benchmark()), false);
  assert.equal(
    isDepartmentalCutoff(benchmark({ type: 'departmental_merit', isEligibilityFloor: false })),
    true,
  );
  assert.equal(
    isDepartmentalCutoff(benchmark({ type: 'screening_aggregate', isEligibilityFloor: false })),
    true,
  );
});

test('a UTME score and a screening aggregate are never compared', async () => {
  const { areSameScale, formatBenchmark } = await import('../src/lib/institutions/admissionSelection');
  const utme = benchmark({ value: 150, scoreScaleMax: 400 });
  const aggregate = benchmark({ value: 50, scoreScaleMax: 100 });
  assert.equal(areSameScale(utme, aggregate), false);
  assert.equal(areSameScale(utme, utme), true);
  assert.equal(formatBenchmark(utme), '150 / 400');
  assert.equal(formatBenchmark(aggregate), '50 / 100');
});

test('English is compulsory only where the official rule requires it', async () => {
  const { englishCompulsoryFor, orderedSubjects } = await import('../src/lib/institutions/admissionSelection');
  const utme = {
    entryMode: 'UTME' as const,
    utmeSubjects: ['Biology', 'Chemistry', 'Physics'],
  };
  const directEntry = {
    entryMode: 'DIRECT_ENTRY' as const,
    utmeSubjects: ['Biology', 'Chemistry', 'Physics'],
  };
  assert.equal(englishCompulsoryFor(utme), true, 'JAMB IBASS selects English for UTME');
  assert.equal(englishCompulsoryFor(directEntry), false, 'it is not added to a Direct Entry combination');
  assert.equal(
    englishCompulsoryFor({ entryMode: 'DIRECT_ENTRY', utmeSubjects: ['Use of English', 'Biology'] }),
    true,
    'it is shown when the published list names it',
  );
  assert.deepEqual(
    orderedSubjects({ entryMode: 'UTME', utmeSubjects: ['Biology', 'Use of English'] } as never),
    ['Use of English', 'Biology'],
  );
});

test('the newest published session is the current one, and older ones say so', async () => {
  const { currentSession, isCurrentSession, availableSessions } = await import(
    '../src/lib/institutions/admissionSelection'
  );
  assert.equal(currentSession(['2024/2025', '2026/2027', '2025/2026']), '2026/2027');
  assert.equal(isCurrentSession('2025/2026', ['2024/2025', '2026/2027', '2025/2026']), false);
  assert.equal(isCurrentSession('2026/2027', ['2026/2027']), true);
  assert.equal(currentSession([]), null);
  assert.deepEqual(
    availableSessions(
      [{ session: '2025/2026' } as never],
      [{ session: '2026/2027' } as never],
      [{ session: '2026/2027' } as never],
    ),
    ['2026/2027', '2025/2026'],
  );
});

test('a screening formula is only shown when the institution published one', async () => {
  const { screeningMethodFor } = await import('../src/lib/institutions/admissionSelection');
  assert.equal(screeningMethodFor(benchmark()), null, 'no published method means no formula, and no estimate');
  assert.equal(
    screeningMethodFor(benchmark({ calculationMethod: 'UTME / 8 + Post-UTME / 2' })),
    'UTME / 8 + Post-UTME / 2',
  );
});

test('a CBT Post-UTME choice requires a published CBT assessment', async () => {
  const { usesCbtScreening } = await import('../src/lib/institutions/admissionSelection');
  assert.equal(
    usesCbtScreening([{ session: '2026/2027', assessmentMethods: ['cbt'] } as never], '2026/2027'),
    true,
  );
  assert.equal(
    usesCbtScreening([{ session: '2026/2027', assessmentMethods: ['handwritten'] } as never], '2026/2027'),
    false,
  );
  assert.equal(
    usesCbtScreening([{ session: '2025/2026', assessmentMethods: ['cbt'] } as never], '2026/2027'),
    false,
    'a method from an earlier session does not apply to this one',
  );
});

test('the requirement for another session is not the requirement for this one', async () => {
  const { requirementFor } = await import('../src/lib/institutions/admissionSelection');
  const data = {
    offerings: [],
    routes: [],
    requirements: [
      { id: 'r1', programmeOfferingId: 'p1', session: '2025/2026', entryMode: 'UTME' } as never,
      { id: 'r2', programmeOfferingId: 'p1', session: '2026/2027', entryMode: 'UTME' } as never,
    ],
    benchmarks: [],
  };
  assert.equal(requirementFor(data, { programmeOfferingId: 'p1', session: '2026/2027', entryMode: 'UTME' })?.id, 'r2');
  assert.equal(requirementFor(data, { programmeOfferingId: 'p1', session: '2024/2025', entryMode: 'UTME' }), null);
});

/* -------------------------------------------------------------------------- */
/* Profile integration                                                         */
/* -------------------------------------------------------------------------- */

test('the canonical id is retained without rewriting the free-text school', async () => {
  const { matchProfileInstitution, institutionIdWrite, profileInstitutionColumnDeployed } = await import(
    '../src/lib/institutions/profileInstitution'
  );
  const directory = [
    { id: CANONICAL_CALABAR, name: 'University of Calabar', acronym: 'UNICAL', state: 'Cross River', institutionType: 'University', category: 'university' as const, ownership: null, websiteUrl: null, admissionPortalUrl: null, studentPortalUrl: null, slug: 'university-of-calabar', aliases: [], postUtme: null, verifiedWebsite: false, intelligencePublished: false },
  ];
  const matched = matchProfileInstitution(directory, 'University of Calabar');
  assert.ok(matched);
  assert.equal(matched.institutionId, CANONICAL_CALABAR);
  assert.equal(matched.institutionName, 'University of Calabar');
  assert.equal(matchProfileInstitution(directory, 'Some College Somewhere'), null, 'no closest guess');

  assert.equal(profileInstitutionColumnDeployed(), false, 'profiles.institution_id does not exist yet');
  assert.deepEqual(
    institutionIdWrite({ institutionId: CANONICAL_CALABAR, institutionName: 'x', source: 'directory', selectedAt: '' }),
    {},
    'no undeployed column is sent to PostgreSQL',
  );
});

test('the profile-completion page keeps the free-text school and offers the live directory', () => {
  const page = read('pages/ProfileCompletionPage.tsx');
  assert.match(page, /school: finalSchool/, 'the free-text school column is still what is saved');
  assert.match(page, /fetchInstitutionDirectory\(\)/, 'the live directory is the option source');
  assert.match(page, /institutionIdWrite\(/, 'the canonical id is wired to the save');
  assert.match(page, /Full institution directory/, 'directory institutions are selectable');
  // Nothing here overwrites a value the student already saved.
  assert.doesNotMatch(page, /setSchool\(matched\.institutionName\)/);
  assert.doesNotMatch(page, /\.update\(\{ school \}/);
  assert.doesNotMatch(page, /bulk|updateMany|\.update\(.*\)\.neq\(/, 'no bulk profile update');
});

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

test('the finder keeps its loading, empty and error states', () => {
  const page = read('pages/SchoolFinderPage.tsx');
  assert.match(page, /Loading the institution directory/, 'a loading state is named');
  assert.match(page, /No school found/, 'an empty state is named');
  assert.match(page, /could not be loaded right now/, 'an error state is named');
  assert.match(page, /Try again/, 'and it offers a retry');
  assert.match(page, /fetchInstitutionDirectory/, 'the read goes through the data-access boundary');
  // Ownership is rendered only when it is known.
  assert.match(page, /institution\.ownership && \(/, 'no ownership badge without published ownership');
});

test('the details page renders sections only when there is information', () => {
  const view = read('src/components/institutions/InstitutionProfileView.tsx');
  assert.match(view, /items\.length > 0/, 'every section is guarded by its own rows');
  assert.match(view, /Not published for this institution yet/, 'unpublished sections are named once');
  assert.match(view, /NUC/, 'the accreditation caveat is stated');
  const page = read('pages/SchoolDetailsPage.tsx');
  assert.match(page, /No official website recorded for this institution/);
  assert.match(page, /will not guess a URL/);
  assert.match(page, /Request the verified link/);
  assert.match(page, /fetchInstitutionProfile/, 'the profile comes from the boundary');
});

test('the Post-UTME flow only offers schools it can actually serve', () => {
  const page = read('pages/ExamSetupPage.tsx');
  assert.match(page, /fetchPostUtmeDirectory\(\)/, 'the canonical directory is the source');
  assert.match(page, /school\.method === 'handwritten'\s*\n\s*\|\| exams\.some/, 'paper schools and CBT banks only');
  const repository = read('src/lib/institutions/repository.ts');
  const mappers = read('src/lib/institutions/mappers.ts');
  assert.match(repository, /postUtme\?\.available === true/, 'participation must be switched on');
  assert.match(mappers, /post_utme_verified/, 'and reviewed before a school is offered');
});

test('one slug rule is shared by the finder, the card and the details page', () => {
  const card = read('src/components/dashboard/SchoolFinderCard.tsx');
  const details = read('pages/SchoolDetailsPage.tsx');
  assert.match(card, /export const itemKey = institutionSlug;/, 'the card delegates to the shared normalizer');
  assert.match(details, /itemKey/, 'the details page uses the same rule');
  assert.ok(
    !card.includes("replace(/[^a-z0-9]+/g, '-')"),
    'the duplicate slug regex is gone — the card uses institutionSlug',
  );
});
