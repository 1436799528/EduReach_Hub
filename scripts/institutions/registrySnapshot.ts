/**
 * NUC registry -> snapshot + coverage report.
 *
 * The National Universities Commission publishes the Nigerian University System
 * as three tables (federal, state, private) with each institution's vice
 * chancellor, website and year established. The public pages paginate in the
 * browser, but the WordPress REST API returns each table in full, so this script
 * reads the three transcriptions in `data/institutions/raw/` — captured once,
 * with the endpoint recorded — and produces:
 *
 *   * `nuc-registry-2026-11-17.json` — every row the Commission published, with
 *     the flags a reader needs (http-only site, site whose host does not look
 *     like the institution, duplicate names);
 *   * `registry-coverage.json` — which of our 329 inventory rows this registry
 *     accounts for, which Commission rows have no inventory row, and which
 *     inventory rows the Commission does not list.
 *
 * It never invents a value. A row the Commission left blank stays blank, and a
 * website is copied as published — including the two rows where the published
 * link points at a different institution's domain, which are flagged rather than
 * "fixed" by guesswork.
 *
 * Run: npm run institutions:registry
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Ownership = 'federal' | 'state' | 'private';

export interface RegistryRow {
  ownership: Ownership;
  /** Position on the Commission's own list, which is the only ordering it asserts. */
  position: number;
  name: string;
  viceChancellor: string | null;
  /** As published. `null` when the Commission left the cell empty. */
  website: string | null;
  yearEstablished: number | null;
  flags: string[];
}

export interface RegistrySnapshot {
  schemaVersion: 'nuc-university-registry-v1';
  retrievedAt: string;
  authorities: Array<{ sourceKey: string; name: string; url: string; note: string }>;
  counts: { federal: number; state: number; private: number; total: number };
  records: RegistryRow[];
}

const ROOT = join(import.meta.dirname, '..', '..');
const RAW = join(ROOT, 'data', 'institutions', 'raw');

export const RETRIEVED_AT = '2026-11-17';

export const AUTHORITIES = [
  {
    sourceKey: 'nuc-nus-federal',
    name: 'National Universities Commission — Federal Universities',
    url: 'https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/',
    note: 'Table of 77 federal universities with vice chancellor, website and year established. Read in full through the site\'s REST endpoint (wp-json/wp/v2/pages?slug=federal-univeristies), because the rendered page paginates at 20 rows.',
  },
  {
    sourceKey: 'nuc-nus-state',
    name: 'National Universities Commission — State Universities',
    url: 'https://www.nuc.edu.ng/nigerian-univerisities/state-univerisity/',
    note: 'Table of 69 state universities. Same fields and same retrieval route.',
  },
  {
    sourceKey: 'nuc-nus-private',
    name: 'National Universities Commission — Private Universities',
    url: 'https://www.nuc.edu.ng/nigerian-univerisities/private-univeristies/',
    note: 'Table of 182 private universities. Same fields and same retrieval route.',
  },
  {
    sourceKey: 'enuc-nus-registry',
    name: 'NUC Nigerian University System (eNUC) registry',
    url: 'https://enuc.nuc.edu.ng/nus',
    note: 'Registry counts used as the cross-check: 77 federal, 69 state, 182 private, 328 total. The same registry carries ownership, year established and state for each entry.',
  },
] as const;

/** Words that name a category rather than an institution. */
const GENERIC = new Set([
  'university', 'universities', 'of', 'the', 'nigeria', 'nigerian', 'federal', 'state',
  'private', 'technology', 'technologies', 'science', 'sciences', 'and', 'for', 'in',
  'college', 'education', 'open', 'medical', 'health', 'agriculture', 'polytechnic',
  'institute', 'a', 'an', 'at', 'study', 'studies',
]);

