import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterOptions,
  filterReviewRows,
  mergeLevelRequirements,
  publicationGate,
  reviewChecklist,
  reviewChecklistForRow,
  slugify,
  summarizeReview,
  validateEvidencePatch,
  validateProfileSection,
  validateProgrammePatch,
  validateRequirementPatch,
  validateRoutePatch,
  validateUnitPatch,
  VERIFICATION_STATUSES,
  PUBLICATION_STATUSES,
  type ReviewOverviewRow,
} from '../src/server/institutionAdmin';

// The editorial rules, tested without a database. These are the functions the
// route handlers call, so "publishing requires verification", "a claim without a
// source cannot be verified" and "a negative decision needs a reason" are proven
// once, here, rather than asserted in prose.

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function row(overrides: Partial<ReviewOverviewRow> = {}): ReviewOverviewRow {
  return {
    institution_id: UUID_A,
    school_name: 'Synthetic University',
    acronym: 'SU',
    state: 'Rivers',
    institution_type: 'university',
    official_name: 'Synthetic University',
    publication_status: 'draft',
    verification_status: 'discovered',
    last_checked_at: null,
    reviewed_by: null,
    logo_url: null,
    hero_image_url: null,
    overview: null,
    official_website_url: 'https://example.edu.ng/',
    directory_website_url: 'https://example.edu.ng/',
    admission_portal_url: null,
    student_portal_url: null,
    postgraduate_portal_url: null,
    academic_units: 2,
    academic_units_unverified: 1,
    programme_offerings: 3,
    programme_offerings_unverified: 2,
    published_offerings: 1,
    admission_routes: 1,
    admission_routes_with_dates: 0,
    programme_requirements: 2,
    programme_requirements_with_subjects: 1,
    source_records: 1,
    evidence_rows: 4,
    evidence_awaiting_review: 2,
    evidence_last_checked_at: null,
    admission_sessions: ['2026/2027'],
    latest_session: '2026/2027',
    has_official_website: true,
    has_logo: false,
    has_hero_image: false,
    has_portal: false,
    ...overrides,
  };
}

test('the status vocabularies are the whole vocabulary', () => {
  assert.deepEqual([...VERIFICATION_STATUSES], [
    'unresearched', 'discovered', 'in_review', 'verified', 'disputed', 'outdated', 'unpublished_by_institution',
  ]);
  assert.deepEqual([...PUBLICATION_STATUSES], ['draft', 'in_review', 'published', 'archived']);
});

test('publication is never a substitute for verification', () => {
  assert.equal(publicationGate('verified', 'published').ok, true);
  assert.equal(publicationGate('verified', 'draft').ok, true, 'a verified row may stay unpublished');
  assert.equal(publicationGate('discovered', 'draft').ok, true);

  for (const status of ['unresearched', 'discovered', 'in_review', 'disputed', 'outdated', 'unpublished_by_institution', null, undefined]) {
    const gate = publicationGate(status, 'published');
    assert.equal(gate.ok, false, `${String(status)} cannot be published`);
    assert.equal(gate.gate, true);
    assert.match(String(gate.error), /cannot publish/i);
    assert.match(String(gate.error), /verify the facts/i, 'the refusal says what to do next');
  }
});

test('a profile section only touches its own fields', () => {
  const result = validateProfileSection('history', { overview: 'A short overview.' }, {});
  assert.equal(result.ok, true);
  assert.deepEqual(result.value?.profile, { overview: 'A short overview.' });
  assert.deepEqual(result.value?.directory, {}, 'a history edit never rewrites the directory row');

  const smuggled = validateProfileSection('history', { school_name: 'Renamed University' }, {});
  assert.equal(smuggled.ok, false);
  assert.match(String(smuggled.error), /identity section/i, 'the name is corrected where the name lives');

  const unknown = validateProfileSection('history', { overview: 'x', mission_statement: 'y' }, {});
  assert.equal(unknown.ok, false);
  assert.match(String(unknown.error), /Unknown field/);

  const empty = validateProfileSection('history', {}, {});
  assert.equal(empty.ok, false);
  assert.match(String(empty.error), /No fields to save/);
});

