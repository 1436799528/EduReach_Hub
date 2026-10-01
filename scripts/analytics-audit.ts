import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// AN-1: the taxonomy, kept honest.
//
// `src/lib/analyticsTaxonomy.ts` is the single source of truth for what the
// product may record. A source of truth that nothing checks is a comment, so
// this audit reads the tree and fails when the pieces drift apart:
//
//   1. a `trackEvent` call names an event the taxonomy does not declare;
//   2. a declared event has no call site (a dead event, or a forgotten wire-up);
//   3. the server declares its own list instead of using the taxonomy;
//   4. a declared metadata key looks like free text — a search box is where a
//      student writes their name and their problem;
//   5. the taxonomy and `docs/features/AN-1.md` do not list the same events;
//   6. the retention window differs between the taxonomy, the migration's
//      function default and the document.
//
// See docs/features/AN-1.md. `tests/analytics.test.ts` proves each check fails
// when it should.

export interface AnalyticsCheck {
  id: string;
  label: string;
  measured: string;
  ok: boolean;
  detail?: string;
}

export interface EmitSite {
  file: string;
  line: number;
  event: string;
  /** Statically visible metadata keys; a spread or a computed key is not listed. */
  keys: string[];
}

/**
 * Every `trackEvent('<name>', …)` call in the tree, with the metadata keys that
 * are visible without running the code. A non-literal event name is reported as
 * `(dynamic)` so the audit can refuse it: an event that cannot be read statically
 * cannot be checked against the taxonomy.
 */
export function trackEventCalls(sources: Map<string, string>): EmitSite[] {
  const sites: EmitSite[] = [];
  for (const [file, text] of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'trackEvent') {
        const [first, second] = node.arguments;
        const event = first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
          ? first.text
          : '(dynamic)';
        const keys: string[] = [];
        const options = second && ts.isObjectLiteralExpression(second) ? second : undefined;
        const metadata = options?.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) && property.name.getText(source) === 'metadata',
        );
        if (metadata && ts.isObjectLiteralExpression(metadata.initializer)) {
          for (const property of metadata.initializer.properties) {
            if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
              keys.push(property.name.getText(source));
            }
          }
        }
        sites.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          event,
          keys,
        });
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return sites;
}

/** The migration that carries the retention function. */
export const RETENTION_MIGRATION = 'supabase/migrations/20261001120000_analytics_retention.sql';

export interface AnalyticsAuditInput {
  /** Every `.ts`/`.tsx` file under `src/` and `pages/` that is application code. */
  sources: Map<string, string>;
  /** `src/lib/analyticsTaxonomy.ts` */
  taxonomySource: string;
  /** `server.ts` */
  serverSource: string;
  /** The retention migration. */
  migrationSource: string;
  /** `docs/features/AN-1.md` */
  featureDoc: string;
}

export interface TaxonomyLike {
  events: string[];
  freeTextKeys: string[];
  retentionDays: number;
}

/** Read the taxonomy module by importing it — the audit judges the real object. */
export async function loadTaxonomy(): Promise<TaxonomyLike> {
  const module = await import('../src/lib/analyticsTaxonomy');
  return {
    events: [...module.ANALYTICS_EVENT_NAMES],
    freeTextKeys: module.ANALYTICS_EVENT_NAMES.flatMap((name) =>
      Object.keys(module.ANALYTICS_TAXONOMY[name].metadata).filter((key) => module.FREE_TEXT_KEY_PATTERN.test(key)),
    ),
    retentionDays: module.RETENTION_DAYS,
  };
}

/** The event names a markdown table in AN-1.md lists, in document order. */
export function documentedEvents(featureDoc: string): string[] {
  const section = featureDoc.split('| Event | Funnel |')[1];
  if (!section) return [];
  const rows = section.split('\n\n')[0].split('\n');
  const names: string[] = [];
  for (const row of rows) {
    const match = /^\|\s*`([a-z_]+)`\s*\|/.exec(row);
    if (match) names.push(match[1]);
  }
  return names;
}

