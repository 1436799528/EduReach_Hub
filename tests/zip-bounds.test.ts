import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
import {
  ExtractionError,
  ZIP_LIMITS,
  ZIP_TOO_LARGE_MESSAGE,
  extractQuestions,
  readArchiveEntries,
  readZipEntryBounded,
} from '../src/server/question-import/extract';

// EXT-2 / AUD-9: a ZIP entry must not be decompressed before its size is
// checked.
//
// The old reader was `const bytes = await entry.async('uint8array')` followed by
// `if (bytes.byteLength > 20MB)`. The measurement happened after the allocator
// had already produced the whole expansion, so a 60 MB entry that declares 200
// bytes was fully materialised in memory before being rejected. These tests
// exercise the machinery that replaced it, and are written so that restoring
// `entry.async()` fails them (see the comments: the aggregate and budget tests
// assert the *budget arithmetic*, which the old code did not have at all).
//
// Nothing here allocates gigabytes: the per-entry ceiling is asserted against
// the shipped constant, and the budget arithmetic is proven with small limits.

const LIMITS = { maxEntryBytes: 4 * 1024, maxTotalBytes: 10 * 1024 };

async function archive(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
}

function tooLarge(error: unknown): boolean {
  return error instanceof ExtractionError && error.code === 'too_large';
}

test('the shipped limits are the product limits', () => {
  // Guards against "fixing" a size problem by lowering a limit.
  assert.equal(ZIP_LIMITS.maxEntryBytes, 20 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.maxTotalBytes, 80 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.maxEntries, 60);
});

test('an entry that expands past its budget is refused, and the message is the operator-facing one', async () => {
  const zip = await JSZip.loadAsync(await archive({ 'big.txt': Buffer.alloc(64 * 1024, 0x41) }));
  await assert.rejects(
    () => readZipEntryBounded(zip.file('big.txt')!, LIMITS.maxEntryBytes),
    (error: unknown) => {
      assert.ok(tooLarge(error), 'a size violation must be reported as too_large, not as corruption');
      assert.equal((error as ExtractionError).message, ZIP_TOO_LARGE_MESSAGE);
      assert.match((error as ExtractionError).message, /20 MB file \/ 80 MB total/);
      return true;
    },
  );
});

test('an entry inside its budget is returned byte-for-byte', async () => {
  const body = '1. What is 2 + 2?\nA. 2\nB. 4\nC. 6\nD. 8\nAnswer: B\n';
  const zip = await JSZip.loadAsync(await archive({ 'ok.txt': body }));
  const bytes = await readZipEntryBounded(zip.file('ok.txt')!, LIMITS.maxEntryBytes);
  assert.equal(bytes.toString('utf8'), body);
});

test('the archive-wide budget is enforced across entries that are individually legal', async () => {
  // Six 1 KiB files: each is under the 4 KiB per-file ceiling, but together they
  // pass the 10 KiB archive ceiling. The old code added sizes up only after
  // reading each one in full.
  const files: Record<string, Buffer> = {};
  for (let index = 0; index < 6; index += 1) files[`p${index}.txt`] = Buffer.alloc(2048, 0x41);
  const zip = await JSZip.loadAsync(await archive(files));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  await assert.rejects(
    () => readArchiveEntries(entries, LIMITS),
    (error: unknown) => tooLarge(error),
    'six legal files that together exceed the total must be refused',
  );
});

test('the aggregate budget is spent as entries are read, not only at the end', async () => {
  // The last file would fit on its own; it does not fit in what is left.
  const files: Record<string, Buffer> = {
    'a.txt': Buffer.alloc(3 * 1024, 0x41),
    'b.txt': Buffer.alloc(3 * 1024, 0x41),
    'c.txt': Buffer.alloc(3 * 1024, 0x41),
    'd.txt': Buffer.alloc(3 * 1024, 0x41),
  };
  const zip = await JSZip.loadAsync(await archive(files));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir).sort((a, b) => a.name.localeCompare(b.name));
  await assert.rejects(() => readArchiveEntries(entries, LIMITS), (error: unknown) => tooLarge(error));

  // The same four files fit when the ceiling admits them: the arithmetic is a
  // budget, not a blanket refusal of multi-file archives.
  const generous = await readArchiveEntries(entries, { maxEntryBytes: 4 * 1024, maxTotalBytes: 12 * 1024 });
  assert.equal(generous.length, 4);
  assert.ok(generous.every((entry) => entry.ok));
});

