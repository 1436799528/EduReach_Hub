// Print a compact GitHub annotation for each failed Playwright test.
//
// The full HTML report is uploaded as an artifact, but a CI job log can be
// truncated or unavailable to a reviewing agent. These annotations carry the
// assertion and the page snapshot, which is usually enough to tell a real
// regression from a fixture problem.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'test-results';
if (!existsSync(root)) process.exit(0);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const escape = (value) => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').slice(0, 1400);

const contexts = walk(root).filter((path) => path.endsWith('error-context.md'));
for (const path of contexts.slice(0, 6)) {
  const body = readFileSync(path, 'utf8');
  const title = path.split(/[\\/]/).slice(1, 2).join('/');
  console.log(`::error title=Playwright ${escape(title)}::${escape(body)}`);
}
