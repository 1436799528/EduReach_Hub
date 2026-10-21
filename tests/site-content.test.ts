import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';
import {
  DEFAULT_SITE_CONTENT,
  isSafeHttpsUrl,
  mergeSiteContent,
  mergeSiteSettings,
  whatsappHref,
} from '../src/lib/siteContentModel';
import { containsUnsafeMarkup, validatePageInput, validateSettings } from '../src/server/siteContent';

// Phase 7-9: the footer, contact details and policy pages are admin-managed.
// Three things have to hold, and each is checked here rather than assumed:
//
//   1. An anonymous visitor can read a published policy and nothing else.
//   2. No client role can write any of it - not even a signed-in student.
//   3. Bad input (a javascript: social URL, an unsafe body) is refused at the
//      boundary, and a failed API leaves the footer rendered.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

let db: PGlite;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
});

after(async () => { await db.close(); });

async function asRole<T>(role: 'anon' | 'authenticated', userId: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    return await run();
  } finally {
    await db.exec('reset role');
  }
}

// ---------------------------------------------------------------------------
// Database: visibility and write protection
// ---------------------------------------------------------------------------

test('the seeded policy pages exist, are published and are marked pending review', async () => {
  const { rows } = await db.query<{ slug: string; status: string; review_state: string; body: string }>(
    'select slug, status, review_state, body from public.site_pages order by slug',
  );
  const slugs = rows.map((row) => row.slug).sort();
  assert.deepEqual(slugs, ['accessibility', 'contact', 'cookies', 'disclaimer', 'privacy', 'terms']);
  for (const row of rows) {
    assert.equal(row.status, 'published', `${row.slug} must be readable without a login`);
    assert.equal(row.review_state, 'pending', `${row.slug} must not claim a legal review nobody gave`);
    assert.ok(row.body.length > 500, `${row.slug} must actually explain something`);
  }

  const revisions = await db.query<{ n: number }>('select count(*)::int as n from public.site_page_revisions');
  assert.equal(revisions.rows[0].n, 6, 'every page starts with a first revision');
});

test('anonymous visitors read published pages and settings, never drafts', async () => {
  await asRole('anon', null, async () => {
    const pages = await db.query<{ n: number }>(
      "select count(*)::int as n from public.site_pages where status = 'published'",
    );
    assert.equal(pages.rows[0].n, 6, 'the six policy pages are readable to anon');

    const settings = await db.query<{ n: number }>('select count(*)::int as n from public.site_settings');
    assert.equal(settings.rows[0].n, 4, 'the footer can read brand, footer, contact and social');

    await assert.rejects(
      () => db.query('select count(*)::int as n from public.site_page_revisions'),
      /permission denied/i,
      'revision history is not readable by a visitor at all',
    );
  });
});

test('a draft page disappears from anonymous reads the moment it is unpublished', async () => {
  await db.exec("update public.site_pages set status = 'draft' where slug = 'disclaimer'");
  await asRole('anon', null, async () => {
    const pages = await db.query<{ slug: string }>('select slug from public.site_pages order by slug');
    assert.deepEqual(pages.rows.map((row) => row.slug), ['accessibility', 'contact', 'cookies', 'privacy', 'terms']);
  });
  await db.exec("update public.site_pages set status = 'published' where slug = 'disclaimer'");
});

test('no client role can write site content', async () => {
  for (const role of ['anon', 'authenticated'] as const) {
    await asRole(role, role === 'authenticated' ? '00000000-0000-4000-8000-000000000001' : null, async () => {
      await assert.rejects(
        () => db.exec("update public.site_settings set value = '{\"name\":\"Defaced\"}'::jsonb where key = 'brand'"),
        /permission denied|row-level security/i,
        `${role} must not update settings`,
      );
      await assert.rejects(
        () => db.exec("update public.site_pages set title = 'Defaced' where slug = 'privacy'"),
        /permission denied|row-level security/i,
        `${role} must not update pages`,
      );
      await assert.rejects(
        () => db.exec("insert into public.site_page_revisions (slug, revision, title, body, status, review_state) values ('privacy', 99, 'x', 'y', 'published', 'approved')"),
        /permission denied|row-level security/i,
        `${role} must not write revisions`,
      );
    });
  }
});

