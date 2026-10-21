/**
 * Past-question extraction.
 *
 * One entry point, `extractQuestions`, takes the bytes of an uploaded paper and
 * returns candidate multiple-choice questions for human review. Nothing here
 * writes to the database: extraction is a best effort, and a question only
 * reaches a CBT bank after an administrator approves it.
 *
 * The parser is deliberately conservative. It would rather return a question
 * with an `unverified` answer or a missing option, which a reviewer can fix,
 * than invent an answer key or drop a question silently.
 */

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
// Import the library entry point directly: pdf-parse's index.js runs a debug
// block when it is loaded as an ES module and tries to read a fixture that
// ships only in its own repository.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E';

export type ExtractedItem = {
  sourceIndex: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctOption: ChoiceKey | null;
  explanation: string | null;
  passage: string | null;
  topic: string | null;
  rawText: string;
};

export type Extraction = {
  items: ExtractedItem[];
  warnings: string[];
};

export type ExtractionErrorCode = 'unsupported' | 'ocr_required' | 'empty' | 'corrupt' | 'too_large';

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

export const SUPPORTED_EXTENSIONS = [
  '.pdf', '.txt', '.md', '.markdown', '.csv', '.tsv', '.json',
  '.docx', '.xlsx', '.zip',
] as const;

export const UNSUPPORTED_EXTENSIONS: Record<string, string> = {
  '.doc': 'Legacy Word (.doc) files cannot be read reliably. Save the document as .docx and upload it again.',
  '.xls': 'Legacy Excel (.xls) files cannot be read reliably. Save the workbook as .xlsx and upload it again.',
  '.png': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.jpg': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.jpeg': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.webp': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.tif': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.tiff': 'Image uploads need OCR, which is not enabled on this deployment. Upload a text-based PDF or a .docx file.',
  '.rtf': 'Rich Text (.rtf) is not supported. Save the document as .docx or .pdf and upload it again.',
  '.odt': 'OpenDocument (.odt) is not supported. Save the document as .docx or .pdf and upload it again.',
  '.pptx': 'Slide decks are not supported for question extraction.',
  '.html': 'HTML files are not supported. Save the questions as .txt, .csv or .docx.',
  '.htm': 'HTML files are not supported. Save the questions as .txt, .csv or .docx.',
};

const MAX_ZIP_ENTRIES = 60;
const MAX_ZIP_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_PDF_PAGES = 300;

export function extensionOf(filename: string): string {
  const match = /(\.[^.\\/]+)$/.exec(filename.trim());
  return match ? match[1].toLowerCase() : '';
}

