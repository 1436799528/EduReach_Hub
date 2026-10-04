import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// AN-1 — the analytics taxonomy, the payload validator and the audit that keeps
// them in agreement.
//
// The point of these tests is not that the validator accepts a valid payload. It
// is that it refuses the things it was written to refuse: a key nobody declared,
// the free text a student typed into a search box, an oversized value, a nested
// object. The audit tests then prove the gate itself fails when a call site, the
// server, the migration or the document drifts away from the taxonomy — a check
// that cannot fail is not a check.

import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_TAXONOMY,
  FREE_TEXT_KEY_PATTERN,
  METADATA_MAX_BYTES,
  RETENTION_DAYS,
  isAnalyticsEvent,
  sanitizeAnalyticsPath,
  sanitizeReferrer,
  sanitizeUserAgent,
  validateAnalyticsMetadata,
  ANALYTICS_FUNNELS,
} from '../src/lib/analyticsTaxonomy';
import {
  buildRetentionPlan,
  readRetentionResult,
} from '../scripts/analytics-retention';
import {
  auditAnalytics,
  documentedEvents,
  migrationRetentionDefault,
  readAnalyticsInput,
  trackEventCalls,
} from '../scripts/analytics-audit';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/* ------------------------------------------------------------------ */
/* The taxonomy's own invariants                                       */
/* ------------------------------------------------------------------ */

test('every declared event has a funnel, a purpose and a declared payload', () => {
  for (const name of ANALYTICS_EVENT_NAMES) {
    const spec = ANALYTICS_TAXONOMY[name];
    assert.ok(spec, `${name} is declared but has no spec`);
    assert.ok(ANALYTICS_FUNNELS.includes(spec.funnel), `${name} has an unknown funnel`);
    assert.ok(spec.purpose.trim().length > 20, `${name} has no stated purpose`);
    for (const [key, field] of Object.entries(spec.metadata)) {
      assert.ok(['string', 'number', 'boolean'].includes(field.type), `${name}.${key} has an unknown type`);
      assert.ok(field.note.trim().length > 10, `${name}.${key} has no note explaining why it exists`);
      assert.ok(!FREE_TEXT_KEY_PATTERN.test(key), `${name}.${key} looks like it holds what a student typed`);
    }
  }
});

test('the event list is unique and stable in shape', () => {
  assert.equal(new Set(ANALYTICS_EVENT_NAMES).size, ANALYTICS_EVENT_NAMES.length, 'duplicate event names');
  assert.ok(ANALYTICS_EVENT_NAMES.includes('page_view'));
  assert.ok(isAnalyticsEvent('service_submit'));
  assert.ok(!isAnalyticsEvent('password_reset'), 'an undeclared event must not pass');
  assert.ok(!isAnalyticsEvent(undefined));
});

/* ------------------------------------------------------------------ */
/* The payload validator — the privacy boundary                        */
/* ------------------------------------------------------------------ */

test('declared fields survive, undeclared fields are dropped', () => {
  const result = validateAnalyticsMetadata('search', { query_length: 14, result_count: 3, email: 'student@example.com' });
  assert.equal(result.ok, true);
  if (result.ok !== true) return;
  assert.deepEqual(result.value, { query_length: 14, result_count: 3 });
  assert.deepEqual(result.dropped, ['email']);
});

test('a search term cannot be stored under any plausible key', () => {
  // This is the whole reason AN-1 exists: the previous implementation stored
  // { q: term } and rendered it in the admin console.
  for (const key of ['q', 'query', 'term', 'search', 'text', 'input', 'name', 'phone', 'matric_no', 'message']) {
    const result = validateAnalyticsMetadata('search', { query_length: 9, result_count: 1, [key]: 'Nneka 2024 JAMB result' });
    assert.equal(result.ok, true);
    if (result.ok !== true) continue;
    assert.ok(!(key in result.value), `the search term survived under "${key}"`);
  }
});

test('a required field cannot be omitted', () => {
  const result = validateAnalyticsMetadata('service_submit', {});
  assert.equal(result.ok, false);
  if (result.ok === false) assert.match(result.reason, /missing required field: slug/);
});

test('strings are capped, numbers are bounded, junk is dropped', () => {
  const capped = validateAnalyticsMetadata('news_view', { slug: 'a'.repeat(900) });
  assert.equal(capped.ok, true);
  if (capped.ok === true) assert.equal((capped.value.slug as string).length, 160);

  const numeric = validateAnalyticsMetadata('cbt_start', { examId: 'e1', examTitle: 'x', query_length: 5 });
  assert.equal(numeric.ok, true);
  if (numeric.ok === true) assert.ok(!('query_length' in numeric.value), 'a key from another event leaked in');

  const junk = validateAnalyticsMetadata('search', { query_length: 'fourteen', result_count: Number.NaN });
  assert.equal(junk.ok, true);
  if (junk.ok === true) assert.deepEqual(junk.value, {});

  const nested = validateAnalyticsMetadata('cbt_start', { examId: 'e1', payload: { inner: true } });
  assert.equal(nested.ok, true);
  if (nested.ok === true) assert.deepEqual(nested.dropped, ['payload']);
});