test('a client that grows while being read is stopped, not read to the end', async () => {
  // Proves the enforcement is incremental. The fake reports how much it was
  // asked to produce: it must stop shortly after the budget, not after the whole
  // entry. (A `async()`-style reader would hand over everything at once.)
  const calls: number[] = [];
  const entry = {
    name: 'streamed.txt',
    _data: undefined, // force the streaming path
    internalStream: () => {
      let total = 0;
      let finished = false;
      const listeners: Record<string, Array<(chunk?: Uint8Array) => void>> = { data: [], end: [], error: [] };
      const emit = (event: string, chunk?: Uint8Array) => {
        for (const handler of listeners[event]) handler(chunk);
      };
      const tick = () => {
        if (finished) return;
        if (total >= 64 * 1024) { finished = true; emit('end'); return; }
        const chunk = new Uint8Array(1024);
        total += chunk.length;
        calls.push(chunk.length);
        emit('data', chunk);
        setImmediate(tick);
      };
      const helper = {
        on(event: string, handler: (chunk?: Uint8Array) => void) { listeners[event].push(handler); return helper; },
        resume() { setImmediate(tick); return helper; },
        pause() { finished = true; return helper; },
      };
      return helper;
    },
  };

  await assert.rejects(
    () => readZipEntryBounded(entry as never, 4 * 1024),
    (error: unknown) => tooLarge(error),
  );
  const produced = calls.reduce((sum, size) => sum + size, 0);
  assert.ok(produced <= 4 * 1024 + 1024, `the reader consumed ${produced} bytes for a 4 KiB budget: it did not stop at the limit`);
});

test('a declared size in the archive header cannot raise the real limit', async () => {
  // The dangerous case: the central directory claims the entry is small. The
  // decompressor is the only thing that knows the truth, so the limit has to be
  // applied while inflating. The header fields are patched here to a value far
  // below the real expansion — an archive a naive "check the declared size"
  // implementation would wave through.
  const realSize = 8 * 1024 * 1024;
  const body = Buffer.alloc(realSize, 0x41);
  const zipBuffer = await archive({ 'liar.txt': body });

  const stated = 512;
  const localHeader = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const centralHeader = zipBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(localHeader >= 0 && centralHeader >= 0, 'the archive must have both headers');
  zipBuffer.writeUInt32LE(stated, localHeader + 22); // uncompressed size, local file header
  zipBuffer.writeUInt32LE(stated, centralHeader + 24); // uncompressed size, central directory

  const loaded = await JSZip.loadAsync(zipBuffer);
  const entry = loaded.file('liar.txt')!;
  assert.equal((entry as unknown as { _data: { uncompressedSize: number } })._data.uncompressedSize, stated, 'the fixture must actually lie');

  const budget = 1024 * 1024; // 1 MiB, while the entry really holds 8 MiB
  await assert.rejects(
    () => readZipEntryBounded(entry, budget),
    (error: unknown) => tooLarge(error),
    'an entry that lies about its size must still be refused',
  );
});

test('a deflate bomb is refused without inflating it in full', async () => {
  // 24 MiB of zeros compresses to ~24 KiB: a 1000:1 ratio, the shape of a real
  // bomb. The archive itself is far below the 20 MB upload cap, so only the
  // expansion check can stop it.
  const bomb = Buffer.alloc(24 * 1024 * 1024, 0);
  const raw = deflateRawSync(bomb, { level: 9 });
  assert.ok(raw.length < 64 * 1024, `fixture should be tiny on the wire, was ${raw.length}`);

  const zip = new JSZip();
  zip.file('bomb.txt', bomb);
  const archiveBytes = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  assert.ok(archiveBytes.length < 1024 * 1024, 'the uploaded archive must be small for this to be a bomb');

  await assert.rejects(
    () => extractQuestions(archiveBytes, 'paper.zip'),
    (error: unknown) => {
      assert.ok(tooLarge(error), `expected too_large, got ${(error as Error)?.message}`);
      assert.equal((error as ExtractionError).message, ZIP_TOO_LARGE_MESSAGE);
      return true;
    },
    'a 24 MiB expansion inside a 24 KiB upload must be refused',
  );
});

