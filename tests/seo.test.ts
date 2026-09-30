import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';

import {
  absoluteUrl,
  applySeo,
  canonicalPathFor,
  isArticleFresh,
  isIndexablePath,
  seoForArticle,
  seoForInstitution,
  seoForPath,
} from '../src/lib/seoMeta';
import {
  DISALLOWED_PATHS,
  buildRobotsTxt,
  buildSitemapXml,
  collectSitemapEntries,
  escapeXml,
  resolveSiteOrigin,
  schoolSlug,
  staticSitemapEntries,
} from '../src/server/seo';

// ---------------------------------------------------------------------------
// canonicals and indexability
// ---------------------------------------------------------------------------

test('canonicalPathFor collapses aliases and dynamic prefixes to one URL', () => {
  assert.equal(canonicalPathFor('/signin'), '/login');
  assert.equal(canonicalPathFor('/signup'), '/register');
  assert.equal(canonicalPathFor('/calculator'), '/screening-calculator');
  assert.equal(canonicalPathFor('/cgpa-calculator'), '/tools/cgpa-calculator');
  assert.equal(canonicalPathFor('/scholarships'), '/jobs');
  assert.equal(canonicalPathFor('/track'), '/services/track');
  assert.equal(canonicalPathFor('/dashboard/applications'), '/dashboard/services');
  assert.equal(canonicalPathFor('/services/apply/results'), '/services/results');
  assert.equal(canonicalPathFor('/news/jamb-extends-deadline/'), '/news/jamb-extends-deadline');
  assert.equal(canonicalPathFor('/'), '/');
});

test('indexability matrix separates public content from private and placeholder routes', () => {
  for (const path of ['/', '/news', '/news/some-story', '/jobs', '/schools', '/schools/unilag', '/services', '/services/nelfund-loan', '/cbt', '/past-questions', '/jamb', '/events', '/screening-calculator', '/tools/cgpa-calculator']) {
    assert.equal(isIndexablePath(path), true, `${path} should be indexable`);
  }
  for (const path of ['/admin', '/admin/news', '/dashboard', '/dashboard/cbt', '/profile', '/profile/complete', '/settings', '/search', '/login', '/signin', '/register', '/forgot-password', '/reset-password', '/verify-email', '/cbt/practice', '/cbt/results', '/cbt/results/abc', '/cbt/setup/jamb', '/services/track', '/track', '/nabteb', '/admission', '/admission/unilag', '/tools', '/support']) {
    assert.equal(isIndexablePath(path), false, `${path} should not be indexable`);
  }
  // A service without a live workflow renders the coming-soon panel.
  assert.equal(isIndexablePath('/services/some-other-service'), false);
});

test('every indexable static route has a unique title and a real description', () => {
  const paths = ['/', '/news', '/events', '/jobs', '/schools', '/services', '/cbt', '/past-questions', '/screening-calculator', '/tools/cgpa-calculator', '/jamb', '/waec', '/neco', '/post-utme'];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of paths) {
    const meta = seoForPath(path);
    assert.ok(meta.title.length > 10, `${path} needs a real title`);
    assert.ok(meta.description.length >= 60, `${path} needs a usable meta description`);
    assert.ok(!titles.has(meta.title), `duplicate title for ${path}: ${meta.title}`);
    titles.add(meta.title);
    descriptions.add(meta.description);
  }
  // Private routes get no canonical URL at all.
  const admin = seoForPath('/admin/news');
  assert.equal(admin.indexable, false);
  assert.equal(admin.canonicalPath, null);
  // Aliases canonicalise to their target.
  assert.equal(seoForPath('/calculator').canonicalPath, '/screening-calculator');
  assert.equal(seoForPath('/signin').indexable, false);
});

// ---------------------------------------------------------------------------
// article and institution metadata
// ---------------------------------------------------------------------------