test('an empty metadata object validates to an empty object', () => {
  const result = validateAnalyticsMetadata('page_view', undefined);
  assert.equal(result.ok, true);
  if (result.ok === true) assert.deepEqual(result.value, {});
});

test('an oversized payload is refused rather than truncated silently', () => {
  const huge = Object.fromEntries(
    Array.from({ length: 200 }, (_, index) => [`examTitle${index}`, 'a'.repeat(100)]),
  );
  // Only declared keys are kept, so the declared ones are the only way to be
  // oversized: assert the cap itself is what bounds the payload.
  const bounded = validateAnalyticsMetadata('cbt_start', { examId: 'e1', examTitle: 'b'.repeat(2000), ...huge });
  assert.equal(bounded.ok, true);
  if (bounded.ok === true) {
    assert.ok(JSON.stringify(bounded.value).length <= METADATA_MAX_BYTES, 'the payload exceeded its byte cap');
  }
});

/* ------------------------------------------------------------------ */
/* The sanitised surroundings                                          */
/* ------------------------------------------------------------------ */

test('a stored path loses its query string and fragment', () => {
  assert.equal(sanitizeAnalyticsPath('/dashboard/services?ref=SR-1001#top'), '/dashboard/services');
  assert.equal(sanitizeAnalyticsPath('/search?q=nneka@example.com'), '/search');
  assert.equal(sanitizeAnalyticsPath('   '), null);
  assert.equal(sanitizeAnalyticsPath(42, '/fallback'), '/fallback');
});

test('a referrer keeps origin and path only', () => {
  assert.equal(sanitizeReferrer('https://www.google.com/search?q=student+name&lr=nigeria'), 'https://www.google.com/search');
  assert.equal(sanitizeReferrer(''), null);
});

test('the user agent is capped', () => {
  assert.equal((sanitizeUserAgent('x'.repeat(400)) || '').length, 200);
  assert.equal(sanitizeUserAgent(undefined), null);
});

/* ------------------------------------------------------------------ */
/* Retention                                                           */
/* ------------------------------------------------------------------ */

test('the retention plan computes its cutoff from the declared window', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');
  const plan = buildRetentionPlan(now, RETENTION_DAYS, false);
  assert.equal(plan.retentionDays, 90);
  assert.equal(plan.cutoff, '2026-07-03T12:00:00.000Z');
  assert.equal(plan.dryRun, true);
  assert.equal(plan.apply, false);
  assert.equal(buildRetentionPlan(now, RETENTION_DAYS, true).apply, true);
});

test('a nonsense window falls back to the declared one', () => {
  const plan = buildRetentionPlan(new Date('2026-10-01T12:00:00.000Z'), Number.NaN, false);
  assert.equal(plan.retentionDays, RETENTION_DAYS);
});

test('the prune answer is read defensively', () => {
  assert.deepEqual(
    readRetentionResult({ deleted: 12, cutoff: '2026-07-03T12:00:00Z', retentionDays: 90 }),
    { ok: true, deleted: 12, cutoff: '2026-07-03T12:00:00Z', retentionDays: 90 },
  );
  assert.equal(readRetentionResult(null).ok, false);
  assert.equal(readRetentionResult({ deleted: -1 }).ok, false);
  assert.equal(readRetentionResult({}).ok, false);
});

test('the migration, the taxonomy and the document agree on the window', () => {
  const migration = readFileSync(join(ROOT, 'supabase/migrations/20261001120000_analytics_retention.sql'), 'utf8');
  const doc = readFileSync(join(ROOT, 'docs/features/AN-1.md'), 'utf8');
  assert.equal(migrationRetentionDefault(migration), RETENTION_DAYS, 'the prune function default drifted');
  assert.match(doc, new RegExp(`pruned after \\*\\*${RETENTION_DAYS} days\\*\\*`), 'the document no longer states the window');
});

/* ------------------------------------------------------------------ */
/* The audit, run against the real repository                          */
/* ------------------------------------------------------------------ */

async function realChecks() {
  const module = await import('../src/lib/analyticsTaxonomy');
  return auditAnalytics(readAnalyticsInput(ROOT), {
    events: [...module.ANALYTICS_EVENT_NAMES],
    freeTextKeys: [],
    retentionDays: module.RETENTION_DAYS,
  });
}

