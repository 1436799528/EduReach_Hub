import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, applyMigrations } from '../scripts/replay';

// INSTITUTION-1: the additive institution-intelligence schema, exercised on a
// real PostgreSQL engine. Nothing here contacts a hosted project; the fixtures
// are synthetic institutions, one of which is deliberately unreviewed.
//
// The tests assert the rules the assignment turns on:
//   * a client sees a fact only when it is both published and verified;
//   * evidence and review notes never reach a student;
//   * a score is bound to its own scale, so 400-scale and 100-scale numbers
//     cannot be compared by accident;
//   * a national minimum is not a programme cut-off;
//   * a student can read and write only their own admission goal.

const NEW_MIGRATION = '20261117120000_institution_intelligence.sql';
const INST_A = '11111111-1111-4111-8111-111111111111';
const INST_B = '22222222-2222-4222-8222-222222222222';
const SOURCE = '33333333-3333-4333-8333-333333333333';
const OFFERING_A = '44444444-4444-4444-8444-444444444444';
const OFFERING_B = '55555555-5555-4555-8555-555555555555';
const STUDENT = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b1111111-1111-4111-8111-111111111111';

let db: PGlite;

async function as(role: 'anon' | 'authenticated' | 'service_role', user: string | null, run: () => Promise<void>) {
  await db.exec(`set role ${role}`);
  try {
    if (user) await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await run();
  } finally {
    await db.exec('reset role');
  }
}

async function rejects(role: 'anon' | 'authenticated' | 'service_role', user: string | null, sql: string, why: string) {
  let failed = false;
  let message = '';
  await as(role, user, async () => {
    try {
      await db.exec(sql);
    } catch (error) {
      failed = true;
      message = (error as Error).message;
    }
  });
  assert.ok(failed, why);
  return message;
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  // Supabase's service_role bypasses RLS; the CI shim creates the role without
  // the attribute, so the schema tests set it here to exercise constraints
  // rather than the absence of a policy.
  await db.exec('alter role service_role bypassrls');
  await db.exec(`
    insert into public.institutions (id, school_name, acronym, state, institution_type)
    values ('${INST_A}', 'Synthetic University A', 'SUA', 'Rivers', 'university'),
           ('${INST_B}', 'Synthetic University B', 'SUB', 'Enugu', 'university');
    insert into public.edureach_sources (id, name, url, authority, source_type)
    values ('${SOURCE}', 'Synthetic University A official site', 'https://example.edu.ng/', 'Synthetic University A', 'official');
    insert into public.institution_profiles
      (institution_id, official_name, ownership, institution_category, year_established, profile_status, verification_status, source_url)
    values ('${INST_A}', 'Synthetic University A', 'federal', 'university', 1975, 'published', 'verified', 'https://example.edu.ng/about'),
           ('${INST_B}', 'Synthetic University B', 'state', 'university', 1999, 'in_review', 'in_review', 'https://example.edu.ng/about');
    insert into public.institution_programme_offerings
      (id, institution_id, programme_name, degree_title, admission_session, publication_status, verification_status, source_url)
    values ('${OFFERING_A}', '${INST_A}', 'Civil Engineering', 'B.Eng.', '2026/2027', 'published', 'verified', 'https://example.edu.ng/programmes'),
           ('${OFFERING_B}', '${INST_B}', 'Civil Engineering', 'B.Eng.', '2026/2027', 'published', 'verified', 'https://example.edu.ng/programmes');
    insert into public.institution_fact_evidence (institution_id, entity_type, field_key, source_url, verification_status)
    values ('${INST_A}', 'profile', 'mission', 'https://example.edu.ng/about', 'in_review');
    insert into auth.users (id, email, raw_user_meta_data)
    values ('${STUDENT}', 'student@synthetic.test', '{}'),
           ('${OTHER}', 'other@synthetic.test', '{}');
  `);
});

after(async () => {
  await db.close();
});

test('the institution intelligence migration is idempotent', async () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, NEW_MIGRATION), 'utf8');
  await db.exec(sql);
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'institution_profiles'",
  );
  assert.equal(rows[0].n, 1, 're-applying must not duplicate the table');
});

