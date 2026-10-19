/**
 * Staff API for the past-question import pipeline.
 *
 * The browser uploads a file as a base64 data URL, chooses the bank and
 * subject, then reviews what the extractor found. The original is written to a
 * private storage bucket; extracted rows wait in `question_import_items` until
 * an administrator approves them and saves the import. Nothing is inserted into
 * a student-facing bank by extraction alone.
 *
 * Every route requires a CBT-management capability. The tables have no client
 * grants, and the storage bucket is private, so hiding the console is not the
 * access control.
 */

import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import express from 'express';
import { recordAudit } from '../../../lib/authorization';
import { userFacingError } from '../../../lib/errors';
import { isPdfBuffer } from '../../../lib/pdf-signature';
import {
  ExtractionError,
  SUPPORTED_EXTENSIONS,
  UNSUPPORTED_EXTENSIONS,
  extractQuestions,
  extensionOf,
  type ExtractedItem,
} from './extract';
import { normaliseItem, questionFingerprint, validateItem } from './validate';

const BUCKET = 'past-questions';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SUBJECT_LENGTH = 120;
const SELECT = [
  'id', 'exam_id', 'exam_body', 'subject', 'paper_year', 'source_name', 'source_url',
  'source_verified', 'original_filename', 'mime_type', 'file_bytes', 'status', 'attempts',
  'extraction_error', 'extraction_warnings', 'item_count', 'approved_count', 'imported_count',
  'duplicate_count', 'uploaded_by', 'created_at', 'updated_at', 'completed_at',
].join(',');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

// The Express server uses the Supabase client without generated database
// types (queries name their columns). The row shapes this module depends on are
// declared next to the queries instead of duplicating the whole schema here.
type Db = any;

type RouteDeps = {
  requireCapability: (...capabilities: Array<'cbt.manage' | 'data.import'>) => RequestHandler;
  rateLimitFor: (rule: { name: string; limit: number; windowSeconds: number; durable?: boolean }) => RequestHandler;
  adminUploadRateLimit: { name: string; limit: number; windowSeconds: number; durable?: boolean };
  adminImportRateLimit: { name: string; limit: number; windowSeconds: number; durable?: boolean };
  getSupabase: () => Db;
};

type ImportRow = {
  id: string;
  exam_id: string;
  exam_body: string;
  subject: string;
  paper_year: number | null;
  source_name: string | null;
  source_url: string | null;
  source_verified: boolean;
  original_filename: string;
  status: string;
  item_count: number;
  approved_count: number;
  imported_count: number;
  duplicate_count: number;
};

const activeJobs = new Set<string>();

function one(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function trimmed(value: unknown, max: number): string {
  return one(value).trim().slice(0, max);
}

function normaliseExamBody(value: string): 'JAMB' | 'WAEC' | 'NECO' | 'POST-UTME' | null {
  const body = value.trim().toUpperCase().replace(/\s+/g, '-');
  if (body === 'POST-UTME' || body === 'POSTUTME') return 'POST-UTME';
  return ['JAMB', 'WAEC', 'NECO'].includes(body) ? body as 'JAMB' | 'WAEC' | 'NECO' : null;
}

function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() || 'questions';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(-100);
  return cleaned || 'questions';
}

function subjectSlug(subject: string): string {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'subject';
}

function storagePath(body: string, year: number | null, subject: string, filename: string): string {
  return [
    'past-questions',
    body.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    year ? String(year) : 'undated',
    subjectSlug(subject),
    `${crypto.randomUUID()}-${safeFilename(filename)}`,
  ].join('/');
}

function decodeUpload(dataUrl: string): Buffer | null {
  const match = /^data:[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  return buffer.length ? buffer : null;
}

function looksLikeFormat(buffer: Buffer, extension: string): boolean {
  if (extension === '.pdf') return isPdfBuffer(buffer);
  if (['.docx', '.xlsx', '.zip'].includes(extension)) {
    return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  // Text formats must not contain NUL bytes. A binary renamed to .csv would
  // otherwise be parsed as mojibake and reported as "no questions".
  return !buffer.subarray(0, 4096).includes(0);
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof ExtractionError) return error.message;
  return userFacingError(error, fallback);
}

function assertSupabase(deps: RouteDeps): Db {
  try {
    return deps.getSupabase();
  } catch (error) {
    throw new Error(userFacingError(error, 'The database is not configured.'));
  }
}

async function loadBankTexts(supabase: Db, examId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('exam_questions')
    .select('id,question_text')
    .eq('exam_id', examId)
    .limit(5000);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(questionFingerprint(String(row.question_text || '')), String(row.id));
  }
  return map;
}

