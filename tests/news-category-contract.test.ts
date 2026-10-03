import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';
import { newsCategoryMatches, newsCategorySlug } from '../src/data/newsCategories';

// NEWS-1: a live article was invisible under its own category because the editor
// stored a label while the page filtered by slug. The contract is now one
// canonical slug, computed by the same rule in the database (a generated column)
// and in the client (so an older payload or cached response still filters
// correctly). These tests pin both halves to the same expectations.

const CASES: Array<[string, string]> = [
  ['Scholarships & Funding', 'scholarships'],
  ['scholarships', 'scholarships'],
  ['funding', 'scholarships'],
  ['NABTEB', 'nabteb'],
  ['WAEC', 'waec'],
  ['NECO', 'neco'],
  ['Admissions', 'admissions'],
  ['admission', 'admissions'],
  ['Universities', 'universities'],
  ['Polytechnics', 'polytechnics'],
  ['Colleges of Education', 'colleges-of-education'],
  ['JAMB & UTME', 'jamb'],
  ['UTME', 'jamb'],
  ['Post-UTME', 'post-utme'],
  ['post utme', 'post-utme'],
  ['Campus Updates', 'school-updates'],
  ['Results', 'examination-updates'],
  ['Academic Calendar', 'academic-calendar'],
  ['NELFUND', 'nelfund'],
  ['General Education', 'general'],
  ['', 'general'],
  ['   ', 'general'],
];

test('the client canonicalises every spelling of a category to one slug', () => {
  for (const [input, expected] of CASES) {
    assert.equal(newsCategorySlug(input), expected, `${JSON.stringify(input)} should be ${expected}`);
  }
});

test('filtering an article by its own category never misses', () => {
  for (const [stored, slug] of CASES) {
    assert.equal(newsCategoryMatches(stored, slug), true, `${stored} should match ${slug}`);
  }
  assert.equal(newsCategoryMatches('Scholarships & Funding', 'all'), true, 'the All filter shows everything');
  assert.equal(newsCategoryMatches('Sports Roundup', 'jamb'), false, 'an unrelated category still does not match');
});

let db: PGlite;

before(async () => { db = new PGlite(); await applyMigrations(db); });
after(async () => { await db.close(); });

test('the database computes the same slug from the stored label', async () => {
  for (const [input, expected] of CASES) {
    const { rows } = await db.query<{ slug: string }>(`select public.news_category_slug($1) as slug`, [input]);
    assert.equal(rows[0].slug, expected, `public.news_category_slug(${JSON.stringify(input)})`);
  }
});

test('news_articles carries the derived slug, and it follows the label automatically', async () => {
  const { rows } = await db.query<{ data_type: string; is_generated: string }>(
    `select data_type, is_generated from information_schema.columns
     where table_schema = 'public' and table_name = 'news_articles' and column_name = 'category_slug'`,
  );
  assert.equal(rows.length, 1, 'the derived column exists');
  assert.equal(rows[0].is_generated, 'ALWAYS', 'and is generated, so it cannot drift from the label');

  await db.exec(`
    insert into public.news_articles (slug, title, excerpt, body, category, published)
    values ('contract-probe','Probe','Probe','Probe','Scholarships & Funding', true);
  `);
  const { rows: inserted } = await db.query<{ category_slug: string }>(
    `select category_slug from public.news_articles where slug = 'contract-probe'`,
  );
  assert.equal(inserted[0].category_slug, 'scholarships', 'the live filter path now finds this article');
  await db.exec(`delete from public.news_articles where slug = 'contract-probe'`);
});