test('the identity section corrects the directory row too', () => {
  const result = validateProfileSection('identity', {
    official_name: 'Synthetic University of Rivers',
    school_name: 'Synthetic University of Rivers',
    acronym: 'SUR',
    website_url: 'https://sur.example.edu.ng/',
  }, {});
  assert.equal(result.ok, true);
  assert.equal(result.value?.profile.official_name, 'Synthetic University of Rivers');
  assert.deepEqual(result.value?.directory, {
    school_name: 'Synthetic University of Rivers',
    acronym: 'SUR',
    website_url: 'https://sur.example.edu.ng/',
  });

  const blankName = validateProfileSection('identity', { official_name: '   ' }, {});
  assert.equal(blankName.ok, false);
  assert.match(String(blankName.error), /cannot be empty/i);

  const badUrl = validateProfileSection('portals', { admission_portal_url: 'javascript:alert(1)' }, {});
  assert.equal(badUrl.ok, false, 'a portal URL must be http(s) or a site path');
});

test('a profile section cannot publish an unverified profile', () => {
  const refused = validateProfileSection('verification', { publication_status: 'published' }, { verification_status: 'discovered' });
  assert.equal(refused.ok, false);
  assert.equal(refused.gate, true);

  const allowed = validateProfileSection('verification', { publication_status: 'published' }, { verification_status: 'verified' });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.value?.publication, 'published');

  const both = validateProfileSection('verification', { verification_status: 'verified', publication_status: 'published' }, {});
  assert.equal(both.ok, true, 'one save may verify and publish together');
});

test('a programme patch keeps verification and publication separate', () => {
  const draft = validateProgrammePatch({ programme_code: 'PHY' }, { id: UUID_A, verification_status: 'discovered', publication_status: 'draft' });
  assert.equal(draft.ok, true);
  assert.equal(draft.value?.verification, 'discovered', 'a code fix does not verify anything');
  assert.equal(draft.value?.publication, 'draft');

  const published = validateProgrammePatch({ publication_status: 'published' }, { id: UUID_A, verification_status: 'discovered' });
  assert.equal(published.ok, false);
  assert.equal(published.gate, true);

  const unknown = validateProgrammePatch({ cutoff: '200' }, { id: UUID_A });
  assert.equal(unknown.ok, false);
  assert.match(String(unknown.error), /Unknown programme field/);

  const session = validateProgrammePatch({ admission_session: '2026/2028' }, { id: UUID_A });
  assert.equal(session.ok, false, 'a session must be a consecutive pair of years');

  const duration = validateProgrammePatch({ duration_years: 40 }, { id: UUID_A });
  assert.equal(duration.ok, false);

  const name = validateProgrammePatch({ programme_name: '  ' }, { id: UUID_A });
  assert.equal(name.ok, false);
});

test('an academic unit cannot collide with its sibling or parent itself', () => {
  const siblings = [
    { id: UUID_A, unit_type: 'faculty', slug: 'science', parent_unit_id: null },
    { id: UUID_B, unit_type: 'department', slug: 'physics', parent_unit_id: UUID_A },
  ];

  // Same name, same parent, different row: a real clash.
  const clash = validateUnitPatch({ unit_type: 'faculty', unit_name: 'Science', parent_unit_id: null }, { id: UUID_B, unit_type: 'department' }, siblings);
  assert.equal(clash.ok, false);
  assert.match(String(clash.error), /same parent/i);

  const self = validateUnitPatch({ parent_unit_id: UUID_A }, { id: UUID_A }, siblings);
  assert.equal(self.ok, false);
  assert.match(String(self.error), /its own parent/i);

  const renamed = validateUnitPatch({ unit_name: 'Physics and Astronomy' }, { id: UUID_B, unit_type: 'department' }, siblings);
  assert.equal(renamed.ok, true);
  assert.equal(renamed.value?.slug, 'physics-and-astronomy', 'the slug follows the name');

  assert.equal(slugify('  Civil & Environmental Engineering '), 'civil-environmental-engineering');
});

