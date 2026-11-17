# Performance: budgets, how they are measured, and what is left

EduReach ships a student on a mid-range Android phone over a metered Nigerian
mobile connection. The budgets below are the promise to that student; the audit
script is what keeps the promise checkable. This page records the numbers as
measured on `arena/b1c71591-edureach-hub`, how to reproduce them, and the work
that is still open.

Run it:

```bash
npm run build
npm run perf:audit     # exits non-zero if any budget fails
```

`scripts/perf-audit.ts` reads `dist/`, so it measures the artifact that would be
deployed, not the source tree.

## 1. Budgets and current measurement

| check | budget | measured | how it is measured |
| --- | --- | --- | --- |
| entry chunk | ≤ 100 KB gzip | **51.8 KB** | the `index` chunk: React, the router and the app shell |
| Supabase client chunk | ≤ 60 KB gzip | **53.0 KB** | its own vendor chunk, loaded by `AuthProvider` in the shell |
| bundle CSS | ≤ 51 KB gzip | **46.4 KB** | one stylesheet, minified |
| critical path | ≤ 214 KB gzip | **212.6 KB** | 6 entry/vendor/CSS/transitive static chunks; lazy routes excluded |
| all chunks | ≤ 396 KB gzip | **393.6 KB** | 72 chunks; a ceiling on the whole graph, not a first load |
| largest image | ≤ 64 KB each | **41.2 KB** | `public/news/photos/graduates.jpg` |
| raster images in the deploy | ≤ 320 KB | **310.4 KB** | 32 files under `public/` |
| font chain | 2 preconnects, one stylesheet, `display=swap`, no `@import` | pass | head of `index.html` |
| asset caching headers | hashed assets immutable, shell + worker `no-store` | pass | `public/_headers` |
| image loading strategy | every raster `<img>` declares `loading` or `fetchPriority` | **0 of 16** unlabelled | source scan, with a 4-file eager allowlist and a stated reason each |

The two numbers that move most are **critical path** (what a first visit must
parse before anything renders) and **all chunks** (how much of the app a student
can eventually be made to download). Both are within ~1% of their caps, which is
deliberate: the cap is the signal, so a new dependency that adds 40 KB cannot
land quietly.

## 2. How the critical path got small

- **Routing is lazy.** Every page is `React.lazy()` behind `Suspense`; the shell
  carries the layout, the auth state and nothing else.
- **The admin editor is doubly lazy.** `pages/AdminInstitutionIntelligencePage`
  is a route chunk; the ten-section review editor inside it is a second lazy
  import wrapped in its own `Suspense` (~8 KB gzip). Staff-only code never
  reaches a student's device.
- **Supabase has a budget of its own.** `@supabase/supabase-js` is 53 KB gzip and
  must be on every page because the session resolves in the shell. It is isolated
  in its own chunk so it can be measured and cached separately, rather than
  hiding inside the entry.
- **CSS is one file.** Multiple stylesheets would each cost a request and a
  parse; the build emits one, and its content-hashed filename makes it
  infinitely cacheable.
- **New sizeable modules are lazy by rule.** When a feature cannot be lazy (it
  runs in the shell), the budget is raised deliberately with a comment recording
  the reason and the new baseline — the ceiling has been moved twice for exactly
  this reason and both moves are in the script's history.

## 3. Images

The image pipeline (see `docs/features/NEWS-3-NEUTRAL-CARDS.md` §3) is the part
of performance work that is invisible to the JS budget:

- A card asks for the widths its slot needs (half, 1×, 2×), never a 2000px
  original. AVIF and WebP are offered before the original.
- Every image declares `width`/`height`, so nothing shifts as files arrive
  (layout shift is a performance cost, not a cosmetic one).
- `loading="lazy"` is the default; only `priority` images (the article hero) load
  eagerly, and they ask for `fetchPriority="high"`.
- Unhashed images get an hour of caching plus a day of `stale-while-revalidate`;
  content-hashed assets are `immutable`. Remote images are `no-store` because
  their owner sets the policy.
- The neutral placeholder is a ~0.5 KB SVG, not a photograph.

**Not measurable in this sandbox:** the Netlify Image CDN does not exist under
`npm run dev` or on the `.e2b.app` preview host, so `imageCdnEnabled` returns
false and the component serves the original file. Transformation is therefore
implemented and unit-tested but unproven end to end until a real deploy.

## 4. What is still open

1. **No field measurement.** These are build-time numbers. Core Web Vitals
   (LCP, CLS, INP) on a throttled phone have not been collected, because no
   browser or Lighthouse run is available here.
2. **All chunks is at 99% of its cap.** The next feature that adds a shared
   module will fail the audit, and the right answer will usually be trimming or
   lazy-loading rather than raising the ceiling again.
3. **The 16 remaining raster `<img>` sites** outside the news surfaces still
   build their own markup (each declares its loading strategy, which is what the
   audit checks). Moving them to `OptimizedImage` is mechanical but changes
   markup in several pages at once; it is tracked with the image-pipeline work
   rather than done blind.
4. **No CDN preconnect.** The Image CDN is same-origin, so no extra preconnect is
   needed — but a deploy that puts it on a different host must add one, or the
   first card image pays a DNS + TLS round trip.
