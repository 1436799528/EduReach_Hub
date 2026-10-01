import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classify, routeCategory } from '../src/server/newsroom/classify';
import { buildIndexEntry, eventFingerprint, findDuplicate } from '../src/server/newsroom/dedupe';
import { parseFeed, parseJsonFeed, discoverArticleLinks, extractPageMeta } from '../src/server/newsroom/parse';
import { runIngestion, type NewsroomSupabase } from '../src/server/newsroom/pipeline';
import { expiresAtFor, runQualityGate, ttlDaysForCategory } from '../src/server/newsroom/qualityGate';
import { crawlDelayMs, isPathAllowed, parseRobots } from '../src/server/newsroom/robots';
import {
  canonicalUrl,
  contentHash,
  dedupeKeyFor,
  decodeHtmlEntities,
  hammingDistance,
  hash64,
  jaccard,
  normalizeTitle,
  simhash64,
  slugify,
  stripHtml,
  tokenize,
  truncate,
} from '../src/server/newsroom/text';
import type { SourceDefinition } from '../src/server/newsroom/sources';

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------

test('canonicalUrl collapses tracking noise, fragments, www and trailing slashes', () => {
  const canonical = canonicalUrl('https://www.jamb.gov.ng/news/2026-utme/?utm_source=x&utm_medium=y&b=2&a=1#top');
  assert.equal(canonical, 'https://jamb.gov.ng/news/2026-utme?a=1&b=2');
  assert.equal(canonicalUrl('http://PunchNG.com/feed/'), 'https://punchng.com/feed');
  assert.equal(canonicalUrl('/relative', 'https://nelfund.ng/news/'), 'https://nelfund.ng/relative');
  assert.equal(canonicalUrl('javascript:alert(1)'), '');
  assert.equal(canonicalUrl('not a url'), '');
});

test('normalizeTitle and tokenize ignore case, punctuation and stopwords', () => {
  assert.equal(normalizeTitle("JAMB’s 2026 UTME registration: deadline extended!"), "jamb's 2026 utme registration deadline extended");
  assert.deepEqual(tokenize("JAMB's 2026 UTME registration"), ['jamb', '2026', 'utme', 'registration']);
  assert.deepEqual(tokenize('JAMB releases the 2026 UTME results'), ['jamb', 'releases', '2026', 'utme', 'results']);
  assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  assert.equal(jaccard(['a', 'b'], ['c', 'd']), 0);
});

test('hash helpers are deterministic and simhash is distance-aware', () => {
  assert.equal(hash64('jamb'), hash64('jamb'));
  assert.notEqual(hash64('jamb'), hash64('waec'));
  const first = simhash64(tokenize('JAMB extends 2026 UTME registration deadline'));
  const near = simhash64(tokenize('JAMB extends 2026 UTME registration deadline by one week'));
  const far = simhash64(tokenize('Super Eagles beat Ghana in friendly match'));
  assert.ok(hammingDistance(first, near) < hammingDistance(first, far));
  assert.equal(hammingDistance('zzzz', '0000000000000000'), 64);
});

test('contentHash and dedupeKeyFor are stable and content-sensitive', () => {
  const body = 'The board said registration closes on Friday and urged candidates to print their slips early.';
  assert.equal(contentHash('JAMB extends registration', body), contentHash('JAMB extends registration', body));
  assert.equal(contentHash('Short', ''), '', 'short text is not a usable content signature');
  assert.match(dedupeKeyFor({ canonicalUrl: 'https://jamb.gov.ng/x', title: 'A' }), /^u:[0-9a-f]{16}$/);
  assert.match(dedupeKeyFor({ canonicalUrl: '', title: 'JAMB extends registration deadline' }), /^t:[0-9a-f]{16}$/);
});

test('html helpers decode entities, strip scripts and truncate on a word boundary', () => {
  assert.equal(decodeHtmlEntities('JAMB &amp; WAEC &#8212; 2 &lt; 3'), 'JAMB & WAEC — 2 < 3');
  assert.equal(stripHtml('<p>Hello <script>alert(1)</script><strong>world</strong></p>'), 'Hello world');
  assert.equal(slugify('JAMB: 2026 UTME Registration Opens!'), 'jamb-2026-utme-registration-opens');
  assert.equal(truncate('one two three four five', 16), 'one two three…');
  assert.ok(truncate('one two three four five', 16).length <= 16);
});

