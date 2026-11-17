import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import {
  intelligenceCache,
  invalidateInstitutionCache,
  registerInstitutionIntelligenceRoutes,
} from '../src/server/institutionIntelligence';

// A contract stub for Supabase, not a live project. The route module is handed
// this client directly, so these tests exercise the real handlers: the public
// assembly and its cache headers, the admin gate, the publication refusal and
// the cache invalidation a publish performs.
//
// What this closes: "the admin endpoints are uncached", "a draft cannot leak
// through the public read", "publishing requires verification" and "a publish
// invalidates the assembled response" were prose before this file.

type Row = Record<string, unknown>;

const INST_A = '11111111-1111-4111-8111-111111111111';
const INST_MISSING = '99999999-9999-4999-8999-999999999999';
const PROGRAMME_PUBLISHED = '44444444-4444-4444-8444-444444444444';
const PROGRAMME_DRAFT = '55555555-5555-4555-8555-555555555555';
const UNIT_VERIFIED = '66666666-6666-4666-8666-666666666666';
const UNIT_UNVERIFIED = '77777777-7777-4777-8777-777777777777';

const calls: string[] = [];

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: Array<{ column: string; kind: 'eq' | 'in'; value: unknown }> = [];
  private orderings: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private singleRow = false;
  private countMode = false;

  constructor(private store: Store, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count === 'exact') this.countMode = true;
    return this;
  }

  eq(column: string, value: unknown) { this.filters.push({ column, kind: 'eq', value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ column, kind: 'in', value: values }); return this; }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderings.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number) { this.rowLimit = count; return this; }
  maybeSingle() { this.singleRow = true; return this.run(); }
  single() { this.singleRow = true; return this.run(); }
  insert(payload: Row | Row[]) { this.mode = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.mode = 'update'; this.payload = payload; return this; }
  upsert(payload: Row, _options?: { onConflict?: string }) { this.mode = 'upsert'; this.payload = payload; return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => {
      if (filter.kind === 'eq') return row[filter.column] === filter.value;
      return (filter.value as unknown[]).includes(row[filter.column]);
    });
  }

  private finish(data: unknown, count?: number) {
    const rows = Array.isArray(data) ? data : data === null ? [] : [data];
    const shaped = this.singleRow ? (rows[0] ?? null) : data;
    return { data: shaped, error: null, count: this.countMode ? count ?? rows.length : undefined };
  }

  async run() {
    calls.push(`${this.mode.toUpperCase()} ${this.table} ${JSON.stringify(this.filters)}`);
    if (this.store.failures.has(this.table)) return { data: null, error: new Error(`${this.table} unavailable`) };
    const rows = this.store.rows.get(this.table) ?? [];
    if (this.mode === 'insert') {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted = incoming.map((row, index) => ({ id: row.id ?? `${this.table}-${rows.length + index + 1}`, ...row }));
      rows.push(...inserted);
      this.store.rows.set(this.table, rows);
      return this.finish(this.singleRow ? inserted[0] : inserted);
    }
    if (this.mode === 'update' || this.mode === 'upsert') {
      const patch = (this.payload ?? {}) as Row;
      let target = rows.filter((row) => this.matches(row));
      if (this.mode === 'upsert' && target.length === 0) {
        const created = { id: patch.id ?? `${this.table}-${rows.length + 1}`, ...patch };
        rows.push(created);
        this.store?.rows.set(this.table, rows);
        target = [created];
      } else {
        for (const row of target) Object.assign(row, patch);
      }
      return this.finish(this.singleRow ? target[0] ?? null : target);
    }
    let selected = rows.filter((row) => this.matches(row));
    for (const ordering of [...this.orderings].reverse()) {
      selected = [...selected].sort((a, b) => {
        const left = String(a[ordering.column] ?? '');
        const right = String(b[ordering.column] ?? '');
        return ordering.ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    const total = selected.length;
    if (this.rowLimit !== null) selected = selected.slice(0, this.rowLimit);
    return this.finish(this.singleRow ? selected[0] ?? null : selected, total);
  }
}

class Store {
  rows = new Map<string, Row[]>();
  failures = new Set<string>();
  from(table: string) { return new Query(this, table); }
}

function seed(store: Store) {
  store.rows.set('institutions', [{
    id: INST_A,
    school_name: 'Synthetic University A',
    acronym: 'SUA',
    state: 'Rivers',
    institution_type: 'university',
    website_url: 'https://a.example.edu.ng/',
    admission_portal_url: null,
    student_portal_url: null,
    post_utme_available: false,
    is_verified: false,
  }]);
  store.rows.set('institution_profiles', [{
    institution_id: INST_A,
    official_name: 'Synthetic University A',
    ownership: 'federal',
    institution_category: 'university',
    year_established: 1975,
    publication_status: 'draft',
    verification_status: 'discovered',
    logo_url: null,
    hero_image_url: null,
    official_website_url: 'https://a.example.edu.ng/',
    admission_portal_url: null,
    student_portal_url: null,
    postgraduate_portal_url: null,
    review_note: null,
    reviewed_by: null,
    last_checked_at: null,
  }]);
  store.rows.set('institution_academic_units', [
    { id: UNIT_VERIFIED, institution_id: INST_A, parent_unit_id: null, unit_type: 'faculty', unit_name: 'Science', slug: 'science', is_active: true, verification_status: 'verified' },
    { id: UNIT_UNVERIFIED, institution_id: INST_A, parent_unit_id: null, unit_type: 'faculty', unit_name: 'Arts', slug: 'arts', is_active: true, verification_status: 'discovered' },
  ]);
  store.rows.set('institution_programme_offerings', [
    { id: PROGRAMME_PUBLISHED, institution_id: INST_A, academic_unit_id: UNIT_VERIFIED, programme_name: 'BSc Physics', programme_code: 'PHY', degree_title: 'BSc', award_level: 'BSc', duration_years: 4, admission_session: '2026/2027', is_active: true, publication_status: 'published', verification_status: 'verified', source_url: 'https://a.example.edu.ng/physics' },
    { id: PROGRAMME_DRAFT, institution_id: INST_A, academic_unit_id: UNIT_UNVERIFIED, programme_name: 'BA History', programme_code: 'HIS', degree_title: 'BA', award_level: 'BA', duration_years: 4, admission_session: '2026/2027', is_active: true, publication_status: 'draft', verification_status: 'discovered', source_url: null },
  ]);
  store.rows.set('institution_admission_routes', []);
  store.rows.set('institution_programme_requirements', []);
  store.rows.set('institution_portal_guides', []);
  store.rows.set('institution_portal_guide_steps', []);
  store.rows.set('institution_admission_benchmarks', []);
  store.rows.set('institution_leadership', []);
  store.rows.set('institution_campuses', []);
  store.rows.set('institution_aliases', []);
  store.rows.set('national_admission_policies', []);
  store.rows.set('institution_fact_evidence', []);
  store.rows.set('edureach_sources', [{ id: 'source-1', name: 'Synthetic source', url: 'https://a.example.edu.ng/', authority: 'A', source_type: 'official' }]);
  store.rows.set('institution_review_overview', [{
    institution_id: INST_A,
    school_name: 'Synthetic University A',
    acronym: 'SUA',
    state: 'Rivers',
    institution_type: 'university',
    official_name: 'Synthetic University A',
    publication_status: 'draft',
    verification_status: 'discovered',
    last_checked_at: null,
    reviewed_by: null,
    logo_url: null,
    hero_image_url: null,
    overview: null,
    official_website_url: 'https://a.example.edu.ng/',
    directory_website_url: 'https://a.example.edu.ng/',
    admission_portal_url: null,
    student_portal_url: null,
    postgraduate_portal_url: null,
    academic_units: 2,
    academic_units_unverified: 1,
    programme_offerings: 2,
    programme_offerings_unverified: 1,
    published_offerings: 1,
    admission_routes: 0,
    admission_routes_with_dates: 0,
    programme_requirements: 0,
    programme_requirements_with_subjects: 0,
    source_records: 1,
    evidence_rows: 0,
    evidence_awaiting_review: 0,
    evidence_last_checked_at: null,
    admission_sessions: ['2026/2027'],
    latest_session: '2026/2027',
    has_official_website: true,
    has_logo: false,
    has_hero_image: false,
    has_portal: false,
  }]);
  store.rows.set('institution_intelligence_completeness', [{
    institution_id: INST_A,
    school_name: 'Synthetic University A',
    state: 'Rivers',
    profile_status: 'draft',
    current_offices: 0,
    verified_campuses: 0,
    verified_units: 1,
    published_offerings: 1,
    offerings_in_review: 0,
    published_benchmarks: 0,
    published_guides: 0,
    facts_awaiting_review: 0,
  }]);
  store.rows.set('student_admission_goals', []);
  store.rows.set('student_admission_goal_attempts', []);
}

function buildApp(options: { store: Store; authorized: boolean }) {
  const app = express();
  app.use(express.json());
  const { store } = options;
  registerInstitutionIntelligenceRoutes(app, {
    requireUser: async () => ({ supabase: store, rpcSupabase: store, user: { id: 'student-1' } }),
    // Same shape as the real middleware: it either authorises the request and
    // attaches the actor, or refuses before any handler runs.
    requireCapability: () => (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!options.authorized) return res.status(401).json({ error: 'Authentication required.' });
      (req as express.Request & { adminUser?: { id: string } }).adminUser = { id: 'admin-1' };
      return next();
    },
    getSupabase: () => store,
    recordAudit: async () => undefined,
  });
  return app;
}

let server: Server;
let baseUrl = '';
let store: Store;

before(async () => {
  store = new Store();
  seed(store);
  const app = buildApp({ store, authorized: true });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
}

async function send(path: string, method: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
}

test('the public read filters every list itself and caches the assembled response', async () => {
  invalidateInstitutionCache(INST_A);
  calls.length = 0;
  const first = await get(`/api/institutions/${INST_A}/intelligence`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  assert.equal(first.headers.get('x-edureach-cache'), 'miss');

  const body = first.body as { offerings: Array<{ id: string }>; academicUnits: Array<{ id: string }>; profile: unknown };
  assert.deepEqual(body.offerings.map((row) => row.id), [PROGRAMME_PUBLISHED], 'the draft programme is not in the public payload');
  assert.deepEqual(body.academicUnits.map((row) => row.id), [UNIT_VERIFIED], 'the unverified unit is not in the public payload');
  assert.equal(body.profile, null, 'a draft profile is not public');

  // The service role bypasses RLS, so the handler must name its own filters.
  const publicQueries = calls.filter((call) => call.startsWith('SELECT'));
  assert.ok(publicQueries.length > 0);
  for (const table of ['institution_programme_offerings', 'institution_academic_units', 'institution_admission_routes', 'institution_portal_guides']) {
    const query = publicQueries.find((call) => call.includes(table));
    assert.ok(query, `${table} was read`);
    assert.match(String(query), /verification_status[\s\S]*verified/, `${table} is filtered to verified rows`);
  }
  const offeringsQuery = publicQueries.find((call) => call.includes('institution_programme_offerings'));
  assert.match(String(offeringsQuery), /publication_status[\s\S]*published/, 'offerings are filtered to published rows');

  // The profile is still a draft, so this payload is deliberately not stored:
  // an empty public page must not outlive the publish that fills it.
  const second = await get(`/api/institutions/${INST_A}/intelligence`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-edureach-cache'), 'miss', 'an unpublished assembly is not cached');
});

test('an unknown institution is a 404 with no cache, never a cached empty page', async () => {
  const response = await get(`/api/institutions/${INST_MISSING}/intelligence`);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('a database failure is a 503 with no cache', async () => {
  store.failures.add('institutions');
  invalidateInstitutionCache(INST_A);
  try {
    const response = await get(`/api/institutions/${INST_A}/intelligence`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally {
    store.failures.delete('institutions');
  }
});

test('every admin read is uncached and doorway-free', async () => {
  for (const path of [
    '/api/admin/institution-intelligence/review',
    '/api/admin/institution-intelligence/institutions',
    '/api/admin/institution-intelligence/cache',
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200, `${path} answered`);
    assert.equal(response.headers.get('cache-control'), 'private, no-store', `${path} must never be cached`);
  }

  const queue = (await get('/api/admin/institution-intelligence/review')).body as {
    summary: { institutionsInCatalogue: number; academicUnits: number; sourceRecords: number; publishedInstitutions: number };
    institutions: unknown[];
  };
  assert.equal(queue.summary.institutionsInCatalogue, 1);
  assert.equal(queue.summary.academicUnits, 2, 'units are counted including unverified ones');
  assert.equal(queue.summary.publishedInstitutions, 0, 'nothing is published in the staging batch');
  assert.equal(queue.institutions.length, 1);
});

test('an unauthorised admin request is refused before any handler runs', async () => {
  const denied = buildApp({ store, authorized: false });
  const deniedServer = denied.listen(0, '127.0.0.1');
  await new Promise((resolve) => deniedServer.once('listening', resolve));
  const deniedUrl = `http://127.0.0.1:${(deniedServer.address() as AddressInfo).port}`;
  try {
    calls.length = 0;
    const response = await fetch(`${deniedUrl}/api/admin/institution-intelligence/review`);
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0, 'the refusal happens before the database is touched');
  } finally {
    await new Promise((resolve) => deniedServer.close(resolve));
  }
});

test('publishing before verifying is refused, and the write does not happen', async () => {
  invalidateInstitutionCache(INST_A);
  const attempt = await send(`/api/admin/institution-intelligence/institutions/${INST_A}/profile`, 'PATCH', {
    section: 'verification',
    values: { publication_status: 'published' },
  });
  assert.equal(attempt.status, 409);
  assert.equal(attempt.body.gate, true);
  assert.match(String(attempt.body.error), /cannot publish|cannot be published|publication gate/i);

  const profile = (store.rows.get('institution_profiles') ?? [])[0];
  assert.equal(profile.publication_status, 'draft', 'the refused write left the row alone');
  assert.equal(profile.verification_status, 'discovered');
});

test('verifying then publishing is allowed, and each publish invalidates the public cache', async () => {
  invalidateInstitutionCache(INST_A);

  const verified = await send(`/api/admin/institution-intelligence/institutions/${INST_A}/profile`, 'PATCH', {
    section: 'verification',
    values: { verification_status: 'verified', review_note: 'Official prospectus checked.' },
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.verification_status, 'verified');
  assert.equal(verified.body.publication_status, 'draft', 'verification did not imply publication');

  const published = await send(`/api/admin/institution-intelligence/institutions/${INST_A}/profile`, 'PATCH', {
    section: 'verification',
    values: { publication_status: 'published' },
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.publication_status, 'published');

  const first = await get(`/api/institutions/${INST_A}/intelligence`);
  assert.equal(first.headers.get('x-edureach-cache'), 'miss');
  assert.ok((first.body as { profile: unknown }).profile, 'the verified and published profile is now public');

  const hit = await get(`/api/institutions/${INST_A}/intelligence`);
  assert.equal(hit.headers.get('x-edureach-cache'), 'hit');

  // Publishing one verified programme leaves its unverified sibling private.
  const programme = await send(`/api/admin/institution-intelligence/programmes/${PROGRAMME_DRAFT}`, 'PATCH', {
    verification_status: 'verified',
    publication_status: 'published',
    source_url: 'https://a.example.edu.ng/history',
  });
  assert.equal(programme.status, 200);

  const afterPublish = await get(`/api/institutions/${INST_A}/intelligence`);
  assert.equal(afterPublish.headers.get('x-edureach-cache'), 'miss', 'the publish invalidated the assembled response');
  const ids = (afterPublish.body as { offerings: Array<{ id: string }> }).offerings.map((row) => row.id).sort();
  assert.deepEqual(ids, [PROGRAMME_DRAFT, PROGRAMME_PUBLISHED].sort(), 'both verified programmes are public, nothing unverified is');
});

test('an unverified programme cannot be published, and stays editable in draft', async () => {
  const unverifiedPublish = await send('/api/admin/institution-intelligence/programmes/55555555-5555-4555-8555-555555555555', 'PATCH', {
    verification_status: 'discovered',
    publication_status: 'published',
  });
  assert.equal(unverifiedPublish.status, 409);
  assert.equal(unverifiedPublish.body.gate, true);

  const editable = await send('/api/admin/institution-intelligence/programmes/55555555-5555-4555-8555-555555555555', 'PATCH', {
    programme_code: 'HIS-2',
    publication_status: 'draft',
  });
  assert.equal(editable.status, 200, 'an unverified record is still editable by an administrator');
  assert.equal(editable.body.offering.programme_code, 'HIS-2');
  assert.equal(editable.body.offering.publication_status, 'draft');
});

test('the student goal read is private and scoped to the session', async () => {
  const response = await get('/api/student/admission-goal');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((response.body as { goal: unknown }).goal, null);
});

test('the cache counters endpoint reports the policy, not content', async () => {
  const response = await get('/api/admin/institution-intelligence/cache');
  const body = response.body as { cache: { size: number }; policy: string; note: string };
  assert.equal(body.policy, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  assert.ok(body.cache.size >= 0);
  assert.match(body.note, /CDN/);
});

test('the module keeps one shared cache instance', () => {
  assert.ok(intelligenceCache);
  intelligenceCache.clear();
});
