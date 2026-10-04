import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  clientErrorKind,
  reportClientError,
  resetClientErrorReporting,
  type ClientErrorSource,
} from '../src/lib/errorTelemetry';

// P2-2: the browser had no error signal. These tests pin the two properties the
// fix is worth having for — it reports that something failed, and it never
// reports what was in the failure.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/lib/errorTelemetry.ts'), 'utf8');

interface Captured {
  event: string;
  metadata: Record<string, unknown>;
}

function capture(): { calls: Captured[]; emit: (event: 'client_error', payload: { metadata: Record<string, unknown> }) => void } {
  const calls: Captured[] = [];
  return {
    calls,
    emit: (event, payload) => calls.push({ event, metadata: payload.metadata }),
  };
}

test('the error constructor name is the only detail that survives', () => {
  assert.equal(clientErrorKind(new TypeError('student jane@example.com did this')), 'TypeError');
  assert.equal(clientErrorKind(new RangeError('x')), 'RangeError');
  const renamed = new Error('secret');
  renamed.name = 'some message with spaces';
  assert.equal(clientErrorKind(renamed), 'Unknown', 'a non-identifier name is not sent');
  assert.equal(clientErrorKind('a thrown string'), 'NonErrorThrown');
  assert.equal(clientErrorKind(42), 'NonErrorThrown');
  assert.equal(clientErrorKind(undefined), 'Unknown');
  assert.equal(clientErrorKind({ message: 'plain object' }), 'Unknown');
});

test('a report carries the source enum and the kind, nothing else', () => {
  resetClientErrorReporting();
  const { calls, emit } = capture();
  assert.equal(reportClientError('boundary', new TypeError('message must not travel'), emit), true);
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.event, 'client_error');
  assert.deepEqual(call.metadata, { source: 'boundary', kind: 'TypeError' });
  assert.equal('message' in call.metadata, false);
  assert.equal('stack' in call.metadata, false);
});

test('the same failure is reported once per session, and reports are capped', () => {
  resetClientErrorReporting();
  const { calls, emit } = capture();
  const first = new Error('a');
  const second = new Error('b');
  second.name = 'NetworkError';
  assert.equal(reportClientError('window_error', first, emit), true);
  assert.equal(reportClientError('window_error', first, emit), false, 'duplicate suppressed');
  assert.equal(reportClientError('window_error', second, emit), true, 'a different kind still reports');
  assert.equal(calls.length, 2);

  // Cap: 30 distinct kinds, at most 10 reports reach the transport.
  for (let index = 0; index < 30; index += 1) {
    const error = new Error('x');
    error.name = `Err${index}`;
    reportClientError('unhandled_rejection', error, emit);
  }
  assert.ok(calls.length <= 10, `expected a cap of 10, got ${calls.length}`);
});

test('telemetry can never become the second error', () => {
  resetClientErrorReporting();
  const throwing = () => {
    throw new Error('transport down');
  };
  assert.doesNotThrow(() => reportClientError('boundary', new Error('first'), throwing));
  assert.equal(reportClientError('boundary', new Error('first'), throwing), false);
});

test('every listener is production-only and the module sends no free text', () => {
  assert.match(source, /import\.meta\.env\?\.PROD/, 'global listeners must not install in dev or tests');
  assert.match(source, /addEventListener\('unhandledrejection'/);
  assert.match(source, /addEventListener\('error'/);
  // The metadata object is built from `source` and `kind` only; a message or a
  // stack reaching it would be the whole bug this test exists to prevent.
  assert.doesNotMatch(source, /error\.message|error\.stack|\.componentStack\s*[,}]/);
  const emitted: ClientErrorSource[] = ['boundary', 'window_error', 'unhandled_rejection'];
  assert.equal(new Set(emitted).size, 3);
});