test('an admission window cannot close before it opens', () => {
  const bad = validateRoutePatch({ opens_on: '2026-07-01', closes_on: '2026-06-01' }, { verification_status: 'verified' });
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /cannot be before/i);

  const good = validateRoutePatch({ opens_on: '2026-06-01', closes_on: '2026-07-01' }, { verification_status: 'verified' });
  assert.equal(good.ok, true);

  const publish = validateRoutePatch({ publication_status: 'published' }, { verification_status: 'in_review' });
  assert.equal(publish.ok, false);
  assert.equal(publish.gate, true);
});

test('a minimum score stays on its own scale', () => {
  const bad = validateRequirementPatch({ minimum_utme_score: 420, minimum_utme_scale: 400 }, {});
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /between 0 and 400|cannot be higher than the scale/i);

  const good = validateRequirementPatch({ minimum_utme_score: 200, minimum_utme_scale: 400 }, {});
  assert.equal(good.ok, true);
  assert.equal(good.value?.values.minimum_utme_score, 200);

  const requireScale = validateRequirementPatch({ minimum_utme_scale: null }, {});
  assert.equal(requireScale.ok, false, 'a scale cannot be cleared while a score exists');
});

test("O'Level edits merge instead of replacing what is recorded", () => {
  const merged = validateRequirementPatch(
    { o_level: { credits: 5 } },
    { o_level_requirements: { credits: 5, subjects: ['English Language', 'Mathematics'], summary: 'Five credits including English and Mathematics.' } },
  );
  assert.equal(merged.ok, true);
  assert.deepEqual(merged.value?.values.o_level_requirements, {
    credits: 5,
    subjects: ['English Language', 'Mathematics'],
    summary: 'Five credits including English and Mathematics.',
  }, 'an untouched key survives the save');

  const cleared = mergeLevelRequirements({ credits: 5, subjects: ['English'] }, { credits: null }, "O'Level");
  assert.deepEqual(cleared.value, { subjects: ['English'] }, 'an explicitly cleared key is removed, not replaced by a guess');
});

test('evidence rules refuse an unsupported verification and an unexplained rejection', () => {
  const noSource = validateEvidencePatch({ status: 'verified' }, { source_url: null });
  assert.equal(noSource.ok, false);
  assert.match(String(noSource.error), /no source URL/i);

  const replaced = validateEvidencePatch({ status: 'verified', source_url: 'https://example.edu.ng/prospectus' }, { source_url: null });
  assert.equal(replaced.ok, true, 'a source recorded with the decision is enough');

  const noNote = validateEvidencePatch({ status: 'disputed' }, { source_url: 'https://example.edu.ng/' });
  assert.equal(noNote.ok, false);
  assert.match(String(noNote.error), /written reason/i);

  const noteOnly = validateEvidencePatch({ note: 'The 2025 page is gone; the 2026 prospectus says 180.' }, { source_url: 'https://example.edu.ng/' });
  assert.equal(noteOnly.ok, true, 'a note may be added without deciding anything');

  const unresearched = validateEvidencePatch({ status: 'unresearched' }, { source_url: 'https://example.edu.ng/' });
  assert.equal(unresearched.ok, false, 'there is no unresearched decision');

  const empty = validateEvidencePatch({}, { source_url: 'https://example.edu.ng/' });
  assert.equal(empty.ok, false);
});