/** The 36 states plus the FCT, used to strip a location suffix before matching. */
export const STATES = [
  'abia', 'adamawa', 'akwa ibom', 'anambra', 'bauchi', 'bayelsa', 'benue', 'borno',
  'cross river', 'delta', 'ebonyi', 'edo', 'ekiti', 'enugu', 'gombe', 'imo', 'jigawa',
  'kaduna', 'kano', 'katsina', 'kebbi', 'kogi', 'kwara', 'lagos', 'nasarawa', 'niger',
  'ogun', 'ondo', 'osun', 'oyo', 'plateau', 'rivers', 'sokoto', 'taraba', 'yobe',
  'zamfara', 'fct', 'abuja', 'fct abuja',
];

const fold = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/** A full normalised form: punctuation and spacing removed, nothing else. */
export function nameKey(value: string): string {
  return fold(value);
}

/**
 * The words that identify the institution, with category words removed but the
 * place names kept: `Federal University of Technology, Akure` becomes
 * `akure`, and `University of Lagos` stays `lagos` — stripping state names
 * would erase the only identifying word in half the registry.
 */
export function coreKey(value: string): string {
  return fold(value).split(' ').filter((word) => word && !GENERIC.has(word)).join(' ');
}

/** The same key with a trailing state name removed, for `…, Nasarawa State` forms. */
export function withoutState(value: string): string {
  let words = coreKey(value).split(' ').filter(Boolean);
  while (words.length > 1) {
    const last = words[words.length - 1];
    const isState = STATES.some((state) => fold(state).split(' ').pop() === last);
    const isWordState = last === 'state';
    if (!isState && !isWordState) break;
    words = words.slice(0, -1);
  }
  return words.join(' ');
}

/**
 * Is the label an abbreviation of the name? `eksu` is a subsequence of
 * `ekitistateuniversity`, `unilag` of `universityoflagos`, `abu` of
 * `ahmadubello`. A domain that is not a subsequence of its own institution's
 * name is the interesting case: `crownhilluniversity.edu.ng` listed for Ojaja
 * University, `sau.edu.ng` for Glorious Vision University, `pru.edu.ng` for
 * North Eastern University. Those are flagged for a human, never rewritten.
 */
