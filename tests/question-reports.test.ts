import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  QUESTION_REPORT_CATEGORIES,
  QUESTION_REPORT_DETAIL_MAX,
  QUESTION_REPORT_STATUSES,
  cleanReportDetail,
  isQuestionReportCategory,
  isQuestionReportStatus,
} from '../src/server/questionReports';

// Working guide 5.3 Step I (report a problem, triage queue, auto-flag) and 5.7
// (report from the review screen). These tests cover the rules; the SQL contract
// below covers what the database will accept.

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

test('only the four documented categories are accepted', () => {
  assert.deepEqual([...QUESTION_REPORT_CATEGORIES], ['wrong_answer', 'typo', 'image', 'other']);
  for (const value of QUESTION_REPORT_CATEGORIES) assert.equal(isQuestionReportCategory(value), true);
  // Anything a client might send that is not one of them is refused, including
  // the shapes that look truthy but are not a category.
  for (const value of ['', 'WRONG_ANSWER', 'wrong answer', null, undefined, 0, 1, true, {}, [], ['typo']]) {
    assert.equal(isQuestionReportCategory(value), false, `${JSON.stringify(value)} must be refused`);
  }
});

test('triage may only move a report to triaged, resolved or dismissed', () => {
  assert.deepEqual([...QUESTION_REPORT_STATUSES], ['triaged', 'resolved', 'dismissed']);
  assert.equal(isQuestionReportStatus('open'), false, 'open is the default, not a triage destination');
  assert.equal(isQuestionReportStatus('closed'), false);
  for (const value of QUESTION_REPORT_STATUSES) assert.equal(isQuestionReportStatus(value), true);
});

test('a note is optional, tidied and capped', () => {
  assert.equal(cleanReportDetail(undefined), null);
  assert.equal(cleanReportDetail(null), null);
  assert.equal(cleanReportDetail(''), null);
  assert.equal(cleanReportDetail('   \n\t  '), null, 'whitespace is not a written note');
  assert.equal(cleanReportDetail('  Option B is correct\n\nbut  A is marked.  '), 'Option B is correct but A is marked.');
  // Control characters would corrupt a log line or a CSV export of the queue.
  assert.equal(cleanReportDetail('line\u0000one\u0007two'), 'line one two');
  const capped = cleanReportDetail('a'.repeat(QUESTION_REPORT_DETAIL_MAX + 200));
  assert.equal(typeof capped === 'string' ? capped.length : -1, QUESTION_REPORT_DETAIL_MAX);
});

test('a malformed note is refused rather than coerced', () => {
  for (const value of [{}, [], ['wrong answer'], 42, true]) {
    assert.equal(cleanReportDetail(value), 'invalid', `${JSON.stringify(value)} must be invalid`);
  }
});

test('the database enforces the same rules as the API', () => {
  const sql = read('supabase/migrations/20261119130000_question_reports.sql');

  // The table, its foreign keys and the category/status vocabularies.
  assert.match(sql, /create table if not exists public\.question_reports/);
  assert.match(sql, /references public\.exam_questions\(id\) on delete cascade/);
  assert.match(sql, /references public\.cbt_attempts\(id\) on delete set null/);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /check \(category in \('wrong_answer', 'typo', 'image', 'other'\)\)/);
  assert.match(sql, /check \(status in \('open', 'triaged', 'resolved', 'dismissed'\)\)/);
  assert.match(sql, /char_length\(btrim\(detail\)\) between 1 and 500/);

  // One complaint per student per question per category, and a dismissed report
  // may be filed again.
  assert.match(sql, /create unique index if not exists question_reports_one_per_student/);
  assert.match(sql, /where status <> 'dismissed'/);

  // The flag is advisory and is recomputed from the reports, not incremented.
  assert.match(sql, /add column if not exists open_report_count integer not null default 0/);
  assert.match(sql, /add column if not exists report_flagged_at timestamptz/);
  assert.match(sql, /when v_open >= 3 then coalesce\(report_flagged_at, now\(\)\)/);
  assert.doesNotMatch(sql, /open_report_count = open_report_count \+ 1/, 'a counter that only ever grows cannot be corrected');
});

test('row level security: the student owns the report and cannot triage it', () => {
  const sql = read('supabase/migrations/20261119130000_question_reports.sql');

  assert.match(sql, /alter table public\.question_reports enable row level security/);
  assert.match(sql, /for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /for insert to authenticated\s+with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql, /for update to authenticated/, 'a student must not edit a filed report');
  assert.doesNotMatch(sql, /for delete to authenticated/, 'a student must not erase a filed report');
  assert.doesNotMatch(sql, /to anon/, 'an anonymous caller has no business filing or reading reports');
  // The counter columns are a way to hide or clear a flagged question, so they
  // are not writable by the student role.
  assert.match(sql, /revoke update \(open_report_count, report_flagged_at\) on public\.exam_questions from authenticated/);
});

test('the report route checks ownership before it writes', () => {
  const server = read('server.ts');

  // Student endpoint: authenticated, rate limited, and the question must be in
  // one of this student's frozen papers.
  assert.match(server, /app\.post\('\/api\/cbt\/questions\/:questionId\/report', rateLimitFor\(RATE_LIMIT_RULES\.cbtReport\)/);
  assert.match(server, /\.contains\('question_ids', \[req\.params\.questionId\]\)/);
  assert.match(server, /if \(!attempts\?\.length\) return res\.status\(404\)/);

  // A repeat is not an error: the unique index raises 23505 and the route says
  // already reported, so the control can stay quiet.
  assert.match(server, /if \(insertError\.code === '23505'\) return res\.status\(200\)\.json\(\{ status: 'already_reported' \}\)/);

  // Triage is admin-only and audited.
  assert.match(server, /app\.get\('\/api\/admin\/question-reports', requireCapability\('cbt\.read'\)/);
  assert.match(server, /app\.patch\('\/api\/admin\/question-reports\/:reportId', requireCapability\('cbt\.manage'\)/);
  assert.match(server, /action: 'question_report_' \+ status/);
  assert.match(server, /resourceType: 'question_report'/);
});

test('the review screen only offers the control, not a second source of truth', () => {
  const page = read('pages/CbtResultsPage.tsx');
  const api = read('src/lib/api.ts');

  assert.match(page, /<ReportQuestionControl questionId=\{question\.id\} \/>/);
  assert.match(api, /export async function reportCbtQuestion/);
  assert.match(api, /\/api\/cbt\/questions\/\$\{encodeURIComponent\(questionId\)\}\/report/);
  // The client refuses an id that is not a UUID before it bothers the server.
  assert.match(api, /if \(!CBT_UUID\.test\(questionId\)\) throw new Error\('That question cannot be reported\.'\)/);
});