test('article metadata carries provenance and drops out of the index when expired', () => {
  const meta = seoForArticle({
    slug: 'jamb-extends-2026-utme-registration-deadline',
    title: 'JAMB extends 2026 UTME registration deadline by two weeks',
    excerpt: 'Candidates now have until 14 February to complete registration on the JAMB portal, the board said.',
    image_url: 'https://jamb.gov.ng/img/deadline.jpg',
    category: 'jamb',
    source_name: 'Joint Admissions and Matriculation Board (JAMB)',
    published_at: '2026-09-28T08:00:00.000Z',
    updated_at: '2026-09-29T08:00:00.000Z',
    expires_at: '2027-01-26T08:00:00.000Z',
    verification_status: 'verified',
  });

  assert.equal(meta.canonicalPath, '/news/jamb-extends-2026-utme-registration-deadline');
  assert.equal(meta.indexable, true);
  assert.equal(meta.type, 'article');
  assert.ok(meta.title.length <= 70);
  const structured = meta.structuredData as Record<string, unknown>;
  assert.equal(structured['@type'], 'NewsArticle');
  assert.equal(structured.headline, 'JAMB extends 2026 UTME registration deadline by two weeks');
  assert.equal(structured.datePublished, '2026-09-28T08:00:00.000Z');
  assert.equal(structured.articleSection, 'jamb');
  assert.deepEqual(structured.image, ['https://jamb.gov.ng/img/deadline.jpg']);
  assert.ok(JSON.stringify(structured).includes('https://schema.org'));

  // An insecure image is dropped rather than advertised.
  assert.equal(seoForArticle({ slug: 'x', title: 'Some headline', image_url: 'http://example.com/a.jpg' }).image, null);

  // Expired content: readable, not indexable, no structured data.
  const expired = seoForArticle({
    slug: 'old-story',
    title: 'Old registration window',
    excerpt: 'This window has closed.',
    expires_at: '2026-01-01T00:00:00.000Z',
    verification_status: 'verified',
  });
  assert.equal(expired.indexable, false);
  assert.equal(expired.canonicalPath, null);
  assert.equal(expired.structuredData, null);

  assert.equal(isArticleFresh({ expires_at: '2026-01-01T00:00:00.000Z' }), false);
  assert.equal(isArticleFresh({ verification_status: 'superseded' }), false);
  assert.equal(isArticleFresh({ expires_at: '2099-01-01T00:00:00.000Z' }), true);
  assert.equal(isArticleFresh({}), true);
});

test('institution metadata uses only sourced facts', () => {
  const meta = seoForInstitution({
    slug: 'university-of-lagos',
    school_name: 'University of Lagos',
    acronym: 'UNILAG',
    state: 'Lagos',
    institution_type: 'University',
    website_url: 'https://unilag.edu.ng',
  });
  assert.equal(meta.canonicalPath, '/schools/university-of-lagos');
  assert.equal(meta.indexable, true);
  assert.match(meta.title, /University of Lagos \(UNILAG\)/);
  assert.match(meta.description, /Lagos/);
  assert.match(meta.description, /not affiliated/i, 'independence must be stated');

  const structured = meta.structuredData as Record<string, unknown>;
  assert.equal(structured['@type'], 'CollegeOrUniversity');
  assert.equal(structured.name, 'University of Lagos');
  assert.deepEqual(structured.address, { '@type': 'PostalAddress', addressRegion: 'Lagos', addressCountry: 'NG' });

  // A polytechnic is not labelled a university, and missing facts are omitted.
  const poly = seoForInstitution({ slug: 'yabatech', school_name: 'Yaba College of Technology', institution_type: 'Polytechnic' });
  const polyData = poly.structuredData as Record<string, unknown>;
  assert.equal(polyData.address, undefined);
  assert.ok(!JSON.stringify(polyData).includes('Nigeria, Nigeria'));
});

// ---------------------------------------------------------------------------
// DOM application
// ---------------------------------------------------------------------------

function withDom<T>(run: () => T): T {
  const dom = new JSDOM('<!doctype html><html><head><title>initial</title></head><body></body></html>');
  const previousDocument = (globalThis as { document?: Document }).document;
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { document?: Document }).document = dom.window.document;
  (globalThis as { window?: unknown }).window = dom.window;
  try {
    return run();
  } finally {
    (globalThis as { document?: Document }).document = previousDocument;
    (globalThis as { window?: unknown }).window = previousWindow;
  }
}

