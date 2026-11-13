import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openCbtV2WritingSession } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

// Synthetic transport only: real Auth/PostgREST remain a separate release gate.
test('session creation uses the supplied stable request key and makes takeover explicit', async () => {
  const originalFetch = globalThis.fetch, originalGetSession = supabase.auth.getSession;
  const sessionId = 'd1111111-1111-4111-8111-111111111111';
  const key = 'c1111111-1111-4111-8111-111111111111';
  const requests: unknown[] = [];
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /\/session$/);
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ protocol: 2, outcome: 'takeover_required', revision: 1, answers: {}, status: 'in_progress' }), { status: 409 });
    };
    assert.equal((await openCbtV2WritingSession('attempt', key, false)).outcome, 'takeover_required');
    assert.deepEqual(requests, [{ protocol: 2, requestKey: key, takeover: false }]);
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ protocol: 2, outcome: 'taken_over', sessionId, generation: 2, revision: 1, answers: {}, status: 'in_progress' }));
    };
    assert.equal((await openCbtV2WritingSession('attempt', key, true)).generation, 2);
    assert.deepEqual(requests[1], { protocol: 2, requestKey: key, takeover: true });
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, outcome: 'created', generation: 0, revision: 0, answers: {}, status: 'in_progress' }));
    await assert.rejects(openCbtV2WritingSession('attempt', key, false), /invalid CBT writing session/i);
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; }
});

test('revoked session is a distinct response and preserves pending journal intent', async () => {
  const { CbtAnswerQueue, IndexedDbAnswerJournal, CbtWritingSessionRevokedError } = await import('../src/lib/cbtAnswerQueue');
  const { sendCbtV2Operation } = await import('../src/lib/api');
  const { indexedDB } = await import('fake-indexeddb');
  const scope = { accountId: 'a1111111-1111-4111-8111-111111111111', attemptId: 'b1111111-1111-4111-8111-111111111111' };
  const question = 'c1111111-1111-4111-8111-111111111111';
  const sessionId = 'd1111111-1111-4111-8111-111111111111';
  const originalFetch = globalThis.fetch, originalGetSession = supabase.auth.getSession;
  const journal = new IndexedDbAnswerJournal(indexedDB, `revoked-${crypto.randomUUID()}`);
  try {
    supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }) as never;
    globalThis.fetch = async () => new Response(JSON.stringify({ protocol: 2, outcome: 'session_revoked', code: 'CBT_SESSION_REVOKED' }), { status: 409 });
    const queue = new CbtAnswerQueue(scope, journal, {
      state: async () => ({ protocol: 2, revision: 0, answers: {}, status: 'in_progress', questionIds: [question] }),
      answer: (id, op) => sendCbtV2Operation(id, 'answer', { ...op, sessionId, sessionGeneration: 1 }),
    }, async (_name, action) => action());
    const op = await queue.enqueue(question, 1, 1, null, 0);
    await assert.rejects(queue.retry(op.operationKey), CbtWritingSessionRevokedError);
    const rows = await queue.list();
    assert.equal(rows[0].operationKey, op.operationKey);
    assert.equal(rows[0].selected, 1);
    assert.equal(rows[0].status, 'pending');
    await assert.rejects(journal.sealSubmission(scope, crypto.randomUUID(), 0), /pending.*review/i);
  } finally { globalThis.fetch = originalFetch; supabase.auth.getSession = originalGetSession; await journal.close(); }
});