export function isSupportedUpload(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

export async function extractQuestions(buffer: Buffer, filename: string): Promise<Extraction> {
  if (!buffer.length) throw new ExtractionError('empty', 'The uploaded file is empty.');
  const extension = extensionOf(filename);
  if (!extension) {
    throw new ExtractionError('unsupported', 'The file has no extension, so its format cannot be determined.');
  }
  switch (extension) {
    case '.pdf':
      return extractPdf(buffer);
    case '.txt':
    case '.md':
    case '.markdown':
      return { items: parseProse(buffer.toString('utf8')), warnings: [] };
    case '.csv':
      return extractDelimited(buffer.toString('utf8'), ',');
    case '.tsv':
      return extractDelimited(buffer.toString('utf8'), '\t');
    case '.json':
      return extractJson(buffer.toString('utf8'));
    case '.docx':
      return extractDocx(buffer);
    case '.xlsx':
      return extractXlsx(buffer);
    case '.zip':
      return extractZip(buffer);
    default: {
      const message = UNSUPPORTED_EXTENSIONS[extension]
        || `Files ending in ${extension} are not supported. Upload a PDF, Word (.docx), Excel (.xlsx), CSV, TSV, JSON, text or ZIP file.`;
      throw new ExtractionError('unsupported', message);
    }
  }
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function extractPdf(buffer: Buffer): Promise<Extraction> {
  // pdf.js (bundled by pdf-parse) reads `buffer.buffer` without honouring a
  // Buffer's byteOffset, and a small file read through Node's Buffer pool has a
  // non-zero offset. Passing an exactly-sized copy avoids a spurious
  // "bad XRef entry" on the first parse.
  const bytes = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  let parsed: { text?: string; numpages?: number };
  try {
    parsed = await pdfParse(bytes, { max: MAX_PDF_PAGES });
  } catch {
    throw new ExtractionError(
      'corrupt',
      'The PDF could not be read. It may be damaged, password-protected or in an unsupported encoding. Export it again and retry.',
    );
  }
  const text = normalizeText(parsed.text || '');
  const pages = Number(parsed.numpages || 1);
  const readable = text.replace(/[^A-Za-z0-9]/g, '');
  // A page with a text layer normally holds tens of characters. A scanned page
  // holds none, so the upload is routed to the person, not parsed into nonsense.
  if (readable.length < Math.max(20, pages * 20)) {
    throw new ExtractionError(
      'ocr_required',
      'This PDF has no usable text layer, which usually means it is a scan or a photograph. OCR is not enabled on this deployment: upload a text-based PDF, or type the questions into the review screen.',
    );
  }
  const warnings: string[] = [];
  if (pages > 1) warnings.push(`Read ${pages} PDF pages. Check that questions split across pages were joined correctly.`);
  return { items: parseProse(text), warnings };
}

// ---------------------------------------------------------------------------
// DOCX and XLSX
// ---------------------------------------------------------------------------

const xml = new XMLParser({
  ignoreAttributes: true,
  preserveOrder: false,
  processEntities: true,
  trimValues: false,
});

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textFromXml(fragment: string): string {
  const withBreaks = fragment.replace(/<w:tab\s*\/>/g, '\t').replace(/<w:br\s*\/>/g, '\n');
  let result = '';
  for (const match of withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    result += decodeXml(match[1]);
  }
  return result;
}

async function extractDocx(buffer: Buffer): Promise<Extraction> {
  const zip = await loadZip(buffer, 'Word document');
  const main = zip.file('word/document.xml');
  if (!main) {
    throw new ExtractionError('corrupt', 'This file is not a Word document: word/document.xml is missing.');
  }
  const documentXml = await main.async('string');

  // Images in a DOCX live beside the text, not inside it. They are counted so
  // the reviewer knows to consult the original file for diagrams.
  const imageCount = (documentXml.match(/<w:drawing[\s>]/g) || []).length;

  const withTables = documentXml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tableXml) => {
    const rows: string[] = [];
    for (const row of tableXml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)) {
      const cells = [...row[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)]
        .map((cell) => textFromXml(cell[0]).replace(/\s+/g, ' ').trim());
      if (cells.some(Boolean)) rows.push(cells.join('\t'));
    }
    return `\n${rows.join('\n')}\n`;
  });

  const lines: string[] = [];
  for (const paragraph of withTables.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    lines.push(textFromXml(paragraph[0]));
  }

  const warnings: string[] = [];
  if (imageCount > 0) {
    warnings.push(`${imageCount} image${imageCount === 1 ? '' : 's'} found in the document. Diagrams are not attached to individual questions automatically; keep the source file open while reviewing.`);
  }
  return { items: parseProse(lines.join('\n')), warnings };
}

async function extractXlsx(buffer: Buffer): Promise<Extraction> {
  const zip = await loadZip(buffer, 'Excel workbook');
  const warnings: string[] = [];
  const sharedStrings = await readSharedStrings(zip);

  const sheets = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => sheetNumber(a) - sheetNumber(b));
  if (!sheets.length) {
    throw new ExtractionError('corrupt', 'This file is not an Excel workbook: no worksheets were found.');
  }

  const items: ExtractedItem[] = [];
  for (const sheet of sheets) {
    const sheetXml = await zip.file(sheet)!.async('string');
    const rows = readSheetRows(sheetXml, sharedStrings);
    const parsed = parseTableRows(rows);
    if (!parsed.length) continue;
    for (const row of parsed) {
      items.push({ ...row, sourceIndex: items.length + 1 });
    }
  }
  if (sheets.length > 1) warnings.push(`Read ${sheets.length} worksheets. Check that every sheet belonged to this paper.`);
  return { items: applyAnswerKeys(items), warnings };
}

function sheetNumber(name: string): number {
  return Number(/sheet(\d+)\.xml$/.exec(name)?.[1] || 0);
}

