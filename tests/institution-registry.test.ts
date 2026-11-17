import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  AUTHORITIES,
  NAME_ALIASES,
  buildSnapshot,
  hostMatchesName,
  nameKey,
  parseRawTable,
  withoutState,
  type RegistryRow,
} from '../scripts/institutions/registrySnapshot';
import { transformBatch, type DirectoryEntry } from '../scripts/institutions/researchBatch';
import { buildRegistryBatch } from '../scripts/institutions/buildRegistryBatch';

// REG-1: the registry snapshot. The Commission publishes 77 federal, 69 state and
// 182 private universities, and this file is the evidence that our copy of that
// list is complete, unembellished and traceable. The rules that matter:
// every published cell survives, every empty cell stays empty, and nothing is
// "helpfully" inferred from a name that looks like a domain.

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const snapshot = JSON.parse(read('data/institutions/nuc-registry-2026-11-17.json')) as {
  schemaVersion: string;
  retrievedAt: string;
  authorities: Array<{ sourceKey: string; url: string }>;
  counts: { federal: number; state: number; private: number; total: number };
  records: RegistryRow[];
};
const coverage = JSON.parse(read('data/institutions/registry-coverage.json')) as any;
const inventory = JSON.parse(read('data/institutions/institution-inventory-329.json')) as {
  institutions: Array<{ institutionId: string; schoolName: string; state: string | null }>;
};
const batch = JSON.parse(read('data/institutions/research-batch-002-registry.json')) as any;
const plan = JSON.parse(read('data/institutions/research-batch-002-registry.plan.json')) as any;

const directory: DirectoryEntry[] = inventory.institutions.map((row) => ({
  institutionId: row.institutionId,
  canonicalName: row.schoolName,
  acronym: null,
}));

test('the registry holds every university the Commission lists, and no more', () => {
  assert.equal(snapshot.schemaVersion, 'nuc-university-registry-v1');
  assert.equal(snapshot.counts.federal, 77, 'the federal list is complete');
  assert.equal(snapshot.counts.state, 69, 'the state list is complete');
  assert.equal(snapshot.counts.private, 182, 'the private list is complete');
  assert.equal(snapshot.counts.total, 328, '77 + 69 + 182 = 328, which is the Commission\'s own total');
  assert.equal(snapshot.records.length, 328);

  for (const ownership of ['federal', 'state', 'private'] as const) {
    const positions = snapshot.records.filter((row) => row.ownership === ownership).map((row) => row.position);
    assert.deepEqual(
      positions,
      Array.from({ length: positions.length }, (_unused, index) => index + 1),
      `${ownership} positions run 1..n with no gap and no repeat`,
    );
  }

  // The snapshot is a transcription, so it must still agree with the raw tables
  // it was built from; a hand edit to one and not the other is a build failure.
  const rebuilt = buildSnapshot();
  assert.deepEqual(rebuilt.records, snapshot.records, 'the snapshot is exactly what the raw tables produce');
});

