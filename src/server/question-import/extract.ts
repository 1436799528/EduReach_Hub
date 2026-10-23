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

import { inflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
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
  /**
   * Decompressed bytes this extraction spent on container parts (a `.docx`'s
   * `word/document.xml`, an `.xlsx`'s sheets and shared-string table).
   *
   * This is the number the archive-wide ceiling has to debit. A .docx inside a
   * .zip is itself compressed, so its inner parts expand *after* the outer
   * entry was measured — counting only the container's bytes let a 4 KB upload
   * expand ~90 MB of nested text (see tests/zip-bounds.test.ts). Formats that do
   * not decompress anything leave it undefined.
   */
  expandedBytes?: number;
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
const MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_PDF_PAGES = 300;

/** The archive limits, exported so a test asserts the shipped numbers. */
export const ZIP_LIMITS = {
  maxEntries: MAX_ZIP_ENTRIES,
  maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
  maxTotalBytes: MAX_ZIP_UNCOMPRESSED_BYTES,
} as const;

/**
 * One message for every way an archive can expand past the limits, because the
 * operator's next action is the same in all of them: split the upload.
 */
export const ZIP_TOO_LARGE_MESSAGE =
  'The archive expands beyond the 20 MB file / 80 MB total limit. Split it into smaller uploads.';


export function extensionOf(filename: string): string {
  const match = /(\.[^.\\/]+)$/.exec(filename.trim());
  return match ? match[1].toLowerCase() : '';
}

export function isSupportedUpload(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/**
 * Extract questions from one uploaded file.
 *
 * `limits` is supplied when this file arrived *inside* a `.zip`: the caller has
 * already spent part of the archive-wide budget, so the container parts this
 * file expands must fit in what is left rather than starting a fresh 80 MB.
 */
export async function extractQuestions(
  buffer: Buffer,
  filename: string,
  limits?: Partial<ArchiveLimits>,
): Promise<Extraction> {
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
      return extractDocx(buffer, limits);
    case '.xlsx':
      return extractXlsx(buffer, limits);
    case '.zip':
      return extractZip(buffer, limits);
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

/**
 * One left-to-right scanner for the XML in Office containers.
 *
 * The previous code used lazy regexes (`[\s\S]*?<\/row>`) to find each element.
 * On well-formed input that is linear, but on *malformed* input — an opening tag
 * with no matching close — every scan runs to the end of the document and the
 * next candidate starts just after it, so the cost is quadratic in the part's
 * size. Measured: 0.28 MB of unterminated `<w:p>` took 1.7 s, which extrapolates
 * to hours for the 20 MB a single entry may hold, and extraction runs on the
 * request's event loop.
 *
 * These helpers consume the text monotonically: once an element is read (or
 * found to be unterminated), scanning resumes after it and the earlier text is
 * never revisited. Cost is therefore linear in the part size regardless of how
 * malformed it is, and an unterminated element simply ends the scan.
 */

/** Is `index` a legal end for a tag name? Stops `<si` matching `<simple`. */
function atTagBoundary(text: string, index: number): boolean {
  const next = text[index];
  return next === undefined || next === '>' || next === '/' || next === ' '
    || next === '\n' || next === '\t' || next === '\r';
}

/** Index of the next `<name` opening tag at or after `from`, or -1. */
function findOpenTag(text: string, from: number, name: string): number {
  const needle = `<${name}`;
  let at = from;
  for (;;) {
    const index = text.indexOf(needle, at);
    if (index === -1) return -1;
    if (atTagBoundary(text, index + needle.length)) return index;
    at = index + needle.length;
  }
}

interface ElementSpan {
  /** Index of the opening `<`. */
  open: number;
  innerStart: number;
  innerEnd: number;
  /** Index just past the closing tag (or past `/>` for a self-closing element). */
  end: number;
}

/**
 * The next `<name …>…</name>` element at or after `from`, or null.
 *
 * Null means "no more elements to read" — either there is no opening tag, or the
 * opening tag has no closing tag, in which case the rest of the document is not
 * scanned again. That is what keeps a malformed part linear.
 */
function nextElement(text: string, from: number, name: string, requireSpace = false): ElementSpan | null {
  const open = findOpenTag(text, from, name);
  if (open === -1) return null;
  if (requireSpace && !/\s/.test(text[open + name.length + 1] ?? '')) {
    // `<c>` without attributes never matched the old cells pattern; skip it.
    return nextElement(text, open + name.length + 1, name, requireSpace);
  }
  const gt = text.indexOf('>', open);
  if (gt === -1) return null;
  if (text[gt - 1] === '/') return { open, innerStart: gt + 1, innerEnd: gt + 1, end: gt + 1 };
  const close = text.indexOf(`</${name}>`, gt);
  if (close === -1) return null;
  return { open, innerStart: gt + 1, innerEnd: close, end: close + name.length + 3 };
}

/** Remove leftover markup from a malformed fragment before it is decoded. */
function withoutMarkup(value: string): string {
  return value.includes('<') ? value.replace(/<[^>]*>/g, '') : value;
}

/** The inner text of every `<name …>…</name>` element, read once, left to right. */
function elementInners(text: string, name: string): string[] {
  const inners: string[] = [];
  let cursor = 0;
  for (;;) {
    const span = nextElement(text, cursor, name);
    if (!span) return inners;
    inners.push(text.slice(span.innerStart, span.innerEnd));
    cursor = span.end;
  }
}

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
  for (const inner of elementInners(withBreaks, 'w:t')) {
    result += decodeXml(withoutMarkup(inner));
  }
  return result;
}

async function extractDocx(buffer: Buffer, limits?: Partial<ArchiveLimits>): Promise<Extraction> {
  const zip = await loadZip(buffer, 'Word document');
  const main = zip.file('word/document.xml');
  if (!main) {
    throw new ExtractionError('corrupt', 'This file is not a Word document: word/document.xml is missing.');
  }
  const partLimit = Math.min(limits?.maxEntryBytes ?? MAX_ZIP_ENTRY_BYTES, limits?.maxTotalBytes ?? MAX_ZIP_UNCOMPRESSED_BYTES);
  const documentXml = await readEntryText(main, 'document body', partLimit);

  // Images in a DOCX live beside the text, not inside it. They are counted so
  // the reviewer knows to consult the original file for diagrams.
  const imageCount = (documentXml.match(/<w:drawing[\s>]/g) || []).length;

  // Tables become tab-separated lines, so their cells reach the prose parser.
  // Read once, from left to right, instead of one regex pass per table.
  const withTablesParts: string[] = [];
  let tableCursor = 0;
  for (;;) {
    const table = nextElement(documentXml, tableCursor, 'w:tbl');
    if (!table) {
      withTablesParts.push(documentXml.slice(tableCursor));
      break;
    }
    withTablesParts.push(documentXml.slice(tableCursor, table.open));
    const rows: string[] = [];
    for (const rowInner of elementInners(documentXml.slice(table.innerStart, table.innerEnd), 'w:tr')) {
      const cells = elementInners(rowInner, 'w:tc').map((cell) => textFromXml(cell).replace(/\s+/g, ' ').trim());
      if (cells.some(Boolean)) rows.push(cells.join('\t'));
    }
    withTablesParts.push(`\n${rows.join('\n')}\n`);
    tableCursor = table.end;
  }
  const withTables = withTablesParts.join('');

  const lines: string[] = elementInners(withTables, 'w:p').map((paragraph) => textFromXml(paragraph));

  const warnings: string[] = [];
  if (imageCount > 0) {
    warnings.push(`${imageCount} image${imageCount === 1 ? '' : 's'} found in the document. Diagrams are not attached to individual questions automatically; keep the source file open while reviewing.`);
  }
  return { items: parseProse(lines.join('\n')), warnings, expandedBytes: Buffer.byteLength(documentXml, 'utf8') };
}

async function extractXlsx(buffer: Buffer, limits?: Partial<ArchiveLimits>): Promise<Extraction> {
  const zip = await loadZip(buffer, 'Excel workbook');
  const warnings: string[] = [];
  // One budget covers the whole workbook: the shared-string table first, then
  // whatever is left is shared by the worksheets. A workbook's parts are read
  // one after another, so the ceiling has to span them.
  const totalBudget = limits?.maxTotalBytes ?? MAX_ZIP_UNCOMPRESSED_BYTES;
  const partLimit = Math.min(limits?.maxEntryBytes ?? MAX_ZIP_ENTRY_BYTES, totalBudget);
  const sharedStringsRead = await readSharedStringsWithSize(zip, partLimit);
  const sharedStrings = sharedStringsRead.values;
  const sheetBudget = totalBudget - sharedStringsRead.bytes;
  if (sheetBudget <= 0 && zip.file('xl/worksheets/sheet1.xml')) throw tooLarge();

  const sheets = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => sheetNumber(a) - sheetNumber(b));
  if (!sheets.length) {
    throw new ExtractionError('corrupt', 'This file is not an Excel workbook: no worksheets were found.');
  }

  // Every worksheet is read under the archive-wide ceiling as well as the
  // per-file one, exactly like the entries of a .zip upload.
  const sheetReads = await readArchiveEntries(
    sheets.map((name) => zip.file(name)!),
    { maxEntryBytes: Math.min(partLimit, sheetBudget), maxTotalBytes: sheetBudget },
  );
  const items: ExtractedItem[] = [];
  for (const sheetRead of sheetReads) {
    if (!sheetRead.ok) continue;
    const rows = readSheetRows(sheetRead.bytes.toString('utf8'), sharedStrings);
    const parsed = parseTableRows(rows);
    if (!parsed.length) continue;
    for (const row of parsed) {
      items.push({ ...row, sourceIndex: items.length + 1 });
    }
  }
  if (sheets.length > 1) warnings.push(`Read ${sheets.length} worksheets. Check that every sheet belonged to this paper.`);
  const expandedBytes = sharedStringsRead.bytes
    + sheetReads.reduce((total, read) => total + (read.ok ? read.bytes.length : 0), 0);
  return { items: applyAnswerKeys(items), warnings, expandedBytes };
}

function sheetNumber(name: string): number {
  return Number(/sheet(\d+)\.xml$/.exec(name)?.[1] || 0);
}

/**
 * Decode the XML entities fast-xml-parser would have decoded, in one pass.
 *
 * Single pass matters: `&amp;lt;` must become `&lt;`, not `<`. Only this file's
 * `decodeXml` (five named entities, no numeric references) ran afterwards, so
 * both steps are reproduced here and the result matches what the previous
 * tree-based reader produced.
 */
function decodeEntitiesOnce(value: string): string {
  // Only the five named entities: `fast-xml-parser` left numeric references
  // (`&#65;`) alone, and pinning that keeps the output identical.
  return value.replace(/&(lt|gt|quot|apos|amp);/g, (_whole, name: string) => {
    switch (name) {
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      default: return '&';
    }
  });
}

/** One `<t>` element's text, decoded the way the previous reader decoded it. */
function textOfTag(body: string): string {
  const inner = body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Markup is stripped before entities are decoded, so text that legitimately
  // reads `<b>` (written `&lt;b&gt;`) survives.
  return decodeXml(decodeEntitiesOnce(withoutMarkup(inner)));
}

/**
 * Read a shared-string table without building an object tree.
 *
 * `fast-xml-parser` produced one object per string: a 19 MB table became a
 * **544 MB** heap tree (measured, see docs/audit/VERIFICATION-AUDIT.md session
 * 17), which is what drove the ~1 GB peak for an Excel upload. The table is
 * simple — a list of `<si>` entries, each either a direct `<t>` or a set of
 * `<r>` runs — so it is read directly and the expanded XML text is released as
 * soon as the strings have been extracted.
 *
 * The output is pinned to the old behaviour by a parity test in
 * tests/question-extract.test.ts that parses the same fixtures with
 * `fast-xml-parser`. Four deliberate differences, all of them cases where the
 * old reader lost or altered text, none of which can change a well-formed
 * question:
 *
 *   - a number-like string keeps its digits: "007" stays "007" (it became "7");
 *   - "true"/"false"/"null" are kept as text (they were dropped entirely, because
 *     the parser turned them into booleans and the old code had no branch for one);
 *   - a malformed nested `<t>a<t>b</t>c</t>` reads "abc" (it read "ac");
 *   - a table that consists of a single self-closing `<si/>` yields one empty
 *     string rather than none — the sheet reader maps both to the same ''.
 */
export function parseSharedStringsXml(text: string): string[] {
  const values: string[] = [];
  let cursor = 0;
  for (;;) {
    const span = nextElement(text, cursor, 'si');
    if (!span) return values;
    // A self-closing entry still occupies its index: dropping it would shift
    // every later cell reference onto the wrong string.
    values.push(span.innerStart === span.innerEnd && text[span.open + 3] === '/'
      ? ''
      : entryText(text.slice(span.innerStart, span.innerEnd)));
    cursor = span.end;
  }
}

/**
 * The text of one `<si>` entry.
 *
 * A direct `<t>` wins over rich-text runs (what the tree reader did); phonetic
 * runs (`rPh`) are pronunciation hints and are ignored. Scanned once, so a
 * malformed entry cannot make the scan restart.
 */
function entryText(body: string): string {
  let direct: string | null = null;
  const runs: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const tagStart = body.indexOf('<', cursor);
    if (tagStart === -1) break;
    const name = body.startsWith('<rPh', tagStart) && atTagBoundary(body, tagStart + 4) ? 'rPh'
      : body.startsWith('<r', tagStart) && atTagBoundary(body, tagStart + 2) ? 'r'
        : body.startsWith('<t', tagStart) && atTagBoundary(body, tagStart + 2) ? 't'
          : '';
    if (!name) {
      const gt = body.indexOf('>', tagStart);
      cursor = gt === -1 ? body.length : gt + 1;
      continue;
    }
    const span = nextElement(body, tagStart, name);
    if (!span) break;
    if (name === 'rPh') {
      cursor = span.end;
      continue;
    }
    if (name === 'r') {
      const [first] = elementInners(body.slice(span.innerStart, span.innerEnd), 't');
      if (first !== undefined) runs.push(textOfTag(first));
      cursor = span.end;
      continue;
    }
    if (direct === null) direct = textOfTag(body.slice(span.innerStart, span.innerEnd));
    cursor = span.end;
  }
  return direct ?? runs.join('');
}

