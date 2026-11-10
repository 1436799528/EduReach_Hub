import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import express from 'express';

import {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  capabilitiesForRole,
  capabilityForAdminPath,
  hasCapability,
  isRetiredStaffRole,
  isStaffRole,
  resolveAppRole,
  type AppRole,
  type Capability,
} from '../src/lib/capabilities';
import { can } from '../lib/authorization';

// ---------------------------------------------------------------------------
// A contract stub for Supabase, not proof of a live project. The role of a
// session is derived from its token so each request can act as a different
// account, and every request is recorded so ownership filters can be asserted.
// ---------------------------------------------------------------------------

const recorded: string[] = [];
const backend = express();
backend.use(express.json());

backend.get('/auth/v1/user', (req, res) => {
  const header = String(req.header('authorization') || '');
  const match = /^Bearer token-([a-z_]+)$/.exec(header);
  if (!match) return res.status(401).json({ message: 'Invalid token' });
  const account = match[1];
  return res.json({
    id: `user-${account}`,
    aud: 'authenticated',
    email: `${account}@example.test`,
    // Deliberately hostile: user-editable metadata always claims super admin.
    user_metadata: { role: 'super_admin', full_name: 'Metadata Name' },
  });
});

function accountFromRequest(req: express.Request): string {
  const idFilter = String(req.query.id || '');
  const match = /eq\.user-([a-z_]+)/.exec(idFilter);
  if (match) return match[1];
  const auth = /^Bearer token-([a-z_]+)$/.exec(String(req.header('authorization') || ''));
  return auth ? auth[1] : 'unknown';
}

backend.get('/rest/v1/profiles', (req, res) => {
  const account = accountFromRequest(req);
  const row = { id: `user-${account}`, role: account, full_name: 'Trusted Profile Name' };
  recorded.push(`GET profiles id=${String(req.query.id || '')}`);
  const wantsObject = String(req.header('accept') || '').includes('vnd.pgrst.object');
  return res.json(wantsObject ? row : [row]);
});

backend.patch('/rest/v1/profiles', (req, res) => {
  recorded.push(`PATCH profiles body=${JSON.stringify(req.body)}`);
  const row = { id: String(req.query.id || '').replace('eq.', ''), role: req.body?.role, full_name: 'Target Account' };
  const wantsObject = String(req.header('accept') || '').includes('vnd.pgrst.object');
  return res.json(wantsObject ? row : [row]);
});

let newsFixtureEnabled = false;
const newsFixture = Array.from({ length: 235 }, (_, index) => ({
  id: String(index).padStart(3, '0'), title: `Article ${String(index).padStart(3, '0')}${index === 12 ? ' 100%_verified' : ''}`,
  updated_at: '2025-01-01T00:00:00Z', published: index % 3 === 0, is_placeholder: index % 3 === 1,
}));
backend.get('/rest/v1/news_articles', (req, res) => {
  recorded.push('GET news_articles');
  if (req.query.id === 'eq.article-placeholder') {
    return res.json({ id: 'article-placeholder', slug: 'placeholder', published: false, published_at: null, is_placeholder: true, placeholder_note: 'Verified source required' });
  }
  if (!newsFixtureEnabled) return res.json([]);
  recorded.push(`LIST news ${JSON.stringify(req.query)}`);
  let rows = [...newsFixture].sort((a, b) => b.id.localeCompare(a.id));
  if (req.query.published === 'eq.true') rows = rows.filter((row) => row.published);
  if (req.query.published === 'eq.false') rows = rows.filter((row) => !row.published);
  if (req.query.is_placeholder === 'eq.true') rows = rows.filter((row) => row.is_placeholder);
  if (typeof req.query.title === 'string') {
    const term = req.query.title.replace(/^ilike\.%/, '').replace(/%$/, '').replace(/\\([\\%_])/g, '$1').toLowerCase();
    rows = rows.filter((row) => row.title.toLowerCase().includes(term));
  }
  const offset = Number(req.query.offset || 0);
  const limit = Number(req.query.limit || rows.length);
  return res.json(rows.slice(offset, offset + limit));
});
backend.patch('/rest/v1/news_articles', (req, res) => {
  recorded.push(`PATCH news_articles query=${JSON.stringify(req.query)} body=${JSON.stringify(req.body)}`);
  return res.json([{ id: 'article-placeholder', slug: 'placeholder', ...req.body }]);
});

backend.post('/rest/v1/news_articles', (req, res) => {
  recorded.push('POST news_articles');
  recorded.push(`POST news_articles body=${JSON.stringify(req.body)}`);
  const row = { id: 'article-new', slug: 'draft-notice', title: req.body?.title, published: req.body?.published === true, updated_at: new Date().toISOString() };
  const wantsObject = String(req.header('accept') || '').includes('vnd.pgrst.object');
  return res.status(201).json(wantsObject ? row : [row]);
});

let serviceRequest = { id: 'request-1', user_id: 'student-1', status: 'submitted', admin_note: null as string | null, reference_code: 'TEST-1', updated_at: '2025-01-01T00:00:00.000Z', service_catalog: { title: 'Service' } };
let raceServiceUpdate: Partial<typeof serviceRequest> | null = null;
let failServiceRead = false;
let failServiceWrite = false;
backend.get('/rest/v1/service_requests', (req, res) => {
  recorded.push('GET service_requests');
  if (failServiceRead) return res.status(503).json({ code: 'DB_DOWN', message: 'database unavailable' });
  const wantsObject = String(req.header('accept') || '').includes('vnd.pgrst.object');
  if (req.query.id === 'eq.request-1') return res.json(wantsObject ? { ...serviceRequest } : [{ ...serviceRequest }]);
  if (wantsObject) return res.status(406).json({ code: 'PGRST116', message: 'No rows' });
  return res.json([]);
});
backend.patch('/rest/v1/service_requests', (req, res) => {
  recorded.push(`PATCH service_requests query=${JSON.stringify(req.query)}`);
  if (failServiceWrite) return res.status(503).json({ code: 'DB_DOWN', message: 'database unavailable' });
  if (raceServiceUpdate) { serviceRequest = { ...serviceRequest, ...raceServiceUpdate }; raceServiceUpdate = null; }
  if (req.query.id !== `eq.${serviceRequest.id}` || req.query.status !== `eq.${serviceRequest.status}` || req.query.updated_at !== `eq.${serviceRequest.updated_at}`) return res.json([]);
  serviceRequest = { ...serviceRequest, ...req.body };
  return res.json([{ ...serviceRequest }]);
});
backend.post('/rest/v1/site_analytics_events', (_req, res) => { recorded.push('POST site_analytics_events'); return res.status(201).json(null); });
backend.get('/rest/v1/student_notifications', (_req, res) => { recorded.push('GET student_notifications'); return res.json([]); });
backend.post('/rest/v1/student_notifications', (_req, res) => { recorded.push('POST student_notifications'); return res.status(201).json(null); });