test('malformed and truncated archives fail safely', async () => {
  const good = await archive({ 'ok.txt': 'hello' });

  await assert.rejects(
    () => extractQuestions(Buffer.from('definitely not a zip'), 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'corrupt',
  );
  await assert.rejects(
    () => extractQuestions(good.subarray(0, Math.floor(good.length / 2)), 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && (error.code === 'corrupt' || error.code === 'empty'),
    'half an archive must not be read as a complete one',
  );
  // A truncated entry inside an otherwise valid directory: the archive opens,
  // the entry cannot be inflated. That is a per-file warning, not a crash.
  await assert.rejects(
    () => extractQuestions(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && ['corrupt', 'empty'].includes(error.code),
  );
});

test('a corrupt entry does not discard the readable files beside it', async () => {
  // The archive is built, then one entry's compressed bytes are scrambled in
  // place. The reader must report that file and still return the other one.
  const zipBuffer = await archive({
    'a-good.txt': '1. What is 1 + 1?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B\n',
    'b-broken.txt': '1. What is 3 + 3?\nA. 5\nB. 6\nC. 7\nD. 8\nAnswer: B\n',
  });
  const loaded = await JSZip.loadAsync(zipBuffer, { checkCRC32: false });
  const broken = loaded.file('b-broken.txt')!;
  const data = (broken as unknown as { _data: { compressedContent: Promise<Buffer> } })._data;
  const original = await data.compressedContent;
  // Not valid deflate any more, still the right length and CRC-agnostic.
  data.compressedContent = Promise.resolve(Buffer.alloc(original.length, 0xff));

  const entries = [loaded.file('a-good.txt')!, broken];
  const reads = await readArchiveEntries(entries, { maxEntryBytes: 1024 * 1024, maxTotalBytes: 4 * 1024 * 1024 });
  assert.equal(reads.length, 2);
  assert.equal(reads[0].ok, true, 'the readable file must still be returned');
  const failed = reads[1];
  assert.equal(failed.ok, false);
  assert.match(failed.ok === false ? failed.reason : '', /damaged or encrypted/);
});

test('a nested archive is refused before it is decompressed', async () => {
  const inner = await archive({ 'x.txt': 'hello' });
  const outer = await archive({ 'inner.zip': inner, 'ok.txt': '1. What is 2 + 2?\nA. 2\nB. 4\nC. 6\nD. 8\nAnswer: B\n' });
  await assert.rejects(
    () => extractQuestions(outer, 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && error.code === 'unsupported' && /Nested ZIP/.test(error.message),
  );
});

test('a valid archive still extracts, with its unsupported files reported', async () => {
  const result = await extractQuestions(
    await archive({
      'one.txt': '1. What is 1 + 1?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B\n',
      'two.txt': '1. What is 2 + 2?\nA. 2\nB. 3\nC. 4\nD. 5\nAnswer: C\n',
      'notes.doc': 'legacy',
    }),
    'paper.zip',
  );
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].correctOption, 'B');
  assert.equal(result.items[1].correctOption, 'C');
  assert.ok(result.warnings.some((warning) => warning.includes('notes.doc')), 'the skipped file is named');
});

test('the entry-count ceiling is unchanged and still explained', async () => {
  const files: Record<string, string> = {};
  for (let index = 0; index <= ZIP_LIMITS.maxEntries; index += 1) files[`f${index}.txt`] = 'x';
  const many = await archive(files);
  await assert.rejects(
    () => extractQuestions(many, 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError
      && error.code === 'too_large'
      && /at most 60 can be read at once/.test(error.message),
  );
});

test('the exact zlib-bounded path is the one actually used, not the coarse fallback', async () => {
  // Regression for a real mistake made while writing this fix: JSZip records a
  // compression method as a two-byte magic string ("\x08\x00"), not as the
  // numeric id 8. Comparing against a number never matched, so every entry
  // silently took the streaming fallback - which enforces the limit, but with a
  // one-block overshoot. This test makes the fallback impossible to use and
  // still requires a successful read, so a wrong method check fails loudly.
  const zip = await JSZip.loadAsync(await archive({ 'ok.txt': 'hello world' }));
  const entry = zip.file('ok.txt')!;
  (entry as unknown as { internalStream: () => never }).internalStream = () => {
    throw new Error('the streaming fallback was used where the exact path was available');
  };
  const bytes = await readZipEntryBounded(entry, 1024);
  assert.equal(bytes.toString('utf8'), 'hello world');
});

test('a stored (uncompressed) entry is measured before it is accepted', async () => {
  const zip = new JSZip();
  zip.file('stored.txt', Buffer.alloc(4096, 0x42), { compression: 'STORE' });
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
  const loaded = await JSZip.loadAsync(buffer);
  const entry = loaded.file('stored.txt')!;
  // The stored branch returns the bytes as they are, so its own length check is
  // the only thing standing between an oversized entry and the caller.
  await assert.rejects(() => readZipEntryBounded(entry, 1024), (error: unknown) => tooLarge(error));
  const fine = await readZipEntryBounded(entry, 8192);
  assert.equal(fine.length, 4096);
});

test('a Word document carrying a compressed bomb is refused like any other archive', async () => {
  // A .docx is a ZIP. The upload cap measures the file on the wire, so a 24 MiB
  // XML part inside a small document would otherwise expand without limit.
  const xmlPart = `<document>${'a'.repeat(24 * 1024 * 1024)}</document>`;
  const zip = new JSZip();
  zip.file('word/document.xml', xmlPart);
  const bytes = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  assert.ok(bytes.length < 1024 * 1024, `the fixture must be small on the wire, was ${bytes.length}`);

  await assert.rejects(
    () => extractQuestions(bytes, 'paper.docx'),
    (error: unknown) => {
      assert.ok(tooLarge(error), `expected too_large, got ${(error as Error)?.message}`);
      return true;
    },
  );
});

test('an Excel workbook carrying a compressed bomb is refused too', async () => {
  const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${'a'.repeat(24 * 1024 * 1024)}</t></is></c></row></sheetData></worksheet>`;
  const zip = new JSZip();
  zip.file('xl/worksheets/sheet1.xml', sheet);
  const bytes = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  await assert.rejects(
    () => extractQuestions(bytes, 'paper.xlsx'),
    (error: unknown) => tooLarge(error),
  );
});

test('ordinary Word and Excel documents still read', async () => {
  // The bound must not break the formats it protects.
  const docx = new JSZip();
  docx.file('word/document.xml', '<document><body><w:p><w:r><w:t>1. What is 2 + 2?</w:t></w:r></w:p><w:p><w:r><w:t>A. 2</w:t></w:r></w:p><w:p><w:r><w:t>B. 4</w:t></w:r></w:p><w:p><w:r><w:t>C. 6</w:t></w:r></w:p><w:p><w:r><w:t>D. 8</w:t></w:r></w:p><w:p><w:r><w:t>Answer: B</w:t></w:r></w:p></body></document>');
  const docxBytes = Buffer.from(await docx.generateAsync({ type: 'nodebuffer' }));
  const word = await extractQuestions(docxBytes, 'paper.docx');
  assert.ok(word.items.length >= 1, 'a normal docx must still yield questions');

  const xlsx = new JSZip();
  xlsx.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>1. What is 2 + 2?</t></is></c><c r="B1" t="inlineStr"><is><t>2</t></is></c><c r="C1" t="inlineStr"><is><t>4</t></is></c><c r="D1" t="inlineStr"><is><t>6</t></is></c><c r="E1" t="inlineStr"><is><t>8</t></is></c><c r="F1" t="inlineStr"><is><t>B</t></is></c></row>
  </sheetData></worksheet>`);
  const xlsxBytes = Buffer.from(await xlsx.generateAsync({ type: 'nodebuffer' }));
  const excel = await extractQuestions(xlsxBytes, 'paper.xlsx');
  assert.ok(excel.items.length >= 1, 'a normal xlsx must still yield questions');
});

// --- Boundary semantics -------------------------------------------------------
//
// The ceiling is inclusive: an entry of exactly the limit is accepted, one byte
// more is refused. That mirrors the product rule ("20 MB or smaller") and it is
// the behaviour zlib's `maxOutputLength` already has — verified directly against
// node:zlib before these tests were written. Pinning it stops a future refactor
// from silently becoming off-by-one in either direction.

test('an entry of exactly the limit is accepted', async () => {
  const exact = Buffer.alloc(LIMITS.maxEntryBytes, 0x41);
  const zip = await JSZip.loadAsync(await archive({ 'exact.txt': exact }));
  const bytes = await readZipEntryBounded(zip.file('exact.txt')!, LIMITS.maxEntryBytes);
  assert.equal(bytes.byteLength, LIMITS.maxEntryBytes);
});

test('an entry one byte over the limit is refused', async () => {
  const over = Buffer.alloc(LIMITS.maxEntryBytes + 1, 0x41);
  const zip = await JSZip.loadAsync(await archive({ 'over.txt': over }));
  await assert.rejects(() => readZipEntryBounded(zip.file('over.txt')!, LIMITS.maxEntryBytes), (error: unknown) => tooLarge(error));
});

test('a stored entry at and one byte over the limit', async () => {
  // The STORE branch measures length itself, so it has its own boundary.
  const build = async (size: number): Promise<JSZip.JSZipObject> => {
    const zip = new JSZip();
    zip.file('s.txt', Buffer.alloc(size, 0x42), { compression: 'STORE' });
    const loaded = await JSZip.loadAsync(Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })));
    return loaded.file('s.txt')!;
  };
  const at = await readZipEntryBounded(await build(LIMITS.maxEntryBytes), LIMITS.maxEntryBytes);
  assert.equal(at.byteLength, LIMITS.maxEntryBytes);
  await assert.rejects(() => build(LIMITS.maxEntryBytes + 1).then((entry) => readZipEntryBounded(entry, LIMITS.maxEntryBytes)), (error: unknown) => tooLarge(error));
});

