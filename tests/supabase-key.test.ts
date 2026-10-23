import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivilegedKey } from '../src/lib/supabaseKey';

// ENV-2: a privileged key must never be usable from the browser.
//
// The site is a static bundle. Any `VITE_*` value is inlined into it, so a
// service-role or secret key pasted into `VITE_SUPABASE_PUBLISHABLE_KEY` would
// be handed to every visitor - and it bypasses every RLS policy. The browser
// client therefore screens the key before it builds a client.
//
// The old screen read only a JWT payload. Supabase's current secret keys are
// opaque strings beginning `sb_secret_`, and they are not JWTs, so the payload
// check could not see them: the one format an operator is most likely to copy
// out of the dashboard today was the one format that got through.

/** A JWT-shaped string whose payload is the given claims. */
function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature-not-checked`;
}

test('a legacy service-role JWT is privileged', () => {
  assert.equal(isPrivilegedKey(jwt({ role: 'service_role', iss: 'supabase' })), true);
});

test('a current sb_secret_ key is privileged even though it is not a JWT', () => {
  // The regression this test was written for: `sb_secret_…` has no readable
  // payload, so the JWT-only screen returned false and the key was used.
  assert.equal(isPrivilegedKey('sb_secret_abcdefghijklmnopqrstuvwxyz012345'), true);
  assert.equal(isPrivilegedKey('  sb_secret_leading-space  '), true, 'whitespace must not defeat the prefix check');
});

test('published keys are not privileged', () => {
  assert.equal(isPrivilegedKey('sb_publishable_abcdefghijklmnop'), false);
  assert.equal(isPrivilegedKey(jwt({ role: 'anon' })), false);
  // The legacy anon key shape used before the rename.
  assert.equal(isPrivilegedKey(jwt({ role: 'authenticated' })), false);
});

test('an empty, missing or unreadable key is not treated as privileged', () => {
  // Careful direction: "not privileged" is not "safe to use". An unreadable key
  // simply never matches, and `isSupabaseConfigured` reports the site as
  // unconfigured, which is the offline state. Nothing here throws.
  for (const value of [undefined, null, '', '   ', 'not-a-jwt', 'a.b', 'a.b.c', '...']) {
    assert.equal(isPrivilegedKey(value), false, `${String(value)} must not throw or read as privileged`);
  }
});

test('the secret-key prefix matches the server rule', async () => {
  // `lib/supabase-config.ts` accepts `sb_secret_` as a *server* key. If one
  // side ever changed its prefix without the other, a browser could accept what
  // the server treats as privileged, or vice versa.
  const { getServerSupabaseKey } = await import('../lib/supabase-config');
  const secret = 'sb_secret_abcdefghijklmnopqrstuvwxyz012345';
  assert.equal(getServerSupabaseKey({ SUPABASE_SERVICE_ROLE_KEY: secret }), secret);
  assert.equal(isPrivilegedKey(secret), true);
});