let cbtPaperFixture: 'missing' | 'read-error' | 'rpc-error' | 'rpc-not-found' | 'rpc-expired' | 'ok' = 'missing';
let cbtPaperProtocol: string | null = 'legacy';
let cbtPaperStatus = 'in_progress';
let cbtProtocolColumnMissing = false;
let cbtPaperQuestionIds = ['b1111111-1111-4111-8111-111111111111'];
let cbtAttemptRows: Array<Record<string, unknown>> = [];
backend.get('/rest/v1/cbt_attempts', (req, res) => {
  recorded.push(`GET cbt_attempts id=${String(req.query.id || '')} user_id=${String(req.query.user_id || '')}`);
  const wantsObject = String(req.header('accept') || '').includes('vnd.pgrst.object');
  // Activity history lists by user; the paper lookup filters by id.
  if (!req.query.id && req.query.user_id) return res.json(cbtAttemptRows);
  if (cbtPaperFixture === 'read-error') return res.status(503).json({ code: 'DB_DOWN', message: 'synthetic internal database error' });
  if (cbtProtocolColumnMissing && req.query.select === 'protocol') return res.status(400).json({ code: '42703', message: 'column protocol does not exist' });
  if (cbtPaperFixture !== 'missing') {
    const row = { id: 'test-attempt', exam_id: 'test-exam', protocol: cbtPaperProtocol, status: cbtPaperStatus, current_question: 0, answers_draft: {}, question_ids: cbtPaperProtocol === 'v2' ? cbtPaperQuestionIds : [], cbt_exams: {} };
    return res.json(wantsObject ? row : [row]);
  }
  return res.json(wantsObject ? null : []);
});
// The fixture's CBT bank is explicitly public; policy failure is exercised in
// restricted-bank-guest-http.test.ts.
let cbtPublicExamIds = new Set<string>();
backend.get('/rest/v1/cbt_bank_security', (req, res) => {
  const rawExam = String(req.query.exam_id || '');
  if (rawExam.startsWith('eq.')) return res.json([{ visibility: 'public' }]);
  // Public-bank filter used by activity and catalogue reads.
  const requested = String(req.query['exam_id'] || '');
  if (String(req.query.visibility) === 'eq.public') {
    const filter = /^in\.\((.*)\)$/.exec(requested);
    const allowed = filter ? filter[1].split(',').map((id) => id.replace(/^"|"$/g, '')) : [...cbtPublicExamIds];
    return res.json(allowed.filter((id) => cbtPublicExamIds.has(id)).map((id) => ({ exam_id: id })));
  }
  return res.json(requested ? [] : [{ visibility: 'public' }]);
});
let cbtBankAccess = true;
backend.post('/rest/v1/rpc/cbt_bank_candidate_access', (_req, res) => res.json(cbtBankAccess));
let cbtQuestionsMissing = false;
let questionListFixture = false;
backend.get('/rest/v1/exam_questions', (req, res) => {
  recorded.push(`GET exam_questions select=${String(req.query.select)} exam_id=${String(req.query.exam_id)} id=${String(req.query.id)} active=${String(req.query['cbt_exams.is_active'])} review=${String(req.query.review_status)}`);
  if (questionListFixture) {
    recorded.push(`QUESTION LIST ${JSON.stringify(req.query)}`);
    if (req.query.select === 'position') return res.json([{ position: 121 }]);
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 51);
    return res.json(Array.from({ length: Math.max(0, Math.min(limit, 121 - offset)) }, (_, i) => ({ id: `q-${offset + i + 1}`, position: offset + i + 1 })));
  }
  if (cbtQuestionsMissing) return res.json([]);
  return res.json([{ id: 'b1111111-1111-4111-8111-111111111111', subject: ' Test ', question_text: 'Question', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' }]);
});
let importReady = false;
let importCommitCalls = 0;
let importReviewItem = { id: 'item-1', import_id: 'import-1', question_text: 'Which answer is correct?', option_a: 'First', option_b: 'Second', option_c: 'Third', option_d: 'Fourth', option_e: null as string | null, correct_option: 'B' as string | null, explanation: null as string | null, passage: null as string | null, topic: null as string | null, review_status: 'pending', issues: [] as string[], duplicate_of: null, updated_at: '2026-01-01T00:00:00.000Z' };
backend.get('/rest/v1/question_imports', (_req, res) => res.json({ id: 'import-1', status: 'extracted', approved_count: 1, exam_id: 'exam-1', subject: 'Mathematics' }));
backend.get('/rest/v1/question_import_items', (_req, res) => res.json(importReviewItem));
backend.patch('/rest/v1/question_import_items', (req, res) => {
  if (req.query.updated_at !== `eq.${importReviewItem.updated_at}` || req.query.review_status !== `eq.${importReviewItem.review_status}`) return res.json([]);
  importReviewItem = { ...importReviewItem, ...req.body };
  return res.json([importReviewItem]);
});
backend.post('/rest/v1/rpc/question_import_atomic_ready', (_req, res) => importReady ? res.json(true) : res.status(404).json({ code: 'PGRST202', message: 'not found' }));
backend.post('/rest/v1/rpc/commit_question_import', (_req, res) => { importCommitCalls += 1; return res.json({ inserted: 1 }); });
let cbtWriteFixture: 'expired' | 'unexpected' = 'expired';
backend.patch('/rest/v1/cbt_attempts', (_req, res) => { recorded.push('PATCH cbt_attempts direct'); return res.json([]); });
for (const rpc of ['save_cbt_attempt_draft', 'submit_cbt_attempt_configured']) {
  backend.post(`/rest/v1/rpc/${rpc}`, (_req, res) => {
    recorded.push(`RPC ${rpc}`);
    return cbtWriteFixture === 'expired'
      ? res.status(400).json({ code: 'P0001', message: 'This CBT attempt has expired.' })
      : res.status(503).json({ code: 'DB_DOWN', message: 'synthetic expired infrastructure failure' });
  });
}
let cbtExpiryUnavailable = false;
backend.post('/rest/v1/rpc/cbt_expire_owned_attempt', (req, res) => {
  recorded.push(`RPC cbt_expire_owned_attempt auth=${String(req.header('authorization'))}`);
  if (cbtExpiryUnavailable) return res.status(503).json({ code: 'DB_DOWN', message: 'synthetic database failure' });
  return res.json('in_progress');
});
let cbtV2Outcome = 'accepted';
let cbtSessionOutcome = 'created';
backend.post('/rest/v1/rpc/cbt_v2_session_gateway', (req, res) => {
  recorded.push(`RPC cbt_v2_session_gateway auth=${String(req.header('authorization'))} body=${JSON.stringify(req.body)}`);
  if (cbtSessionOutcome === 'not-found') return res.status(400).json({ code: 'P0001', message: 'CBT attempt not found.' });
  if (cbtSessionOutcome === 'malformed') return res.json({ outcome: 'created', revision: 0, answers: {}, status: 'in_progress' });
  return res.json({ outcome: cbtSessionOutcome, sessionId: 'd1111111-1111-4111-8111-111111111111', generation: 1, revision: 0, answers: {}, status: 'in_progress' });
});
for (const rpc of ['cbt_v2_answer_gateway', 'cbt_candidate_answer', 'cbt_candidate_finalize']) {
  backend.post(`/rest/v1/rpc/${rpc}`, (req, res) => {
    recorded.push(`RPC ${rpc} auth=${String(req.header('authorization'))} body=${JSON.stringify(req.body)}`);
    if (cbtV2Outcome === 'protocol-mismatch') return res.status(400).json({ code: 'P0001', message: 'CBT protocol mismatch.' });
    if (cbtV2Outcome === 'revoked') return res.status(400).json({ code: 'P0001', message: 'CBT writing session is no longer active.' });
    if (cbtV2Outcome === 'not-active') return res.status(400).json({ code: 'P0001', message: 'CBT attempt is not active.' });
    return res.json({ outcome: cbtV2Outcome, revision: 2, answers: { '1': 0 }, status: 'in_progress' });
  });
}
backend.post('/rest/v1/rpc/get_cbt_attempt_paper', (_req, res) => {
  recorded.push('RPC get_cbt_attempt_paper');
  if (cbtPaperFixture === 'rpc-error') return res.status(503).json({ code: 'DB_DOWN', message: 'synthetic internal database error' });
  if (cbtPaperFixture === 'rpc-not-found') return res.status(400).json({ code: 'P0001', message: 'CBT attempt not found.' });
  if (cbtPaperFixture === 'rpc-expired') return res.status(400).json({ code: 'P0001', message: 'This CBT attempt has expired.' });
  return res.json([]);
});

for (const rpc of ['admin_audit_log', 'admin_dashboard_metrics', 'admin_activity_breakdown']) {
  backend.post(`/rest/v1/rpc/${rpc}`, (req, res) => {
    recorded.push(`RPC ${rpc} ${JSON.stringify(req.body)}`);
    return res.json(null);
  });
}

const backendServer = backend.listen(0, '127.0.0.1');
await once(backendServer, 'listening');
const backendAddress = backendServer.address();
if (!backendAddress || typeof backendAddress === 'string') throw new Error('Missing test port');

process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${backendAddress.port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test-only';
process.env.NETLIFY = 'true';
process.env.NODE_ENV = 'production';

const { app } = await import('../server');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Missing test port');
const base = `http://127.0.0.1:${address.port}`;

after(() => Promise.all([
  new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  new Promise<void>((resolve) => backendServer.close(() => resolve())),
]));

const as = (account: string) => ({ Authorization: `Bearer token-${account}` });

// ---------------------------------------------------------------------------
// vocabulary and role mapping
// ---------------------------------------------------------------------------

test('the capability vocabulary is unique, well-formed and fully mapped', () => {
  assert.equal(new Set(CAPABILITIES).size, CAPABILITIES.length, 'duplicate capability');
  for (const capability of CAPABILITIES) {
    assert.match(capability, /^[a-z_]+\.[a-z_]+$/, `${capability} must be resource.action`);
  }

  for (const role of Object.keys(ROLE_CAPABILITIES) as AppRole[]) {
    for (const capability of ROLE_CAPABILITIES[role]) {
      assert.ok((CAPABILITIES as readonly string[]).includes(capability), `${role} lists unknown ${capability}`);
    }
  }

  // A super admin can do everything a staff account can, and students hold no
  // staff capability at all (staff roles also hold the owner-scoped student
  // capabilities — a staff member is still a signed-in person).
  const studentCapabilities = capabilitiesForRole('student');
  const staffUnion = new Set<Capability>(
    [...capabilitiesForRole('content_editor'), ...capabilitiesForRole('service_admin')]
      .filter((capability) => !studentCapabilities.includes(capability)),
  );
  assert.ok(staffUnion.size >= 15, 'the staff vocabulary must be substantial');
  for (const capability of staffUnion) {
    assert.ok(hasCapability({ role: 'super_admin' }, capability), `super_admin must hold ${capability}`);
    assert.ok(!studentCapabilities.includes(capability), `student must not hold ${capability}`);
  }
});

test('roles resolve with least privilege and retired half-roles keep nothing', () => {
  assert.equal(resolveAppRole('student'), 'student');
  assert.equal(resolveAppRole('content_editor'), 'content_editor');
  assert.equal(resolveAppRole('service_admin'), 'service_admin');

  // Legacy staff keep their access...
  for (const legacy of ['admin', 'moderator', 'super_admin', 'SUPER_ADMIN', ' Admin ']) {
    assert.equal(resolveAppRole(legacy), 'super_admin', `${legacy} must map to super_admin`);
  }
  // ...while retired and unknown values must never grant staff access.
  for (const retired of ['senate_admin', 'campus_agent']) {
    assert.equal(resolveAppRole(retired), 'student');
    assert.equal(isRetiredStaffRole(retired), true);
    assert.equal(hasCapability({ role: retired }, 'user.read'), false);
    assert.equal(hasCapability({ role: retired }, 'news.publish'), false);
  }
  for (const unknown of ['', null, undefined, 'principal', 'super-admin', 'root']) {
    assert.equal(resolveAppRole(unknown), 'student', `${String(unknown)} must resolve to student`);
  }

  assert.equal(isStaffRole('student'), false);
  assert.equal(isStaffRole('content_editor'), true);
});

test('duty separation between the staff roles is real', () => {
  const content: Capability[] = ['news.publish', 'news.delete', 'cbt.manage', 'opportunity.update', 'data.read'];
  const service: Capability[] = ['service_request.process', 'service_request.read', 'service.read'];
  const ownerOnly: Capability[] = ['user.read', 'user.suspend', 'user.manage_roles', 'audit.read', 'data.import'];
  const notContent: Capability[] = ['service_request.read', 'service_request.process', 'user.read', 'user.suspend'];
  const notService: Capability[] = ['news.publish', 'news.delete', 'cbt.manage', 'user.read', 'data.write'];

  for (const capability of content) assert.ok(hasCapability({ role: 'content_editor' }, capability), `content_editor needs ${capability}`);
  for (const capability of notContent) assert.ok(!hasCapability({ role: 'content_editor' }, capability), `content_editor must not hold ${capability}`);
  for (const capability of service) assert.ok(hasCapability({ role: 'service_admin' }, capability), `service_admin needs ${capability}`);
  for (const capability of notService) assert.ok(!hasCapability({ role: 'service_admin' }, capability), `service_admin must not hold ${capability}`);
  for (const capability of ownerOnly) {
    assert.ok(hasCapability({ role: 'super_admin' }, capability), `super_admin needs ${capability}`);
    assert.ok(!hasCapability({ role: 'content_editor' }, capability) && !hasCapability({ role: 'service_admin' }, capability), `${capability} is super-admin only`);
  }
});

test('console route capabilities mirror the server mapping', () => {
  assert.equal(capabilityForAdminPath('/admin/news/123'), 'news.read');
  assert.equal(capabilityForAdminPath('/admin/queue'), 'service_request.read');
  assert.equal(capabilityForAdminPath('/admin/users'), 'user.read');
  assert.equal(capabilityForAdminPath('/admin/content-manager?tab=news'), 'data.read');
  assert.equal(capabilityForAdminPath('/admin'), null, 'the overview is open to any staff member');
  assert.equal(capabilityForAdminPath('/admin/health'), null);
});

// ---------------------------------------------------------------------------
// ownership
// ---------------------------------------------------------------------------

test('can() combines capability with ownership', () => {
  const payload = (id: string, appRole: AppRole) => ({
    id,
    email: `${id}@example.test`,
    fullName: 'Test Account',
    role: (appRole === 'student' ? 'student' : 'admin') as 'admin' | 'student',
    appRole,
    capabilities: [...capabilitiesForRole(appRole)],
  });
  const student = payload('user-1', 'student');
  const other = payload('user-2', 'student');
  const admin = payload('user-3', 'super_admin');

  assert.equal(can(student, 'cbt.view_result', { ownerId: 'user-1' }), true);
  assert.equal(can(student, 'cbt.view_result', { ownerId: 'user-2' }), false);
  assert.equal(can(other, 'service_request.read_own', { ownerId: 'user-1' }), false);
  assert.equal(can(student, 'cbt.view_result'), false, 'owner-scoped capabilities need a resource');

  // Staff read other people's data through staff capabilities, never by
  // claiming ownership.
  assert.equal(can(admin, 'cbt.view_result', { ownerId: 'user-1' }), false);
  assert.equal(can(admin, 'cbt.read'), true);
  assert.equal(can(admin, 'service_request.read'), true);
  assert.equal(can(admin, 'user.suspend'), true);

  // A student can never reach a staff capability, with or without a resource.
  assert.equal(can(student, 'user.suspend'), false);
  assert.equal(can(student, 'news.publish', { ownerId: 'user-1' }), false);
  assert.equal(can(null, 'news.read'), false);
});

// ---------------------------------------------------------------------------
// server enforcement
// ---------------------------------------------------------------------------

async function call(path: string, account?: string, init: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: { ...(init.headers || {}), ...(account ? as(account) : {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

test('unauthenticated and invalid sessions are refused before anything runs', async () => {
  const anonymous = await call('/api/admin/session');
  assert.equal(anonymous.status, 401);
  assert.deepEqual(anonymous.body, { error: 'Authentication required.' });

  const invalid = await call('/api/admin/session', 'not-a-real-token');
  assert.equal(invalid.status, 401);
  assert.deepEqual(invalid.body, { error: 'Invalid or expired session.' });

  for (const route of ['/api/admin/users', '/api/admin/news', '/api/admin/service-requests']) {
    const response = await call(route);
    assert.equal(response.status, 401, `${route} must refuse an anonymous caller`);
  }
});

test('a student session is authenticated but never authorized for admin routes', async () => {
  const session = await call('/api/admin/session', 'student');
  assert.equal(session.status, 403);
  assert.deepEqual(session.body, { error: 'You do not have permission to perform this action.' });

  const news = await call('/api/admin/news', 'student');
  assert.equal(news.status, 403);
  // The refusal must not describe what the student is missing.
  assert.equal(JSON.stringify(news.body).includes('news.read'), false);

  const role = await call('/api/admin/users/user-target/role', 'student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'super_admin' }),
  });
  assert.equal(role.status, 403, 'a student cannot promote anybody, including themselves');
});

test('retired half-roles hold no capability and cannot reach the console', async () => {
  for (const retired of ['senate_admin', 'campus_agent']) {
    const session = await call('/api/admin/session', retired);
    assert.equal(session.status, 403, `${retired} must not pass the staff gate`);
    const users = await call('/api/admin/users', retired);
    assert.equal(users.status, 403, `${retired} must not read student accounts`);
  }
});

test('every staff role reaches exactly its own surfaces', async () => {
  // A content editor runs the newsroom but never sees student service data.
  assert.equal((await call('/api/admin/session', 'content_editor')).status, 200);
  assert.equal((await call('/api/admin/news', 'content_editor')).status, 200);
  assert.equal((await call('/api/admin/service-requests', 'content_editor')).status, 403);
  assert.equal((await call('/api/admin/users', 'content_editor')).status, 403);
  assert.equal((await call('/api/admin/users/user-target/ban', 'content_editor', { method: 'POST' })).status, 403);

  // A service administrator processes requests but cannot publish or manage accounts.
  assert.equal((await call('/api/admin/service-requests', 'service_admin')).status, 200);
  assert.equal((await call('/api/admin/news', 'service_admin')).status, 403);
  assert.equal((await call('/api/admin/users', 'service_admin')).status, 403);
  assert.equal(
    (await call('/api/admin/news', 'service_admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X', body: 'Y', published: true }),
    })).status,
    403,
  );

  // The owner reaches everything.
  assert.equal((await call('/api/admin/users', 'super_admin')).status, 200);
  assert.equal((await call('/api/admin/service-requests', 'super_admin')).status, 200);
  assert.equal((await call('/api/admin/news', 'super_admin')).status, 200);
});

test('a draft write is authorized while publishing is refused for a service role', async () => {
  // `news.create` gets a content editor past the guard into the handler...
  const draft = await call('/api/admin/news', 'content_editor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Draft notice', body: 'Body text', published: false }),
  });
  assert.equal(draft.status, 201, 'a content editor may create a draft');

  // ...and the same call with `published: true` is still gated: the payload
  // rule requires `news.publish` on top of `news.create`.
  const publishAttempt = await call('/api/admin/news', 'service_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Notice', body: 'Body text', published: true }),
  });
  assert.equal(publishAttempt.status, 403);
});

