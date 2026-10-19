import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  ExtractionError,
  extractQuestions,
  extensionOf,
  isSupportedUpload,
} from '../src/server/question-import/extract';
import { validateItem } from '../src/server/question-import/validate';

// EXT-1: the extractor turns common question-paper formats into candidate
// questions. These tests use the real parsers (pdf-parse, JSZip, the OOXML
// reader) and the fixture in tests/fixtures, not a mocked response, because the
// failures worth catching here are file-format failures.

const FIXTURES = join(import.meta.dirname, 'fixtures');
const prose = `JAMB 2024 Mathematics
Page 1

1. If 2x + 3 = 11, what is x?
A. 3
B. 4
C. 5
D. 6
Answer: B

2. Simplify 3/4 + 1/4
A. 1/2
B. 3/4
C. 1
D. 2
`;

async function docxBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:r><w:t>1. What is the value of 5 x 6?</w:t></w:r></w:p>
      <w:p><w:r><w:t>A. 11</w:t></w:r></w:p>
      <w:p><w:r><w:t>B. 30</w:t></w:r></w:p>
      <w:p><w:r><w:t>C. 25</w:t></w:r></w:p>
      <w:p><w:r><w:t>D. 56</w:t></w:r></w:p>
      <w:p><w:r><w:t>Answer: B</w:t></w:r></w:p>
    </w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

async function xlsxBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  const strings = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'What is 9 - 4?', '3', '4', '5', '6', 'C'];
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((value) => `<si><t>${value}</t></si>`).join('')}</sst>`);
  const cells = (row: number, offset: number) => ['A', 'B', 'C', 'D', 'E', 'F']
    .map((column, index) => `<c r="${column}${row}" t="s"><v>${index + offset}</v></c>`)
    .join('');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells(1, 0)}</row><row r="2">${cells(2, 6)}</row></sheetData></worksheet>`);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

test('detects supported formats and rejects unknown extensions', () => {
  assert.equal(extensionOf('paper.PDF'), '.pdf');
  assert.equal(extensionOf('/tmp/a.b/Questions.DocX'), '.docx');
  assert.equal(isSupportedUpload('paper.csv'), true);
  assert.equal(isSupportedUpload('paper.doc'), false);
});

test('reads numbered questions, options and an inline answer from text', async () => {
  const result = await extractQuestions(Buffer.from(prose), 'maths.txt');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].questionText, 'If 2x + 3 = 11, what is x?');
  assert.deepEqual(
    [result.items[0].optionA, result.items[0].optionB, result.items[0].optionC, result.items[0].optionD],
    ['3', '4', '5', '6'],
  );
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[1].correctOption, null);
});

test('reads an answer key printed once at the end of the paper', async () => {
  const paper = `1. Which planet is closest to the sun?
A. Venus
B. Mercury
C. Earth
D. Mars

2. What gas do plants absorb?
A. Oxygen
B. Nitrogen
C. Carbon dioxide
D. Hydrogen

1. B 2. C
`;
  const result = await extractQuestions(Buffer.from(paper), 'science.txt');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[1].correctOption, 'C');
});

test('reads options written on one line', async () => {
  const paper = '1. Which is a prime number? A. 4 B. 6 C. 7 D. 9\n';
  const result = await extractQuestions(Buffer.from(paper), 'prime.txt');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].optionB, '6');
  assert.equal(result.items[0].optionC, '7');
});

test('attaches a passage to the questions that follow it', async () => {
  const paper = `Passage
The market opened at dawn and closed before noon.

Questions 1-2 refer to the passage above.

1. When did the market open?
A. At noon
B. At dawn
C. At dusk
D. At midnight
Answer: B

2. When did it close?
A. Before noon
B. At dawn
C. After dark
D. At midnight
Answer: A
`;
  const result = await extractQuestions(Buffer.from(paper), 'comprehension.txt');
  assert.equal(result.items.length, 2);
  assert.match(result.items[0].passage || '', /market opened at dawn/);
  assert.match(result.items[1].passage || '', /market opened at dawn/);
});

