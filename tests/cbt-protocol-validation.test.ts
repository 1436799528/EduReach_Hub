import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CBT_UUID, validCbtV2Answer, validCbtV2Draft, validCbtV2Revision } from '../src/lib/cbtProtocolValidation';

test('shared CBT validators preserve strict answer, revision, draft and UUID boundaries', () => {
  for (const answer of [0, 1, 2, 3]) assert.equal(validCbtV2Answer(answer), true);
  for (const answer of [null, undefined, '1', -1, 4, 1.1, NaN, Infinity, true, {}, []]) assert.equal(validCbtV2Answer(answer), false);
  for (const revision of [0, 1, Number.MAX_SAFE_INTEGER]) assert.equal(validCbtV2Revision(revision), true);
  for (const revision of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1, '1', null, NaN]) assert.equal(validCbtV2Revision(revision), false);
  for (const draft of [{}, { '1': 0, '20': 3 }]) assert.equal(validCbtV2Draft(draft), true);
  for (const draft of [null, [], { '0': 0 }, { '01': 0 }, { '1': '1' }, { '1': 4 }, { '9007199254740992': 0 }]) assert.equal(validCbtV2Draft(draft), false);
  for (const id of ['a1111111-1111-4111-8111-111111111111', 'A1111111-1111-4111-8111-111111111111']) assert.equal(CBT_UUID.test(id), true);
  for (const id of ['', 'a1111111-1111-4111-8111-11111111111', 'a1111111-1111-4111-8111-111111111111-', 'a1111111-1111-4111-811g-111111111111']) assert.equal(CBT_UUID.test(id), false);
});