export async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const parsed = xml.parse(await file.async('string')) as Record<string, any>;
  const list = parsed?.sst?.si;
  if (!list) return [];
  return (Array.isArray(list) ? list : [list]).map((entry: any) => {
    const text = entry?.t;
    if (typeof text === 'string') return decodeXml(text);
    // fast-xml-parser turns <t>3</t> into the number 3.
    if (typeof text === 'number') return String(text);
    if (text && typeof text === 'object' && '#text' in text) return decodeXml(String(text['#text']));
    if (entry?.r) {
      const runs = Array.isArray(entry.r) ? entry.r : [entry.r];
      return runs.map((run: any) => decodeXml(String(run?.t?.['#text'] ?? run?.t ?? ''))).join('');
    }
    return '';
  });
}

function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1] || 'A';
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function readSheetRows(sheetXml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const row of sheetXml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cell[1];
      const reference = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] || 'A1';
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1]
        ?? /<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cell[2])?.[1]
        ?? '';
      let value = decodeXml(raw);
      if (type === 's') value = sharedStrings[Number(raw)] ?? '';
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      cells[columnIndex(reference)] = value.replace(/\s+/g, ' ').trim();
    }
    if (cells.some((cell) => (cell || '').length)) {
      rows.push(Array.from(cells, (cell) => cell || ''));
    }
  }
  return rows;
}

async function loadZip(buffer: Buffer, label: string): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(buffer);
  } catch {
    throw new ExtractionError('corrupt', `This ${label} could not be opened. It may be damaged or encrypted.`);
  }
}

// ---------------------------------------------------------------------------
// ZIP archives
// ---------------------------------------------------------------------------