/** The shared-string table, with the bytes it cost, so a caller can charge them. */
async function readSharedStringsWithSize(zip: JSZip, limit: number): Promise<{ values: string[]; bytes: number }> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return { values: [], bytes: 0 };
  const bytes = await readZipEntryBounded(file, limit).catch((error: unknown) => {
    if (error instanceof ExtractionError && error.code === 'too_large') throw error;
    throw new ExtractionError('corrupt', 'The shared strings table could not be read. It may be damaged or encrypted.');
  });
  return { values: parseSharedStringsXml(bytes.toString('utf8')), bytes: bytes.length };
}

export async function readSharedStrings(zip: JSZip, limit: number = MAX_ZIP_ENTRY_BYTES): Promise<string[]> {
  return (await readSharedStringsWithSize(zip, limit)).values;
}

function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1] || 'A';
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function readSheetRows(sheetXml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowInner of elementInners(sheetXml, 'row')) {
    const cells: string[] = [];
    let cellCursor = 0;
    for (;;) {
      const cell = nextElement(rowInner, cellCursor, 'c', true);
      if (!cell) break;
      cellCursor = cell.end;
      const attrs = rowInner.slice(cell.open + 2, rowInner.indexOf('>', cell.open));
      const cellInner = rowInner.slice(cell.innerStart, cell.innerEnd);
      const reference = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] || 'A1';
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cellInner)?.[1]
        ?? /<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cellInner)?.[1]
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
// Bounded entry reads
//
// A ZIP is a claim, not a fact. An entry can declare 200 bytes and expand to
// gigabytes (the deflate format allows ~1032:1), so the declared size in the
// central directory is only ever used as a cheap early signal — never as the
// limit itself. Reading an entry with `entry.async()` and then measuring the
// result enforces the limit *after* the allocation has already happened, which
// is the wrong side of the check.
//
// Two mechanisms enforce it during decompression instead:
//
//   1. the primary path decompresses with `zlib.inflateRawSync(...,
//      { maxOutputLength })`, which aborts inside zlib the moment the output
//      would pass the budget (ERR_BUFFER_TOO_LARGE) — the allocation never
//      exceeds the limit by more than zlib's internal buffer;
//   2. the fallback path (used if a future JSZip changes its internals) reads
//      through JSZip's own chunked stream and pauses the decompressor as soon as
//      the running count passes the budget. That overshoots by at most one
//      16 KiB input block (~17 MB at the format's maximum ratio) rather than by
//      the size of the entry, and it is bounded rather than unbounded.
//
// Both paths are driven by a byte budget computed by the caller: the smaller of
// the per-file limit and whatever is left of the archive-wide total, so the
// aggregate limit is enforced entry by entry rather than after the fact.
// ---------------------------------------------------------------------------

