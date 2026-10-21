import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCgpa, gradesForScale } from '../src/lib/studentDashboard';

test('cgpa: 5.0 scale unchanged (default)', () => {
  const r = calculateCgpa([{ code: 'MTH101', units: 3, grade: 'A' }, { code: 'ENG101', units: 2, grade: 'B' }]);
  assert.equal(r.gpaText, '4.60'); assert.equal(r.totalUnits, 5);
  assert.equal(r.classification, 'First Class Honours'); assert.equal(r.scale, 5);
});
test('cgpa: 4.0 scale does NOT use the 5.0 table', () => {
  const r = calculateCgpa([{ code: 'MTH101', units: 3, grade: 'A' }, { code: 'ENG101', units: 2, grade: 'B' }], 4);
  assert.equal(r.gpaText, '3.60'); // (3*4 + 2*3)/5, not 4.60
  assert.equal(r.classification, 'First Class Honours');
});
test('cgpa: 4.0 classification boundaries differ from 5.0', () => {
  assert.equal(calculateCgpa([{ code: 'X', units: 1, grade: 'B' }], 4).classification, 'Second Class Upper (2:1)'); // 3.00
  assert.equal(calculateCgpa([{ code: 'X', units: 1, grade: 'C' }], 4).classification, 'Second Class Lower (2:2)'); // 2.00
  assert.equal(calculateCgpa([{ code: 'X', units: 1, grade: 'C' }], 5).classification, 'Second Class Lower (2:2)'); // same 3.00 numeric, different band on 5.0
});
test('cgpa: 4.0 offers no E grade; empty input is safe', () => {
  assert.ok(!gradesForScale(4).includes('E')); assert.ok(gradesForScale(5).includes('E'));
  const r = calculateCgpa([], 4); assert.equal(r.gpaText, '0.00'); assert.equal(r.totalUnits, 0);
});
