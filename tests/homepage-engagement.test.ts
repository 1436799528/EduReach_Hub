import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';
import {
  parseAdminReviewDraft,
  parseFaqCategoryDraft,
  parseFaqItemDraft,
  parseReorderDraft,
  faqSlug,
} from '../lib/engagementPolicy';
import { mergeSiteSettings } from '../src/lib/siteContentModel';

// Homepage engagement: editorial reviews, a database-backed FAQ and the
// social/contact configuration. These tests cover the three things a page
// cannot prove by rendering: who can read the tables, what the validation
// refuses, and whether the homepage sections learn their content from the API.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8').replace(/\r\n?/g, '\n');

let db: PGlite;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
});

after(async () => {
  await db.close();
});

async function asRole<T>(role: 'anon' | 'authenticated', run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await db.exec('reset role');
  }
}

test('the FAQ seed carries the eight requested categories and accurate questions', async () => {
  const categories = await db.query<{ slug: string; label: string; n: number }>(
    `select c.slug, c.label, count(i.id)::int as n
       from public.faq_categories c
       left join public.faq_items i on i.category_id = c.id
      group by c.slug, c.label, c.display_order
      order by c.display_order`,
  );
  assert.deepEqual(
    categories.rows.map((row) => row.slug),
    ['general', 'account', 'cbt', 'exams', 'past-questions', 'scholarships', 'payments', 'support'],
  );
  for (const row of categories.rows) assert.ok(row.n > 0, `${row.label} has questions`);
  const total = categories.rows.reduce((sum, row) => sum + row.n, 0);
  assert.equal(total, 37, 'the shipped help content is seeded once, not duplicated');
});

