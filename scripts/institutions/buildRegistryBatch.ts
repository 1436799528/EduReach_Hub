/**
 * Registry snapshot -> importable research batch.
 *
 * Turns what the NUC registry publishes (ownership, year established, official
 * website, vice chancellor as listed) into a `research-batch-1` file that the
 * existing importer already understands, then runs the importer's own pure
 * transform over it — no database, no credentials — so the shape is proven
 * before anyone points it at a staging project.
 *
 * Three rules this file keeps:
 *
 *   * every field it writes is a value the Commission published, with the
 *     Commission's page as the source;
 *   * a cell the Commission left empty stays `null` — no year, no website, no
 *     guess from a similar-sounding domain;
 *   * nothing is published. Every row lands in review, with the importer's own
 *     `discovered` status, and the publication gate refuses to publish it until
 *     the facts are verified.
 *
 * Run: npm run institutions:registry:batch
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { transformBatch, type DirectoryEntry } from './researchBatch';
import { AUTHORITIES, RETRIEVED_AT, type Ownership } from './registrySnapshot';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'data', 'institutions');

const SOURCE_KEY: Record<Ownership, string> = {
  federal: 'nuc-nus-federal',
  state: 'nuc-nus-state',
  private: 'nuc-nus-private',
};

interface Snapshot {
  retrievedAt: string;
  records: Array<{
    ownership: Ownership;
    position: number;
    name: string;
    viceChancellor: string | null;
    website: string | null;
    yearEstablished: number | null;
    flags: string[];
  }>;
}

interface Coverage {
  matched: Array<{
    institutionId: string;
    inventoryName: string;
    registryName: string;
    ownership: Ownership;
    yearEstablished: number | null;
    website: string | null;
    flags: string[];
  }>;
}

interface Inventory {
  institutions: Array<{ institutionId: string; schoolName: string; acronym: string | null }>;
}

export function buildRegistryBatch(): { batch: any; plan: any } {
  const snapshot = JSON.parse(readFileSync(join(DATA, 'nuc-registry-2026-11-17.json'), 'utf8')) as Snapshot;
  const coverage = JSON.parse(readFileSync(join(DATA, 'registry-coverage.json'), 'utf8')) as Coverage;
  const inventory = JSON.parse(readFileSync(join(DATA, 'institution-inventory-329.json'), 'utf8')) as Inventory;

  const byPosition = new Map(
    snapshot.records.map((row) => [`${row.ownership}:${row.position}`, row] as const),
  );
  const registryByName = new Map(snapshot.records.map((row) => [row.name, row] as const));

  const institutions = coverage.matched.map((match) => {
    const row = registryByName.get(match.registryName)
      ?? [...byPosition.values()].find((entry) => entry.name === match.registryName)!;
    return {
      institutionId: match.institutionId,
      canonicalName: match.inventoryName,
      acronym: null,
      institutionType: 'university',
      ownership: match.ownership,
      state: null,
      // The Commission's own cell, including the rows it left blank.
      officialWebsite: row.website,
      admissionPortal: null,
      studentPortal: null,
      verificationStatus: 'discovered_from_registry',
      sourceKeys: [SOURCE_KEY[match.ownership]],
      profileSourceKey: SOURCE_KEY[match.ownership],
      profile: {
        yearFounded: row.yearEstablished,
        historySummary: null,
        mission: null,
        vision: null,
        location: null,
        campusCount: null,
        campusCountStatus: 'not_researched',
      },
      // A registered vice chancellor is a registry fact and is imported as such;
      // the review console still has to confirm it against the institution's own
      // page before anything is published. Rows the Commission left blank stay
      // out of the batch entirely.
      leadership: row.viceChancellor
        ? [
            {
              role: 'vice_chancellor',
              name: row.viceChancellor,
              actingStatus: /\(ag\.?\)/i.test(row.viceChancellor) ? 'acting_as_published' : 'substantive_as_published',
              verificationStatus: 'published_by_nuc_not_reconfirmed',
              sourceKey: SOURCE_KEY[match.ownership],
              sourceUrl: AUTHORITIES.find((authority) => authority.sourceKey === SOURCE_KEY[match.ownership])!.url,
              checkedAt: RETRIEVED_AT,
            },
          ]
        : [],
      notes: [
        `Ownership, year established and official website as published by the National Universities Commission on ${RETRIEVED_AT}.`,
        'The institution has not confirmed these facts on its own page, so the profile stays in review and cannot be published.',
        ...(row.flags.includes('website_not_published')
          ? ['The Commission left the website cell empty; no domain was inferred from the institution name.']
          : []),
        ...(row.flags.includes('website_not_https')
          ? ['The Commission publishes an http:// address for this institution; it is recorded as published, and the public page refuses a mixed-content link until an https address is confirmed.']
          : []),
        ...(row.flags.includes('website_domain_not_abbreviation')
          ? ['The published domain does not abbreviate the current name. This is usually the domain kept from an earlier name (for example a renamed state university); confirm which institution the site belongs to before publishing it.']
          : []),
      ],
    };
  });

  const batch = {
    schemaVersion: 'research-batch-1',
    researchDate: RETRIEVED_AT,
    batchStatus: 'researched_not_imported',
    batchId: `nuc-registry-${RETRIEVED_AT}`,
    sources: AUTHORITIES.map((authority) => ({
      sourceKey: authority.sourceKey,
      name: authority.name,
      url: authority.url,
      authority: 'National Universities Commission',
      sourceType: 'regulator_registry',
    })),
    dataPolicy: {
      displayOnlyVerifiedFields: true,
      unknownValuesAreNull: true,
      doNotInferProgrammeCutoffs: true,
      sessionSpecific: false,
      note: 'Registry identity facts only: ownership, year established, official website and the vice chancellor as listed by the Commission. No programme, cut-off, fee or admission-date claim is made, and no value the Commission left blank was filled in.',
    },
    institutions,
    nationalAdmissionPolicy: null,
  };

  const directory: DirectoryEntry[] = inventory.institutions.map((row) => ({
    institutionId: row.institutionId,
    canonicalName: row.schoolName,
    acronym: row.acronym,
  }));

  const result = transformBatch(batch, directory, { batchId: batch.batchId });
  const plan = {
    schemaVersion: 'institution-import-plan-v1',
    generatedAt: RETRIEVED_AT,
    batchId: batch.batchId,
    institutionsInBatch: institutions.length,
    counts: result.counts,
    issues: result.issues,
    payload: result.payload,
    note: 'Produced by the importer\'s own transformBatch with no database connection. A real import still needs SUPABASE_URL plus a service role key and a staging project, and every row lands in review, never published.',
  };
  return { batch, plan };
}

function main(): void {
  const { batch, plan } = buildRegistryBatch();
  writeFileSync(join(DATA, 'research-batch-002-registry.json'), `${JSON.stringify(batch, null, 2)}\n`);
  writeFileSync(join(DATA, 'research-batch-002-registry.plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`batch: ${plan.institutionsInBatch} institutions, ${batch.sources.length} sources`);
  console.log(`profile rows: ${plan.counts.profiles ?? 0}, leadership rows: ${plan.counts.leadership ?? 0}`);
  console.log(`validation issues: ${plan.issues.length}`);
  for (const issue of plan.issues.slice(0, 10)) console.log(`  ${issue.entity} | ${issue.key} | ${issue.reason}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
