import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchOpportunity, saveConfiguredCbtDraft } from '../src/lib/api';
import { classifyFailure, EduReachError } from '../src/lib/failures';

test('the API client preserves the distinction between a missing session and forbidden access', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, kind] of [[401, 'auth'], [403, 'forbidden']] as const) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: status === 401 ? 'Authentication required.' : 'Permission denied.' }), { status, headers: { 'Content-Type': 'application/json' } });
      await assert.rejects(fetchOpportunity('isolated-test'), (error: unknown) => {
        assert.ok(error instanceof EduReachError);
        assert.equal(error.status, status);
        assert.equal(classifyFailure(error).kind, kind);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a draft without an authenticated session rejects instead of reporting a successful save', async () => {
  const originalFetch = globalThis.fetch;
  let sent = false;
  try {
    globalThis.fetch = async () => { sent = true; throw new Error('unexpected network request'); };
    await assert.rejects(saveConfiguredCbtDraft('isolated-attempt', { 1: 0 }), (error: unknown) => {
      assert.ok(error instanceof EduReachError);
      assert.equal(error.kind, 'auth');
      assert.equal(error.status, 401);
      return true;
    });
    assert.equal(sent, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