// ---------------------------------------------------------------------------
// robots
// ---------------------------------------------------------------------------

test('parseRobots builds groups, crawl-delay and sitemap entries', () => {
  const policy = parseRobots([
    'User-agent: *',
    'Disallow: /wp-admin/',
    'Allow: /wp-admin/admin-ajax.php',
    'Crawl-delay: 2',
    '',
    'User-agent: EduReach-Newsroom',
    'Disallow: /private/',
    'Sitemap: https://example.ng/sitemap.xml',
  ].join('\n'));

  assert.equal(policy.groups.length, 2);
  assert.deepEqual(policy.sitemaps, ['https://example.ng/sitemap.xml']);
  assert.equal(isPathAllowed(policy, 'EduReach-Newsroom/1.0', '/news/story'), true);
  assert.equal(isPathAllowed(policy, 'EduReach-Newsroom/1.0', '/private/secret'), false);
  assert.equal(isPathAllowed(policy, 'EduReach-Newsroom/1.0', '/wp-admin/anything'), true, 'specific group has no rule for it');
  assert.equal(isPathAllowed(policy, 'OtherBot', '/wp-admin/admin-ajax.php'), true, 'Allow beats Disallow at equal length');
  assert.equal(isPathAllowed(policy, 'OtherBot', '/wp-admin/post.php'), false);
  assert.equal(crawlDelayMs(policy, '*'), 2000);
});

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title><![CDATA[JAMB extends 2026 UTME registration deadline by two weeks]]></title>
    <link>https://www.jamb.gov.ng/news/utme-deadline?a=1&amp;utm_source=rss</link>
    <description><![CDATA[<p>The board said candidates now have until 14 February to complete registration.</p>]]></description>
    <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
    <category>JAMB</category>
    <media:content url="https://www.jamb.gov.ng/img/deadline.jpg" />
  </item>
  <item>
    <title>Super Eagles beat Ghana in friendly</title>
    <link>https://www.jamb.gov.ng/news/sport</link>
    <pubDate>Mon, 28 Sep 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>NELFUND opens student loan application for new institutions</title>
    <link rel="alternate" href="https://nelfund.ng/news/loan-window"/>
    <summary>Applications open for students in newly accredited institutions.</summary>
    <updated>2026-09-27T10:00:00Z</updated>
  </entry>
