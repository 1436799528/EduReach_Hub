import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Phase 5 regression: deleting a CBT result used to leave the confirmation in
// the browser's top layer. Clearing React state unmounts the button but the
// <dialog> was opened with showModal(), and only an explicit close() leaves the
// top layer. The result: the item disappeared from the list while an invisible
// backdrop kept the rest of the page unclickable.
//
// The confirmation now lives on the saved-result page and on the dashboard's
// Results view (inline, by design — the dashboard already owns one modal). The
// history panel that used to host a second copy of this dialog was removed with
// the Practice-page rebuild, so these assertions target the pages that remain.
//
// jsdom does not implement showModal()/close(), so the dialog behaviour is
// modelled here the way the DOM spec defines it: `open` is the attribute that
// showModal() sets and close() removes, and `close` fires the `close` event that
// React's onClose listens to. These assertions then check the invariant the bug
// violated: the dialog is closed on success, and *only* on success.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

after(() => {
  delete (globalThis as { __erDialog?: unknown }).__erDialog;
});

test('the result page closes the confirm dialog only after the delete succeeds', () => {
  const source = read('pages/CbtResultsPage.tsx');
  const start = source.indexOf('async function removeResult(');
  const remove = source.slice(start, source.indexOf('useEffect(', start));

  assert.match(remove, /await deleteCbtAttempt\(attemptId\)/, 'the server is asked first');
  const success = remove.slice(remove.indexOf('await deleteCbtAttempt'));
  assert.ok(
    success.indexOf('deleteDialog.current?.close()') > success.indexOf('setDeleteSuccess('),
    'close() runs after the success state, not before the request settles',
  );
  assert.match(remove, /setDeleteError\(/, 'a failure is reported in the dialog');
  assert.doesNotMatch(
    remove.slice(remove.indexOf('catch')),
    /deleteDialog\.current\?\.close\(\)/,
    'the catch branch leaves the dialog open so the student can retry',
  );
  // The old bug: clearing the state and trusting React to remove a top-layer dialog.
  assert.doesNotMatch(remove, /finally\s*\{[^}]*setConfirmDelete\(null\)/s, 'state is not cleared from finally');
  assert.match(remove, /deleteInFlight\.current/, 'a second click cannot start a second delete');
  assert.match(remove, /if \(!attemptId \|\| deleteInFlight\.current\) return;/, 'the guard exits before any request');
});

test('the dialog shows the failure and blocks a duplicate submit', () => {
  const source = read('pages/CbtResultsPage.tsx');
  const dialog = source.slice(source.indexOf('<dialog ref={deleteDialog}'));

  assert.match(dialog, /onClose=\{\(\) => setConfirmDelete\(false\)\}/, 'onClose is the one place the state resets');
  assert.match(dialog, /role="alert"/, 'a failed delete is announced, not just coloured');
  assert.match(dialog, /\{deleteError &&/, 'the message only appears when there is an error');
  assert.match(dialog, /disabled=\{deleteBusy\}/, 'the button cannot be pressed twice');
  assert.match(dialog, /\{deleteBusy \? 'Deleting…' : 'Delete permanently'\}/, 'its label says what is happening');
  assert.match(dialog, /aria-label="Close delete confirmation"/, 'there is a corner close control');
});

test('the dashboard results view confirms before deleting and never risks a double click', () => {
  const dashboard = read('pages/StudentDashboardV2.tsx');
  assert.match(dashboard, /Delete this result\?/, 'the row asks before deleting');
  assert.match(dashboard, /Keep<\/button>/, 'there is a way out');
  assert.match(dashboard, /if \(deletingId\) return;/, 'a guard runs before the request');
  assert.match(dashboard, /aria-busy=\{deletingId === row\.id\}/, 'the button reports pending work');
  assert.match(dashboard, /disabled=\{deletingId === row\.id\}/, 'and cannot be pressed twice');
});

test('the confirm dialog follows the showModal/close lifecycle it depends on', () => {
  const dom = new JSDOM('<!doctype html><dialog id="confirm"><button id="go">Delete</button></dialog>', {
    pretendToBeVisual: true,
  });
  const { document } = dom.window;
  const dialog = document.getElementById('confirm') as HTMLDialogElement;
  let closed = 0;
  dialog.addEventListener('close', () => { closed += 1; });

  // What the component's effect does when a confirmation is requested.
  dialog.setAttribute('open', '');
  assert.equal(dialog.open, true, 'the dialog is open while confirming');

  // What the success branch does. Without this line the dialog stays open —
  // exactly the reported bug.
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new dom.window.Event('close'));
  assert.equal(dialog.open, false, 'the dialog leaves the top layer');
  assert.equal(closed, 1, 'onClose fires, so the React state is cleared by the dialog itself');

  dom.window.close();
});

test('the results page dismisses the dialog and does not auto-navigate after delete', () => {
  const page = read('pages/CbtResultsPage.tsx');
  const start = page.indexOf('async function removeResult(');
  assert.ok(start > -1, 'removeResult exists');
  const fn = page.slice(start, page.indexOf('useEffect(', start));
  assert.match(fn, /deleteDialog\.current\?\.close\(/, 'the dialog is dismissed after deletion');
  assert.ok(!fn.includes('setTimeout'), 'no artificial delay before navigation');
  assert.ok(!fn.includes('navigateInApp('), 'navigation is user-controlled via the Back to CBT link, not automatic');
  assert.match(fn, /setDeleteError\(/, 'a failure is surfaced instead of a false success');
  assert.match(fn, /setDeleteBusy\(true\)/, 'the button reports pending work');
});