test('reads a CSV with a header row', async () => {
  const csv = 'Question,Option A,Option B,Option C,Option D,Answer,Explanation\nWhat is 2+2?,3,4,5,6,B,Basic addition\nWhich is prime?,4,6,7,8,C,7 has two factors\n';
  const result = await extractQuestions(Buffer.from(csv), 'questions.csv');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].optionB, '4');
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[0].explanation, 'Basic addition');
  assert.equal(result.items[1].correctOption, 'C');
});

test('reads TSV exported from a spreadsheet', async () => {
  const tsv = 'Question\tA\tB\tC\tD\tAnswer\nCapital of Nigeria?\tLagos\tAbuja\tKano\tIbadan\tB\n';
  const result = await extractQuestions(Buffer.from(tsv), 'questions.tsv');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].questionText, 'Capital of Nigeria?');
  assert.equal(result.items[0].correctOption, 'B');
});

test('reads structured JSON, including an answer written as option text', async () => {
  const payload = JSON.stringify({
    questions: [
      { question: 'Capital of Nigeria?', options: ['Lagos', 'Abuja', 'Kano', 'Ibadan'], answer: 'Abuja' },
      { questionText: 'What is 10 / 2?', options: ['2', '4', '5', '10'], correctOption: 'C', topic: 'Division' },
    ],
  });
  const result = await extractQuestions(Buffer.from(payload), 'questions.json');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[1].correctOption, 'C');
  assert.equal(result.items[1].topic, 'Division');
});

test('reads a Word document and ignores headers that live outside document.xml', async () => {
  const result = await extractQuestions(await docxBuffer(), 'questions.docx');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].optionB, '30');
  assert.equal(result.items[0].correctOption, 'B');
});

test('reads an Excel workbook through its shared strings', async () => {
  const result = await extractQuestions(await xlsxBuffer(), 'questions.xlsx');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].questionText, 'What is 9 - 4?');
  assert.equal(result.items[0].optionD, '6');
  assert.equal(result.items[0].correctOption, 'C');
});

test('reads a text-layer PDF', async () => {
  const result = await extractQuestions(readFileSync(join(FIXTURES, 'sample-questions.pdf')), 'sample-questions.pdf');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].questionText, 'What is 8 + 5?');
  assert.equal(result.items[0].correctOption, 'B');
});

test('rejects a scanned PDF instead of returning empty questions silently', async () => {
  await assert.rejects(
    () => extractQuestions(readFileSync(join(FIXTURES, 'no-text-layer.pdf')), 'scan.pdf'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'ocr_required',
  );
});

test('reads supported files inside a ZIP and reports the files it skipped', async () => {
  const zip = new JSZip();
  zip.file('one.txt', '1. What is 1 + 1?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B\n');
  zip.file('two.txt', '1. What is 2 + 2?\nA. 2\nB. 3\nC. 4\nD. 5\nAnswer: C\n');
  zip.file('notes.doc', 'legacy');
  const result = await extractQuestions(Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })), 'paper.zip');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[1].correctOption, 'C');
  assert.ok(result.warnings.some((warning) => warning.includes('notes.doc')));
});

test('legacy Word and image uploads get an explanation, not a silent failure', async () => {
  await assert.rejects(
    () => extractQuestions(Buffer.from('legacy'), 'paper.doc'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'unsupported' && /docx/.test(error.message),
  );
  await assert.rejects(
    () => extractQuestions(Buffer.from('image'), 'paper.png'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'unsupported' && /OCR/.test(error.message),
  );
});

test('a damaged archive is reported as corrupt', async () => {
  await assert.rejects(
    () => extractQuestions(Buffer.from('not a zip'), 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'corrupt',
  );
});

test('validation blocks missing answers, missing options and a fifth option', () => {
  const base = {
    questionText: 'What is 2 + 2?',
    optionA: '3', optionB: '4', optionC: '5', optionD: '6',
    correctOption: 'B',
  };
  assert.deepEqual(validateItem(base).blocking, []);
  assert.match(validateItem({ ...base, correctOption: null }).blocking.join(' '), /answer key/i);
  assert.match(validateItem({ ...base, optionD: '' }).blocking.join(' '), /four answer options/i);
  assert.match(validateItem({ ...base, optionE: '7' }).blocking.join(' '), /five options/i);
  assert.match(validateItem({ ...base, optionC: '4' }).blocking.join(' '), /same text/i);
  assert.match(validateItem({ ...base, questionText: 'Hi' }).blocking.join(' '), /too short/i);
});