test('the database refuses a page whose slug could never be a real route', async () => {
  await assert.rejects(
    () => db.exec("insert into public.site_pages (slug, title, body) values ('Not A Slug', 'x', 'y')"),
    /site_pages_slug_shape/,
  );
});

test('the database refuses an unknown settings group', async () => {
  await assert.rejects(
    () => db.exec("insert into public.site_settings (key, value) values ('secrets', '{}'::jsonb)"),
    /site_settings_key_known/,
  );
});

// ---------------------------------------------------------------------------
// Model: what the page is allowed to render
// ---------------------------------------------------------------------------

test('the fallback is the footer the site shipped with, field by field', () => {
  assert.equal(DEFAULT_SITE_CONTENT.settings.brand.name, 'EduReach Hub');
  assert.match(DEFAULT_SITE_CONTENT.settings.footer.about, /JAMB, WAEC, NECO and Post-UTME/);
  assert.equal(DEFAULT_SITE_CONTENT.settings.contact.whatsapp, '2349130134969');
  assert.deepEqual(DEFAULT_SITE_CONTENT.settings.social.links, [], 'no social account is invented');

  const merged = mergeSiteContent(null);
  assert.equal(merged.settings.brand.name, 'EduReach Hub', 'a failed request keeps a complete footer');
  assert.deepEqual(merged.pages, []);
});

test('only https links survive, and a javascript: URL cannot become an href', () => {
  assert.equal(isSafeHttpsUrl('https://instagram.com/edureach'), true);
  assert.equal(isSafeHttpsUrl('http://instagram.com/edureach'), false, 'plain http is not accepted');
  assert.equal(isSafeHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpsUrl('https://user:pass@example.com'), false, 'credentials in a URL are refused');
  assert.equal(isSafeHttpsUrl(''), false);

  const merged = mergeSiteSettings({
    social: {
      links: [
        { label: 'Instagram', url: 'https://instagram.com/edureach' },
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: '', url: 'https://example.com' },
        { label: 'Duplicate', url: 'https://instagram.com/edureach' },
      ],
    },
  });
  assert.deepEqual(merged.social.links, [{ label: 'Instagram', url: 'https://instagram.com/edureach' }]);
});

test('a partial or hostile API payload cannot break the footer', () => {
  const merged = mergeSiteSettings({
    brand: { name: '   ', tagline: 'x'.repeat(500) },
    contact: { whatsapp: 'call-me-maybe', email: 'not-an-email' },
  });
  assert.equal(merged.brand.name, DEFAULT_SITE_CONTENT.settings.brand.name, 'blank name falls back');
  assert.equal(merged.brand.tagline.length, 160, 'long copy is capped, not rendered raw');
  assert.equal(merged.contact.whatsapp, '2349130134969', 'a number with letters falls back rather than rendering');
  assert.equal(merged.contact.email, '');
});

test('a WhatsApp link is built from digits only', () => {
  assert.equal(whatsappHref('2349130134969'), 'https://wa.me/2349130134969');
  assert.equal(whatsappHref('+234 913 013 4969'), 'https://wa.me/2349130134969');
  assert.equal(whatsappHref('123'), null);
  assert.equal(whatsappHref('javascript:alert(1)'), null);
});

// ---------------------------------------------------------------------------
// Server validation
// ---------------------------------------------------------------------------

