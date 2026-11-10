import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, SHIM_PATH, REPO_ROOT, migrationFiles } from '../scripts/replay';

const migrationName = '20261031120000_news_placeholder_safety.sql';
const migration = readFileSync(join(MIGRATIONS_DIR, migrationName), 'utf8');
const id = 'c1e1aedc-8c48-4a6a-a3ea-431ac7856918';

test('news migration adds no placeholder records and protects genuine and linked data', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync(SHIM_PATH, 'utf8'));
    for (const file of migrationFiles().filter((name) => name < migrationName)) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
    await db.exec(`insert into public.news_articles (slug, title, body, category, published, published_at, featured, tags)
      values ('genuine-published','Genuine published','Original published body','general',true,'2024-01-01',true,'original'),
             ('genuine-draft','Genuine draft','Original draft body','general',false,null,false,'draft')`);
    const genuineBefore = await db.query("select to_jsonb(n) as row from public.news_articles n order by slug");
    await db.exec(migration);
    // Migration is safe to replay and never classifies existing content.
    await db.exec(migration);
    let genuineAfter = await db.query("select to_jsonb(n) - 'is_placeholder' - 'placeholder_note' as row from public.news_articles n order by slug");
    assert.deepEqual(genuineAfter.rows, genuineBefore.rows);
    assert.equal((await db.query('select id from public.news_articles where is_placeholder')).rows.length, 0);
    assert.equal(existsSync(join(REPO_ROOT, 'supabase/seeds/placeholder-news.sql')), false, 'there is no optional placeholder seed');
    // A synthetic legacy row is created only in this isolated test database.
    await db.query("insert into public.news_articles (id,slug,title,body,category,published,is_placeholder,placeholder_note) values ($1,'legacy-placeholder','Synthetic test row','Synthetic test body','general',false,true,'Test-only legacy row')", [id]);
    const rows = await db.query<{ id: string; published: boolean; is_placeholder: boolean; placeholder_note: string }>('select id, published, is_placeholder, placeholder_note from public.news_articles where id = $1', [id]);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].published, false);
    assert.equal(rows.rows[0].is_placeholder, true);
    assert.ok(rows.rows[0].placeholder_note);
    genuineAfter = await db.query("select to_jsonb(n) - 'is_placeholder' - 'placeholder_note' as row from public.news_articles n where slug like 'genuine-%' order by slug");
    assert.deepEqual(genuineAfter.rows, genuineBefore.rows);

    await db.exec('set role anon');
    assert.equal((await db.query('select id from public.news_articles where id = $1', [id])).rows.length, 0);
    await db.exec('reset role');
    await assert.rejects(db.query('update public.news_articles set published = true where id = $1', [id]), /news_placeholder_draft_check/);
    await assert.rejects(db.query("update public.news_articles set placeholder_note = '' where id = $1", [id]), /news_placeholder_draft_check/);

    // Real linked records cannot be silently detached by either delete route or SQL.
    await db.query("insert into public.document_bank (title, original_filename, file_bytes, storage_path, news_article_id) values ('Existing document','real.pdf',1,'test/document.pdf',$1)", [id]);
    await db.query("insert into public.news_ingest_candidates (source_key, source_url, canonical_url, title, article_id, matched_article_id) values ('existing','https://example.test/a','https://example.test/a','Existing candidate',$1,$1)", [id]);
    const documentBefore = await db.query('select to_jsonb(d) as row from public.document_bank d');
    const candidateBefore = await db.query('select to_jsonb(c) as row from public.news_ingest_candidates c');
    await assert.rejects(db.query('delete from public.news_articles where id = $1', [id]), /Placeholder deletion blocked/);
    assert.deepEqual((await db.query('select to_jsonb(d) as row from public.document_bank d')).rows, documentBefore.rows);
    assert.deepEqual((await db.query('select to_jsonb(c) as row from public.news_ingest_candidates c')).rows, candidateBefore.rows);
    assert.deepEqual((await db.query("select to_jsonb(n) - 'is_placeholder' - 'placeholder_note' as row from public.news_articles n where slug like 'genuine-%' order by slug")).rows, genuineBefore.rows);
    await db.exec('delete from public.document_bank; delete from public.news_ingest_candidates');
    // The catalog-based guard also sees a newly added foreign key, not only the two known tables.
    await db.exec('create table public.test_news_link (article_id uuid references public.news_articles(id) on delete set null)');
    await db.query('insert into public.test_news_link values ($1)', [id]);
    await assert.rejects(db.query('delete from public.news_articles where id = $1', [id]), /Placeholder deletion blocked/);
    assert.equal((await db.query('select article_id from public.test_news_link')).rows.length, 1);
    await db.exec('drop table public.test_news_link');
    // A generic import-style upsert cannot publish an existing marked row.
    await assert.rejects(db.query("insert into public.news_articles (id,slug,title,body,category,published) values ($1,'import-slug','Import','Import','general',true) on conflict (id) do update set published = excluded.published", [id]), /news_placeholder_draft_check/);
    // An unreferenced placeholder can be removed without changing genuine news.
    await db.query('delete from public.news_articles where id = $1', [id]);
    assert.deepEqual((await db.query("select to_jsonb(n) - 'is_placeholder' - 'placeholder_note' as row from public.news_articles n order by slug")).rows, genuineBefore.rows);
    await db.query("insert into public.news_articles (id,slug,title,body,category,published,is_placeholder,placeholder_note) values ($1,'legacy-placeholder','Synthetic test row','Synthetic test body','general',false,true,'Test-only legacy row')", [id]);
    // Simulate a deliberate replacement, including a changed slug; migration replay cannot recreate a placeholder.
    await db.query("update public.news_articles set slug = 'genuine-replacement', title = 'Verified update', body = 'Verified content', is_placeholder = false, placeholder_note = null where id = $1", [id]);
    await db.query('update public.news_articles set published = true where id = $1', [id]);
    await db.exec(migration);
    assert.equal((await db.query("select id from public.news_articles where slug = 'edureach-placeholder-news-draft'")).rows.length, 0);
    assert.deepEqual((await db.query('select title, published, is_placeholder from public.news_articles where id = $1', [id])).rows[0], { title: 'Verified update', published: true, is_placeholder: false });
    // Migration replay never overwrites genuine records with formerly reserved slug or ID.
    await db.query('delete from public.news_articles where id = $1', [id]);
    await db.exec("insert into public.news_articles (slug,title,body,category,published) values ('edureach-placeholder-news-draft','Real slug collision','Real body','general',true)");
    await db.exec(migration);
    assert.equal((await db.query('select id from public.news_articles where id = $1', [id])).rows.length, 0);
    assert.equal((await db.query<{title: string}>("select title from public.news_articles where slug = 'edureach-placeholder-news-draft'")).rows[0].title, 'Real slug collision');
    await db.exec("delete from public.news_articles where slug = 'edureach-placeholder-news-draft'");
    await db.query("insert into public.news_articles (id,slug,title,body,category,published) values ($1,'real-id-collision','Real ID collision','Real body','general',true)", [id]);
    await db.exec(migration);
    assert.equal((await db.query<{title: string}>('select title from public.news_articles where id = $1', [id])).rows[0].title, 'Real ID collision');
    assert.deepEqual((await db.query("select to_jsonb(n) - 'is_placeholder' - 'placeholder_note' as row from public.news_articles n where slug like 'genuine-%' order by slug")).rows, genuineBefore.rows);
  } finally { await db.close(); }
});
