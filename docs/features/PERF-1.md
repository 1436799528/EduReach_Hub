# Feature: PERF-1 — Performance measurement and budget

Status: **in progress** — this specification was written before the measurement
code and the fixes, per `docs/architecture/08-FEATURE-TEMPLATE.md`. Evidence is
at the end and is filled in as the work lands.

## Purpose

PERF-1 answers the question the catalogue has carried since the audit: **is this
product fast, or is that assumed?** Performance has been asserted in commit
messages and design documents and never measured. The feature has three parts,
in this order:

1. **Measure** — a reproducible measurement of what the deployed artefact
   actually ships (bytes, requests, caching, image weights) and of what a
   throttled browser experiences (LCP, CLS, long tasks, transfer sizes).
2. **Fix what the measurement names** — no speculative optimisation, no
   redesign. Every change in this feature must be traceable to a number in the
   baseline table below.
3. **Keep it measured** — budgets that fail the gate when they are breached, so
   "fast" stops being a claim someone makes and becomes a check that runs on
   every pull request.

A fourth part is deliberately **not** deliverable from this environment: **field
data** (CrUX / Search Console Core Web Vitals). It requires the deployed origin.
The runbook for it is in Testing, and the honest limitation is recorded in
Known limitations rather than papered over with a lab number presented as a field
number.

## User

* **Every student on a Nigerian mobile network** — the primary user. 4G at
  ~1.6 Mbps downlink with 150 ms RTT is the measurement profile, not a fast
  office connection.
* **A student on a metered data plan** — bytes are money. The image work matters
  more to this user than a millisecond of LCP.
* **A returning visitor** — repeat-visit performance is caching, which is a
  response-header decision, not a bundle decision.
* **A maintainer** — needs one command that prints the budget table and a gate
  that fails when the budget is broken, without a browser on their laptop.
* **A reviewer** — needs the numbers, not adjectives: the budgets, the measured
  values, and which change moved which number.

## User Flow

1. A student taps a link to `/` on a mid-range Android over 4G. The HTML arrives,
   the bundle CSS and the entry JS are fetched in parallel, the font CSS is
   fetched at the same time instead of after the bundle (measured baseline: it
   waited, because the font was a CSS `@import`).
2. The header, the search hero and the first card paint. Everything below the
   fold — news thumbnails, brand emblems, the study-centre banner — is fetched
   only when it is approached, and every image sits in a box the page already
   reserved, so nothing jumps.
3. The student taps into an article. Its hero image is the largest paint on that
   screen; it is decoded off the main thread and its box is reserved before the
   bytes arrive.
4. The student returns a day later. Hashed assets are answered from the browser
   cache without a round trip (baseline: `must-revalidate` on every asset).
5. A maintainer runs `npm run perf:audit` after `npm run build` and sees the
   budget table; CI runs the same thing plus the throttled browser pass.

## Screens

The public routes are the ones that matter — `/`, `/news`, an article, `/schools`,
`/past-questions`, `/services`, plus `/login`. The authenticated dashboard and the
admin console are measured for **bytes** (they share the same entry bundle) and
not for LCP: they cannot be reached in CI without credentials, the same limit
A11Y-1 recorded.

## Routes

No new routes. No route is changed. The measurement covers `/` and `/news` in the
browser and the whole `dist/` output on disk.

## Components

New:

| Component | Responsibility |
|---|---|
| `scripts/perf-audit.ts` | Static budget audit over `dist/`, `public/`, `public/_headers` and `index.html`: gzip sizes, largest images, render-blocking chain, cache headers. Prints a table; exits non-zero on a breach. |
| `tests/perf.test.ts` | Proves the audit fails on a breach, and that the repository currently passes it. |
| `tests/e2e/perf.spec.ts` | Chromium over CDP: throttled mobile profile, LCP/CLS/long tasks/TTFB/transfer bytes on the landing and news routes. Prints the table; asserts coarse budgets; annotates the check run on failure. |

Touched, each because of a measured number:

| File | Change | Why |
|---|---|---|
| `index.html` | `preconnect` to `fonts.googleapis.com` / `fonts.gstatic.com` (crossorigin) and a `<link rel="stylesheet">` for Inter | The font CSS was a CSS `@import`: it could not start until the 42 KB bundle CSS had arrived and parsed. |
| `src/styles/theme.css` | The `@import` line is removed | Same font, one fewer waterfall step. |
| `public/_headers` | `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` | The filenames are content-hashed; without the header every repeat visit revalidated every chunk. |
| Image files under `public/` | Re-encoded (and WebP variants added for the code-referenced brand marks) | The brand emblem was 140 KB rendered in a 28 px box. |
| `<img>` sites | `decoding="async"`, `loading="lazy"` below the fold, explicit dimensions where the box is not already fixed by CSS | LCP and CLS. |

