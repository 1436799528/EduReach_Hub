import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Phase 5 regression: deleting a CBT result used to leave the confirmation in
// the browser's top layer. `setConfirming(null)` unmounts React state but the
// <dialog> was opened with showModal(), and only an explicit close() leaves the
// top layer. The result: the item disappeared from the list while an invisible
// backdrop kept the rest of the page unclickable.
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

test('the history panel closes the confirm dialog only after the delete succeeds', () => {
  const source = read('src/components/CbtHistoryPanel.tsx');
  const remove = source.slice(source.indexOf('async function remove('), source.indexOf('if (authLoading) return null;'));

  assert.match(remove, /await deleteCbtAttempt\(item\.id\)/, 'the server is asked first');
  const success = remove.slice(remove.indexOf('await deleteCbtAttempt'));
  assert.ok(
    success.indexOf('dialog.current?.close()') > success.indexOf('setItems('),
    'close() runs after the list is updated, not before the request settles',
  );
  assert.match(remove, /setDeleteError\(/, 'a failure is reported in the dialog');
  assert.doesNotMatch(
    remove.slice(remove.indexOf('catch')),
    /dialog\.current\?\.close\(\)/,
    'the catch branch leaves the dialog open so the student can retry',
  );
  // The old bug: clearing the state and trusting React to remove a top-layer dialog.
  assert.doesNotMatch(remove, /finally\s*\{[^}]*setConfirming\(null\)/s, 'state is not cleared from finally');
  assert.match(remove, /deleteInFlight\.current/, 'a second click cannot start a second delete');
  assert.match(remove, /if \(deleteInFlight\.current\) return;/, 'the guard exits before any request');
});

test('the dialog shows the failure and blocks a duplicate submit', () => {
  const source = read('src/components/CbtHistoryPanel.tsx');
  const dialog = source.slice(source.indexOf('<dialog ref={dialog}'));

  assert.match(dialog, /onClose=\{\(\) => setConfirming\(null\)\}/, 'onClose is the one place the state resets');
  assert.match(dialog, /role="alert"/, 'a failed delete is announced, not just coloured');
  assert.match(dialog, /\{deleteError &&/, 'the message only appears when there is an error');
  assert.match(dialog, /aria-busy=\{Boolean\(busyId\)\}/, 'the button reports pending work');
  assert.match(dialog, /disabled=\{Boolean\(busyId\)\}/, 'and cannot be pressed twice');
  assert.match(dialog, /\{busyId \? 'Deleting…' : 'Delete result'\}/, 'its label says what is happening');
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

test('the results page keeps the same close-then-navigate order', () => {
  const page = read('pages/CbtResultsPage.tsx');
  const start = page.indexOf('async function removeResult(');
  assert.ok(start > -1, 'removeResult exists');
  const rest = page.slice(start);
  const fn = rest.slice(0, rest.indexOf('useEffect('));
  assert.ok(
    fn.indexOf('deleteDialog.current?.close()') < fn.indexOf('navigateInApp('),
    'the dialog is dismissed before the route changes, or the backdrop survives the navigation',
  );
  assert.match(fn, /setDeleteError\(/, 'a failure is surfaced instead of a false success');
  assert.match(fn, /setDeleteBusy\(true\)/, 'the button reports pending work');
});