test('settings validation refuses what the renderer would have to strip', () => {
  assert.equal(validateSettings('brand', { name: 'EduReach Hub', tagline: 'Study help' }).ok, true);
  assert.equal(validateSettings('brand', { name: 'x' }).ok, false, 'a one-character site name is a mistake');
  assert.equal(validateSettings('contact', { whatsapp: '2349130134969', email: '' }).ok, true);
  assert.equal(validateSettings('contact', { whatsapp: '2349130134969', email: 'nope' }).ok, false);
  assert.equal(validateSettings('social', { links: [{ label: 'X', url: 'javascript:alert(1)' }] }).ok, false);
  assert.equal(validateSettings('social', { links: [{ label: 'Twitter', url: 'https://x.com/edureach' }] }).ok, true);
  assert.equal(validateSettings('social', { links: Array(9).fill({ label: 'X', url: 'https://x.com/e' }) }).ok, false);
  assert.equal(validateSettings('unknown', {}).ok, false);
});

test('page validation refuses unsafe markup and out-of-range copy', () => {
  const base = { title: 'Privacy notice', summary: 'Short', body: '<p>Enough text to be a real page body.</p>', status: 'published', reviewState: 'pending' };
  assert.equal(validatePageInput(base).ok, true);
  assert.equal(validatePageInput({ ...base, body: '<p>ok</p><script>alert(1)</script> padding padding' }).ok, false);
  assert.equal(validatePageInput({ ...base, body: '<p onclick="steal()">Enough text to be a real page body.</p>' }).ok, false);
  assert.equal(validatePageInput({ ...base, body: '<p><a href="javascript:steal()">x</a> enough text here</p>' }).ok, false);
  assert.equal(validatePageInput({ ...base, status: 'live' }).ok, false);
  assert.equal(validatePageInput({ ...base, reviewState: 'blessed' }).ok, false);
  assert.equal(validatePageInput({ ...base, title: '' }).ok, false);
  assert.equal(validatePageInput({ ...base, body: 'x'.repeat(40_001) }).ok, false);
  assert.equal(containsUnsafeMarkup('<iframe src="x">'), true);
  assert.equal(containsUnsafeMarkup('<p>Plain <strong>bold</strong></p>'), false);
});

// ---------------------------------------------------------------------------
// Wiring: routes, footer and the API contract
// ---------------------------------------------------------------------------

test('every policy page is a real route, not a footer link to nowhere', () => {
  const routes = read('src/app/routes.tsx');
  for (const slug of ['privacy', 'terms', 'cookies', 'accessibility', 'disclaimer', 'contact']) {
    assert.match(routes, new RegExp(`path === '/${slug}'`), `/${slug} must resolve`);
    assert.match(routes, new RegExp(`<LegalPage slug="${slug}"`), `/${slug} must render the policy page`);
  }
  const footer = read('src/components/SiteFooter.tsx');
  assert.doesNotMatch(footer, /href="#"/, 'a footer link must never be a dead anchor');
  for (const href of ['/privacy', '/terms', '/cookies', '/accessibility', '/disclaimer', '/contact']) {
    assert.ok(footer.includes(`href: '${href}'`) || footer.includes(`href="${href}"`), `footer links ${href}`);
  }
});

test('the footer renders contact and social only when configured', () => {
  const footer = read('src/components/SiteFooter.tsx');
  assert.match(footer, /whatsappHref\(contact\.whatsapp\)/, 'the WhatsApp link is built, not pasted');
  assert.match(footer, /social\.links\.length > 0/, 'no social block when nothing is configured');
  assert.match(footer, /contact\.email &&/, 'no mailto when there is no mailbox');
  assert.match(footer, /not affiliated with JAMB, WAEC,\s+NECO or any institution/, 'the independence line stays');
});

