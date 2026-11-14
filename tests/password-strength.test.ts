import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectPassword } from '../src/lib/passwordStrength';

test('password guidance names the missing requirement instead of only saying weak', () => {
  assert.equal(inspectPassword('').acceptable, false);
  const short = inspectPassword('abc');
  assert.equal(short.requirements.find((item) => item.id === 'length')?.met, false);
  assert.equal(short.requirements.find((item) => item.id === 'case')?.met, false);
  assert.equal(short.acceptable, false);
});

test('a common password is refused even when it is eight characters or longer', () => {
  const common = inspectPassword('Password123');
  assert.equal(common.label, 'Too common');
  assert.equal(common.requirements.find((item) => item.id === 'common')?.met, false);
  assert.equal(common.acceptable, false);
});

test('mixed-case, number and length move the meter without requiring a symbol', () => {
  const good = inspectPassword('EduReach2026');
  assert.equal(good.requirements.find((item) => item.id === 'length')?.met, true);
  assert.equal(good.requirements.find((item) => item.id === 'case')?.met, true);
  assert.equal(good.requirements.find((item) => item.id === 'number')?.met, true);
  assert.equal(good.requirements.find((item) => item.id === 'symbol')?.met, false);
  assert.ok(['Good', 'Strong'].includes(good.label));
  assert.equal(good.acceptable, true);
});

test('a long passphrase reaches the top band', () => {
  const phrase = inspectPassword('correct horse battery staple 42');
  assert.equal(phrase.score, 4);
  assert.equal(phrase.percent, 100);
});
