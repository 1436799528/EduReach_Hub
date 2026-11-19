import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  createReadinessReporter,
  errorFacts,
  EventRateLimiter,
  log,
  requestIdFor,
  sanitizeContext,
  setLogSink,
  type LogRecord,
} from '../lib/observability';

/**
 * The server log is a contract: one JSON object per line, a real severity, and
 * no credential or personal value in the payload. These tests pin the contract
 * so a later "just log the whole error" change cannot quietly undo it.
 */

const records: Array<{ record: LogRecord; stream: 'stdout' | 'stderr'; line: string }> = [];

function capture(): void {
  records.length = 0;
  setLogSink((record, stream) => records.push({ record, stream, line: JSON.stringify(record) }));
}

afterEach(() => setLogSink(null));

test('one event is one JSON line, with the fields a log drain queries on', () => {
  capture();
  log.info('example.event', { route: 'GET /api/health', duration_ms: 12 });

  assert.equal(records.length, 1);
  const { record, stream, line } = records[0];
  assert.equal(stream, 'stdout', 'info goes to stdout');
  assert.equal(record.level, 'info');
  assert.equal(record.event, 'example.event');
  assert.equal(record.service, 'edureach-api');
  assert.equal(typeof record.env, 'string');
  assert.match(String(record.ts), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(record.route, 'GET /api/health');
  assert.equal(record.duration_ms, 12);
  assert.ok(!line.includes('\n'), 'a record never spans lines');
});

test('warn and above go to stderr so the error stream can be alerted on alone', () => {
  capture();
  log.debug('level.debug');
  log.info('level.info');
  log.warn('level.warn');
  log.error('level.error');
  log.critical('level.critical');

  assert.deepEqual(
    records.map((entry) => [entry.record.event, entry.stream]),
    [
      ['level.debug', 'stdout'],
      ['level.info', 'stdout'],
      ['level.warn', 'stderr'],
      ['level.error', 'stderr'],
      ['level.critical', 'stderr'],
    ],
  );
});

test('a credential-shaped key is redacted instead of printed', () => {
  const safe = sanitizeContext({
    authorization: 'Bearer sb_secret_synthetic_value',
    token: 'synthetic-token-value',
    password: 'synthetic-password-value',
    service_role_key: 'synthetic-service-role-value',
    headers: { cookie: 'session=synthetic', accept: 'application/json' },
    user_id: 'u_1',
  });
  const line = JSON.stringify(safe);
  for (const secret of [
    'synthetic-token-value',
    'synthetic-password-value',
    'synthetic-service-role-value',
    'sb_secret_synthetic_value',
    'session=synthetic',
  ]) {
    assert.ok(!line.includes(secret), `${secret} must not reach the log`);
  }
  assert.equal(safe.authorization, '[redacted]');
  assert.equal(safe.user_id, 'u_1', 'a plain identifier is still useful');
  assert.deepEqual(safe.headers, { cookie: '[redacted]', accept: 'application/json' });
});

test('strings are capped, nesting is bounded and the key count is bounded', () => {
  const long = 'x'.repeat(5000);
  assert.equal((sanitizeContext({ detail: long }).detail as string).length, 301);

  const deep = { a: { b: { c: { d: 'too deep to print' } } } };
  assert.ok(!JSON.stringify(sanitizeContext(deep)).includes('too deep to print'));

  const wide = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`k${index}`, index]));
  assert.equal(Object.keys(sanitizeContext(wide)).length, 24);
});

test('an error is reduced to its kind, SQLSTATE and status - never its message', () => {
  const error = Object.assign(new Error('duplicate key value violates unique constraint "profiles_email_key"'), {
    code: '23505',
    status: 409,
  });
  const facts = errorFacts(error);
  assert.deepEqual(facts, { error_name: 'Error', error_code: '23505', error_status: 409 });

  capture();
  log.error('db.write_failed', { ...facts });
  assert.ok(!records[0].line.includes('profiles_email_key'), 'a driver message can quote a value');

  // A thrown string has no safe content at all.
  assert.deepEqual(errorFacts('a raw string'), { error_name: 'NonErrorThrown' });
});

test('the correlation id prefers the platform id and refuses a header that is not id-shaped', () => {
  assert.equal(requestIdFor({ 'x-nf-request-id': '01JABCDEF0123456789' }), '01JABCDEF0123456789');
  assert.equal(
    requestIdFor({ 'x-nf-request-id': 'not valid!', 'x-request-id': 'req_0123456789' }),
    'req_0123456789',
    'an invalid platform id falls through to the next candidate',
  );
  // A header must not be able to smuggle a payload into every line of a request.
  const smuggled = requestIdFor({ 'x-correlation-id': `token=${'y'.repeat(40)}` });
  assert.notEqual(smuggled, `token=${'y'.repeat(40)}`);
  assert.match(smuggled, /^[A-Za-z0-9._:-]{8,64}$/, 'the fallback is a generated uuid');
});

test('repeated events are collapsed and the suppressed count is reported once', () => {
  capture();
  let clock = 0;
  const limiter = new EventRateLimiter(2, 1_000, () => clock);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false, 'the third event in the window is suppressed');
  assert.equal(limiter.allow('k'), false);

  clock = 1_001; // window reopens
  assert.equal(limiter.allow('k'), true);
  const suppressed = records.filter((entry) => entry.record.event === 'log.suppressed');
  assert.equal(suppressed.length, 1);
  assert.equal(suppressed[0].record.suppressed_in_window, 2);
});

test('readiness reports the transition, not every poll, and repeats a stuck degradation', () => {
  capture();
  let clock = 0;
  const report = createReadinessReporter({ reminderMs: 60_000, now: () => clock });

  report(true, [], 12);
  assert.equal(records.length, 0, 'healthy is the normal state and is not logged');

  report(false, ['database'], 9_000);
  report(false, ['database'], 9_100);
  report(false, ['database'], 9_200);
  const degraded = () => records.filter((entry) => entry.record.event === 'health.degraded');
  assert.equal(degraded().length, 1, 'a monitor polling every minute must not produce a line per poll');
  assert.deepEqual(degraded()[0].record.failing_checks, ['database']);

  clock = 61_000;
  report(false, ['database'], 9_300);
  assert.equal(degraded().length, 2, 'a stuck degradation is repeated once per reminder window');

  report(true, [], 20);
  assert.equal(records.at(-1)?.record.event, 'health.recovered');
  assert.equal(records.at(-1)?.stream, 'stdout');
});

test('server runtime code logs through this module, not through console', async () => {
  // A gate, not a style rule: the value of the structured log disappears the
  // moment a new route goes back to `console.error(label, error)`. The only
  // exception is the fatal bootstrap line, which prints the thrown error to a
  // dying process that has no request context (see server.ts).
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('..', import.meta.url).pathname;

  const files = ['server.ts', 'lib/authorization.ts', 'lib/rate-limit.ts', 'lib/errors.ts'];
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.ts') ? [path] : [];
    });
  files.push(...walk('src/server'), ...walk('netlify/functions'));

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const line of source.split('\n')) {
      if (/console\.(error|warn)\(/.test(line)) offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    ["server.ts: console.error('Unable to start EduReach:', error);"],
    'new free-text error logging belongs in lib/observability.ts',
  );
});