</feed>`;

test('parseFeed reads RSS and Atom items with absolute links and images', () => {
  const items = parseFeed(RSS, 'https://www.jamb.gov.ng/feed/');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'JAMB extends 2026 UTME registration deadline by two weeks');
  assert.equal(items[0].url, 'https://www.jamb.gov.ng/news/utme-deadline?a=1&utm_source=rss');
  assert.equal(items[0].excerpt, 'The board said candidates now have until 14 February to complete registration.');
  assert.equal(items[0].imageUrl, 'https://www.jamb.gov.ng/img/deadline.jpg');
  assert.equal(items[0].categories[0], 'JAMB');
  assert.match(items[0].publishedAt!, /^2026-09-28/);

  const atom = parseFeed(ATOM, 'https://nelfund.ng/feed');
  assert.equal(atom.length, 1);
  assert.equal(atom[0].url, 'https://nelfund.ng/news/loan-window');
  assert.match(atom[0].publishedAt!, /^2026-09-27/);
});

test('parseFeed ignores malformed documents instead of throwing', () => {
  assert.deepEqual(parseFeed('', 'https://x.ng'), []);
  assert.deepEqual(parseFeed('<html><body>nope</body></html>', 'https://x.ng'), []);
});

test('parseJsonFeed reads JSON Feed items', () => {
  const items = parseJsonFeed({
    items: [{ title: 'WAEC releases 2026 WASSCE timetable', url: 'https://waecnigeria.org/timetable', summary: 'Full timetable published.', date_published: '2026-09-20T00:00:00Z' }],
  }, 'https://waecnigeria.org/feed.json');
  assert.equal(items.length, 1);
  assert.equal(items[0].imageUrl, null);
  assert.equal(items[0].title, 'WAEC releases 2026 WASSCE timetable');
});

test('discoverArticleLinks keeps plausible articles and drops navigation', () => {
  const html = `
    <a href="/tag/jamb">JAMB</a>
    <a href="/about">About</a>
    <a href="/news/2026/09/28/jamb-extends-2026-utme-registration-deadline">JAMB extends 2026 UTME registration deadline by two weeks</a>
    <a href="https://punchng.com/feed/">Feed</a>
    <a href="/news/2026/09/27/nelfund-opens-student-loan-window-for-new-institutions">NELFUND opens student loan window for new institutions</a>`;
  const links = discoverArticleLinks(html, 'https://jamb.gov.ng/', 10);
  assert.equal(links.length, 2);
  assert.ok(links.includes('https://jamb.gov.ng/news/2026/09/28/jamb-extends-2026-utme-registration-deadline'));
  assert.ok(!links.some((link) => link.includes('/tag/') || link.includes('/about')));
});

test('extractPageMeta prefers Open Graph and normalises the publication date', () => {
  const html = `<html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="JAMB extends UTME registration deadline" />
    <meta property="og:description" content="Candidates have two more weeks." />
    <meta property="og:image" content="/img/deadline.jpg" />
    <meta property="article:published_time" content="2026-09-28T08:00:00Z" />
    <meta property="og:site_name" content="JAMB" />
  </head></html>`;
  const meta = extractPageMeta(html, 'https://jamb.gov.ng/news/story');
  assert.equal(meta.title, 'JAMB extends UTME registration deadline');
  assert.equal(meta.description, 'Candidates have two more weeks.');
  assert.equal(meta.imageUrl, 'https://jamb.gov.ng/img/deadline.jpg');
  assert.match(meta.publishedAt!, /^2026-09-28/);
  assert.equal(meta.siteName, 'JAMB');
});

// ---------------------------------------------------------------------------
// classification
// ---------------------------------------------------------------------------

test('classification scores student-relevant items above general news', () => {
  const relevant = classify({
    title: 'JAMB extends 2026 UTME registration deadline by two weeks',
    excerpt: 'Candidates can now complete registration until 14 February, the board announced.',
    sourceTier: 1,
    trustScore: 0.98,
  });
  assert.equal(relevant.relevant, true);
  assert.equal(relevant.category, 'jamb');
  assert.equal(relevant.autoPublishEligible, true, 'tier 1 source may auto-publish');

  const tierTwo = classify({
    title: 'JAMB extends 2026 UTME registration deadline by two weeks',
    sourceTier: 2,
    trustScore: 0.75,
  });
  assert.equal(tierTwo.autoPublishEligible, false, 'a tier 2 source never auto-publishes');

  const offTopic = classify({ title: 'Super Eagles beat Ghana in Lagos friendly', sourceTier: 2 });
  assert.equal(offTopic.relevant, false);
  assert.ok(offTopic.score < 0.34);
});

test('routeCategory maps stories to maintained news categories', () => {
  assert.equal(routeCategory({ title: 'NELFUND opens student loan portal for new session' }), 'nelfund');
  assert.equal(routeCategory({ title: 'WAEC releases WASSCE results for 2026 candidates' }), 'waec');
  assert.equal(routeCategory({ title: 'Fully funded scholarship for Nigerian undergraduates' }), 'scholarships');
  assert.equal(routeCategory({ title: 'Something entirely unrelated' }, 'general'), 'general');
});

// ---------------------------------------------------------------------------
// quality gate
// ---------------------------------------------------------------------------

const GOOD = {
  title: 'JAMB extends 2026 UTME registration deadline by two weeks',
  excerpt: 'The board said candidates now have until 14 February to complete their registration on the JAMB portal.',
  body: 'x'.repeat(240),
  category: 'jamb',
  sourceUrl: 'https://jamb.gov.ng/news/deadline',
  sourceName: 'JAMB',
  imageUrl: 'https://jamb.gov.ng/img/deadline.jpg',
  publishedAt: new Date().toISOString(),
  sourceTier: 1,
  relevanceScore: 0.8,
};

test('quality gate passes a complete Tier 1 item and blocks incomplete ones', () => {
  const passed = runQualityGate(GOOD);
  assert.equal(passed.passed, true);
  assert.equal(passed.errors.length, 0);
  assert.equal(passed.warnings.length, 0);

  assert.equal(runQualityGate({ ...GOOD, sourceUrl: 'http://jamb.gov.ng/x' }).errors[0], 'The source URL is not HTTPS.');
  assert.equal(runQualityGate({ ...GOOD, title: 'Short title' }).passed, false);
  assert.equal(runQualityGate({ ...GOOD, sourceName: '' }).passed, false);
  assert.equal(runQualityGate({ ...GOOD, category: 'made-up' }).passed, false);
  assert.equal(runQualityGate({ ...GOOD, body: 'too short' }).passed, false);

  const stale = runQualityGate({ ...GOOD, publishedAt: '2024-01-01T00:00:00Z' });
  assert.equal(stale.passed, false);
  assert.ok(stale.errors.some((error) => error.includes('days ago')));

  const tierTwo = runQualityGate({ ...GOOD, sourceTier: 2, imageUrl: null });
  assert.equal(tierTwo.passed, true, 'warnings do not block ingestion');
  assert.ok(tierTwo.warnings.some((warning) => warning.includes('human review')));
  assert.ok(tierTwo.warnings.some((warning) => warning.includes('No image')));
});

test('category TTL drives the expiry date', () => {
  assert.equal(ttlDaysForCategory('jamb'), 120);
  assert.equal(ttlDaysForCategory('unknown-category'), 365);
  const from = new Date('2026-01-01T00:00:00Z');
  assert.equal(expiresAtFor('jamb', from), '2026-05-01T00:00:00.000Z');
});

// ---------------------------------------------------------------------------
// dedupe
// ---------------------------------------------------------------------------

const entryFor = (input: { id?: string; title: string; url: string; sourceKey?: string; sourcePublishedAt?: string | null; excerpt?: string }) =>
  buildIndexEntry({
    id: input.id ?? null,
    origin: 'article',
    title: input.title,
    canonicalUrl: canonicalUrl(input.url),
    excerpt: input.excerpt ?? null,
    sourceKey: input.sourceKey ?? 'jamb',
    sourcePublishedAt: input.sourcePublishedAt ?? null,
  });

test('duplicate detection separates exact, likely and possible matches', () => {
  const existing = entryFor({
    id: 'article-1',
    title: 'JAMB extends 2026 UTME registration deadline by two weeks',
    url: 'https://jamb.gov.ng/news/deadline',
    sourcePublishedAt: '2026-09-28T08:00:00Z',
  });

  const sameUrl = buildIndexEntry({
    title: 'JAMB extends registration deadline',
    canonicalUrl: canonicalUrl('https://jamb.gov.ng/news/deadline?utm_source=twitter'),
    sourceKey: 'punch-education',
  });
  assert.equal(findDuplicate(sameUrl, [existing])?.level, 'exact');
  assert.equal(findDuplicate(sameUrl, [existing])?.reason, 'canonical_url');

  const sameTitle = buildIndexEntry({
    title: 'JAMB EXTENDS 2026 UTME REGISTRATION DEADLINE BY TWO WEEKS',
    canonicalUrl: canonicalUrl('https://punchng.com/jamb-extends-deadline'),
    sourceKey: 'jamb',
  });
  assert.equal(findDuplicate(sameTitle, [existing])?.reason, 'same_source_title');

  const reworded = buildIndexEntry({
    title: 'UTME 2026: JAMB extends registration deadline by two weeks',
    canonicalUrl: canonicalUrl('https://www.vanguardngr.com/utme-deadline-extended'),
    sourceKey: 'vanguard-education',
    sourcePublishedAt: '2026-09-29T08:00:00Z',
  });
  const match = findDuplicate(reworded, [existing]);
  assert.ok(match, 'reworded coverage of the same story must match');
  assert.equal(match!.level, 'likely');

  const unrelated = buildIndexEntry({
    title: 'NECO releases 2026 SSCE results for all states',
    canonicalUrl: canonicalUrl('https://neco.gov.ng/news/results'),
    sourceKey: 'neco',
  });
  assert.equal(findDuplicate(unrelated, [existing]), null);
});

test('eventFingerprint only fires when entities and actions are present', () => {
  assert.ok(eventFingerprint('JAMB announces UTME registration deadline').includes('jamb'));
  assert.equal(eventFingerprint('Something happens somewhere'), '');
});

// ---------------------------------------------------------------------------
// pipeline (dry run, no network, no database)
// ---------------------------------------------------------------------------

const TEST_SOURCES: SourceDefinition[] = [
  {
    sourceKey: 'test-jamb',
    name: 'Joint Admissions and Matriculation Board (JAMB)',
    homepage: 'https://jamb.gov.ng/',
    feedUrl: 'https://jamb.gov.ng/feed/',
    tier: 1,
    categoryHint: 'jamb',
    trustScore: 0.98,
  },
  {
    sourceKey: 'test-punch',
    name: 'The Punch',
    homepage: 'https://punchng.com/',
    feedUrl: 'https://punchng.com/feed/',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.75,
    requiresAnyTitleTerm: ['jamb', 'utme', 'student', 'school', 'education'],
  },
];

function responseFor(url: string, body: string, contentType = 'text/html'): Response {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  } as unknown as Response;
}

function stubFetch(routes: Record<string, { body: string; contentType?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes[url];
    if (!route) {
      return { ok: false, status: 404, url, headers: { get: () => null }, text: async () => '' } as unknown as Response;
    }
    return responseFor(url, route.body, route.contentType);
  }) as unknown as typeof fetch;
}

/** Chainable Supabase stub: every builder is awaitable and returns { data, error }. */
function stubSupabase(rows: Record<string, any[]>): NewsroomSupabase & { inserts: Record<string, any[][]> } {
  const inserts: Record<string, any[][]> = {};
  const from = (table: string) => {
    const result = { data: rows[table] ?? [], error: null };
    const builder: any = {
      select: () => builder,
      insert: (values: any) => {
        (inserts[table] ||= []).push(Array.isArray(values) ? values : [values]);
        const inserted = Array.isArray(values)
          ? values.map((value: any, index: number) => ({ id: `${table}-${index}`, ...value }))
          : [{ id: `${table}-0`, ...values }];
        const insertResult = { data: inserted, error: null };
        const insertBuilder: any = {
          select: () => insertBuilder,
          single: async () => ({ data: inserted[0], error: null }),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(insertResult).then(resolve),
        };
        return insertBuilder;
      },
      update: () => builder,
      upsert: () => builder,
      delete: () => builder,
      eq: () => builder,
      neq: () => builder,
      is: () => builder,
      in: () => builder,
      or: () => builder,
      not: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      gt: () => builder,
      ilike: () => builder,
      contains: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      single: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  };
  return {
    from,
    rpc: async () => ({ data: null, error: null }),
    inserts,
  } as unknown as NewsroomSupabase & { inserts: Record<string, any[][]> };
}

test('pipeline publishes Tier 1, queues Tier 2 and rejects off-topic or duplicate items', async () => {
  const jambFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title>JAMB extends 2026 UTME registration deadline by two weeks</title>
      <link>https://jamb.gov.ng/news/utme-deadline</link>
      <description>The board said candidates now have until 14 February to complete registration on the JAMB portal.</description>
      <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
      <media:content url="https://jamb.gov.ng/img/deadline.jpg" />
    </item>
    <item>
      <title>JAMB extends 2026 UTME registration deadline by two weeks</title>
      <link>https://jamb.gov.ng/news/utme-deadline?utm_source=twitter</link>
      <description>The board said candidates now have until 14 February to complete registration on the JAMB portal.</description>
      <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
      <media:content url="https://jamb.gov.ng/img/deadline.jpg" />
    </item>
    <item>
      <title>Super Eagles beat Ghana in Lagos friendly</title>
      <link>https://jamb.gov.ng/news/sport</link>
      <pubDate>Mon, 28 Sep 2026 09:00:00 GMT</pubDate>
    </item>
  </channel></rss>`;

  const punchFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title>NELFUND student loan portal opens for new institutions across Nigeria</title>
      <link>https://punchng.com/nelfund-loan-portal-opens</link>
      <description>The Nigerian Education Loan Fund said students in newly accredited institutions can now apply for the loan.</description>
      <pubDate>Mon, 29 Sep 2026 07:00:00 GMT</pubDate>
      <media:content url="https://punchng.com/img/loan.jpg" />
    </item>
    <item>
      <title>Five ways to style your aso-oke for owambe season</title>
      <link>https://punchng.com/style-aso-oke</link>
      <description>Fashion tips for the weekend.</description>
      <pubDate>Mon, 29 Sep 2026 07:30:00 GMT</pubDate>
    </item>
  </channel></rss>`;

  const report = await runIngestion(stubSupabase({}), {
    dryRun: true,
    sources: TEST_SOURCES,
    fetchImpl: stubFetch({
      'https://jamb.gov.ng/feed/': { body: jambFeed, contentType: 'application/rss+xml' },
      'https://punchng.com/feed/': { body: punchFeed, contentType: 'application/rss+xml' },
    }),
    now: () => new Date('2026-09-30T06:00:00Z'),
  });

  assert.equal(report.dryRun, true);
  assert.equal(report.candidatesFound, 5);
  assert.equal(report.sourcesChecked, 2);
  assert.equal(report.sourcesFailed, 0);

  const published = report.decisions.filter((decision) => decision.status === 'published');
  assert.equal(published.length, 1, 'only the Tier 1 official item auto-publishes');
  assert.equal(published[0].title, 'JAMB extends 2026 UTME registration deadline by two weeks');

  const review = report.decisions.filter((decision) => decision.status === 'needs_review');
  assert.equal(review.length, 1, 'the Tier 2 loan story waits for a human');
  assert.equal(review[0].sourceKey, 'test-punch');

  const duplicates = report.decisions.filter((decision) => decision.status === 'duplicate');
  assert.equal(duplicates.length, 1, 'the tracking-parameter clone of the same URL is suppressed');

  const rejected = report.decisions.filter((decision) => decision.status === 'rejected');
  assert.equal(rejected.length, 2, 'off-topic sport and fashion items are rejected');
  assert.ok(rejected.every((decision) => decision.reason.startsWith('low_relevance') || decision.reason.startsWith('title_filter')));
});

test('pipeline suppresses a story that is already published', async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title>JAMB extends 2026 UTME registration deadline by two weeks</title>
      <link>https://jamb.gov.ng/news/utme-deadline</link>
      <description>The board said candidates now have until 14 February to complete registration on the JAMB portal.</description>
      <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
      <media:content url="https://jamb.gov.ng/img/deadline.jpg" />
    </item>
  </channel></rss>`;

  const supabase = stubSupabase({
    news_articles: [{
      id: 'existing-1',
      slug: 'jamb-extends-2026-utme-registration-deadline-by-two-weeks',
      title: 'JAMB extends 2026 UTME registration deadline by two weeks',
      excerpt: 'Candidates have two more weeks.',
      source_key: 'test-jamb',
      source_url: 'https://jamb.gov.ng/news/utme-deadline',
      dedupe_key: 'u:abc',
      content_hash: null,
      source_published_at: '2026-09-28T08:00:00Z',
      created_at: '2026-09-28T09:00:00Z',
      published: true,
    }],
  });

  const report = await runIngestion(supabase, {
    dryRun: true,
    sources: [TEST_SOURCES[0]],
    fetchImpl: stubFetch({ 'https://jamb.gov.ng/feed/': { body: feed, contentType: 'application/rss+xml' } }),
    now: () => new Date('2026-09-30T06:00:00Z'),
  });

  assert.equal(report.published, 0);
  assert.equal(report.duplicates, 1);
  assert.equal(report.decisions[0].status, 'duplicate');
  assert.equal(report.decisions[0].reason, 'canonical_url');
});