test('a client sees a profile only when it is published and verified', async () => {
  await as('anon', null, async () => {
    const { rows } = await db.query<{ institution_id: string }>(
      'select institution_id from public.institution_profiles order by institution_id',
    );
    assert.deepEqual(rows.map((row) => row.institution_id), [INST_A], 'the in_review profile stays invisible');
  });
});

test('evidence and review notes are never readable by a client', async () => {
  // No SELECT privilege at all: the table is revoked from anon, so the request
  // fails before RLS is even consulted.
  const denied = await rejects('anon', null, 'select 1 from public.institution_fact_evidence', 'anon cannot select evidence');
  assert.match(denied, /permission denied/i);
  await rejects('anon', null, 'insert into public.institution_fact_evidence (institution_id, entity_type, field_key, source_url) values (\'11111111-1111-4111-8111-111111111111\', \'profile\', \'x\', \'https://example.edu.ng/\')', 'anon has no insert grant on evidence');
});

test('a benchmark value must sit on its own declared scale', async () => {
  await db.exec(`
    insert into public.institution_admission_benchmarks
      (institution_id, admission_session, benchmark_type, benchmark_label, benchmark_value, score_scale_min, score_scale_max, publication_status, verification_status)
    values ('${INST_A}', '2026/2027', 'screening_aggregate', 'Merit aggregate', 72.5, 0, 100, 'published', 'verified');
  `);
  const offScale = await rejects('service_role', null, `
    insert into public.institution_admission_benchmarks
      (institution_id, admission_session, benchmark_type, benchmark_label, benchmark_value, score_scale_min, score_scale_max)
    values ('${INST_A}', '2026/2027', 'programme_utme_minimum', 'Impossible 250 of 100', 250, 0, 100)
  `, 'a 250 value cannot live on a 0-100 scale');
  assert.match(offScale, /institution_admission_benchmarks_scale_value/);

  await db.exec(`
    insert into public.institution_admission_benchmarks
      (institution_id, admission_session, benchmark_type, benchmark_label, benchmark_value, score_scale_min, score_scale_max)
    values ('${INST_A}', '2026/2027', 'institution_utme_eligibility', 'UTME threshold', 180, 0, 400);
  `);
});

test('a national minimum can never be attached to a single programme', async () => {
  const message = await rejects('service_role', null, `
    insert into public.institution_admission_benchmarks
      (institution_id, programme_offering_id, admission_session, benchmark_type, benchmark_label, benchmark_value, score_scale_max)
    values ('${INST_A}', '${OFFERING_A}', '2026/2027', 'national_minimum', 'JAMB national minimum', 140, 400)
  `, 'a national minimum with a programme id must be rejected');
  assert.match(message, /institution_admission_benchmarks_national_minimum_scope/);
});

test('one current holder per office, and only one', async () => {
  await db.exec(`
    insert into public.institution_leadership (institution_id, office_key, office_title, full_name, is_current, verification_status)
    values ('${INST_A}', 'vice_chancellor', 'Vice-Chancellor', 'Professor Synthetic One', true, 'verified');
  `);
  await rejects('service_role', null, `
    insert into public.institution_leadership (institution_id, office_key, office_title, full_name, is_current)
    values ('${INST_A}', 'vice_chancellor', 'Vice-Chancellor', 'Professor Synthetic Two', true)
  `, 'a second current Vice-Chancellor must be rejected');
});

test('programme offerings are unique by name and session within an institution', async () => {
  await rejects('service_role', null, `
    insert into public.institution_programme_offerings
      (institution_id, programme_name, admission_session, publication_status, verification_status)
    values ('${INST_A}', 'civil engineering', '2026/2027', 'published', 'verified')
  `, 'the same programme cannot be offered twice in one session');
});

test('a student reads and writes only their own admission goal', async () => {
  await as('authenticated', STUDENT, async () => {
    await db.exec(`
      insert into public.student_admission_goals
        (student_id, institution_id, programme_offering_id, target_exam, entry_mode, admission_session, student_target_utme_score)
      values ('${STUDENT}', '${INST_A}', '${OFFERING_A}', 'JAMB_UTME', 'UTME', '2026/2027', 250);
    `);
  });
  await as('authenticated', STUDENT, async () => {
    const { rows } = await db.query('select student_id from public.student_admission_goals');
    assert.equal(rows.length, 1, 'the owner sees their goal');
  });
  await as('authenticated', OTHER, async () => {
    const { rows } = await db.query('select student_id from public.student_admission_goals');
    assert.equal(rows.length, 0, 'another student sees nothing');
  });
  await rejects('authenticated', OTHER, `
    insert into public.student_admission_goals
      (student_id, institution_id, programme_offering_id, target_exam, entry_mode, admission_session)
    values ('${STUDENT}', '${INST_A}', '${OFFERING_A}', 'JAMB_UTME', 'UTME', '2026/2027')
  `, 'a student cannot create a goal for somebody else');
});

