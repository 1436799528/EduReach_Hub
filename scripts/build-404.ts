/**
 * `dist/404.html` — the shell, served with a 404 status.
 *
 * Netlify answers an unknown path with the catch-all rule at the end of
 * `netlify.toml`, which points at `/404.html`. That file has to exist in the
 * publish directory, and it should be the application shell: the router then
 * renders the same "Page Not Found" screen a reader already sees, but the
 * response status finally tells a crawler the truth.
 *
 * Copying beats a second Vite entry: the bytes are identical to `index.html`, so
 * a duplicated build would only be able to drift from it.
 *
 * Runs after `vite build`, before the secret scan, so the copy is scanned too.
 */

import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const index = join(dist, 'index.html');
const notFound = join(dist, '404.html');

if (!existsSync(index)) {
  console.error('FAIL dist/index.html is missing — run this after `vite build`.');
  process.exitCode = 1;
} else {
  copyFileSync(index, notFound);
  console.log('ok   dist/404.html written from dist/index.html');
}
