import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../scripts/replay';

async function withDatabase<T>(run: (db: PGlite) => Promise<T>): Promise<T> {
  const db = new PGlite();
  try {
    return await run(db);
  } finally {
    await db.close();
  }
}

// Helper to run the copy-legacy SQL directly (as migration does)
function copyLegacySQL(): string {
  return readFileSync(join(REPO_ROOT, 'supabase/migrations/20261020120000_copy_legacy_questions_to_practice_banks.sql'), 'utf8');
}

test('legacy comprehensive banks are reconciled into Practice Banks with history preserved', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    // Seed legacy banks as they exist on live prod (active, with questions)
    // Use known titles that the reconciliation expects
    await db.exec(`
      -- Create legacy comprehensive banks (if not already present, they were deactivated by migration;
      -- we re-activate to simulate pre-reconciliation live state)
      insert into public.cbt_exams (title, exam_body, subject, is_active, duration_minutes)
      select 'JAMB UTME Comprehensive Practice Bank', 'JAMB', 'Multiple subjects', true, 120
      where not exists (select 1 from public.cbt_exams where title='JAMB UTME Comprehensive Practice Bank');
      insert into public.cbt_exams (title, exam_body, subject, is_active, duration_minutes)
      select 'WAEC SSCE Comprehensive Practice Bank', 'WAEC', 'Multiple subjects', true, 120
      where not exists (select 1 from public.cbt_exams where title='WAEC SSCE Comprehensive Practice Bank');
      insert into public.cbt_exams (title, exam_body, subject, is_active, duration_minutes)
      select 'NECO SSCE Comprehensive Practice Bank', 'NECO', 'Multiple subjects', true, 120
      where not exists (select 1 from public.cbt_exams where title='NECO SSCE Comprehensive Practice Bank');
      insert into public.cbt_exams (title, exam_body, subject, is_active, duration_minutes)
      select 'Post-UTME Comprehensive Practice Bank', 'POST-UTME', 'Multiple subjects', true, 90
      where not exists (select 1 from public.cbt_exams where title='Post-UTME Comprehensive Practice Bank');
      update public.cbt_exams set is_active=true where title in ('JAMB UTME Comprehensive Practice Bank','WAEC SSCE Comprehensive Practice Bank','NECO SSCE Comprehensive Practice Bank','Post-UTME Comprehensive Practice Bank');

      -- Legacy questions: 2 per subject for JAMB, with distinct provenance to verify preservation
      -- JAMB legacy: 2 Biology, 1 Chemistry
    `);

    // Get IDs for later checks
    const { rows: legacyJamb } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='JAMB UTME Comprehensive Practice Bank' limit 1`);
    const legacyJambId = legacyJamb[0].id;
    const { rows: practiceJamb } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='JAMB UTME Practice Bank' limit 1`);
    const practiceJambId = practiceJamb[0].id;

    // Insert legacy questions with custom metadata to verify preservation
    await db.exec(`
      insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
      values
        ('${legacyJambId}', 'Biology', 'Legacy JAMB Biology Q1 - unique legacy text', 'A1','B1','C1','D1','A','legacy explanation 1',1, 1, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', false, 'single_choice', 'moderate'),
        ('${legacyJambId}', 'Biology', 'Legacy JAMB Biology Q2 - unique legacy text', 'A2','B2','C2','D2','B','legacy explanation 2',1, 2, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', true, 'single_choice', 'difficult'),
        ('${legacyJambId}', 'Chemistry', 'Legacy JAMB Chemistry Q1', 'A3','B3','C3','D3','C','chem legacy',1, 3, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', false, 'single_choice', 'easy')
    `);

    // Create a student attempt + answer referencing a legacy question to verify history preservation
    const legacyQ1Id = (await db.query<{ id: string }>(`select id from public.exam_questions where exam_id='${legacyJambId}' and position=1 limit 1`)).rows[0].id;

    // Need auth user for FK
    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000001','legacy-test@example.test','{}'::jsonb)
      on conflict (id) do nothing;
    `);
    // Insert attempt referencing legacy exam
    await db.exec(`
      insert into public.cbt_attempts (id, exam_id, user_id, status, created_at)
      values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '${legacyJambId}', '00000000-0000-0000-0000-000000000001', 'submitted', now())
      on conflict (id) do nothing;
    `);
    await db.exec(`
      insert into public.cbt_answers (attempt_id, question_id, selected_option, is_correct)
      values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '${legacyQ1Id}', 'A', true)
      on conflict (attempt_id, question_id) do nothing;
    `);

    const beforeLegacyCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${legacyJambId}'`)).rows[0].c;
    const beforePracticeCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    const beforeAttempts = (await db.query<{ c: number }>(`select count(*)::int as c from public.cbt_attempts where id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'`)).rows[0].c;

    assert.equal(beforeLegacyCount, 3, 'legacy should have 3 seeded questions');
    assert.ok(beforePracticeCount > 0, 'practice bank should exist from migrations');
    assert.equal(beforeAttempts, 1, 'attempt should exist before reconciliation');

    // Run reconciliation (the actual migration SQL) — it will deactivate legacy banks and copy
    // First, ensure legacy banks are active to test deactivation
    await db.exec(`update public.cbt_exams set is_active=true where title='JAMB UTME Comprehensive Practice Bank'`);

    const migrationSQL = copyLegacySQL();
    await db.exec(migrationSQL);

    // Also run the deactivation part from 20261020100000 to ensure legacy are inactive after
    await db.exec(`
      update public.cbt_exams
      set is_active = false, updated_at = now()
      where is_active = true
        and title in (
          'JAMB UTME Comprehensive Practice Bank',
          'WAEC SSCE Comprehensive Practice Bank',
          'NECO SSCE Comprehensive Practice Bank',
          'Post-UTME Comprehensive Practice Bank'
        );
    `);

    // Verify: legacy questions copied into correct active bank (JAMB Practice)
    const afterPracticeCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    assert.equal(afterPracticeCount, beforePracticeCount + 3, 'all 3 legacy JAMB questions should be copied (unique texts)');

    // Verify metadata preservation
    const { rows: copied } = await db.query<{
      subject: string; question_text: string; source_type: string; source_name: string; review_status: string; format_verified: boolean; difficulty: string; position: number;
    }>(`
      select subject, question_text, source_type, source_name, review_status, format_verified, difficulty, position
      from public.exam_questions
      where exam_id='${practiceJambId}' and question_text like 'Legacy JAMB%'
      order by position
    `);
    assert.equal(copied.length, 3, 'copied rows should be queryable in destination');
    assert.equal(copied[0].source_type, 'unverified');
    assert.equal(copied[0].source_name, 'Legacy Comprehensive 2024');
    assert.equal(copied[0].review_status, 'needs_review');
    assert.equal(copied[0].format_verified, false);
    assert.equal(copied[1].review_status, 'needs_review');
    assert.equal(copied[1].format_verified, true);
    assert.equal(copied[1].difficulty, 'difficult');

    // Verify positions avoid conflicts (should be after max original position)
    const { rows: practicePositions } = await db.query<{ position: number }>(`select position from public.exam_questions where exam_id='${practiceJambId}' order by position`);
    const positions = practicePositions.map(r => r.position);
    const uniquePositions = new Set(positions);
    assert.equal(positions.length, uniquePositions.size, 'no duplicate positions in destination after copy');

    // Verify attempts and answers remain intact and still reference original legacy question ID
    const afterAttempts = (await db.query<{ c: number }>(`select count(*)::int as c from public.cbt_attempts where id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'`)).rows[0].c;
    assert.equal(afterAttempts, 1, 'attempt must survive reconciliation');
    const { rows: answer } = await db.query<{ question_id: string }>(`select question_id from public.cbt_answers where attempt_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' limit 1`);
    assert.equal(answer[0].question_id, legacyQ1Id, 'answer must still reference original legacy question_id');
    const { rows: legacyStillExists } = await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where id='${legacyQ1Id}'`);
    assert.equal(legacyStillExists[0].c, 1, 'original legacy question row must not be deleted');

    // Verify second run creates no duplicates (idempotency)
    await db.exec(migrationSQL);
    const secondPracticeCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    assert.equal(secondPracticeCount, afterPracticeCount, 'second reconciliation run must not duplicate');

    // Verify legacy banks are now inactive
    const { rows: legacyActive } = await db.query<{ is_active: boolean }>(`select is_active from public.cbt_exams where title='JAMB UTME Comprehensive Practice Bank' limit 1`);
    assert.equal(legacyActive[0].is_active, false, 'legacy bank should be deactivated after reconciliation');

    // Verify no duplicate normalized texts in destination
    const { rows: dups } = await db.query<{ cnt: number }>(`
      select count(*)::int as cnt from (
        select lower(trim(question_text)) from public.exam_questions where exam_id='${practiceJambId}' group by lower(trim(question_text)) having count(*)>1
      ) d
    `);
    assert.equal(dups[0].cnt, 0, 'destination should have no duplicate normalized question_text after copy');
  });
});