/** The parts of JSZip's internal compressed-entry record this file relies on. */
interface ZipEntryData {
  compression?: { magic?: string };
  compressedContent?: Promise<unknown>;
  compressedSize?: number;
  uncompressedSize?: number;
}

// JSZip identifies a compression method by the two-byte magic string it writes
// into the archive, not by the numeric method id. Reading it as a number silently
// never matches, which would send every entry down the coarser fallback path -
// so these literals are exercised by tests/zip-bounds.test.ts.
const ZIP_MAGIC_STORE = '\x00\x00';
const ZIP_MAGIC_DEFLATE = '\x08\x00';

/** The stream helper surface used by the fallback reader. */
interface ZipStreamHelper {
  on: (event: 'data' | 'end' | 'error', handler: (chunk?: Uint8Array) => void) => ZipStreamHelper;
  resume: () => ZipStreamHelper;
  pause: () => ZipStreamHelper;
}

function tooLarge(): ExtractionError {
  return new ExtractionError('too_large', ZIP_TOO_LARGE_MESSAGE);
}

function unreadableEntry(): ExtractionError {
  return new ExtractionError('corrupt', 'This file could not be decompressed. It may be damaged or encrypted.');
}

/** Inflate raw deflate output, refusing to allocate more than `limit` bytes. */
function inflateBounded(compressed: Buffer, limit: number): Buffer {
  try {
    return inflateRawSync(compressed, { maxOutputLength: limit });
  } catch (error) {
    // zlib refuses to grow the output buffer past the ceiling it was given. Any
    // other failure means the stream itself is not valid deflate.
    if ((error as NodeJS.ErrnoException)?.code === 'ERR_BUFFER_TOO_LARGE') throw tooLarge();
    throw unreadableEntry();
  }
}