test('the checklist distinguishes never researched from needs review', () => {
  const untouched = reviewChecklist({
    profile: null,
    institution: {},
    counts: { units: 0, unitsUnverified: 0, offerings: 0, offeringsUnverified: 0, routes: 0, routesWithDates: 0, requirements: 0, requirementsWithSubjects: 0 },
    profileImages: {},
    portalUrls: {},
  });
  assert.equal(untouched.find((check) => check.key === 'profile')?.state, 'missing');
  assert.equal(untouched.find((check) => check.key === 'profile')?.detail, 'Not researched yet');

  const researched = reviewChecklistForRow(row());
  const byKey = new Map(researched.map((check) => [check.key, check]));
  assert.equal(byKey.get('profile')?.state, 'ok');
  assert.equal(byKey.get('programmes')?.state, 'review', 'some programmes are unverified');
  assert.match(String(byKey.get('programmes')?.detail), /awaiting verification/);
  assert.equal(byKey.get('admissionDates')?.state, 'review', 'a route without dates needs a look');
  assert.equal(byKey.get('logo')?.state, 'missing');
  assert.equal(byKey.get('campusImage')?.state, 'missing');
  assert.equal(byKey.get('portal')?.state, 'missing');

  const verified = reviewChecklistForRow(row({
    programme_offerings_unverified: 0,
    academic_units_unverified: 0,
    admission_routes_with_dates: 1,
    programme_requirements_with_subjects: 2,
    logo_url: 'https://example.edu.ng/logo.png',
    hero_image_url: 'https://example.edu.ng/campus.jpg',
    admission_portal_url: 'https://portal.example.edu.ng/',
    verification_status: 'verified',
  }));
  assert.deepEqual(verified.filter((check) => check.state !== 'ok'), [], 'nothing is flagged once every fact is recorded');
});

test('filters narrow the queue without inventing a result', () => {
  const rows = [
    row(),
    row({ institution_id: UUID_B, school_name: 'Synthetic Polytechnic', acronym: 'SP', state: 'Enugu', institution_type: 'polytechnic', verification_status: 'verified', publication_status: 'published', programme_offerings_unverified: 0, academic_units_unverified: 0, evidence_awaiting_review: 0 }),
  ];

  assert.equal(filterReviewRows(rows, { state: 'Rivers' }).length, 1);
  assert.equal(filterReviewRows(rows, { institutionType: 'polytechnic' }).length, 1);
  assert.equal(filterReviewRows(rows, { verification: 'verified' }).length, 1);
  assert.equal(filterReviewRows(rows, { publication: 'published' }).length, 1);
  assert.equal(filterReviewRows(rows, { session: '2026/2027' }).length, 2);
  assert.equal(filterReviewRows(rows, { session: '2025/2026' }).length, 0, 'a session nobody recorded matches nothing');
  assert.equal(filterReviewRows(rows, { search: 'poly' }).length, 1);
  assert.equal(filterReviewRows(rows, { search: 'SP' }).length, 1, 'an acronym is searchable');
  assert.equal(filterReviewRows(rows, { missing: 'any' }).length, 2, 'both rows still miss a logo or a campus image');
  assert.equal(filterReviewRows(rows, { missing: 'logo' }).length, 2, 'neither has a logo');
  assert.equal(filterReviewRows(rows, { missing: 'profile' }).length, 0, 'both have a profile, so neither is missing one');
  assert.equal(filterReviewRows(rows, { source: 'verified' }).length, 2);
  assert.equal(filterReviewRows(rows, { source: 'missing' }).length, 1, 'one institution still has facts awaiting review');

  assert.deepEqual(filterOptions(rows), {
    states: ['Enugu', 'Rivers'],
    institutionTypes: ['polytechnic', 'university'],
    sessions: ['2026/2027'],
  });
});

test('the summary counts records, and a zero is an honest zero', () => {
  const empty = summarizeReview([], 0);
  assert.deepEqual(empty, {
    institutionsAwaitingReview: 0,
    programmeRecordsAwaitingVerification: 0,
    academicUnits: 0,
    sourceRecords: 0,
    publishedInstitutions: 0,
    institutionsInCatalogue: 0,
  });

  const summary = summarizeReview([row(), row({ institution_id: UUID_B, publication_status: 'published', verification_status: 'verified', programme_offerings_unverified: 0, academic_units_unverified: 0, evidence_awaiting_review: 0 })], 16);
  assert.equal(summary.institutionsInCatalogue, 2);
  assert.equal(summary.publishedInstitutions, 1);
  assert.equal(summary.institutionsAwaitingReview, 1, 'the verified institution is not awaiting review');
  assert.equal(summary.programmeRecordsAwaitingVerification, 2);
  assert.equal(summary.academicUnits, 4);
  assert.equal(summary.sourceRecords, 16);
});