test('a goal attempt must belong to the same owner as the goal', async () => {
  const exam = '66666666-6666-4666-8666-666666666666';
  const attempt = '77777777-7777-4777-8777-777777777777';
  await db.exec(`
    insert into public.cbt_exams (id, title, exam_body, subject, description, duration_minutes, is_active)
    values ('${exam}', 'Synthetic JAMB drill', 'JAMB', 'Mathematics', 'fixture', 30, true);
    insert into public.cbt_attempts (id, user_id, exam_id, status, total_questions, score)
    values ('${attempt}', '${STUDENT}', '${exam}', 'submitted', 40, 62.5);
  `);
  const message = await rejects('service_role', null, `
    insert into public.student_admission_goal_attempts (goal_id, student_id, attempt_id, match_status)
    select id, '${OTHER}', '${attempt}', 'matched' from public.student_admission_goals where student_id = '${STUDENT}'
  `, 'the composite foreign key must refuse a goal/attempt owner mismatch');
  assert.match(message, /foreign key|violates/i);

  await db.exec(`
    insert into public.student_admission_goal_attempts (goal_id, student_id, attempt_id, match_status, practice_score, practice_score_scale)
    select id, '${STUDENT}', '${attempt}', 'matched', 62.5, 100 from public.student_admission_goals where student_id = '${STUDENT}';
  `);
  await as('authenticated', OTHER, async () => {
    const { rows } = await db.query('select * from public.student_admission_goal_attempts');
    assert.equal(rows.length, 0, 'linked attempts are owner-scoped');
  });
});

test('a projection cannot be stored without a named model', async () => {
  const secondAttempt = '88888888-8888-4888-8888-888888888888';
  await db.exec(`
    insert into public.cbt_attempts (id, user_id, exam_id, status, total_questions, score)
    values ('${secondAttempt}', '${STUDENT}', '66666666-6666-4666-8666-666666666666', 'submitted', 40, 55);
  `);
  const message = await rejects('service_role', null, `
    insert into public.student_admission_goal_attempts (goal_id, student_id, attempt_id, match_status, projection_value)
    select id, '${STUDENT}', '${secondAttempt}', 'matched', 268 from public.student_admission_goals where student_id = '${STUDENT}'
  `, 'a projection value without a model identifier must be refused');
  assert.match(message, /student_admission_goal_attempts_projection_requires_model/);

  await db.exec(`
    insert into public.student_admission_goal_attempts (goal_id, student_id, attempt_id, match_status, projection_model, projection_value)
    select id, '${STUDENT}', '${secondAttempt}', 'matched', 'documented-model-v1', 268 from public.student_admission_goals where student_id = '${STUDENT}';
  `);
});

test('the completeness view counts only reviewed rows', async () => {
  const { rows } = await db.query<{ school_name: string; profile_status: string | null; published_offerings: number; facts_awaiting_review: number }>(
    'select school_name, profile_status, published_offerings, facts_awaiting_review from public.institution_intelligence_completeness order by school_name',
  );
  assert.equal(rows.length, 2, 'every institution appears, researched or not');
  assert.deepEqual(rows[0], {
    school_name: 'Synthetic University A',
    profile_status: 'verified',
    published_offerings: 1,
    facts_awaiting_review: 1,
  });
  assert.equal(rows[1].published_offerings, 1);
});

test('the research tables never accept a fact without a source URL', async () => {
  const message = await rejects('service_role', null, `
    insert into public.institution_fact_evidence (institution_id, entity_type, field_key)
    values ('${INST_A}', 'profile', 'mission')
  `, 'evidence requires a source URL');
  assert.match(message, /null value|not-null/i);
});