function payloadFor(item: ExtractedItem, duplicateOf: string | null) {
  const validation = validateItem(item, { duplicateOf });
  const issues = [...validation.blocking, ...validation.notes];
  return {
    sourceIndex: item.sourceIndex,
    questionText: item.questionText,
    optionA: item.optionA,
    optionB: item.optionB,
    optionC: item.optionC,
    optionD: item.optionD,
    optionE: item.optionE,
    correctOption: item.correctOption,
    explanation: item.explanation,
    passage: item.passage,
    topic: item.topic,
    rawText: item.rawText,
    issues,
    duplicateOf,
  };
}

async function failJob(supabase: Db, importId: string, message: string) {
  try {
    await supabase.rpc('fail_question_import', { p_import_id: importId, p_error: message });
  } catch (error) {
    console.error('Question import failure could not be recorded:', error instanceof Error ? error.message : 'unknown');
  }
}

async function processImport(importId: string, deps: RouteDeps): Promise<void> {
  if (activeJobs.has(importId)) return;
  activeJobs.add(importId);
  let supabase: Db | null = null;
  try {
    supabase = assertSupabase(deps);
    const { data: claimedValue, error: claimError } = await supabase.rpc('claim_question_import', { p_import_id: importId });
    if (claimError) throw claimError;
    const claimed = (Array.isArray(claimedValue) ? claimedValue[0] : claimedValue) as
      (ImportRow & { storage_path: string; original_filename: string }) | null;
    if (!claimed) return;

    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(claimed.storage_path);
    if (downloadError || !file) throw new Error('The uploaded file could not be read from storage.');

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractQuestions(buffer, claimed.original_filename);
    if (!extraction.items.length) {
      throw new ExtractionError(
        'empty',
        'No questions were recognised. Check that question numbers start at 1 and options are labelled A-D.',
      );
    }

    const existing = await loadBankTexts(supabase, claimed.exam_id);
    const seen = new Map<string, number>();
    const payload = extraction.items.map((item) => {
      const fingerprint = questionFingerprint(item.questionText);
      const duplicateOf = existing.get(fingerprint) || null;
      const repeated = seen.get(fingerprint);
      if (repeated) {
        item.rawText = item.rawText ? `${item.rawText}\n\n(Repeats the text of question ${repeated}.)` : '';
      } else {
        seen.set(fingerprint, item.sourceIndex);
      }
      return payloadFor(item, duplicateOf);
    });

    const warnings = [...extraction.warnings];
    const fifth = payload.filter((item) => item.optionE).length;
    if (fifth) warnings.push(`${fifth} question${fifth === 1 ? '' : 's'} came with five options; each one must be reduced to four before it can be approved.`);

    const { error: finishError } = await supabase.rpc('finish_question_import', {
      p_import_id: importId,
      p_items: payload,
      p_warnings: warnings,
    });
    if (finishError) throw finishError;
  } catch (error) {
    const message = formatError(error, 'Extraction failed. Check the file and try again.');
    if (supabase) await failJob(supabase, importId, message);
  } finally {
    activeJobs.delete(importId);
  }
}

async function sweepStale(supabase: Db) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    await supabase
      .from('question_imports')
      .update({ status: 'failed', extraction_error: 'Processing stopped before it finished. Retry the extraction.', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('updated_at', cutoff);
  } catch {
    // A sweep is housekeeping; it must not make the list request fail.
  }
}

