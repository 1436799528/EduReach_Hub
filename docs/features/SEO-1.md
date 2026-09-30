# Feature: SEO-1 — Indexability, canonicals, structured data, sitemap

Status: implementing · Owner: engineering · Decision: `docs/architecture/07-FEATURE-CATALOGUE.md`

## Purpose

EduReach publishes content that students search for by name every day — JAMB
registration windows, WAEC timetables, institution profiles, scholarships — and
none of it is individually discoverable. Today the repository has:

- one static `<meta name="robots" content="index,follow">` for the whole site;
- no `robots.txt` and no `sitemap.xml`;
- no `rel="canonical"` on any route, so aliases (`/signin`, `/calculator`,
  `/scholarships`, `/track`) compete with their canonical URLs;
- no Open Graph or Twitter metadata, so links shared into WhatsApp — the channel
  Nigerian students actually use — render as bare URLs;
- no structured data, so search engines cannot tell an article from a school
  profile.

SEO-1 makes public content individually indexable, keeps private and placeholder
surfaces out of the index, and gives shared links a real preview. It changes no
student-facing behaviour beyond link previews.

## User

Indirect: prospective and current students arriving from search or from a shared
WhatsApp link. Operator: `super_admin` (deployment configuration only).
No student role can change any of this, and nothing here exposes student data.

## User Flow

1. Crawler requests `/robots.txt` → receives crawl rules and the sitemap location.
2. Crawler requests `/sitemap.xml` → receives canonical public URLs with
   `lastmod` for articles.
3. Crawler or student opens a public page → the document has a unique title, a
   meta description, a canonical URL, Open Graph/Twitter tags and, where
   meaningful, JSON-LD.
4. Student shares an article on WhatsApp → the preview shows headline, summary
   and image, attributed to the source.
5. Crawler requests `/admin` or `/dashboard` → sees `X-Robots-Tag: noindex` and
   is told to skip it in `robots.txt`.

## Screens

No new screens. Meta handling added to: `App.tsx` (all routes),
`pages/NewsArticlePage.tsx` (article), `pages/SchoolDetailsPage.tsx`
(institution).

## Routes

| Route | Type | Behaviour |
|---|---|---|
| `GET /robots.txt` | public, cacheable 24 h | Crawl rules + `Sitemap:` line. Served by Express; on Netlify a forced redirect sends it to the API function |
| `GET /sitemap.xml` | public, cacheable 1 h | Canonical public URLs; static entries always, database entries when Supabase is configured |
| All public routes | — | Client sets title, description, canonical, OG/Twitter, JSON-LD |

Private paths (`/admin/*`, `/dashboard/*`, `/profile*`, `/settings*`, `/search`,
`/cbt/practice`, `/cbt/results*`, `/cbt/setup/*`, `/services/track`, `/track`,
auth routes) receive `X-Robots-Tag: noindex, nofollow` from the server and are
disallowed in `robots.txt`. This is enforced server-side, not only by the client.

Invalid identifiers are unchanged: `/news/unknown` and `/schools/unknown` render
the existing 404 page and are excluded from the sitemap.

## Components

Reused: none. New: no UI components — this feature is metadata and server
routing only. Rejected candidates: a "share" button redesign (out of scope), an
SEO panel in the admin console (no operator need identified).

## User Actions

Share a link (existing browser/platform behaviour). No new in-app actions.

## Button Logic

N/A — no new buttons. The existing share control on the article page is
unchanged; only the preview metadata that platforms read is added.

## Data

Read: `news_articles` (`slug`, `title`, `excerpt`, `image_url`, `category`,
`published_at`, `updated_at`, `source_name`, `expires_at`, `verification_status`),
`institutions` (`school_name`, `acronym`, `state`, `institution_type`,
`website_url`), `src/data/services.ts` + live service slugs.

`src/lib/api.ts` now exposes the governed fields on `NewsItem`
(`source_name`, `updated_at`, `expires_at`) so the article page can emit
provenance and freshness. `fetchNews` / `fetchNewsItem` select the governed
column set and fall back to the legacy set when the newsroom migration has not
been applied, and expired updates are filtered out of the news feed (their pages
stay linkable and are marked `noindex`). `isNewsItemFresh` mirrors the SEO
freshness rule.

Written: nothing. SEO-1 is read-only.

## Data Source

Supabase is authoritative for dynamic sitemap entries and page metadata. Static
route metadata lives in `src/lib/seoMeta.ts`; the live-service list moves to
`src/data/liveServices.ts` so the router and the sitemap cannot disagree.

## Backend

- `src/server/seo.ts` — `buildRobotsTxt(origin)`, `buildSitemapXml(entries)`,
  `collectSitemapEntries(client, origin)`, `resolveSiteOrigin(req)`.