test('every authority is https and names the page the rows came from', () => {
  assert.equal(snapshot.authorities.length, AUTHORITIES.length);
  for (const authority of snapshot.authorities) {
    assert.match(authority.url, /^https:\/\//, `${authority.sourceKey} is https`);
    assert.ok(authority.sourceKey.length > 0);
  }
  const keys = new Set(snapshot.authorities.map((authority) => authority.sourceKey));
  assert.ok(keys.has('nuc-nus-federal') && keys.has('nuc-nus-state') && keys.has('nuc-nus-private'));
});

test('a published value survives, and an empty cell stays empty', () => {
  for (const row of snapshot.records) {
    assert.ok(row.name.trim().length > 5, `a name is always present: ${JSON.stringify(row)}`);
    if (row.website !== null) {
      assert.match(row.website, /^https?:\/\/[^\s]+$/i, `${row.name}: the website is a real http(s) URL`);
      assert.notEqual(row.website, '', 'an empty string is not a website');
    }
    if (row.yearEstablished !== null) {
      assert.ok(
        row.yearEstablished >= 1948 && row.yearEstablished <= 2026,
        `${row.name}: ${row.yearEstablished} is a plausible establishment year`,
      );
    }
    if (row.viceChancellor !== null) {
      assert.notEqual(row.viceChancellor.trim(), '', `${row.name}: a blank vice chancellor is null, not a space`);
    }
  }

  // No row was given a website the Commission did not publish.
  const withWebsite = snapshot.records.filter((row) => row.website).length;
  assert.equal(withWebsite, 190, 'the Commission publishes 190 of 328 websites');
  assert.equal(snapshot.records.length - withWebsite, 138, 'the other 138 stay blank');
});

test('the two irregular rows are flagged, not repaired', () => {
  const aust = snapshot.records.find((row) => row.name === 'African University of Science and Technology, Abuja');
  assert.ok(aust, 'the row exists');
  assert.equal(aust!.website, 'http://aust.edu.ng/', 'the address is recorded exactly as published');
  assert.ok(aust!.flags.includes('website_not_https'), 'and flagged, because our pages refuse mixed content');

  const flagged = snapshot.records.filter((row) => row.flags.includes('website_domain_not_abbreviation'));
  assert.ok(flagged.length >= 8, `former-name domains are flagged (${flagged.length})`);
  // The clearest cases: an institution that renamed and kept the old domain.
  for (const [name, domain] of [
    ['North Eastern University, Gombe', 'pru.edu.ng'],
    ['Glorious Vision University, Ogwa, Edo State.', 'sau.edu.ng'],
    ['Ojaja University Eiyenkorin, Kwara State', 'crownhilluniversity.edu.ng'],
  ] as const) {
    const row = snapshot.records.find((candidate) => candidate.name === name);
    assert.ok(row, `${name} is listed`);
    assert.ok(row!.website!.includes(domain), `${name} publishes ${domain}`);
    assert.ok(row!.flags.includes('website_domain_not_abbreviation'), `${name} is flagged rather than silently accepted`);
  }
});

test('the domain test understands abbreviations and rejects strangers', () => {
  // Abbreviations of the institution's own name pass.
  assert.equal(hostMatchesName('Ekiti State University', 'https://www.eksu.edu.ng'), true);
  assert.equal(hostMatchesName('University of Lagos', 'https://www.unilag.edu.ng'), true);
  assert.equal(hostMatchesName('Ahmadu Bello University, Zaria', 'https://www.abu.edu.ng'), true);
  assert.equal(hostMatchesName('Federal University of Technology, Akure', 'https://www.futa.edu.ng'), true);
  // A domain that cannot be spelled out of the name does not.
  assert.equal(hostMatchesName('Ojaja University Eiyenkorin, Kwara State', 'https://www.crownhilluniversity.edu.ng/'), false);
  assert.equal(hostMatchesName('North Eastern University, Gombe', 'https://pru.edu.ng/'), false);
});

test('name keys normalise spelling without erasing the institution', () => {
  assert.equal(nameKey('University of Calabar'), 'university of calabar');
  assert.equal(nameKey('University  of  Calabar.'), 'university of calabar');
  assert.equal(nameKey("Umar Musa Yar' Adua University Katsina"), 'umar musa yar adua university katsina');
  assert.equal(withoutState('Federal University, Lafia, Nasarawa State'), 'lafia');
  assert.equal(withoutState('University of Lagos'), 'lagos', 'a one-word name is never emptied');
});

test('every reviewed alias points at a real row on both sides', () => {
  const inventoryNames = new Set(inventory.institutions.map((row) => row.schoolName));
  const registryNames = new Set(snapshot.records.map((row) => row.name));
  for (const [ours, theirs] of Object.entries(NAME_ALIASES)) {
    assert.ok(inventoryNames.has(ours), `alias key "${ours}" is an inventory row`);
    assert.ok(registryNames.has(theirs), `alias target "${theirs}" is a registry row`);
  }
  assert.ok(Object.keys(NAME_ALIASES).length >= 55, 'the reviewed variants are still there');
});

test('the registry accounts for 327 of our 329 rows', () => {
  assert.equal(coverage.totals.matched, 327);
  assert.equal(coverage.inventory.total, 329);

  // The two rows that do not match are named, not swallowed.
  assert.deepEqual(
    coverage.inventoryOnly.map((row: any) => row.schoolName).sort(),
    ['African School of Economics, Abuja', 'University of Calabar, Calabar'],
    'the duplicate and the unlisted school are reported',
  );
  assert.deepEqual(
    coverage.registryOnly.map((row: any) => row.name),
    ['African University of Economics, FCT, Abuja'],
    'the Commission lists a 2024 private university we do not hold',
  );
  assert.deepEqual(coverage.ambiguous, [], 'nothing was resolved by guessing between two candidates');

  // The duplicate is the whole of the 329-vs-328 discrepancy the inventory flags.
  const calabar = inventory.institutions.filter((row) => /^university of calabar/i.test(row.schoolName));
  assert.equal(calabar.length, 2, 'the inventory really does hold the institution twice');
  assert.equal(snapshot.records.filter((row) => row.name === 'University of Calabar').length, 1, 'the Commission holds it once');
});

test('the batch carries the registry facts and nothing else', () => {
  assert.equal(plan.issues.length, 0, `the importer finds no problem with the batch: ${JSON.stringify(plan.issues.slice(0, 3))}`);
  assert.equal(batch.institutions.length, 327);

  const sourceKeys = new Set(batch.sources.map((source: any) => source.sourceKey));
  for (const institution of batch.institutions) {
    assert.equal(institution.verificationStatus, 'discovered_from_registry', 'a registry fact is discovered, not verified');
    assert.ok(sourceKeys.has(institution.profileSourceKey), `${institution.canonicalName} cites a source that exists`);
    assert.equal(institution.admission, undefined, 'no admission claim is made from a registry row');
    assert.equal(institution.admissionPortal, null);
    assert.equal(institution.studentPortal, null);
    assert.equal(institution.profile.mission, null, 'no mission statement is invented');
    assert.equal(institution.profile.historySummary, null);
    for (const person of institution.leadership) {
      assert.equal(person.verificationStatus, 'published_by_nuc_not_reconfirmed', 'a listed vice chancellor is not a confirmed one');
      assert.ok(person.sourceUrl.startsWith('https://www.nuc.edu.ng/'), 'and the citation is the Commission page');
    }
  }

  // The unmatched registry row never reaches the import.
  assert.equal(
    batch.institutions.filter((institution: any) => institution.canonicalName === 'African University of Economics, FCT, Abuja').length,
    0,
    'an institution we cannot place in the catalogue is not imported under a guess',
  );
});

test('the batch maps onto the catalogue through the importer\'s own transform', () => {
  const rebuilt = buildRegistryBatch();
  assert.equal(rebuilt.plan.counts.profiles, plan.counts.profiles, 'the plan is reproducible');
  assert.equal(plan.counts.profiles, 190, 'every institution with a published website gets a profile row');
  assert.equal(plan.counts.leadership, 262, 'every published vice chancellor becomes a leadership row');
  assert.equal(plan.payload.profiles.length, 190);
  assert.equal(plan.payload.routing ?? plan.payload.routes?.length ?? 0, 0, 'no admission route is claimed');
  for (const profile of plan.payload.profiles) {
    assert.ok(profile.sourceUrl, 'every profile cites its source');
    assert.equal(profile.institutionCategory, 'university');
  }
});

test('a registry-only record is not reported as a broken admission claim', () => {
  // The importer used to require a session on every institution, which turned a
  // pure identity record into a validation error. It now asks only when the
  // record actually asserts something about admission.
  const identityOnly = {
    sources: [{ sourceKey: 'nuc', name: 'NUC', url: 'https://www.nuc.edu.ng/x/' }],
    institutions: [
      {
        institutionId: directory[0].institutionId,
        canonicalName: directory[0].canonicalName,
        ownership: 'federal',
        officialWebsite: 'https://example.edu.ng/',
        profileSourceKey: 'nuc',
        profile: { yearFounded: 1990 },
      },
    ],
  };
  const clean = transformBatch(identityOnly, directory);
  assert.deepEqual(clean.issues, [], 'an identity-only record is valid');
  assert.equal(clean.counts.profiles, 1);

  const withClaim = structuredClone(identityOnly);
  (withClaim.institutions[0] as any).admission = { session: '2026-2027', routes: [] };
  (withClaim.institutions[0] as any).admission.routes = [{ entryMode: 'UTME' }];
  assert.deepEqual(
    transformBatch(withClaim, directory).issues.map((issue) => issue.reason),
    ['session "2026-2027" is not YYYY/YYYY'],
    'the moment a route is asserted, the session is validated again',
  );
});

test('the raw transcriptions are in the repository', () => {
  for (const file of ['nuc-federal.tsv', 'nuc-state.tsv', 'nuc-private.tsv']) {
    const text = read(join('data', 'institutions', 'raw', file));
    const rows = text.split('\n').filter(Boolean);
    assert.ok(rows.length > 0, `${file} has rows`);
    for (const row of rows) assert.equal(row.split('\t').length, 5, `${file}: ${row.slice(0, 40)} has five cells`);
  }
  const parsed = parseRawTable(read(join('data', 'institutions', 'raw', 'nuc-state.tsv')), 'state');
  assert.equal(parsed.length, 69);
  assert.equal(parsed[0].name, 'Rivers State University', 'the Commission\'s own order is preserved');
  assert.equal(parsed[0].yearEstablished, 1979);
});
