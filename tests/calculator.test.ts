import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateExpression, formatCalcResult } from '../src/lib/calc-engine';

const cases: Array<[string, number]> = [
  ['2+3*4', 14], ['2^3^2', 512], ['2(3+1)', 8], ['(2)(3)', 6],
  ['-2^2', -4], ['(-2)^2', 4], ['2^-2', 0.25], ['2^--2', 4],
  ['2*-3', -6], ['3--2', 5], ['sin(30)', 0.5], ['sin(30)^2', 0.25],
  ['2^sqrt(9)', 8], ['sqrt(9)+1', 4], ['3sin 30', 1.5], ['cos(60)', 0.5],
  ['log(100)', 2], ['ln(e)', 1], ['5!', 120], ['0!', 1], ['15%', 0.15],
  ['3²', 9], ['2π', 2 * Math.PI], ['√(9', 3], ['2×3−4÷2', 4],
];
for (const [expression, expected] of cases) {
  test(`calculator: ${expression}`, () => {
    assert.ok(Math.abs(evaluateExpression(expression) - expected) < 1e-10);
  });
}
for (const expression of ['', '1/0', 'sqrt(-1)', '171!', '(-2)!', '1..2', '2+', '2)', 'alert(1)', '2**3']) {
  test(`calculator rejects ${JSON.stringify(expression)}`, () => assert.throws(() => evaluateExpression(expression)));
}
test('calculator supports RAD mode, previous answer and display precision', () => {
  assert.equal(evaluateExpression('sin(pi/2)', { mode: 'RAD' }), 1);
  assert.equal(evaluateExpression('Ans+2', { ans: 7 }), 9);
  assert.equal(formatCalcResult(0.1 + 0.2), '0.3');
  assert.equal(formatCalcResult(Infinity), 'Math error');
});
