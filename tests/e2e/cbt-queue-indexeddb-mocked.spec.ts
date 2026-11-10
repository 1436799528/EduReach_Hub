import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import type { AnswerOperation } from '../../src/lib/cbtAnswerQueue';

// These exercise the isolated queue in real browser pages with real IndexedDB
// and Web Locks. The server is synthetic; this is NOT the CBT session UI.
const bundle = buildSync({ entryPoints: ['src/lib/cbtAnswerQueue.ts'], bundle: true, platform: 'browser', format: 'iife', globalName: 'QueueLibrary', write: false }).outputFiles[0].text;
const user = '11111111-1111-4111-8111-111111111111';
const attempt = '22222222-2222-4222-8222-222222222222';
const q1 = '33333333-3333-4333-8333-333333333333';
const q2 = '44444444-4444-4444-8444-444444444444';

test('isolated browser queue: shared IndexedDB, same and different question conflicts, reload and recovery', async ({ context }) => {
  let revision = 0;
  const answers: Record<string, number> = {};
  const ledger = new Map<string, { request: string; outcome: 'accepted' | 'conflict'; acceptedRevision: number }>();
  const legacyWrites: string[] = [];
  // Serve the test bundle from this origin; do not relax the application's CSP.
  await context.route('**/__cbt-queue-test.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  await context.route('**/api/cbt/**', async route => {
    const request = route.request();
    const url = request.url();
    if (!url.includes('/v2/')) { legacyWrites.push(url); return route.fulfill({ status: 500 }); }
    const snapshot = () => ({ protocol: 2, revision, answers: { ...answers }, status: 'in_progress', questionIds: [q1, q2] });
    if (url.endsWith('/state')) return route.fulfill({ json: snapshot() });
    const body = request.postDataJSON();
    const payload = JSON.stringify(body);
    let previous = ledger.get(body.operationKey);
    if (previous && previous.request !== payload) return route.fulfill({ status: 409 });
    let outcome: string;
    if (previous) outcome = previous.outcome === 'accepted' ? 'replayed' : 'conflict';
    else if (body.expectedRevision !== revision) {
      previous = { request: payload, outcome: 'conflict', acceptedRevision: revision };
      ledger.set(body.operationKey, previous); outcome = 'conflict';
    } else {
      const position = body.questionId === q1 ? '1' : '2';
      if (body.selected === null) delete answers[position]; else answers[position] = body.selected;
      previous = { request: payload, outcome: 'accepted', acceptedRevision: ++revision };
      ledger.set(body.operationKey, previous); outcome = 'accepted';
    }
    return route.fulfill({ status: outcome === 'conflict' ? 409 : 200, json: { ...snapshot(), outcome, ...(outcome === 'conflict' ? {} : { acceptedRevision: previous.acceptedRevision }) } });
  });
  const a = await context.newPage(), b = await context.newPage();
  async function initialize(page: typeof a) {
    await page.goto('/');
    await page.addScriptTag({ url: '/__cbt-queue-test.js' });
    await page.evaluate(({ user, attempt }) => {
      // @ts-expect-error test harness exports are dynamically loaded into the page
      const { CbtAnswerQueue, IndexedDbAnswerJournal } = window.QueueLibrary;
      const transport = {
        state: async () => (await fetch(`/api/cbt/v2/attempts/${attempt}/state`)).json(),
        answer: async (_: string, body: unknown) => (await fetch(`/api/cbt/v2/attempts/${attempt}/answer`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(),
      };
      // @ts-expect-error test harness keeps its queue on the page for evaluation
      window.testQueue = new CbtAnswerQueue({ accountId: user, attemptId: attempt }, new IndexedDbAnswerJournal(indexedDB), transport);
    }, { user, attempt });
  }
  await Promise.all([initialize(a), initialize(b)]);
  const opA = await a.evaluate(async q => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.enqueue(q, 1, 0, null, 0);
  }, q1);
  const opB = await b.evaluate(async q => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.enqueue(q, 1, 1, null, 0);
  }, q1);
  const outcomes = await Promise.all([a.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.retry(key);
  }, opA.operationKey), b.evaluate(async key => {
    try {
      // @ts-expect-error synthetic test harness
      return await window.testQueue.retry(key);
    } catch (error) {
      if (!/earlier.*pending/i.test(String(error))) throw error;
      return null; // first operation was still pending; retry it after that settles
    }
  }, opB.operationKey)]) as (AnswerOperation | null)[];
  if (!outcomes[1]) outcomes[1] = await b.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.retry(key);
  }, opB.operationKey) as AnswerOperation;
  expect(outcomes.map(row => row?.status).sort()).toEqual(['acknowledged', 'conflicted']);
  const conflicted = outcomes.find(row => row?.status === 'conflicted');
  if (!conflicted) throw new Error('Expected a conflicted operation');
  expect(conflicted.baseAnswer).toBeNull();
  expect(conflicted.lastServerAnswer).not.toBe(conflicted.selected);
  expect(conflicted.lastServerRevision).toBe(1);
  const replacement = await b.evaluate(async ({ key, revision, serverAnswer }) => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.resolve(key, 'local', revision, serverAnswer);
  }, { key: conflicted.operationKey, revision: conflicted.lastServerRevision, serverAnswer: conflicted.lastServerAnswer });
  expect(replacement.operationKey).not.toBe(conflicted.operationKey);
  await b.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    await window.testQueue.retry(key);
  }, replacement.operationKey);
  // A second race uses different questions at the same attempt-wide revision.
  const differentA = await a.evaluate(async q => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.enqueue(q, 2, 3, null, 2);
  }, q2);
  const differentB = await b.evaluate(async ({ q, base }) => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.enqueue(q, 1, 2, base, 2);
  }, { q: q1, base: conflicted.selected });
  const different = await Promise.all([a.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.retry(key);
  }, differentA.operationKey), b.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.retry(key);
  }, differentB.operationKey)]) as AnswerOperation[];
  expect(different.map(row => row.status).sort()).toEqual(['acknowledged', 'conflicted']);
  const differentConflict = different.find(row => row.status === 'conflicted');
  if (!differentConflict) throw new Error('Expected a conflicted operation');
  const differentReplacement = await b.evaluate(async ({ key, revision, serverAnswer }) => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.resolve(key, 'local', revision, serverAnswer);
  }, { key: differentConflict.operationKey, revision: differentConflict.lastServerRevision, serverAnswer: differentConflict.lastServerAnswer });
  await b.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    await window.testQueue.retry(key);
  }, differentReplacement.operationKey);
  expect(answers).toEqual({ '1': 2, '2': 3 });
  // Tab A closes while another operation remains pending; B can recover it.
  const pending = await a.evaluate(async q => {
    // @ts-expect-error synthetic test harness
    return window.testQueue.enqueue(q, 2, 1, 3, 4);
  }, q2);
  await a.close();
  await initialize(b); // reloads the page and reopens the browser journal
  const recovered = await b.evaluate(async key => {
    // @ts-expect-error synthetic test harness
    const row = (await window.testQueue.list()).find((op: { operationKey: string }) => op.operationKey === key);
    // @ts-expect-error synthetic test harness
    return { row, sent: await window.testQueue.retry(key) };
  }, pending.operationKey);
  expect(recovered.row.status).toBe('pending'); expect(recovered.sent.status).toBe('acknowledged');
  expect(answers).toEqual({ '1': 2, '2': 1 });
  const seal = await b.evaluate(async ({ user, attempt }) => {
    // @ts-expect-error dynamic browser fixture
    const { IndexedDbAnswerJournal } = window.QueueLibrary;
    const journal = new IndexedDbAnswerJournal(indexedDB);
    try { return await journal.sealSubmission({ accountId: user, attemptId: attempt }, crypto.randomUUID(), 5); }
    finally { await journal.close(); }
  }, { user, attempt });
  expect(seal.expectedRevision).toBe(5);
  expect(legacyWrites).toEqual([]);
});

test('isolated browser journal atomically seals against another tab and survives reload', async ({ context }) => {
  await context.route('**/__cbt-seal-test.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) {
    await page.goto('/');
    await page.addScriptTag({ url: '/__cbt-seal-test.js' });
  }
  const name = `seal-test-${crypto.randomUUID()}`;
  const key = crypto.randomUUID();
  const [sealed, enqueued] = await Promise.all([
    a.evaluate(async ({ name, user, attempt, key }) => {
      // @ts-expect-error dynamic browser fixture
      const { IndexedDbAnswerJournal } = window.QueueLibrary;
      const journal = new IndexedDbAnswerJournal(indexedDB, name);
      try { return { ok: true, value: await journal.sealSubmission({ accountId: user, attemptId: attempt }, key, 0) }; }
      catch (error) { return { ok: false, error: String(error) }; }
      finally { await journal.close(); }
    }, { name, user, attempt, key }),
    b.evaluate(async ({ name, user, attempt, q1 }) => {
      // @ts-expect-error dynamic browser fixture
      const { CbtAnswerQueue, IndexedDbAnswerJournal } = window.QueueLibrary;
      const journal = new IndexedDbAnswerJournal(indexedDB, name);
      const queue = new CbtAnswerQueue({ accountId: user, attemptId: attempt }, journal, {});
      try { return { ok: true, value: await queue.enqueue(q1, 1, 1, null, 0) }; }
      catch (error) { return { ok: false, error: String(error) }; }
      finally { await journal.close(); }
    }, { name, user, attempt, q1 }),
  ]);
  expect(sealed.ok).not.toBe(enqueued.ok);
  await a.reload();
  await a.addScriptTag({ url: '/__cbt-seal-test.js' });
  const stored = await a.evaluate(async ({ name, user, attempt }) => {
    // @ts-expect-error dynamic browser fixture
    const { IndexedDbAnswerJournal } = window.QueueLibrary;
    const journal = new IndexedDbAnswerJournal(indexedDB, name);
    try { return { seal: await journal.readSubmission({ accountId: user, attemptId: attempt }), rows: await journal.list({ accountId: user, attemptId: attempt }) }; }
    finally { await journal.close(); }
  }, { name, user, attempt });
  if (sealed.ok) { expect(stored.seal.operationKey).toBe(key); expect(stored.rows).toHaveLength(0); }
  else { expect(stored.seal).toBeNull(); expect(stored.rows).toHaveLength(1); expect(stored.rows[0].status).toBe('pending'); }
});

