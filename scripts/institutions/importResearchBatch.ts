/**
 * Import a researched institution batch into a NON-PRODUCTION database.
 *
 *   npx tsx scripts/institutions/importResearchBatch.ts                 # dry run
 *   npx tsx scripts/institutions/importResearchBatch.ts --batch X.json   # dry run, other file
 *   INSTITUTION_IMPORT_ENV=staging npx tsx scripts/institutions/importResearchBatch.ts --apply
 *
 * Safety model, in order of enforcement:
 *
 *   1. The default is a dry run. `--apply` must be passed explicitly.
 *   2. `--apply` refuses to run unless INSTITUTION_IMPORT_ENV is `development`
 *      or `staging`, NODE_ENV is not `production`, and the target project is not
 *      the production project. The production ref is hard-coded here, so an
 *      operator cannot talk the script into it with an environment variable.
 *   3. All writes happen inside `public.institution_import_apply`, one
 *      transaction. A batched failure rolls back completely.
 *   4. Nothing is imported as published. Every row lands `in_review`, and the
 *      admin review console is the only path to publication.
 *
 * Exit codes: 0 success, 1 configuration/validation failure, 2 import rejected
 * by the database.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBatch, transformBatch, type DirectoryEntry } from './researchBatch';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');

/** The hosted production project. Never a target for schema or research import. */
const PRODUCTION_REF = 'gjdfatwcoosyuhakrrhh';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function loadDirectory(supabase: any): Promise<DirectoryEntry[]> {
  const entries: DirectoryEntry[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('institutions')
      .select('id,school_name,acronym')
      .order('school_name', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`cannot read the institution directory: ${error.message}`);
    for (const row of data ?? []) {
      entries.push({ institutionId: row.id, canonicalName: row.school_name, acronym: row.acronym });
    }
    if (!data || data.length < 1000) break;
  }
  return entries;
}

async function main(): Promise<number> {
  const batchPath = resolve(REPO_ROOT, arg('batch') ?? 'data/institutions/research-batch-001.json');
  const apply = hasFlag('apply');
  const outPath = arg('out');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) {
    console.error('BLOCKED: SUPABASE_URL and a service role key are required (the dry run executes the same transaction and rolls it back).');
    return 1;
  }

  const ref = (() => {
    try { return new URL(url).hostname.split('.')[0]; } catch { return ''; }
  })();
  if (ref === PRODUCTION_REF) {
    console.error(`REFUSED: ${ref} is the production project. This importer never writes to production.`);
    return 1;
  }

  if (apply) {
    const target = process.env.INSTITUTION_IMPORT_ENV;
    if (!['development', 'staging'].includes(String(target))) {
      console.error('REFUSED: --apply needs INSTITUTION_IMPORT_ENV=development or staging. Never production.');
      return 1;
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('REFUSED: NODE_ENV=production. Research import never runs in a production process.');
      return 1;
    }
  }

  const batch = loadBatch(batchPath);
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const directory = await loadDirectory(supabase);
  if (directory.length === 0) {
    console.error('REFUSED: the institution directory is empty; import with nothing to match against is meaningless.');
    return 1;
  }

  const batchId = `${String(batch.researchDate ?? 'undated')}-${batchPath.split('/').pop()?.replace(/\.json$/, '') ?? 'batch'}`;
  const { payload, issues, counts } = transformBatch(batch, directory, { batchId });

  const unresolved = issues.filter((issue) => /catalogue row|reconcile them|no institutionId/.test(issue.reason));
  if (!payload || unresolved.length > 0) {
    console.error('VALIDATION FAILED — nothing was sent to the database.');
    for (const issue of (unresolved.length ? unresolved : issues).slice(0, 40)) {
      console.error(`  ${issue.entity} ${issue.key}: ${issue.reason}`);
    }
    return 1;
  }

  const { data, error } = await supabase.rpc('institution_import_apply', {
    p_payload: payload,
    p_dry_run: !apply,
  });
  if (error) {
    console.error(`IMPORT FAILED (rolled back): ${error.message}`);
    return 2;
  }

  const report = {
    batchPath: batchPath.replace(`${REPO_ROOT}/`, ''),
    batchId,
    mode: apply ? 'apply' : 'dry-run',
    targetRef: ref,
    directorySize: directory.length,
    prepared: counts,
    validationIssues: issues,
    database: data,
  };

  if (outPath) {
    const target = resolve(REPO_ROOT, outPath);
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report, null, 2));
  const rejected = Array.isArray(data?.rejected) ? data.rejected.length : 0;
  console.log(
    `\n${apply ? 'APPLIED' : 'DRY RUN'} — inserted ${sum(data?.inserted)} / updated ${sum(data?.updated)} / ` +
    `skipped ${sum(data?.skipped)} / skipped-verified ${sum(data?.skipped_verified)} / rejected ${rejected}. ` +
    'All rows are in_review until an admin publishes them.',
  );
  return 0;
}

function sum(bucket: Record<string, number> | undefined): number {
  return Object.values(bucket ?? {}).reduce((total, value) => total + Number(value ?? 0), 0);
}

main().then((code) => process.exit(code)).catch((error) => {
  console.error(error);
  process.exit(1);
});
