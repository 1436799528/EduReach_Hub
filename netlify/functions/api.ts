import serverless from 'serverless-http';
import { app } from '../../server';

/**
 * Netlify Functions entry point for the same Express app used by the
 * self-hosted Docker target.
 *
 * `server.ts` deliberately does not bind a listener when NETLIFY is set, so
 * this wrapper is the only runtime. The `/api/*` redirect in netlify.toml
 * rewrites every API request to this function. It is exported as the legacy
 * `handler` (not a v2 default export) because `serverless-http` speaks the
 * Lambda event/response contract; mixing a v2 `config.path` with a legacy
 * handler is not a supported combination.
 *
 * The app already normalises both `/api/...` and
 * `/.netlify/functions/api/...` request paths, so the function works whether
 * Netlify preserves the original URL or the rewrite target.
 */
export const handler = serverless(app);
