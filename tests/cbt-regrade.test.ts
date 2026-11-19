import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  checkExpectedKey,
  isRegradeKey,
  parseRegradeOutcome,
  regradeAuditMetadata,
  regradeHeadline,
  type RegradeOutcome,
} from '../src/server/cbtRegrade';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20261120090000_cbt_regrade.sql');
const server = read('server.ts');

function change(attemptId: string, before: number | null, after: number | null, extra: Record<string, unknown> = {}) {
  return {
    attemptId,
    userId: `user-${attemptId}`,
    protocol: 'legacy',
    changed: true,
    before: { score: before, correctAnswers: 2, isCorrect: before === 100 },
    after: { score: after, correctAnswers: 3, isCorrect: after === 100 },
    ...extra,
  };
}

function outcome(overrides: Partial<RegradeOutcome> = {}): RegradeOutcome {
  return {
    applied: true,
    questionId: 'q-1',
    examId: 'exam-1',
    correctOption: 'B',
    grader: 'regrade-1',
    scanned: 5,
    changed: 2,
    unchanged: 3,
    truncated: false,
    attempts: [change('attempt-1', 60, 80), change('attempt-2', 40, 20)],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The operator's confirmation
// ---------------------------------------------------------------------------

test('a regrade needs the key the operator saw, not just any key', () => {
  assert.deepEqual(checkExpectedKey(undefined, 'B'), { ok: true }, 'a bare apply is allowed');
  assert.deepEqual(checkExpectedKey('B', 'B'), { ok: true });
  assert.deepEqual(checkExpectedKey('b', 'B'), { ok: true }, 'case is not a mismatch');
  assert.deepEqual(checkExpectedKey('A', 'A'), { ok: true });
});

test('a key that moved between review and regrade is refused with a reason an operator can act on', () => {
  const mismatch = checkExpectedKey('A', 'C');
  assert.equal(mismatch.ok, false);
  assert.match((mismatch as { error: string }).error, /changed since you reviewed it/i);
  assert.match((mismatch as { error: string }).error, /reload/i);
});

test('an invalid or missing confirmation is refused instead of guessed', () => {
  assert.equal(checkExpectedKey('E', 'B').ok, false);
  assert.equal(checkExpectedKey(1, 'B').ok, false);
  assert.equal(checkExpectedKey({ key: 'A' }, 'B').ok, false);
  const noKey = checkExpectedKey('A', null);
  assert.equal(noKey.ok, false);
  assert.match((noKey as { error: string }).error, /no stored answer key/i);
});

// ---------------------------------------------------------------------------
// Validating what the database returned
// ---------------------------------------------------------------------------

test('a well-formed regrade payload is accepted', () => {
  const parsed = parseRegradeOutcome(outcome());
  assert.ok(parsed);
  assert.equal(parsed.changed, 2);
  assert.equal(parsed.unchanged, 3);
  assert.equal(parsed.correctOption, 'B');
  assert.deepEqual(parsed.attempts.map((entry) => entry.attemptId), ['attempt-1', 'attempt-2']);
  assert.equal(parsed.attempts[0].before.score, 60);
  assert.equal(parsed.attempts[0].after.score, 80);
});

test('a malformed payload is a failure, never an empty success', () => {
  // Reporting "0 attempts changed" because the shape was unexpected would tell
  // an operator that nothing happened while scores may have moved.
  assert.equal(parseRegradeOutcome(null), null);
  assert.equal(parseRegradeOutcome([]), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), questionId: undefined }), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), examId: undefined }), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), correctOption: 'E' }), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), attempts: 'none' }), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), attempts: [{ attemptId: 'a' }] }), null);
  assert.equal(parseRegradeOutcome({ ...outcome(), scanned: 1, changed: 2 }), null, 'more changes than attempts scanned is impossible');
});

test('the payload is normalised, not trusted field by field', () => {
  const parsed = parseRegradeOutcome({
    ...outcome(),
    correctOption: 'd',
    scanned: '5',
    changed: '1',
    attempts: [{ attemptId: 'attempt-9', userId: 7, protocol: 'v2', changed: 'yes', before: { score: '10.5' }, after: { score: 20, correctAnswers: 1 } }],
  });
  assert.ok(parsed);
  assert.equal(parsed.correctOption, 'D');
  assert.equal(parsed.scanned, 5);
  assert.equal(parsed.changed, 1);
  assert.equal(parsed.attempts[0].userId, '');
  assert.equal(parsed.attempts[0].changed, false, 'only a real boolean counts as changed');
  assert.equal(parsed.attempts[0].before.score, 10.5);
  assert.equal(parsed.attempts[0].before.correctAnswers, 0);
});

// ---------------------------------------------------------------------------
// Normal, repeated, and partial regrades
// ---------------------------------------------------------------------------

test('a normal regrade reports how many of the affected attempts moved', () => {
  const headline = regradeHeadline(outcome());
  assert.match(headline, /Regraded 2 of 5 submitted attempts\./);
});

test('a repeated regrade is a no-op and says so', () => {
  const second = outcome({ changed: 0, unchanged: 5, attempts: [] });
  const headline = regradeHeadline(second);
  assert.match(headline, /Nothing to change: 5 submitted attempts already match this key\./);
  const metadata = regradeAuditMetadata(second);
  assert.equal(metadata.changed, 0);
  assert.deepEqual(metadata.attempts, []);
});

test('attempts that do not contain the question are counted as untouched, not as failures', () => {
  const preview = outcome({ applied: false });
  assert.match(regradeHeadline(preview), /2 of 5 submitted attempts would change\./);
  assert.equal(regradeAuditMetadata(preview).unchanged, 3);
});

