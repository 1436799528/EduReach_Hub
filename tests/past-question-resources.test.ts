import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// PQR-1: the past-question library must never present an unverified paper as
// available, and a row with no document behind it cannot exist at all.

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

test('a resource row must point at an actual document', async () => {
  await assert.rejects(
    () => db.exec(`insert into public.past_question_resources (exam_body, title) values ('JAMB', 'Nothing behind it')`),
    /past_question_resources_has_a_source/,
    'a promise with no paper is rejected by the database, not just by the page',
  );
  await assert.rejects(
    () => db.exec(`insert into public.past_question_resources (exam_body, title, source_url) values ('BECE', 'Wrong body', 'https://example.test/x.pdf')`),
    /past_question_resources_exam_body_check|violates check constraint/,
    'only the exam bodies the product supports are accepted',
  );
});

test('an unverified or unpublished paper is invisible to students', async () => {
  await db.exec(`
    insert into public.past_question_resources (exam_body, subject, title, source_url, paper_year, published, verified_at) values
      ('JAMB', 'Physics', 'Physics 2024 (verified)', 'https://example.test/physics-2024.pdf', 2024, true, now()),
      ('JAMB', 'Physics', 'Physics 2023 (published, not verified)', 'https://example.test/physics-2023.pdf', 2023, true, null),
      ('JAMB', 'Physics', 'Physics 2022 (verified, not published)', 'https://example.test/physics-2022.pdf', 2022, false, now());
  `);

  const visible = await asRole('anon', null, async () => db.query<{ title: string }>(
    `select title from public.past_question_resources order by paper_year desc`,
  ));
  assert.deepEqual(
    visible.rows.map((row) => row.title),
    ['Physics 2024 (verified)'],
    'the student sees the verified paper and nothing else',
  );

  // The signed-in student sees the same set: verification is not an entitlement.
  const asStudent = await asRole('authenticated', '11111111-2222-3333-4444-555555555555', async () => db.query<{ n: number }>(
    `select count(*)::int as n from public.past_question_resources`,
  ));
  assert.equal(asStudent.rows[0].n, 1);
});

test('no client role can publish, edit or delete the library', async () => {
  for (const statement of [
    `insert into public.past_question_resources (exam_body, title, source_url) values ('JAMB','Sneaky','https://example.test/x.pdf')`,
    `update public.past_question_resources set published = false`,
    `delete from public.past_question_resources`,
  ]) {
    await assert.rejects(
      () => asRole('authenticated', '11111111-2222-3333-4444-555555555555', async () => db.exec(statement)),
      /permission denied|violates row-level security/i,
      `a student must not be able to run: ${statement}`,
    );
  }
});

test('coverage reports what is actually published, so the page can be honest', async () => {
  const { rows } = await asRole('anon', null, async () => db.query<{ exam_body: string; papers: number; subjects: number }>(
    `select exam_body, papers::int, subjects::int from public.past_question_coverage('JAMB')`,
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].papers, 1, 'only the verified paper is counted');
  assert.equal(rows[0].subjects, 1);
  const { rows: none } = await asRole('anon', null, async () => db.query(
    `select * from public.past_question_coverage('WAEC')`,
  ));
  assert.equal(none.length, 0, 'a body with nothing published reports no coverage rather than an empty list of subjects');
});