test('news placeholders cannot be published or converted and published in one request', async () => {
  const json = { 'Content-Type': 'application/json' };
  const placeholder = { title: 'Placeholder', body: 'Replace this draft.', is_placeholder: true, placeholder_note: 'Verified source required' };
  const unauthorized = await call('/api/admin/news', 'student', { method: 'POST', headers: json, body: JSON.stringify(placeholder) });
  assert.equal(unauthorized.status, 403);
  recorded.length = 0;
  const draft = await call('/api/admin/news', 'content_editor', { method: 'POST', headers: json, body: JSON.stringify(placeholder) });
  assert.equal(draft.status, 201);
  const write = recorded.find((entry) => entry.startsWith('POST news_articles body='));
  assert.ok(write);
  const written = JSON.parse(write.slice('POST news_articles body='.length));
  assert.equal(written.is_placeholder, true);
  assert.equal(written.placeholder_note, placeholder.placeholder_note);
  assert.equal(written.published, false);
  const missingNote = await call('/api/admin/news', 'content_editor', { method: 'POST', headers: json, body: JSON.stringify({ ...placeholder, placeholder_note: '' }) });
  assert.equal(missingNote.status, 400);
  const publish = await call('/api/admin/news', 'content_editor', { method: 'POST', headers: json, body: JSON.stringify({ ...placeholder, published: true }) });
  assert.equal(publish.status, 400);
  const patch = async (body: object) => call('/api/admin/news/article-placeholder', 'content_editor', { method: 'PATCH', headers: json, body: JSON.stringify(body) });
  assert.equal((await patch({ published: true })).status, 400);
  assert.equal((await patch({ is_placeholder: false, published: true })).status, 400);
  assert.equal((await patch({ is_placeholder: false, confirm_placeholder_replacement: true, published: true })).status, 400);
  assert.equal((await patch({ is_placeholder: false })).status, 400);
  assert.equal((await patch({ is_placeholder: false, confirm_placeholder_replacement: 'true' })).status, 400);
  assert.equal((await patch({ placeholder_note: '' })).status, 400);
  assert.equal((await patch({ is_placeholder: false, confirm_placeholder_replacement: true, title: 'Genuine replacement', published: false })).status, 200);
  const update = recorded.find((entry) => entry.startsWith('PATCH news_articles query='));
  assert.ok(update);
  assert.match(update, /is_placeholder.*eq.true/);
  assert.ok(!update.includes('confirm_placeholder_replacement'));
  assert.ok(recorded.some((entry) => entry.includes('placeholder_replaced')));
});