test('an archive whose entries exactly fill the total budget is accepted; one more byte is not', async () => {
  // Four files of 3 KiB against a 12 KiB archive ceiling.
  const files: Record<string, Buffer> = {};
  for (let index = 0; index < 4; index += 1) files[`f${index}.txt`] = Buffer.alloc(3 * 1024, 0x43);
  const entries = Object.values((await JSZip.loadAsync(await archive(files))).files)
    .filter((entry) => !entry.dir)
    .sort((a, b) => a.name.localeCompare(b.name));

  const exact = await readArchiveEntries(entries, { maxEntryBytes: 4 * 1024, maxTotalBytes: 12 * 1024 });
  assert.equal(exact.length, 4);
  assert.ok(exact.every((entry) => entry.ok));

  // One byte less of total budget and the last file no longer fits.
  await assert.rejects(
    () => readArchiveEntries(entries, { maxEntryBytes: 4 * 1024, maxTotalBytes: 12 * 1024 - 1 }),
    (error: unknown) => tooLarge(error),
  );
});

test('an unsupported compression method fails safely rather than crashing', async () => {
  // Method 12 is bzip2: valid in the format, unsupported here. The archive must
  // not crash the request, and must not be reported as a successful import.
  const zip = new JSZip();
  zip.file('a.txt', '1. What is 2 + 2?\nA. 2\nB. 4\nC. 6\nD. 8\nAnswer: B\n');
  const buf = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const local = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  buf.writeUInt16LE(12, local + 8);
  buf.writeUInt16LE(12, central + 10);
  await assert.rejects(
    () => extractQuestions(buf, 'paper.zip'),
    (error: unknown) => error instanceof ExtractionError && ['corrupt', 'unsupported', 'empty'].includes(error.code),
    'an unsupported method must be a clean ExtractionError',
  );
});