function isAbbreviation(label: string, name: string): boolean {
  const letters = name.normalize('NFKD').toLowerCase().replace(/[^a-z]/g, '');
  const flat = label.replace(/[^a-z]/g, '');
  if (flat.length < 3) return true;
  let index = 0;
  for (const letter of flat) {
    index = letters.indexOf(letter, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}

/** Does the host look like the institution's own name? */
export function hostMatchesName(name: string, website: string): boolean {
  let host: string;
  try {
    host = new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
  const suffix = /^(edu|ng|com|net|org|ac|gov|university|uni|info|africa|online|ng\.edu)$/;
  const labels = host.split('.').filter((label) => label && !suffix.test(label));
  if (!labels.length) return false;
  return labels.some((label) => isAbbreviation(label, name));
}

export function parseRawTable(text: string, ownership: Ownership): RegistryRow[] {
  const rows: RegistryRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const cells = line.split('\t');
    if (cells.length !== 5) throw new Error(`${ownership}: ${cells.length} cells on line "${line.slice(0, 60)}"`);
    const [position, name, viceChancellor, website, year] = cells.map((cell) => cell.trim());
    const flags: string[] = [];
    if (!website) flags.push('website_not_published');
    else if (!website.startsWith('https://')) flags.push('website_not_https');
    else if (!hostMatchesName(name, website)) flags.push('website_domain_not_abbreviation');
    rows.push({
      ownership,
      position: Number(position),
      name,
      viceChancellor: viceChancellor || null,
      website: website || null,
      yearEstablished: year ? Number(year) : null,
      flags,
    });
  }
  return rows;
}

export function buildSnapshot(): RegistrySnapshot {
  const read = (file: string) => readFileSync(join(RAW, file), 'utf8');
  const records = [
    ...parseRawTable(read('nuc-federal.tsv'), 'federal'),
    ...parseRawTable(read('nuc-state.tsv'), 'state'),
    ...parseRawTable(read('nuc-private.tsv'), 'private'),
  ];

  // A name published twice on the Commission's own lists is a finding, not a
  // crash: both rows are kept and both are flagged.
  const byName = new Map<string, RegistryRow[]>();
  for (const row of records) {
    const key = nameKey(row.name);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }
  for (const [key, rows] of byName) {
    if (rows.length > 1) for (const row of rows) row.flags.push(`duplicate_name:${key}`);
  }

  const counts = {
    federal: records.filter((row) => row.ownership === 'federal').length,
    state: records.filter((row) => row.ownership === 'state').length,
    private: records.filter((row) => row.ownership === 'private').length,
    total: records.length,
  };

  return {
    schemaVersion: 'nuc-university-registry-v1',
    retrievedAt: RETRIEVED_AT,
    authorities: [...AUTHORITIES],
    counts,
    records,
  };
}

export interface InventoryRow {
  institutionId: string;
  schoolName: string;
  state: string | null;
  websiteUrl: string | null;
}

export interface CoverageReport {
  schemaVersion: 'institution-registry-coverage-v1';
  generatedAt: string;
  registry: { federal: number; state: number; private: number; total: number };
  inventory: { total: number };
  matched: Array<{
    institutionId: string;
    inventoryName: string;
    registryName: string;
    ownership: Ownership;
    matchedOn: 'institution_id' | 'curated_alias' | 'exact_name' | 'core_name' | 'state_stripped' | 'name_prefix' | 'token_containment';
    yearEstablished: number | null;
    website: string | null;
    flags: string[];
  }>;
  /** Registry rows no inventory row could be matched to. */
  registryOnly: Array<{ name: string; ownership: Ownership; yearEstablished: number | null; website: string | null }>;
  /** Inventory rows the registry does not list. */
  inventoryOnly: Array<{ institutionId: string; schoolName: string; state: string | null }>;
  /** Registry rows that matched more than one inventory row; never auto-resolved. */
  ambiguous: Array<{ registryName: string; candidates: string[] }>;
  totals: {
    matched: number;
    registryOnly: number;
    inventoryOnly: number;
    ambiguous: number;
    websitesPublished: number;
    websitesHttps: number;
    websitesMismatchedHost: number;
    viceChancellorsPublished: number;
    yearsPublished: number;
  };
}


/**
 * Reviewed name variants: our inventory's spelling on the left, the Commission's
 * on the right. Every pair below was read by eye against both lists; a variant
 * that is *not* the same institution is deliberately absent (for example
 * `African School of Economics, Abuja`, which the Commission does not list, and
 * `African University of Economics, FCT, Abuja`, which our inventory does not).
 * Keeping the table explicit means a rename is a one-line reviewable change
 * rather than a fuzzy match nobody can audit.
 */
export const NAME_ALIASES: Record<string, string> = {
  "University of Abuja, Abuja": "University of Abuja, Gwagwalada",
  "University of Benin, Benin City": "University of Benin",
  "University of Ibadan, Ibadan": "University of Ibadan",
  "University of Ilorin, Ilorin": "University of Ilorin",
  "University of Jos, Jos": "University of Jos",
  "University of Maiduguri, Maiduguri": "University of Maiduguri",
  "University of Uyo, Uyo": "University of Uyo",
  "Usmanu Danfodiyo University, Sokoto": "Usumanu Danfodiyo University",
  "King David Umahi University of Medical Sciences, Uburu": "David Nweze Umahi Federal University of Medical Sciences, Uburu",
  "Federal University of Agriculture, Bassam-Bari": "Federal University of Agriculture Bassam-Biri, Bayelsa",
  "Federal University of Health Sciences, Funtua": "Federal University of Health Sciences, Katsina",
  "Adeyemi Federal University of Education, Akure": "Adeyemi Federal University of Education, Ondo",
  "Federal University of Education, Kantagora": "Federal University of Education Kontagora, Niger State",
  "Federal University of Agriculture and Developmental Studies, Iragbiji": "Federal University of Agriculture and Developmental Studies, Iragbuji, Osun State",
  "Rivers State University of Science & Technology, Port Harcourt": "Rivers State University",
  "Ekiti State University, Ado-Ekiti": "Ekiti State University",
  "Rv Fr. Moses Orshio Adasu University, Makurdi": "Rev. Fr. Moses Orshio Adasu (Formerly, Benue State University), Makurdi",
  "Gombe State University, Gombe": "Gombe State Univeristy, Gombe",
  "Umaru Musa Yar'Adua University, Katsina": "Umar Musa Yar' Adua University Katsina",
  "Sa'adu Zungur University, Gadau": "Bauchi State University, Gadau",
  "Ondo State University of Medical Sciences": "University of Medical Sciences, Ondo City, Ondo State",
  "Borno State University": "Kashim Ibrahim ( formerly Bornu State) University, Maiduguri",
  "Zamfara State University, Talata-Mafara": "Zamfara State University",
  "Bayelsa Medical University, Yenagoa": "Bayelsa Medical University",
  "University of Science and Technology, Ozoro": "Delta University of Science and Technology, Ozoro",
  "Dennis Osadebey University, Asaba": "Dennis Osadebe University, Asaba",
  "Lagos University of Education, Oto/Ijanikin": "Lagos State University of Education, Ijanikin",
  "Enugu State University of Medical and Applied Sciences, Igbo-Eno": "State University of Medical and Applied Sciences, Igbo-Eno, Enugu",
  "Emmanuel Alayande University of Education, Oyo": "Emanuel Alayande University of Education Oyo",
  "Abdulsalami Abubakar University of Agriculture and Climate Action, Mokwa": "Abdulsalam Abubakar University of Agriculture and Climate Action, Mokwa, Niger State",
  "Ebonyi State University of Aeronautics and Aerospace Engineering, Ezza": "University of Aeronautics and Aerospace Engineering Ezza, Ebonyi State",
  "Covenant University, Otta": "Covenant University Ota",
  "Crescent University, Abeokuta": "Crescent University",
  "Caleb University, Imota": "Caleb University, Lagos",
  "Fountain University, Oshogbo": "Fountain Unveristy, Oshogbo",
  "Augustine University, Ilara": "Augustine University",
  "Chrisland University, Owode": "Chrisland University",
  "Hallmark University, Ijebu-Itele": "Hallmark University, Ijebi Itele, Ogun",
  "Michael & Cecilia Ibru University, Owhode": "Micheal & Cecilia Ibru University",
  "Arthur Jarvis University, Akpabuyo": "Arthur Javis University Akpoyubo Cross river State",
  "PAMO University of Medical Sciences, Port-Harcourt": "PAMO University of Medical Sciences, Portharcourt",
  "Trinity University, Laloko": "Trinity University Ogun State",
  "Maranatha University, Lekki": "Maranatha University, Lagos",
  "University of Offa, Offa": "University of Offa, Kwara State",
  "Mewar University, Masaka": "Mewar International University, Masaka, Nasarawa State",
  "European University of Nigeria, Abuja": "European University of Nigeria, Duboyi, FCT",
  "Rayhaan University, Birnin Kebbi": "Rayhaan University, Kebbi",
  "Amaj University, Abuja": "Amaj University, Kwali, Abuja",
  "Hillside University of Science and Technology, Okemesi Ekiti": "Hillside University of Science and Technology, Okemisi, Ekiti State",
  "Elrazi University of Medical Sciences, Kano": "Elrazi Medical University Yargaya University, Kano State",
  "Mercy Medical University, Iwara-Iwo": "Mercy Medical University, Iwo, Ogun State",
  "West Midland Open University, Ibadan": "West Midlands Open University, Ibadan, Oyo State",
  "Prime University, Abuja": "Prime University, Kuje, FCT Abuja",
  "Lighthouse University, Evbuobanosa": "Lighthouse University, Evbobanosa, Edo State",
  "Tonnie Iredia University of Communication, Benin City": "Tonine Iredia University of Communication, Benin City, Edo State",
  "Millennium Crest University, Ikare-Akoko": "Millenium Crest University, Ikare Akoko, Ondo State",
  "Regnum Medical University, Lagos": "Regnum Medical University, Anthony, Lagos State",
  "Transatlantic University of Medicine and Health Sciences, Umuchukwu": "Transatlantic University of Medine and Health Sciences, Umuchukwu, Anambra State",
};

type Directory = InventoryRow[];

function indexBy(directory: Directory, keyOf: (row: InventoryRow) => string): Map<string, InventoryRow[]> {
  const map = new Map<string, InventoryRow[]>();
  for (const row of directory) {
    const key = keyOf(row);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

/**
 * Match the registry to our inventory. Deterministic and conservative: exact
 * name, then a core-name match that must be unique on both sides. Anything else
 * is reported, never guessed.
 */
export function matchRegistry(registry: RegistryRow[], directory: Directory): CoverageReport {
  const byExact = indexBy(directory, (row) => nameKey(row.schoolName));
  const byCore = indexBy(directory, (row) => coreKey(row.schoolName));
  const byShort = indexBy(directory, (row) => withoutState(row.schoolName));
  const byPrefix = indexBy(directory, (row) => coreKey(row.schoolName).split(' ').slice(0, 2).join(' '));
  const tokens = new Map<string, string[]>();
  for (const entry of directory) tokens.set(entry.institutionId, coreKey(entry.schoolName).split(' ').filter(Boolean));

  const taken = new Set<string>();
  const matched: CoverageReport['matched'] = [];
  const registryOnly: CoverageReport['registryOnly'] = [];
  const ambiguous: CoverageReport['ambiguous'] = [];

  const available = (rows: InventoryRow[] | undefined) =>
    (rows ?? []).filter((entry) => !taken.has(entry.institutionId));

  const record = (name: string, ownership: Ownership, year: number | null, website: string | null, flags: string[], entry: InventoryRow, how: CoverageReport['matched'][number]['matchedOn']) => {
    taken.add(entry.institutionId);
    matched.push({
      institutionId: entry.institutionId,
      inventoryName: entry.schoolName,
      registryName: name,
      ownership,
      matchedOn: how,
      yearEstablished: year,
      website,
      flags,
    });
  };

  // Reviewed aliases first: an exact, human-checked pair beats any heuristic.
  const aliasTargets = new Map<string, string>(); // registry name -> inventory id
  for (const entry of directory) {
    const target = NAME_ALIASES[entry.schoolName];
    if (!target) continue;
    if (!registry.some((row) => row.name === target)) continue;
    aliasTargets.set(target, entry.institutionId);
  }

  for (const row of registry) {
    const aliased = aliasTargets.get(row.name);
    if (aliased && !taken.has(aliased)) {
      const entry = directory.find((candidate) => candidate.institutionId === aliased)!;
      record(row.name, row.ownership, row.yearEstablished, row.website, row.flags, entry, 'curated_alias');
      continue;
    }
    const attempts: Array<[CoverageReport['matched'][number]['matchedOn'], InventoryRow[]]> = [
      ['exact_name', available(byExact.get(nameKey(row.name)))],
      ['core_name', available(byCore.get(coreKey(row.name)))],
      ['state_stripped', available(byShort.get(withoutState(row.name)))],
      ['name_prefix', available(byPrefix.get(coreKey(row.name).split(' ').slice(0, 2).join(' ')))],
    ];

    let resolved = false;
    for (const [how, candidates] of attempts) {
      if (candidates.length === 1) {
        record(row.name, row.ownership, row.yearEstablished, row.website, row.flags, candidates[0], how);
        resolved = true;
        break;
      }
      if (candidates.length > 1) {
        ambiguous.push({ registryName: row.name, candidates: candidates.map((entry) => entry.schoolName) });
        resolved = true;
        break;
      }
    }
    if (resolved) continue;

    // Last resort: the shorter token set is contained in the longer one, with at
    // least two meaningful words in common. Unique on both sides, or reported.
    const source = coreKey(row.name).split(' ').filter(Boolean);
    // The first two meaningful words must agree. Without that, `University of
    // Maiduguri` "matches" `Kashim Ibrahim University, Maiduguri` and `University
    // of Ibadan` "matches" `West Midlands Open University, Ibadan` — both wrong,
    // and both silent. A name that only shares a place name is not the same
    // institution.
    const contained = directory.filter((entry) => {
      if (taken.has(entry.institutionId)) return false;
      const target = tokens.get(entry.institutionId) ?? [];
      if (source.length < 2 || target.length < 2) return false;
      if (source[0] !== target[0] || source[1] !== target[1]) return false;
      const [short, long] = source.length <= target.length ? [source, target] : [target, source];
      return short.every((word) => long.includes(word));
    });
    if (contained.length === 1) {
      record(row.name, row.ownership, row.yearEstablished, row.website, row.flags, contained[0], 'token_containment');
      continue;
    }
    if (contained.length > 1) {
      ambiguous.push({ registryName: row.name, candidates: contained.map((entry) => entry.schoolName) });
      continue;
    }
    registryOnly.push({
      name: row.name,
      ownership: row.ownership,
      yearEstablished: row.yearEstablished,
      website: row.website,
    });
  }

  const inventoryOnly = directory
    .filter((entry) => !taken.has(entry.institutionId))
    .map((entry) => ({ institutionId: entry.institutionId, schoolName: entry.schoolName, state: entry.state }));

  const withWebsite = registry.filter((row) => row.website);
  return {
    schemaVersion: 'institution-registry-coverage-v1',
    generatedAt: RETRIEVED_AT,
    registry: {
      federal: registry.filter((row) => row.ownership === 'federal').length,
      state: registry.filter((row) => row.ownership === 'state').length,
      private: registry.filter((row) => row.ownership === 'private').length,
      total: registry.length,
    },
    inventory: { total: directory.length },
    matched,
    registryOnly,
    inventoryOnly,
    ambiguous,
    totals: {
      matched: matched.length,
      registryOnly: registryOnly.length,
      inventoryOnly: inventoryOnly.length,
      ambiguous: ambiguous.length,
      websitesPublished: withWebsite.length,
      websitesHttps: withWebsite.filter((row) => row.website!.startsWith('https://')).length,
      websitesMismatchedHost: registry.filter((row) => row.flags.includes('website_domain_not_abbreviation')).length,
      viceChancellorsPublished: registry.filter((row) => row.viceChancellor).length,
      yearsPublished: registry.filter((row) => row.yearEstablished).length,
    },
  };
}

function main(): void {
  const inventory = JSON.parse(
    readFileSync(join(ROOT, 'data', 'institutions', 'institution-inventory-329.json'), 'utf8'),
  ) as { institutions: Array<{ institutionId: string; schoolName: string; state: string | null; websiteUrl: string | null }> };

  const snapshot = buildSnapshot();
  writeFileSync(join(ROOT, 'data', 'institutions', 'nuc-registry-2026-11-17.json'), `${JSON.stringify(snapshot, null, 2)}\n`);

  const coverage = matchRegistry(snapshot.records, inventory.institutions);
  writeFileSync(join(ROOT, 'data', 'institutions', 'registry-coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`);

  console.log(`registry: ${snapshot.counts.total} (${snapshot.counts.federal} federal, ${snapshot.counts.state} state, ${snapshot.counts.private} private)`);
  console.log(`matched ${coverage.totals.matched} of ${inventory.institutions.length} inventory rows`);
  console.log(`registry-only ${coverage.totals.registryOnly}, inventory-only ${coverage.totals.inventoryOnly}, ambiguous ${coverage.totals.ambiguous}`);
  console.log(`websites ${coverage.totals.websitesPublished} (https ${coverage.totals.websitesHttps}, host mismatch ${coverage.totals.websitesMismatchedHost})`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
