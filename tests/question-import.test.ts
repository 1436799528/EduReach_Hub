import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// IMP-1: the import pipeline's database half. The extractor is covered by
// question-extract.test.ts; this file proves the review state machine:
//   queued -> processing -> extracted -> (approved items) -> exam_questions
// and that extraction alone never writes to a student-facing bank.

let db: PGlite;
let examId: string;
let examTitle: string;

const hash = (character: string) => character.repeat(64);

async function createImport(input: {
  subject?: string;
  checksum?: string;
  verified?: boolean;
  year?: number | null;
} = {}): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.question_imports(
       exam_id, exam_body, subject, paper_year, source_name, source_verified,
       original_filename, mime_type, file_bytes, checksum, storage_path
     ) values ($1, 'WAEC', $2, $3, $4, $5, 'paper.pdf', 'application/pdf', 1200, $6, $7)
     returning id`,
    [
      examId,
      input.subject || 'Mathematics',
      input.year === undefined ? 2024 : input.year,
      input.verified ? 'West African Examinations Council' : null,
      input.verified === true,
      input.checksum || hash('a'),
      `past-questions/waec/2024/mathematics/${randomUUID()}-paper.pdf`,
    ],
  );
  return rows[0].id;
}

type StagedItem = {
  sourceIndex: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctOption: string | null;
  explanation: string | null;
  passage: string | null;
  topic: string | null;
  rawText: string | null;
  issues: string[];
  duplicateOf: string | null;
};

function item(index: number, overrides: Partial<StagedItem> = {}): StagedItem {
  return {
    sourceIndex: index,
    questionText: `Question number ${index}?`,
    optionA: 'One',
    optionB: 'Two',
    optionC: 'Three',
    optionD: 'Four',
    optionE: null,
    correctOption: 'B',
    explanation: null,
    passage: null,
    topic: null,
    rawText: null,
    issues: [],
    duplicateOf: null,
    ...overrides,
  };
}

async function claim(importId: string): Promise<{ status: string; attempts: number } | null> {
  // One call, one claim: asking the function twice in the same statement would
  // make the second call observe the row it just claimed.
  const { rows } = await db.query<{ id: string | null; status: string | null; attempts: number | null }>(
    'select * from public.claim_question_import($1)',
    [importId],
  );
  const row = rows[0];
  return row?.id ? { status: String(row.status), attempts: Number(row.attempts) } : null;
}

async function finish(importId: string, items: StagedItem[]) {
  await db.query('select public.finish_question_import($1, $2::jsonb, $3::text[])', [
    importId,
    JSON.stringify(items),
    [],
  ]);
}

type CommitResult = { inserted: number; duplicates: number; incomplete: number; remaining: number };

async function commit(importId: string): Promise<CommitResult> {
  const { rows } = await db.query<{ result: CommitResult }>(
    'select public.commit_question_import($1) as result',
    [importId],
  );
  return rows[0].result;
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  const { rows } = await db.query<{ id: string; title: string }>(
    `insert into public.cbt_exams (title, exam_body, subject, is_active)
     values ('WAEC 2024', 'WAEC', 'General', true)
     returning id, title`,
  );
  examId = rows[0].id;
  examTitle = rows[0].title;
});

after(async () => {
  await db.close();
});

test('a queued file is claimed once, extracted into staging, and saved only after approval', async () => {
  const importId = await createImport();
  const first = await claim(importId);
  assert.equal(first?.status, 'processing');
  assert.equal(first?.attempts, 1);
  assert.equal(await claim(importId), null, 'a second worker must not claim a job already processing');

  await finish(importId, [
    item(1),
    item(2, { correctOption: null }),
    item(3, { optionE: 'Five' }),
  ]);

  const { rows: staged } = await db.query<{ status: string; item_count: number }>(
    'select status, item_count from public.question_imports where id = $1',
    [importId],
  );
  assert.equal(staged[0].status, 'extracted');
  assert.equal(staged[0].item_count, 3);

  // Extraction alone leaves the live bank untouched.
  const { rows: beforeCommit } = await db.query<{ n: number }>(
    'select count(*)::int as n from public.exam_questions where exam_id = $1',
    [examId],
  );
  assert.equal(beforeCommit[0].n, 0);

  // Approving a question with no answer key is not enough to save it.
  await db.query("update public.question_import_items set review_status = 'approved' where import_id = $1", [importId]);
  const partial = await commit(importId);
  assert.equal(partial.inserted, 1);
  assert.equal(partial.incomplete, 2);

  // Correct the two incomplete rows and save again: the first question is not
  // inserted twice, the other two are added in the order they were reviewed.
  await db.query(
    `update public.question_import_items
     set correct_option = 'B', option_e = null
     where import_id = $1 and source_index in (2, 3)`,
    [importId],
  );
  const rest = await commit(importId);
  assert.equal(rest.inserted, 2);
  assert.equal(rest.duplicates, 0);
  assert.equal(rest.remaining, 0);

  const again = await commit(importId);
  assert.equal(again.inserted, 0, 'saving the same import twice must not duplicate questions');

  const { rows: saved } = await db.query<{
    position: number; subject: string; review_status: string; source_type: string; correct_option: string; import_id: string | null;
  }>(
    `select position, subject, review_status, source_type, correct_option, import_id
     from public.exam_questions where exam_id = $1 order by position`,
    [examId],
  );
  assert.deepEqual(saved.map((row) => row.position), [1, 2, 3]);
  assert.ok(saved.every((row) => row.subject === 'Mathematics'));
  assert.ok(saved.every((row) => row.review_status === 'approved'));
  assert.ok(saved.every((row) => row.source_type === 'unverified'));
  assert.ok(saved.every((row) => row.import_id === importId), 'every saved question points back to its source file');
  assert.deepEqual(saved.map((row) => row.correct_option), ['B', 'B', 'B']);

  const { rows: status } = await db.query<{ status: string; imported_count: number }>(
    'select status, imported_count from public.question_imports where id = $1',
    [importId],
  );
  assert.equal(status[0].status, 'completed');
  assert.equal(status[0].imported_count, 3);

  // The setup screen counts subjects through cbt_subject_availability, and a
  // paper is served through get_cbt_questions_for_subjects. Both must see the
  // saved rows without any further deployment or cache refresh.
  const { rows: availability } = await db.query<{ subject: string; question_count: number }>(
    'select subject, question_count from public.cbt_subject_availability($1)',
    [examId],
  );
  const mathematics = availability.find((row) => row.subject === 'Mathematics');
  assert.equal(mathematics?.question_count, 3);

  const { rows: paper } = await db.query<{ question_text: string }>(
    'select question_text from public.get_cbt_questions_for_subjects($1, $2)',
    [examId, ['Mathematics']],
  );
  assert.equal(paper.length, 3);
  assert.ok(paper.every((row) => row.question_text.startsWith('Question number')));
});

test('an exact duplicate of a bank question is skipped and marked, not added again', async () => {
  const importId = await createImport({ checksum: hash('b') });
  await claim(importId);
  await finish(importId, [item(1, { questionText: '  QUESTION   number 1? ' })]);
  await db.query("update public.question_import_items set review_status = 'approved' where import_id = $1", [importId]);

  const result = await commit(importId);
  assert.equal(result.inserted, 0);
  assert.equal(result.duplicates, 1);

  const { rows } = await db.query<{ review_status: string; issues: string[]; question_id: string | null }>(
    'select review_status, issues, question_id from public.question_import_items where import_id = $1',
    [importId],
  );
  assert.equal(rows[0].review_status, 'rejected');
  assert.equal(rows[0].question_id, null);
  assert.match(rows[0].issues.join(' '), /identical question already exists/i);
});

test('a verified source is recorded as an official past question with its year', async () => {
  const importId = await createImport({ subject: 'Physics', checksum: hash('c'), verified: true, year: 2019 });
  await claim(importId);
  await finish(importId, [item(1, { questionText: 'A verified past question about force?' })]);
  await db.query("update public.question_import_items set review_status = 'approved' where import_id = $1", [importId]);
  assert.equal((await commit(importId)).inserted, 1);

  const { rows } = await db.query<{
    source_type: string; source_name: string; source_year: number; subject: string;
  }>(
    `select source_type, source_name, source_year, subject
     from public.exam_questions where exam_id = $1 and subject = 'Physics'`,
    [examId],
  );
  assert.equal(rows[0].source_type, 'official_past_question');
  assert.equal(rows[0].source_name, 'West African Examinations Council');
  assert.equal(rows[0].source_year, 2019);
  assert.equal(rows[0].subject, 'Physics');
});

test('imports and their staging rows are unreachable with a client role', async () => {
  const { rows } = await db.query<{ anon: boolean; authenticated: boolean; commit: boolean }>(`
    select
      has_table_privilege('anon', 'public.question_imports', 'select') as anon,
      has_table_privilege('authenticated', 'public.question_import_items', 'select') as authenticated,
      has_function_privilege('authenticated', 'public.commit_question_import(uuid)', 'execute') as commit
  `);
  assert.equal(rows[0].anon, false);
  assert.equal(rows[0].authenticated, false);
  assert.equal(rows[0].commit, false);
});

test('a retry cannot re-extract an import that already reached the bank', async () => {
  const { rows } = await db.query<{ id: string }>(
    `select id from public.question_imports where imported_count > 0 limit 1`,
  );
  await assert.rejects(
    () => finish(rows[0].id, [item(1)]),
    /not being processed/i,
    'finish must refuse a job that is not in processing state',
  );
});

test('only the failure path is retryable, and it keeps the same import row', async () => {
  const importId = await createImport({ checksum: hash('f') });
  await claim(importId);
  await db.query('select public.fail_question_import($1, $2)', [importId, 'The archive was damaged.']);

  const { rows: failed } = await db.query<{ status: string; extraction_error: string; item_count: number }>(
    'select status, extraction_error, item_count from public.question_imports where id = $1',
    [importId],
  );
  assert.equal(failed[0].status, 'failed');
  assert.match(failed[0].extraction_error, /damaged/);
  assert.equal(failed[0].item_count, 0);

  const { rows: created } = await db.query<{ id: string }>(
    `insert into public.question_imports(
       exam_id, exam_body, subject, original_filename, mime_type, file_bytes, checksum, storage_path
     ) values ($1, 'WAEC', 'Mathematics', 'paper.pdf', 'application/pdf', 1200, $2, $3)
     returning id`,
    [examId, hash('f'), `past-questions/waec/undated/mathematics/${randomUUID()}-paper.pdf`],
  ).catch((error) => {
    assert.match(String(error?.message), /duplicate key|unique/i);
    return { rows: [] as Array<{ id: string }> };
  });
  assert.equal(created.length, 0, 'the failed import keeps its checksum lock until it is retried or deleted');
});

test('the attempt cap stops automatic retries from looping forever', async () => {
  // A checksum that cannot collide with the other cases in this file.
  const uniqueChecksum = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const importId = await createImport({ checksum: uniqueChecksum });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    assert.equal((await claim(importId))?.attempts, attempt);
    await db.query('select public.fail_question_import($1, $2)', [importId, 'Extraction failed.']);
  }
  assert.equal(await claim(importId), null, 'a sixth automatic attempt must be refused');
});

test('the audit trail ties saved questions to the imported paper', async () => {
  const { rows } = await db.query<{ exam_title: string; n: number }>(
    `select e.title as exam_title, count(*)::int as n
     from public.exam_questions q
     join public.cbt_exams e on e.id = q.exam_id
     where q.import_id is not null
     group by e.title`,
  );
  assert.equal(rows[0].exam_title, examTitle);
  assert.equal(rows[0].n, 4);
});

test('an extraction that fails on size leaves no staged rows and no bank rows', async () => {
  // The archive budget aborts the whole extraction (see tests/zip-bounds.test.ts:
  // a nested `too_large` is fatal, not a per-file warning). This is the database
  // half of that promise: the import must end up failed with nothing staged, and
  // the student-facing bank must be exactly as it was. A partial paper that looks
  // complete is the failure mode being ruled out.
  const before = await db.query<{ n: number }>(
    'select count(*)::int as n from public.exam_questions where exam_id = $1',
    [examId],
  );
  const importId = await createImport({ checksum: hash('9') });
  await claim(importId);
  await db.query('select public.fail_question_import($1, $2)', [
    importId,
    'The archive expands beyond the 20 MB file / 80 MB total limit. Split it into smaller uploads.',
  ]);

  const { rows: importRow } = await db.query<{ status: string; item_count: number }>(
    'select status, item_count from public.question_imports where id = $1',
    [importId],
  );
  assert.equal(importRow[0].status, 'failed');
  assert.equal(importRow[0].item_count, 0);

  const { rows: staged } = await db.query<{ n: number }>(
    'select count(*)::int as n from public.question_import_items where import_id = $1',
    [importId],
  );
  assert.equal(staged[0].n, 0, 'a failed extraction must stage nothing');

  const after = await db.query<{ n: number }>(
    'select count(*)::int as n from public.exam_questions where exam_id = $1',
    [examId],
  );
  assert.equal(after.rows[0].n, before.rows[0].n, 'a failed extraction must not add or remove bank questions');
});
