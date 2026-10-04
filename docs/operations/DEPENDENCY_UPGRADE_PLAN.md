# Dependency upgrade plan

**Finding this answers:** P3-6 — 19 packages were behind their latest release at
the 2026-10-04 audit (`npm outdated` below). The audit's judgement was "not
urgent; schedule deliberately". This is the schedule. Nothing here is applied by
the audit remediation: the release that follows this document is the one the
audit verified, and changing a runtime's major version inside a release-blocking
fix batch is how a green gate becomes a red one.

## Where things stood on 2026-10-04

| Package | Then | Latest | Kind |
| :--- | ---: | ---: | :--- |
| `react` / `react-dom` | 19.2.8 | 19.3.0 | minor |
| `@types/react` / `@types/react-dom` | 19.2.x | 19.3.0 | minor (types) |
| `@supabase/supabase-js` | 2.112.4 | 2.117.2 | minor |
| `@google/genai` | 2.19.0 | 2.27.0 | minor |
| `jsdom` | 30.1.1 | 30.1.2 | patch (test-only) |
| `tsx` | 4.23.13 | 4.23.15 | patch (tooling) |
| `autoprefixer` | 10.5.4 | 10.6.1 | minor (build) |
| `dotenv` | 17.4.2 | 18.0.5 | **major** (runtime) |
| `esbuild` | 0.25.12 | 0.28.2 | **major** (build) |
| `express` | 4.22.3 | 5.2.1 | **major** (runtime) |
| `@types/express` | 4.17.25 | 5.0.6 | major (types, rides with express) |
| `lucide-react` | 0.546.0 | 1.52.0 | **major** (icon set) |
| `motion` | 12.43.0 | 14.0.0 | **major** (animation) |
| `vite` | 6.4.3 | 8.3.2 | **major** (build) |
| `@vitejs/plugin-react` | 5.2.0 | 6.1.1 | major (rides with vite) |
| `typescript` | 5.8.3 | 7.0.2 | **major** (tooling) |
| `@types/node` | 22.20.1 | 26.6.4 | major (types; rides with the Node runtime) |

`npm audit` was clean (0 vulnerabilities) in the same run, so none of this is a
security response — it is maintenance.

## Schedule

Each step is one reviewed change, on its own branch, with the full gate
(`npm run ci` plus the browser suite in CI where it can run).

| Order | Batch | Contents | Why this order | Exit criteria |
| :-- | :--- | :--- | :--- | :--- |
| 1 | **Patches and test-only minors** | `jsdom`, `tsx`, `autoprefixer`, `@types/*` minors | Zero runtime surface; proves the process | Gate green |
| 2 | **Runtime minors** | `react`, `react-dom`, `@supabase/supabase-js`, `@google/genai` | Same major, real behaviour, best cost/benefit | Gate green; smoke check passes on a deploy preview |
| 3 | **Build majors, one at a time** | `esbuild` → `vite` + `@vitejs/plugin-react` | Bundler changes are observable in `perf:audit` and chunk output | 10/10 budget; `dist` diff reviewed |
| 4 | **Motion + icons** | `motion` 14, `lucide-react` 1.x | Visual, but localised | Visual pass on the pages named in the changelog |
| 5 | **Express 5 + `@types/express` 5** | Runtime framework | Biggest blast radius: wildcard routes, error-handling signature, `req.query` shape | Full API probe matrix re-run (`401` sweep, malformed JSON, 404 shapes) |
| 6 | **TypeScript 7** | Last | A compiler major will surface latent issues everywhere else; doing it after the runtime work means one migration, not five | `tsc --noEmit` clean with no `@ts-expect-error` additions |
| 7 | **Node 24/26 + `@types/node`** | Runtime floor | `.nvmrc`, workflow and `engines` move together | CI green on the new floor; `npm run backup:rehearsal` green |

## Rules

* **One major per change.** A batch that moves two majors cannot be bisected.
* **A major never rides a release-blocking fix batch.** Security fixes ship
  alone, on the version the gate verified.
* **Update `.nvmrc`, `engines` and the workflow together** — a split Node
  version is a class of bug this repository has already fixed once.
* **Re-run `npm outdated` at the start of each batch**; this table is a snapshot
  of 2026-10-04, not a live inventory.
