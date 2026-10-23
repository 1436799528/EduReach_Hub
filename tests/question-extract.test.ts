import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import {
  ExtractionError,
  extractQuestions,
  extensionOf,
  isSupportedUpload,
  parseSharedStringsXml,
  readSharedStrings,
  readSheetRows,
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

// ---------------------------------------------------------------------------
// The shared-string table
// ---------------------------------------------------------------------------
//
// A workbook's shared-string table used to be read with `fast-xml-parser`, which
// builds one object per string: a 19 MB table became a 544 MB heap tree, and the
// minimum heap at which a 19 MB workbook could be read at all was 512 MB. The
// table is now read directly (parseSharedStringsXml).
//
// Two things are pinned here. First, the output must still be what the previous
// reader produced — `fast-xml-parser` is kept in the test as the oracle, so a
// future rewrite has to match on every shape below. Second, reading a large
// table must stay cheap: the heap-capped subprocess test fails if a tree parser
// is reintroduced.

/** The previous implementation, kept verbatim as the oracle. */
function referenceSharedStrings(text: string): string[] {
  const decode = (value: string) => value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const parser = new XMLParser({ ignoreAttributes: true, preserveOrder: false, processEntities: true, trimValues: false });
  const parsed = parser.parse(text) as Record<string, any>;
  const list = parsed?.sst?.si;
  if (!list) return [];
  return (Array.isArray(list) ? list : [list]).map((entry: any) => {
    const value = entry?.t;
    if (typeof value === 'string') return decode(value);
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object' && '#text' in value) return decode(String(value['#text']));
    if (entry?.r) {
      const runs = Array.isArray(entry.r) ? entry.r : [entry.r];
      return runs.map((run: any) => decode(String(run?.t?.['#text'] ?? run?.t ?? ''))).join('');
    }
    return '';
  });
}

const SHARED_STRING_SHAPES: Record<string, string> = {
  plain: '<si><t>Hello</t></si>',
  numeric: '<si><t>3</t></si>',
  spaced: '<si><t>  spaced  </t></si>',
  entity: '<si><t>a &amp; b</t></si>',
  doubleEncoded: '<si><t>a &amp;amp; b</t></si>',
  numericEntity: '<si><t>&#65;&#x42;</t></si>',
  richRuns: '<si><r><t>a</t></r><r><t>b</t></r></si>',
  richNumeric: '<si><r><t>3</t></r></si>',
  emptyElement: '<si><t/></si>',
  attrOnT: '<si><t xml:space="preserve"> keep </t></si>',
  phonetic: '<si><rPh sb="0" eb="1"><t>phon</t></rPh><t>real</t></si>',
  runWithProps: '<si><r><rPr><b/></rPr><t>Bold</t></r></si>',
  newline: '<si><t>line1\nline2</t></si>',
  cdata: '<si><t><![CDATA[raw & text]]></t></si>',
  selfClosingMiddle: '<si><t>a</t></si><si/><si><t>b</t></si>',
  emptyPairMiddle: '<si><t>a</t></si><si></si><si><t>b</t></si>',
  attrsOnSi: '<si foo="bar"><t>x</t></si>',
  multiRuns: '<si><r><t>A</t></r><r><t>B</t></r><r><t>C</t></r></si>',
};

test('the shared-string reader matches the parser it replaced', () => {
  for (const [name, body] of Object.entries(SHARED_STRING_SHAPES)) {
    const document = `<sst>${body}</sst>`;
    assert.deepEqual(
      parseSharedStringsXml(document),
      referenceSharedStrings(document),
      `shared-string shape "${name}" changed meaning`,
    );
  }
  // A table with no strings at all.
  assert.deepEqual(parseSharedStringsXml('<sst/>'), referenceSharedStrings('<sst/>'));
});

test('number-like and boolean-like strings keep their text', () => {
  // Deliberate differences from the old reader, which turned "007" into "7" and
  // dropped "true" entirely. Both are text in a question bank and must survive.
  assert.deepEqual(parseSharedStringsXml('<sst><si><t>007</t></si></sst>'), ['007']);
  assert.deepEqual(parseSharedStringsXml('<sst><si><t>true</t></si></sst>'), ['true']);
  // Values that were already correct stay correct.
  assert.deepEqual(parseSharedStringsXml('<sst><si><t>3</t></si></sst>'), ['3']);
  assert.deepEqual(parseSharedStringsXml('<sst><si><t>1.5</t></si></sst>'), ['1.5']);
});

test('a workbook still reads through its shared strings end to end', async () => {
  // The published path, not just the parser: file → strings → cells.
  const zip = new JSZip();
  zip.file('xl/sharedStrings.xml', '<sst><si><t>What is 9 - 4?</t></si><si><t>5</t></si><si><t>6</t></si><si><t>7</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', [
    '<worksheet><sheetData>',
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>',
    '</sheetData></worksheet>',
  ].join(''));
  const values = await readSharedStrings(zip);
  assert.deepEqual(values, ['What is 9 - 4?', '5', '6', '7']);
});

test('a large shared-string table is read without building an object tree', () => {
  // 12 MB of strings — the shape a staff upload can reach within the 20 MB
  // per-part ceiling. With the tree parser this needs ~350 MB of heap; the
  // reader must fit in a 192 MB heap, which is what makes the difference real
  // rather than stylistic.
  const directory = mkdtempSync(join(tmpdir(), 'edureach-ss-'));
  try {
    const script = join(directory, 'read.mjs');
    writeFileSync(script, [
      `import { parseSharedStringsXml } from ${JSON.stringify(join(import.meta.dirname, '..', 'src', 'server', 'question-import', 'extract.ts'))};`,
      'const parts = [];',
      "let size = 0, index = 0;",
      'while (size < 12 * 1024 * 1024) { const entry = `<si><t>Option ${index}</t></si>`; parts.push(entry); size += entry.length; index += 1; }',
      "const values = parseSharedStringsXml(`<sst>${parts.join('')}</sst>`);",
      'console.log(`read ${values.length} strings`);',
    ].join('\n'));
    const result = spawnSync(
      process.execPath,
      ['--max-old-space-size=192', '--import', 'tsx', script],
      { cwd: join(import.meta.dirname, '..'), encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(
      result.status,
      0,
      `reading a 12 MB shared-string table must fit a 192 MB heap, or a staff upload can exhaust the function:\n${result.stderr}`,
    );
    assert.match(result.stdout, /read \d{5,} strings/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Malformed XML must not cost quadratic time
// ---------------------------------------------------------------------------
//
// The XML scanners used lazy regexes, which restart just after each unmatched
// opening tag. On a part full of unterminated tags every scan runs to the end of
// the document, so cost grows with the square of its size: 0.28 MB of unclosed
// `<w:p>` took 1.7 s, and one entry may hold 20 MB. Extraction runs on the
// request's event loop, so that is a self-inflicted denial of service that rate
// limiting cannot mitigate — one request is enough.
//
// These guards are deliberately coarse (a generous wall-clock ceiling against a
// ~1000x margin), because a tight timing assertion would be flaky on a loaded CI
// machine. They exist to stop the regex scanners coming back, not to benchmark.

const MALFORMED_BUDGET_MS = 3000;

test('a shared-string table full of unterminated tags is read in linear time', async () => {
  // ~1.6 MB of `<si>` with no closing tag. Quadratic code needs minutes here.
  const xml = `<sst>${'<si>'.repeat(400_000)}</sst>`;
  const started = Date.now();
  const values = parseSharedStringsXml(xml);
  const elapsed = Date.now() - started;
  assert.deepEqual(values, [], 'nothing is well-formed, so nothing is read');
  assert.ok(elapsed < MALFORMED_BUDGET_MS, `parsing 1.6 MB of unterminated tags took ${elapsed} ms — the scanner is super-linear again`);
});

test('a worksheet full of unterminated rows is read in linear time', async () => {
  const sheetXml = `<worksheet><sheetData>${'<row>'.repeat(400_000)}</sheetData></worksheet>`;
  const started = Date.now();
  const rows = readSheetRows(sheetXml, []);
  const elapsed = Date.now() - started;
  assert.deepEqual(rows, []);
  assert.ok(elapsed < MALFORMED_BUDGET_MS, `reading 1.6 MB of unterminated rows took ${elapsed} ms`);
});

test('a Word document full of unterminated paragraphs is read in linear time', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document><w:body>${'<w:p>'.repeat(400_000)}</w:body></w:document>`);
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
  const started = Date.now();
  // The document holds no questions, so the extractor returns nothing and the
  // route reports `empty`; what matters here is that it finishes at all, promptly.
  const result = await extractQuestions(buffer, 'broken.docx');
  const elapsed = Date.now() - started;
  assert.deepEqual(result.items, []);
  assert.ok(elapsed < MALFORMED_BUDGET_MS, `reading 1.6 MB of unterminated paragraphs took ${elapsed} ms`);
});

test('an unterminated ordinary table still reads normally', async () => {
  // The linear scanner must not turn a good document into a loss: ordinary
  // questions before a malformed tail have to survive.
  const zip = new JSZip();
  zip.file('word/document.xml', [
    '<w:document><w:body>',
    '<w:p><w:r><w:t>1. What is 2 + 2?</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>A. 3</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>B. 4</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>C. 5</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>D. 6</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Answer: B</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>trailing text with no closing tags',
    '</w:body></w:document>',
  ].join(''));
  const result = await extractQuestions(Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })), 'tail.docx');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].correctOption, 'B');
});

test('text that looks like markup and non-ASCII text survive intact', () => {
  assert.deepEqual(
    parseSharedStringsXml('<sst><si><t>&lt;script&gt;alert(1)&lt;/script&gt;</t></si></sst>'),
    ['<script>alert(1)</script>'],
    'escaped markup is text and must not be stripped',
  );
  assert.deepEqual(
    parseSharedStringsXml('<sst><si><t>Ọmọ Nàìjíríà — ₦500 ✓</t></si></sst>'),
    ['Ọmọ Nàìjíríà — ₦500 ✓'],
  );
  assert.deepEqual(
    parseSharedStringsXml('<sst><si><t xml:space="preserve">  keep  spacing  </t></si></sst>'),
    ['  keep  spacing  '],
  );
});

test('a worksheet of attribute-less cells is skipped without recursing to a crash', () => {
  // `<c>` with no attributes never matched the cells pattern, so each one is
  // skipped. Skipping by recursion overflowed the stack at roughly 10,000
  // candidates, so a malformed sheet crashed instead of reporting no cells.
  // 300,000 keeps this near the click of a fast test while being far past that.
  const sheetXml = `<worksheet><sheetData><row>${'<c>'.repeat(300_000)}</row></sheetData></worksheet>`;
  assert.deepEqual(readSheetRows(sheetXml, []), []);
});
