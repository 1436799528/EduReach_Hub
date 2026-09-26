import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getServerSupabaseKey } from '../lib/supabase-config';
import { extractBearerToken } from '../lib/auth';
import { durationOptionsFor, resolveSetupExam, type CatalogExam } from '../src/lib/cbt-config';

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
test('server key configuration accepts both supported server key formats', () => {
  assert.equal(getServerSupabaseKey({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example' }), 'sb_secret_example');
  assert.equal(getServerSupabaseKey({ SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') }), jwt('service_role'));
  assert.equal(getServerSupabaseKey({ SUPABASE_SECRET_KEY: 'sb_secret_alias' }), 'sb_secret_alias');
  assert.equal(getServerSupabaseKey({ SUPABASE_SECRET_KEY: 'sb_secret_alias', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_preferred' }), 'sb_secret_preferred');
});
for (const key of ['', 'sb_publishable_example', jwt('anon'), jwt('authenticated'), 'eyJ.invalid.invalid', 'not-a-key']) {
  test(`server key rejects ${key || 'missing key'}`, () => assert.equal(getServerSupabaseKey({ SUPABASE_SERVICE_ROLE_KEY: key }), ''));
}
test('bearer extraction rejects missing, malformed and multiple headers', () => {
  for (const value of [undefined, '', 'Bearer ', 'Basic token', ['Bearer a', 'Bearer b']]) assert.equal(extractBearerToken(value), null);
  assert.equal(extractBearerToken('Bearer  token '), 'token');
});
const exams: CatalogExam[] = [
  { id: 'math', title: 'JAMB Maths', exam_body: 'JAMB', subject: 'Maths', description: null, duration_minutes: 60 },
  { id: 'english', title: 'JAMB English', exam_body: 'JAMB', subject: 'Use of English', description: null, duration_minutes: 120 },
  { id: 'post', title: 'Post-UTME', exam_body: 'POST-UTME', subject: 'General', description: null, duration_minutes: 45 },
];
test('CBT selection respects explicit bank ID and English default', () => {
  assert.equal(resolveSetupExam(exams, 'jamb', 'math')?.id, 'math');
  assert.equal(resolveSetupExam(exams, 'jamb', null)?.id, 'english');
  assert.equal(resolveSetupExam(exams, 'post-utme', null)?.id, 'post');
  assert.equal(resolveSetupExam(exams, 'neco', null), null);
  assert.equal(resolveSetupExam([], 'jamb', null), null);
});
test('CBT durations include the configured default once and never exceed it', () => {
  assert.deepEqual(durationOptionsFor(50), [15, 30, 45, 50]);
  assert.deepEqual(durationOptionsFor(30), [15, 30]);
});

test('dynamic CBT cards keep the selected bank and use supported setup routes', async () => {
  const { simulatorStartHref } = await import('../src/components/ExamSimulatorGrid');
  assert.equal(simulatorStartHref('JAMB', 'bank-123'), '/cbt/setup/jamb?exam=bank-123');
  assert.equal(simulatorStartHref('Post UTME', 'bank & 2'), '/cbt/setup/post-utme?exam=bank%20%26%202');
  assert.equal(simulatorStartHref('postutme'), '/cbt/setup/post-utme');
  assert.equal(simulatorStartHref('NABTEB'), '/cbt');
});