test('the review seed creates visible samples but never inflates the rating', async () => {
  const placeholders = await db.query<{ n: number }>(
    'select count(*)::int as n from public.reviews where is_placeholder = true',
  );
  assert.equal(placeholders.rows[0].n, 3, 'three editable samples keep the homepage honest and non-empty');

  const summary = await db.query<{ review_count: number; average_rating: string | null }>(
    'select * from public.review_rating_summary()',
  );
  assert.equal(summary.rows[0].review_count, 0, 'samples are not published reviews');
  assert.equal(summary.rows[0].average_rating, null, 'there is no invented average');

  const fields = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'reviews'
        and column_name in ('display_name','profile_image','student_description','is_featured','is_placeholder','display_order')`,
  );
  assert.equal(fields.rows.length, 6, 'the editorial review fields exist');
});

test('FAQ and review tables stay closed to browser roles', async () => {
  for (const role of ['anon', 'authenticated'] as const) {
    await asRole(role, async () => {
      await assert.rejects(
        () => db.query('select count(*) from public.faq_categories'),
        /permission denied/i,
        `${role} cannot read FAQ categories`,
      );
      await assert.rejects(
        () => db.query('select count(*) from public.faq_items'),
        /permission denied/i,
        `${role} cannot read FAQ questions`,
      );
      await assert.rejects(
        () => db.query('select count(*) from public.reviews'),
        /permission denied/i,
        `${role} cannot read reviews`,
      );
    });
  }
});

test('the seeded social settings have icons but no invented profile URL', async () => {
  const row = await db.query<{ value: { links: Array<{ platform: string; url: string }> } }>(
    "select value from public.site_settings where key = 'social'",
  );
  assert.equal(row.rows[0].value.links.length, 8);
  for (const link of row.rows[0].value.links) assert.equal(link.url, '', `${link.platform} waits for a real URL`);
});

test('an administrative review draft refuses what the public card cannot render', () => {
  const good = {
    displayName: 'Amina Bello',
    reviewText: 'The timed papers helped me finish before the real JAMB exam.',
    rating: 5,
    status: 'approved',
    displayOrder: 1,
  };
  assert.equal(parseAdminReviewDraft(good).ok, true);
  assert.equal(parseAdminReviewDraft({ ...good, displayName: '' }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, rating: 6 }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, rating: 4.5 }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, reviewText: 'Too short' }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, profileImage: 'http://example.com/a.png' }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, profileImage: 'https://example.com/a.png' }).ok, true);
  assert.equal(parseAdminReviewDraft({ ...good, displayOrder: -1 }).ok, false);
  assert.equal(parseAdminReviewDraft({ ...good, status: 'featured' }).ok, false);
});

test('FAQ drafts require a real question, a real answer and a category', () => {
  const category = parseFaqCategoryDraft({ label: 'Payments and subscriptions', description: '', displayOrder: 2 });
  assert.equal(category.ok, true);
  assert.equal(parseFaqCategoryDraft({ label: 'x' }).ok, false);

  const item = {
    categoryId: '11111111-1111-4111-8111-111111111111',
    question: 'How do I pay for a service request?',
    answer: 'Open the service page, submit the request and follow the payment instructions shown there.',
    displayOrder: 1,
  };
  assert.equal(parseFaqItemDraft(item).ok, true);
  assert.equal(parseFaqItemDraft({ ...item, categoryId: 'payments' }).ok, false);
  assert.equal(parseFaqItemDraft({ ...item, question: 'Why?' }).ok, false);
  assert.equal(parseFaqItemDraft({ ...item, answer: 'Pay.' }).ok, false);
  assert.equal(parseReorderDraft({ itemIds: [item.categoryId] }, 'itemIds').ok, true);
  assert.equal(parseReorderDraft({ itemIds: ['nope'] }, 'itemIds').ok, false);
  assert.equal(faqSlug('Payments and subscriptions'), 'payments-and-subscriptions');
});

test('the API gates every write and reads published FAQ rows only', () => {
  const server = read('server.ts');
  const publicFaq = server.slice(server.indexOf("app.get('/api/faqs'"), server.indexOf("app.get('/api/admin/faqs'"));
  assert.match(publicFaq, /eq\('is_published', true\)/, 'public reads filter to published rows');
  assert.doesNotMatch(publicFaq, /requireCapability/, 'the public FAQ read needs no account');

  const adminFaq = server.slice(server.indexOf("app.get('/api/admin/faqs'"), server.indexOf('// Question-bank overview'));
  for (const route of [
    '/api/admin/faqs/categories',
    '/api/admin/faqs/items',
    '/api/admin/faqs/reorder',
  ]) {
    assert.ok(adminFaq.includes(route), `${route} exists`);
  }
  assert.match(adminFaq, /requireCapability\('site\.read'\)/, 'the console needs site.read');
  assert.match(adminFaq, /requireCapability\('site\.update'\)/, 'writes need site.update');
  assert.match(adminFaq, /recordAudit\(/, 'every FAQ write is audited');

  const adminReviews = server.slice(server.indexOf("app.get('/api/admin/reviews'"), server.indexOf('// FAQ: admin-managed'));
  assert.match(adminReviews, /requireCapability\('review\.moderate'\)/, 'review management uses its own capability');
  assert.match(adminReviews, /app\.delete\('\/api\/admin\/reviews\/:reviewId'/, 'a permanent delete exists');
  assert.match(adminReviews, /rating: parsed\.value\.rating/, 'a created review stores its rating');
  assert.match(adminReviews, /status: parsed\.value\.status/, 'a created review stores its publication state');
  assert.match(adminReviews, /recordAudit\(/, 'every review write is audited');
});

test('the homepage reads reviews and FAQs from the API, in the requested order', () => {
  const home = read('pages/HubHomePage.tsx');
  const news = home.indexOf('<HomeNewsSection />');
  const reviews = home.indexOf('<HomeReviewsSection />');
  const faq = home.indexOf('<HomeFaqSection />');
  assert.ok(news > -1 && reviews > news && faq > reviews, 'news, then reviews, then FAQ');

  const reviewsSection = read('src/components/HomeReviewsSection.tsx');
  assert.match(reviewsSection, /fetchReviews\(/, 'reviews are not hard-coded');
  assert.match(reviewsSection, /er-review-marquee/, 'the marquee exists');
  assert.match(reviewsSection, /touch-action|onTouchStart/, 'touch pauses without owning the page scroll');
  assert.ok(
    reviewsSection.includes("aria-label={userPaused ? 'Play student reviews' : 'Pause student reviews'}"),
    'the pause control is labelled and operable by keyboard',
  );
  assert.match(reviewsSection, /isPlaceholder/, 'a sample is labelled');

  const faqSection = read('src/components/HomeFaqSection.tsx');
  assert.match(faqSection, /fetchFaqs\(/, 'FAQs are not hard-coded');
  assert.match(faqSection, /aria-expanded=\{open\}/, 'the accordion exposes its state');
  assert.match(faqSection, /aria-controls=/, 'the answer is associated with its trigger');

  const routes = read('src/app/routes.tsx');
  assert.doesNotMatch(routes, /path === '\/home-faq'|path === '\/homepage-reviews'/, 'no parallel homepage routes');
});

test('a social entry can be enabled with no URL, and that icon is not a link', () => {
  const settings = mergeSiteSettings({
    social: {
      links: [
        { platform: 'facebook', label: 'Facebook', url: '', visible: true },
        { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/edureach', visible: true },
        { platform: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/@edureach', visible: false },
      ],
    },
  });
  assert.equal(settings.social.links.length, 3);
  assert.equal(settings.social.links[0].url, '', 'an unconfigured platform stays unlinked');
  assert.equal(settings.social.links[1].url, 'https://instagram.com/edureach');
  assert.equal(settings.social.links[2].visible, false, 'a disabled platform is not rendered');

  const footer = read('src/components/SiteFooter.tsx');
  assert.match(footer, /link\.url \? \(/, 'the footer branches between a link and an icon');
  assert.match(footer, /not configured yet/, 'the unlinked icon explains itself');
  assert.match(footer, /rel="noopener noreferrer"/, 'a configured profile opens safely');
});

test('the new migration is in the generated checklist and the artifact', () => {
  const files = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'));
  assert.ok(files.includes('20261123120000_homepage_engagement.sql'));
  const sql = read('supabase/ci/production-validation.sql');
  assert.ok(sql.includes('20261123120000_homepage_engagement.sql'), 'the release check names the migration');
});