export function registerQuestionImportRoutes(app: Express, deps: RouteDeps): void {
  const guard = deps.requireCapability('cbt.manage', 'data.import');
  const largeJson = express.json({ limit: '30mb' });

  app.get('/api/admin/question-imports/formats', guard, (_req, res) => {
    res.json({
      supported: SUPPORTED_EXTENSIONS,
      unsupported: UNSUPPORTED_EXTENSIONS,
      maxBytes: MAX_BYTES,
    });
  });

  app.get('/api/admin/question-imports', guard, async (_req, res) => {
    try {
      const supabase = assertSupabase(deps);
      await sweepStale(supabase);
      const { data, error } = await supabase
        .from('question_imports')
        .select(SELECT)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ items: data || [] });
    } catch (error) {
      console.error('Question import list failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to load the import history.' });
    }
  });

  app.post('/api/admin/question-imports', deps.rateLimitFor(deps.adminUploadRateLimit), guard, largeJson, async (req, res) => {
    try {
      const filename = one(req.body?.filename);
      if (!filename) return res.status(400).json({ error: 'Choose a file to upload.' });
      const extension = extensionOf(filename);
      if (!extension || !(SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)) {
        return res.status(415).json({
          error: UNSUPPORTED_EXTENSIONS[extension]
            || 'That file type is not supported. Upload a PDF, Word (.docx), Excel (.xlsx), CSV, TSV, JSON, text or ZIP file.',
        });
      }
      const buffer = decodeUpload(one(req.body?.dataUrl));
      if (!buffer) return res.status(400).json({ error: 'The upload is empty or was not sent as base64 data.' });
      if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'Question files must be 20 MB or smaller.' });
      if (!looksLikeFormat(buffer, extension)) {
        return res.status(400).json({ error: `The file does not look like a ${extension.slice(1).toUpperCase()} file. Check that the extension matches the content.` });
      }

      const examId = trimmed(req.body?.examId, 64);
      if (!/^[0-9a-f-]{36}$/i.test(examId)) return res.status(400).json({ error: 'Choose the examination bank this paper belongs to.' });
      const subject = trimmed(req.body?.subject, MAX_SUBJECT_LENGTH);
      if (!subject) return res.status(400).json({ error: 'Choose or enter the subject.' });
      const yearRaw = req.body?.paperYear;
      const paperYear = yearRaw === '' || yearRaw === null || yearRaw === undefined ? null : Number(yearRaw);
      if (paperYear !== null && (!Number.isInteger(paperYear) || paperYear < 1954 || paperYear > 2100)) {
        return res.status(400).json({ error: 'Enter a valid paper year.' });
      }
      const sourceName = trimmed(req.body?.sourceName, 240) || null;
      const sourceUrlRaw = trimmed(req.body?.sourceUrl, 500);
      let sourceUrl: string | null = null;
      if (sourceUrlRaw) {
        try {
          if (new URL(sourceUrlRaw).protocol !== 'https:') throw new Error();
          sourceUrl = sourceUrlRaw;
        } catch {
          return res.status(400).json({ error: 'Source links must use HTTPS.' });
        }
      }
      const sourceVerified = req.body?.sourceVerified === true;
      if (sourceVerified && !sourceName) {
        return res.status(400).json({ error: 'Enter the source or organisation before marking this paper verified.' });
      }

      const supabase = assertSupabase(deps);
      const { data: exam, error: examError } = await supabase
        .from('cbt_exams')
        .select('id,exam_body,title,is_active')
        .eq('id', examId)
        .maybeSingle();
      if (examError) throw examError;
      if (!exam || !exam.is_active) return res.status(404).json({ error: 'That CBT bank is not available.' });
      const examBody = normaliseExamBody(String(exam.exam_body || ''));
      if (!examBody) return res.status(400).json({ error: 'That bank does not belong to a supported examination body.' });

      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      const { data: existingRows, error: existingError } = await supabase
        .from('question_imports')
        .select(SELECT)
        .eq('exam_id', examId)
        .eq('checksum', checksum)
        .neq('status', 'archived')
        .limit(5);
      if (existingError) throw existingError;
      const existing = ((existingRows || []) as Array<{ subject: string }>).find(
        (row) => String(row.subject).trim().toLowerCase() === subject.toLowerCase(),
      );
      if (existing) return res.status(200).json({ item: existing, duplicate: true });

      const path = storagePath(examBody, paperYear, subject, filename);
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: MIME_BY_EXTENSION[extension] || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const actorId = (req as unknown as { adminUser?: { id?: string } }).adminUser?.id || '';
      const { data: created, error: insertError } = await supabase
        .from('question_imports')
        .insert({
          exam_id: examId,
          exam_body: examBody,
          subject,
          paper_year: paperYear,
          source_name: sourceName,
          source_url: sourceUrl,
          source_verified: sourceVerified,
          original_filename: safeFilename(filename),
          mime_type: MIME_BY_EXTENSION[extension] || 'application/octet-stream',
          file_bytes: buffer.length,
          checksum,
          storage_path: path,
          uploaded_by: actorId || null,
        })
        .select(SELECT)
        .single();
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        if ((insertError as { code?: string }).code === '23505') {
          return res.status(409).json({ error: 'This file has already been uploaded for that bank and subject.' });
        }
        throw insertError;
      }

      await recordAudit(supabase, {
        actorId,
        action: 'upload_question_import',
        resourceType: 'question_import',
        resourceId: created.id,
        metadata: { filename: safeFilename(filename), bytes: buffer.length, exam_id: examId, subject, paper_year: paperYear },
      });

      // Start the job without holding the response. The detail endpoint also
      // kicks a queued job, so a serverless instance that stops after the
      // response cannot leave the upload stuck.
      void processImport(created.id, deps);
      res.status(202).json({ item: created });
    } catch (error) {
      console.error('Question import upload failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: formatError(error, 'Unable to upload this file.') });
    }
  });

  app.get('/api/admin/question-imports/:importId', guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: item, error } = await supabase
        .from('question_imports')
        .select(SELECT)
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: 'Import not found.' });

      if (item.status === 'queued' || (item.status === 'failed' && item.attempts === 0)) {
        void processImport(item.id, deps);
      }

      const { data: rows, error: itemsError } = await supabase
        .from('question_import_items')
        .select('id,source_index,question_text,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,passage,topic,raw_text,review_status,issues,duplicate_of,question_id')
        .eq('import_id', item.id)
        .order('source_index', { ascending: true })
        .limit(2000);
      if (itemsError) throw itemsError;

      const items = (rows || []) as Array<{ review_status: string }>;
      res.json({
        item,
        items,
        summary: {
          pending: items.filter((row) => row.review_status === 'pending').length,
          approved: items.filter((row) => row.review_status === 'approved').length,
          rejected: items.filter((row) => row.review_status === 'rejected').length,
          imported: items.filter((row) => row.review_status === 'imported').length,
        },
      });
    } catch (error) {
      console.error('Question import detail failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to load this import.' });
    }
  });

  app.post('/api/admin/question-imports/:importId/retry', deps.rateLimitFor(deps.adminImportRateLimit), guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: item, error } = await supabase
        .from('question_imports')
        .select('id,status,item_count,imported_count')
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: 'Import not found.' });
      if (item.imported_count > 0) return res.status(409).json({ error: 'This import has already added questions to the bank and cannot be re-extracted.' });
      if (!['queued', 'failed'].includes(item.status)) {
        return res.status(409).json({ error: 'This import has already been extracted. Finish reviewing it, or upload the file again.' });
      }
      // A retry is an explicit human action, so it also resets the automatic
      // attempt budget; otherwise the fifth failure would leave the import
      // permanently unclaimable.
      const { error: resetError } = await supabase
        .from('question_imports')
        .update({ status: 'queued', attempts: 0, extraction_error: null, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (resetError) throw resetError;
      void processImport(item.id, deps);
      res.status(202).json({ ok: true });
    } catch (error) {
      console.error('Question import retry failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to retry this import.' });
    }
  });

  app.patch('/api/admin/question-imports/:importId/items/:itemId', guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: row, error } = await supabase
        .from('question_import_items')
        .select('*')
        .eq('id', req.params.itemId)
        .eq('import_id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'Question not found in this import.' });
      if (row.review_status === 'imported') return res.status(409).json({ error: 'This question has already been saved to the bank.' });

      const input = normaliseItem({
        questionText: req.body?.questionText ?? row.question_text,
        optionA: req.body?.optionA ?? row.option_a,
        optionB: req.body?.optionB ?? row.option_b,
        optionC: req.body?.optionC ?? row.option_c,
        optionD: req.body?.optionD ?? row.option_d,
        optionE: req.body?.optionE ?? row.option_e,
        correctOption: req.body?.correctOption ?? row.correct_option,
      });
      const validation = validateItem(input, { duplicateOf: row.duplicate_of });
      const { data: updated, error: updateError } = await supabase
        .from('question_import_items')
        .update({
          question_text: input.questionText,
          option_a: input.optionA,
          option_b: input.optionB,
          option_c: input.optionC,
          option_d: input.optionD,
          option_e: input.optionE,
          correct_option: input.correctOption,
          explanation: trimmed(req.body?.explanation ?? row.explanation, 4000) || null,
          passage: trimmed(req.body?.passage ?? row.passage, 4000) || null,
          topic: trimmed(req.body?.topic ?? row.topic, 160) || null,
          issues: [...validation.blocking, ...validation.notes],
          review_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('import_id', row.import_id)
        .select('id,source_index,question_text,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,passage,topic,raw_text,review_status,issues,duplicate_of,question_id')
        .single();
      if (updateError) throw updateError;
      res.json({ item: updated, blocking: validation.blocking });
    } catch (error) {
      console.error('Question import item update failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to save this question.' });
    }
  });

  app.post('/api/admin/question-imports/:importId/items/:itemId/review', guard, async (req, res) => {
    try {
      const action = one(req.body?.action);
      if (!['approve', 'reject', 'reset'].includes(action)) return res.status(400).json({ error: 'Choose approve, reject or reset.' });
      const supabase = assertSupabase(deps);
      const { data: row, error } = await supabase
        .from('question_import_items')
        .select('*')
        .eq('id', req.params.itemId)
        .eq('import_id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'Question not found in this import.' });
      if (row.review_status === 'imported') return res.status(409).json({ error: 'This question has already been saved to the bank.' });

      let status: 'approved' | 'rejected' | 'pending' = 'pending';
      let issues: string[] = Array.isArray(row.issues) ? row.issues : [];
      if (action === 'approve') {
        const validation = validateItem({
          questionText: row.question_text,
          optionA: row.option_a,
          optionB: row.option_b,
          optionC: row.option_c,
          optionD: row.option_d,
          optionE: row.option_e,
          correctOption: row.correct_option,
        }, { duplicateOf: row.duplicate_of });
        if (validation.blocking.length) {
          return res.status(422).json({ error: validation.blocking[0], blocking: validation.blocking });
        }
        status = 'approved';
        issues = validation.notes;
      } else if (action === 'reject') {
        status = 'rejected';
      }

      const { data: updated, error: updateError } = await supabase
        .from('question_import_items')
        .update({ review_status: status, issues, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('import_id', row.import_id)
        .select('id,review_status,issues')
        .single();
      if (updateError) throw updateError;
      res.json({ item: updated });
    } catch (error) {
      console.error('Question import review failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to record that review.' });
    }
  });

  app.post('/api/admin/question-imports/:importId/commit', deps.rateLimitFor(deps.adminImportRateLimit), guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: item, error } = await supabase
        .from('question_imports')
        .select('id,approved_count,status,exam_id,subject')
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: 'Import not found.' });
      if (!['extracted', 'completed'].includes(item.status)) {
        return res.status(409).json({ error: 'Extract and review this file before saving it.' });
      }
      const { data: result, error: commitError } = await supabase.rpc('commit_question_import', { p_import_id: item.id });
      if (commitError) throw commitError;
      const actorId = (req as unknown as { adminUser?: { id?: string } }).adminUser?.id || '';
      await recordAudit(supabase, {
        actorId,
        action: 'commit_question_import',
        resourceType: 'question_import',
        resourceId: item.id,
        metadata: { result, exam_id: item.exam_id, subject: item.subject },
      });
      res.json({ result });
    } catch (error) {
      const message = error instanceof Error && /not ready|not being processed|not found/i.test(error.message)
        ? error.message
        : 'Unable to save the approved questions.';
      console.error('Question import commit failed:', error instanceof Error ? error.message : 'unknown');
      res.status(409).json({ error: message });
    }
  });

  // A paper is sometimes filed under the wrong subject or year. Correcting the
  // association is allowed until the first question is saved; after that the
  // provenance of shared bank rows must not change under them.
  app.patch('/api/admin/question-imports/:importId', deps.rateLimitFor(deps.adminImportRateLimit), guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: current, error } = await supabase
        .from('question_imports')
        .select('id,exam_id,subject,paper_year,source_name,source_url,source_verified,imported_count')
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!current) return res.status(404).json({ error: 'Import not found.' });
      if (current.imported_count > 0) {
        return res.status(409).json({ error: 'Questions from this file are already in the bank, so its paper details can no longer change.' });
      }

      let examId = current.exam_id as string;
      let examBody: string | null = null;
      if (req.body?.examId !== undefined) {
        examId = trimmed(req.body.examId, 64);
        if (!/^[0-9a-f-]{36}$/i.test(examId)) {
          return res.status(400).json({ error: 'Choose a valid examination bank.' });
        }
        const { data: exam, error: examError } = await supabase
          .from('cbt_exams')
          .select('id,exam_body,is_active')
          .eq('id', examId)
          .maybeSingle();
        if (examError) throw examError;
        if (!exam || !exam.is_active) return res.status(404).json({ error: 'That CBT bank is not available.' });
        examBody = normaliseExamBody(String(exam.exam_body || ''));
        if (!examBody) return res.status(400).json({ error: 'That bank does not belong to a supported examination body.' });
      }

      const subject = req.body?.subject === undefined ? current.subject : trimmed(req.body.subject, MAX_SUBJECT_LENGTH);
      if (!subject) return res.status(400).json({ error: 'Choose or enter the subject.' });

      let paperYear: number | null = current.paper_year;
      if (req.body?.paperYear !== undefined) {
        const raw = req.body.paperYear;
        paperYear = raw === '' || raw === null ? null : Number(raw);
        if (paperYear !== null && (!Number.isInteger(paperYear) || paperYear < 1954 || paperYear > 2100)) {
          return res.status(400).json({ error: 'Enter a valid paper year.' });
        }
      }

      const sourceName = req.body?.sourceName === undefined
        ? current.source_name
        : trimmed(req.body.sourceName, 240) || null;
      let sourceUrl: string | null = current.source_url;
      if (req.body?.sourceUrl !== undefined) {
        const raw = trimmed(req.body.sourceUrl, 500);
        if (!raw) {
          sourceUrl = null;
        } else {
          try {
            if (new URL(raw).protocol !== 'https:') throw new Error();
            sourceUrl = raw;
          } catch {
            return res.status(400).json({ error: 'Source links must use HTTPS.' });
          }
        }
      }
      const sourceVerified = req.body?.sourceVerified === undefined
        ? Boolean(current.source_verified)
        : req.body.sourceVerified === true;
      if (sourceVerified && !sourceName) {
        return res.status(400).json({ error: 'Enter the source or organisation before marking this paper verified.' });
      }

      const patch: Record<string, unknown> = {
        exam_id: examId,
        subject,
        paper_year: paperYear,
        source_name: sourceName,
        source_url: sourceUrl,
        source_verified: sourceVerified,
        updated_at: new Date().toISOString(),
      };
      if (examBody) patch.exam_body = examBody;

      const { data: updated, error: updateError } = await supabase
        .from('question_imports')
        .update(patch)
        .eq('id', current.id)
        .select(SELECT)
        .single();
      if (updateError) throw updateError;

      const actorId = (req as unknown as { adminUser?: { id?: string } }).adminUser?.id || '';
      await recordAudit(supabase, {
        actorId,
        action: 'update_question_import',
        resourceType: 'question_import',
        resourceId: current.id,
        metadata: { exam_id: examId, subject, paper_year: paperYear, source_verified: sourceVerified },
      });

      res.json({ item: updated });
    } catch (error) {
      console.error('Question import update failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to update this import.' });
    }
  });

  app.get('/api/admin/question-imports/:importId/source', guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: item, error } = await supabase
        .from('question_imports')
        .select('id,storage_path,original_filename')
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: 'Import not found.' });
      const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 300);
      if (signError || !signed?.signedUrl) throw signError || new Error('No URL');
      res.json({ url: signed.signedUrl, filename: item.original_filename, expiresIn: 300 });
    } catch (error) {
      console.error('Question import source failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to create a download link for the original file.' });
    }
  });

  app.delete('/api/admin/question-imports/:importId', guard, async (req, res) => {
    try {
      const supabase = assertSupabase(deps);
      const { data: item, error } = await supabase
        .from('question_imports')
        .select('id,storage_path,imported_count,status')
        .eq('id', req.params.importId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: 'Import not found.' });
      if (item.imported_count > 0) {
        return res.status(409).json({ error: 'This import has already added shared questions, so it is kept as their provenance. The source file remains private to staff.' });
      }
      const { error: deleteError } = await supabase.from('question_imports').delete().eq('id', item.id);
      if (deleteError) throw deleteError;
      // The row is gone, so a failed object delete only leaves an orphaned
      // private object; it must not turn a successful delete into an error.
      await supabase.storage.from(BUCKET).remove([item.storage_path]).catch(() => undefined);
      const actorId = (req as unknown as { adminUser?: { id?: string } }).adminUser?.id || '';
      await recordAudit(supabase, {
        actorId,
        action: 'delete_question_import',
        resourceType: 'question_import',
        resourceId: item.id,
      });
      res.status(204).end();
    } catch (error) {
      console.error('Question import delete failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Unable to delete this import.' });
    }
  });
}

export const QUESTION_IMPORT_LIMITS = { maxBytes: MAX_BYTES, bucket: BUCKET };