// --- Event-loop fairness ------------------------------------------------------
//
// Reading an archive is synchronous CPU work. The ceiling on that work is the
// 80 MB budget (~61 ms measured for the worst archive the limits allow), and it
// used to be spent in ONE uninterrupted turn, because `await` on a resolved
// promise only drains the microtask queue. The reader now yields a macrotask
// between entries, so a concurrent request gets a turn.
//
// This test discriminates on ordering, not timing: microtasks run to completion
// before the next macrotask, so if the reader never yielded, the whole read would
// finish before the observer's `setImmediate` callback ran.

test('reading a multi-entry archive yields to the event loop between entries', async () => {
  const files: Record<string, Buffer> = {};
  for (let index = 0; index < 20; index += 1) files[`f${index}.txt`] = Buffer.alloc(1024, 0x44);
  const zip = await JSZip.loadAsync(await archive(files));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir).sort((a, b) => a.name.localeCompare(b.name));

  let readCompleted = false;
  const read = readArchiveEntries(entries, { maxEntryBytes: 4096, maxTotalBytes: 64 * 1024 })
    .then((read) => { readCompleted = true; return read; });

  // One macrotask turn. With no yield the read would already be complete here.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(readCompleted, false, 'the whole archive was read without yielding to the event loop');

  const completed = await read;
  assert.equal(completed.length, 20, 'yielding must not lose entries');
  assert.ok(completed.every((entry) => entry.ok));
});

test('yielding does not change any size verdict', async () => {
  // The fairness change must not soften the limits it sits beside.
  const files: Record<string, Buffer> = {};
  for (let index = 0; index < 6; index += 1) files[`f${index}.txt`] = Buffer.alloc(2048, 0x45);
  const zip = await JSZip.loadAsync(await archive(files));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  await assert.rejects(
    () => readArchiveEntries(entries, { maxEntryBytes: 4096, maxTotalBytes: 10 * 1024 }),
    (error: unknown) => tooLarge(error),
  );
});
