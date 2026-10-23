import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('service_guides migration: server-only table with draft/publish state', () => {
  const path = join(root, 'supabase/migrations/20261026120000_service_guides.sql');
  assert.ok(existsSync(path), 'migration exists');
  const sql = readFileSync(path, 'utf8');
  assert.match(sql, /create table if not exists public\.service_guides/);
  assert.match(sql, /references public\.service_catalog\(service_key\) on delete cascade/);
  assert.match(sql, /status in \('draft', 'published'\)/);
  assert.match(sql, /jsonb_typeof\(steps\) = 'array'/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.service_guides from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.service_guides to service_role/);
  assert.ok(!/create policy/i.test(sql), 'no client policies: reads go through capability-checked server endpoints');
});

test('guide endpoints enforce capabilities on the server, public reads are published-only', () => {
  const server = read('server.ts');
  assert.match(server, /app\.get\('\/api\/admin\/services\/:serviceId\/guide', requireCapability\('service\.read'\)/);
  assert.match(server, /app\.put\('\/api\/admin\/services\/:serviceId\/guide', requireCapability\('service\.update'\)/);
  assert.match(server, /app\.delete\('\/api\/admin\/services\/:serviceId\/guide', requireCapability\('service\.update'\)/);
  assert.match(server, /app\.get\('\/api\/services\/:slug\/guide'/);
  const publicRoute = server.slice(server.indexOf("app.get('/api/services/:slug/guide'"), server.indexOf("app.get('/api/admin/services/:serviceId/guide'"));
  assert.match(publicRoute, /eq\('status', 'published'\)/);
  // Screenshot uploads are opened to service editors through the same guard.
  assert.match(server, /'calendar\.update', 'service\.update'\)/);
});

test('guide payloads are validated before they can reach students', () => {
  const server = read('server.ts');
  assert.match(server, /between 1 and 24 steps/);
  assert.match(server, /GUIDE_IMAGE_KINDS/);
  assert.match(server, /imageKind/);
});

test('admin UI edits steps, uploads images and previews before publishing', () => {
  const page = read('pages/AdminServicesPage.tsx');
  for (const marker of ['GuideEditor', 'fetchAdminServiceGuide', 'saveAdminServiceGuide', 'resetAdminServiceGuide', 'uploadAdminImage', 'Add step', 'Preview', 'Draft — hidden from students', 'Published — live for students', 'Reset to built-in guide']) {
    assert.ok(page.includes(marker), `AdminServicesPage is missing: ${marker}`);
  }
});

test('public page prefers a published admin guide and falls back to the built-in one', () => {
  const page = read('pages/ServiceApplyPage.tsx');
  assert.match(page, /api\/services\/\$\{encodeURIComponent\(slug\)\}\/guide/);
  assert.match(page, /remoteGuide \?\? guideForService\(service\.service_key\)/);
  assert.match(page, /catch\(\(\) => \{ \/\* offline/, 'public guide fetch never throws into the page');
  const adminPage = read('pages/AdminServicesPage.tsx');
  assert.match(adminPage, /fetchAdminServiceGuide/);
  assert.match(adminPage, /saveAdminServiceGuide/);
});

test('the browser Supabase client refuses privileged keys', () => {
  const client = read('src/lib/supabase.ts');
  // The predicate moved to its own module so it can be tested behaviourally
  // (tests/supabase-key.test.ts); the client must still screen the key before
  // it can reach createClient.
  assert.match(client, /isPrivilegedKey\(supabaseKey\)/, 'the browser client screens the key before using it');
  assert.ok(
    client.indexOf('isPrivilegedKey(supabaseKey)') < client.indexOf('createClient(effectiveUrl'),
    'the screen must run before the client is created',
  );
  const guard = read('src/lib/supabaseKey.ts');
  assert.match(guard, /role === 'service_role'/);
  assert.match(guard, /sb_secret_/, 'the current secret-key format is refused too');
  assert.ok(!/console\.(log|error|warn)\([^)]*supabaseKey/.test(client.replace("console.error('Supabase browser key refused", '')), 'never log the key itself');
});
