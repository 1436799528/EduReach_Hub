import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Regression cover for audit P0-4 — a partially-migrated database took the whole
// opportunities surface down.
//
// `GET /api/opportunities` and its detail route selected the newest columns
// unconditionally (`subcategory`, `education_levels`, `work_mode`, `is_featured`).
// PostgREST answers "column does not exist" for a select naming a column the
// database lacks, the handler rethrew, and every jobs page got a 503 — even
// though the data was there and only the newest fields were missing.
//
// The stub PostgREST below rejects a select that names a column its simulated
// database does not have, which is exactly how the failure appeared in
// production. Each test walks one migration further back.

const ROW = {
  id: 'opp-1',
  title: 'MTN Foundation Scholarship',
  organisation: 'MTN Foundation',
  category: 'scholarship',
  description: 'Undergraduate support',
  link_url: 'https://example.org/apply',
  deadline: '2026-11-30',
  locations: 'Nigeria',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  closed_at: null,
  last_verified_at: '2026-10-02T00:00:00Z',
  source_name: 'MTN Foundation',
  eligibility: 'Undergraduates in STEM',
  subcategory: 'undergraduate scholarship',
  education_levels: ['undergraduate'],
  disciplines: ['engineering'],
  work_mode: 'not-specified',
  is_featured: true,
};

/** Columns the simulated database has. Mutated per test. */
let available = new Set(Object.keys(ROW));

const stub = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json');

  if (url.pathname.startsWith('/rest/v1/opportunities')) {
    const select = url.searchParams.get('select') || '';
    const missing = select
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean)
      .filter((column) => !available.has(column));
    if (missing.length) {
      // This is how PostgREST reports a select over an unknown column.
      res.statusCode = 400;
      return res.end(JSON.stringify({
        message: `column opportunities.${missing[0]} does not exist`,
        code: '42703',
      }));
    }
    const single = url.searchParams.has('id');
    if (single) {
      const wanted = url.searchParams.get('id') || '';
      if (!wanted.includes(ROW.id)) return res.end('null');
      return res.end(JSON.stringify(ROW));
    }
    return res.end(JSON.stringify([ROW]));
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return res.end('true');
  return res.end('[]');
});
stub.listen(0, '127.0.0.1');
await once(stub, 'listening');
const stubAddress = stub.address();
if (!stubAddress || typeof stubAddress === 'string') throw new Error('No stub port');

Object.assign(process.env, {
  NETLIFY: 'true',
  NODE_ENV: 'production',
  VITE_SUPABASE_URL: `http://127.0.0.1:${stubAddress.port}`,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_opportunity_fallback_test',
  SUPABASE_SECRET_KEY: '',
});

const { app } = await import('../server');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;

after(() => Promise.all([
  new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  new Promise<void>((resolve, reject) => stub.close((error) => (error ? reject(error) : resolve()))),
]));

test('a fully migrated database returns the discovery fields', async () => {
  available = new Set(Object.keys(ROW));
  const response = await fetch(`${base}/api/opportunities`);
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].subcategory, 'undergraduate scholarship');
  assert.equal(body.items[0].is_featured, true);
});

test('a database missing the discovery migration still serves the catalogue', async () => {
  available = new Set(Object.keys(ROW).filter((column) => ![
    'subcategory', 'education_levels', 'disciplines', 'work_mode', 'is_featured',
  ].includes(column)));

  const response = await fetch(`${base}/api/opportunities`);
  assert.equal(response.status, 200, 'the list must degrade, not 503');
  const body = await response.json() as any;
  assert.equal(body.items.length, 1);
  // The point of the tiering: provenance that *is* present is still reported.
  assert.equal(body.items[0].last_verified_at, '2026-10-02T00:00:00Z');
  assert.equal(body.items[0].source_name, 'MTN Foundation');
  assert.equal(body.items[0].eligibility, 'Undergraduates in STEM');
});

test('a database missing provenance and eligibility falls back to the base columns', async () => {
  available = new Set(['id', 'title', 'organisation', 'category', 'description', 'link_url',
    'deadline', 'locations', 'is_active', 'created_at', 'updated_at']);

  const response = await fetch(`${base}/api/opportunities`);
  assert.equal(response.status, 200, 'the oldest supported schema must still serve');
  const body = await response.json() as any;
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].title, 'MTN Foundation Scholarship');
});

test('the detail route degrades through the same tiers', async () => {
  available = new Set(Object.keys(ROW).filter((column) => ![
    'subcategory', 'education_levels', 'disciplines', 'work_mode', 'is_featured',
  ].includes(column)));

  const response = await fetch(`${base}/api/opportunities/${ROW.id}`);
  assert.equal(response.status, 200, 'the detail page must degrade, not 503');
  const body = await response.json() as any;
  assert.equal(body.item.id, ROW.id);
  assert.equal(body.item.source_name, 'MTN Foundation');
});

test('a genuinely absent opportunity is still a 404', async () => {
  available = new Set(Object.keys(ROW));
  const response = await fetch(`${base}/api/opportunities/does-not-exist`);
  assert.equal(response.status, 404);
});
