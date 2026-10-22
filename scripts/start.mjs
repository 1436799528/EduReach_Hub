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

createRequire(import.meta.url)('../build/server.cjs');
