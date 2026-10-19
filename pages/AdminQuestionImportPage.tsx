import { userFacingError } from '../lib/errors';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Pencil, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import {
  IMPORT_UPLOAD_ACCEPT,
  commitAdminQuestionImport,
  deleteAdminQuestionImport,
  fetchAdminQuestionImport,
  fetchAdminQuestionImportSource,
  fetchAdminQuestionImports,
  fetchCbtBank,
  fetchCbtExams,
  retryAdminQuestionImport,
  reviewAdminQuestionImportItem,
  updateAdminQuestionImport,
  updateAdminQuestionImportItem,
  uploadAdminQuestionImport,
  type AdminQuestionImport,
  type AdminQuestionImportDetail,
  type AdminQuestionImportItem,
  type CbtExamSummary,
} from '../src/lib/api';
import { AdminEmptyState, StatusBadge, TimeAgo } from '../src/components/admin/AdminKit';

const MAX_BYTES = 20 * 1024 * 1024;

const STATUS_LABEL: Record<AdminQuestionImport['status'], string> = {
  queued: 'Queued',
  processing: 'Extracting',
  extracted: 'Needs review',
  failed: 'Extraction failed',
  completed: 'Saved',
  archived: 'Archived',
};

type UploadState = {
  key: string;
  name: string;
  fraction: number;
  status: 'uploading' | 'done' | 'error';
  message: string;
  importId?: string;
};

type Draft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: string;
  explanation: string;
  passage: string;
  topic: string;
};

function bytesLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function draftFor(item: AdminQuestionImportItem): Draft {
  return {
    question_text: item.question_text,
    option_a: item.option_a,
    option_b: item.option_b,
    option_c: item.option_c,
    option_d: item.option_d,
    option_e: item.option_e || '',
    correct_option: item.correct_option || '',
    explanation: item.explanation || '',
    passage: item.passage || '',
    topic: item.topic || '',
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export default function AdminQuestionImportPage() {
  const [imports, setImports] = useState<AdminQuestionImport[]>([]);
  const [exams, setExams] = useState<CbtExamSummary[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<AdminQuestionImportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'imported'>('all');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busyItem, setBusyItem] = useState('');
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [committing, setCommitting] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [examId, setExamId] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceVerified, setSourceVerified] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [metaSubjects, setMetaSubjects] = useState<string[]>([]);
  const [metaForm, setMetaForm] = useState({
    examId: '', subject: '', year: '', sourceName: '', sourceUrl: '', sourceVerified: false,
  });
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    try {
      setError('');
      const items = await fetchAdminQuestionImports();
      setImports(items);
    } catch (value) {
      setError(userFacingError(value, 'Unable to load the import history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    void fetchCbtExams()
      .then((items) => {
        setExams(items);
        setExamId((current) => current || items[0]?.id || '');
      })
      .catch(() => undefined);
  }, [loadList]);

  useEffect(() => {
    if (!examId) { setSubjects([]); return; }
    let active = true;
    void fetchCbtBank(examId)
      .then((bank) => { if (active) setSubjects(bank.subjects.map((entry) => entry.subject)); })
      .catch(() => { if (active) setSubjects([]); });
    return () => { active = false; };
  }, [examId]);

  const openImport = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setItemErrors({});
    setMetaOpen(false);
    setMetaError('');
    try {
      const result = await fetchAdminQuestionImport(id);
      setDetail(result);
      setDrafts(Object.fromEntries(result.items.map((item) => [item.id, draftFor(item)])));
      setDirty({});
    } catch (value) {
      setError(userFacingError(value, 'Unable to load this import.'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Extraction runs server-side. While it is queued or processing, poll the
  // detail endpoint; that request also nudges a job a serverless instance left
  // unclaimed, so a refresh is enough to recover a stuck upload.
  useEffect(() => {
    if (!detail || !['queued', 'processing'].includes(detail.item.status)) return;
    pollTimer.current = setTimeout(() => { void openImport(detail.item.id); }, 2000);
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [detail, openImport]);

  const exam = useMemo(() => exams.find((entry) => entry.id === examId), [exams, examId]);

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of next) {
      if (file.size > MAX_BYTES) { rejected.push(`${file.name} is larger than 20 MB.`); continue; }
      if (!IMPORT_UPLOAD_ACCEPT.split(',').some((extension) => file.name.toLowerCase().endsWith(extension))) {
        rejected.push(`${file.name}: that file type is not supported.`);
        continue;
      }
      accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted]);
    if (rejected.length) setError(rejected.join(' '));

    // A filename such as "WAEC_Mathematics_2023.pdf" usually carries the two
    // details administrators otherwise retype. Suggest them once; the fields
    // remain editable and are never overwritten if already filled.
    const names = accepted.map((file) => file.name).join(' ');
    if (!year) {
      const detected = names.match(/\b(19|20)\d{2}\b/);
      if (detected) setYear(detected[0]);
    }
    if (!subject.trim() && subjects.length) {
      const haystack = names.toLowerCase().replace(/[_-]+/g, ' ');
      const match = subjects.find((name) => haystack.includes(name.toLowerCase()));
      if (match) setSubject(match);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  async function uploadAll() {
    if (!examId) { setError('Choose the examination bank first.'); return; }
    if (!subject.trim()) { setError('Choose or enter the subject.'); return; }
    if (!files.length) { setError('Choose at least one file.'); return; }
    setUploading(true);
    setError('');
    setNotice('');
    const queue = [...files];
    setUploads(queue.map((file, index) => ({ key: `${file.name}-${index}`, name: file.name, fraction: 0, status: 'uploading', message: 'Uploading' })));
    let lastId = '';
    for (const [index, file] of queue.entries()) {
      try {
        const dataUrl = await readAsDataUrl(file);
        const result = await uploadAdminQuestionImport({
          dataUrl,
          filename: file.name,
          examId,
          subject: subject.trim(),
          paperYear: year || null,
          sourceName: sourceName.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          sourceVerified,
        }, (fraction) => {
          setUploads((current) => current.map((entry, position) => position === index
            ? { ...entry, fraction, message: `Uploading ${Math.round(fraction * 100)}%` }
            : entry));
        });
        lastId = result.item.id;
        setUploads((current) => current.map((entry, position) => position === index
          ? { ...entry, fraction: 1, status: 'done', message: result.duplicate ? 'Already uploaded: opened the existing import' : 'Uploaded: extracting', importId: result.item.id }
          : entry));
      } catch (value) {
        setUploads((current) => current.map((entry, position) => position === index
          ? { ...entry, status: 'error', message: userFacingError(value, 'Upload failed') }
          : entry));
      }
    }
    setUploading(false);
    setFiles([]);
    await loadList();
    if (lastId) await openImport(lastId);
  }

  async function saveItem(item: AdminQuestionImportItem, silent = false) {
    const draft = drafts[item.id];
    if (!draft || !detail) return item;
    setBusyItem(item.id);
    setItemErrors((current) => ({ ...current, [item.id]: '' }));
    try {
      const result = await updateAdminQuestionImportItem(detail.item.id, item.id, {
        question_text: draft.question_text,
        option_a: draft.option_a,
        option_b: draft.option_b,
        option_c: draft.option_c,
        option_d: draft.option_d,
        option_e: draft.option_e,
        correct_option: (draft.correct_option || null) as AdminQuestionImportItem['correct_option'],
        explanation: draft.explanation,
        passage: draft.passage,
        topic: draft.topic,
      });
      setDetail((current) => current ? {
        ...current,
        items: current.items.map((entry) => entry.id === result.item.id ? result.item : entry),
        summary: summarize(current.items.map((entry) => entry.id === result.item.id ? result.item : entry)),
      } : current);
      setDrafts((current) => ({ ...current, [result.item.id]: draftFor(result.item) }));
      setDirty((current) => ({ ...current, [result.item.id]: false }));
      return result.item;
    } catch (value) {
      setItemErrors((current) => ({ ...current, [item.id]: userFacingError(value, 'Unable to save this question.') }));
      return null;
    } finally {
      setBusyItem('');
      if (silent) setNotice('');
    }
  }

  async function reviewItem(item: AdminQuestionImportItem, action: 'approve' | 'reject' | 'reset') {
    setBusyItem(item.id);
    setItemErrors((current) => ({ ...current, [item.id]: '' }));
    try {
      if (action === 'approve' && dirty[item.id]) {
        const saved = await saveItem(item, true);
        if (!saved) return;
      }
      if (!detail) return;
      const updated = await reviewAdminQuestionImportItem(detail.item.id, item.id, action);
      setDetail((current) => current ? {
        ...current,
        items: current.items.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry),
        summary: summarize(current.items.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry)),
      } : current);
      if (action === 'approve') setNotice('Approved. Save the import to add it to the bank.');
    } catch (value) {
      setItemErrors((current) => ({ ...current, [item.id]: userFacingError(value, 'Unable to record that review.') }));
    } finally {
      setBusyItem('');
    }
  }

  async function retry() {
    if (!detail) return;
    setNotice('');
    try {
      await retryAdminQuestionImport(detail.item.id);
      await openImport(detail.item.id);
    } catch (value) {
      setError(userFacingError(value, 'Unable to retry the extraction.'));
    }
  }

  async function download() {
    if (!detail) return;
    try {
      const { url } = await fetchAdminQuestionImportSource(detail.item.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (value) {
      setError(userFacingError(value, 'Unable to create a download link.'));
    }
  }

  async function commit() {
    if (!detail) return;
    setCommitting(true);
    setError('');
    setNotice('');
    try {
      const result = await commitAdminQuestionImport(detail.item.id);
      const parts = [`${result.inserted} question${result.inserted === 1 ? '' : 's'} added to the bank`];
      if (result.duplicates) parts.push(`${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped`);
      if (result.incomplete) parts.push(`${result.incomplete} incomplete item${result.incomplete === 1 ? '' : 's'} left for review`);
      setNotice(`${parts.join(' · ')}.`);
      await Promise.all([openImport(detail.item.id), loadList()]);
    } catch (value) {
      setError(userFacingError(value, 'Unable to save the approved questions.'));
    } finally {
      setCommitting(false);
    }
  }

  async function remove() {
    if (!detail) return;
    if (!window.confirm('Delete this import and its review queue? Files that already produced questions cannot be deleted.')) return;
    try {
      await deleteAdminQuestionImport(detail.item.id);
      setSelectedId('');
      setDetail(null);
      setNotice('Import deleted.');
      await loadList();
    } catch (value) {
      setError(userFacingError(value, 'Unable to delete this import.'));
    }
  }

  if (selectedId) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <button type="button" className="admin-text-btn" onClick={() => { setSelectedId(''); setDetail(null); }}>
              <ArrowLeft size={14} /> All imports
            </button>
            <h1>Review imported questions</h1>
            <p>{detail ? `${detail.item.original_filename} · ${detail.item.subject}${detail.item.paper_year ? ` · ${detail.item.paper_year}` : ''}` : 'Loading import…'}</p>
          </div>
          <div className="admin-inline-form">
            <button type="button" className="admin-btn small secondary" onClick={() => void download()}><Download size={14} /> Original file</button>
            {detail && detail.item.imported_count === 0 && (
              <button type="button" className="admin-btn small secondary" onClick={beginMetaEdit}><Pencil size={14} /> Edit details</button>
            )}
            {detail && detail.item.imported_count === 0 && (
              <button type="button" className="admin-btn small danger" onClick={() => void remove()}><Trash2 size={14} /> Delete</button>
            )}
          </div>
        </div>

        {error && <div className="admin-card empty-state" role="alert">{error}</div>}
        {notice && <div className="admin-card empty-state" role="status">{notice}</div>}
        {detailLoading && !detail && <div className="admin-card empty-state">Loading import…</div>}

        {detail && (
          <>
            <section className="admin-card import-summary">
              <div>
                <StatusBadge status={STATUS_LABEL[detail.item.status]} />
                <span className="import-summary-meta">{bytesLabel(detail.item.file_bytes)} · <TimeAgo value={detail.item.created_at} /></span>
              </div>
              <div className="import-summary-counts">
                <span><strong>{detail.summary.pending}</strong> to review</span>
                <span><strong>{detail.summary.approved}</strong> approved</span>
                <span><strong>{detail.summary.rejected}</strong> rejected</span>
                <span><strong>{detail.summary.imported}</strong> saved</span>
              </div>
            </section>

            {detail.item.imported_count === 0 && (
              <section className="admin-card import-meta-edit">
                <div className="admin-card-header">
                  <h2>Paper details</h2>
                  {!metaOpen && (
                    <span className="import-summary-meta">
                      {detail.item.exam_body} · {detail.item.subject}
                      {detail.item.paper_year ? ` · ${detail.item.paper_year}` : ''}
                      {detail.item.source_name ? ` · ${detail.item.source_name}` : ''}
                    </span>
                  )}
                </div>
                {metaOpen ? (
                  <div className="import-upload-body">
                    <div className="import-meta-grid">
                      <label className="import-field">
                        <span>Examination bank</span>
                        <select
                          className="admin-select"
                          value={metaForm.examId}
                          onChange={(event) => setMetaForm((current) => ({ ...current, examId: event.target.value }))}
                        >
                          {exams.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                        </select>
                      </label>
                      <label className="import-field">
                        <span>Subject</span>
                        <input
                          className="admin-input"
                          list="import-meta-subjects"
                          value={metaForm.subject}
                          onChange={(event) => setMetaForm((current) => ({ ...current, subject: event.target.value }))}
                          required
                        />
                        <datalist id="import-meta-subjects">
                          {metaSubjects.map((name) => <option key={name} value={name} />)}
                        </datalist>
                      </label>
                      <label className="import-field">
                        <span>Paper year</span>
                        <input
                          className="admin-input"
                          type="number"
                          min={1954}
                          max={2100}
                          value={metaForm.year}
                          onChange={(event) => setMetaForm((current) => ({ ...current, year: event.target.value }))}
                          placeholder="Not stated"
                        />
                      </label>
                      <label className="import-field">
                        <span>Source or institution</span>
                        <input
                          className="admin-input"
                          value={metaForm.sourceName}
                          onChange={(event) => setMetaForm((current) => ({ ...current, sourceName: event.target.value }))}
                        />
                      </label>
                      <label className="import-field">
                        <span>Source link</span>
                        <input
                          className="admin-input"
                          type="url"
                          value={metaForm.sourceUrl}
                          onChange={(event) => setMetaForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                          placeholder="https://… (optional)"
                        />
                      </label>
                      <label className="admin-check-row import-verified">
                        <input
                          type="checkbox"
                          checked={metaForm.sourceVerified}
                          onChange={(event) => setMetaForm((current) => ({ ...current, sourceVerified: event.target.checked }))}
                        />
                        The publication source is confirmed
                      </label>
                    </div>
                    {metaError && <p className="admin-form-error" role="alert">{metaError}</p>}
                    <div className="admin-inline-form">
                      <button type="button" className="admin-btn" onClick={() => void saveMeta()} disabled={metaSaving}>
                        {metaSaving ? 'Saving…' : 'Save details'}
                      </button>
                      <button type="button" className="admin-btn secondary" onClick={() => setMetaOpen(false)} disabled={metaSaving}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="admin-quality-gate">
                    Wrong bank, subject or year? Correct it before the first question is saved. Changing the bank moves the whole queue.
                  </p>
                )}
              </section>
            )}

            {detail.item.extraction_error && (
              <div className="admin-card import-alert" role="alert">
                <p>{detail.item.extraction_error}</p>
                <button type="button" className="admin-btn small" onClick={() => void retry()}><RefreshCw size={14} /> Retry extraction</button>
              </div>
            )}

            {detail.item.extraction_warnings.length > 0 && (
              <div className="admin-card import-warnings">
                <h2>Extraction notes</h2>
                <ul>{detail.item.extraction_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </div>
            )}

            <div className="import-toolbar">
              <div className="filter-pills" role="group" aria-label="Filter questions">
                {(['all', 'pending', 'approved', 'rejected', 'imported'] as const).map((key) => (
                  <button key={key} type="button" className={reviewFilter === key ? 'active' : ''} onClick={() => setReviewFilter(key)}>
                    {key === 'all' ? 'All' : key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="admin-btn"
                onClick={() => void commit()}
                disabled={committing || detail.summary.approved === 0}
              >
                <CheckCircle2 size={15} /> {committing ? 'Saving…' : `Save approved (${detail.summary.approved})`}
              </button>
            </div>

            {detail.item.status === 'queued' || detail.item.status === 'processing' ? (
              <div className="admin-card empty-state" role="status">Reading the file and finding questions…</div>
            ) : !detail.items.length ? (
              <AdminEmptyState title="No questions in this import" hint="The file was read but no numbered multiple-choice questions were found. Open the original file and check the layout." />
            ) : (
              <div className="import-list">
                {detail.items
                  .filter((item) => reviewFilter === 'all' || item.review_status === reviewFilter)
                  .map((item) => {
                    const draft = drafts[item.id] || draftFor(item);
                    const busy = busyItem === item.id;
                    return (
                      <article className="admin-card import-item" key={item.id}>
                        <header>
                          <span className="question-tag">Question {item.source_index}</span>
                          <span className={`import-status import-status-${item.review_status}`}>{item.review_status}</span>
                        </header>
                        <label className="import-field">
                          <span>Question text</span>
                          <textarea
                            className="admin-textarea"
                            rows={3}
                            value={draft.question_text}
                            disabled={item.review_status === 'imported'}
                            onChange={(event) => {
                              setDrafts((current) => ({ ...current, [item.id]: { ...draft, question_text: event.target.value } }));
                              setDirty((current) => ({ ...current, [item.id]: true }));
                            }}
                          />
                        </label>
                        <div className="import-options">
                          {(['a', 'b', 'c', 'd'] as const).map((letter) => (
                            <label className="import-field" key={letter}>
                              <span>Option {letter.toUpperCase()}</span>
                              <input
                                className="admin-input"
                                value={draft[`option_${letter}`]}
                                disabled={item.review_status === 'imported'}
                                onChange={(event) => {
                                  setDrafts((current) => ({ ...current, [item.id]: { ...draft, [`option_${letter}`]: event.target.value } }));
                                  setDirty((current) => ({ ...current, [item.id]: true }));
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        {draft.option_e && (
                          <p className="import-five">A fifth option was found: <strong>{draft.option_e}</strong>. The CBT bank stores four options, so remove one before approving.</p>
                        )}
                        <div className="import-meta-row">
                          <label className="import-field">
                            <span>Correct answer</span>
                            <select
                              className="admin-select"
                              value={draft.correct_option}
                              disabled={item.review_status === 'imported'}
                              onChange={(event) => {
                                setDrafts((current) => ({ ...current, [item.id]: { ...draft, correct_option: event.target.value } }));
                                setDirty((current) => ({ ...current, [item.id]: true }));
                              }}
                            >
                              <option value="">Not found</option>
                              {['A', 'B', 'C', 'D'].map((key) => <option key={key} value={key}>{key}</option>)}
                            </select>
                          </label>
                          <label className="import-field">
                            <span>Topic</span>
                            <input
                              className="admin-input"
                              value={draft.topic}
                              disabled={item.review_status === 'imported'}
                              onChange={(event) => {
                                setDrafts((current) => ({ ...current, [item.id]: { ...draft, topic: event.target.value } }));
                                setDirty((current) => ({ ...current, [item.id]: true }));
                              }}
                            />
                          </label>
                        </div>
                        <details className="import-more">
                          <summary>Explanation, passage and source text</summary>
                          <label className="import-field">
                            <span>Explanation</span>
                            <textarea
                              className="admin-textarea"
                              rows={2}
                              value={draft.explanation}
                              disabled={item.review_status === 'imported'}
                              onChange={(event) => {
                                setDrafts((current) => ({ ...current, [item.id]: { ...draft, explanation: event.target.value } }));
                                setDirty((current) => ({ ...current, [item.id]: true }));
                              }}
                            />
                          </label>
                          <label className="import-field">
                            <span>Passage</span>
                            <textarea
                              className="admin-textarea"
                              rows={3}
                              value={draft.passage}
                              disabled={item.review_status === 'imported'}
                              onChange={(event) => {
                                setDrafts((current) => ({ ...current, [item.id]: { ...draft, passage: event.target.value } }));
                                setDirty((current) => ({ ...current, [item.id]: true }));
                              }}
                            />
                          </label>
                          {item.raw_text && <pre className="import-raw">{item.raw_text}</pre>}
                        </details>
                        {item.issues.length > 0 && (
                          <ul className="import-issues" role="status">
                            {item.issues.map((issue, index) => <li key={index}>{issue}</li>)}
                          </ul>
                        )}
                        {itemErrors[item.id] && <p className="import-item-error" role="alert">{itemErrors[item.id]}</p>}
                        <footer>
                          <button
                            type="button"
                            className="admin-btn small secondary"
                            onClick={() => void saveItem(item)}
                            disabled={busy || item.review_status === 'imported'}
                          >
                            Save changes
                          </button>
                          {item.review_status === 'approved' ? (
                            <button type="button" className="admin-btn small" onClick={() => void reviewItem(item, 'reset')} disabled={busy}>
                              Return to review
                            </button>
                          ) : item.review_status !== 'imported' && (
                            <button type="button" className="admin-btn small success" onClick={() => void reviewItem(item, 'approve')} disabled={busy}>
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}
                          {item.review_status !== 'rejected' && item.review_status !== 'imported' && (
                            <button type="button" className="admin-btn small danger" onClick={() => void reviewItem(item, 'reject')} disabled={busy}>
                              <XCircle size={14} /> Reject
                            </button>
                          )}
                        </footer>
                      </article>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function beginMetaEdit() {
    if (!detail) return;
    setMetaForm({
      examId: detail.item.exam_id,
      subject: detail.item.subject,
      year: detail.item.paper_year ? String(detail.item.paper_year) : '',
      sourceName: detail.item.source_name || '',
      sourceUrl: detail.item.source_url || '',
      sourceVerified: detail.item.source_verified,
    });
    setMetaError('');
    setMetaOpen(true);
    setMetaSubjects(subjects);
    void fetchCbtBank(detail.item.exam_id)
      .then((bank) => setMetaSubjects(bank.subjects.map((entry) => entry.subject)))
      .catch(() => undefined);
  }

  async function saveMeta() {
    if (!detail) return;
    if (!metaForm.subject.trim()) { setMetaError('Enter the subject.'); return; }
    if (metaForm.sourceVerified && !metaForm.sourceName.trim()) {
      setMetaError('Enter the source before marking the paper verified.');
      return;
    }
    setMetaSaving(true);
    setMetaError('');
    try {
      const updated = await updateAdminQuestionImport(detail.item.id, {
        examId: metaForm.examId,
        subject: metaForm.subject.trim(),
        paperYear: metaForm.year ? Number(metaForm.year) : null,
        sourceName: metaForm.sourceName.trim() || null,
        sourceUrl: metaForm.sourceUrl.trim() || null,
        sourceVerified: metaForm.sourceVerified,
      });
      setDetail({ ...detail, item: updated });
      setImports((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMetaOpen(false);
      setNotice('Paper details updated.');
    } catch (value) {
      setMetaError(userFacingError(value, 'Unable to update the paper details.'));
    } finally {
      setMetaSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Past-question imports</h1>
          <p>Upload a paper, check what was extracted, then save the approved questions to a CBT bank.</p>
        </div>
        <button type="button" className="admin-btn small secondary" onClick={() => void loadList()}><RefreshCw size={14} /> Refresh</button>
      </div>

      {error && <div className="admin-card empty-state" role="alert">{error}</div>}
      {notice && <div className="admin-card empty-state" role="status">{notice}</div>}

      <section className="admin-card">
        <div className="admin-card-header">
          <h2>Upload a file</h2>
          <span>PDF, Word, Excel, CSV, TSV, JSON, text or ZIP · up to 20 MB</span>
        </div>
        <div className="import-upload-body">
          <div
            className={`import-drop ${dragActive ? 'is-active' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }}
          >
            <Upload size={22} />
            <strong>Drop files here, or browse</strong>
            <span>You can upload several papers at once. Each file is reviewed before anything reaches a bank.</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              aria-label="Choose past-question files"
              accept={IMPORT_UPLOAD_ACCEPT}
              className="er-visually-hidden"
              onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }}
            />
          </div>

          {files.length > 0 && (
            <ul className="import-file-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <FileText size={14} />
                  <span>{file.name}</span>
                  <small>{bytesLabel(file.size)}</small>
                  <button type="button" className="admin-text-btn" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <div className="import-meta-grid">
            <label className="import-field">
              <span>Examination bank</span>
              <select className="admin-select" value={examId} onChange={(event) => setExamId(event.target.value)} required>
                <option value="">Choose a bank</option>
                {exams.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
              </select>
            </label>
            <label className="import-field">
              <span>Subject</span>
              <input
                className="admin-input"
                list="import-subject-options"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Mathematics"
                required
              />
              <datalist id="import-subject-options">
                {subjects.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
            <label className="import-field">
              <span>Paper year</span>
              <input className="admin-input" type="number" min={1954} max={2100} value={year} onChange={(event) => setYear(event.target.value)} placeholder="Optional" />
            </label>
            <label className="import-field">
              <span>Source or institution</span>
              <input className="admin-input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="e.g. WAEC" />
            </label>
            <label className="import-field">
              <span>Source link</span>
              <input className="admin-input" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://… (optional)" />
            </label>
            <label className="admin-check-row import-verified">
              <input type="checkbox" checked={sourceVerified} onChange={(event) => setSourceVerified(event.target.checked)} />
              The publication source is confirmed
            </label>
          </div>
          <p className="admin-quality-gate">
            A confirmed source records the questions as official past questions. It does not verify answer keys; every extracted item still needs a human approval.
          </p>
          {exam && <p className="import-bank-hint">Saving adds questions to <strong>{exam.title}</strong> under {exam.exam_body}. The bank is available to students immediately after saving.</p>}
          <button type="button" className="admin-btn" onClick={() => void uploadAll()} disabled={uploading || !files.length || !examId || !subject.trim()}>
            <Upload size={15} /> {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} files` : 'Upload and extract'}
          </button>

          {uploads.length > 0 && (
            <ul className="import-upload-list" aria-live="polite">
              {uploads.map((entry) => (
                <li key={entry.key} className={`import-upload-${entry.status}`}>
                  <span>{entry.name}</span>
                  <progress value={entry.fraction} max={1} aria-label={`Upload progress for ${entry.name}`} />
                  <small>{entry.message}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <h2>Import history</h2>
          <span>{imports.length} file{imports.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? (
          <div className="empty-state">Loading imports…</div>
        ) : !imports.length ? (
          <AdminEmptyState title="No past questions have been imported yet" hint="Upload a paper above. It stays in review until you approve its questions." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Bank</th>
                  <th scope="col">Status</th>
                  <th scope="col">Questions</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Added</th>
                  <th scope="col"><span className="er-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {imports.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.original_filename}</strong>
                      <br /><small>{entry.paper_year || 'Undated'} · <TimeAgo value={entry.created_at} /></small>
                    </td>
                    <td>{entry.exam_body} · {entry.subject}</td>
                    <td><StatusBadge status={STATUS_LABEL[entry.status]} /></td>
                    <td>{entry.item_count}</td>
                    <td>{entry.imported_count}</td>
                    <td>{entry.duplicate_count}</td>
                    <td className="right">
                      <button type="button" className="admin-text-btn" onClick={() => void openImport(entry.id)}>Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function summarize(items: AdminQuestionImportItem[]) {
  return {
    pending: items.filter((item) => item.review_status === 'pending').length,
    approved: items.filter((item) => item.review_status === 'approved').length,
    rejected: items.filter((item) => item.review_status === 'rejected').length,
    imported: items.filter((item) => item.review_status === 'imported').length,
  };
}
