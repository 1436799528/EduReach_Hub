import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSchemaAudit } from '../scripts/schema-audit';

test('schema audit recognizes digit-bearing identifiers and plain ADD COLUMN without hiding missing columns', () => {
  const root = mkdtempSync(join(tmpdir(), 'edureach-schema-v2-'));
  try {
    const migrations = join(root, 'supabase', 'migrations'); mkdirSync(migrations, { recursive: true });
    writeFileSync(join(migrations, '20261107130000_example.sql'), `create table public.cbt_v2_operations (\n  id uuid primary key\n);\nalter table public.cbt_v2_operations add column revision_2 bigint;\n`);
    writeFileSync(join(root, 'server.ts'), "db.from('cbt_v2_operations').select('id,revision_2');\n");
    const valid = runSchemaAudit(root);
    assert.deepEqual(valid.hardFailures, []);
    assert.deepEqual(valid.missingTables, []);
    assert.deepEqual(valid.missingColumns, []);
    assert.ok(valid.tablesCreated.has('cbt_v2_operations'));
    writeFileSync(join(root, 'server.ts'), "db.from('cbt_v2_operations').select('id,missing_2');\n");
    assert.deepEqual(runSchemaAudit(root).missingColumns, ['cbt_v2_operations.missing_2']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('schema audit tracks function renames without inventing missing sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'edureach-schema-rename-'));
  try {
    const migrations = join(root, 'supabase', 'migrations'); mkdirSync(migrations, { recursive: true });
    writeFileSync(join(migrations, '20261107120000_base.sql'), 'create function public.original(uuid) returns uuid language sql as $$ select $1 $$;');
    writeFileSync(join(migrations, '20261107150000_rename.sql'), 'alter function public.original(uuid) rename to renamed; grant execute on function public.renamed(uuid) to authenticated;');
    const valid = runSchemaAudit(root);
    assert.deepEqual(valid.hardFailures, []);
    assert.ok(valid.functionsCreated.has('renamed(1)'));
    assert.ok(!valid.functionsCreated.has('original(1)'));
    writeFileSync(join(migrations, '20261107150000_rename.sql'), 'alter function public.absent(uuid) rename to renamed; grant execute on function public.renamed(uuid) to authenticated;');
    const invalid = runSchemaAudit(root);
    assert.ok(invalid.hardFailures.some(f => f.kind === 'rename function'));
    assert.ok(invalid.hardFailures.some(f => f.kind === 'grant/revoke function'));
    writeFileSync(join(migrations, '20261107150000_rename.sql'), 'alter function public.original(uuid,uuid) rename to renamed;');
    assert.ok(runSchemaAudit(root).hardFailures.some(f => f.kind === 'rename function'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
