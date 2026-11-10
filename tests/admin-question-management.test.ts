import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { extractQuestions, ExtractionError } from '../src/server/question-import/extract';
import { normaliseItem, validateItem } from '../src/server/question-import/validate';
import { isQuestionId, literalLike, parseQuestionBankFilters } from '../src/server/questionBankList';

test('question-bank list bounds pages and validates filters', () => {
  assert.deepEqual(parseQuestionBankFilters({}), { page: 1, pageSize: 50, search: '', subject: '', topic: '', year: null, review: '' });
  assert.deepEqual(parseQuestionBankFilters({ page: '2', pageSize: '25', search: '  cell ', subject: ' Biology ', topic: 'cells', year: '2024', review: 'approved' }), { page: 2, pageSize: 25, search: 'cell', subject: 'Biology', topic: 'cells', year: 2024, review: 'approved' });
  for (const input of [{ page: '0' }, { pageSize: '101' }, { page: '1.5' }, { year: '2024abc' }, { review: 'published' }, { search: ['a', 'b'] }, { topic: 'a'.repeat(121) }]) assert.throws(() => parseQuestionBankFilters(input));
  assert.equal(literalLike('100%_x*\\'), '%100\\%\\_x\\*\\\\%');
  assert.equal(isQuestionId('a1111111-1111-4111-8111-111111111111'), true);
  assert.equal(isQuestionId('a1111111'), false);
});

test('review edits preserve paragraphs and do not turn invalid input into an answer', () => {
  const input = normaliseItem({ questionText: ' First paragraph.\r\n\r\nSecond paragraph? ', optionA: ' One ', optionB: 'Two', optionC: 'Three', optionD: 'Four', correctOption: ' Banana ' });
  assert.equal(input.questionText, 'First paragraph.\n\nSecond paragraph?');
  assert.equal(input.correctOption, 'BANANA');
  assert.match(validateItem(input).blocking.join(' '), /correct option/i);
});

test('structured answers are accepted only when explicit or uniquely matching', async () => {
  const row = { question: 'Which choice is correct?', options: ['Blue', 'B vitamins', 'Green', 'Red'] };
  const items = await extractQuestions(Buffer.from(JSON.stringify([
    { ...row, answer: 'B vitamins' }, { ...row, answer: 'B unrelated text' },
    { ...row, answer: 'B. B vitamins' }, { ...row, answer: 'B. wrong' },
  ])), 'questions.json');
  assert.deepEqual(items.items.map(item => item.correctOption), ['B', null, 'B', null]);
});

test('a single-letter answer that conflicts with option text stays unresolved', async () => {
  const result = await extractQuestions(Buffer.from(JSON.stringify([{ question: 'Choose the correct option?', options: ['B', 'C', 'D', 'A'], answer: 'B' }])), 'questions.json');
  assert.equal(result.items[0].correctOption, null);
});

test('extra distractors beyond five are refused rather than silently dropped', async () => {
  const inputs = [
    ['questions.json', JSON.stringify([{ question: 'Choose the correct option?', options: ['one', 'two', 'three', 'four', '', 'six'], answer: 'B' }])],
    ['questions.csv', 'question,option a,option b,option c,option d,option f,answer\nA question?,a,b,c,d,f,B'],
    ['bare-headers.csv', 'question,A,B,C,D,E,F,answer\nA question?,one,two,three,four,five,six,B'],
    ['questions.txt', '1. Which answer is correct?\nA. One\nB. Two\nC. Three\nD. Four\nF. Six\nAnswer: B'],
    ['inline.txt', '1. Which is correct? A. One B. Two C. Three D. Four F. Six'],
  ];
  for (const [filename, source] of inputs) await assert.rejects(() => extractQuestions(Buffer.from(source), filename), (error: unknown) => error instanceof ExtractionError && error.code === 'unsupported' && /more than five/i.test(error.message));
});

test('bare Q and A–E headers remain usable without an extra option', async () => {
  const source = 'Q,A,B,C,D,E,answer\nWhich answer is correct?,one,two,three,four,five,B';
  const result = await extractQuestions(Buffer.from(source), 'five.csv');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].optionE, 'five');
  assert.equal(result.items[0].correctOption, 'B');
});

test('unsafe archive paths are refused without extracting files to disk', async () => {
  for (const name of ['../paper.txt', 'folder/../../paper.txt', '/absolute.txt', 'folder\\paper.txt']) {
    const zip = new JSZip();
    zip.file(name, '1. What is 1 + 1?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B');
    const bytes = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    await assert.rejects(() => extractQuestions(bytes, 'papers.zip'), (error: unknown) => error instanceof ExtractionError && error.code === 'corrupt' && /unsafe archive path/.test(error.message));
  }
});
