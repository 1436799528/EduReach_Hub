import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageSlice } from '../src/lib/studentDashboard';

// Phase 6: the dashboard may only state what it measured, may delete a result
// from the row that shows it, and must not lose its place when it does.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const dashboard = read('pages/StudentDashboardV2.tsx');
const cbtView = dashboard.slice(dashboard.indexOf('const cbtView ='), dashboard.indexOf('const toolsView ='));

test('a score is only shown when a paper has been sat', () => {
  assert.match(dashboard, /const hasScores = completedAttempts\.length > 0/, 'the condition has a name');
  assert.match(cbtView, /\{hasScores \? `\$\{averageScore\}%` : '—'\}/, 'no average is reported without completed tests');
  assert.match(cbtView, /\{hasScores \? `\$\{bestScore\}%` : '—'\}/, 'no best score is reported without completed tests');
  assert.match(cbtView, /After your first test/, 'the empty value explains itself');
  assert.doesNotMatch(cbtView, /\{averageScore\}%<\/span>/, 'the old unconditional percentage is gone');
  assert.doesNotMatch(dashboard, /streak|rank(ing)?|hours studied|percentile/i, 'no metric is invented');
});

test('a result can be reviewed and deleted from the dashboard, with confirmation', () => {
  assert.match(dashboard, /await deleteCbtAttempt\(row\.id\)/, 'the delete goes through the server, which checks ownership');
  // The row markup lives in `attemptsTable`, which is defined above the tab.
  assert.match(dashboard, /confirmDeleteId === row\.id/, 'the row asks before deleting');
  assert.match(dashboard, /Delete this result\?/, 'the question is explicit');
  assert.match(dashboard, /Keep<\/button>/, 'there is a way out');
  assert.match(dashboard, /aria-busy=\{deletingId === row\.id\}/, 'the button reports pending work');
  assert.match(dashboard, /disabled=\{deletingId === row\.id\}/, 'a double click cannot delete twice');
  assert.match(dashboard, /setAttempts\(\(current\) => current\.filter\(\(attempt\) => attempt\.id !== row\.id\)\)/, 'only the deleted row leaves the list');
  assert.match(dashboard, /setAttemptNotice\('Result deleted/, 'success is stated, not implied');
  assert.match(dashboard, /userFacingError\(error, 'That result could not be deleted/, 'a failure is explained');
  assert.match(cbtView, /role="status" aria-live="polite"/, 'the outcome is announced');
  assert.match(dashboard, /getElementById\('dash-cbt-heading'\)\?\.focus\(\)/, 'focus is not dropped when the button disappears');
  assert.match(dashboard, /state !== 'active' && \(confirmDeleteId === row\.id/, 'an in-progress paper is resumed, not deleted');
});

test('the delete handler cannot run twice for one click', () => {
  const handler = dashboard.slice(dashboard.indexOf('const removeAttempt'), dashboard.indexOf('/* ---------------- actions ---------------- */'));
  assert.match(handler, /if \(deletingId\) return;/, 'a guard runs before the request');
  assert.ok(
    handler.indexOf('if (deletingId) return;') < handler.indexOf('await deleteCbtAttempt'),
    'the guard precedes the network call',
  );
  assert.match(handler, /finally \{[\s\S]*setDeletingId\(''\)/, 'the busy flag is always cleared');
});

test('results are paged, and the page survives deleting its last row', () => {
  const rows = Array.from({ length: 19 }, (_, index) => index + 1);

  const first = pageSlice(rows, 0, 8);
  assert.deepEqual(first.items, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(first.first, 1);
  assert.equal(first.last, 8);
  assert.equal(first.pageCount, 3);

  const last = pageSlice(rows, 2, 8);
  assert.deepEqual(last.items, [17, 18, 19]);
  assert.equal(last.first, 17, 'the range reads from the data, not from page arithmetic');

  // Delete the only row on the last page of a 17-item set, while standing on it.
  const afterDelete = pageSlice(rows.slice(0, 16), 2, 8);
  assert.equal(afterDelete.page, 1, 'the reader lands on the new last page');
  assert.deepEqual(afterDelete.items, [9, 10, 11, 12, 13, 14, 15, 16]);

  assert.equal(pageSlice([], 0, 8).first, 0, 'an empty list does not claim to show 1–0');
  assert.equal(pageSlice(rows, 99, 8).page, 2, 'a stale page index is clamped');
  assert.equal(pageSlice(rows, -4, 8).page, 0, 'a negative index is clamped');
  assert.equal(pageSlice(rows, 0, 0).pageCount, 19, 'a zero page size does not divide by zero');
});

test('the dashboard renders the page slice, not the whole list', () => {
  assert.match(dashboard, /const attemptPageView = pageSlice\(attempts, attemptPage, ATTEMPTS_PER_PAGE\)/, 'the slice is computed once');
  assert.match(cbtView, /attemptsTable\(visibleAttempts\)/, 'only the page is rendered');
  assert.match(cbtView, /Showing \{attemptPageView\.first\}–\{attemptPageView\.last\} of \{attempts\.length\}/, 'the range is stated');
  assert.match(cbtView, /disabled=\{safePage === 0\}/, 'Previous is unavailable on the first page');
  assert.match(cbtView, /disabled=\{safePage >= pageCount - 1\}/, 'Next is unavailable on the last page');
  assert.match(cbtView, /most recent 50/, 'the fetch ceiling is disclosed rather than implied');
});

test('a failed saved-item deletion restores the item where it was', () => {
  const handler = dashboard.slice(dashboard.indexOf('const removeSaved'), dashboard.indexOf('/* ---------------- loading ---------------- */'));
  assert.match(handler, /const index = savedItems\.findIndex/, 'the original position is recorded');
  assert.match(handler, /restored\.splice\(Math\.min\(index, restored\.length\), 0, item\)/, 'it goes back in place');
  assert.doesNotMatch(handler, /\[item, \.\.\.prev\]/, 'it is not pushed to the top');
});
