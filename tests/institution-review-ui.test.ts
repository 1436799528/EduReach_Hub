import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { capabilityForAdminPath } from '../src/lib/capabilities';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const page = read('pages/AdminInstitutionIntelligencePage.tsx');
const api = read('src/lib/api.ts');
const routes = read('src/app/routes.tsx');
const layout = read('pages/AdminLayout.tsx');

test('the review page is reachable from the console and gated on institution.read', () => {
  assert.ok(routes.includes("'/admin/institution-intelligence'"), 'the route exists');
  assert.ok(routes.includes('AdminInstitutionIntelligencePage'), 'the route renders the page');
  assert.ok(layout.includes("href: '/admin/institution-intelligence'"), 'the sidebar links to it');
  const navLine = layout.split('\n').find((line) => line.includes("href: '/admin/institution-intelligence'")) ?? '';
  assert.ok(navLine.includes("capability: 'institution.read'"), 'the nav entry declares its capability');
  assert.equal(capabilityForAdminPath('/admin/institution-intelligence'), 'institution.read');
  assert.equal(capabilityForAdminPath('/admin/institution-intelligence/evidence/123'), 'institution.read');
});

test('every recorded decision is one of the four honest outcomes', () => {
  for (const status of ['verified', 'disputed', 'outdated', 'unpublished_by_institution']) {
    assert.ok(page.includes(`status: '${status}'`), `${status} is offered as a decision`);
  }
  // No "probably", "likely" or "assume" outcome exists: a reviewer either has a
  // source that says it, a source that contradicts it, an older session, or a
  // withdrawal.
  assert.doesNotMatch(page, /status: '(probable|likely|guessed|unknown|auto)/);
  assert.match(
    api,
    /reviewInstitutionEvidence\([\s\S]{0,160}status: InstitutionEvidenceRow\['verification_status'\]/,
    'the client types the status as the same union',
  );
});

test('a claim without a source cannot be verified', () => {
  assert.match(page, /if \(status === 'verified' && !row\.source_url\)/, 'the guard exists');
  assert.match(page, /[Nn]othing to check it against/, 'the refusal is explained');
  assert.match(
    page,
    /disabled=\{busyId === row\.id \|\| \(decision\.status === 'verified' && !row\.source_url\)\}/,
    'the button is disabled rather than silently refusing',
  );
  assert.match(page, /No source URL recorded/, 'the row says which fact is missing its source');
});

test('a negative decision requires a written reason', () => {
  assert.match(page, /if \(status !== 'verified' && !note\)/, 'the note requirement is enforced before the request');
  assert.match(page, /needs a reason on record/, 'and explained');
  assert.match(page, /reviewInstitutionEvidence\(row\.id, status, note \|\| null\)/, 'the note travels with the decision');
});

test('the page never invents coverage', () => {
  assert.match(page, /Zeros are honest zeros/, 'the zero rows are labelled');
  assert.match(page, /This is the gap list, not a score/, 'the table is not a quality score');
  assert.match(page, /means the query failed, not that the catalogue is empty/i, 'an empty result is not read as an empty catalogue');
  assert.doesNotMatch(page, /\*\s*100\b/, 'no derived percentage is computed client-side');
  assert.doesNotMatch(page, /cutoff|cut-off/i, 'the review page does not restate thresholds as cut-offs');
});

test('the public read is separate from the review read', () => {
  assert.match(api, /fetchInstitutionIntelligence\(institutionId: string\)/, 'the public helper exists');
  assert.ok(api.includes('/intelligence`'), 'the public helper targets the public route');
  assert.match(api, /fetchInstitutionReviewQueue\(\)/, 'the review helper exists');
  assert.ok(api.includes('/api/admin/institution-intelligence/review'), 'the review helper targets the admin route');
  // The public helper must not smuggle an admin token onto a public route.
  const publicFn = api.slice(api.indexOf('export async function fetchInstitutionIntelligence'));
  assert.ok(publicFn.slice(0, 400).includes('jsonFetch<'), 'the public read uses the plain JSON fetch');
  assert.ok(!publicFn.slice(0, 400).includes('adminApiFetch'), 'it does not send an admin token');
});

test('the review page keeps its busy and error states', () => {
  assert.match(page, /disabled=\{loading\} aria-busy=\{loading\}/, 'refresh marks itself busy');
  assert.match(page, /disabled=\{busyId === row\.id/, 'a decision disables its own buttons while saving');
  assert.match(page, /role="alert"/, 'errors are announced');
  assert.match(page, /role="status"/, 'success is announced without stealing focus');
});
