import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Exercises actual Express service-role handlers against a synthetic PostgREST
// adapter. It does not replace the local PostgreSQL role tests.
const ids = ['public', 'restricted', 'unclassified', 'policy-error'];
const exams = ids.map(id => ({ id, title: `Synthetic ${id}`, exam_body: 'WAEC', duration_minutes: 30, subject: 'Math', is_active: true }));
const question = { id:'q1', exam_id:'public', position:1, subject:'Math', question_text:'Synthetic', option_a:'A', option_b:'B', option_c:'C', option_d:'D', correct_option:'B', explanation:'Synthetic explanation' };
let questionReads = 0;
const stub = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const filter = (key:string) => (url.searchParams.get(key) || '').replace(/^eq\./, '');
  res.setHeader('Content-Type','application/json');
  if (url.pathname === '/rest/v1/cbt_exams') {
    const id = filter('id');
    return res.end(JSON.stringify(id ? exams.filter(exam => exam.id === id) : exams));
  }
  if (url.pathname === '/rest/v1/cbt_bank_security') {
    const id = (url.searchParams.get('exam_id') || '').startsWith('eq.') ? filter('exam_id') : '';
    if (id === 'policy-error') { res.statusCode = 400; return res.end('{"message":"synthetic policy failure"}'); }
    if (!id) return res.end(JSON.stringify([{exam_id:'public'}]));
    const visibility = id === 'public' ? 'public' : id === 'restricted' ? 'restricted' : null;
    return res.end(JSON.stringify(visibility ? [{visibility}] : []));
  }
  if (url.pathname === '/rest/v1/exam_questions') {
    questionReads++;
    return res.end(JSON.stringify([question]));
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return res.end('true');
  res.statusCode = 404; return res.end('{}');
});
stub.listen(0,'127.0.0.1'); await once(stub,'listening');
const stubAddress = stub.address(); if (!stubAddress || typeof stubAddress === 'string') throw new Error('No stub port');
Object.assign(process.env, { NETLIFY:'true', NODE_ENV:'production', VITE_SUPABASE_URL:`http://127.0.0.1:${stubAddress.port}`, SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic_guest_test', SUPABASE_SECRET_KEY:'' });
const { app } = await import('../server');
const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;
after(() => Promise.all([new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())),new Promise<void>((resolve,reject) => stub.close(error => error ? reject(error) : resolve()))]));

test('classified public guest paper and corrections remain available', async () => {
  const paper = await fetch(`${base}/api/cbt/exams/public/guest-questions`);
  assert.equal(paper.status,200); assert.equal((await paper.json() as any).questions.length,1);
  const submit = await fetch(`${base}/api/cbt/guest-submit`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({examId:'public',answers:{'1':1}}) });
  assert.equal(submit.status,200);
  const body = await submit.json() as any;
  assert.equal(body.score,100); assert.equal(body.questions[0].correct_option,'B');
});

test('restricted and unclassified guest requests never read service-role questions', async () => {
  for (const id of ['restricted','unclassified']) {
    const before = questionReads;
    const paper = await fetch(`${base}/api/cbt/exams/${id}/guest-questions`);
    assert.equal(paper.status,404);
    const submit = await fetch(`${base}/api/cbt/guest-submit`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({examId:id,answers:{'1':0}})});
    assert.equal(submit.status,404);
    assert.equal(questionReads,before);
    assert.doesNotMatch(JSON.stringify(await submit.json()),/Synthetic explanation|correct_option|score/);
  }
});

test('policy outage fails closed before reading questions', async () => {
  const before = questionReads;
  const paper = await fetch(`${base}/api/cbt/exams/policy-error/guest-questions`);
  const submit = await fetch(`${base}/api/cbt/guest-submit`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({examId:'policy-error',answers:{'1':0}})});
  assert.equal(paper.status,503); assert.equal(submit.status,503); assert.equal(questionReads,before);
});

test('anonymous catalogue exposes only explicitly public banks', async () => {
  const response = await fetch(`${base}/api/cbt/exams`);
  assert.equal(response.status,200);
  const body = await response.json() as any;
  assert.deepEqual(body.items.map((row:any) => row.id),['public']);
});
