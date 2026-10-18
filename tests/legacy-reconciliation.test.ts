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

function copyLegacySQL(): string {
  return readFileSync(join(REPO_ROOT, 'supabase/migrations/20261020120000_copy_legacy_questions_to_practice_banks.sql'), 'utf8');
}

test('legacy comprehensive banks are reconciled into Practice Banks with history preserved', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    await db.exec(`
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
    `);

    const { rows: legacyJamb } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='JAMB UTME Comprehensive Practice Bank' limit 1`);
    const legacyJambId = legacyJamb[0].id;
    const { rows: legacyWaec } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='WAEC SSCE Comprehensive Practice Bank' limit 1`);
    const legacyWaecId = legacyWaec[0].id;
    const { rows: legacyNeco } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='NECO SSCE Comprehensive Practice Bank' limit 1`);
    const legacyNecoId = legacyNeco[0].id;
    const { rows: legacyPost } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='Post-UTME Comprehensive Practice Bank' limit 1`);
    const legacyPostId = legacyPost[0].id;

    const { rows: practiceJamb } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='JAMB UTME Practice Bank' limit 1`);
    const practiceJambId = practiceJamb[0].id;
    const { rows: practiceWaec } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='WAEC SSCE Practice Bank' limit 1`);
    const practiceWaecId = practiceWaec[0].id;
    const { rows: practiceNeco } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='NECO SSCE Practice Bank' limit 1`);
    const practiceNecoId = practiceNeco[0].id;
    const { rows: practicePost } = await db.query<{ id: string }>(`select id from public.cbt_exams where title='Post-UTME Practice Bank' limit 1`);
    const practicePostId = practicePost[0].id;

    // Insert legacy questions with distinct provenance per bank
    await db.exec(`
      insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
      values
        ('${legacyJambId}', 'Biology', 'Legacy JAMB Biology Q1 - unique legacy text', 'A1','B1','C1','D1','A','legacy explanation 1',1, 1, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', false, 'single_choice', 'moderate'),
        ('${legacyJambId}', 'Biology', 'Legacy JAMB Biology Q2 - unique legacy text', 'A2','B2','C2','D2','B','legacy explanation 2',1, 2, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', true, 'single_choice', 'difficult'),
        ('${legacyJambId}', 'Chemistry', 'Legacy JAMB Chemistry Q1', 'A3','B3','C3','D3','C','chem legacy',1, 3, 'unverified', 'Legacy Comprehensive 2024', 2024, 'needs_review', false, 'single_choice', 'easy'),
        ('${legacyWaecId}', 'Physics', 'Legacy WAEC Physics Q1 - waec unique', 'WA1','WB1','WC1','WD1','A','waec expl',1, 1, 'unverified', 'Legacy WAEC 2024', 2024, 'needs_review', false, 'single_choice', 'moderate'),
        ('${legacyNecoId}', 'Mathematics', 'Legacy NECO Mathematics Q1 - neco unique', 'NA1','NB1','NC1','ND1','B','neco expl',1, 1, 'unverified', 'Legacy NECO 2024', 2024, 'needs_review', false, 'single_choice', 'moderate'),
        ('${legacyPostId}', 'Use of English', 'Legacy Post-UTME English Q1 - post unique', 'PA1','PB1','PC1','PD1','C','post expl',1, 1, 'unverified', 'Legacy Post-UTME 2024', 2024, 'needs_review', false, 'single_choice', 'moderate')
    `);

    // Deduplication case: insert into destination with different casing/whitespace that should block copy
    // Destination already has a question that matches legacy text case-insensitively
    await db.exec(`
      insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
      values
        ('${practiceJambId}', 'Biology', '  LEGACY jamb biology q1 - UNIQUE LEGACY TEXT  ', 'X','Y','Z','W','A','existing dest with whitespace/case variant',1, 999, 'original_practice', 'EduReach original', 2026, 'needs_review', false, 'single_choice', 'moderate')
    `);

    const legacyQ1Id = (await db.query<{ id: string }>(`select id from public.exam_questions where exam_id='${legacyJambId}' and position=1 limit 1`)).rows[0].id;

    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000001','legacy-test@example.test','{}'::jsonb)
      on conflict (id) do nothing;
    `);
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

    const beforeJambLegacy = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${legacyJambId}'`)).rows[0].c;
    const beforeWaecLegacy = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${legacyWaecId}'`)).rows[0].c;
    const beforeNecoLegacy = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${legacyNecoId}'`)).rows[0].c;
    const beforePostLegacy = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${legacyPostId}'`)).rows[0].c;
    const beforeJambPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    const beforeWaecPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceWaecId}'`)).rows[0].c;

    assert.equal(beforeJambLegacy, 3);
    assert.equal(beforeWaecLegacy, 1);
    assert.equal(beforeNecoLegacy, 1);
    assert.equal(beforePostLegacy, 1);

    await db.exec(`update public.cbt_exams set is_active=true where title='JAMB UTME Comprehensive Practice Bank'`);
    const migrationSQL = copyLegacySQL();
    await db.exec(migrationSQL);
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

    const afterJambPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    const afterWaecPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceWaecId}'`)).rows[0].c;
    const afterNecoPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceNecoId}'`)).rows[0].c;
    const afterPostPractice = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practicePostId}'`)).rows[0].c;

    // JAMB: 3 legacy, but 1 deduped by case/whitespace variant already in dest, so only 2 should copy
    assert.equal(afterJambPractice, beforeJambPractice + 2, 'JAMB: 2 of 3 legacy should copy (1 blocked by normalized dedup)');
    assert.equal(afterWaecPractice, beforeWaecPractice + 1, 'WAEC: 1 legacy should copy');
    assert.equal(afterNecoPractice, (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceNecoId}'`)).rows[0].c, 'NECO count increased');
    const necoCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceNecoId}'`)).rows[0].c;
    assert.ok(necoCount > 0);
    // More explicit: NECO and Post check
    const afterNeco = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceNecoId}' and question_text='Legacy NECO Mathematics Q1 - neco unique'`)).rows[0].c;
    assert.equal(afterNeco, 1, 'NECO legacy question should land in NECO Practice Bank');
    const afterPost = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practicePostId}' and question_text='Legacy Post-UTME English Q1 - post unique'`)).rows[0].c;
    assert.equal(afterPost, 1, 'Post-UTME legacy question should land in Post-UTME Practice Bank');
    const afterWaec = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceWaecId}' and question_text='Legacy WAEC Physics Q1 - waec unique'`)).rows[0].c;
    assert.equal(afterWaec, 1, 'WAEC legacy question should land in WAEC Practice Bank');

    // Deduplication: the whitespace/case variant should have prevented copy
    const dedupBlocked = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}' and lower(trim(question_text)) = lower(trim('Legacy JAMB Biology Q1 - unique legacy text'))`)).rows[0].c;
    assert.equal(dedupBlocked, 1, 'normalized dedup should keep only 1 instance (existing dest), not copy duplicate');

    const { rows: copied } = await db.query<{
      subject: string; question_text: string; source_type: string; source_name: string; review_status: string; format_verified: boolean; difficulty: string;
    }>(`
      select subject, question_text, source_type, source_name, review_status, format_verified, difficulty
      from public.exam_questions
      where exam_id='${practiceJambId}' and question_text='Legacy JAMB Biology Q2 - unique legacy text'
      limit 1
    `);
    assert.equal(copied.length, 1);
    assert.equal(copied[0].source_type, 'unverified');
    assert.equal(copied[0].source_name, 'Legacy Comprehensive 2024');
    assert.equal(copied[0].difficulty, 'difficult');

    const { rows: practicePositions } = await db.query<{ position: number }>(`select position from public.exam_questions where exam_id='${practiceJambId}' order by position`);
    const uniquePositions = new Set(practicePositions.map(r => r.position));
    assert.equal(practicePositions.length, uniquePositions.size, 'no duplicate positions');

    const afterAttempts = (await db.query<{ c: number }>(`select count(*)::int as c from public.cbt_attempts where id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'`)).rows[0].c;
    assert.equal(afterAttempts, 1);
    const { rows: answer } = await db.query<{ question_id: string }>(`select question_id from public.cbt_answers where attempt_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' limit 1`);
    assert.equal(answer[0].question_id, legacyQ1Id);
    const { rows: legacyStillExists } = await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where id='${legacyQ1Id}'`);
    assert.equal(legacyStillExists[0].c, 1);

    await db.exec(migrationSQL);
    const secondPracticeCount = (await db.query<{ c: number }>(`select count(*)::int as c from public.exam_questions where exam_id='${practiceJambId}'`)).rows[0].c;
    assert.equal(secondPracticeCount, afterJambPractice, 'second run must not duplicate');

    const { rows: legacyActive } = await db.query<{ is_active: boolean }>(`select is_active from public.cbt_exams where title='JAMB UTME Comprehensive Practice Bank' limit 1`);
    assert.equal(legacyActive[0].is_active, false);

    const { rows: dups } = await db.query<{ cnt: number }>(`
      select count(*)::int as cnt from (
        select lower(trim(question_text)) from public.exam_questions where exam_id='${practiceJambId}' group by lower(trim(question_text)) having count(*)>1
      ) d
    `);
    assert.equal(dups[0].cnt, 0);
  });
});