async function extractZip(buffer: Buffer): Promise<Extraction> {
  const zip = await loadZip(buffer, 'ZIP archive');
  const entries = Object.values(zip.files).filter((file) => !file.dir && !file.name.startsWith('__MACOSX/'));
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new ExtractionError('too_large', `This archive holds ${entries.length} files; at most ${MAX_ZIP_ENTRIES} can be read at once.`);
  }
  const supported = entries
    .filter((file) => isSupportedUpload(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!supported.length) {
    throw new ExtractionError('unsupported', 'The archive contains no supported files. Add PDF, Word, Excel, CSV, JSON or text files.');
  }

  let totalBytes = 0;
  const items: ExtractedItem[] = [];
  const warnings: string[] = [];
  const skipped = entries.filter((file) => !isSupportedUpload(file.name)).map((file) => file.name);
  if (skipped.length) {
    warnings.push(`Skipped ${skipped.length} unsupported file${skipped.length === 1 ? '' : 's'}: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
  }
  for (const entry of supported) {
    const bytes = await entry.async('uint8array');
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > 20 * 1024 * 1024 || totalBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new ExtractionError('too_large', 'The archive expands beyond the 20 MB file / 80 MB total limit. Split it into smaller uploads.');
    }
    if (extensionOf(entry.name) === '.zip') {
      throw new ExtractionError('unsupported', 'Nested ZIP archives are not supported. Upload the inner files directly.');
    }
    let nested: Extraction;
    try {
      nested = await extractQuestions(Buffer.from(bytes), entry.name);
    } catch (error) {
      // One unreadable file must not discard the rest of the archive. The
      // reason is kept per entry so the reviewer knows what was skipped.
      warnings.push(`${entry.name}: ${error instanceof ExtractionError ? error.message : 'could not be read.'}`);
      continue;
    }
    if (!nested.items.length) {
      warnings.push(`${entry.name}: no questions were recognised.`);
      continue;
    }
    warnings.push(`${entry.name}: ${nested.items.length} question${nested.items.length === 1 ? '' : 's'}.`);
    for (const item of nested.items) items.push({ ...item, sourceIndex: items.length + 1 });
  }
  if (!items.length) {
    throw new ExtractionError('empty', `No questions were recognised in the archive. ${warnings.join(' ')}`.trim());
  }
  return { items: applyAnswerKeys(items), warnings };
}

// ---------------------------------------------------------------------------
// CSV / TSV
// ---------------------------------------------------------------------------

function parseDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field.trim() === '') { quoted = true; field = ''; continue; }
    if (char === delimiter) { row.push(field); field = ''; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function extractDelimited(text: string, delimiter: ',' | '\t'): Extraction {
  const rows = parseDelimited(normalizeText(text), delimiter);
  const parsed = parseTableRows(rows);
  return { items: applyAnswerKeys(parsed.map((item, index) => ({ ...item, sourceIndex: index + 1 }))), warnings: [] };
}

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type ColumnMap = {
  question: number;
  options: Map<ChoiceKey, number>;
  answer: number | null;
  explanation: number | null;
  passage: number | null;
  topic: number | null;
};

function columnMapFor(row: string[]): ColumnMap | null {
  const headers = row.map(normaliseHeader);
  const find = (...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const question = find('question', 'questiontext', 'questionstem', 'text', 'q', 'item');
  if (question < 0) return null;
  const letterColumns = new Map<ChoiceKey, number>();
  for (const key of ['A', 'B', 'C', 'D', 'E'] as ChoiceKey[]) {
    const index = find(`option${key.toLowerCase()}`, `opt${key.toLowerCase()}`, key.toLowerCase(), key.toLowerCase() + '1');
    if (index >= 0) letterColumns.set(key, index);
  }
  // Also accept numeric option headers (option1..option5) and assign A..E.
  if (!letterColumns.size) {
    for (let number = 1; number <= 5; number += 1) {
      const index = find(`option${number}`, `opt${number}`);
      if (index >= 0) letterColumns.set(String.fromCharCode(64 + number) as ChoiceKey, index);
    }
  }
  if (letterColumns.size < 2) {
    // A bare five-column layout with no header names is handled by the caller.
    return null;
  }
  return {
    question,
    options: letterColumns,
    answer: (() => { const index = find('answer', 'correctanswer', 'correctoption', 'answerkey', 'key', 'ans'); return index >= 0 ? index : null; })(),
    explanation: (() => { const index = find('explanation', 'solution', 'reason'); return index >= 0 ? index : null; })(),
    passage: (() => { const index = find('passage', 'context'); return index >= 0 ? index : null; })(),
    topic: (() => { const index = find('topic', 'syllabustopic', 'subtopic'); return index >= 0 ? index : null; })(),
  };
}

export function parseTableRows(rows: string[][]): ExtractedItem[] {
  if (!rows.length) return [];
  let headerIndex = -1;
  let map: ColumnMap | null = null;
  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const candidate = columnMapFor(rows[index]);
    if (candidate) { headerIndex = index; map = candidate; break; }
  }
  const items: ExtractedItem[] = [];
  if (!map) {
    // Headerless sheet: question, A, B, C, D, answer, explanation.
    for (const row of rows) {
      const [question, optionA, optionB, optionC, optionD, answer, explanation] = row;
      if (!question?.trim() || !optionA?.trim() || !optionB?.trim()) continue;
      items.push(fromParts({
        questionText: question, optionA, optionB, optionC: optionC || '', optionD: optionD || '',
        answerText: answer || '', explanation: explanation || '', passage: '', topic: '',
      }));
    }
    return items;
  }
  for (const row of rows.slice(headerIndex + 1)) {
    const question = row[map.question] || '';
    if (!question.trim()) continue;
    const option = (key: ChoiceKey) => {
      const index = map!.options.get(key);
      return index === undefined ? '' : (row[index] || '');
    };
    items.push(fromParts({
      questionText: question,
      optionA: option('A'), optionB: option('B'), optionC: option('C'), optionD: option('D'), optionE: option('E'),
      answerText: map.answer === null ? '' : (row[map.answer] || ''),
      explanation: map.explanation === null ? '' : (row[map.explanation] || ''),
      passage: map.passage === null ? '' : (row[map.passage] || ''),
      topic: map.topic === null ? '' : (row[map.topic] || ''),
    }));
  }
  return items;
}

function fromParts(input: {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  answerText: string;
  explanation: string;
  passage: string;
  topic: string;
}): ExtractedItem {
  const options = [input.optionA, input.optionB, input.optionC, input.optionD, input.optionE || '']
    .map((option) => String(option || '').replace(/\s+/g, ' ').trim());
  return {
    sourceIndex: 0,
    questionText: String(input.questionText || '').replace(/\s+/g, ' ').trim(),
    optionA: options[0] || '',
    optionB: options[1] || '',
    optionC: options[2] || '',
    optionD: options[3] || '',
    optionE: options[4] || null,
    correctOption: answerLetter(String(input.answerText || ''), options),
    explanation: cleanOptional(input.explanation),
    passage: cleanOptional(input.passage),
    topic: cleanOptional(input.topic),
    rawText: '',
  };
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

/** Accepts "B", "(b)", "B. 12" or the exact option text. Returns null otherwise. */
function answerLetter(value: string, options: string[]): ChoiceKey | null {
  const text = value.trim();
  if (!text) return null;
  const letter = /^\(?([A-Ea-e])\)?(?:[.)\-:\s]|$)/.exec(text)?.[1];
  if (letter) return letter.toUpperCase() as ChoiceKey;
  const target = text.toLowerCase().replace(/\s+/g, ' ');
  const matched = options.findIndex((option) => option.toLowerCase().replace(/\s+/g, ' ') === target);
  if (matched >= 0) return String.fromCharCode(65 + matched) as ChoiceKey;
  return null;
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function extractJson(text: string): Extraction {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ExtractionError('corrupt', 'This file is not valid JSON. Check for a missing comma or bracket and upload it again.');
  }
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>)?.questions)
      ? (payload as Record<string, unknown>).questions as unknown[]
      : [];
  if (!Array.isArray(list) || !list.length) {
    throw new ExtractionError('empty', 'No questions were found. Provide a JSON array, or an object with a "questions" array.');
  }
  const items = list.map((entry) => jsonQuestion(entry as Record<string, unknown>)).filter(Boolean) as ExtractedItem[];
  if (!items.length) throw new ExtractionError('empty', 'The JSON did not contain any recognisable questions.');
  return { items: applyAnswerKeys(items.map((item, index) => ({ ...item, sourceIndex: index + 1 }))), warnings: [] };
}

function jsonQuestion(entry: Record<string, unknown>): ExtractedItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = entry[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  };
  const questionText = read('questionText', 'question_text', 'question', 'text', 'stem');
  if (!questionText.trim()) return null;
  const rawOptions = entry.options ?? entry.choices;
  let options: string[] = [];
  if (Array.isArray(rawOptions)) {
    options = rawOptions.map((option) => {
      if (typeof option === 'string') return option;
      if (option && typeof option === 'object') {
        const record = option as Record<string, unknown>;
        return String(record.text ?? record.label ?? record.value ?? '');
      }
      return String(option ?? '');
    });
  } else if (rawOptions && typeof rawOptions === 'object') {
    options = ['a', 'b', 'c', 'd', 'e'].map((key) => String((rawOptions as Record<string, unknown>)[key] ?? ''));
  } else {
    options = [
      read('optionA', 'option_a'), read('optionB', 'option_b'), read('optionC', 'option_c'),
      read('optionD', 'option_d'), read('optionE', 'option_e'),
    ];
  }
  while (options.length && !String(options[options.length - 1] || '').trim()) options.pop();
  const answer = entry.correctOption ?? entry.correct_option ?? entry.answer ?? entry.correctAnswer ?? entry.key;
  return fromParts({
    questionText,
    optionA: options[0] || '', optionB: options[1] || '', optionC: options[2] || '',
    optionD: options[3] || '', optionE: options[4] || '',
    answerText: typeof answer === 'number' ? String(answer) : String(answer ?? ''),
    explanation: read('explanation', 'solution', 'reason'),
    passage: read('passage', 'context'),
    topic: read('topic', 'syllabusTopic', 'syllabus_topic'),
  });
}

// ---------------------------------------------------------------------------
// Prose / plain text
// ---------------------------------------------------------------------------

const QUESTION_LINE = /^\s*(?:question\s*)?(\d{1,3})\s*[.)\]:-]\s*(.*)$/i;
const OPTION_LINE = /^\s*\(?([A-Ea-e])\)?\s*[.)\]:-]\s*(.*)$/;
const ANSWER_LINE = /^\s*(?:correct\s+)?(?:answer|ans)\s*[:\-–=]\s*\(?([A-Ea-e])\)?\s*[.;]?\s*$/i;
const EXPLANATION_LINE = /^\s*(?:explanation|solution|reason)\s*[:\-–]\s*(.*)$/i;
const PASSAGE_LINE = /^\s*(?:passage|comprehension|read the (?:following )?passage|study the (?:following )?passage|the passage below)/i;
const PASSAGE_RANGE = /questions?\s+(\d{1,3})\s*(?:-|–|to|and)\s*(\d{1,3})\b/i;
const SECTION_LINE = /^\s*(?:section|part)\s+([A-Z])\b\s*[:.\-]?\s*(.*)$/i;

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Draft = {
  number: number;
  questionLines: string[];
  options: Map<ChoiceKey, string>;
  answer: ChoiceKey | null;
  explanation: string[];
  passage: string | null;
  topic: string | null;
  raw: string[];
};

function parseProse(input: string): ExtractedItem[] {
  const text = normalizeText(input);
  if (!text) return [];
  const { lines, keyed } = splitAnswerKey(text);
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let currentOption: ChoiceKey | null = null;
  let pendingPassage: string[] = [];
  let explanationMode = false;
  let sectionTopic: string | null = null;

  const flush = () => {
    if (current) drafts.push(current);
    current = null;
    currentOption = null;
    explanationMode = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:page\s*)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?$/i.test(line)) continue;

    const section = SECTION_LINE.exec(line);
    if (section) {
      sectionTopic = (section[2] || `Section ${section[1]}`).trim().slice(0, 160) || null;
      continue;
    }

    if (PASSAGE_LINE.test(line)) {
      flush();
      pendingPassage = [line];
      continue;
    }
    if (pendingPassage.length && !QUESTION_LINE.test(line) && pendingPassage.length < 40) {
      pendingPassage.push(line);
      continue;
    }

    const question = QUESTION_LINE.exec(line);
    if (question) {
      const number = Number(question[1]);
      // A page number, an option value or a year is not a question start. The
      // first question of a paper is 1; after that, numbers must move forward.
      const expected = drafts.length === 0 ? 1 : drafts[drafts.length - 1].number + 1;
      if (number === 1 || number >= expected || !current) {
        flush();
        current = {
          number,
          questionLines: [question[2]],
          options: new Map(),
          answer: null,
          explanation: [],
          passage: null,
          topic: sectionTopic,
          raw: [line],
        };
        currentOption = null;
        explanationMode = false;
        // "Which is prime? A. 4 B. 6 C. 7 D. 9" on one line is common in
        // spreadsheet exports and two-column PDFs. Split it here rather than
        // leaving the options glued to the question stem.
        const onQuestionLine = splitInlineOptions(question[2]);
        if (onQuestionLine.length >= 2) {
          current.questionLines = [question[2].slice(0, onQuestionLine[0].start).trim()];
          current.raw = [];
          for (const option of onQuestionLine) {
            current.options.set(option.key, option.text);
            current.raw.push(`${option.key}. ${option.text}`);
          }
          currentOption = onQuestionLine[onQuestionLine.length - 1].key;
        }
        if (pendingPassage.length) {
          const passage = pendingPassage.join('\n').trim();
          current.passage = passage;
          pendingPassage = [];

        }
        continue;
      }
    }

    if (!current) continue;

    const answer = ANSWER_LINE.exec(line);
    if (answer) {
      current.answer = answer[1].toUpperCase() as ChoiceKey;
      current.raw.push(line);
      explanationMode = false;
      continue;
    }

    const explanation = EXPLANATION_LINE.exec(line);
    if (explanation) {
      current.explanation.push(explanation[1]);
      current.raw.push(line);
      explanationMode = true;
      continue;
    }

    const inlineOptions = splitInlineOptions(line);
    if (inlineOptions.length >= 2) {
      for (const option of inlineOptions) {
        current.options.set(option.key, option.text);
        current.raw.push(`${option.key}. ${option.text}`);
      }
      currentOption = inlineOptions[inlineOptions.length - 1].key;
      explanationMode = false;
      continue;
    }

    const option = OPTION_LINE.exec(line);
    if (option) {
      const key = option[1].toUpperCase() as ChoiceKey;
      const expected = ['A', 'B', 'C', 'D', 'E'][current.options.size] as ChoiceKey | undefined;
      // Only accept the next letter in sequence. "A." at the start of a
      // sentence, or a stray "D." in a formula, otherwise becomes an option.
      if (key === expected) {
        current.options.set(key, option[2]);
        current.raw.push(line);
        currentOption = key;
        explanationMode = false;
        continue;
      }
    }

    if (explanationMode) {
      current.explanation.push(line);
      current.raw.push(line);
      continue;
    }
    if (currentOption) {
      current.options.set(currentOption, `${current.options.get(currentOption) || ''} ${line}`.trim());
      current.raw.push(line);
      continue;
    }
    current.questionLines.push(line);
    current.raw.push(line);
  }
  flush();

  // A passage normally covers the next few questions, not only the first one.
  const items: ExtractedItem[] = [];
  let passageCarry: { text: string; remaining: number } | null = null;
  for (const draft of drafts) {
    if (draft.passage) {
      const rangeMatch = PASSAGE_RANGE.exec(draft.passage);
      const count = rangeMatch
        ? Math.max(1, Number(rangeMatch[2]) - Number(rangeMatch[1]) + 1)
        : 3;
      passageCarry = { text: draft.passage, remaining: count };
    }
    const passage = passageCarry && passageCarry.remaining > 0 ? passageCarry.text : null;
    if (passageCarry) passageCarry.remaining -= 1;
    if (passageCarry && passageCarry.remaining <= 0) passageCarry = null;

    const options = draft.options;
    const questionText = cleanQuestionText(draft.questionLines.join(' '));
    if (!questionText && !options.size) continue;
    const answer = draft.answer || keyed.get(draft.number) || null;
    items.push({
      sourceIndex: items.length + 1,
      questionText,
      optionA: options.get('A') || '',
      optionB: options.get('B') || '',
      optionC: options.get('C') || '',
      optionD: options.get('D') || '',
      optionE: options.get('E') || null,
      correctOption: answer,
      explanation: cleanOptional(draft.explanation.join(' ')),
      passage,
      topic: draft.topic,
      rawText: draft.raw.join('\n').slice(0, 6000),
    });
  }
  return applyAnswerKeys(items);
}

function cleanQuestionText(value: string): string {
  return value
    .replace(/\s*\((?:answer|ans)\s*[:\-]?\s*[A-E]\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitInlineOptions(line: string): Array<{ key: ChoiceKey; text: string; start: number }> {
  const matches = [...line.matchAll(/(?:^|\s)\(?([A-E])\)?\s*[.)]\s+/g)];
  if (matches.length < 2) return [];
  const results: Array<{ key: ChoiceKey; text: string; start: number }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[1] as ChoiceKey;
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? line.length) : line.length;
    const text = line.slice(start, end).trim();
    if (text) results.push({ key, text, start: match.index ?? 0 });
  }
  return results;
}

/**
 * Answer keys are often printed once at the end, either as "1. B" lines or as
 * "1 B 2 C 3 A" rows. They are removed from the prose before questions are
 * parsed, so a key line cannot become a question.
 */
function splitAnswerKey(input: string): { lines: string[]; keyed: Map<number, ChoiceKey> } {
  const lines = input.split('\n');
  const keyed = new Map<number, ChoiceKey>();
  const kept: string[] = [];
  for (const line of lines) {
    const pairs = [...line.matchAll(/(?:^|\s)(\d{1,3})\s*[.)\-:]?\s*([A-E])(?=\s|$)/g)];
    const onlyPairs = pairs.length > 0
      && line.replace(/(?:^|\s)\d{1,3}\s*[.)\-:]?\s*[A-E](?=\s|$)/g, '').replace(/[\s,;|]+/g, '') === '';
    if (onlyPairs && (pairs.length >= 2 || /^\s*\d{1,3}\s*[.)\-:]?\s*[A-E]\s*$/.test(line))) {
      for (const pair of pairs) keyed.set(Number(pair[1]), pair[2] as ChoiceKey);
      continue;
    }
    kept.push(line);
  }
  return { lines: kept, keyed };
}

function applyAnswerKeys(items: ExtractedItem[]): ExtractedItem[] {
  return items.map((item) => {
    const options = [item.optionA, item.optionB, item.optionC, item.optionD, item.optionE || ''];
    if (item.correctOption && !options[item.correctOption.charCodeAt(0) - 65]?.trim()) {
      return { ...item, correctOption: null };
    }
    return item;
  });
}
