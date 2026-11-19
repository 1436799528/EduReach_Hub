/**
 * Institution research coverage.
 *
 *   npx tsx scripts/institutions/coverageReport.ts [--out docs/data/INSTITUTION-COVERAGE.md] [--json path]
 *
 * Counts what the repository actually holds: the 329-row inventory and every
 * `research-batch-*.json` beside it. It never counts a researched institution as
 * verified — verification happens in the database, after an admin review, and
 * this script has no connection. A missing cut-off is `unpublished_by_institution`
 * or `not_researched`; it is never rendered as zero.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const DATA_DIR = join(REPO_ROOT, 'data/institutions');

interface InventoryRow {
  institutionId: string;
  canonicicalName?: string;
  canonicalName?: string;
  schoolName?: string;
  acronym?: string | null;
  state?: string | null;
  institutionType?: string | null;
}

interface Coverage {
  inventoryTotal: number;
  statesCovered: number;
  researched: number;
  unresearched: number;
  byBatch: Array<{ batch: string; researchDate: string; institutions: number; sources: number }>;
  fieldCoverage: Record<string, number>;
  duplicateCandidates: Array<{ canonicalName: string; matches: string[] }>;
  perState: Array<{ state: string; total: number; researched: number }>;
  caveats: string[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const inventory = readJson<InventoryRow[] | { institutions: InventoryRow[] }>(
  join(DATA_DIR, 'institution-inventory-329.json'),
);
const rows: InventoryRow[] = Array.isArray(inventory) ? inventory : inventory.institutions;
const nameOf = (row: InventoryRow) => row.canonicalName ?? row.canonicicalName ?? row.schoolName ?? '(unnamed)';

const batchFiles = readdirSync(DATA_DIR)
  .filter((file) => /^research-batch-\d+\.json$/.test(file))
  .sort();
const batches = batchFiles.map((file) => ({ file, data: readJson<any>(join(DATA_DIR, file)) }));

const researched = new Map<string, { batch: string; record: any }>();
for (const { file, data } of batches) {
  for (const institution of data.institutions ?? []) {
    const key = String(institution.institutionId ?? '').toLowerCase() || normalize(String(institution.canonicalName));
    researched.set(key, { batch: file, record: institution });
  }
}

const fieldCoverage: Record<string, number> = {
  profile: 0,
  officialWebsite: 0,
  admissionPortal: 0,
  studentPortal: 0,
  leadership: 0,
  academicUnits: 0,
  admissionRoutes: 0,
  programmeRequirements: 0,
  benchmarks: 0,
  programmeCutoffs: 0,
  portalGuides: 0,
};

for (const { record } of researched.values()) {
  const admission = record.admission ?? {};
  if (record.profile && Object.keys(record.profile).length) fieldCoverage.profile += 1;
  if (record.officialWebsite) fieldCoverage.officialWebsite += 1;
  if (record.admissionPortal) fieldCoverage.admissionPortal += 1;
  if (record.studentPortal) fieldCoverage.studentPortal += 1;
  if ((record.leadership ?? []).length) fieldCoverage.leadership += 1;
  if ((record.academicUnits?.items ?? []).length) fieldCoverage.academicUnits += 1;
  if ((admission.routes ?? []).length) fieldCoverage.admissionRoutes += 1;
  if ((admission.programmeRequirements ?? []).length) fieldCoverage.programmeRequirements += 1;
  if (
    (admission.benchmarks ?? []).length ||
    (admission.programmeMinimumUtmeScores ?? []).length ||
    (admission.aggregateCutoffs?.records ?? []).length
  ) {
    fieldCoverage.benchmarks += 1;
  }
  if ((admission.programmeCutoffs?.records ?? []).length) fieldCoverage.programmeCutoffs += 1;
  if ((record.portalGuides ?? []).length) fieldCoverage.portalGuides += 1;
}

const byState = new Map<string, { total: number; researched: number }>();
for (const row of rows) {
  const state = row.state ?? 'Unknown';
  const bucket = byState.get(state) ?? { total: 0, researched: 0 };
  bucket.total += 1;
  const key = String(row.institutionId ?? '').toLowerCase();
  if (researched.has(key)) bucket.researched += 1;
  byState.set(state, bucket);
}

// A duplicate candidate is two catalogue rows whose normalised names are equal
// or one is the other plus a trailing city. It is reported, never merged here.
const byNormalized = new Map<string, string[]>();
for (const row of rows) {
  const key = normalize(nameOf(row));
  byNormalized.set(key, [...(byNormalized.get(key) ?? []), nameOf(row)]);
}
const duplicateCandidates: Coverage['duplicateCandidates'] = [];
for (const [key, matches] of byNormalized) {
  if (matches.length > 1) duplicateCandidates.push({ canonicalName: key, matches });
  const base = key.replace(/\s+\w+$/, '');
  if (base !== key) {
    const sibling = byNormalized.get(base);
    if (sibling) duplicateCandidates.push({ canonicalName: base, matches: [...sibling, ...matches] });
  }
}

const coverage: Coverage = {
  inventoryTotal: rows.length,
  statesCovered: new Set(rows.map((row) => row.state ?? 'Unknown')).size,
  researched: researched.size,
  unresearched: rows.length - researched.size,
  byBatch: batches.map(({ file, data }) => ({
    batch: file,
    researchDate: String(data.researchDate ?? 'undated'),
    institutions: (data.institutions ?? []).length,
    sources: (data.sources ?? []).length,
  })),
  fieldCoverage,
  duplicateCandidates,
  perState: [...byState.entries()].map(([state, value]) => ({ state, ...value })).sort((a, b) => b.total - a.total),
  caveats: [
    'Researched means a sourced record exists in a batch file. It does not mean verified: verification happens in the database after an admin review.',
    'No institution is complete. 15 fields are researched per institution at most, and programme-level cut-offs remain unpublished_by_institution unless the institution published them.',
    'A missing value is recorded as missing (null / unpublished_by_institution), never as zero.',
    'The inventory has 329 rows; the NUC registry lists 328 universities. The difference is an unresolved duplicate (see duplicateCandidates) and is not a research gap.',
  ],
};

const markdown = `# Institution research coverage

Generated by \`scripts/institutions/coverageReport.ts\` from the files in
\`data/institutions/\`. It counts **researched** records, not verified ones.

| Measure | Count |
| :--- | ---: |
| Institutions in the inventory | ${coverage.inventoryTotal} |
| States represented | ${coverage.statesCovered} |
| Institutions with a sourced research record | ${coverage.researched} |
| Institutions with no research yet | ${coverage.unresearched} |
| Institutions verified in the database | not measured here — see the admin console |

## Batches

| Batch | Research date | Institutions | Sources |
| :--- | :--- | ---: | ---: |
${coverage.byBatch.map((batch) => `| ${batch.batch} | ${batch.researchDate} | ${batch.institutions} | ${batch.sources} |`).join('\n')}

## Field coverage (institutions with this field researched)

| Field | Count |
| :--- | ---: |
${Object.entries(coverage.fieldCoverage)
  .map(([field, count]) => `| ${field} | ${count} |`)
  .join('\n')}

## Duplicate candidates (reported, never merged automatically)

${
  coverage.duplicateCandidates.length
    ? coverage.duplicateCandidates.map((item) => `- ${item.matches.join('  ⇄  ')}`).join('\n')
    : '- none detected'
}

## Per state

| State | Institutions | Researched |
| :--- | ---: | ---: |
${coverage.perState.map((row) => `| ${row.state} | ${row.total} | ${row.researched} |`).join('\n')}

## Caveats

${coverage.caveats.map((caveat) => `- ${caveat}`).join('\n')}
`;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const jsonPath = arg('json') ?? 'data/institutions/coverage-report.json';
const mdPath = arg('out') ?? 'docs/data/INSTITUTION-COVERAGE.md';
writeFileSync(join(REPO_ROOT, jsonPath), `${JSON.stringify(coverage, null, 2)}\n`);
writeFileSync(join(REPO_ROOT, mdPath), markdown);
console.log(
  `inventory ${coverage.inventoryTotal}, researched ${coverage.researched}, unresearched ${coverage.unresearched}`,
);
console.log(`wrote ${jsonPath} and ${mdPath}`);
