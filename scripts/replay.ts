import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';

// One place that knows how to build the schema the repository describes: apply
// the Supabase platform shims, then every migration in filename order on a real
// PostgreSQL engine. Used by tests/migrations.test.ts and tests/rls-posture.ts
// (and by `npm run rls:audit`).

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations');
export const SHIM_PATH = join(REPO_ROOT, 'supabase/ci/platform-shims.sql');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/** Applies the shim and every migration. Throws naming the file that failed. */
export async function applyMigrations(db: PGlite): Promise<string[]> {
  await db.exec(readFileSync(SHIM_PATH, 'utf8'));
  const applied: string[] = [];
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`migration ${file} failed after ${applied.length} applied: ${(error as Error).message}`);
    }
    applied.push(file);
  }
  return applied;
}
