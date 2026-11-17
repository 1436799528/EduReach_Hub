import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  computeGoalProgress,
  describeBenchmark,
  matchAttemptToRequirement,
  normalizeSubject,
} from '../src/lib/admissionGoal';
import { REPO_ROOT } from '../scripts/replay';

// INSTITUTION-3: the admission goal must be honest about what a practice score
// is. These assertions are the guard: a 0-100 practice percentage is never
// projected into a UTME score, never turned into a probability, and only counts
// when the paper practises a subject the institution actually requires.

const requirement = {
  utmeSubjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'],
  minimumUtmeScore: 180,
  minimumUtmeScale: 400,
};

test('subject names are normalised before comparison', () => {
  assert.equal(normalizeSubject('Use of English'), 'english language');
  assert.equal(normalizeSubject('English Language'), 'english language');
  assert.equal(normalizeSubject('  mathematics '), 'mathematics');
});

test('an attempt only counts when its subject is one the programme requires', () => {
  const matched = matchAttemptToRequirement(
    { attemptId: 'a', examSubject: 'Physics', scorePercent: 72 },
    requirement,
  );
  assert.equal(matched.status, 'matched');
  assert.deepEqual(matched.matchedSubjects, ['physics']);

  const mismatch = matchAttemptToRequirement(
    { attemptId: 'b', examSubject: 'Economics', scorePercent: 88 },
    requirement,
  );
  assert.equal(mismatch.status, 'subject_mismatch');
  assert.ok(mismatch.missingSubjects.includes('physics'), 'the requirements it does not cover are named');
});

test('without published requirements nothing is claimed', () => {
  const result = matchAttemptToRequirement({ attemptId: 'c', examSubject: 'Physics', scorePercent: 90 }, null);
  assert.equal(result.status, 'requirements_unavailable');
  const empty = matchAttemptToRequirement({ attemptId: 'd', examSubject: 'Physics' }, { utmeSubjects: [] });
  assert.equal(empty.status, 'requirements_unavailable');
});

test('only matched attempts move the goal average', () => {
  const progress = computeGoalProgress([
    { matchStatus: 'matched', scorePercent: 60 },
    { matchStatus: 'matched', scorePercent: 80 },
    { matchStatus: 'subject_mismatch', scorePercent: 100 },
    { matchStatus: 'requirements_unavailable', scorePercent: 30 },
  ], 75);

  assert.equal(progress.countedAttempts, 2);
  assert.equal(progress.averagePercent, 70);
  assert.equal(progress.bestPercent, 80);
  assert.equal(progress.gapToTargetPoints, 5);
  assert.deepEqual(progress.scoreScale, { min: 0, max: 100 }, 'practice scores stay on a 0-100 scale');
});

test('the goal reports no distance when there is nothing to measure', () => {
  const empty = computeGoalProgress([], 70);
  assert.equal(empty.averagePercent, null);
  assert.equal(empty.gapToTargetPoints, null);
  assert.ok(empty.disclaimers.some((line) => /not a JAMB score out of 400/.test(line)));
  assert.ok(empty.disclaimers.some((line) => /Nothing here predicts admission/i.test(line)));
});

test('a benchmark always prints with its own scale', () => {
  assert.match(
    describeBenchmark({ benchmarkType: 'programme_utme_minimum', benchmarkLabel: 'UTME minimum', benchmarkValue: 220, scoreScaleMax: 400, admissionSession: '2026/2027' }),
    /UTME minimum: 220 of 0-400 · 2026\/2027/,
  );
  assert.match(
    describeBenchmark({ benchmarkType: 'screening_aggregate', benchmarkLabel: 'Merit aggregate', benchmarkValue: 81.3, scoreScaleMax: 100, categoryKey: 'merit' }),
    /81\.3 of 0-100/,
  );
  assert.match(
    describeBenchmark({ benchmarkType: 'screening_aggregate', benchmarkLabel: 'Osun screening aggregate', benchmarkValue: 80.3, scoreScaleMax: 100, categoryKey: 'state_catchment', stateCategory: 'Osun' }),
    /state_catchment \(Osun\)/,
  );
});

test('the goal module contains no 0-400 projection', () => {
  const source = readFileSync(join(REPO_ROOT, 'src/lib/admissionGoal.ts'), 'utf8');
  assert.doesNotMatch(source, /\*\s*4\b/, 'no multiplication into a 400-point scale');
  // No return shape carries a probability: the words may appear in the comment
  // that forbids them, but never as a field a caller could render.
  assert.doesNotMatch(source, /\b(probability|likelihood|admissionChance)\s*:/, 'no probability field is returned');
});

test('the API wires the routes with the right gates', () => {
  const server = readFileSync(join(REPO_ROOT, 'server.ts'), 'utf8');
  assert.match(server, /registerInstitutionIntelligenceRoutes\(app, \{/);

  const routes = readFileSync(join(REPO_ROOT, 'src/server/institutionIntelligence.ts'), 'utf8');
  assert.match(routes, /app\.get\('\/api\/institutions\/:institutionId\/intelligence'/, 'public intelligence read exists');
  assert.match(routes, /requireCapability\('institution\.read'\)/, 'the review queue is staff-only');
  assert.match(routes, /requireCapability\('institution\.update'\)/, 'review decisions need the update capability');
  assert.match(routes, /requireUser\(req, 'dashboard\.access'\)/, 'student endpoints resolve the caller from the session');

  // Ownership: the student id comes from the session, never from the body.
  const put = routes.slice(routes.indexOf("app.put('/api/student/admission-goal'"));
  assert.match(put, /student_id: user\.id/);
  assert.doesNotMatch(put.slice(0, 4000), /student_id:\s*req\.body/, 'a client cannot name the student');

  // Public reads must name their filters: the server client bypasses RLS.
  const publicRead = routes.slice(
    routes.indexOf("app.get('/api/institutions/:institutionId/intelligence'"),
    routes.indexOf('app.get(\'/api/admin/institution-intelligence/review\''),
  );
  assert.match(publicRead, /verification_status', 'verified'/);
  assert.match(publicRead, /publication_status', 'published'/);
});
