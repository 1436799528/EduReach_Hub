import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchCbtAttemptPaper, fetchCbtV2State, sendCbtV2Operation } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

// Synthetic transport tests; none contact a hosted account or database.
test('paper negotiation requires explicit supported protocol metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetSession = supabase.auth.getSession;
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    for (const protocol of [undefined, null, { version: 2 }, { version: 3 }, { version: 1, scope: 'local-rehearsal' }]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ attempt: {}, questions: [], protocol }), { status: 200 });
      await assert.rejects(fetchCbtAttemptPaper('test'), /protocol/i);
    }
    for (const protocol of [{ version: 1 }, { version: 2, scope: 'local-rehearsal' }]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ attempt: {}, questions: [], protocol }), { status: 200 });
      assert.deepEqual((await fetchCbtAttemptPaper('test')).protocol, protocol);
    }
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; }
});
test('v2 client preserves explicit conflicts and sends caller-supplied operation identity', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetSession = supabase.auth.getSession;
  let request: Record<string, unknown> = {};
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /\/api\/cbt\/v2\/attempts\/test\/answer$/);
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-token');
      request = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ protocol: 2, outcome: 'conflict', revision: 2, answers: { '1': 1 }, status: 'in_progress' }), { status: 409 });
    };
    const result = await sendCbtV2Operation('test', 'answer', { expectedRevision: 1, operationKey: 'synthetic-key', questionId: 'synthetic-question', selected: 0 });
    assert.deepEqual(request, { protocol: 2, expectedRevision: 1, operationKey: 'synthetic-key', questionId: 'synthetic-question', selected: 0 });
    assert.equal(result.outcome, 'conflict'); assert.deepEqual(result.answers, { '1': 1 });
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; }
});

test('v2 client rejects malformed or unexpected acknowledgements instead of marking them saved', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetSession = supabase.auth.getSession;
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, outcome: 'accepted', revision: 1, answers: { '1': 0 }, status: 'in_progress' }), { status: 200 });
    await assert.rejects(sendCbtV2Operation('test', 'answer', { expectedRevision: 0, operationKey: 'key', questionId: 'q', selected: 0 }), /invalid CBT response/i);
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, revision: 1, answers: { '1': 'bad' }, status: 'in_progress' }), { status: 200 });
    await assert.rejects(fetchCbtV2State('test'), /invalid CBT state/i);
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'The operation requires review.' }), { status: 409 });
    await assert.rejects(sendCbtV2Operation('test', 'answer', { expectedRevision: 0, operationKey: 'key', questionId: 'q', selected: 0 }));
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; }
});

test('v2 state rejects missing, invalid or ambiguous frozen-paper identity', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetSession = supabase.auth.getSession;
  const q1 = 'a3333333-3333-4333-8333-333333333333';
  const q2 = '44444444-4444-4444-8444-444444444444';
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    for (const questionIds of [undefined, [], ['invalid'], [q1, q1], [q1.toUpperCase(), q1]]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, revision: 1, answers: {}, status: 'in_progress', questionIds }), { status: 200 });
      await assert.rejects(fetchCbtV2State('test'), /invalid CBT state/i);
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, revision: 1, answers: { '3': 0 }, status: 'in_progress', questionIds: [q1, q2] }), { status: 200 });
    await assert.rejects(fetchCbtV2State('test'), /invalid CBT state/i);
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, revision: 1, answers: { '1': 0 }, status: 'in_progress', questionIds: [q1, q2] }), { status: 200 });
    assert.deepEqual((await fetchCbtV2State('test')).questionIds, [q1, q2]);
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; }
});
