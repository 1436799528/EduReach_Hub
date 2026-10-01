# EduReach Newsroom Pipeline

Operational and editorial reference for automated news ingestion.

The audit of 30 September 2026 found the biggest gap between vision and code here:
the scheduled `daily-news-refresh` function only repaired missing images, so
"daily refresh" did not mean "daily news". This document describes the pipeline
that replaced it, the policy it enforces, and how to run and monitor it.

- Code: `src/server/newsroom/`
- Scheduled entry point: `netlify/functions/daily-news-refresh.ts` (`@daily`)
- Schema: `supabase/migrations/20260930120000_newsroom_ingestion_pipeline.sql`
- Operator CLI: `npm run newsroom:run | newsroom:check | newsroom:integrity`
- Admin console: **Admin → Newsroom CMS → Ingestion review queue**

---

## 1. What one run does

```
source registry (code catalogue + DB overrides)
      ↓
fetch (robots.txt, per-host throttle, timeout, byte cap)
      ↓
parse (RSS / Atom / JSON Feed / HTML link discovery + Open Graph metadata)
      ↓
normalise (canonical URL, headline normalisation, hashes)
      ↓
deduplicate (5 independent signals, see §4)
      ↓
classify (relevance score + category routing)
      ↓
quality gate (errors block, warnings flag for review)
      ↓
store  →  news_ingest_candidates  (every discovery, with its reason)
          news_articles           (Tier 1 auto-publish, or editor approval)
      ↓
housekeeping (expire stale news, close expired opportunities, repair images)
      ↓
report (news_ingest_runs row + console/log summary)
```

The daily report looks like this (from `news_ingest_runs`):

```
sources 9/11 | candidates 18 | duplicates 7 | rejected 4 | review 3 | published 4 | images 6 | expired 2 | errors 2
```

## 2. Editorial policy

### Source tiers

| Tier | Meaning | Publishing rule |
|---|---|---|
| 1 | Primary official source (JAMB, WAEC, NECO, NABTEB, NELFUND, NUC, NBTE, TETFund, FME, NYSC) | May publish automatically when relevance and the quality gate both pass |
| 2 | Established reporting (Punch, Vanguard, Premium Times, Guardian, TheCable, Daily Trust) | **Always** queued for human review |
| 3 | Secondary/aggregator | Discovery only; never the sole basis for a high-impact claim |
| 4 | Social accounts | Discovery only, disabled by default, never auto-published |

Tier 2 outlets are filtered by headline keyword (`requiresAnyTitleTerm`) so a
general news feed contributes education stories, not everything it publishes.

### What EduReach stores

Headline, source summary (≤400 characters), category, image and attribution.
The pipeline never reproduces a source's article text: the stored body is an
EduReach summary block containing the source summary, a category advisory
("confirm this on the official portal"), the source link and an independence
statement. Full-text reproduction is not implemented anywhere in this codebase.

### Auto-publish conditions (Tier 1 only)

All of the following must hold:

1. relevance score ≥ 0.50 and the item is on-topic;
2. the quality gate passes with **no warnings** (any warning downgrades to review);
3. the source publication date is present (no date → no reliable expiry → review);
4. no duplicate signal fires, including the "possible duplicate" band;
5. the source is `is_active` and its tier is 1.

Anything else becomes a `needs_review` candidate. A story cannot reach students
from a secondary source without an editor pressing **Publish**.

## 3. Source registry

The catalogue lives in `src/server/newsroom/sources.ts` (names, homepages,
tiers, trust scores, filters) and is upserted into `public.news_sources` on each
run. Operational fields — `feed_url`, `discovery`, `is_active`, `notes` — are
only written while `is_managed = true`; set `is_managed = false` on a row and
the pipeline stops overwriting it, so an operator fix survives deployment.

Discovery modes: `auto` (feed if configured, HTML fallback), `rss`, `html`.
HTML discovery scores links (date segments, slug depth, anchor length) and
ignores navigation, tag, author, feed and asset paths.

### Verify sources before enabling

Feed paths change, and some official sites block automated clients. Run:

```bash
npm run newsroom:check
```

This probes every configured source, prints status/items/latency, and records
`last_checked_at`, `last_status`, `last_error` in `news_sources`. Sources that
fail here will fail in production; either correct the feed path in the database
(`is_managed = false` first) or leave them to HTML discovery.

## 4. Deduplication

A unique slug is not duplicate prevention. Five independent signals are compared
against the recent article and candidate index:

| Signal | Level | Meaning |
|---|---|---|
| Canonical URL equality | exact | Same URL after stripping tracking parameters, fragments and `www` |
| Content hash equality | exact | Identical headline + summary text |
| Normalised headline equality | exact (same source) / likely (different source) | Reworded syndication of the same headline |
| Token Jaccard ≥ 0.82 or SimHash distance ≤ 3 | likely | Same story, different wording |
| Event fingerprint + ≤ 3 days | likely | Same entities and action (e.g. "JAMB registration deadline") |
| Jaccard ≥ 0.6 or SimHash ≤ 8 | possible | Suspect, not convincing: ingested for review, never auto-published |

Exact and likely matches are suppressed and counted; the matched article is
recorded on the candidate row. `news_articles.dedupe_key` carries a unique
index, so even a concurrent run cannot publish the same story twice — a 23505
conflict is counted as a duplicate, not an error.

## 5. Freshness and expiry

`news_articles` carries `source_published_at`, `last_verified_at`,
`verification_status` (`verified | needs_review | expired | superseded |
corrected | archived`), `expires_at`, `content_hash` and `dedupe_key`.

Expiry is set from the category TTL (JAMB/WAEC/NECO/NELFUND-type news expires
fastest: 90–150 days; general education: 365 days) measured from the **source**
publication date. The daily run calls `expire_stale_news()`, and the public news
API hides expired items from the feed while still serving the article page with
an `expired` status so a shared link is not a lie.

`close_expired_opportunities()` deactivates opportunities whose deadline has
passed, so a closed scholarship cannot be advertised as open.

## 6. Rate limiting and abuse control

`lib/rate-limit.ts` applies an in-process sliding window everywhere and a
durable Postgres counter (`check_rate_limit`) on the sensitive routes:

| Route | Limit |
|---|---|
| `POST /api/admin/bootstrap` | 5 / 15 min |
| `POST /api/cbt/guest-submit` | 30 / 10 min |
| `POST /api/admin/uploads` | 20 / 10 min |
| `POST /api/admin/content-manager/import/:resource` | 10 / 10 min |
| `POST /api/admin/newsroom/ingest` | 6 / hour |
| `POST /api/analytics/event` | 240 / min |
| all `/api/*` | 1200 / min per IP |

The durable layer fails open (with a log line) if the migration is not applied
yet, so a half-migrated environment degrades to the in-process limit rather than
breaking the endpoint.

## 7. Operations

```bash
npm run newsroom:run                 # real run
npm run newsroom:run -- --dry-run    # show decisions, write nothing (still reads the dedupe index, so credentials are required)
npm run newsroom:run -- --skip-images
npm run newsroom:check               # probe sources, record health
npm run newsroom:integrity           # print the content integrity report
```

Admin API (service-role, admin session required):

- `GET  /api/admin/newsroom/candidates?status=needs_review`
- `POST /api/admin/newsroom/candidates/:id/approve`
- `POST /api/admin/newsroom/candidates/:id/reject`
- `POST /api/admin/newsroom/ingest` (`{ "dry_run": true }` to preview)
- `GET  /api/admin/newsroom/runs`
- `GET  /api/admin/integrity`
- `GET  /api/health/ready` — dependency health (database reachability + latency)

Scheduled execution uses Netlify scheduled functions (`@daily`). The function
reads configuration from Netlify's environment first, then `process.env`, and
requires `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` (or
`SUPABASE_SECRET_KEY`). `EDUREACH_NEWSROOM_USER_AGENT` overrides the default
crawler user agent if the editorial contact address changes.

## 8. Failure modes and monitoring

| Symptom | Cause | Action |
|---|---|---|
| `sources_failed > 0` | Site down, blocked, moved, or robots-disallowed | `npm run newsroom:check`, fix `feed_url` or retire the source |
| `published 0`, `review 0` | Feed path wrong but homepage reachable | Expected fallback; check `perSource` item counts |
| `candidates_found > 0`, `duplicates` high | Genuine repeated coverage | Normal; the report shows which signal matched |
| Run status `failed` | ≥ 3 recorded errors | Inspect `news_ingest_runs.report.errors` |
| Review queue growing | Editorial capacity, not a bug | Approve/reject from Admin → Newsroom CMS |

A run with zero sources reachable is a `partial`/`failed` run, not a silent
success: source failures are always recorded on the run and in `news_sources`.

## 9. What this pipeline does not do

- It does not generate or paraphrase article text with a model. `@google/genai`
  remains declared in `package.json` but unused; nothing here depends on it.
- It does not publish social-media discovery.
- It does not verify claims against a second source. Tier 1 items are trusted
  because they come from the body that owns the information; Tier 2 items get a
  human.
- It does not replace the CBT question-bank or school-directory data work.
  `content_integrity_report()` reports on those areas, but populating them is
  editorial/operational work, not automation.
