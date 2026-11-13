import { expect, test } from '@playwright/test';

// Synthetic configured client only. All Supabase requests are intercepted.
test.skip(process.env.RUN_CONFIGURED_SERVICE_TESTS !== '1', 'requires the separately built configured-client fixture');
const user = 'student-fixture-id';
const draftKey = `edureach-service-draft-v2:${user}:results`;

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(({ userId, key }) => {
    if (sessionStorage.getItem('recovery-fixture-ready')) return;
    sessionStorage.setItem('recovery-fixture-ready', 'yes');
    sessionStorage.setItem(key, JSON.stringify({ step: 3, form: { fullName: 'Synthetic Student', phone: '08012345678', institution: 'Synthetic Institution', notes: 'Synthetic request' } }));
    localStorage.setItem('sb-student-fixture-auth-token', JSON.stringify({
      access_token: 'isolated-token', refresh_token: 'isolated-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      token_type: 'bearer', user: { id: userId, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  }, { userId: user, key: draftKey });
  await page.route('**/api/admin/session', route => route.fulfill({ status: 403, json: { error: 'Permission denied' } }));
}

test('lost response retains original details and retries with the same key after reload', async ({ page }) => {
  await setup(page);
  const calls: Array<Record<string, unknown>> = [];
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog') return route.fulfill({ json: { id: 'service-id', service_key: 'results', title: 'Results', description: 'Synthetic', active: true, application_url: null } });
    if (path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') {
      calls.push(route.request().postDataJSON());
      if (calls.length === 1) return route.abort('failed'); // pretend the server accepted it before the response was lost
      return route.fulfill({ json: { id: 'server-id', reference_code: 'SERVER-REF', status: 'submitted', created_at: '2026-01-01T00:00:00Z' } });
    }
    if (path === '/rest/v1/service_requests' && route.request().method() === 'POST') throw new Error('unsafe direct insert');
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByRole('alert')).toContainText(/could not confirm/i);
  await expect(page.getByText('REQUEST CONFIRMED')).toHaveCount(0);
  expect(calls).toHaveLength(1);
  const saved = await page.evaluate((key) => sessionStorage.getItem(key), draftKey);
  expect(saved).toContain('Synthetic request');
  await page.reload();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByLabel('Additional Processing Instructions').fill('Changed after uncertainty');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByRole('alert')).toContainText(/review the previous submission/i);
  expect(calls).toHaveLength(1); // changed details cannot be sent using the old key
  await page.getByRole('button', { name: 'Review previous submission' }).click();
  await expect(page.getByRole('alert')).toContainText(/review these previous details/i);
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByText('SERVER-REF')).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(calls[1].p_submission_key).toBe(calls[0].p_submission_key);
  expect(calls[1].p_form_data).toEqual(calls[0].p_form_data);
  expect(calls[1].p_expected_user_id).toBe(user);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
});

test('blocked draft storage does not send a new request', async ({ page }) => {
  await setup(page);
  let submissions = 0;
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog') return route.fulfill({ json: { id: 'service-id', service_key: 'results', title: 'Results', description: 'Synthetic', active: true, application_url: null } });
    if (path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') submissions++;
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('button', { name: 'Confirm & Submit' })).toBeVisible();
  await page.evaluate(() => { Object.getPrototypeOf(sessionStorage).setItem = () => { throw new Error('blocked'); }; });
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByRole('alert')).toContainText(/draft is unavailable.*no new submission was sent/i);
  expect(submissions).toBe(0);
});

test('a confirmed request is shown honestly when the local draft cannot be cleared', async ({ page }) => {
  await setup(page);
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog') return route.fulfill({ json: { id: 'service-id', service_key: 'results', title: 'Results', description: 'Synthetic', active: true, application_url: null } });
    if (path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') return route.fulfill({ json: { id: 'server-id', reference_code: 'SERVER-REF', status: 'submitted', created_at: '2026-01-01T00:00:00Z' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('button', { name: 'Confirm & Submit' })).toBeVisible();
  await page.evaluate((key) => {
    const proto = Object.getPrototypeOf(sessionStorage);
    const remove = proto.removeItem;
    proto.removeItem = function (name: string) {
      if (name === key) throw new Error('storage removal blocked');
      return remove.call(this, name);
    };
  }, draftKey);
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByText('SERVER-REF')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/local draft could not be cleared/i);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toContain('Synthetic Student');
});

