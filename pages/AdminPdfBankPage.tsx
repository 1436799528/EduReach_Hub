import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Upload, Route, FolderOpen } from 'lucide-react';
import { userFacingError } from '../lib/errors';
import {
  fetchAdminInstitutions,
  fetchAdminPdfBank,
  routeAdminPdf,
  uploadAdminPdf,
  type AdminInstitution,
  type AdminPdfDocument,
} from '../src/lib/api';

type Destination = AdminPdfDocument['destination'];
type Draft = {
  title: string;
  destination: Destination;
  exam_body: string;
  institution_id: string;
  subject: string;
  course: string;
  paper_year: string;
  description: string;
  source_name: string;
  source_url: string;
  source_verified: boolean;
};
const destinations: Array<{ value: Destination; label: string }> = [
  { value: 'inbox', label: 'Keep in inbox' },
  { value: 'past_questions', label: 'Past-question library' },
  { value: 'admission_guides', label: 'Admission guides' },
  { value: 'scholarships', label: 'Scholarships & opportunities' },
  { value: 'news_attachments', label: 'News attachments' },
  { value: 'school_resources', label: 'School resources' },
  { value: 'other', label: 'Other / reference' },
];
function draftFor(item: AdminPdfDocument): Draft {
  return {
    title: item.title,
    destination: item.destination,
    exam_body: item.exam_body || '',
    institution_id: item.institution_id || '',
    subject: item.subject || '',
    course: item.course || '',
    paper_year: item.paper_year ? String(item.paper_year) : '',
    description: item.description || '',
    source_name: item.source_name || '',
    source_url: item.source_url || '',
    source_verified: item.source_verified || false,
  };
}
function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected PDF.'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export default function AdminPdfBankPage() {
  const [items, setItems] = useState<AdminPdfDocument[]>([]);
  const [institutions, setInstitutions] = useState<AdminInstitution[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [routingId, setRoutingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all'|'inbox'|'routed'>('all');

  async function load() {
    setLoading(true);
    try {
      setError('');
      const [documents, schools] = await Promise.all([fetchAdminPdfBank(), fetchAdminInstitutions()]);
      setItems(documents);
      setInstitutions(schools);
      setDrafts(Object.fromEntries(documents.map((item) => [item.id, draftFor(item)])));
    } catch (e) {
      setError(userFacingError(e, 'Unable to load the PDF bank.'));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'inbox' ? item.status === 'inbox' : item.status === 'routed')), [items, filter]);
  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function upload() {
    if (!file) { setError('Choose a PDF first.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('PDF files must be 10 MB or smaller.'); return; }
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF file.'); return; }
    setUploading(true); setError(''); setMessage('');
    try {
      const dataUrl = await fileAsDataUrl(file);
      const item = await uploadAdminPdf({ dataUrl, filename: file.name, title: title.trim() || file.name.replace(/\.pdf$/i, ''), description: description.trim() });
      setItems((current) => [item, ...current]);
      setDrafts((current) => ({ ...current, [item.id]: draftFor(item) }));
      setFile(null); setTitle(''); setDescription('');
      setMessage('PDF uploaded to the central inbox. Review its details and choose a destination before it is made available to students.');
    } catch (e) { setError(userFacingError(e, 'Unable to upload the PDF.')); }
    finally { setUploading(false); }
  }

  async function route(item: AdminPdfDocument) {
    const draft = drafts[item.id];
    if (!draft) return;
    if (draft.destination === 'past_questions' && !draft.exam_body) { setError('Choose the examination body for this past question.'); return; }
    if (draft.destination === 'past_questions' && draft.exam_body === 'POST-UTME' && !draft.institution_id) { setError('Choose the institution for this Post-UTME paper.'); return; }
    if (draft.destination === 'past_questions' && draft.source_verified && !draft.source_name.trim()) { setError('Enter the source or organisation before marking this paper verified.'); return; }
    setRoutingId(item.id); setError(''); setMessage('');
    try {
      const updated = await routeAdminPdf(item.id, { ...draft, paper_year: draft.paper_year || null });
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      setDrafts((current) => ({ ...current, [updated.id]: draftFor(updated) }));
      setMessage(updated.destination === 'past_questions'
        ? (updated.source_verified
          ? 'PDF routed and marked source-verified. It is available in the matching student past-question filters.'
          : 'PDF routed to the past-question library as an unpublished draft. Students cannot see it until you verify its source and classification.')
        : updated.destination === 'inbox'
          ? 'PDF returned to the inbox.'
          : 'PDF filed under the selected destination in the central document bank.');
    } catch (e) { setError(userFacingError(e, 'Unable to route this PDF.')); }
    finally { setRoutingId(''); }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div><h1>PDF Bank</h1><p>Upload PDFs once, keep a central record, then classify and route them. Nothing is automatically labelled as an official past paper.</p></div>
        <div className="admin-header-actions"><button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button></div>
      </div>

      {error && <div className="admin-card" role="alert" style={{ padding: 14 }}>{error}</div>}
      {message && <div className="admin-card" role="status" style={{ padding: 14, borderLeft: '4px solid var(--admin-green)' }}>{message}</div>}

      <section className="admin-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="admin-card-header"><h2><Upload size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Upload PDF</h2><span className="admin-filter-count">PDF only · up to 10 MB</span></div>
        <div className="admin-news-form-grid">
          <label className="admin-field"><span>PDF file *</span><input className="admin-input" type="file" accept="application/pdf,.pdf" onChange={(e) => { const selected = e.target.files?.[0] || null; setFile(selected); if (selected && !title) setTitle(selected.name.replace(/\.pdf$/i, '')); }} /></label>
          <label className="admin-field"><span>Document title</span><input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2025 Post-UTME past questions" /></label>
          <label className="admin-field"><span>Initial note (optional)</span><textarea className="admin-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this document, and who is it for?" /></label>
        </div>
        <div className="admin-news-editor-actions"><button type="button" className="admin-btn" onClick={() => void upload()} disabled={uploading || !file}>{uploading ? 'Uploading…' : 'Upload to PDF bank'}</button></div>
      </section>

      <div className="admin-filter-card">
        <select className="admin-select" aria-label="Filter PDF bank" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All PDFs</option><option value="inbox">Needs routing</option><option value="routed">Routed</option></select>
        <span className="admin-filter-count">{loading ? 'Loading…' : `${visible.length} documents`}</span>
      </div>

      {loading ? <div className="admin-card" style={{ padding: 20 }}>Loading PDF bank…</div> : !visible.length ? (
        <div className="admin-card" style={{ padding: 24, textAlign: 'center' }}><FolderOpen size={26} /><h2>No PDFs here yet</h2><p className="muted">Uploaded files will appear here for review and routing.</p></div>
      ) : <div className="admin-stack">
        {visible.map((item) => {
          const draft = drafts[item.id] || draftFor(item);
          return <article className="admin-card" key={item.id} style={{ padding: 18 }}>
            <div className="admin-card-header">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><FileText size={22} /><div><h2 style={{ margin: 0 }}>{item.title}</h2><p className="muted" style={{ margin: '4px 0' }}>{item.original_filename} · {(item.file_bytes / 1024 / 1024).toFixed(2)} MB</p><small className="muted">Uploaded {new Date(item.created_at).toLocaleString()}</small></div></div>
              <span className="admin-filter-count">{item.status === 'routed' ? (item.destination === 'past_questions' && !item.source_verified ? 'Routed · pending verification' : destinations.find((d) => d.value === item.destination)?.label || 'Routed') : item.status === 'rejected' ? 'Rejected' : 'Needs routing'}</span>
            </div>
            <div className="admin-news-form-grid">
              <label className="admin-field"><span>Title *</span><input className="admin-input" value={draft.title} onChange={(e) => patchDraft(item.id, { title: e.target.value })} /></label>
              <label className="admin-field"><span>Destination</span><select className="admin-select" value={draft.destination} onChange={(e) => patchDraft(item.id, { destination: e.target.value as Destination })}>{destinations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
              {draft.destination === 'past_questions' && <>
                <label className="admin-field"><span>Exam body *</span><select className="admin-select" value={draft.exam_body} onChange={(e) => patchDraft(item.id, { exam_body: e.target.value })}><option value="">Choose…</option><option>JAMB</option><option>WAEC</option><option>NECO</option><option>POST-UTME</option></select></label>
                {draft.exam_body === 'POST-UTME' && <label className="admin-field"><span>Institution *</span><select className="admin-select" value={draft.institution_id} onChange={(e) => patchDraft(item.id, { institution_id: e.target.value })}><option value="">Choose school…</option>{institutions.filter((school) => school.post_utme_available && school.post_utme_verified && school.post_utme_method === 'handwritten').map((school) => <option key={school.id} value={school.id}>{school.school_name}</option>)}</select><small className="muted">Only verified handwritten-screening schools can receive Post-UTME PDFs.</small></label>}
                <label className="admin-field"><span>Subject</span><input className="admin-input" value={draft.subject} onChange={(e) => patchDraft(item.id, { subject: e.target.value })} placeholder="e.g. Biology" /></label>
                <label className="admin-field"><span>Course (optional)</span><input className="admin-input" value={draft.course} onChange={(e) => patchDraft(item.id, { course: e.target.value })} /></label>
                <label className="admin-field"><span>Paper year</span><input className="admin-input" type="number" min="1954" max="2100" value={draft.paper_year} onChange={(e) => patchDraft(item.id, { paper_year: e.target.value })} /></label>
              </>}
              <label className="admin-field"><span>Description</span><textarea className="admin-textarea" value={draft.description} onChange={(e) => patchDraft(item.id, { description: e.target.value })} /></label>
              <label className="admin-field"><span>Source / organisation</span><input className="admin-input" value={draft.source_name} onChange={(e) => patchDraft(item.id, { source_name: e.target.value })} placeholder="e.g. Official university portal" /></label>
              <label className="admin-field"><span>Source URL (HTTPS)</span><input className="admin-input" value={draft.source_url} onChange={(e) => patchDraft(item.id, { source_url: e.target.value })} placeholder="https://…" /></label>
              {draft.destination === 'past_questions' && <label className="admin-check-row" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={draft.source_verified} onChange={(e) => patchDraft(item.id, { source_verified: e.target.checked })} />
                <span><strong>Verify source and classification</strong><small className="muted" style={{ display: 'block' }}>Confirm you reviewed the document, exam body, school (if applicable), subject/year and provenance. If unchecked, it remains unpublished and students cannot access it.</small></span>
              </label>}
            </div>
            {draft.destination !== 'inbox' && draft.destination !== 'past_questions' && <p className="admin-quality-gate">This destination is recorded in the central PDF bank. Student-facing attachment support for this content type must be connected before this file appears in that module.</p>}
            <div className="admin-news-editor-actions"><button type="button" className="admin-btn" onClick={() => void route(item)} disabled={routingId === item.id}><Route size={14} /> {routingId === item.id ? 'Routing…' : draft.destination === 'inbox' ? 'Save as inbox item' : 'Route PDF'}</button></div>
          </article>;
        })}
      </div>}
    </div>
  );
}
