// Optional isolated multi-session rehearsal. No hosted project is contacted.
// Usage: node scripts/rehearse-service-idempotency-races.mjs /path/to/node_modules/embedded-postgres/dist/index.js
// The separately installed tool supplies a disposable local PostgreSQL binary;
// it is not a project/runtime dependency. Never point this script at an existing database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-idempotency-race-'));
const port = await new Promise((resolvePort, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') return reject(new Error('Cannot reserve local port'));
    server.close(() => resolvePort(address.port));
  });
});
const instance = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const clients = [];
let started = false;
try {
  await instance.initialise();
  await instance.start();
  started = true;
  for (let i = 0; i < 3; i++) {
    const client = instance.getPgClient();
    await client.connect();
    clients.push(client);
  }
  const [admin, first, second] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrationDir = join(root, 'supabase/migrations');
  const files = (await readdir(migrationDir)).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) {
    try { await admin.query(await readFile(join(migrationDir, file), 'utf8')); }
    catch (error) { throw new Error(`Synthetic replay failed at ${file}: ${error.message}`); }
  }
  const student = 'a1111111-1111-4111-8111-111111111111';
  await admin.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,'race@synthetic.test','{}')", [student]);
  const service = (await admin.query('select service_key from public.service_catalog where active is true order by id limit 1')).rows[0]?.service_key;
  assert.ok(service);
  for (const client of [first, second]) {
    await client.query('set role authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [student]);
    await client.query("set statement_timeout = '10s'");
  }
  const invoke = (client, key, body) => client.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,false)', [service, JSON.stringify(body), key, student]);
  const secondPid = second.processID;
  async function waitForBlockedTransaction() {
    const deadline = Date.now() + 5000;
    do {
      const result = await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [secondPid]);
      if (result.rows[0]?.wait_event_type === 'Lock') return;
      await new Promise(done => setTimeout(done, 20));
    } while (Date.now() < deadline);
    throw new Error('The competing session did not block on the uncommitted transaction');
  }
  const scenarios = [
    { key: 'c1111111-1111-4111-8111-111111111111', commit: true, mismatch: false },
    { key: 'c2222222-2222-4222-8222-222222222222', commit: false, mismatch: false },
    { key: 'c3333333-3333-4333-8333-333333333333', commit: true, mismatch: true },
  ];
  for (const scenario of scenarios) {
    const original = { notes: 'synthetic race' };
    await first.query('begin');
    const a = (await invoke(first, scenario.key, original)).rows[0];
    // Attach a rejection handler immediately so mismatch does not become an
    // unhandled rejection before the first transaction is committed.
    const bResult = invoke(second, scenario.key, scenario.mismatch ? { notes: 'different' } : original)
      .then(value => ({ value }), error => ({ error }));
    await waitForBlockedTransaction();
    await first.query(scenario.commit ? 'commit' : 'rollback');
    const b = await bResult;
    if (scenario.mismatch) {
      assert.match(b.error?.message || '', /submission key.*different/i);
    } else {
      assert.ok(b.value?.rows[0]);
      assert.equal(b.value.rows[0].reference_code === a.reference_code, scenario.commit);
      assert.equal(b.value.rows[0].id === a.id, scenario.commit);
    }
    const count = await admin.query('select count(*)::int as count from public.service_requests where user_id=$1 and submission_key=$2', [student, scenario.key]);
    assert.equal(count.rows[0].count, 1, 'exactly one committed row per key');
    console.log(`ok ${scenario.commit ? 'commit' : 'rollback'}${scenario.mismatch ? ' with mismatched payload' : ''}: competing session blocked; one committed row`);
  }
  const pendingKey = 'c4444444-4444-4444-8444-444444444444';
  const pendingDetails = { notes: 'synthetic in-flight check' };
  await first.query('begin');
  const uncommitted = (await invoke(first, pendingKey, pendingDetails)).rows[0];
  const check = () => second.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,true)', [service, JSON.stringify(pendingDetails), pendingKey, student]);
  assert.equal((await check()).rows.length, 0, 'uncommitted rows remain unconfirmed and are not inserted by a check');
  await first.query('commit');
  assert.equal((await check()).rows[0].id, uncommitted.id, 'the same check can recover after commit');
  const pendingCount = await admin.query('select count(*)::int as count from public.service_requests where user_id=$1 and submission_key=$2', [student, pendingKey]);
  assert.equal(pendingCount.rows[0].count, 1);
  console.log('ok check-only: uncommitted row unconfirmed, committed row recovered, no extra insert');
  console.log(`Passed using disposable local PostgreSQL after ${files.length} synthetic migrations. Hosted Auth/PostgREST not exercised.`);
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
  if (started) await instance.stop();
  await rm(dir, { recursive: true, force: true });
}
