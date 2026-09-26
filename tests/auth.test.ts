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
