// Disposable PostgreSQL + synthetic Auth/PostgREST bridge + actual Express
// v2 handlers. Not Supabase Auth/RLS/PostgREST or hosted integration evidence.
// node --import tsx scripts/rehearse-cbt-v2-http.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-v2-http-'));
const port = await new Promise((ok, fail) => {
  const s = net.createServer(); s.once('error', fail); s.listen(0, '127.0.0.1', () => { const a = s.address(); if (!a || typeof a === 'string') return fail(new Error('No port')); s.close(() => ok(a.port)); });
});
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const student = 'a1111111-1111-4111-8111-111111111111', other = 'b1111111-1111-4111-8111-111111111111';
const exam = 'c1111111-1111-4111-8111-111111111111', attempt = 'd1111111-1111-4111-8111-111111111111';
const q1 = 'e1111111-1111-4111-8111-111111111111', q2 = 'e2222222-2222-4222-8222-222222222222';
const key1 = 'f1111111-1111-4111-8111-111111111111', key2 = 'f2222222-2222-4222-8222-222222222222', key3 = 'f3333333-3333-4333-8333-333333333333';
const clients = []; let started = false, bridgeServer, appServer;
try {
  await pg.initialise(); await pg.start(); started = true;
  const db = pg.getPgClient(); await db.connect(); clients.push(db);
  await db.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const files = (await readdir(join(root, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) await db.query(await readFile(join(root, 'supabase/migrations', file), 'utf8'));
  await db.query(await readFile(join(root, 'supabase/candidates/cbt_revision_protocol.sql'), 'utf8'));
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'a@synthetic.test','{}'),($2,'b@synthetic.test','{}')", [student, other]);
  await db.query("insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Mathematics','test',30,true)", [exam]);
  for (const [id, pos] of [[q1, 1], [q2, 2]]) await db.query("insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,$2,'Mathematics','Synthetic','A','B','C','D','A',1,$3)", [id, exam, pos]);
  await db.query("insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft) values ($1,$2,$3,'in_progress',clock_timestamp()+interval '30 minutes',2,array[$4::uuid,$5::uuid],'{}')", [attempt, student, exam, q1, q2]);
  const bridge = express(); bridge.use(express.json());
  const identity = req => req.header('authorization') === 'Bearer synthetic-student' ? student : req.header('authorization') === 'Bearer synthetic-other' ? other : null;
  bridge.get('/auth/v1/user', (req, res) => {
    const id = identity(req); return id ? res.json({ id, aud: 'authenticated', email: 'synthetic@example.test', user_metadata: {} }) : res.status(401).json({ message: 'Invalid token' });
  });
  bridge.get('/rest/v1/profiles', (_req, res) => res.json({ role: 'student', full_name: 'Synthetic' }));
  bridge.get('/rest/v1/cbt_attempts', async (req, res) => {
    const id = String(req.query.id || '').replace(/^eq\./, ''), owner = String(req.query.user_id || '').replace(/^eq\./, '');
    const row = (await db.query('select id,user_id,status,answers_draft,candidate_answer_revision,question_ids from public.cbt_attempts where id=$1 and user_id=$2', [id, owner])).rows[0];
    return res.json(row || null);
  });
  bridge.post('/rest/v1/rpc/:name', async (req, res) => {
    const id = identity(req); if (!id) return res.status(401).json({ message: 'Invalid token' });
    const client = pg.getPgClient(); await client.connect(); clients.push(client);
    try {
      await client.query('begin'); await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      const p = req.body; let result;
      if (req.params.name === 'cbt_candidate_answer') result = await client.query('select public.cbt_candidate_answer($1,$2,$3,$4,$5,$6) as result', [p.p_attempt,p.p_question,p.p_selected,p.p_expected_revision,p.p_operation_key,p.p_expected_user]);
      else if (req.params.name === 'cbt_candidate_finalize') result = await client.query('select public.cbt_candidate_finalize($1,$2,$3,$4) as result', [p.p_attempt,p.p_expected_revision,p.p_operation_key,p.p_expected_user]);
      else throw new Error('Unexpected synthetic RPC');
      await client.query('commit'); return res.json(result.rows[0].result);
    } catch (err) {
      await client.query('rollback'); return res.status(400).json({ code: err.code, message: err.message });
    }
  });
  bridgeServer = bridge.listen(0, '127.0.0.1'); await once(bridgeServer, 'listening');
  process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${bridgeServer.address().port}`;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'synthetic-publishable';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_synthetic-only';
  process.env.NODE_ENV = 'test'; process.env.CBT_V2_LOCAL_REHEARSAL = '1'; process.env.CBT_V2_TEST_IMPORT = '1'; delete process.env.NETLIFY;
  const { app } = await import('../server.ts');
  appServer = app.listen(0, '127.0.0.1'); await once(appServer, 'listening');
  const base = `http://127.0.0.1:${appServer.address().port}/api/cbt/v2/attempts/${attempt}`;
  async function request(path, token, method, body) {
    const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const payload = (q, selected, revision, key) => ({ protocol: 2, questionId: q, selected, expectedRevision: revision, operationKey: key });
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    // Two real browser pages issue competing HTTP writes to the actual server
    // and database. This is NOT the CBT session UI and does not prove its queue.
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
    try {
      const context = await browser.newContext();
      const p1 = await context.newPage(), p2 = await context.newPage();
      const health = `http://127.0.0.1:${appServer.address().port}/api/health`;
      await Promise.all([p1.goto(health), p2.goto(health)]);
      const send = (page, body) => page.evaluate(async ({ url, payload }) => {
        const r = await fetch(url, { method: 'PATCH', headers: { authorization: 'Bearer synthetic-student', 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        return { status: r.status, body: await r.json() };
      }, { url: `${base}/answer`, payload: body });
      const outcomes = await Promise.all([send(p1, payload(q1, 0, 0, key1)), send(p2, payload(q2, 0, 0, key2))]);
      assert.deepEqual(outcomes.map(x => x.status).sort(), [200, 409]);
      assert.deepEqual(outcomes.map(x => x.body.outcome).sort(), ['accepted', 'conflict']);
      const dbState = (await db.query('select candidate_answer_revision,answers_draft from public.cbt_attempts where id=$1', [attempt])).rows[0];
      assert.equal(Number(dbState.candidate_answer_revision), 1);
      assert.equal(Object.keys(dbState.answers_draft).length, 1);
      console.log('PASS two browser pages competing through real HTTP and disposable PostgreSQL: one accepted, one conflict (not session UI).');
    } finally { await browser.close(); }
    // Reset synthetic fixture only, for the independent HTTP retry checks below.
    await db.query('delete from public.cbt_candidate_operations where attempt_id=$1', [attempt]);
    await db.query("update public.cbt_attempts set answers_draft='{}',candidate_answer_revision=0 where id=$1", [attempt]);
  }
  assert.equal((await request('/state', 'synthetic-other', 'GET')).status, 404);
  const initial = await request('/state', 'synthetic-student', 'GET'); assert.equal(initial.body.revision, 0);
  assert.deepEqual(initial.body.questionIds, [q1, q2], 'state exposes the authoritative frozen order');
  const first = await request('/answer', 'synthetic-student', 'PATCH', payload(q1, 0, 0, key1)); assert.equal(first.body.outcome, 'accepted');
  const stale = await request('/answer', 'synthetic-student', 'PATCH', payload(q2, 0, 0, key2)); assert.equal(stale.status, 409); assert.equal(stale.body.outcome, 'conflict');
  const second = await request('/answer', 'synthetic-student', 'PATCH', payload(q2, 0, 1, key3)); assert.equal(second.body.outcome, 'accepted');
  const retry = await request('/answer', 'synthetic-student', 'PATCH', payload(q1, 0, 0, key1)); assert.equal(retry.body.outcome, 'replayed'); assert.equal(retry.body.revision, 2); assert.deepEqual(retry.body.answers, { '1': 0, '2': 0 });
  const finalize = { protocol: 2, expectedRevision: 2, operationKey: 'f4444444-4444-4444-8444-444444444444' };
  const submitted = await request('/finalize', 'synthetic-student', 'POST', finalize); assert.equal(submitted.body.outcome, 'submitted'); assert.equal(submitted.body.result.correct_answers, 2);
  const again = await request('/finalize', 'synthetic-student', 'POST', finalize); assert.equal(again.body.outcome, 'replayed'); assert.deepEqual(again.body.result, submitted.body.result);
  const late = await request('/answer', 'synthetic-student', 'PATCH', payload(q1, 3, 2, 'f5555555-5555-4555-8555-555555555555')); assert.equal(late.body.outcome, 'closed');
  console.log(`PASS real Express v2 handlers + disposable PostgreSQL (${files.length} migrations): owner isolation, revision conflict, retry, accepted-draft scoring, finalize replay and closed write.`);
  console.log('Auth and PostgREST are synthetic; candidate remains local-only and current frontend/legacy writers are not integrated.');
} finally {
  if (appServer) await new Promise(resolve => appServer.close(resolve));
  if (bridgeServer) await new Promise(resolve => bridgeServer.close(resolve));
  await Promise.allSettled(clients.map(c => c.end()));
  if (started) await pg.stop(); await rm(dir, { recursive: true, force: true });
}