No component is rewritten, no stylesheet is reorganised, no dependency is added
or removed for this feature.

## User Actions

Unchanged. PERF-1 adds no control, no state and no interaction. If a user can
tell that this feature shipped other than by the page appearing sooner, it has
failed its own scope.

## Button Logic

Not applicable — no button, menu, link or form changes. The one behaviour change
is invisible and deliberate: images below the fold are no longer fetched before
the user scrolls.

## Data

No new data, and no new persisted anything. Budgets are declared in
`scripts/perf-audit.ts` next to the numbers they judge, so a budget cannot drift
away from its reason.

## Data Source

Three sources, in increasing order of how much they can be trusted:

1. **The built artefacts** (`dist/`) — the only thing that ships. Raw and gzip
   bytes per file, the largest files, and what `index.html` references. Exact,
   reproducible, and identical in CI and here.
2. **The source of the shipped HTML/CSS** — `index.html`, `public/_headers`,
   `public/`, and the `<img>` sites parsed with the TypeScript compiler API
   (the same reason A11Y-1 uses it: regexes over JSX lie).
3. **A throttled Chromium in CI** — the only layer that measures paint. Lab
   numbers, on a shared runner, so budgets there are loose by design and the
   table is evidence, not a contract.

**Baseline, measured 2026-09-30 on `arena/01a0f3bd-edureach-hub` before any
PERF-1 change** (`npm run build`, `gzip -c | wc -c`, `du`):