test('pipeline records a source failure without aborting the run', async () => {
  const report = await runIngestion(stubSupabase({}), {
    dryRun: true,
    sources: TEST_SOURCES,
    fetchImpl: stubFetch({ 'https://punchng.com/feed/': { body: '<rss></rss>', contentType: 'application/rss+xml' } }),
    now: () => new Date('2026-09-30T06:00:00Z'),
  });

  assert.equal(report.sourcesFailed, 1);
  assert.equal(report.sourcesChecked, 2);
  assert.equal(report.sourcesChecked - report.sourcesFailed, 1);
  assert.ok(report.errors.some((error) => error.includes('test-jamb')));
  assert.equal(report.decisions.length, 0);
});

test('pipeline honours robots.txt before fetching a source', async () => {
  const fetchImpl = stubFetch({
    'https://jamb.gov.ng/robots.txt': { body: 'User-agent: *\nDisallow: /feed/', contentType: 'text/plain' },
    'https://jamb.gov.ng/feed/': { body: '<rss></rss>', contentType: 'application/rss+xml' },
  });

  const report = await runIngestion(stubSupabase({}), {
    dryRun: true,
    sources: [TEST_SOURCES[0]],
    fetchImpl,
    now: () => new Date('2026-09-30T06:00:00Z'),
  });

  assert.equal(report.sourcesFailed, 1, 'a disallowed feed is a source failure, not a violation');
  assert.ok(report.perSource[0].error?.includes('robots'));
});