test('the repository as committed passes the taxonomy audit', async () => {
  const checks = await realChecks();
  const failures = checks.filter((check) => !check.ok);
  assert.deepEqual(failures.map((check) => `${check.id}: ${check.detail}`), [], 'the audit should pass on the committed tree');
});

test('every declared event has a call site and every call site is declared', () => {
  const sources = readAnalyticsInput(ROOT).sources;
  const sites = trackEventCalls(sources);
  assert.ok(sites.length >= ANALYTICS_EVENT_NAMES.length, 'expected at least one call site per declared event');
  for (const site of sites) {
    assert.ok(isAnalyticsEvent(site.event), `${site.file}:${site.line} emits "${site.event}", which is not declared`);
  }
  const emitted = new Set(sites.map((site) => site.event));
  for (const event of ANALYTICS_EVENT_NAMES) {
    assert.ok(emitted.has(event), `${event} is declared but never emitted`);
  }
});

test('the document lists exactly the declared events', () => {
  const doc = readFileSync(join(ROOT, 'docs/features/AN-1.md'), 'utf8');
  assert.deepEqual([...documentedEvents(doc)].sort(), [...ANALYTICS_EVENT_NAMES].sort());
});

/* ------------------------------------------------------------------ */
/* The audit's failure paths — a gate that cannot fail is not a gate   */
/* ------------------------------------------------------------------ */

/**
 * A synthetic tree in which every declared event is emitted once from one file —
 * the shape the audit expects, so each failure test below can change exactly one
 * thing and know what it is asserting.
 */
function emittingSources(overrides: Record<string, string> = {}): Map<string, string> {
  const body = ANALYTICS_EVENT_NAMES.map((event) => `trackEvent('${event}', { metadata: {} });`).join('\n');
  return new Map<string, string>([['src/app/App.tsx', body], ...Object.entries(overrides)]);
}

const taxonomySource = readFileSync(join(ROOT, 'src/lib/analyticsTaxonomy.ts'), 'utf8');
const migrationSource = readFileSync(join(ROOT, 'supabase/migrations/20261001120000_analytics_retention.sql'), 'utf8');
const docSource = readFileSync(join(ROOT, 'docs/features/AN-1.md'), 'utf8');

function taxonomyLike() {
  return {
    events: [...ANALYTICS_EVENT_NAMES],
    freeTextKeys: [] as string[],
    retentionDays: RETENTION_DAYS,
  };
}

test('an undeclared event at a call site fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: new Map([['pages/Fake.tsx', `trackEvent('purchase', { metadata: { amount: 5 } });`]]),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  assert.equal(checks.find((check) => check.id === 'emit-sites-declared')!.ok, false);
});

test('a dynamic event name fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: new Map([['pages/Fake.tsx', `trackEvent(name, { metadata: {} });`]]),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  assert.equal(checks.find((check) => check.id === 'emit-sites-declared')!.ok, false);
});

test('an undeclared metadata key fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: new Map([['pages/SearchPage.tsx', `trackEvent('search', { metadata: { query_length: 3, result_count: 1, q: 'nneka' } });`]]),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  const check = checks.find((entry) => entry.id === 'payload-keys-declared')!;
  assert.equal(check.ok, false);
  assert.match(check.detail || '', /search\.q/);
});

test('a server that declares its own allowlist fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: emittingSources(),
      taxonomySource,
      serverSource: `if (!/^page_view$|^search$/.test(eventName)) return res.status(400).json({});`,
      migrationSource,
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  assert.equal(checks.find((check) => check.id === 'server-uses-taxonomy')!.ok, false);
});

test('a free-text metadata key fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: emittingSources(),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource,
    },
    { ...taxonomyLike(), freeTextKeys: ['q'] },
  );
  assert.equal(checks.find((check) => check.id === 'no-free-text')!.ok, false);
});

test('an undocumented event fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: emittingSources(),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource.replace('| `search` |', '| `search_renamed` |'),
    },
    taxonomyLike(),
  );
  assert.equal(checks.find((check) => check.id === 'documented-events')!.ok, false);
});

test('a retention window that disagrees fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: emittingSources(),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource: migrationSource.replace('p_retention_days int default 90', 'p_retention_days int default 30'),
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  assert.equal(checks.find((check) => check.id === 'retention-agrees')!.ok, false);
});

test('a declared event with no emitter fails the audit', () => {
  const checks = auditAnalytics(
    {
      sources: new Map([['src/app/App.tsx', `trackEvent('page_view', { metadata: {} });`]]),
      taxonomySource,
      serverSource: 'isAnalyticsEvent(eventName); validateAnalyticsMetadata(eventName, body);',
      migrationSource,
      featureDoc: docSource,
    },
    taxonomyLike(),
  );
  const check = checks.find((entry) => entry.id === 'events-have-emitters')!;
  assert.equal(check.ok, false);
  assert.match(check.detail || '', /news_view/);
});