test('session request and original lease survive two tabs, takeover and reopening', async ({ context }) => {
  await context.route('**/__cbt-session-journal.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) { await page.goto('/'); await page.addScriptTag({ url: '/__cbt-session-journal.js' }); }
  const name = `lease-${crypto.randomUUID()}`;
  const scope = { accountId: user, attemptId: attempt };
  async function begin(page: typeof a) {
    return page.evaluate(async ({ scope, name }) => {
      // @ts-expect-error isolated browser test library
      const journal = new window.QueueLibrary.IndexedDbAnswerJournal(indexedDB, name);
      try { return await journal.beginWritingSession(scope, crypto.randomUUID()); } finally { await journal.close(); }
    }, { scope, name });
  }
  const [first, same] = await Promise.all([begin(a), begin(b)]);
  expect(first).toEqual(same); expect(first.takeover).toBe(false);
  const lease = { sessionId: crypto.randomUUID(), sessionGeneration: 1 };
  await a.evaluate(async ({ scope, name, requestKey, lease }) => {
    // @ts-expect-error isolated browser test library
    const journal = new window.QueueLibrary.IndexedDbAnswerJournal(indexedDB, name);
    try {
      await journal.rememberWritingSession(scope, requestKey, lease.sessionId, lease.sessionGeneration);
      // @ts-expect-error isolated browser test library
      const queue = new window.QueueLibrary.CbtAnswerQueue(scope, journal, {});
      await queue.enqueue('33333333-3333-4333-8333-333333333333', 1, 2, null, 0, lease);
    } finally { await journal.close(); }
  }, { scope, name, requestKey: first.requestKey, lease });
  const next = await b.evaluate(async ({ scope, name, requestKey }) => {
    // @ts-expect-error isolated browser test library
    const journal = new window.QueueLibrary.IndexedDbAnswerJournal(indexedDB, name);
    try { return await journal.requestWritingTakeover(scope, requestKey, crypto.randomUUID()); } finally { await journal.close(); }
  }, { scope, name, requestKey: first.requestKey });
  expect(next.takeover).toBe(true);
  const result = await a.evaluate(async ({ scope, name, requestKey, lease }) => {
    // @ts-expect-error isolated browser test library
    const journal = new window.QueueLibrary.IndexedDbAnswerJournal(indexedDB, name);
    try {
      let staleRejected = false;
      try { await journal.rememberWritingSession(scope, requestKey, lease.sessionId, lease.sessionGeneration); } catch { staleRejected = true; }
      return { staleRejected, operations: await journal.list(scope) };
    } finally { await journal.close(); }
  }, { scope, name, requestKey: first.requestKey, lease });
  expect(result.staleRejected).toBe(true);
  expect(result.operations).toHaveLength(1);
  expect(result.operations[0]).toMatchObject({ status: 'pending', ...lease });
  await a.close(); await b.reload(); await b.addScriptTag({ url: '/__cbt-session-journal.js' });
  expect(await begin(b)).toEqual(next);
});
