# Netlify build incident — 22 November 2026

The live site (https://edureachhub.netlify.app) is still serving deploy
`6aff4168cb81c86d5bb859d2` from 19 November 2026. Every deploy created after
that has ended in `state: "error"` with no publish.

## What was ruled out

The failure is not in this repository's build. Deploys were created from this
branch with progressively smaller configurations, and all of them failed:

| Commit | Build configuration | Result |
| --- | --- | --- |
| `0ca82b2` | full build, host Supabase aliases | error, ~26 s |
| `6f13573` | full build + `NPM_FLAGS=--include=dev` | error, ~26 s |
| `8a4ea5d` | full build + unconfigured-client opt-out | error, ~25 s |
| `7a0e2ff` | wrapper that records the build log and always exits 0 | error, ~28 s |
| `02a829b` | `mkdir -p dist && echo ok > dist/index.html` | error, ~13 s |
| `6200b81` | same trivial command, no `.nvmrc` | error, ~12 s |
| `7f30d89` | full build, functions pointed at an empty directory | error, ~22 s |

A build command that only writes a four-line HTML file cannot fail, and a
wrapper that exits 0 cannot fail in the build stage. The error therefore happens
after the build command (publish/upload), or the project is refusing builds
before they start. Function bundling is ruled out by the empty-functions deploy,
and the client Supabase guard is ruled out by the opt-out deploy.

The same commands pass locally:

- `CONTEXT=production SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run build` → success.
- `npm run build` → success; `dist/` is produced.
- `@netlify/zip-it-and-ship-it` bundles both functions with `node_bundler = "esbuild"`
  (`api` ≈ 3.5 MB after Vite was kept out of the function bundle,
  `daily-news-refresh` ≈ 0.7 MB).

## What to check in Netlify (owner action)

Netlify's deploy log is only available in the authenticated dashboard; the
public API returns `summary.status: "unavailable"` and no log URL.

1. Open https://app.netlify.com/projects/edureachhub/deploys and the most recent
   failed deploy. The first red line names the failing stage.
2. **Project configuration → Build & deploy → Build settings**: confirm
   "Stop builds" is **off**. A disabled build setting produces exactly this
   signature: a deploy is created and errors within seconds regardless of the
   build command.
3. **Project configuration → Build & deploy → Repository**: confirm the GitHub
   app still has access to `1436799528/EduReach_Hub` (re-authorise if the link
   shows as disconnected).
4. **Usage**: confirm build minutes are not exhausted for the billing cycle.
5. Paste the failed deploy's log into the PR if none of the above is the cause.

Once builds run again, the first successful production deploy will include the
content and fixes merged in `49d784f` plus this branch.

## Repository-side hardening retained from the investigation

- `NPM_FLAGS="--include=dev"` so a production `NODE_ENV` cannot skip Vite.
- `EDUREACH_ALLOW_UNCONFIGURED_CLIENT=1` in `netlify.toml`: if the site has no
  public Supabase pair, the host publishes the unconfigured shell instead of
  staying on an old deploy. A privileged key still fails the build.
- Vite's development middleware moved to `server-dev.mjs` and loaded through a
  non-literal dynamic import, keeping its native Rollup/Lightning CSS binaries
  out of the serverless function.
