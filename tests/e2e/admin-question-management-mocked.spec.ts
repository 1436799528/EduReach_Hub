import { expect, test } from '@playwright/test';
import { capabilitiesForRole } from '../../src/lib/capabilities';

test('admin searches and pages the existing bank without losing add position', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: 'test-user', aud: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {} } })));
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  await page.route('**/api/admin/session', route => route.fulfill({ json: { user: { id: 'test-user', email: 'operator@example.test', fullName: 'Operator', role: 'super_admin', capabilities: [...capabilitiesForRole('super_admin')] } } }));
  await page.route('**/api/admin/institutions**', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/admin/cbt/exams', route => route.fulfill({ json: { items: [{ id: 'exam-1', title: 'Example exam', exam_body: 'JAMB', subject: 'Mathematics', duration_minutes: 30, is_active: true, format_status: 'unverified' }] } }));
  const requests: string[] = [];
  await page.route('**/api/admin/cbt/exams/exam-1/questions?*', route => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const pageNumber = Number(url.searchParams.get('page'));
    const q = { id: `question-${pageNumber}`, exam_id: 'exam-1', subject: 'Mathematics', question_text: `Question on page ${pageNumber}`, option_a: 'One', option_b: 'Two', option_c: 'Three', option_d: 'Four', correct_option: 'B', explanation: 'A reason', marks: 1, position: pageNumber, source_type: 'unverified', review_status: 'needs_review', format_verified: false };
    return route.fulfill({ json: { items: [q], page: pageNumber, hasMore: pageNumber === 1, nextPosition: 126 } });
  });
  await page.goto('/admin/cbt');
  await expect(page.getByText('Question on page 1')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Question on page 2')).toBeVisible();
  await page.getByLabel('Search question text or full ID').fill('biology');
  await page.getByLabel('Filter question review status').selectOption('approved');
  await page.getByRole('button', { name: 'Search questions' }).click();
  await expect(page.getByText('Question on page 1')).toBeVisible();
  expect(requests.at(-1)).toContain('search=biology');
  expect(requests.at(-1)).toContain('review=approved');
  await page.getByRole('button', { name: '+ Add Question' }).click();
  await expect(page.getByLabel('Question position')).toHaveValue('126');
});

test('review preview and selected approvals use current item versions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: 'test-user', aud: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {} } })));
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  await page.route('**/api/admin/session', route => route.fulfill({ json: { user: { id: 'test-user', email: 'operator@example.test', fullName: 'Operator', role: 'super_admin', capabilities: [...capabilitiesForRole('super_admin')] } } }));
  const paper = { id: 'import-1', exam_id: 'exam-1', exam_body: 'JAMB', subject: 'Mathematics', paper_year: null, source_name: null, source_url: null, source_verified: false, original_filename: 'paper.txt', file_bytes: 40, status: 'extracted', attempts: 1, extraction_warnings: [], item_count: 1, imported_count: 0, duplicate_count: 0, created_at: new Date().toISOString() };
  const item = { id: 'item-1', source_index: 1, question_text: 'Which choice is correct?', option_a: 'One', option_b: 'Two', option_c: 'Three', option_d: 'Four', option_e: null, correct_option: 'B', explanation: null, passage: null, topic: null, raw_text: '', review_status: 'pending', issues: [], duplicate_of: null, question_id: null, updated_at: '2026-01-01T00:00:00.000Z' };
  let reviewVersion = '';
  await page.route('**/api/admin/question-imports/import-1/items/item-1/review', async route => {
    reviewVersion = route.request().postDataJSON().expectedUpdatedAt;
    await route.fulfill({ json: { item: { id: 'item-1', review_status: 'approved', issues: [], updated_at: '2026-01-01T00:00:00.001Z' } } });
  });
  await page.route('**/api/admin/question-imports/import-1', route => route.fulfill({ json: { item: paper, items: [item], summary: { pending: 1, approved: 0, rejected: 0, imported: 0 } } }));
  await page.route('**/api/admin/question-imports', route => route.fulfill({ json: { items: [paper] } }));
  await page.goto('/admin/question-imports');
  const rejectOptional = page.getByRole('button', { name: 'Reject optional' });
  if (await rejectOptional.isVisible()) await rejectOptional.click();
  const reviewButton = page.getByRole('button', { name: 'Review', exact: true });
  await reviewButton.scrollIntoViewIfNeeded();
  await reviewButton.click();
  await expect(page.getByRole('heading', { name: 'Review imported questions' })).toBeVisible();
  await page.getByText('Preview question', { exact: true }).click();
  await expect(page.locator('details').filter({ hasText: 'Preview question' }).getByText('Which choice is correct?', { exact: true })).toBeVisible();
  await page.getByLabel('Select question 1 for approval').check();
  await page.getByRole('button', { name: 'Approve selected (1)' }).click();
  await expect(page.getByText('1 approved; 0 could not be approved. Review failures before saving.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save approved (1)' })).toBeEnabled();
  expect(reviewVersion).toBe('2026-01-01T00:00:00.000Z');
});