/**
 * Read one entry through JSZip's chunked stream, pausing the decompressor the
 * moment the byte count passes the budget. Used only when the primary path
 * cannot see the compressed bytes.
 */
function streamEntryBounded(entry: JSZip.JSZipObject, limit: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const helper = (entry as unknown as { internalStream: (type: string) => ZipStreamHelper })
      .internalStream('uint8array');
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      // Stop the worker chain rather than letting it run on for a reader that
      // has already given up. `pause` propagates to the source worker, so no
      // further input is fed to the inflater.
      try { helper.pause(); } catch { /* already stopped */ }
      finish();
    };

    helper
      .on('data', (chunk?: Uint8Array) => {
        if (settled || !chunk) return;
        total += chunk.length;
        if (total > limit) {
          settle(() => reject(tooLarge()));
          return;
        }
        chunks.push(Buffer.from(chunk));
      })
      .on('error', () => settle(() => reject(unreadableEntry())))
      .on('end', () => settle(() => resolve(Buffer.concat(chunks))));

    helper.resume();
  });
}

/**
 * Read one entry, holding at most `limit` decompressed bytes.
 *
 * Throws `too_large` when the entry expands past the budget and `corrupt` when
 * the entry cannot be decompressed at all. Callers treat the first as fatal for
 * the whole archive and the second as a per-file warning.
 */