test('deactivated service can check a previous submission without creating another', async ({ page }) => {
  await setup(page);
  let inactive = false;
  const calls: Array<Record<string, unknown>> = [];
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog') return route.fulfill({ json: inactive ? null : { id: 'service-id', service_key: 'results', title: 'Results', description: 'Synthetic', active: true, application_url: null } });
    if (path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') {
      calls.push(route.request().postDataJSON());
      if (calls.length === 1) return route.abort('failed');
      return route.fulfill({ json: { id: 'server-id', reference_code: 'SERVER-REF', status: 'submitted', created_at: '2026-01-01T00:00:00Z' } });
    }
    if (path === '/rest/v1/service_requests' && route.request().method() === 'POST') throw new Error('unsafe direct insert');
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByRole('alert')).toContainText(/could not confirm/i);
  inactive = true;
  await page.reload();
  await expect(page.getByText('Service unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Check previous submission' }).click();
  await expect(page.getByText('SERVER-REF')).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(calls[0].p_recovery_only).toBe(false);
  expect(calls[1].p_recovery_only).toBe(true);
  expect(calls[1].p_submission_key).toBe(calls[0].p_submission_key);
  expect(calls[1].p_form_data).toEqual(calls[0].p_form_data);
  expect(calls[1].p_expected_user_id).toBe(user);
  expect(await page.evaluate(key => sessionStorage.getItem(key), draftKey)).toBeNull();
});

test('an unconfirmed or unreachable check keeps the pending draft and never submits', async ({ page }) => {
  await setup(page);
  const key = 'a5555555-5555-4555-8555-555555555555';
  await page.addInitScript(({ draft, submissionKey }) => {
    const value = JSON.parse(sessionStorage.getItem(draft) || '{}');
    value.pending = { key: submissionKey, details: { notes: 'Original synthetic request' } };
    sessionStorage.setItem(draft, JSON.stringify(value));
  }, { draft: draftKey, submissionKey: key });
  const calls: Array<Record<string, unknown>> = [];
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog' || path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') {
      calls.push(route.request().postDataJSON());
      if (calls.length === 1) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'No rows returned' } });
      return route.abort('failed');
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Check previous submission' }).click();
    await expect(page.getByRole('alert')).toContainText(/not yet confirmed/i);
    expect(await page.evaluate(draft => sessionStorage.getItem(draft), draftKey)).toContain(key);
  }
  expect(calls).toHaveLength(2);
  for (const call of calls) expect(call.p_recovery_only).toBe(true);
  await expect(page.getByText('SERVER-REF')).toHaveCount(0);
});

test('unavailable-service recovery is hidden when another account takes over', async ({ page }) => {
  await setup(page);
  await page.addInitScript(draft => {
    const value = JSON.parse(sessionStorage.getItem(draft) || '{}');
    value.pending = { key: 'a5555555-5555-4555-8555-555555555555', details: { notes: 'Private pending request' } };
    sessionStorage.setItem(draft, JSON.stringify(value));
  }, draftKey);
  let account = user;
  let calls = 0;
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: account, aud: 'authenticated', email: `${account}@example.test`, app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog' || path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') calls++;
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('button', { name: 'Check previous submission' })).toBeVisible();
  account = 'other-student';
  await page.evaluate(id => {
    localStorage.setItem('sb-student-fixture-auth-token', JSON.stringify({ access_token: `isolated-${id}`, refresh_token: 'isolated-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated', email: `${id}@example.test`, app_metadata: {}, user_metadata: {} } }));
    window.dispatchEvent(new Event('edureach-auth-changed'));
  }, account);
  await expect(page.getByRole('button', { name: 'Check previous submission' })).toHaveCount(0);
  await expect(page.getByText('Private pending request')).toHaveCount(0);
  expect(await page.evaluate(draft => sessionStorage.getItem(draft), draftKey)).toContain('Private pending request');
  expect(calls).toBe(0);
});

test('check-only confirmation warns when the saved draft cannot be cleared', async ({ page }) => {
  await setup(page);
  await page.addInitScript(draft => {
    const value = JSON.parse(sessionStorage.getItem(draft) || '{}');
    value.pending = { key: 'a5555555-5555-4555-8555-555555555555', details: { notes: 'Saved request' } };
    sessionStorage.setItem(draft, JSON.stringify(value));
  }, draftKey);
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: user, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog' || path === '/rest/v1/profiles') return route.fulfill({ json: null });
    if (path === '/rest/v1/rpc/submit_service_request_idempotent') return route.fulfill({ json: { id: 'server-id', reference_code: 'SERVER-REF', status: 'submitted', created_at: '2026-01-01T00:00:00Z' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('button', { name: 'Check previous submission' })).toBeVisible();
  await page.evaluate(draft => {
    const proto = Object.getPrototypeOf(sessionStorage);
    const remove = proto.removeItem;
    proto.removeItem = function (name: string) { if (name === draft) throw new Error('blocked'); return remove.call(this, name); };
  }, draftKey);
  await page.getByRole('button', { name: 'Check previous submission' }).click();
  await expect(page.getByText('SERVER-REF')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/local draft could not be cleared/i);
  expect(await page.evaluate(draft => sessionStorage.getItem(draft), draftKey)).toContain('Saved request');
});
