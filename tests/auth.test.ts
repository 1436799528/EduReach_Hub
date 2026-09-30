import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { verifyJWT, verifyAdminToken } from '../lib/auth';

// A local Supabase contract stub, not proof of live Supabase configuration.
const backend = express();
let profileRole = 'student';
let metadataRole = 'student';
let profileFailure = false;
backend.get('/auth/v1/user', (req, res) => {
  if (req.header('authorization') !== 'Bearer valid-session') return res.status(401).json({ message: 'Invalid token' });
  return res.json({ id: 'user-123', aud: 'authenticated', email: 'student@example.test', user_metadata: { role: metadataRole, full_name: 'Student' } });
});
backend.get('/rest/v1/profiles', (_req, res) => {
  if (profileFailure) return res.status(500).json({ message: 'Unavailable' });
  return res.json([{ role: profileRole, full_name: 'Trusted Profile Name' }]);
});
const server = backend.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Missing test port');
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${address.port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test-only';
after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('validated session resolves the trusted profile', async () => {
  const user = await verifyJWT('valid-session');
  assert.equal(user?.id, 'user-123');
  assert.equal(user?.fullName, 'Trusted Profile Name');
  assert.equal(user?.role, 'student');
});
test('expired or invalid session cannot authenticate', async () => {
  assert.equal(await verifyJWT('expired'), null);
});
test('user-editable metadata cannot promote a student to admin', async () => {
  metadataRole = 'super_admin';
  profileRole = 'student';
  assert.equal(await verifyAdminToken('valid-session'), null);
});
for (const role of ['admin', 'super_admin', 'moderator']) {
  test(`trusted staff role ${role} can pass the admin gate`, async () => {
    profileRole = role;
    assert.equal((await verifyAdminToken('valid-session'))?.role, 'admin');
  });
}
test('profile lookup failure never grants admin access', async () => {
  profileFailure = true;
  assert.equal(await verifyAdminToken('valid-session'), null);
});

// ROLE-1: the payload carries the application role and its capabilities, so
// every endpoint authorizes through one vocabulary instead of role names.
test('the session payload carries the application role and capabilities', async () => {
  profileFailure = false;
  metadataRole = 'super_admin';

  profileRole = 'student';
  const student = await verifyJWT('valid-session');
  assert.equal(student?.appRole, 'student');
  assert.equal(student?.capabilities.includes('cbt.attempt'), true);
  assert.equal(student?.capabilities.includes('news.publish'), false);

  profileRole = 'content_editor';
  const editor = await verifyJWT('valid-session');
  assert.equal(editor?.appRole, 'content_editor');
  assert.equal(editor?.role, 'admin');
  assert.equal(editor?.capabilities.includes('news.publish'), true);
  assert.equal(editor?.capabilities.includes('user.suspend'), false);

  profileRole = 'service_admin';
  const service = await verifyJWT('valid-session');
  assert.equal(service?.appRole, 'service_admin');
  assert.equal(service?.capabilities.includes('service_request.process'), true);
  assert.equal(service?.capabilities.includes('news.publish'), false);

  // Retired half-roles resolve to the least-privileged role: RLS grants they
  // used to hold are gone, and they hold no staff capability here either.
  profileRole = 'senate_admin';
  const retired = await verifyJWT('valid-session');
  assert.equal(retired?.appRole, 'student');
  assert.equal(retired?.capabilities.includes('news.read'), false);
  assert.equal(await verifyAdminToken('valid-session'), null);
});
