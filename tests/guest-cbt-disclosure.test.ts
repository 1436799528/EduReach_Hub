import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Regression cover for audit P0-3 — answer-key disclosure on the unauthenticated
// guest CBT endpoint.
//
// `POST /api/cbt/guest-submit` with an empty answer sheet used to return
// `correct_option` and `explanation` for every question in the paper, so anyone
// who could name an exam id could read the whole key without answering anything.
// The control endpoint (`GET .../guest-questions`) withheld the key correctly, so
// only the submit path was wrong.
//
// These tests drive the real Express app against a stub PostgREST so the
// behaviour is asserted end to end — the same way the disclosure was found —
// rather than by inspecting the handler's source.

const EXAM = {
  id: 'exam-1',
  title: 'Stub JAMB paper',
  exam_body: 'JAMB',
  duration_minutes: 30,
  subject: 'English',
  is_active: true,
};
// Returned in position order, which is what the handler's
// `.order('position', { ascending: true })` makes PostgREST return and what the
// paper assembly assumes. Each correct option is distinct so a leak or a
// mis-keyed answer cannot pass by coincidence.
const QUESTIONS = [
  { id: 'q1', position: 1, subject: 'English', question_text: 'Q1', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'B', explanation: 'because B' },
  { id: 'q2', position: 2, subject: 'English', question_text: 'Q2', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'D', explanation: 'because D' },
  { id: 'q3', position: 3, subject: 'English', question_text: 'Q3', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', correct_option: 'C', explanation: 'because C' },
];

const stub = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/rest/v1/cbt_exams')) return res.end(JSON.stringify(EXAM));
  if (url.pathname.startsWith('/rest/v1/exam_questions')) return res.end(JSON.stringify(QUESTIONS));
  // The durable rate limiter treats anything but `false` as "allowed".
  if (url.pathname.startsWith('/rest/v1/rpc/')) return res.end('true');
  return res.end('[]');
});
stub.listen(0, '127.0.0.1');
await once(stub, 'listening');
const stubAddress = stub.address();
if (!stubAddress || typeof stubAddress === 'string') throw new Error('No stub port');

Object.assign(process.env, {
  NETLIFY: 'true',
  NODE_ENV: 'production',
  VITE_SUPABASE_URL: `http://127.0.0.1:${stubAddress.port}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_guest_disclosure_test',
  SUPABASE_SECRET_KEY: '',
});

const { app } = await import('../server');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;

after(() => Promise.all([
  new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  new Promise<void>((resolve, reject) => stub.close((error) => (error ? reject(error) : resolve()))),
]));

async function submit(answers: Record<string, unknown>) {
  const response = await fetch(`${base}/api/cbt/guest-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId: EXAM.id, answers }),
  });
  return { status: response.status, body: await response.json() as any };
}

test('the answer key is never released for questions the caller did not attempt', async () => {
  const { status, body } = await submit({});
  assert.equal(status, 200, 'an empty sheet is still scored rather than rejected');
  assert.equal(body.score, 0);
  assert.equal(body.attempt.total_questions, 3);

  for (const question of body.questions) {
    assert.equal(question.correct_option, null, `question ${question.position} leaked its correct option`);
    assert.equal(question.explanation, null, `question ${question.position} leaked its explanation`);
  }
  for (const item of body.breakdown) {
    assert.equal(item.correct, null, `breakdown item ${item.question} leaked the correct index`);
    assert.equal(item.explanation, null, `breakdown item ${item.question} leaked its explanation`);
  }
});

test('only the attempted question receives its correction', async () => {
  // Position 1's answer is B (index 1).
  const { status, body } = await submit({ '1': 1 });
  assert.equal(status, 200);

  const byPosition = new Map<number, any>(body.questions.map((q: any) => [q.position, q]));
  assert.equal(byPosition.get(1)?.correct_option, 'B', 'the attempted question must still be corrected');
  assert.equal(byPosition.get(1)?.explanation, 'because B');
  assert.equal(byPosition.get(2)?.correct_option, null);
  assert.equal(byPosition.get(3)?.correct_option, null);

  const breakdown = new Map<number, any>(body.breakdown.map((item: any) => [item.question, item]));
  assert.equal(breakdown.get(1)?.correct, 1);
  assert.equal(breakdown.get(1)?.isCorrect, true);
  assert.equal(breakdown.get(2)?.correct, null);
  assert.equal(breakdown.get(3)?.correct, null);
});

test('a fully attempted paper still returns the complete key, as the review screen needs', async () => {
  const { status, body } = await submit({ '1': 1, '2': 3, '3': 2 });
  assert.equal(status, 200);
  assert.equal(body.score, 100);
  assert.deepEqual(
    body.questions.map((q: any) => q.correct_option),
    ['B', 'D', 'C'],
    'all three corrections are released once every question is attempted',
  );
  for (const item of body.breakdown) {
    assert.notEqual(item.correct, null, `breakdown item ${item.question} must carry its index`);
  }
});

test('the read-only guest paper never carries a key at all', async () => {
  const response = await fetch(`${base}/api/cbt/exams/${EXAM.id}/guest-questions`);
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.questions.length, 3);
  for (const question of body.questions) {
    assert.ok(!('correct_option' in question), 'the question feed must not carry correct_option');
    assert.ok(!('explanation' in question), 'the question feed must not carry explanations');
  }
});
