import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { draftKeyForAccount, readPendingSubmission, saveServiceDraft, prepareServiceSubmission } from '../src/lib/serviceSubmissionRecovery';

const dom = new JSDOM('', { url: 'https://example.test' });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: dom.window.sessionStorage });
const key = draftKeyForAccount('student-a', 'results');

test('pending key and original details survive ordinary edits and reload-equivalent reads', () => {
  sessionStorage.clear();
  saveServiceDraft(key, { fullName: 'Synthetic Student' }, 3);
  const first = prepareServiceSubmission(key, { fullName: 'Synthetic Student', notes: 'original' });
  saveServiceDraft(key, { fullName: 'Changed Student' }, 2);
  assert.deepEqual(readPendingSubmission(key), first);
  assert.deepEqual(prepareServiceSubmission(key, first.details), first);
  assert.throws(() => prepareServiceSubmission(key, { fullName: 'Changed Student' }), /review.*previous/i);
  assert.notEqual(draftKeyForAccount('student-a', 'results'), draftKeyForAccount('student-b', 'results'));
});

test('unavailable or corrupted storage refuses to create a new pending identity', () => {
  sessionStorage.clear();
  sessionStorage.setItem(key, '{bad json');
  assert.throws(() => prepareServiceSubmission(key, {}), /draft.*unavailable/i);
  assert.equal(sessionStorage.getItem(key), '{bad json');
  sessionStorage.setItem(key, JSON.stringify({ pending: { key: 'invalid' } }));
  assert.throws(() => prepareServiceSubmission(key, {}), /draft.*unavailable/i);
  const proto = Object.getPrototypeOf(sessionStorage);
  const set = proto.setItem;
  try {
    sessionStorage.clear();
    proto.setItem = () => { throw new Error('denied'); };
    assert.throws(() => prepareServiceSubmission(key, {}), /draft.*unavailable/i);
  } finally { proto.setItem = set; }
});