/** The default in `prune_site_analytics_events(p_retention_days int default N)`. */
export function migrationRetentionDefault(migrationSource: string): number | null {
  const match = /prune_site_analytics_events\(\s*p_retention_days\s+int\s+default\s+(\d+)\s*\)/i.exec(migrationSource);
  return match ? Number(match[1]) : null;
}

export function auditAnalytics(input: AnalyticsAuditInput, taxonomy: TaxonomyLike): AnalyticsCheck[] {
  const checks: AnalyticsCheck[] = [];
  const declared = new Set(taxonomy.events);

  const sites = trackEventCalls(input.sources);
  const named = sites.filter((site) => site.event !== '(dynamic)');
  const unknown = named.filter((site) => !declared.has(site.event));
  checks.push({
    id: 'emit-sites-declared',
    label: 'every trackEvent call names a declared event',
    measured: `${named.length} call site(s), ${unknown.length} undeclared`,
    ok: unknown.length === 0 && sites.every((site) => site.event !== '(dynamic)'),
    detail: [
      ...unknown.map((site) => `${site.file}:${site.line} → ${site.event}`),
      ...sites.filter((site) => site.event === '(dynamic)').map((site) => `${site.file}:${site.line} → event name is not a literal`),
    ].join('; ') || undefined,
  });

  const emitted = new Set(named.map((site) => site.event));
  const deadEvents = taxonomy.events.filter((event) => !emitted.has(event));
  checks.push({
    id: 'events-have-emitters',
    label: 'every declared event is emitted somewhere',
    measured: `${declared.size} declared, ${deadEvents.length} with no call site`,
    ok: deadEvents.length === 0,
    detail: deadEvents.length ? `no trackEvent call for: ${deadEvents.join(', ')}` : undefined,
  });

  const undeclaredKeys = named.flatMap((site) =>
    site.keys
      .filter((key) => !declared.has(site.event) || false)
      .map((key) => `${site.file}:${site.line}`),
  );
  // Key checking needs the taxonomy's per-event shapes; re-read them from the module export.
  const metadataByEvent = new Map<string, Set<string>>();
  const taxonomyModule = input.taxonomySource;
  for (const event of taxonomy.events) {
    const block = new RegExp(`\\n  ${event}:\\s*\\{[\\s\\S]*?\\n  \\},`).exec(taxonomyModule + '\n');
    const keys = block ? [...block[0].matchAll(/^\s{6}([A-Za-z_][A-Za-z0-9_]*):\s*\{/gm)].map((match) => match[1]) : [];
    metadataByEvent.set(event, new Set(keys));
  }
  const badKeys = named.flatMap((site) => {
    const allowed = metadataByEvent.get(site.event);
    if (!allowed) return [];
    return site.keys.filter((key) => !allowed.has(key)).map((key) => `${site.file}:${site.line} → ${site.event}.${key}`);
  });
  checks.push({
    id: 'payload-keys-declared',
    label: 'every statically visible metadata key is declared for its event',
    measured: `${named.reduce((total, site) => total + site.keys.length, 0)} key(s), ${badKeys.length} undeclared`,
    ok: badKeys.length === 0 && undeclaredKeys.length === 0,
    detail: [...badKeys, ...undeclaredKeys].join('; ') || undefined,
  });

  const inlineAllowlist = /\^\s*page_view\s*\$\s*\|/.test(input.serverSource) || /event_name\s*===?\s*'page_view'/.test(input.serverSource);
  checks.push({
    id: 'server-uses-taxonomy',
    label: 'the server validates through the taxonomy, not its own list',
    measured: inlineAllowlist ? 'an inline event list is present in server.ts' : 'one allowlist (the taxonomy)',
    ok: !inlineAllowlist && /isAnalyticsEvent\(/.test(input.serverSource) && /validateAnalyticsMetadata\(/.test(input.serverSource),
    detail: inlineAllowlist ? 'server.ts declares event names itself; import them from src/lib/analyticsTaxonomy.ts' : undefined,
  });

  checks.push({
    id: 'no-free-text',
    label: 'no declared metadata key can hold what a student typed',
    measured: `${taxonomy.freeTextKeys.length} free-text-looking key(s)`,
    ok: taxonomy.freeTextKeys.length === 0,
    detail: taxonomy.freeTextKeys.length ? `refused key names: ${taxonomy.freeTextKeys.join(', ')}` : undefined,
  });

  const documented = documentedEvents(input.featureDoc);
  const missingFromDoc = taxonomy.events.filter((event) => !documented.includes(event));
  const extraInDoc = documented.filter((event) => !declared.has(event));
  checks.push({
    id: 'documented-events',
    label: 'docs/features/AN-1.md lists exactly the declared events',
    measured: `${documented.length} documented, ${declared.size} declared`,
    ok: missingFromDoc.length === 0 && extraInDoc.length === 0,
    detail: [
      missingFromDoc.length ? `missing from the document: ${missingFromDoc.join(', ')}` : '',
      extraInDoc.length ? `documented but not declared: ${extraInDoc.join(', ')}` : '',
    ].filter(Boolean).join('; ') || undefined,
  });

  const migrationDefault = migrationRetentionDefault(input.migrationSource);
  const docWindow = Number(/pruned after \*\*(\d+) days\*\*/.exec(input.featureDoc)?.[1] ?? Number.NaN);
  const docMentionsWindow = /raw rows are pruned after/i.test(input.featureDoc) || input.featureDoc.includes(`${taxonomy.retentionDays} days`);
  const windows = [taxonomy.retentionDays, migrationDefault, docWindow];
  checks.push({
    id: 'retention-agrees',
    label: 'the retention window agrees across taxonomy, migration and document',
    measured: `taxonomy ${taxonomy.retentionDays}d, migration ${migrationDefault ?? 'missing'}d, document ${Number.isFinite(docWindow) ? `${docWindow}d` : 'not stated'}`,
    ok: migrationDefault === taxonomy.retentionDays && docWindow === taxonomy.retentionDays && docMentionsWindow,
    detail: windows.some((value) => value !== taxonomy.retentionDays)
      ? `change docs/features/AN-1.md, ${RETENTION_MIGRATION} and src/lib/analyticsTaxonomy.ts together`
      : undefined,
  });

  return checks;
}

function applicationSources(root: string): Map<string, string> {
  const sources = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\./.test(entry)) continue;
      sources.set(relative(root, path).split('\\').join('/'), readFileSync(path, 'utf8'));
    }
  };
  for (const dir of ['src', 'pages']) {
    if (existsSync(join(root, dir))) walk(join(root, dir));
  }
  return sources;
}

export function readAnalyticsInput(root: string): AnalyticsAuditInput {
  const read = (path: string) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '');
  return {
    sources: applicationSources(root),
    taxonomySource: read('src/lib/analyticsTaxonomy.ts'),
    serverSource: read('server.ts'),
    migrationSource: read(RETENTION_MIGRATION),
    featureDoc: read('docs/features/AN-1.md'),
  };
}

export async function main(): Promise<void> {
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
  const taxonomy = await loadTaxonomy();
  const checks = auditAnalytics(readAnalyticsInput(root), taxonomy);

  console.log('AN-1 analytics taxonomy audit\n');
  for (const check of checks) {
    console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.label.padEnd(64)} ${check.measured}`);
    if (!check.ok && check.detail) console.log(`     ↳ ${check.detail}`);
  }
  const failures = checks.filter((check) => !check.ok);
  console.log(`\n${failures.length === 0 ? 'The taxonomy, the call sites, the server and the document agree.' : `${failures.length} check(s) failed.`}`);
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