export async function readZipEntryBounded(entry: JSZip.JSZipObject, limit: number): Promise<Buffer> {
  if (!Number.isFinite(limit) || limit <= 0) throw tooLarge();

  const data = (entry as unknown as { _data?: ZipEntryData })._data;
  const method = data?.compression?.magic;

  if (data?.compressedContent && (method === ZIP_MAGIC_STORE || method === ZIP_MAGIC_DEFLATE)) {
    // The compressed bytes are a slice of the upload, which the route already
    // capped at 20 MB, so materialising them allocates nothing new. What must be
    // bounded is the expansion, and that is where the limit is applied.
    const stored = await data.compressedContent;
    const compressed = Buffer.isBuffer(stored) ? stored : Buffer.from(stored as Uint8Array);
    if (method === ZIP_MAGIC_STORE) {
      if (compressed.length > limit) throw tooLarge();
      return compressed;
    }
    return inflateBounded(compressed, limit);
  }

  // Unknown container internals: still bounded, by the streaming counter.
  return streamEntryBounded(entry, limit);
}

/**
 * Read one entry as text, bounded by the same per-file ceiling as a ZIP entry.
 *
 * A .docx and a .xlsx are ZIP containers too, so the expansion limit cannot stop
 * at `.zip` uploads: an upload that is 20 MB on the wire (the route's cap) can
 * hold a `word/document.xml` that inflates to gigabytes. These parts go through
 * the same bounded reader as archive entries.
 */