test('service-request updates reject stale versions and concurrent writes before audit or notification', async () => {
  const json = { 'Content-Type': 'application/json' };
  const patch = (body: object, account = 'service_admin') => call('/api/admin/service-requests/request-1', account, { method: 'PATCH', headers: json, body: JSON.stringify(body) });
  // Preserve PostgreSQL microseconds exactly in the read/compare/write filter.
  const version = '2025-01-01T00:00:00.123456Z';
  serviceRequest = { id: 'request-1', user_id: 'student-1', status: 'submitted', admin_note: null, reference_code: 'TEST-1', updated_at: version, service_catalog: { title: 'Service' } };
  recorded.length = 0;
  assert.equal((await patch({ status: 'reviewing', expected_updated_at: version }, 'student')).status, 403);
  const legacy = await patch({ status: 'reviewing', admin_note: 'An old client' });
  assert.equal(legacy.status, 409);
  assert.match(legacy.body.error, /refresh/i);
  assert.equal((await patch({ admin_note: 'Old client note' })).status, 409);
  assert.equal((await patch({ status: 'reviewing', expected_updated_at: null })).status, 400);
  assert.equal((await patch({ status: 'reviewing', expected_updated_at: 'invalid' })).status, 400);
  assert.equal((await patch({ status: 'reviewing', expected_updated_at: '2024-01-01T00:00:00Z' })).status, 409);
  assert.equal((await patch({ status: 'completed', expected_updated_at: version })).status, 409);
  assert.ok(!recorded.some((line) => line.startsWith('PATCH service_requests') || line.startsWith('RPC admin_audit_log') || line.startsWith('POST student_notifications')));
  // Another officer's status and note change occurs between the read and write.
  raceServiceUpdate = { status: 'processing', admin_note: 'New note', updated_at: '2025-01-02T00:00:00.000Z' };
  assert.equal((await patch({ status: 'reviewing', admin_note: 'Old note', expected_updated_at: version })).status, 409);
  assert.equal(serviceRequest.status, 'processing');
  assert.equal(serviceRequest.admin_note, 'New note');
  assert.ok(!recorded.some((line) => line.startsWith('RPC admin_audit_log') || line.startsWith('POST student_notifications')));
  // A fresh, valid transition commits once and only then emits audit/notification.
  const success = await patch({ status: 'completed', expected_updated_at: serviceRequest.updated_at });
  assert.equal(success.status, 200);
  assert.equal(serviceRequest.status, 'completed');
  assert.equal(recorded.filter((line) => line.startsWith('RPC admin_audit_log')).length, 1);
  assert.equal(recorded.filter((line) => line === 'POST student_notifications').length, 1);
  const previous = serviceRequest.updated_at;
  const note = await patch({ admin_note: 'Updated note', expected_updated_at: previous });
  assert.equal(note.status, 200);
  assert.equal(serviceRequest.admin_note, 'Updated note');
  assert.ok(Date.parse(serviceRequest.updated_at) > Date.parse(previous));
  assert.equal(recorded.filter((line) => line === 'POST student_notifications').length, 1);
});

test('service-request read errors and ambiguous write errors are not reported as missing or safely failed', async () => {
  serviceRequest = { ...serviceRequest, status: 'submitted', admin_note: null };
  const init = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'reviewing', expected_updated_at: serviceRequest.updated_at }) };
  const path = '/api/admin/service-requests/request-1';
  recorded.length = 0;
  const missing = await call('/api/admin/service-requests/missing', 'service_admin', init);
  assert.equal(missing.status, 404);
  failServiceRead = true;
  try {
    const read = await call(path, 'service_admin', init);
    assert.equal(read.status, 503);
    assert.match(read.body.error, /no update was attempted/i);
    assert.ok(!recorded.some((entry) => entry.startsWith('PATCH service_requests')));
  } finally { failServiceRead = false; }
  failServiceWrite = true;
  try {
    const write = await call(path, 'service_admin', init);
    assert.equal(write.status, 503);
    assert.match(write.body.error, /confirm.*refresh/i);
    assert.ok(!recorded.some((entry) => entry.startsWith('RPC admin_audit_log') || entry.startsWith('POST student_notifications')));
  } finally { failServiceWrite = false; }
});