test('the site content API is public for reading and capability-gated for writing', () => {
  const server = read('src/server/siteContent.ts');
  assert.match(server, /app\.get\('\/api\/site-content'/, 'the footer has one public read');
  assert.match(server, /deps\.requireCapability\('site\.read'\)/, 'editors need site.read to see drafts');
  assert.match(server, /deps\.requireCapability\('site\.update'\)/, 'writes need site.update');
  const settingsWrite = server.slice(server.indexOf("settings/:key"), server.indexOf("pages/:slug', deps"));
  assert.match(settingsWrite, /requireCapability\('site\.update'\)/, 'settings writes are guarded');
  assert.match(server, /recordAudit\(/, 'every write is recorded in the audit trail');
  assert.match(server, /status\(503\)/, 'a database outage is a 503, not a reassuring 200');

  const caps = read('src/lib/capabilities.ts');
  assert.match(caps, /'site\.read',\n\s+'site\.update',/, 'the capabilities are declared');
  assert.match(caps, /\{ path: '\/admin\/site', capability: 'site\.read' \}/, 'the console route is mapped');
});

test('the admin console no longer trusts a role the user can write', () => {
  const layout = read('pages/AdminLayout.tsx');
  assert.doesNotMatch(layout, /user_metadata\?\.role/, 'user_metadata is writable by the account holder');
  const auth = read('lib/auth.ts');
  assert.doesNotMatch(auth, /user_metadata\?\.role/, 'the server resolves roles from profiles.role only');
});

test('the admin page saves through the API rather than writing PostgREST directly', () => {
  const page = read('pages/AdminSitePage.tsx');
  assert.match(page, /saveAdminSiteSettings\(/);
  assert.match(page, /saveAdminSitePage\(/);
  assert.match(page, /restoreAdminSiteRevision\(/);
  assert.doesNotMatch(page, /supabase\.from\('site_/, 'the browser never writes the content tables');
  assert.match(page, /role="alert"/, 'a failed save is announced');
});

// ---------------------------------------------------------------------------
// Rendered footer
// ---------------------------------------------------------------------------

test('the footer renders a complete, honest footer with no dead links', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: SiteFooter } = await import('../src/components/SiteFooter');

  // Server rendering runs no effects, so this is exactly the fallback state a
  // visitor sees before the API answers - which is also the worst case.
  const html = renderToStaticMarkup(createElement(SiteFooter));

  assert.match(html, /EduReach Hub/, 'the brand is named');
  assert.match(html, /Practice for JAMB, WAEC, NECO and Post-UTME/, 'the shipped description is used when nothing is loaded');
  assert.match(html, /wa\.me\/2349130134969/, 'contact comes from settings, through the validated builder');
  assert.match(html, /© \d{4} EduReach Hub/, 'copyright names the year and the brand');
  assert.match(html, /not affiliated with JAMB, WAEC,\s+NECO or any institution/, 'the independence line is present');
  assert.doesNotMatch(html, /href="#"/, 'no placeholder anchors');
  for (const href of ['/privacy', '/terms', '/cookies', '/accessibility', '/disclaimer', '/contact', '/cbt', '/past-questions', '/schools']) {
    assert.ok(html.includes(`href="${href}"`), `the footer links ${href}`);
  }
  assert.doesNotMatch(html, /instagram|facebook|twitter|x\.com/i, 'no social account is rendered until an administrator configures one');
  assert.match(html, /<nav[^>]*aria-label="Footer: policies"/, 'the policy links are a labelled landmark');
  assert.equal((html.match(/<h2/g) ?? []).length, 3, 'each link column has a real heading, not a styled div');
  for (const heading of ['Learn', 'Explore', 'Get help']) {
    assert.ok(html.includes(`>${heading}</h2>`), `the ${heading} column is labelled by a heading`);
  }
});

test('a policy page never spins forever when the API is unreachable', () => {
  const page = read('pages/LegalPage.tsx');
  assert.match(page, /status === 'loading'/, 'loading is its own state');
  assert.match(page, /status === 'error'/, 'a finished-but-failed request is its own state');
  assert.match(page, /This page could not be loaded/, 'the failure is stated in words');
  assert.match(page, /role="alert"/, 'and announced');
  assert.match(page, /Reload the page/, 'with a way to retry');
  assert.match(page, /href="\/contact"/, 'and a way to reach a person');
  assert.doesNotMatch(page, /If it does not appear, check your connection and reload\.<\/p>\s*\)\}/, 'the eternal-loading copy is scoped to loading only');
});