| Signal | Baseline |
|---|---|
| Entry chunk `index-*.js` | 312 KB raw / **90 KB gzip** |
| Supabase client chunk | 216 KB raw / **56 KB gzip** — on the critical path for every page, including anonymous ones |
| Bundle CSS `index-*.css` | 248 KB raw / **42 KB gzip** |
| Route chunks | 16–44 KB raw each (29 lazy routes) |
| First-load JS+CSS, landing | ≈ **188 KB gzip** + the route chunk |
| Fonts | Inter, **six weights** requested through a CSS `@import` (a second stylesheet + font files after the bundle) |
| `public/` images | `nelfund.png` **140 KB** (847×351, rendered ≤38 px), `jamb.png` 72 KB (250×235), `graduates.jpg` 64 KB, `jamb-cbt.jpg` 60 KB, `campus.jpg` 44 KB, `waec-result.png` 40 KB |
| Largest single asset | 140 KB — 7 % of the entire `dist/` payload, for a logo drawn at 28 px |
| `<img>` elements in the app | 16 — **2** with `loading`, **0** with `decoding`, **3** with explicit `width`/`height` |
| `/assets/*` caching | **No `Cache-Control`** in `public/_headers` (Netlify's default revalidation applies) |
| Third-party origins | `fonts.googleapis.com` (CSS), `fonts.gstatic.com` (font files) — both already allowed by the CSP |
| Service worker | network-first for navigations, `/assets/` left to the HTTP cache, cache-first for `/icons/`, `/logo/`, `/news/photos/` |

The image and caching rows are the ones the audit calls embarrassing; the bundle
row is the one that is merely expensive. Both are measured before anything is
changed, so the diff can be read against them.

## Backend

Only one server-side touch, and it is a header: `public/_headers` is served by
the host. No API, no query, no RLS change, no worker change. The newsroom
pipeline that fills `news_articles.image_url` is untouched.

## Security

* The caching rule is scoped to `/assets/*`, where filenames are
  content-hashed. `/index.html` and `/sw.js` keep `no-store` — a stale shell or a
  stale service worker is a correctness bug, not a cache win.
* No CSP relaxation: the fonts were already allowed by `style-src
  https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`. Moving
  from a CSS `@import` to a `<link>` changes when the request is made, not which
  origin is trusted.
* Re-encoded images are byte-identical in dimension and content — no cropping, no
  visual change, and the originals that the database references by path stay in
  place for `og:image` and for rows that already point at them.
* Nothing in this feature weakens an authorization decision, and no
  client-supplied value is trusted anywhere near it.

## States

| State | Requirement |
|---|---|
| Cold cache | Measured: the throttled run starts from a fresh context, with the service worker unregistered. |
| Warm cache | The immutable asset header is what makes this fast; verified by header inspection in the static audit, not by a browser run (CI cannot keep a profile between runs). |
| Slow network | Covered: the browser pass throttles to ~1.6 Mbps / 150 ms and 4× CPU slowdown. |
| Images disabled / broken | Unchanged from A11Y-1: every image has an `alt`, and the news card swaps to an intentional placeholder on error. |
| Reduced motion | Unchanged; PERF-1 adds no animation. |

## Edge Cases

1. **A budget that is set too tight** fails honest work on a noisy runner. The
   browser budgets are therefore coarse (a regression of the kind this feature is
   about — a doubled bundle, a 140 KB logo — trips them; a 5 % wobble does not),
   and the *static* budgets are tight because they are exact.
2. **A budget that is set too loose** is decoration. Each budget in the audit
   carries the measured baseline next to it, so the slack is visible.
3. **`dist/` missing** — the audit says to run `npm run build` first rather than
   silently passing.
4. **A new heavy asset added to `public/`** — the audit fails on any single file
   over the image budget, so the next 140 KB PNG cannot arrive unnoticed.
5. **The font CDN is unreachable** — the stylesheet is loaded with
   `display=swap`, and `--er-font-sans` falls back to Arial; the page must remain
   usable, which the browser pass would still pass on (it measures layout, not
   the font file).
6. **`og:image` and database paths** — the re-encoded images keep their original
   filenames; the WebP variants are additions referenced only from code.

## Analytics

None. No event, no beacon, no third-party analytics script is added. Measuring
users is exactly the thing this feature refuses to do; it measures the artefact
instead.

## Notifications

Not applicable — nothing here notifies anyone. A budget breach notifies the
person who opened the pull request, through the same check that already gates
the merge, which is the mechanism TEST-1 established rather than a second one.

## Testing

| Layer | Check | Runs |
|---|---|---|
| Unit (node:test) | `tests/perf.test.ts` — the audit's budget arithmetic and its failure paths: a synthetic oversized asset fails, a missing `dist/` fails with instructions, a missing cache header fails, and the repository as committed passes | `npm test`, locally and in CI |
| Tooling | `npm run perf:audit` — the budget table for a human | after `npm run build`, in the gate |
| Browser (Playwright) | `tests/e2e/perf.spec.ts` — throttled Chromium, LCP/CLS/long tasks/TTFB/transfer bytes, coarse budgets, annotated failures | `npm run test:e2e` (CI: browsers cannot be downloaded in this environment) |
| Field (production) | Not executable here. The runbook: PageSpeed Insights API (`psi` v5) against the deployed origin **three times**, CrUX history for the origin once it has traffic, and Search Console → Core Web Vitals for the URL groups. Record p75 LCP/INP/CLS per group, the date, and the deployment SHA next to them — a number without a SHA is not evidence. | manual, after deployment |

The gate is extended, not duplicated: `perf:audit` joins `npm run ci` after
`build`, and the browser pass rides in the Playwright run that already exists.
`tests/ci.test.ts` is updated in the same commit so the gate's shape stays
asserted rather than assumed.

## Evidence

Filled in when the measurement and the fixes land (see the end of this file).

## Known limitations (declared up front)

1. **No field data.** CrUX/PSI numbers cannot be produced without a deployed
   origin, and the deployment decision (D5 in `docs/DEPLOYMENT_DECISION.md`) is
   still open. Lab numbers from a CI runner are not field numbers and are not
   presented as such.
2. **The runner is not a phone.** Chromium on a shared CI machine with CDP
   throttling approximates a mobile device; it is a consistent relative signal,
   not an absolute one. The absolute budgets are therefore coarse.
3. **No real-device testing.** No mid-range Android, no iOS Safari, no slow
   network on an actual radio.
4. **INP is approximated.** Interaction to Next Paint needs scripted
   interactions to be meaningful; the browser pass reports long tasks and TBT
   instead and says so.
5. **Third-party scripts were not a factor.** The app loads none; if one is added
   later, this budget does not model it (the static audit will still see its
   bytes only if it is bundled).
6. **The caching header is host-specific.** `public/_headers` is Netlify syntax.
   If the deployment host changes (D5), the rule must be re-expressed in the new
   host's format — recorded here so the optimisation is not silently lost.