test('generic news patch and import cannot change placeholder metadata', async () => {
  const json = { 'Content-Type': 'application/json' };
  const row = { id: 'article-placeholder', slug: 'placeholder', title: 'Replacement', body: 'Body', category: 'general', is_placeholder: false, placeholder_note: null, published: true };
  recorded.length = 0;
  const patch = await call('/api/admin/content-manager/data/news_articles/article-placeholder', 'super_admin', { method: 'PATCH', headers: json, body: JSON.stringify(row) });
  assert.equal(patch.status, 400);
  const imported = await call('/api/admin/content-manager/import/news_articles', 'super_admin', { method: 'POST', headers: json, body: JSON.stringify({ rows: [row] }) });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.inserted, 0);
  assert.equal(imported.body.updated, 0);
  assert.equal(imported.body.errors.length, 1);
  assert.ok(!recorded.some((entry) => entry.startsWith('PATCH news_articles') || entry.startsWith('POST news_articles')));
});

test('admin news lists every page and applies filters and title search on the server', async () => {
  newsFixtureEnabled = true;
  try {
    for (const state of ['all', 'draft', 'published', 'placeholder']) {
      const expected = newsFixture.filter((row) => state === 'all' || (state === 'draft' ? !row.published : state === 'published' ? row.published : row.is_placeholder)).map((row) => row.id).sort().reverse();
      const seen: string[] = [];
      for (let page = 1; ; page++) {
        const response = await call(`/api/admin/news?state=${state}&page=${page}&pageSize=37`, 'content_editor');
        assert.equal(response.status, 200);
        seen.push(...response.body.items.map((row: { id: string }) => row.id));
        if (!response.body.hasMore) break;
        assert.ok(page < 10);
      }
      assert.deepEqual(seen, expected);
    }
    const search = await call('/api/admin/news?state=all&search=100%25_veRiFiEd', 'content_editor');
    assert.equal(search.status, 200);
    assert.deepEqual(search.body.items.map((row: {id: string}) => row.id), ['012']);
    const list = recorded.filter((entry) => entry.startsWith('LIST news ')).at(-1);
    assert.ok(list?.includes('100\\\\%\\\\_veRiFiEd'));
    assert.ok(list?.includes('updated_at.desc,id.desc'));
    const empty = await call('/api/admin/news?page=999&pageSize=50', 'content_editor');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.items, []);
    assert.equal(empty.body.hasMore, false);
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'pageSize=0', 'pageSize=201', 'state=unknown', 'page=9007199254740992', `search=${'a'.repeat(121)}`]) {
      assert.equal((await call(`/api/admin/news?${query}`, 'content_editor')).status, 400, query);
    }
    assert.equal((await call('/api/admin/news?state=placeholder', 'student')).status, 403);
  } finally { newsFixtureEnabled = false; }
});

test('staff question list applies bounded pages and filters before returning rows', async () => {
  questionListFixture = true;
  recorded.length = 0;
  try {
    const path = '/api/admin/cbt/exams/example/questions';
    assert.equal((await call(path, 'student')).status, 403);
    assert.equal((await call(path)).status, 401);
    assert.equal((await call(`${path}?pageSize=101`, 'content_editor')).status, 400);
    const result = await call(`${path}?page=2&pageSize=50&search=cell&subject=Biology&topic=plants&year=2024&review=approved`, 'content_editor');
    assert.equal(result.status, 200);
    assert.equal(result.body.items.length, 50);
    assert.equal(result.body.items[0].position, 51);
    assert.equal(result.body.hasMore, true);
    assert.equal(result.body.nextPosition, 122);
    const query = recorded.find(entry => entry.startsWith('QUESTION LIST ') && entry.includes('question_text'));
    assert.ok(query);
    const params = JSON.parse(query.slice('QUESTION LIST '.length));
    assert.equal(params.exam_id, 'eq.example');
    assert.equal(params.question_text, 'ilike.%cell%');
    assert.equal(params.subject, 'ilike.%Biology%');
    assert.equal(params.syllabus_topic, 'ilike.%plants%');
    assert.equal(params.source_year, 'eq.2024');
    assert.equal(params.review_status, 'eq.approved');
    assert.equal(params.offset, '50');
    assert.equal(params.limit, '51');
  } finally { questionListFixture = false; }
});

test('import publication fails closed without its migration and stale reviews are rejected', async () => {
  const basePath = '/api/admin/question-imports/import-1';
  const json = { 'Content-Type': 'application/json' };
  importReady = false; importCommitCalls = 0;
  const denied = await call(`${basePath}/commit`, 'content_editor', { method: 'POST' });
  assert.equal(denied.status, 503);
  assert.equal(importCommitCalls, 0);
  importReady = true;
  const accepted = await call(`${basePath}/commit`, 'content_editor', { method: 'POST' });
  assert.equal(accepted.status, 200);
  assert.equal(importCommitCalls, 1);
  const review = `${basePath}/items/item-1/review`;
  assert.equal((await call(review, 'student', { method: 'POST', headers: json, body: JSON.stringify({ action: 'approve' }) })).status, 403);
  const stale = await call(review, 'content_editor', { method: 'POST', headers: json, body: JSON.stringify({ action: 'approve', expectedUpdatedAt: '2025-01-01T00:00:00.000Z' }) });
  assert.equal(stale.status, 409);
  const valid = await call(review, 'content_editor', { method: 'POST', headers: json, body: JSON.stringify({ action: 'approve', expectedUpdatedAt: importReviewItem.updated_at }) });
  assert.equal(valid.status, 200);
  assert.equal(importReviewItem.review_status, 'approved');
  assert.ok(recorded.some(entry => entry.includes('question_import_approve')));
  const editPath = `${basePath}/items/item-1`;
  const missingVersion = await call(editPath, 'content_editor', { method: 'PATCH', headers: json, body: JSON.stringify({ questionText: 'A different question?' }) });
  assert.equal(missingVersion.status, 400);
  const invalidAnswer = await call(editPath, 'content_editor', { method: 'PATCH', headers: json, body: JSON.stringify({ expectedUpdatedAt: importReviewItem.updated_at, correctOption: 'Banana' }) });
  assert.equal(invalidAnswer.status, 422);
  const cleared = await call(editPath, 'content_editor', { method: 'PATCH', headers: json, body: JSON.stringify({ expectedUpdatedAt: importReviewItem.updated_at, correctOption: null }) });
  assert.equal(cleared.status, 200);
  assert.equal(importReviewItem.correct_option, null);
  assert.equal(importReviewItem.review_status, 'pending');
  importReady = false;
});

test('the session endpoint reports the resolved role and capabilities', async () => {
  const response = await call('/api/admin/session', 'service_admin');
  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, 'service_admin');
  assert.deepEqual(response.body.user.capabilities, [...capabilitiesForRole('service_admin')]);
  assert.equal(response.body.user.capabilities.includes('news.publish'), false);
});

test('role assignment is super-admin only, validated, audited and never self-service', async () => {
  recorded.length = 0;

  // A content editor may not hand out roles.
  const denied = await call('/api/admin/users/user-target/role', 'content_editor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student' }),
  });
  assert.equal(denied.status, 403);

  // Unknown roles are refused before any write.
  const unknown = await call('/api/admin/users/user-target/role', 'super_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'root' }),
  });
  assert.equal(unknown.status, 400);
  assert.deepEqual(unknown.body, { error: 'Unknown role.' });

  // Self-modification is refused (no owner lock-out).
  const self = await call('/api/admin/users/user-super_admin/role', 'super_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student' }),
  });
  assert.equal(self.status, 400);
  assert.deepEqual(self.body, { error: 'You cannot change your own role.' });

  // A valid change is written and audited.
  const changed = await call('/api/admin/users/user-target/role', 'super_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'service_admin' }),
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body, { user: { id: 'user-target', role: 'service_admin' } });
  assert.ok(recorded.some((entry) => entry.startsWith('PATCH profiles') && entry.includes('service_admin')), 'the role must be written');
  const audit = recorded.find((entry) => entry.startsWith('RPC admin_audit_log'));
  assert.ok(audit, 'the change must be audited');
  assert.match(audit!, /user_role_change/);
  assert.match(audit!, /"to":"service_admin"/);
});

