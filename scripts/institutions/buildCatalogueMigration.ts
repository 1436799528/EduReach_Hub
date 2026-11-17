/**
 * Registry snapshot -> catalogue migration.
 *
 * Emits `supabase/migrations/20261119120000_institution_catalogue_registry.sql`
 * from the data files, so the SQL is reproducible rather than hand-written and a
 * future refresh is one command with a diff a reviewer can read.
 *
 * What the generated migration does, and refuses to do:
 *
 *   * adds the one institution the Commission lists and our catalogue does not;
 *   * fills ownership, year established and official website for every
 *     institution it can place, as `discovered` facts in a `draft` profile — so
 *     the publication gate keeps them off the public page;
 *   * writes a website into the PUBLIC directory column only when the address is
 *     https *and* its domain belongs to the institution. The twelve former-name
 *     domains and the one http-only address stay in the profile (gated) and out
 *     of the live directory;
 *   * never overwrites research: a profile that is already `in_review`,
 *     `verified` or `published` is left exactly as it is, and a leadership row
 *     that already has a current vice chancellor is not duplicated;
 *   * never deletes or merges an institution row. The University of Calabar
 *     duplicate is already resolved in the read path (`KNOWN_IDENTITY_ALIASES`)
 *     and is left for a reviewed merge, not a migration.
 *
 * Run: npm run institutions:catalogue
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUTHORITIES, type Ownership } from './registrySnapshot';

type SourceKey = (typeof AUTHORITIES)[number]['sourceKey'];

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'data', 'institutions');
export const MIGRATION_FILE = 'supabase/migrations/20261119120000_institution_catalogue_registry.sql';

interface SnapshotRow {
  ownership: Ownership;
  position: number;
  name: string;
  viceChancellor: string | null;
  website: string | null;
  yearEstablished: number | null;
  flags: string[];
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
  registryOnly: Array<{ name: string; ownership: Ownership; yearEstablished: number | null; website: string | null }>;
}

interface Inventory {
  institutions: Array<{ institutionId: string; schoolName: string; state: string | null; acronym: string | null }>;
}

export interface CatalogueRow {
  /** The name the catalogue stores, which is what the migration matches on. */
  catalogueName: string;
  /** The name the Commission publishes, kept as evidence. */
  registryName: string;
  state: string | null;
  acronym: string | null;
  slug: string;
  ownership: Ownership;
  yearEstablished: number | null;
  /** Every address the Commission publishes, kept in the gated profile. */
  website: string | null;
  /** The subset safe enough for the public directory column. */
  publicWebsite: string | null;
  viceChancellor: string | null;
  acting: boolean;
  flags: string[];
  sourceKey: SourceKey;
  isNew: boolean;
}

const SOURCE_KEY: Record<Ownership, SourceKey> = {
  federal: 'nuc-nus-federal',
  state: 'nuc-nus-state',
  private: 'nuc-nus-private',
};

