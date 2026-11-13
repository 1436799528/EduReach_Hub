import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const mockCbtUi = process.env.PLAYWRIGHT_JAMB_UI === '1';

for (const name of Object.keys(process.env)) {
  if (name.startsWith('VITE_')) delete process.env[name];
}

if (mockCbtUi) {
  process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'e2e-public-key';
}

await build({
  configFile: resolve(root, 'vite.config.ts'),
  envDir: resolve(root, 'tests/e2e'),
  mode: 'e2e',
  root,
});