test('owner-scoped student endpoints filter by the caller, not by a client id', async () => {
  recorded.length = 0;
  const response = await call('/api/cbt/attempts/someone-elses-attempt/progress', 'student');
  assert.equal(response.status, 404, 'another student\'s attempt must look absent');
  const query = recorded.find((entry) => entry.startsWith('GET cbt_attempts'));
  assert.ok(query, 'the attempt lookup must reach the database');
  assert.match(query!, /user_id=eq\.user-student/, 'the query must be scoped to the authenticated caller');
});

test('analytics ingestion remains unavailable even for an old client', async () => {
  recorded.length = 0;
  const response = await call('/api/analytics/event', 'student', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: 'page_view', session_id: 'synthetic-session', path: '/', metadata: {} }),
  });
  assert.equal(response.status, 503);
  assert.ok(!recorded.includes('POST site_analytics_events'), 'disabled analytics must never write');
});

test('CBT paper distinguishes a missing attempt from database and RPC outages', async () => {
  try {
    for (const [mode, expected] of [['missing', 404], ['read-error', 503], ['rpc-error', 503], ['rpc-not-found', 404], ['rpc-expired', 409], ['ok', 200]] as const) {
      cbtPaperFixture = mode;
      recorded.length = 0;
      const response = await call('/api/cbt/attempts/a1111111-1111-4111-8111-111111111111/paper', 'student');
      assert.equal(response.status, expected, mode);
      if (mode === 'ok') assert.deepEqual(response.body.protocol, { version: 1 });
      assert.ok(recorded.some(entry => entry.includes('user_id=eq.user-student')), `${mode} must retain owner filtering`);
      if (expected === 503) assert.doesNotMatch(JSON.stringify(response.body), /synthetic internal database error|DB_DOWN/i);
      if (mode === 'read-error' || mode === 'missing') assert.ok(!recorded.includes('RPC get_cbt_attempt_paper'));
    }
    for (const [mode, expected] of [['missing', 404], ['read-error', 503], ['ok', 200]] as const) {
      cbtPaperFixture = mode;
      recorded.length = 0;
      const response = await call('/api/cbt/attempts/test-attempt/progress', 'student');
      assert.equal(response.status, expected, `progress ${mode}`);
      assert.ok(recorded.some(entry => entry.includes('user_id=eq.user-student')));
      if (expected === 503) assert.doesNotMatch(JSON.stringify(response.body), /synthetic internal database error|DB_DOWN/i);
    }
    for (const path of ['paper', 'progress']) {
      const unauthenticated = await fetch(`${base}/api/cbt/attempts/test-attempt/${path}`);
      assert.equal(unauthenticated.status, 401);
    }
  } finally { cbtPaperFixture = 'missing'; }
});