export function slugFor(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const sqlText = (value: string | null | undefined): string =>
  value === null || value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`;
const sqlNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'null' : String(value);

/** A directory-safe website: https, and a domain that belongs to the name. */
export function publicWebsiteFor(row: { website: string | null; flags: string[] }): string | null {
  if (!row.website) return null;
  if (row.flags.includes('website_not_https')) return null;
  if (row.flags.includes('website_domain_not_abbreviation')) return null;
  return row.website;
}

export function buildCatalogueRows(): CatalogueRow[] {
  const snapshot = JSON.parse(readFileSync(join(DATA, 'nuc-registry-2026-11-17.json'), 'utf8')) as { records: SnapshotRow[] };
  const coverage = JSON.parse(readFileSync(join(DATA, 'registry-coverage.json'), 'utf8')) as Coverage;
  const inventory = JSON.parse(readFileSync(join(DATA, 'institution-inventory-329.json'), 'utf8')) as Inventory;

  const byName = new Map(snapshot.records.map((row) => [row.name, row] as const));
  const byId = new Map(inventory.institutions.map((row) => [row.institutionId, row] as const));

  const rows: CatalogueRow[] = coverage.matched.map((match) => {
    const registry = byName.get(match.registryName)!;
    return {
      catalogueName: match.inventoryName,
      registryName: match.registryName,
      state: byId.get(match.institutionId)?.state ?? null,
      acronym: byId.get(match.institutionId)?.acronym ?? null,
      slug: slugFor(match.inventoryName),
      ownership: registry.ownership,
      yearEstablished: registry.yearEstablished,
      website: registry.website,
      publicWebsite: publicWebsiteFor(registry),
      viceChancellor: registry.viceChancellor,
      acting: /\(ag\.?\)/i.test(registry.viceChancellor ?? ''),
      flags: registry.flags,
      sourceKey: SOURCE_KEY[registry.ownership],
      isNew: false,
    };
  });

  // The Commission lists a 2024 private university the catalogue does not hold.
  // It is added by name, with a slug of its own, and nothing else is assumed.
  for (const extra of coverage.registryOnly) {
    rows.push({
      catalogueName: extra.name,
      registryName: extra.name,
      state: 'FCT Abuja',
      acronym: null,
      slug: slugFor(extra.name),
      ownership: extra.ownership,
      yearEstablished: extra.yearEstablished,
      website: extra.website,
      publicWebsite: null,
      viceChancellor: null,
      acting: false,
      flags: [],
      sourceKey: SOURCE_KEY[extra.ownership],
      isNew: true,
    });
  }

  return rows.sort((a, b) => a.catalogueName.localeCompare(b.catalogueName, 'en'));
}

const HEADER = `-- Institution catalogue + registry facts, from the National Universities Commission.
--
-- GENERATED FILE. Do not edit by hand: \`npm run institutions:catalogue\`
-- rewrites it from data/institutions/nuc-registry-2026-11-17.json and
-- data/institutions/registry-coverage.json, which are themselves transcribed
-- from the Commission's own tables (see docs/data/NIGERIAN-UNIVERSITY-REGISTRY-2026-11.md).
--
-- Why this exists: the hosted catalogue grew outside this repository's migration
-- history, so a fresh database had no institutions at all and no database had
-- the regulator's identity facts. After this migration every database — CI, a
-- preview branch, staging, production — holds the same 328 universities with the
-- same ownership, establishment year and published website.
--
-- The three rules this SQL keeps:
--
--   1. It never overwrites research. A profile that is already in review,
--      verified or published is not touched, and a current vice chancellor is
--      not replaced by a registry listing.
--   2. It never publishes. Every profile it writes is 'draft' with
--      verification_status 'discovered', so the publication gate refuses to
--      publish it until a human confirms the facts against the institution.
--   3. It never guesses. The twelve published domains that do not spell the
--      current name, and the one http-only address, are recorded in the gated
--      profile and deliberately left out of the public directory column.
`;

export function buildMigration(rows: CatalogueRow[]): string {
  const sources = AUTHORITIES.filter((authority) => authority.sourceKey.startsWith('nuc-nus-'));
  const sourceUrl = new Map(AUTHORITIES.map((authority) => [authority.sourceKey, authority.url] as const));

  const institutionValues = rows
    .map((row) => `  (${[
      sqlText(row.catalogueName),
      sqlText(row.acronym),
      sqlText(row.state),
      "'university'",
      sqlText(row.publicWebsite),
      sqlText(row.slug),
    ].join(', ')})`)
    .join(',\n');

  const profileValues = rows
    .map((row) => `  (${[
      sqlText(row.catalogueName),
      sqlText(row.registryName),
      sqlText(row.ownership),
      sqlNumber(row.yearEstablished),
      sqlText(row.website),
      sqlText(sourceUrl.get(row.sourceKey) ?? null),
    ].join(', ')})`)
    .join(',\n');

  const leadershipValues = rows
    .filter((row) => row.viceChancellor)
    .map((row) => `  (${[
      sqlText(row.catalogueName),
      sqlText(row.viceChancellor),
      sqlText(row.acting ? 'acting' : 'substantive'),
      sqlText(sourceUrl.get(row.sourceKey) ?? null),
    ].join(', ')})`)
    .join(',\n');

  const publications = {
    institutions: rows.length,
    websites: rows.filter((row) => row.website).length,
    publicWebsites: rows.filter((row) => row.publicWebsite).length,
    profiles: rows.length,
    leadership: rows.filter((row) => row.viceChancellor).length,
    newInstitutions: rows.filter((row) => row.isNew).length,
  };

  return `${HEADER}-- Rows emitted: ${publications.institutions} institutions (${publications.newInstitutions} new),
-- ${publications.profiles} profiles (${publications.websites} with a published website,
-- ${publications.publicWebsites} of those safe for the public directory column),
-- ${publications.leadership} leadership rows.

begin;

-- ---------------------------------------------------------------------------
-- 1. The Commission's pages, as sources.
-- ---------------------------------------------------------------------------

${sources
  .map(
    (authority) => `insert into public.edureach_sources (name, url, authority, source_type)
select ${sqlText(authority.name)}, ${sqlText(authority.url)}, 'National Universities Commission', 'regulator_registry'
where not exists (select 1 from public.edureach_sources where url = ${sqlText(authority.url)});`,
  )
  .join('\n\n')}

-- ---------------------------------------------------------------------------
-- 2. The catalogue. A row is added only when the name is not already there —
--    case and surrounding whitespace are the only normalisation applied, so an
--    existing row is never duplicated under a variant spelling.
-- ---------------------------------------------------------------------------

insert into public.institutions (school_name, acronym, state, institution_type, website_url, slug, is_verified)
select v.school_name, v.acronym, v.state, v.institution_type, v.website_url, v.slug, false
from (values
${institutionValues}
) as v(school_name, acronym, state, institution_type, website_url, slug)
where not exists (
  select 1 from public.institutions i
  where lower(trim(i.school_name)) = lower(trim(v.school_name))
);

-- ---------------------------------------------------------------------------
-- 3. Registry facts, as discovered facts in a draft profile.
--    ON CONFLICT keeps research: a profile that has moved past 'discovered' is
--    not rewritten, and a published profile is never touched.
-- ---------------------------------------------------------------------------

insert into public.institution_profiles (
  institution_id, official_name, ownership, institution_category, year_established,
  official_website_url, publication_status, verification_status, source_id, source_url
)
select i.id, v.official_name, v.ownership, 'university', v.year_established,
       v.website, 'draft', 'discovered', s.id, s.url
from (values
${profileValues}
) as v(catalogue_name, official_name, ownership, year_established, website, source_url)
join public.institutions i on lower(trim(i.school_name)) = lower(trim(v.catalogue_name))
left join public.edureach_sources s on s.url = v.source_url
on conflict (institution_id) do update set
  official_name = coalesce(public.institution_profiles.official_name, excluded.official_name),
  ownership = coalesce(public.institution_profiles.ownership, excluded.ownership),
  year_established = coalesce(public.institution_profiles.year_established, excluded.year_established),
  official_website_url = coalesce(public.institution_profiles.official_website_url, excluded.official_website_url),
  source_id = coalesce(public.institution_profiles.source_id, excluded.source_id),
  source_url = coalesce(public.institution_profiles.source_url, excluded.source_url),
  updated_at = now()
where public.institution_profiles.verification_status in ('unresearched', 'discovered')
  and public.institution_profiles.publication_status <> 'published';

-- ---------------------------------------------------------------------------
-- 4. The vice chancellor the Commission lists, when nobody has researched one.
--    A registry listing is 'discovered', never 'verified': the office holder is
--    confirmed against the institution's own page before it is published.
-- ---------------------------------------------------------------------------

insert into public.institution_leadership (
  institution_id, office_key, office_title, full_name, acting_status,
  is_current, verification_status, source_id, source_url
)
select i.id, 'vice_chancellor', 'Vice-Chancellor', v.full_name, v.acting_status,
       true, 'discovered', s.id, s.url
from (values
${leadershipValues}
) as v(catalogue_name, full_name, acting_status, source_url)
join public.institutions i on lower(trim(i.school_name)) = lower(trim(v.catalogue_name))
left join public.edureach_sources s on s.url = v.source_url
where not exists (
  select 1 from public.institution_leadership l
  where l.institution_id = i.id and l.office_key = 'vice_chancellor' and l.is_current
);

-- ---------------------------------------------------------------------------
-- 5. Evidence for the two identities the registry could not settle.
--    Recorded so the review console can see why they are what they are; neither
--    row is deleted, merged or hidden by this migration.
-- ---------------------------------------------------------------------------

insert into public.institution_fact_evidence (
  institution_id, entity_type, field_key, claimed_value, source_id, source_url,
  verification_status, checked_at, review_note
)
select i.id, 'institution', 'registry_presence', jsonb_build_object('listed', false),
       s.id, s.url, 'disputed', ${sqlText('2026-11-17')}::timestamptz,
       'Not listed on any National Universities Commission university table on 2026-11-17. Either it is recognised under another name or it is not a university; resolve before it is presented as one.'
from public.institutions i
left join public.edureach_sources s on s.url = ${sqlText(sourceUrl.get('nuc-nus-private') ?? '')}
where lower(trim(i.school_name)) = 'african school of economics, abuja'
  and not exists (
    select 1 from public.institution_fact_evidence e
    where e.institution_id = i.id and e.field_key = 'registry_presence'
  );

insert into public.institution_aliases (institution_id, alias_name, alias_type, verification_status, source_id, source_url)
select i.id, 'University of Calabar, Calabar', 'duplicate_candidate', 'discovered', s.id, s.url
from public.institutions i
left join public.edureach_sources s on s.url = ${sqlText(sourceUrl.get('nuc-nus-federal') ?? '')}
where lower(trim(i.school_name)) = 'university of calabar'
  and exists (select 1 from public.institutions d where lower(trim(d.school_name)) = 'university of calabar, calabar')
  and not exists (
    select 1 from public.institution_aliases a
    where a.institution_id = i.id and a.alias_name = 'University of Calabar, Calabar'
  );

commit;
`;
}

function main(): void {
  const rows = buildCatalogueRows();
  writeFileSync(join(ROOT, MIGRATION_FILE), buildMigration(rows));
  const published = rows.filter((row) => row.publicWebsite).length;
  console.log(`wrote ${MIGRATION_FILE}`);
  console.log(`  ${rows.length} institutions (${rows.filter((row) => row.isNew).length} new)`);
  console.log(`  ${rows.filter((row) => row.website).length} registry websites, ${published} safe for the public column`);
  console.log(`  ${rows.filter((row) => row.viceChancellor).length} leadership rows`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
