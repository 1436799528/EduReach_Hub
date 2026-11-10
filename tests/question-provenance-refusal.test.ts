import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  PROVENANCE_GUARD_DETAIL,
  PROVENANCE_GUARD_MESSAGE,
  PROVENANCE_GUARD_SQLSTATE,
  QUESTION_IMPORT_PROVENANCE_REFUSED,
  QUESTION_PROVENANCE_REFUSED,
  isProvenanceGuardRefusal,
  isProvenanceGuardUnavailable,
  questionImportProvenanceRefusal,
  questionProvenanceRefusal,
} from '../src/server/questionProvenance';

// The refusal classifier must be derived from the candidate SQL, not from a
// guess about PostgreSQL error codes. These tests read the actual guard.
const sql = readFileSync('supabase/candidates/restricted_question_provenance_candidate.sql', 'utf8');

function guardRaise(): string {
  const start = sql.indexOf('raise exception \'This question text already exists');
  assert.ok(start > 0, 'the provenance guard raise statement is missing from the candidate SQL');
  return sql.slice(start, sql.indexOf(';', sql.indexOf('detail', start)));
}

test('the classifier constants match what the candidate SQL actually raises', () => {
  const raise = guardRaise();
  assert.match(raise, /errcode = '42501'/, 'the guard must raise the SQLSTATE the classifier expects');
  assert.ok(PROVENANCE_GUARD_SQLSTATE === '42501');
  assert.match(raise, new RegExp(`detail = '${PROVENANCE_GUARD_DETAIL}'`), 'the guard must carry the machine-readable DETAIL marker');
  const message = /raise exception '([^']+)'/.exec(raise)?.[1];
  assert.equal(message, PROVENANCE_GUARD_MESSAGE, 'the classifier sentence must match the guard sentence exactly');
  // The marker is what makes 42501 unambiguous; the classification gate is a
  // different refusal and must not reuse it.
  const gate = sql.slice(sql.indexOf('Restricted banks require the question provenance guard'));
  const gateRaise = gate.slice(0, gate.indexOf(';'));
  assert.match(gateRaise, /errcode = '42501'/);
  assert.doesNotMatch(gateRaise, new RegExp(`detail = '${PROVENANCE_GUARD_DETAIL}'`));
  assert.match(gateRaise, /detail = 'cbt_question_provenance_guard_missing'/);
});

test('only the provenance guard refusal is classified as such', () => {
  const marker = { code: PROVENANCE_GUARD_SQLSTATE, message: PROVENANCE_GUARD_MESSAGE, details: PROVENANCE_GUARD_DETAIL };
  assert.equal(isProvenanceGuardRefusal(marker), true, 'SQLSTATE + DETAIL');
  assert.equal(isProvenanceGuardRefusal({ code: '42501', message: PROVENANCE_GUARD_MESSAGE }), true, 'SQLSTATE + exact sentence (older servers without DETAIL)');
  assert.equal(isProvenanceGuardRefusal({ details: PROVENANCE_GUARD_DETAIL, message: PROVENANCE_GUARD_MESSAGE }), false, 'a marker without the SQLSTATE is not enough');

  // Everything else keeps its previous handling.
  assert.equal(isProvenanceGuardRefusal({ code: '42501', message: 'Permission denied.' }), false, 'a plain permission denial');
  assert.equal(isProvenanceGuardRefusal({ code: '42501', message: 'A reviewed import cannot move between differently classified banks.' }), false, 'the import bank-move guard');
  assert.equal(isProvenanceGuardRefusal({ code: '42501', message: 'This question bank has not been classified.' }), false, 'an unclassified bank');
  assert.equal(isProvenanceGuardRefusal({ code: '23505', message: 'duplicate key value violates unique constraint "exam_questions_exam_id_position_key"' }), false, 'a unique violation');
  assert.equal(isProvenanceGuardRefusal({ code: 'PGRST202', message: 'Could not find the function public.cbt_question_provenance_ready in the schema cache' }), false, 'a missing candidate schema');
  assert.equal(isProvenanceGuardRefusal(new Error(PROVENANCE_GUARD_MESSAGE)), false, 'an Error has no SQLSTATE');
  assert.equal(isProvenanceGuardRefusal(null), false);
  assert.equal(isProvenanceGuardRefusal(undefined), false);
  assert.equal(isProvenanceGuardRefusal('already exists in a restricted bank'), false);
});

test('a missing provenance schema is identified as unavailable, never as a refusal', () => {
  assert.equal(isProvenanceGuardUnavailable({ code: 'PGRST202', message: 'Could not find the function public.cbt_question_provenance_ready in the schema cache' }), true);
  assert.equal(isProvenanceGuardUnavailable({ code: '42883', message: 'function public.cbt_question_provenance_ready() does not exist' }), true);
  assert.equal(isProvenanceGuardUnavailable({ code: '42P01', message: 'relation "public.cbt_bank_security" does not exist' }), true);
  assert.equal(isProvenanceGuardUnavailable({ code: PROVENANCE_GUARD_SQLSTATE, message: PROVENANCE_GUARD_MESSAGE, details: PROVENANCE_GUARD_DETAIL }), false);
  assert.equal(isProvenanceGuardUnavailable({ code: '23505', message: 'duplicate key value' }), false);
  assert.equal(isProvenanceGuardUnavailable(null), false);
});

test('refusal bodies are stable codes with no database or question detail', () => {
  const refusal = questionProvenanceRefusal();
  assert.deepEqual(Object.keys(refusal).sort(), ['code', 'error']);
  assert.equal(refusal.code, QUESTION_PROVENANCE_REFUSED);
  assert.equal(QUESTION_PROVENANCE_REFUSED, 'question_provenance_refused');
  assert.doesNotMatch(JSON.stringify(refusal), /42501|PGRST|cbt_question_provenance|fingerprint|supabase|duplicate key|schema cache|[0-9a-f]{8}-[0-9a-f]{4}-/i);

  const importRefusal = questionImportProvenanceRefusal();
  assert.deepEqual(Object.keys(importRefusal).sort(), ['code', 'error']);
  assert.equal(importRefusal.code, QUESTION_IMPORT_PROVENANCE_REFUSED);
  assert.equal(QUESTION_IMPORT_PROVENANCE_REFUSED, 'question_import_provenance_refused');
  assert.notEqual(importRefusal.code, refusal.code, 'the two routes must be distinguishable');
  assert.doesNotMatch(JSON.stringify(importRefusal), /42501|PGRST|cbt_question_provenance|fingerprint|supabase|duplicate key|schema cache|[0-9a-f]{8}-[0-9a-f]{4}-/i);
});
