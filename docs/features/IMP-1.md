# IMP-1 · Past-question import with human review

**Status:** built
**Entry point:** `/admin/question-imports`
**API:** `/api/admin/question-imports/*`
**Tables:** `question_imports`, `question_import_items` (server-only)
**Bucket:** `past-questions` (private)

## Why

Uploading a past paper used to mean retyping every question into the CBT
manager. IMP-1 reads the file, proposes questions and options, and puts them in
a review queue. Extraction never writes to a student-facing bank: a question
becomes live only when an administrator approves it and saves the import.

## Flow

```
upload (base64) ──► storage: past-questions/{exam}/{year}/{subject}/{uuid}-{name}
                 └► question_imports (queued)
                        │ claim_question_import()
                        ▼
                    processing ──► extractor ──► question_import_items (pending)
                        │                              │
                        │ failure                      │ edit / approve / reject
                        ▼                              ▼
                     failed ──retry──►            extracted
                                                       │ commit_question_import()
                                                       ▼
                                             exam_questions (approved)
```

The setup screen and the paper reader see the new rows immediately because
`commit_question_import()` writes the same `exam_questions` table every other
CBT path reads. There is no second publishing step.

## Supported formats

| Format | Reader | Notes |
|---|---|---|
| `.pdf` | `pdf-parse` (pdf.js text layer) | Scanned PDFs are rejected with an OCR-required message; they are not turned into empty questions. Page count capped at 300. |
| `.docx` | JSZip + OOXML text reader | Tables become tab-separated rows. Images are counted and reported, not attached. |
| `.xlsx` | JSZip + OOXML shared strings | Multiple worksheets are read in order. |
| `.csv` / `.tsv` | quote-aware parser | Header row maps question/option/answer/explanation/passage/topic columns; a headerless five-column sheet is also accepted. |
| `.json` | JSON | Array or `{ "questions": [...] }`; options as an array, an object or `option_a..e`. |
| `.txt` / `.md` | prose parser | Numbered questions, A-E options (separate or inline), inline/trailing answer keys, passages, explanations. |
| `.zip` | JSZip | Up to 60 entries, 20 MB per entry, 80 MB uncompressed; nested ZIPs refused; unreadable members are reported and skipped. |

`.doc`, `.xls`, `.rtf`, `.odt` and image files are refused with a specific
message (`UNSUPPORTED_EXTENSIONS`), not accepted silently. OCR is not enabled
on this deployment; that is a deliberate limit rather than a claim that scans
are supported.

Every upload is capped at 20 MB. The server checks the file signature (PDF
magic bytes, ZIP local-file header, no NUL in text formats) instead of trusting
the extension.

## Review rules

`validateItem()` is the single authority used by the editor, the approve action
and the save action:

- question text is present and at least eight characters;
- exactly four options, A-D, all non-empty and distinct;
- a correct option is present and is A-D;
- a fifth option is reported, never dropped (the CBT engine stores four);
- an item with no answer key is a valid *draft* but cannot be approved.

The extractor never invents a key. A missing answer stays `null` until a human
chooses one. Approving is a per-item action; there is no "approve all extracted
text" shortcut.

## Idempotency and duplicates

- `sha256` of the file plus `(exam_id, subject)` is unique among non-archived
  imports; re-uploading the same bytes returns the existing import.
- Extraction runs under `claim_question_import()`, an atomic
  `queued → processing` transition with an attempt cap of five.
- `finish_question_import()` replaces only the staging list; it refuses a job
  that is not processing, and it refuses to replace a queue that already holds
  approved, rejected or imported items. A retry can therefore never delete a
  reviewer's decisions.
- The upload form and the review screen let an administrator correct the bank,
  subject, year and source until the first question is saved. After that the
  association is frozen because the saved rows carry it as provenance.
- `commit_question_import()` is transactional. Approved items with a
  `question_id` are skipped, so pressing Save twice cannot duplicate rows.
- A question whose normalised text already exists in the bank is marked
  rejected with an explanation and is not inserted.

## Security and ownership

- Every route requires `cbt.manage` or `data.import`; the browser never talks to
  the tables directly.
- Both tables have RLS enabled, no policies, and no grants to `anon` or
  `authenticated`; `service_role` is the only reader/writer.
- The bucket is private. Downloads use a five-minute signed URL created after
  the capability check.
- Filenames are sanitised and the object key is generated server-side; the
  client cannot choose a path.
- Deleting an import is refused once it has produced questions. Deleting a
  source file therefore cannot cascade into shared practice content.
- `exam_questions.import_id` records provenance and is `ON DELETE SET NULL`.

## Background processing

The upload request stores the file and returns `202` immediately. Processing
starts in-process; the detail endpoint also claims a queued job, so a serverless
instance that ends after the response cannot strand the upload. A list request
sweeps jobs left in `processing` for more than 15 minutes. `POST .../retry`
re-runs a failed extraction.

The job table is the source of truth for progress: `queued`, `processing`,
`extracted`, `failed`, `completed`. The console polls the detail endpoint every
two seconds while a job is active.

## Deployment requirements

1. Apply `20261023120000_question_import_pipeline.sql`. It creates both tables,
   the RPCs and the private `past-questions` bucket, and adds
   `exam_questions.import_id`.
2. `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) must be present on the
   server; the browser never receives it.
3. Netlify functions list `pdf-parse` in `external_node_modules` because the
   library loads its bundled pdf.js through a computed `require`. A long-lived
   Node/Docker deployment (the repository's `Dockerfile`) is the better host for
   large PDFs: serverless functions have a request time limit, and extraction is
   the slow part.
4. No environment flag enables or disables the feature; the capability check and
   the migration are the only switches.

## Tests

- `tests/question-extract.test.ts` — real PDF/DOCX/XLSX/CSV/TSV/JSON/text/ZIP
  parsing, scanned-PDF refusal, malformed archive, validation rules.
- `tests/question-import.test.ts` — claim/extract/approve/save against PGlite,
  idempotent save, duplicate skip, provenance, client-role denial, and the
  availability/paper readers seeing saved questions immediately.
- `tests/api.test.ts` — every new admin route rejects anonymous callers.
