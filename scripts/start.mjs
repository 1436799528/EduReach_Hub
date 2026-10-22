// Cross-platform production start.
//
// `npm start` used to be `NODE_ENV=production node build/server.cjs`. That is a
// POSIX shell prefix: in PowerShell and in cmd.exe it fails with
// `'NODE_ENV' is not recognized as an internal or external command`, which also
// broke the Playwright webServer (it runs `npm start`). Setting the variable in
// Node before loading the server keeps the same behaviour on every platform and
// needs no new dependency.
//
// `.env` is still read by the server itself (`import 'dotenv/config'`), and
// dotenv never overwrites a variable that is already set, so an explicit
// NODE_ENV in the environment still wins.
process.env.NODE_ENV ??= 'production';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

try {
  require('../build/server.cjs');
} catch (error) {
  // The most common first-run failure, and the least readable: the build was
  // made after a dependency was added, but `node_modules` still predates it, so
  // Node reports a bare MODULE_NOT_FOUND with a stack trace. Say what to do.
  if (error?.code === 'MODULE_NOT_FOUND') {
    const missing = /Cannot find module '([^']+)'/.exec(error.message)?.[1] ?? 'a dependency';
    console.error(
      [
        '',
        `EduReach cannot start: the module "${missing}" is not installed.`,
        '',
        'This usually means package.json changed (a new dependency was added) but',
        'node_modules was not refreshed. In the project folder, run:',
        '',
        '    npm ci',
        '',
        'then start again. If it still fails, run `npm run build` first.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  throw error;
}