async function readEntryText(entry: JSZip.JSZipObject, what: string, limit: number = MAX_ZIP_ENTRY_BYTES): Promise<string> {
  try {
    const bytes = await readZipEntryBounded(entry, limit);
    return bytes.toString('utf8');
  } catch (error) {
    if (error instanceof ExtractionError && error.code === 'too_large') throw error;
    throw new ExtractionError('corrupt', `The ${what} could not be read. It may be damaged or encrypted.`);
  }
}

/** One entry's outcome, so a caller can warn about a single bad file. */
export type ArchiveEntryRead =
  | { name: string; ok: true; bytes: Buffer }
  | { name: string; ok: false; reason: string };

export interface ArchiveLimits {
  /** Ceiling for one decompressed entry. */
  maxEntryBytes: number;
  /** Ceiling for the decompressed entries of one archive, summed as they are read. */
  maxTotalBytes: number;
}

/**
 * Hand the event loop a turn.
 *
 * Everything in this file except the property reads is synchronous CPU: zlib's
 * inflate cannot be interrupted. `await` on an already-resolved promise only
 * drains the microtask queue, which does *not* let pending I/O run - so without
 * this, reading a 60-entry archive holds the loop for the whole expansion
 * (~61 ms measured for the 76 MB the limits allow). Yielding between entries
 * bounds the contiguous stall to one entry's inflation (20 MB is ~23 ms
 * measured) and lets health checks and other users' requests through in between.
 *
 * This does not make a single entry non-blocking: interrupting it needs a worker
 * thread. See docs/audit/VERIFICATION-AUDIT.md, session 15, for that trade-off.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Read every entry under a per-entry ceiling *and* an archive-wide ceiling.
 *
 * The aggregate budget is handed to each read as its own ceiling (the per-entry
 * limit or whatever remains of the total, whichever is smaller), so the total
 * cannot be exceeded even by an archive whose files are each individually legal.
 * Exceeding either limit throws `too_large` and stops the whole read — there is
 * no partial result for the caller to import by mistake.
 */