- `src/server/seo.ts` — `isNonIndexablePath(path)` is the single server-side
  indexability rule (private, auth, tracker, placeholder and non-live-service
  paths). `server.ts` imports it for the `X-Robots-Tag` header so the header,
  `robots.txt` and the sitemap cannot drift apart. Exact and single-segment
  matching only, so `/tools/cgpa-calculator` is never caught by the `/tools`
  placeholder rule.
- `server.ts` — `GET /robots.txt` and `GET /sitemap.xml` (plus `/api/…` aliases
  for the Netlify function path), `X-Robots-Tag` headers on non-indexable SPA
  paths. Registered as individual string paths, not an array, so route
  introspection (the unauthenticated-access matrix in `tests/api.test.ts`)
  keeps working.
- `EDUREACH_SITE_URL` (optional) pins the canonical origin; otherwise the origin
  is derived from `x-forwarded-host`/`host`. No domain is hard-coded.

## Security

Nothing new is exposed: the sitemap lists only URLs that are already public and
canonical, never student data, never admin paths, never expired articles.
Database reads use the existing server client (service role) but select only
public columns. Rate limiting is unaffected (the two routes are outside `/api`;
they are static, cacheable responses).

## States

- **Loading** — N/A for crawlers (server-rendered).
- **Success** — well-formed XML/plain text with correct content types.
- **Empty** — a sitemap with only static routes when the database is unconfigured
  or empty; never a 500 and never a fabricated URL.
- **Error** — the sitemap falls back to static entries if the database read
  fails; a failure is logged, not surfaced as XML-invalid output.
- **Offline** — N/A (server-rendered; client metadata is applied from route data
  and degrades to the static route defaults).

## Edge Cases

| Case | Behaviour |
|---|---|
| Database table missing (unmigrated) | Article/institution queries fail → static sitemap only, run logged |
| Article expired | Excluded from the sitemap; page-level meta emits `noindex` and no JSON-LD `datePublished` renewal |
| Article without an image | OG image omitted rather than pointing at a placeholder |
| Very large news table | Capped at 500 most recent articles, `lastmod` from `updated_at` |
| Institution with no website/state | JSON-LD omits the missing fields rather than inventing them |
| Duplicate institution names | Both URLs appear; the integrity report already flags the duplicates for curation |
| Alias URL opened directly | Serves normally, canonical points at the canonical path |
| Non-live service slug | Excluded from the sitemap and marked `noindex` (it renders the coming-soon panel) |
| Request without a host header | Falls back to `http://localhost` in development; production requires a real host |

## Analytics

None. Crawler traffic must not enter `site_analytics_events` (it would corrupt the
funnels). No new event names.

## Notifications

N/A.

## Testing

- `tests/seo.test.ts`
  - canonical mapping for every alias and for `/services/apply/:slug`;
  - indexability matrix: private, placeholder, non-live service, expired article;
  - unique titles/descriptions across all indexable static routes;
  - `applySeo` against jsdom: sets canonical, OG, Twitter, robots, JSON-LD and
    removes JSON-LD when navigated to a route without structured data;
  - JSON-LD builders produce valid JSON with the required fields;
  - `buildRobotsTxt` disallows private paths and advertises the sitemap;
  - `buildSitemapXml` escapes entities, deduplicates and sorts;
  - `collectSitemapEntries` includes static + database entries, and still returns
    static entries when the database client throws;
  - endpoint tests: `/robots.txt` and `/sitemap.xml` return 200 with correct
    content types, the `/api/…` aliases work, indexable routes carry no
    `X-Robots-Tag`, and non-indexable routes carry `noindex, nofollow`.

## Evidence (as built)

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Tests | `npm test` | 186/186 pass (14 new in `tests/seo.test.ts`, 172 pre-existing) |
| Bundle | `npm run build` | client + `build/server.cjs` built |
| Prod smoke | `PORT=3112 node build/server.cjs` | `/robots.txt` 200 `text/plain` + `Sitemap:` line; `/sitemap.xml` 200 `application/xml`, 18 entries (14 static + 4 live services); `/api/robots.txt`, `/api/sitemap.xml` 200; `X-Robots-Tag: noindex, nofollow` on `/admin/news`, `/dashboard`, `/login`, `/nabteb`, `/tools`, `/admission/unilag`, `/services/not-live`; absent on `/`, `/news`, `/tools/cgpa-calculator`, `/services/results` |
| Config | `netlify.toml` parsed with `tomllib` | forced redirects for `/robots.txt` and `/sitemap.xml` sit after `/api/*` and before the SPA fallback |

Not verified locally: live crawler behaviour on the deployed host (no egress in
the sandbox) — re-run the smoke matrix against the deployed URL after the next
deploy, and submit the sitemap in Google Search Console.
- Not covered here: Google's rendering path (needs deployment). E2E crawler
  checks are listed as follow-up in `OBS-1`.
