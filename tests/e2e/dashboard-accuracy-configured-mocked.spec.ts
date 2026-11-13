import { expect, test } from '@playwright/test';

// Synthetic Auth/PostgREST fixture only; never a hosted security claim.
test.skip(process.env.RUN_CONFIGURED_SERVICE_TESTS !== '1', 'requires the separately built configured-client fixture');

test('dashboard shows bounded submitted scores and reports failed history reads', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-student-fixture-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-student', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  let historyState: 'loaded' | 'failure' | 'unscored' | 'empty' = 'loaded';
  const historyQueries: string[] = [];
  let releaseHistory: () => void = () => {};
  const initialHistoryGate = new Promise<void>(resolve => { releaseHistory = resolve; });
  let firstHistory = true;
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/rest/v1/cbt_attempts') {
      const url = new URL(route.request().url());
      historyQueries.push(url.searchParams.get('user_id') || '');
      if (firstHistory) { firstHistory = false; await initialHistoryGate; }
      if (url.searchParams.get('user_id') !== 'eq.isolated-student' || url.searchParams.get('limit') !== '50') return route.fulfill({ status: 403, json: { message: 'Missing owner or bound' } });
      if (historyState === 'failure') return route.fulfill({ status: 500, json: { message: 'Synthetic read failure' } });
      if (historyState === 'empty') return route.fulfill({ json: [] });
      if (historyState === 'unscored') return route.fulfill({ json: [{ id: 'unscored', status: 'submitted', mode: 'practice', selected_subjects: ['Biology'], score: null, total_questions: 10, created_at: '2026-04-02T00:00:00Z' }] });
      const base = { exam_id: 'exam', correct_answers: 5, total_questions: 10, expires_at: null, current_question: 0 };
      return route.fulfill({ json: [
        { ...base, id: 'latest', status: 'submitted', mode: 'practice', selected_subjects: ['Physics'], subject_plan: [{ subject: 'Physics', questions: 10 }], correct_answers: 8, score: 80, submitted_at: '2026-04-04T00:00:00Z', created_at: '2026-04-04T00:00:00Z' },
        { ...base, id: 'previous', status: 'submitted', mode: 'mock', selected_subjects: ['Biology'], subject_plan: [{ subject: 'Biology', questions: 10 }], correct_answers: 6, score: 60, submitted_at: '2026-04-03T00:00:00Z', created_at: '2026-04-03T00:00:00Z' },
        { ...base, id: 'physics-older', status: 'submitted', mode: 'practice', selected_subjects: ['Physics'], subject_plan: [{ subject: 'Physics', questions: 10 }], correct_answers: 4, score: 40, submitted_at: '2026-03-31T00:00:00Z', created_at: '2026-03-31T00:00:00Z' },
        { ...base, id: 'biology-older', status: 'submitted', mode: 'practice', selected_subjects: ['Biology'], subject_plan: [{ subject: 'Biology', questions: 10 }], correct_answers: 9, score: 90, submitted_at: '2026-03-30T00:00:00Z', created_at: '2026-03-30T00:00:00Z' },
        { ...base, id: 'mixed', status: 'submitted', mode: 'mock', selected_subjects: ['Physics', 'Biology'], subject_plan: [{ subject: 'Physics', questions: 5 }, { subject: 'Biology', questions: 5 }], score: 50, submitted_at: '2026-04-02T12:00:00Z', created_at: '2026-04-02T12:00:00Z' },
        { ...base, id: 'unscored', status: 'submitted', mode: 'practice', score: null, submitted_at: '2026-04-02T00:00:00Z', created_at: '2026-04-02T00:00:00Z' },
        { ...base, id: 'expired', status: 'expired', mode: 'mock', score: null, submitted_at: null, created_at: '2026-04-01T00:00:00Z' },
      ] });
    }
    if (path === '/rest/v1/profiles') return route.fulfill({ json: [{ id: 'isolated-student', role: 'student', full_name: 'Synthetic Student' }] });
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: 'isolated-student', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/admin/session', route => route.fulfill({ status: 403, json: { error: 'Permission denied' } }));
  await page.goto('/dashboard/cbt');
  await expect(page.getByRole('heading', { name: 'Loading your dashboard…' })).toBeVisible();
  await expect(page.getByLabel('Loading dashboard records')).toBeVisible();
  releaseHistory();
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'My CBT' })).toBeVisible();
  await expect(page.getByText('not all-time totals', { exact: false })).toBeVisible();
  await expect(page.locator('.dash-metric-card').filter({ hasText: 'Scored tests' })).toContainText('5');
  await expect(page.locator('.dash-metric-card').filter({ hasText: 'Submitted, score unavailable' })).toContainText('1');
  await expect(page.locator('.dash-metric-card').filter({ hasText: 'Average score' })).toContainText('64%');
  await expect(page.getByText('+20 percentage points', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Subjects selected in completed tests' })).toBeVisible();
  await expect(page.getByText('Physics: 3 submitted tests')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Subject progress' })).toBeVisible();
  await expect(page.getByText('12 of 20 questions correct across 2 scored papers', { exact: false })).toBeVisible();
  await expect(page.getByText('Consider another Physics practice paper.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const visibleHistory = page.locator('.dash-table-wrap:visible, ul.dash-mobile-only:visible');
  await expect(visibleHistory.getByText('Physics', { exact: false }).first()).toBeVisible();
  await expect(visibleHistory.getByText('Time ran out', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Answers were submitted automatically')).toHaveCount(0);
  historyState = 'unscored';
  await page.reload();
  await expect(page.locator('.dash-metric-card').filter({ hasText: 'Average score' })).toContainText('When a scored result is available');
  await expect(page.getByText('Biology: 1 submitted test')).toBeVisible();
  await expect(page.getByText('A comparison needs at least two subjects', { exact: false })).toBeVisible();
  await expect(page.getByText('Consider another Physics practice paper.', { exact: false })).toHaveCount(0);
  historyState = 'empty';
  await page.reload();
  await expect(page.getByText('No attempts yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Subjects selected in completed tests' })).toHaveCount(0);
  historyState = 'failure';
  await page.reload();
  await expect(page.getByText('CBT history could not be loaded.', { exact: false })).toBeVisible();
  await expect(page.getByText('No attempts yet.', { exact: false })).toHaveCount(0);
  await expect(page.locator('.dash-metric-strip')).toHaveCount(0);
  expect(historyQueries.length).toBeGreaterThan(0);
  expect(historyQueries.every(value => value === 'eq.isolated-student')).toBe(true);
  await page.goto('/settings');
  const security = page.getByRole('dialog', { name: 'Account Security & Devices' });
  await expect(security).toBeVisible();
  await expect(security.getByText('Account deletion and data export are not available', { exact: false })).toBeVisible();
  await expect(security.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy');
  await expect(security.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms');
});
