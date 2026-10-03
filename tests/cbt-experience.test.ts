import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// CBT-3/CBT-4/CBT-5: source-level contracts for the student experience that a
// unit test cannot render — the dedicated shell, the configured setup, the
// legacy redirect, the save-on-reconnect path and the delete confirmation.
//
// These assertions are deliberately about *behaviour expressed in code* (which
// route renders which page, which call persists an answer, which confirmations
// exist), not about markup or styling, so they do not break on a redesign that
// keeps the guarantees.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('the examination hall is a dedicated route, not a page inside the site shell', () => {
  const routes = read('src/app/routes.tsx');
  assert.match(routes, /\/cbt\/session\//, 'the shell has its own route');
  assert.match(routes, /CbtSessionPage/, 'and its own component');

  const shell = read('pages/CbtSessionPage.tsx');
  assert.ok(!/HubLayout/.test(shell), 'the hall must not render the site header/footer');
  assert.match(shell, /er-exam-shell/, 'it owns a dedicated shell class');
  assert.match(shell, /End Test/, 'End Test is a distinct, named action');
  assert.match(shell, /Submit/, 'and Submit is separate from it');
});

test('legacy /cbt/practice cannot drop a student straight into a paper', () => {
  const routes = read('src/app/routes.tsx');
  assert.match(routes, /CbtPracticeEntryPage/, 'the legacy route is handled explicitly');
  const entry = read('pages/CbtPracticeEntryPage.tsx');
  assert.match(entry, /\/cbt\/setup\//, 'it redirects into the configured setup');
  assert.ok(!/startCbt\(/.test(entry), 'it must not start an attempt with whatever the URL carried');
});

test('the setup wizard configures from the real bank, never a static subject list', () => {
  const setup = read('pages/ExamSetupPage.tsx');
  assert.match(setup, /fetchCbtBank/, 'subjects and limits come from the bank');
  assert.match(setup, /questionCountOptions/, 'the student chooses the number of questions');
  assert.match(setup, /practiceDurationOptions/, 'and the time');
  assert.match(setup, /governedCombination|jambCourses/, 'mock mode derives the combination from governed rules');
  assert.match(setup, /uncovered/, 'and detects a combination the bank cannot serve');
  assert.match(setup, /er-recovery-actions/, 'offering a recovery rather than building a wrong paper');
});

test('answers are saved as they change, and a dropped connection is retried', () => {
  const shell = read('pages/CbtSessionPage.tsx');
  assert.match(shell, /saveConfiguredCbtDraft/, 'each answer reaches the server');
  assert.match(shell, /addEventListener\('online'/, 'a pending save is retried when the connection returns');
  assert.match(shell, /edureach-cbt-pending:/, 'pending answers survive a closed tab');
  assert.match(shell, /visibilitychange/, 'and are flushed when the tab is hidden');
});

test('destructive actions are confirmed and the server enforces them', () => {
  const history = read('src/components/CbtHistoryPanel.tsx');
  assert.match(history, /er-confirm/, 'deleting a practice session asks first');
  assert.match(history, /deleteCbtAttempt/, 'and calls the delete endpoint');
  assert.match(history, /Mock records are kept/, 'mock records are presented as non-deletable');

  const migration = read('supabase/migrations/20261002120000_cbt_practice_and_mock_modes.sql');
  assert.match(migration, /Only practice attempts can be deleted/, 'the rule is enforced in the database, not only the UI');
});

test('the timer is server-authoritative and cannot be reset by a refresh', () => {
  const shell = read('pages/CbtSessionPage.tsx');
  assert.match(shell, /serverTime/, 'the client offsets its clock against the server');
  assert.match(shell, /expiresAt/, 'remaining time is derived from the server expiry');
  assert.ok(!/setSeconds\(/.test(shell), 'no local countdown state can drift from the server');
  assert.match(shell, /Math\.max\(0,/, 'time is never displayed as negative');

  const migration = read('supabase/migrations/20261002120000_cbt_practice_and_mock_modes.sql');
  assert.match(migration, /v_minutes := greatest\(coalesce\(v_exam\.duration_minutes, 120\), 1\)/, 'a mock duration comes from the exam configuration');
  // Expiry is refused inside the RPC (a raise rolls back, so the status change is
  // the server's job) and the server performs it with an owner-scoped update.
  assert.match(migration, /raise exception 'This CBT attempt has expired\.'/, 'a late save or submit is refused');
  const server = read('server.ts');
  assert.match(server, /async function expireCbtAttempt/, 'the server owns the expired transition');
  assert.match(server, /if \(\/expired\/i\.test\(message\)\) await expireCbtAttempt/, 'and applies it when the RPC refuses');
});

test('question positions and subjects are stated per question', () => {
  const shell = read('pages/CbtSessionPage.tsx');
  assert.match(shell, /Question \{index \+ 1\} of \{questions\.length\}/, 'the position is always visible');
  assert.match(shell, /er-exam-subject-pill/, 'and so is the subject');
  assert.match(shell, /er-exam-subject-rail/, 'with the paper structure shown across subjects');
});

test('the offline strategy never replaces the page', () => {
  const banner = read('src/components/ConnectionBanner.tsx');
  assert.match(banner, /role="status"/, 'the strip is announced politely, not as an alert');
  assert.ok(!/window\.location\.reload|location\.href =/.test(banner), 'it never forces a navigation or reload');
  const layout = read('src/components/HubLayout.tsx');
  assert.match(layout, /ConnectionBanner/, 'the strip is mounted for the whole portal');

  const sw = read('public/sw.js');
  assert.ok(!/self\.location\.replace|offline\.html/.test(sw), 'the service worker does not hijack navigation to an offline page');
});