export async function readArchiveEntries(
  entries: JSZip.JSZipObject[],
  limits: ArchiveLimits = { maxEntryBytes: MAX_ZIP_ENTRY_BYTES, maxTotalBytes: MAX_ZIP_UNCOMPRESSED_BYTES },
): Promise<ArchiveEntryRead[]> {
  const results: ArchiveEntryRead[] = [];
  let total = 0;
  for (const entry of entries) {
    const remaining = limits.maxTotalBytes - total;
    const budget = Math.min(limits.maxEntryBytes, remaining);
    if (budget <= 0) throw tooLarge();
    let bytes: Buffer;
    try {
      bytes = await readZipEntryBounded(entry, budget);
    } catch (error) {
      // A size violation is about the archive, so it is fatal; an unreadable
      // file is about that file, so the rest of the archive is still read.
      if (error instanceof ExtractionError && error.code === 'too_large') throw error;
      results.push({
        name: entry.name,
        ok: false,
        reason: error instanceof ExtractionError ? error.message : 'could not be read.',
      });
      continue;
    }
    // The read was capped at `budget`, so `total` can never pass the ceiling;
    // the accounting here only advances the running total.
    total += bytes.byteLength;
    results.push({ name: entry.name, ok: true, bytes });
    // Give the event loop a turn before inflating the next entry.
    await yieldToEventLoop();
  }
  return results;
}

// ---------------------------------------------------------------------------
// ZIP archives
// ---------------------------------------------------------------------------

async function extractZip(buffer: Buffer, limits?: Partial<ArchiveLimits>): Promise<Extraction> {
  const archive: ArchiveLimits = {
    maxEntryBytes: Math.min(limits?.maxEntryBytes ?? MAX_ZIP_ENTRY_BYTES, MAX_ZIP_ENTRY_BYTES),
    maxTotalBytes: Math.min(limits?.maxTotalBytes ?? MAX_ZIP_UNCOMPRESSED_BYTES, MAX_ZIP_UNCOMPRESSED_BYTES),
  };
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

  const items: ExtractedItem[] = [];
  const warnings: string[] = [];
  const skipped = entries.filter((file) => !isSupportedUpload(file.name)).map((file) => file.name);
  if (skipped.length) {
    warnings.push(`Skipped ${skipped.length} unsupported file${skipped.length === 1 ? '' : 's'}: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
  }
  // Nested archives are refused before any decompression is spent on them.
  if (supported.some((entry) => extensionOf(entry.name) === '.zip')) {
    throw new ExtractionError('unsupported', 'Nested ZIP archives are not supported. Upload the inner files directly.');
  }

  // Every entry is read under both ceilings: the per-file one and what is left
  // of the archive-wide one. A size violation throws out of here (nothing is
  // imported); an unreadable file becomes a warning so the rest of the archive
  // is still reviewed.
  const reads = await readArchiveEntries(supported, archive);

  // The entries above were measured in their *compressed form*. A .docx or
  // .xlsx entry is itself a compressed container, so parsing it expands more
  // bytes that the archive-wide ceiling must also cover — otherwise a 4 KB
  // archive of tiny Word files can expand without limit. `remaining` is what is
  // left of the archive budget, and each nested extraction draws from it.
  let remaining = archive.maxTotalBytes - reads.reduce((total, read) => total + (read.ok ? read.bytes.length : 0), 0);

  for (const read of reads) {
    if (read.ok === false) {
      warnings.push(`${read.name}: ${read.reason}`);
      continue;
    }
    let nested: Extraction;
    try {
      if (remaining <= 0) throw tooLarge();
      nested = await extractQuestions(read.bytes, read.name, {
        maxEntryBytes: Math.min(archive.maxEntryBytes, remaining),
        maxTotalBytes: remaining,
      });
    } catch (error) {
      // A size violation is about the archive as a whole, exactly as it is for
      // the outer entries: it stops the import rather than being skipped. Any
      // other failure is about one file, so the rest of the archive is kept.
      if (error instanceof ExtractionError && error.code === 'too_large') throw tooLarge();
      warnings.push(`${read.name}: ${error instanceof ExtractionError ? error.message : 'could not be read.'}`);
      continue;
    }
    remaining -= nested.expandedBytes ?? 0;
    // A nested container that could not fit its parts in `remaining` would have
    // thrown; this is the belt-and-braces check that the sum stays honest.
    if (remaining < 0) throw tooLarge();
    if (!nested.items.length) {
      warnings.push(`${read.name}: no questions were recognised.`);
      continue;
    }
    warnings.push(`${read.name}: ${nested.items.length} question${nested.items.length === 1 ? '' : 's'}.`);
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
