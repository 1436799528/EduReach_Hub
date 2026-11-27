import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * University of Abuja (UniAbuja) search-alias regression.
 *
 * Gwagwalada is the campus location of the University of Abuja, not a separate
 * state university. The NUC registry record (“University of Abuja, Gwagwalada”)
 * is reconciled to the production directory row (“University of Abuja, Abuja”)
 * in data/institutions/registry-coverage.json; these tests keep the names a
 * student may type resolving to that one institution, without a duplicate row
 * and without renaming the directory entry.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const UNIABUJA_ID = '9b164365-d366-4ff7-a432-b6713a89cea0';
const UNIABUJA_NAME = 'University of Abuja, Abuja';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: UNIABUJA_ID,
    school_name: UNIABUJA_NAME,
    acronym: null,
    state: 'FCT Abuja',
    institution_type: 'university',
    website_url: 'https://www.uniabuja.edu.ng',
    ...overrides,
  };
}

test('the registry record for Gwagwalada is reconciled to the production University of Abuja row', () => {
  // The registry snapshot carries the official name the alias comes from.
  const registry = JSON.parse(read('data/institutions/nuc-registry-2026-11-17.json')) as {
    records: Array<{ name: string; website: string | null }>;
  };
  const entry = registry.records.find((record) => record.name === 'University of Abuja, Gwagwalada');
  assert.ok(entry, 'the NUC registry lists “University of Abuja, Gwagwalada”');
  assert.equal(entry.website, 'https://www.uniabuja.edu.ng', 'the registry points at the official University of Abuja site');

  // The coverage reconciliation already maps that registry row to the
  // production institution id — no second university exists or may exist.
  const coverage = JSON.parse(read('data/institutions/registry-coverage.json')) as {
    matched: Array<{ institutionId: string; inventoryName: string; registryName: string; matchedOn: string }>;
  };
  const matched = coverage.matched.filter((match) => match.registryName === 'University of Abuja, Gwagwalada');
  assert.equal(matched.length, 1, 'the registry name matches exactly one directory row');
  assert.equal(matched[0].institutionId, UNIABUJA_ID);
  assert.equal(matched[0].inventoryName, UNIABUJA_NAME);
  assert.equal(matched[0].matchedOn, 'curated_alias');
});

test('the verified alias table is sourced and does not rename or duplicate the institution', async () => {
  const { VERIFIED_SEARCH_ALIASES, verifiedSearchAliasesFor } = await import('../src/lib/institutions/aliases');
  const aliases = verifiedSearchAliasesFor(UNIABUJA_ID);
  const names = aliases.map((alias) => alias.name);
  for (const expected of ['University of Abuja', 'University of Abuja, Gwagwalada', 'UniAbuja', 'Gwagwalada']) {
    assert.ok(names.includes(expected), `“${expected}” is a recorded search alias`);
  }
  for (const alias of aliases) {
    assert.ok(alias.source.includes('uniabuja.edu.ng') || alias.source.includes('NUC registry'), `“${alias.name}” carries its source`);
    assert.doesNotMatch(alias.name, /state university/i, 'Gwagwalada is not presented as a state university');
    assert.notEqual(alias.name, UNIABUJA_NAME, 'the production display name stays the canonical name');
  }
  // The table is keyed by the canonical id only; nothing else gains aliases.
  assert.equal(Object.keys(VERIFIED_SEARCH_ALIASES).length, 1);
});

test('directory mapping carries the verified aliases on the one production row', async () => {
  const { mapDirectoryRow } = await import('../src/lib/institutions/mappers');
  const mapped = mapDirectoryRow(row())!;
  assert.ok(mapped, 'the directory row maps');
  assert.equal(mapped.name, UNIABUJA_NAME, 'the display name is preserved');
  const verified = mapped.aliases.filter((alias) => alias.status === 'verified').map((alias) => alias.name);
  for (const expected of ['University of Abuja', 'University of Abuja, Gwagwalada', 'UniAbuja', 'Gwagwalada']) {
    assert.ok(verified.includes(expected), `“${expected}” is exposed as a verified alias`);
  }
  // No alias masquerades as the canonical name, and no duplicates are added.
  assert.equal(new Set(mapped.aliases.map((alias) => alias.name.toLowerCase())).size, mapped.aliases.length);
});

test('searches for Gwagwalada, the registry name and UniAbuja all return the same single institution', async () => {
  const { mapDirectoryRow } = await import('../src/lib/institutions/mappers');
  const { searchInstitutions, sortInstitutions } = await import('../src/lib/institutions/selectors');
  const directory = sortInstitutions([
    mapDirectoryRow(row())!,
    mapDirectoryRow(row({ id: '3f1b9d40-0000-4000-8000-000000000002', school_name: 'University of Lagos', acronym: 'UNILAG', state: 'Lagos' }))!,
    // A different school whose name also carries “Abuja” must survive.
    mapDirectoryRow(row({ id: '3f1b9d40-0000-4000-8000-000000000003', school_name: 'Veritas University, Abuja', acronym: null }))!,
  ]);

  for (const term of ['Gwagwalada Abuja', 'University of Abuja Gwagwalada', 'UniAbuja', 'gwagwalada', 'University of Abuja']) {
    const results = searchInstitutions(directory, { term });
    const hits = results.filter((institution) => institution.id === UNIABUJA_ID);
    assert.equal(hits.length, 1, `“${term}” returns the University of Abuja exactly once`);
    assert.equal(hits[0].name, UNIABUJA_NAME, `“${term}” returns the production record, unchanged`);
    assert.ok(!results.some((institution) => /gwagwalada state university/i.test(institution.name)), `“${term}” invents no Gwagwalada State University`);
  }

  // The directory itself is not duplicated by the alias layer.
  assert.equal(directory.filter((institution) => institution.id === UNIABUJA_ID).length, 1);
  assert.equal(directory.length, 3);
});

test('legacy school links for the alias names resolve to the same institution', async () => {
  const { mapDirectoryRow } = await import('../src/lib/institutions/mappers');
  const { resolveInstitution } = await import('../src/lib/institutions/selectors');
  const directory = [mapDirectoryRow(row())!];
  for (const handle of ['gwagwalada', 'uniabuja', 'university-of-abuja', 'university-of-abuja-gwagwalada', UNIABUJA_ID]) {
    const resolved = resolveInstitution(directory, handle);
    assert.ok(resolved, `/schools/${handle} resolves`);
    assert.equal(resolved.id, UNIABUJA_ID, `/schools/${handle} reaches the production row`);
    assert.equal(resolved.name, UNIABUJA_NAME);
  }
});