test('CBT expiry marking uses an owner-scoped RPC, never a privileged table update', async () => {
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'synthetic-publishable-key';
  try {
    const routes = [
      ['/api/cbt/attempts/test-attempt/draft', 'PATCH'],
      ['/api/cbt/attempts/test-attempt/progress', 'PATCH'],
      ['/api/cbt/attempts/test-attempt/submit', 'POST'],
    ] as const;
    for (const [path, method] of routes) {
      recorded.length = 0;
      cbtWriteFixture = 'expired';
      const response = await call(path, 'student', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: {} }) });
      assert.equal(response.status, 409, path);
      assert.ok(recorded.includes('RPC cbt_expire_owned_attempt auth=Bearer token-student'), `${path}: owner token is propagated`);
      assert.ok(!recorded.includes('PATCH cbt_attempts direct'), `${path}: no privileged direct update`);
    }
    recorded.length = 0;
    cbtExpiryUnavailable = true;
    const unavailable = await call('/api/cbt/attempts/test-attempt/draft', 'student', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: {} }) });
    assert.equal(unavailable.status, 409);
    assert.ok(!recorded.includes('PATCH cbt_attempts direct'), 'missing expiry RPC never falls back to direct write');
    cbtExpiryUnavailable = false;
    recorded.length = 0;
    cbtWriteFixture = 'unexpected';
    await call('/api/cbt/attempts/test-attempt/draft', 'student', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: {} }) });
    assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_expire_owned_attempt')), 'infrastructure errors mentioning expired do not trigger expiry');
    recorded.length = 0;
    await call('/api/cbt/attempts/test-attempt/draft', undefined, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: {} }) });
    assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_expire_owned_attempt')), 'unauthenticated requests cannot invoke expiry');
  } finally {
    cbtWriteFixture = 'expired';
    cbtExpiryUnavailable = false;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test('readiness fails closed when the CBT protocol column is unavailable', async () => {
  cbtProtocolColumnMissing = true;
  try {
    const response = await call('/api/health/ready');
    assert.equal(response.status, 503);
    assert.equal(response.body.checks.cbt_protocol_schema.ok, false);
    assert.doesNotMatch(JSON.stringify(response.body), /42703|column protocol does not exist/);
  } finally { cbtProtocolColumnMissing = false; }
  const response = await call('/api/health/ready');
  assert.equal(response.status, 200);
  assert.equal(response.body.checks.cbt_protocol_schema.ok, true);
});

test('local CBT v2 HTTP rejects bad protocol and forwards caller-bound operations without service fallback', async () => {
  const previous = { node: process.env.NODE_ENV, netlify: process.env.NETLIFY, flag: process.env.CBT_V2_LOCAL_REHEARSAL, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY, url: process.env.VITE_SUPABASE_URL };
  const id = 'a1111111-1111-4111-8111-111111111111';
  const question = 'b1111111-1111-4111-8111-111111111111';
  const key = 'c1111111-1111-4111-8111-111111111111';
  const endpoint = `/api/cbt/v2/attempts/${id}/answer`;
  const body = { protocol: 2, expectedRevision: 1, operationKey: key, questionId: question, selected: 0, sessionId: 'd1111111-1111-4111-8111-111111111111', sessionGeneration: 1 };
  const patch = (value: unknown) => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  try {
    cbtPaperFixture = 'ok';
    const paperPath = `/api/cbt/attempts/${id}/paper`;
    const paperProtocol = async () => (await call(paperPath, 'student')).body.protocol;
    process.env.CBT_V2_LOCAL_REHEARSAL = '1';
    process.env.NODE_ENV = 'production';
    assert.equal((await call(endpoint, 'student', patch(body))).status, 503, 'production cannot enable rehearsal');
    assert.deepEqual(await paperProtocol(), { version: 1 });
    process.env.NODE_ENV = 'test';
    process.env.NETLIFY = 'true';
    assert.equal((await call(endpoint, 'student', patch(body))).status, 503, 'Netlify cannot enable rehearsal');
    assert.deepEqual(await paperProtocol(), { version: 1 });
    process.env.NETLIFY = '';
    const originalUrl = process.env.VITE_SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = 'https://example.invalid';
    assert.equal((await call(endpoint, 'student', patch(body))).status, 503, 'hosted targets cannot enable rehearsal');
    // The paper lookup itself would now be pointed away from the synthetic DB.
    process.env.VITE_SUPABASE_URL = originalUrl;
    assert.deepEqual(await paperProtocol(), { version: 1 }, 'local switch does not convert a stored legacy attempt');
    cbtPaperProtocol = 'v2';
    recorded.length = 0;
    const v2Paper = await call(paperPath, 'student');
    assert.deepEqual(v2Paper.body.protocol, { version: 2, scope: 'local-rehearsal' });
    assert.equal(v2Paper.body.questions[0].subject, 'Test');
    assert.deepEqual(v2Paper.body.questions[0].options, ['A', 'B', 'C', 'D']);
    assert.ok(!recorded.includes('RPC get_cbt_attempt_paper'), 'v2 does not call the fenced legacy reader');
    const questionQuery = recorded.find(entry => entry.startsWith('GET exam_questions')) || '';
    assert.match(questionQuery, /exam_id=eq\.test-exam/);
    assert.match(questionQuery, /review=neq\.rejected/);
    assert.doesNotMatch(questionQuery, /active=eq\.true/, 'a deactivated bank does not replace or invalidate an existing frozen paper');
    assert.ok(!/correct_option|explanation/.test(questionQuery), 'question query never requests answer keys');
    cbtQuestionsMissing = true;
    assert.equal((await call(paperPath, 'student')).status, 409, 'missing or unavailable frozen question fails closed');
    cbtQuestionsMissing = false;
    for (const ids of [['not-a-uuid'], [question, question.toUpperCase()], []]) {
      cbtPaperQuestionIds = ids; recorded.length = 0;
      assert.equal((await call(paperPath, 'student')).status, 409, 'malformed, duplicate or empty frozen IDs fail closed');
      assert.ok(!recorded.some(entry => entry.startsWith('GET exam_questions')));
    }
    cbtPaperQuestionIds = [question];
    cbtProtocolColumnMissing = true; recorded.length = 0;
    assert.equal((await call(paperPath, 'student')).status, 503, 'missing protocol column must not imply legacy');
    assert.ok(!recorded.includes('RPC get_cbt_attempt_paper'));
    cbtProtocolColumnMissing = false;
    for (const status of ['submitted', 'cancelled', 'invalid']) {
      cbtPaperStatus = status; recorded.length = 0;
      assert.equal((await call(paperPath, 'student')).status, 409, `${status} cannot open a writing paper`);
      assert.ok(!recorded.some(entry => entry.startsWith('GET exam_questions')));
    }
    cbtPaperStatus = 'expired';
    assert.equal((await call(paperPath, 'student')).status, 200, 'expired paper remains available to review local intent');
    cbtPaperStatus = 'in_progress';
    assert.equal((await call('/api/cbt/attempts/not-a-uuid/paper', 'student')).status, 400);
    process.env.CBT_V2_LOCAL_REHEARSAL = '';
    recorded.length = 0;
    assert.equal((await call('/api/cbt/attempts/not-a-uuid/paper', 'student')).status, 400, 'invalid IDs fail validation even with rehearsal disabled');
    assert.equal((await call(paperPath, 'student')).status, 503, 'v2 cannot open when rehearsal is disabled');
    assert.ok(!recorded.includes('RPC get_cbt_attempt_paper'), 'v2 never calls the legacy paper RPC');
    process.env.CBT_V2_LOCAL_REHEARSAL = '1';
    cbtPaperProtocol = null;
    assert.equal((await call(paperPath, 'student')).status, 503, 'unknown protocol fails closed');
    cbtPaperProtocol = 'legacy';
    delete process.env.CBT_V2_LOCAL_REHEARSAL;
    assert.deepEqual(await paperProtocol(), { version: 1 });
    process.env.CBT_V2_LOCAL_REHEARSAL = '1';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'synthetic-publishable-key';
    assert.equal((await call(`/api/cbt/v2/attempts/${id}/state`, 'student')).status, 409, 'local state must refuse a stored legacy protocol');
    cbtPaperProtocol = 'v2';
    recorded.length = 0;
    assert.equal((await call(endpoint, undefined, patch(body))).status, 401);
    assert.equal((await call(endpoint, 'student', patch({ ...body, protocol: 1 }))).status, 400);
    assert.equal((await call(endpoint, 'student', patch({ ...body, selected: 8 }))).status, 400);
    assert.equal((await call(endpoint, 'student', patch({ ...body, expectedRevision: -1 }))).status, 400);
    assert.equal((await call(endpoint, 'student', patch({ ...body, sessionId: null }))).status, 400);
    assert.equal((await call(endpoint, 'student', patch({ ...body, sessionGeneration: 0 }))).status, 400);
    assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_v2_answer_gateway')));
    cbtV2Outcome = 'accepted';
    const accepted = await call(endpoint, 'student', patch({ ...body, userId: 'hostile-other-user' }));
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.outcome, 'accepted');
    const rpc = recorded.find(entry => entry.startsWith('RPC cbt_v2_answer_gateway')) || '';
    assert.match(rpc, /auth=Bearer token-student/);
    assert.match(rpc, /p_session/);
    assert.match(rpc, /p_generation/);
    assert.doesNotMatch(rpc, /p_expected_user|user-student/, 'database derives identity from the forwarded token');
    assert.doesNotMatch(rpc, /hostile-other-user/);
    const finalize = `/api/cbt/v2/attempts/${id}/finalize`;
    assert.equal((await call(finalize, undefined, { method: 'POST' })).status, 401);
    assert.equal((await call(finalize, 'student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: 2, expectedRevision: 1, operationKey: key, recovery_complete: true }) })).status, 503);
    assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_candidate_finalize')));
    cbtV2Outcome = 'conflict';
    const conflict = await call(endpoint, 'student', patch(body));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.outcome, 'conflict');
    assert.deepEqual(conflict.body.answers, { '1': 0 });
    cbtV2Outcome = 'protocol-mismatch';
    assert.equal((await call(endpoint, 'student', patch(body))).status, 409);
    cbtV2Outcome = 'revoked';
    const revoked = await call(endpoint, 'student', patch(body));
    assert.equal(revoked.status, 409);
    assert.equal(revoked.body.code, 'CBT_SESSION_REVOKED');
    assert.match(revoked.body.error, /pending answers remain/);
    cbtV2Outcome = 'not-active';
    const closed = await call(endpoint, 'student', patch(body));
    assert.equal(closed.status, 409);
    assert.equal(closed.body.outcome, 'closed');
    const sessionEndpoint = `/api/cbt/v2/attempts/${id}/session`;
    const post = (value: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const sessionBody = { protocol: 2, requestKey: key, takeover: false };
    assert.equal((await call(sessionEndpoint, undefined, post(sessionBody))).status, 401);
    assert.equal((await call(sessionEndpoint, 'student', post({ ...sessionBody, takeover: 'true' }))).status, 400);
    cbtSessionOutcome = 'created';
    assert.equal((await call(sessionEndpoint, 'student', post(sessionBody))).status, 200);
    assert.match(recorded.find(entry => entry.startsWith('RPC cbt_v2_session_gateway')) || '', /auth=Bearer token-student/);
    cbtSessionOutcome = 'takeover_required';
    assert.equal((await call(sessionEndpoint, 'student', post(sessionBody))).status, 409);
    cbtSessionOutcome = 'malformed';
    assert.equal((await call(sessionEndpoint, 'student', post(sessionBody))).status, 503);
    cbtSessionOutcome = 'not-found';
    assert.equal((await call(sessionEndpoint, 'student', post(sessionBody))).status, 404);
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    recorded.length = 0;
    assert.equal((await call(endpoint, 'student', patch(body))).status, 503);
    assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_v2_answer_gateway')), 'no fallback to privileged role');
  } finally {
    cbtV2Outcome = 'accepted';
    cbtSessionOutcome = 'created';
    cbtPaperFixture = 'missing';
    cbtPaperProtocol = 'legacy';
    cbtPaperStatus = 'in_progress';
    cbtQuestionsMissing = false;
    cbtProtocolColumnMissing = false;
    cbtPaperQuestionIds = ['b1111111-1111-4111-8111-111111111111'];
    for (const [name, value] of Object.entries({ NODE_ENV: previous.node, NETLIFY: previous.netlify, CBT_V2_LOCAL_REHEARSAL: previous.flag, VITE_SUPABASE_PUBLISHABLE_KEY: previous.key, VITE_SUPABASE_URL: previous.url })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('v2 writing, state and paper refuse a bank the caller is not authorized for', async () => {
  const attempt = 'a1111111-1111-4111-8111-111111111111';
  const key = 'c1111111-1111-4111-8111-111111111111';
  const previous = { flag: process.env.CBT_V2_LOCAL_REHEARSAL, node: process.env.NODE_ENV, netlify: process.env.NETLIFY, url: process.env.VITE_SUPABASE_URL, protocol: cbtPaperProtocol, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  try {
    process.env.CBT_V2_LOCAL_REHEARSAL = '1';
    process.env.NODE_ENV = 'test';
    process.env.NETLIFY = '';
    // Keep the real synthetic backend URL: rehearsal only needs a loopback host.
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'synthetic-publishable-key';
    cbtPaperProtocol = 'v2';
    cbtPaperFixture = 'ok';
    cbtBankAccess = false;
    for (const [path, init] of [
      [`/api/cbt/v2/attempts/${attempt}/state`, undefined],
      [`/api/cbt/attempts/${attempt}/paper`, undefined],
      [`/api/cbt/v2/attempts/${attempt}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: 2, requestKey: key, takeover: false }) }],
    ] as const) {
      recorded.length = 0;
      const response = await call(path, 'student', init);
      assert.equal(response.status, 404, `${path} must deny an unassigned or unclassified bank`);
      assert.ok(!recorded.some(entry => entry.startsWith('GET exam_questions')), `${path} must not read restricted questions`);
      assert.ok(!recorded.some(entry => entry.startsWith('RPC cbt_v2_session_gateway')), `${path} must not reach the writing gateway`);
    }
    cbtBankAccess = true;
    assert.equal((await call(`/api/cbt/attempts/${attempt}/paper`, 'student')).status, 200);
  } finally {
    cbtBankAccess = true;
    cbtPaperProtocol = previous.protocol;
    cbtPaperFixture = 'missing';
    for (const [name, value] of Object.entries({ CBT_V2_LOCAL_REHEARSAL: previous.flag, NODE_ENV: previous.node, NETLIFY: previous.netlify, VITE_SUPABASE_URL: previous.url, VITE_SUPABASE_PUBLISHABLE_KEY: previous.key })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('staff user activity withholds scores from banks that are not public', async () => {
  // cbt_attempts rows here are read with the service role, so the bank policy
  // must be applied explicitly rather than relying on attempt RLS.
  const original = cbtAttemptRows;
  cbtAttemptRows = [
    { id: 'attempt-public', exam_id: 'exam-public', status: 'submitted', score: 100, started_at: null, submitted_at: null, cbt_exams: { title: 'Public' } },
    { id: 'attempt-restricted', exam_id: 'exam-restricted', status: 'submitted', score: 100, started_at: null, submitted_at: null, cbt_exams: { title: 'Restricted' } },
  ];
  try {
    cbtPublicExamIds = new Set(['exam-public']);
    recorded.length = 0;
    const response = await call('/api/admin/users/user-student/activity', 'super_admin');
    assert.equal(response.status, 200);
    const byId = new Map((response.body.attempts as Array<{ id: string; score: number | null }>).map((row) => [row.id, row]));
    assert.equal(byId.get('attempt-public')?.score, 100);
    assert.equal(byId.get('attempt-restricted')?.score, null);
    assert.ok(!JSON.stringify(response.body).includes('"exam-restricted","score":100'));
  } finally { cbtAttemptRows = original; cbtPublicExamIds = new Set(); }
});

test('generic bulk question imports cannot bypass the review workflow', async () => {
  recorded.length = 0;
  const response = await call('/api/admin/content-manager/import/exam_questions', 'super_admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [{ question_text: 'Synthetic' }] }),
  });
  assert.equal(response.status,409);
  assert.match(response.body.error,/review workflow/i);
  assert.ok(!recorded.some(entry => entry.startsWith('POST exam_questions')));
});

test('a student token cannot publish, delete or import through any admin route', async () => {
  const attempts: Array<[string, string]> = [
    ['/api/admin/news/article-1', 'DELETE'],
    ['/api/admin/newsroom/candidates/candidate-1/approve', 'POST'],
    ['/api/admin/content-manager/import/institutions', 'POST'],
    ['/api/admin/cbt/exams', 'POST'],
  ];
  for (const [path, method] of attempts) {
    const response = await call(path, 'student', { method });
    assert.equal(response.status, 403, `${method} ${path} must refuse a student`);
  }
});

// ---------------------------------------------------------------------------
// route coverage: no privileged route may exist without a declared capability
// ---------------------------------------------------------------------------

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle?: { capabilities?: readonly Capability[] } }> };
}

const STAFF_ONLY_ROUTES = new Set(['/api/admin/session', '/api/admin/session/verify']);
const PUBLIC_BY_DESIGN = new Set(['/api/admin/bootstrap']);

test('every privileged route declares a capability from the vocabulary', () => {
  const stack = (app as unknown as { _router: { stack: RouteLayer[] } })._router.stack;
  const adminRoutes = stack.filter((layer) => layer.route?.path.startsWith('/api/admin/'));

  assert.ok(adminRoutes.length > 40, `expected the full admin surface, found ${adminRoutes.length}`);

  for (const layer of adminRoutes) {
    const route = layer.route!;
    if (PUBLIC_BY_DESIGN.has(route.path)) continue;

    const capabilities = route.stack.flatMap((handler) => handler.handle?.capabilities || []);
    if (STAFF_ONLY_ROUTES.has(route.path)) {
      assert.equal(capabilities.length, 0, `${route.path} is a staff-only surface and must not require a specific capability`);
      continue;
    }

    assert.ok(capabilities.length > 0, `${route.path} has no capability check`);
    for (const capability of capabilities) {
      assert.ok((CAPABILITIES as readonly string[]).includes(capability), `${route.path} declares unknown ${capability}`);
    }
  }
});

test('critical routes carry the capability the documentation claims', () => {
  const stack = (app as unknown as { _router: { stack: RouteLayer[] } })._router.stack;
  const declared = (method: string, path: string) => {
    const layer = stack.find((item) => item.route?.path === path && item.route.methods[method.toLowerCase()]);
    assert.ok(layer, `${method} ${path} is not registered`);
    return layer!.route!.stack.flatMap((handler) => handler.handle?.capabilities || []);
  };

  assert.deepEqual(declared('PATCH', '/api/admin/news/:articleId'), ['news.update']);
  assert.deepEqual(declared('DELETE', '/api/admin/news/:articleId'), ['news.delete']);
  assert.deepEqual(declared('PATCH', '/api/admin/service-requests/:requestId'), ['service_request.process']);
  assert.deepEqual(declared('POST', '/api/admin/users/:userId/ban'), ['user.suspend']);
  assert.deepEqual(declared('POST', '/api/admin/users/:userId/role'), ['user.manage_roles']);
  assert.deepEqual(declared('GET', '/api/admin/integrity'), ['data.read']);
  assert.deepEqual(declared('POST', '/api/admin/newsroom/candidates/:candidateId/approve'), ['news.publish']);
  assert.deepEqual(declared('POST', '/api/admin/content-manager/import/:resource'), ['data.import']);
  assert.deepEqual(declared('POST', '/api/admin/question-imports'), ['cbt.manage']);
  assert.deepEqual(declared('PATCH', '/api/admin/question-imports/:importId'), ['cbt.manage']);
  assert.deepEqual(declared('POST', '/api/admin/question-imports/:importId/commit'), ['cbt.manage']);
});

test('the import console and its API are gated by the same write capability', () => {
  // The console used to require cbt.read while every API route required
  // cbt.manage. A staff role with only read access would have opened a page
  // whose buttons all returned 403.
  assert.equal(capabilityForAdminPath('/admin/question-imports'), 'cbt.manage');
  assert.equal(capabilityForAdminPath('/admin/question-imports/abc'), 'cbt.manage');

  for (const role of ['content_editor', 'super_admin'] as const) {
    assert.equal(hasCapability({ role }, 'cbt.manage'), true, `${role} must be able to review imports`);
  }
});

// ---------------------------------------------------------------------------
// migration
// ---------------------------------------------------------------------------

test('the role migration normalises the vocabulary and retires the half-roles', () => {
  const sql = readFileSync('supabase/migrations/20260930140000_capability_role_alignment.sql', 'utf8');

  // The retired values stay legal in the constraint, and no statement rewrites
  // a row that holds one: demoting a real person is an operator decision.
  assert.match(sql, /check \(role in \('student', 'content_editor', 'service_admin', 'super_admin', 'senate_admin', 'campus_agent'\)\)/);
  assert.match(sql, /update public\.profiles set role = 'super_admin' where role in \('admin', 'moderator'\)/);
  assert.equal(
    /update public\.profiles set role = 'student' where role in \('senate_admin'/.test(sql),
    false,
    'the migration must not rewrite retired-role rows',
  );
  assert.match(sql, /raise warning 'ROLE-1: % account\(s\) still hold a retired role/);

  // The staff predicate must not grant anything to the retired roles...
  const staffPredicate = /p\.role in \(([^)]*)\)/g;
  const lists = [...sql.matchAll(staffPredicate)].map((match) => match[1]);
  assert.ok(lists.length >= 2, 'the staff predicate and the policy must both list roles');
  for (const list of lists) {
    assert.equal(list.includes('senate_admin'), false, 'the retired roles must not appear in a staff predicate');
    assert.equal(list.includes('campus_agent'), false);
    assert.ok(list.includes('content_editor') && list.includes('service_admin'), 'the staff predicate must carry the application roles');
  }

  // Guarded and idempotent: safe on a project without the base tables.
  assert.match(sql, /if to_regclass\('public\.profiles'\) is null then/);
  assert.match(sql, /drop policy if exists student_notifications_staff_insert/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
});