test('a preview with nothing to change still tells the operator what was scanned', () => {
  const clean = outcome({ applied: false, changed: 0, unchanged: 0, scanned: 0, attempts: [] });
  assert.match(regradeHeadline(clean), /No submitted attempt is affected by this key/);
  assert.equal(regradeHeadline(outcome({ applied: false, changed: 1, scanned: 1, attempts: [change('a', 100, 0)] })), '1 of 1 submitted attempt would change.');
});

// ---------------------------------------------------------------------------
// The audit record
// ---------------------------------------------------------------------------

test('the audit entry carries the actor-visible facts and no secrets', () => {
  const metadata = regradeAuditMetadata(outcome({ truncated: true }));
  assert.equal(metadata.correct_option, 'B');
  assert.equal(metadata.exam_id, 'exam-1');
  assert.equal(metadata.grader, 'regrade-1');
  assert.equal(metadata.scanned, 5);
  assert.equal(metadata.changed, 2);
  assert.equal(metadata.truncated, true);
  const attempts = metadata.attempts as Array<Record<string, unknown>>;
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0].before, { score: 60, correctAnswers: 2, isCorrect: false });
  assert.deepEqual(attempts[0].after, { score: 80, correctAnswers: 3, isCorrect: false });
  // No answer text, no email, no token: the audit log records ids and verdicts.
  const serialised = JSON.stringify(metadata);
  assert.equal(/@|selected_option|correct_answer_/i.test(serialised), false);
});

// ---------------------------------------------------------------------------
// Schema contract: recompute from the stored key, never from the request
// ---------------------------------------------------------------------------

test('the regrade function exists and is callable only by the server', () => {
  assert.match(migration, /create or replace function public\.cbt_regrade_question\(p_question uuid, p_apply boolean default true\)/);
  assert.match(migration, /revoke all on function public\.cbt_regrade_question\(uuid, boolean\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.cbt_regrade_question\(uuid, boolean\) to service_role;/);
  assert.match(migration, /owner to cbt_v2_executor/);
});

test('the regrade adds no table and no column', () => {
  assert.equal(/create\s+table/i.test(migration), false);
  assert.equal(/alter\s+table/i.test(migration), false);
});

test('results are recomputed from the stored answer and the corrected key', () => {
  assert.match(migration, /v_answer\.selected_option = v_question\.correct_option/);
  assert.match(migration, /select \* into v_question from public\.exam_questions/);
  // The student's own answer is never rewritten; only the derived verdict is.
  assert.equal(/update public\.cbt_answers set selected_option/i.test(migration), false);
  assert.match(migration, /update public\.cbt_answers set is_correct = v_after_correct/);
  // The denominator the paper was graded out of is preserved.
  assert.equal(/set[^;]*total_questions\s*=/i.test(migration), false);
});

test('the regrade is idempotent by construction, not by bookkeeping', () => {
  // No increment, no counter arithmetic against the stored score: the score is
  // derived from the answer rows every time, so a second run computes the same
  // number and reports zero changes.
  assert.equal(/set\s+score\s*=\s*score\s*[+-]/i.test(migration), false);
  assert.equal(/correct_answers\s*=\s*correct_answers\s*[+-]/i.test(migration), false);
  assert.match(migration, /v_moved := v_flipped/);
  assert.match(migration, /if not v_moved then/);
});

test('only submitted attempts that actually contain the question are scanned', () => {
  assert.match(migration, /where a\.status = 'submitted'/);
  assert.match(migration, /exists \(select 1 from public\.cbt_answers ans\s+where ans\.attempt_id = a\.id and ans\.question_id = p_question\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /if not found then raise exception 'CBT question not found\.'; end if;/);
});

// ---------------------------------------------------------------------------
// Route contract
// ---------------------------------------------------------------------------

test('the preview and the apply are separate verbs with separate capabilities', () => {
  const preview = server.slice(server.indexOf("app.get('/api/admin/cbt/questions/:questionId/regrade'"));
  assert.match(preview.slice(0, 120), /requireCapability\('cbt\.read'\)/);
  const apply = server.slice(server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'"));
  assert.match(apply.slice(0, 120), /requireCapability\('cbt\.manage'\)/);
});

test('the route never sends a score or an answer to the database', () => {
  const apply = server.slice(server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'"), server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'") + 5000);
  const call = /cbt_regrade_question', \{([\s\S]*?)\}\)/.exec(apply);
  assert.ok(call, 'the apply route must call the regrade function');
  assert.match(call![1], /p_question: req\.params\.questionId/);
  assert.match(call![1], /p_apply: true/);
  assert.equal(/req\.body/.test(call![1]), false, 'no request body field may reach the grading call');
});

test('an applied regrade is audited with who, what and which attempts', () => {
  const apply = server.slice(server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'"), server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'") + 5000);
  assert.match(apply, /action: 'cbt_question_regrade'/);
  assert.match(apply, /resourceType: 'exam_question'/);
  assert.match(apply, /resourceId: subject\.question\.id/);
  assert.match(apply, /metadata: regradeAuditMetadata\(result\)/);
  assert.match(apply, /actorId: adminUser\.id/);
});

test('an unknown question is refused before any regrade runs', () => {
  const apply = server.slice(server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'"), server.indexOf("app.post('/api/admin/cbt/questions/:questionId/regrade'") + 3000);
  assert.match(apply, /res\.status\(404\)\.json\(\{ error: 'Question not found\.' \}\)/);
  assert.ok(apply.indexOf('Question not found') < apply.indexOf('cbt_regrade_question'), 'the existence check must come first');
});

test('the regrade key vocabulary matches the question bank', () => {
  assert.equal(isRegradeKey('A'), true);
  assert.equal(isRegradeKey('d'), true);
  assert.equal(isRegradeKey('E'), false);
  assert.equal(isRegradeKey(''), false);
  assert.equal(isRegradeKey(null), false);
});
