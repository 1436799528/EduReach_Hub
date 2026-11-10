import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { submitServiceRequest } from '../src/lib/api';

// This is the unconfigured local build, never a hosted account or database.
test('unconfigured service requests cannot fabricate a submitted record or reference', async () => {
  assert.equal(isSupabaseConfigured, false, 'this test requires an unconfigured local environment');
  const dom = new JSDOM('', { url: 'https://example.test' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });
  try {
    await assert.rejects(submitServiceRequest({ serviceSlug: 'results', details: { serviceTitle: 'Results', fullName: 'Synthetic Student' } }), /unavailable.*not been submitted/i);
    assert.equal(dom.window.localStorage.length, 0, 'no fake locally submitted request is created');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
    dom.window.close();
  }
});
