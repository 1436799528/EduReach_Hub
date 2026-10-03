import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SERVICE_STAGES,
  needsStudentAction,
  serviceStageIndex,
  serviceStatusMeaning,
  serviceTimeline,
} from '../src/lib/serviceLifecycle';

// SERVICE-1: every status the database can store must have an explanation, and
// the one that blocks on the student must be identifiable as such. The coverage
// check parses the real check constraint, so adding a status to the database
// without copy here fails the suite.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function statusesInConstraint(): string[] {
  const sql = readFileSync(join(root, 'supabase/migrations/20260925214000_service_request_statuses.sql'), 'utf8');
  const match = sql.match(/status in \(([^)]+)\)/);
  assert.ok(match, 'the status constraint was not found — the test must not silently pass');
  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

test('every status the database accepts has student-facing copy', () => {
  const stored = statusesInConstraint();
  assert.ok(stored.length >= 8, `expected the full status list, parsed ${stored.length}`);
  for (const status of stored) {
    const stage = serviceStatusMeaning(status);
    assert.equal(stage.status, status, `${status} is described as itself`);
    assert.ok(stage.label.length > 0, `${status} has a label`);
    assert.ok(stage.meaning.length > 20, `${status} has a real explanation, not a placeholder`);
    assert.ok(!/not recorded/.test(stage.meaning), `${status} must be described, not deferred`);
  }
  assert.equal(SERVICE_STAGES.length, stored.length, 'no status is described twice or invented');
  assert.deepEqual([...new Set(SERVICE_STAGES.map((s) => s.status))].sort(), [...stored].sort());
});

test('only a request waiting on the student is treated as their work', () => {
  assert.equal(needsStudentAction('awaiting_information'), true);
  for (const status of ['submitted', 'reviewing', 'processing', 'completed', 'closed', 'rejected', 'cancelled']) {
    assert.equal(needsStudentAction(status), false, `${status} is EduReach's queue, not the student's to-do list`);
  }
});

test('the promise made before submitting is the path that actually happens', () => {
  const timeline = serviceTimeline();
  assert.deepEqual(timeline.map((stage) => stage.status), ['submitted', 'reviewing', 'processing', 'completed']);
  for (const stage of timeline) {
    assert.equal(stage.terminal, stage.status === 'completed', 'only the last step is an ending');
    assert.equal(stage.awaitsStudent, false, 'nothing on the happy path waits on the student silently');
  }
});

test('progress along the path is monotonic and a pause is not a promotion', () => {
  assert.equal(serviceStageIndex('submitted'), 0);
  assert.equal(serviceStageIndex('reviewing'), 1);
  assert.equal(serviceStageIndex('processing'), 2);
  assert.equal(serviceStageIndex('completed'), 4);
  assert.equal(serviceStageIndex('awaiting_information'), 2, 'a pause shows at the step it paused on');
  for (const offPath of ['closed', 'rejected', 'cancelled']) {
    assert.equal(serviceStageIndex(offPath), -1, `${offPath} has left the happy path`);
  }
});

test('an unrecognised status is shown as itself, never as a confident stage', () => {
  const unknown = serviceStatusMeaning('escalated_to_registrar');
  assert.equal(unknown.status, 'escalated_to_registrar');
  assert.match(unknown.meaning, /not recorded a description/);
  assert.equal(unknown.terminal, false, 'an unknown state must not be presented as finished');
  assert.equal(serviceStatusMeaning('').label, 'Unknown');
});

test('the statuses leave no gap that would leave a student without an answer', () => {
  const covered = new Set(SERVICE_STAGES.map((stage) => stage.status));
  for (const status of ['submitted', 'reviewing', 'processing', 'awaiting_information', 'completed', 'closed', 'rejected', 'cancelled']) {
    assert.ok(covered.has(status), `${status} is described`);
  }
});
