import assert from 'node:assert/strict';
import { test } from 'node:test';

// Isolated in-memory Supabase stub. No network or hosted account is used.
process.env.VITE_SUPABASE_URL = 'https://service-submission.example.test';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'isolated-publishable-key';
const { isSupabaseConfigured, supabase } = await import('../src/lib/supabase');
const { submitServiceRequest } = await import('../src/lib/api');

const submissionKey = 'c1111111-1111-4111-8111-111111111111';

test('configured submission uses only the idempotent RPC and refuses account changes', async () => {
  assert.equal(isSupabaseConfigured, true);
  const originalGetUser = supabase.auth.getUser;
  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  let currentUserId = 'synthetic-student';
  let failure: 'none' | 'returned' | 'thrown' | 'malformed' = 'none';
  try {
    supabase.auth.getUser = (async () => ({ data: { user: { id: currentUserId } }, error: null })) as typeof supabase.auth.getUser;
    supabase.from = (() => { throw new Error('direct insert is forbidden'); }) as unknown as typeof supabase.from;
    supabase.rpc = ((name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return { single: async () => {
        if (failure === 'thrown') throw new Error('synthetic connection loss after write');
        if (failure === 'returned') return { data: null, error: { message: 'synthetic connection loss' } };
        if (failure === 'malformed') return { data: { id: 'server-id' }, error: null };
        return { data: { id: 'server-id', reference_code: 'SERVER-REFERENCE', status: 'submitted', created_at: '2026-01-01' }, error: null };
      } };
    }) as unknown as typeof supabase.rpc;
    const payload = { serviceSlug: 'RESULTS', expectedUserId: 'synthetic-student', submissionKey, details: { serviceTitle: 'Results', notes: 'Synthetic details' } };
    const result = await submitServiceRequest(payload);
    assert.equal(result.reference_code, 'SERVER-REFERENCE');
    assert.deepEqual(calls[0], { name: 'submit_service_request_idempotent', params: { p_service_key: 'results', p_form_data: payload.details, p_submission_key: submissionKey, p_expected_user_id: 'synthetic-student', p_recovery_only: false } });
    await submitServiceRequest({ ...payload, recoveryOnly: true });
    assert.equal(calls[1].params.p_recovery_only, true);
    const before = calls.length;
    await assert.rejects(submitServiceRequest({ ...payload, expectedUserId: undefined }), /account changed/i);
    await assert.rejects(submitServiceRequest({ ...payload, submissionKey: undefined }), /draft.*unavailable/i);
    currentUserId = 'different-student';
    await assert.rejects(submitServiceRequest(payload), /account changed/i);
    assert.equal(calls.length, before, 'no RPC occurs when identity or key is missing');
    currentUserId = 'synthetic-student';
    for (const mode of ['returned', 'thrown', 'malformed'] as const) {
      failure = mode;
      await assert.rejects(submitServiceRequest(payload), /could not confirm/i);
    }
    assert.ok(calls.slice(1).every(call => call.params.p_submission_key === submissionKey), 'uncertain retries reuse the key');
  } finally {
    supabase.auth.getUser = originalGetUser;
    supabase.rpc = originalRpc;
    supabase.from = originalFrom;
  }
});
