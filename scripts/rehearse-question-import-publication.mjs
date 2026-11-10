// Disposable local PostgreSQL only. Auth/PostgREST are synthetic platform shims.
// Usage: env -i PATH="$PATH" HOME="$HOME" node scripts/rehearse-question-import-publication.mjs /absolute/path/to/embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-import-publication-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Private Linux socket directory required.');
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port: 5432, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '', '-k', dir], onLog: () => {}, onError: () => {} });
const clients = []; let started = false;
try {
  await pg.initialise(); await pg.start(); started = true;
  for (let i = 0; i < 3; i++) {
    const client = pg.getPgClient('postgres', dir); await client.connect(); clients.push(client);
    const identity = (await client.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
    assertDisposableDatabase(identity, join(dir, 'db'), dir);
  }
  const [admin, a, b] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrations = join(root, 'supabase/migrations');
  const files = (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files.at(-1), '20261108120000_question_import_atomic_publication.sql');
  for (const file of files) await admin.query(await readFile(join(migrations, file), 'utf8'));
  const exam = randomUUID();
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Import test','WAEC','Mathematics',30,true)", [exam]);
  const makeImport = async () => {
    const id = randomUUID();
    await admin.query("insert into public.question_imports(id,exam_id,exam_body,subject,original_filename,mime_type,file_bytes,checksum,storage_path,status) values ($1,$2,'WAEC','Mathematics','fixture.txt','text/plain',1,$3,$4,'extracted')", [id, exam, randomBytes(32).toString('hex'), id]);
    return id;
  };
  const makeItem = async (importId, index, text, answer = 'A', status = 'approved') => (await admin.query("insert into public.question_import_items(import_id,source_index,question_text,option_a,option_b,option_c,option_d,correct_option,review_status) values ($1,$2,$3,'One','Two','Three','Four',$4,$5) returning id, updated_at::text as version", [importId,index,text,answer,status])).rows[0];
  const publish = (client, id) => client.query('select public.commit_question_import($1) as result', [id]).then(r => r.rows[0].result);
  const count = async id => (await admin.query('select count(*)::int as n from public.exam_questions where import_id=$1',[id])).rows[0].n;
  const privileges = (await admin.query("select has_function_privilege('anon','public.commit_question_import(uuid)','execute') as anon, has_function_privilege('authenticated','public.commit_question_import(uuid)','execute') as authenticated, has_function_privilege('service_role','public.commit_question_import(uuid)','execute') as service, has_function_privilege('anon','public.question_import_atomic_ready()','execute') as marker_anon, has_table_privilege('authenticated','public.question_import_items','select') as items_auth")).rows[0];
  assert.deepEqual(privileges, {anon:false, authenticated:false, service:true, marker_anon:false, items_auth:false});
  await a.query('set role anon'); await assert.rejects(publish(a, randomUUID()), /permission denied/i); await a.query('reset role');
  await a.query('set role authenticated'); await assert.rejects(publish(a, randomUUID()), /permission denied/i); await a.query('reset role');
  await a.query('set role service_role'); assert.equal((await a.query('select public.question_import_atomic_ready() as ready')).rows[0].ready, true); await a.query('reset role');
  console.log('ok SQL roles, service-only readiness and publication');

  const invalid = await makeImport();
  await makeItem(invalid,1,'A perfectly valid question'); await makeItem(invalid,2,'A question with no answer',null);
  await assert.rejects(publish(a,invalid), /invalid or incomplete/i); assert.equal(await count(invalid),0);
  await admin.query("update public.question_import_items set correct_option='E' where import_id=$1 and source_index=2",[invalid]);
  await assert.rejects(publish(a,invalid), /invalid or incomplete/i); assert.equal(await count(invalid),0);
  await admin.query("update public.question_import_items set correct_option='A', option_b=' ONE  ' where import_id=$1 and source_index=2",[invalid]);
  await assert.rejects(publish(a,invalid), /invalid or incomplete/i); assert.equal(await count(invalid),0);
  assert.equal((await admin.query("select count(*)::int as n from public.question_import_items where import_id=$1 and review_status='approved'", [invalid])).rows[0].n,2);
  console.log('ok invalid batch rolls back without publication or state changes');

  const same = await makeImport(); await makeItem(same,1,'Concurrent same import question');
  const retryRace = await Promise.all([publish(a,same),publish(b,same)]);
  assert.deepEqual(retryRace.map(r=>r.inserted).sort(),[0,1]); assert.equal(await count(same),1);
  assert.equal((await publish(a,same)).inserted,0);
  const left=await makeImport(), right=await makeImport();
  await makeItem(left,1,'Concurrent duplicate   question'); await makeItem(right,1,' concurrent duplicate question ');
  const bankRace=await Promise.all([publish(a,left),publish(b,right)]);
  assert.equal(bankRace.reduce((n,r)=>n+r.inserted,0),1); assert.equal(bankRace.reduce((n,r)=>n+r.duplicates,0),1);
  const positions=(await admin.query('select position from public.exam_questions where exam_id=$1 order by position',[exam])).rows.map(r=>r.position);
  assert.equal(new Set(positions).size,positions.length);
  console.log('ok concurrent retries, bank lock, unique positions and whitespace-normalized duplicates');

  const stale=await makeImport(); const staged=await makeItem(stale,1,'Stale review transaction question');
  await a.query('begin'); await publish(a,stale);
  const pending = b.query("update public.question_import_items set review_status='rejected', updated_at=clock_timestamp() where id=$1 and review_status='approved' and updated_at=$2::timestamptz returning id",[staged.id,staged.version]);
  // Confirm the update really waits on the publication transaction before release.
  const blocked=await admin.query("select count(*)::int as n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[b.processID]);
  // Scheduling of independent connections is asynchronous; a locking assertion is
  // made deterministically by checking pg_blocking_pids after an advisory barrier.
  if (!blocked.rows[0].n) await admin.query('select pg_sleep(0.05)');
  assert.ok((await admin.query('select cardinality(pg_blocking_pids($1)) as n',[b.processID])).rows[0].n > 0);
  await a.query('commit'); assert.equal((await pending).rowCount,0);
  assert.equal((await admin.query('select review_status from public.question_import_items where id=$1',[staged.id])).rows[0].review_status,'imported');
  console.log('ok locked publication defeats stale conditional rejection');

  const approval = await makeImport(); const pendingItem = await makeItem(approval,1,'Competing approval transaction question','A','pending');
  const approve = client => client.query("update public.question_import_items set review_status='approved', updated_at=clock_timestamp() where id=$1 and review_status='pending' and updated_at=$2::timestamptz returning id", [pendingItem.id,pendingItem.version]);
  const approvals = await Promise.all([approve(a),approve(b)]);
  assert.deepEqual(approvals.map(result => result.rowCount).sort(),[0,1]);
  assert.equal((await publish(a,approval)).inserted,1);
  console.log('ok concurrent conditional approvals have one winner');
  console.log(`ok ${files.length} migrations replayed on disposable PostgreSQL`);
} finally {
  for (const client of clients) await client.end().catch(() => {});
  if (started) await pg.stop();
  await rm(dir, { recursive:true, force:true });
}
