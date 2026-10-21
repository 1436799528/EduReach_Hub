import assert from 'node:assert/strict';
import { test } from 'node:test';

import { httpStatusForErrorMessage } from '../lib/errors';
import { getServerSupabaseClient, supabaseFetch } from '../lib/supabase-server';
import { failureKindOf } from '../src/lib/failures';

// Stage 1 of docs/audit/PRODUCTION-SCALE-AUDIT-2026-10.md (H-3, H-4, M-3):
// a transient database/auth failure must surface as a retryable 503, the
// service-role client is shared instead of rebuilt per request, and every
// outbound Supabase call carries a timeout.

test('domain refusals keep their status; unknown failures are 503, never 400', () => {
  assert.equal(httpStatusForErrorMessage('Authentication required.'), 401);
  assert.equal(httpStatusForErrorMessage('Invalid or expired session.'), 401);
  assert.equal(httpStatusForErrorMessage('You do not have permission to perform this action.'), 403);
  assert.equal(httpStatusForErrorMessage('CBT attempt not found.'), 404);
  assert.equal(httpStatusForErrorMessage('This CBT attempt has expired.'), 409);
  assert.equal(httpStatusForErrorMessage('This CBT attempt has already been submitted.'), 409);
  assert.equal(httpStatusForErrorMessage('Answers must be an object.'), 400);
  assert.equal(httpStatusForErrorMessage('Invalid answer for question 4.'), 400);
  assert.equal(httpStatusForErrorMessage('Connection terminated unexpectedly'), 503);
  assert.equal(httpStatusForErrorMessage('fetch failed'), 503);
});

test('a 503 from submit is classified by the session page as a retryable server failure', () => {
  const status = httpStatusForErrorMessage('Connection terminated unexpectedly');
  assert.equal(failureKindOf({ status }), 'server');
});

test('the service-role client is created once and reused', () => {
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_unit-test';
  try {
    const first = getServerSupabaseClient();
    const second = getServerSupabaseClient();
    assert.ok(first, 'a client is returned when configured');
    assert.equal(first, second, 'the same instance serves every caller');
  } finally {
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test('no client is offered when Supabase is not configured', () => {
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    assert.equal(getServerSupabaseClient(), null);
  } finally {
    if (previousUrl !== undefined) process.env.VITE_SUPABASE_URL = previousUrl;
    if (previousKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousSecret !== undefined) process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
});

test('supabaseFetch always passes an abort signal and enforces the timeout', async () => {
  const realFetch = globalThis.fetch;
  let seenSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    seenSignal = init?.signal;
    return new Response('ok');
  }) as typeof fetch;
  try {
    const response = await supabaseFetch('https://example.invalid/');
    assert.equal(response.status, 200);
    assert.ok(seenSignal instanceof AbortSignal, 'every outbound call is abortable');

    globalThis.fetch = ((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted by signal')));
    })) as typeof fetch;
    await assert.rejects(supabaseFetch('https://example.invalid/', {}, 5), /abort/i);
  } finally {
    globalThis.fetch = realFetch;
  }
});