test('applySeo writes canonical, social and robot tags and replaces JSON-LD', () => {
  withDom(() => {
    applySeo(seoForPath('/news'), 'https://edureach.example');

    assert.equal(document.title, 'Education News & Verified Student Updates | EduReach Hub');
    assert.equal(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://edureach.example/news');
    assert.equal(document.head.querySelector('meta[name="description"]')?.getAttribute('content')?.length! >= 60, true);
    assert.equal(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index,follow');
    assert.equal(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'), 'https://edureach.example/news');
    assert.equal(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content'), document.title);
    assert.equal(document.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), 'summary');
    assert.equal(document.head.querySelectorAll('script[data-edureach-seo="jsonld"]').length, 0);

    // A private route loses its canonical URL and is marked noindex.
    applySeo(seoForPath('/admin/news'), 'https://edureach.example');
    assert.equal(document.head.querySelector('link[rel="canonical"]'), null);
    assert.equal(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex,nofollow');

    // An article swaps in its own canonical and exactly one JSON-LD block.
    applySeo(seoForArticle({
      slug: 'waec-releases-2026-wassce-timetable',
      title: 'WAEC releases 2026 WASSCE timetable',
      excerpt: 'The council published the full timetable for the 2026 examination.',
      published_at: '2026-09-20T00:00:00.000Z',
      source_name: 'West African Examinations Council (WAEC Nigeria)',
    }), 'https://edureach.example');
    assert.equal(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://edureach.example/news/waec-releases-2026-wassce-timetable');
    const scripts = document.head.querySelectorAll('script[data-edureach-seo="jsonld"]');
    assert.equal(scripts.length, 1);
    const payload = JSON.parse(scripts[0].textContent || '{}');
    assert.equal(payload['@type'], 'NewsArticle');
    assert.equal(document.head.querySelector('meta[property="article:published_time"]')?.getAttribute('content'), '2026-09-20T00:00:00.000Z');

    // Navigating to a route without structured data removes the stale block.
    applySeo(seoForPath('/jobs'), 'https://edureach.example');
    assert.equal(document.head.querySelectorAll('script[data-edureach-seo="jsonld"]').length, 0);
    assert.equal(document.head.querySelector('meta[property="article:published_time"]'), null);
  });
});

test('absoluteUrl joins paths without doubling slashes', () => {
  assert.equal(absoluteUrl('/news', 'https://edureach.example'), 'https://edureach.example/news');
  assert.equal(absoluteUrl('/news', 'https://edureach.example/'), 'https://edureach.example/news');
  assert.equal(absoluteUrl('https://cdn.example/a.jpg', 'https://edureach.example'), 'https://cdn.example/a.jpg');
  assert.equal(absoluteUrl(null, 'https://edureach.example'), '');
});

// ---------------------------------------------------------------------------
// robots.txt and sitemap.xml
// ---------------------------------------------------------------------------

test('robots.txt allows public content and disallows private surfaces', () => {
  const robots = buildRobotsTxt('https://edureach.example');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  for (const path of DISALLOWED_PATHS) {
    assert.ok(robots.includes(`Disallow: ${path}`), `robots.txt must disallow ${path}`);
  }
  assert.match(robots, /Sitemap: https:\/\/edureach\.example\/sitemap\.xml/);
  assert.ok(!robots.includes('Disallow: /news'));
  assert.ok(!robots.includes('Disallow: /schools'));
});

test('sitemap XML is well-formed, escaped, deduplicated and sorted', () => {
  const xml = buildSitemapXml([
    { loc: 'https://edureach.example/news?x=1&y=2', lastmod: '2026-09-29T00:00:00.000Z', priority: 0.7 },
    { loc: 'https://edureach.example/jobs' },
    { loc: 'https://edureach.example/jobs' },
  ]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(xml.includes('https://edureach.example/news?x=1&amp;y=2'), 'query separators must be escaped');
  assert.equal((xml.match(/<loc>/g) || []).length, 2, 'duplicates are removed');
  assert.ok(xml.indexOf('/jobs') < xml.indexOf('/news?'), 'entries are sorted');
  assert.ok(xml.endsWith('</urlset>\n'));
  assert.equal(escapeXml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
});

test('static sitemap entries cover public routes and live services only', () => {
  const entries = staticSitemapEntries('https://edureach.example');
  const locs = entries.map((entry) => entry.loc);
  for (const expected of ['/', '/news', '/jobs', '/schools', '/services', '/cbt', '/events', '/jamb', '/screening-calculator', '/tools/cgpa-calculator']) {
    assert.ok(locs.includes(`https://edureach.example${expected}`), `${expected} missing from the sitemap`);
  }
  for (const slug of ['nelfund-loan', 'results', 'jamb-slip', 'admission-letters']) {
    assert.ok(locs.includes(`https://edureach.example/services/${slug}`), `live service ${slug} missing`);
  }
  // Placeholder routes are excluded (checked as exact paths, because
  // /services/admission-letters legitimately contains "admission").
  const base = 'https://edureach.example';
  for (const placeholder of ['/nabteb', '/support', '/tools', '/admission']) {
    assert.ok(!locs.includes(`${base}${placeholder}`), `${placeholder} must not be in the sitemap`);
  }
  assert.ok(!locs.some((loc) => loc.startsWith(`${base}/admission/`)));
  assert.ok(!locs.some((loc) => loc.includes('/admin') || loc.includes('/dashboard') || loc.includes('/search')));
  assert.ok(locs.includes(`${base}/services/admission-letters`), 'live services stay in the sitemap');
});

const stubClient = (tables: Record<string, { data: unknown; error: unknown }>) => ({
  from: (table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  },
});

test('collectSitemapEntries merges database content and never breaks on failure', async () => {
  const entries = await collectSitemapEntries(stubClient({
    news_articles: {
      data: [
        { slug: 'jamb-extends-registration', updated_at: '2026-09-29T10:00:00.000Z', published_at: '2026-09-28T00:00:00.000Z', expires_at: '2027-01-01T00:00:00.000Z', verification_status: 'verified' },
        { slug: 'closed-window', updated_at: '2026-02-01T00:00:00.000Z', published_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-03-01T00:00:00.000Z', verification_status: 'verified' },
      ],
      error: null,
    },
    institutions: {
      data: [{ school_name: 'University of Lagos', acronym: 'UNILAG', state: 'Lagos' }],
      error: null,
    },
  }) as any, 'https://edureach.example');

  const locs = entries.map((entry) => entry.loc);
  assert.ok(locs.includes('https://edureach.example/news/jamb-extends-registration'));
  assert.ok(!locs.includes('https://edureach.example/news/closed-window'), 'expired articles stay out of the sitemap');
  assert.ok(locs.includes('https://edureach.example/schools/university-of-lagos'));
  const article = entries.find((entry) => entry.loc.endsWith('jamb-extends-registration'));
  assert.equal(article?.lastmod, '2026-09-29T10:00:00.000Z');

  // A failing database still produces a usable sitemap.
  const failures: string[] = [];
  const fallback = await collectSitemapEntries({
    from: () => { throw new Error('database unavailable'); },
  } as any, 'https://edureach.example', (source) => failures.push(source));
  assert.ok(fallback.length >= 14);
  assert.deepEqual(failures.sort(), ['institutions', 'news_articles']);

  // No client at all (unconfigured environment) → static entries only.
  const unconfigured = await collectSitemapEntries(null, 'https://edureach.example');
  assert.equal(unconfigured.length, staticSitemapEntries('https://edureach.example').length);
});

test('schoolSlug matches the school finder itemKey rule', () => {
  // Pinned against src/components/dashboard/SchoolFinderCard.tsx itemKey().
  const itemKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  for (const name of ['University of Lagos', 'Yaba College of Technology', 'Federal University of Technology, Akure', 'Lagos State University (LASU)', '  Obafemi Awolowo University  ']) {
    assert.equal(schoolSlug(name), itemKey(name), `slug mismatch for ${name}`);
  }
  assert.equal(schoolSlug('  !!!  '), '');
});

test('site origin prefers configuration and otherwise uses the request host', () => {
  const previous = process.env.EDUREACH_SITE_URL;
  process.env.EDUREACH_SITE_URL = 'https://edureach.example/';
  assert.equal(resolveSiteOrigin({ headers: { host: 'ignored.example' } }), 'https://edureach.example');
  delete process.env.EDUREACH_SITE_URL;

  assert.equal(resolveSiteOrigin({ headers: { host: 'edureach.test' } }), 'https://edureach.test');
  assert.equal(
    resolveSiteOrigin({ headers: { 'x-forwarded-host': 'preview.example', 'x-forwarded-proto': 'http' } }),
    'http://preview.example',
  );
  assert.equal(resolveSiteOrigin({ headers: {} }), 'http://localhost:3000');
  if (previous !== undefined) process.env.EDUREACH_SITE_URL = previous;
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

test('crawler endpoints are served with the right content types and headers', async () => {
  Object.assign(process.env, {
    NETLIFY: 'true', NODE_ENV: 'production', VITE_SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', EDUREACH_ADMIN_BOOTSTRAP_EMAIL: '',
  });
  const { app } = await import('../server');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const base = `http://127.0.0.1:${address.port}`;
  after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type') || '', /text\/plain/);
  assert.match(robots.headers.get('cache-control') || '', /max-age=86400/);
  const robotsBody = await robots.text();
  assert.match(robotsBody, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  assert.match(robotsBody, /Disallow: \/admin/);

  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type') || '', /application\/xml/);
  const sitemapBody = await sitemap.text();
  assert.match(sitemapBody, /<urlset/);
  assert.ok(sitemapBody.includes(`${base}/news`), 'the sitemap must use the request origin when unconfigured');
  assert.ok(!sitemapBody.includes('/admin'));

  // Private, auth, tracker and placeholder SPA routes carry the server-side
  // crawler directive even though the noindex is also applied client-side.
  for (const path of ['/admin/news', '/dashboard', '/search', '/login', '/settings', '/profile/complete', '/services/track', '/cbt/results', '/nabteb', '/tools', '/support', '/admission', '/admission/unilag', '/services/not-a-live-service']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${path} must be noindex`);
  }
  // Indexable routes are untouched — including the live calculator under the
  // placeholder /tools branch and services that do have a live workflow.
  for (const path of ['/', '/news', '/schools', '/tools/cgpa-calculator', '/screening-calculator', '/services', '/services/results']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.headers.get('x-robots-tag'), null, `${path} must stay indexable`);
  }
});
