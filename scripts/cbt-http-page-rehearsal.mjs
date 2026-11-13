// Called only from the disposable private-socket HTTP rehearsal. This runs the
// real built CBT page against actual Express and migrated PostgreSQL; Auth/JWT
// and PostgREST are local compatibility shims, not real Supabase.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

export async function rehearsePage({ base, attempt, account, token, legacyAttempt, legacyAccount, legacyToken, admin }) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const contexts = [];
  let releaseHeld;
  try {
    async function newContext(userId = account, userToken = token) {
      const context = await browser.newContext({ baseURL: base }); contexts.push(context);
      await context.addInitScript(({ account, token }) => {
        localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 600, expires_in: 600, token_type: 'bearer', user: { id: account, aud: 'authenticated', email: 'browser@synthetic.test', app_metadata: {}, user_metadata: {} } }));
        localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary: true, analytics: false, version: 1 }));
      }, { account: userId, token: userToken });
      // Never let a previously configured build contact a hosted service.
      // All real application/API requests in this rehearsal are same-origin.
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      return context;
    }
    const aContext = await newContext(), a = await aContext.newPage();
    const active = page => expect(page.getByText('Writing session confirmed by the server.')).toBeVisible();
    const saved = page => expect(page.getByRole('status').filter({ hasText: /^saved$/ })).toBeVisible();
    const open = async page => { await page.goto(`/cbt/session/${attempt}`); await expect(page.getByRole('heading', { name: 'Synthetic' })).toBeVisible(); };
    const revision = async () => Number((await admin.query('select candidate_answer_revision from public.cbt_attempts where id=$1', [attempt])).rows[0].candidate_answer_revision);
    const rows = async () => (await admin.query('select operation_key,request,outcome from public.cbt_v2_operations where attempt_id=$1 order by accepted_revision', [attempt])).rows;
    await open(a); await active(a);
    await a.getByRole('radio').nth(1).click(); await saved(a);
    assert.equal(await revision(), 1);
    await a.getByRole('button', { name: 'Next', exact: true }).click();
    await a.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(a.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
    await a.reload(); await active(a); await expect(a.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');

    // Request never reaches the server; pending ID must survive explicit retry.
    await a.getByRole('button', { name: 'Next', exact: true }).click();
    let failedKey;
    const fail = async route => { failedKey = route.request().postDataJSON().operationKey; await route.abort('failed'); };
    await a.route('**/api/cbt/v2/**/answer', fail);
    await a.getByRole('radio').nth(2).click();
    await expect(a.getByText(/not yet saved/).first()).toBeVisible();
    assert.ok(failedKey); assert.equal(await revision(), 1);
    await a.unroute('**/api/cbt/v2/**/answer', fail);
    await a.getByRole('button', { name: 'Retry connection' }).click(); await saved(a);
    assert.equal(await revision(), 2);
    assert.equal((await rows()).filter(r => r.operation_key === failedKey && r.outcome === 'accepted').length, 1);

    // The actual server commits but the browser loses the response.
    await a.getByRole('button', { name: 'Next', exact: true }).click();
    const keys = []; let lost = false;
    const uncertain = async route => {
      keys.push(route.request().postDataJSON().operationKey);
      if (!lost) { lost = true; const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed'); }
      else await route.continue();
    };
    await a.route('**/api/cbt/v2/**/answer', uncertain);
    await a.getByRole('radio').nth(0).click();
    await expect.poll(() => keys.length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
    await saved(a); await a.unroute('**/api/cbt/v2/**/answer', uncertain);
    assert.equal(keys[0], keys[1]); assert.equal(await revision(), 3);
    assert.equal((await rows()).filter(r => r.operation_key === keys[0] && r.outcome === 'accepted').length, 1);

    // Hold A before its request reaches Express. B takes over in a separate
    // browser context; A's now-stale request is then sent to the real gateway.
    await a.getByRole('button', { name: 'Next', exact: true }).click();
    let heldKey, heldLease, staleStatus;
    const gate = new Promise(resolve => { releaseHeld = resolve; });
    const hold = async route => {
      const body = route.request().postDataJSON(); heldKey = body.operationKey; heldLease = body.sessionId;
      await gate; const response = await route.fetch(); staleStatus = response.status(); await route.fulfill({ response });
    };
    await a.route('**/api/cbt/v2/**/answer', hold);
    await a.getByRole('radio').nth(3).click(); await expect.poll(() => Boolean(heldKey)).toBe(true);
    const bContext = await newContext(), b = await bContext.newPage();
    await open(b); await expect(b.getByText('Writing is paused.')).toBeVisible();
    b.once('dialog', dialog => void dialog.accept());
    await b.getByRole('button', { name: 'Take over writing' }).click(); await active(b);
    releaseHeld(); await expect.poll(() => staleStatus).toBe(409);
    await expect(a.getByText('Writing is paused.')).toBeVisible();
    const pending = await a.evaluate(async key => {
      const db = await new Promise((resolve, reject) => { const r=indexedDB.open('edureach-cbt-v2-operations'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
      const row = await new Promise((resolve, reject) => { const r=db.transaction('operations').objectStore('operations').get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); db.close(); return row;
    }, heldKey);
    assert.equal(pending.sessionId, heldLease); assert.ok(['pending','conflicted'].includes(pending.status));
    assert.equal((await rows()).filter(r => r.operation_key === heldKey).length, 0);
    await b.getByRole('radio').nth(2).click(); await saved(b); assert.equal(await revision(), 4);
    const sessions = (await admin.query("select id,generation,status from public.cbt_v2_writing_sessions where attempt_id=$1", [attempt])).rows;
    assert.equal(sessions.filter(s=>s.status==='active').length, 1);

    // Move the authoritative revision without refreshing B, using its real
    // lease through the existing answer HTTP route. The next page edit must
    // conflict and require an explicit resolution, not overwrite it.
    const activeSession = sessions.find(s=>s.status==='active');
    const firstQuestion = (await admin.query('select question_ids from public.cbt_attempts where id=$1',[attempt])).rows[0].question_ids[0];
    const advanced = await fetch(`${base}/api/cbt/v2/attempts/${attempt}/answer`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ protocol:2, expectedRevision:4, operationKey:randomUUID(), questionId:firstQuestion, selected:3, sessionId:activeSession.id, sessionGeneration:Number(activeSession.generation) }) });
    assert.equal(advanced.status,200); assert.equal(await revision(),5);
    await b.getByRole('radio').nth(0).click();
    await expect(b.getByText(/server answer D/)).toBeVisible();
    assert.equal(await revision(),5);
    await b.getByRole('button', { name:'Apply my local answer' }).click(); await saved(b);
    assert.equal(await revision(),6);
    const legacyContext = await newContext(legacyAccount, legacyToken), legacyPage = await legacyContext.newPage();
    await legacyPage.goto(`/cbt/session/${legacyAttempt}`);
    await expect(legacyPage.getByRole('heading', { name:'Synthetic' })).toBeVisible();
    await legacyPage.getByRole('radio').nth(1).click();
    await expect.poll(async () => (await admin.query('select answers_draft from public.cbt_attempts where id=$1',[legacyAttempt])).rows[0].answers_draft['1']).toBe(1);
    await legacyPage.reload();
    await expect(legacyPage.getByRole('radio').nth(1)).toHaveAttribute('aria-checked','true');
    console.log('Passed actual CBT page -> Express -> local compatibility gateway -> migrated PostgreSQL: v2 navigate/refresh, pre-send failure, same-key uncertain replay, two-context takeover, stale in-flight rejection, explicit revision conflict resolution and legacy save/reload. Auth/JWT/PostgREST are synthetic.');
  } finally { releaseHeld?.(); for (const context of contexts) await context.close(); await browser.close(); }
}
