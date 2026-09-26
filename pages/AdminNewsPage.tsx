import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  createAdminNews,
  deleteAdminNews,
  fetchAdminNews,
  updateAdminNews,
  uploadAdminImage,
  type AdminNewsArticle,
} from '../src/lib/api';
import { looksLikeHtml, sanitizeRichHtml } from '../src/lib/html-sanitize';
import { AdminEmptyState, StatusBadge, TimeAgo, TableSkeleton } from '../src/components/admin/AdminKit';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

const CATEGORIES = ['general', 'jamb', 'waec', 'neco', 'nelfund', 'admissions', 'scholarships', 'campus'];

type EditorState = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  sourceName: string;
  sourceUrl: string;
  published: boolean;
  body: string;
};

const emptyEditor: EditorState = {
  id: null, title: '', slug: '', excerpt: '', category: 'general',
  imageUrl: '', sourceName: '', sourceUrl: '', published: false, body: '',
};

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<AdminNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bodyHtmlRef = useRef('');
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      setError('');
      setArticles(await fetchAdminNews());
    } catch (e) {
      setArticles([]);
      setError(e instanceof Error ? e.message : 'Unable to load newsroom articles.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => articles
    .filter((a) => (filter === 'all' ? true : filter === 'published' ? a.published : !a.published))
    .filter((a) => !query.trim() || a.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
  [articles, filter, query]);

  function openCreate() { setEditor({ ...emptyEditor }); setMessage(''); }
  function openEdit(article: AdminNewsArticle) {
    setEditor({
      id: article.id, title: article.title, slug: article.slug, excerpt: article.excerpt || '',
      category: article.category || 'general', imageUrl: article.image_url || '',
      sourceName: article.source_name || '', sourceUrl: article.source_url || '',
      published: article.published, body: article.body || '',
    });
    bodyHtmlRef.current = article.body || '';
    setMessage('');
  }

  async function save(publish?: boolean) {
    if (!editor) return;
    const body = bodyHtmlRef.current;
    if (!editor.title.trim()) { setError('An article title is required.'); return; }
    if (!body.trim()) { setError('The article body cannot be empty.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: editor.title.trim(),
        slug: editor.slug.trim() || undefined,
        excerpt: editor.excerpt.trim() || null,
        body,
        category: editor.category,
        image_url: editor.imageUrl.trim() || null,
        source_name: editor.sourceName.trim() || null,
        source_url: editor.sourceUrl.trim() || null,
        published: publish === undefined ? editor.published : publish,
      };
      const saved = editor.id ? await updateAdminNews(editor.id, payload) : await createAdminNews(payload);
      setArticles((items) => {
        const rest = items.filter((item) => item.id !== saved.id);
        return [saved, ...rest];
      });
      setEditor({ ...emptyEditor, id: saved.id, title: saved.title, slug: saved.slug, excerpt: saved.excerpt || '', category: saved.category || 'general', imageUrl: saved.image_url || '', sourceName: saved.source_name || '', sourceUrl: saved.source_url || '', published: saved.published, body: saved.body || '' });
      bodyHtmlRef.current = saved.body || '';
      setMessage(saved.published ? 'Article published — it is live on the news page.' : 'Draft saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the article.');
    } finally { setSaving(false); }
  }

  async function togglePublished(article: AdminNewsArticle) {
    try {
      const updated = await updateAdminNews(article.id, { published: !article.published });
      setArticles((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.published ? `“${updated.title}” is now published.` : `“${updated.title}” is now an unpublished draft.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the article.');
    }
  }

  async function remove(article: AdminNewsArticle) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${article.title}”. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminNews(article.id);
      setArticles((items) => items.filter((item) => item.id !== article.id));
      if (editor?.id === article.id) setEditor(null);
      setMessage('Article permanently deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete the article.');
    }
  }

  async function uploadFeaturedImage(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError('Images must be 2 MB or smaller.'); return; }
    setUploadingImage(true); setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadAdminImage(dataUrl);
      setEditor((state) => state ? { ...state, imageUrl: uploaded.url } : state);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally { setUploadingImage(false); }
  }

  function openPreview() {
    if (!editor) return;
    const html = bodyHtmlRef.current;
    if (!html.trim()) { setError('Nothing to preview yet — write the article body first.'); return; }
    setPreviewHtml(html);
    setShowPreview(true);
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Newsroom CMS</h1>
            <p>Publish notices to the student news page. Saved here means saved in Supabase — the site reads the same records.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
            <button type="button" className="admin-btn" onClick={openCreate}><Plus size={14} /> New article</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {editor && (
          <div className="admin-card admin-news-editor">
            <div className="admin-card-header">
              <h2>{editor.id ? 'Edit article' : 'New article'}</h2>
              <button type="button" className="admin-text-btn" onClick={() => { setEditor(null); setMessage(''); }}>Close editor</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <label className="admin-field"><span>Title *</span>
                  <input className="admin-input" style={{ width: '100%' }} value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="e.g. JAMB announces 2027 UTME registration dates" />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Slug (optional)</span>
                    <input className="admin-input" value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} placeholder="auto-generated from title" />
                  </label>
                  <label className="admin-field"><span>Category</span>
                    <select className="admin-select" value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })}>
                      {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="admin-field admin-field-check">
                    <span>Status</span>
                    <span className="admin-check-row">
                      <input id="news-published" type="checkbox" checked={editor.published} onChange={(e) => setEditor({ ...editor, published: e.target.checked })} />
                      <label htmlFor="news-published">{editor.published ? 'Published' : 'Draft'}</label>
                    </span>
                  </label>
                </div>
                <label className="admin-field"><span>Excerpt / summary</span>
                  <textarea className="admin-textarea" style={{ minHeight: 64 }} value={editor.excerpt} onChange={(e) => setEditor({ ...editor, excerpt: e.target.value })} placeholder="One or two sentences shown in listings" />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Source name</span>
                    <input className="admin-input" value={editor.sourceName} onChange={(e) => setEditor({ ...editor, sourceName: e.target.value })} placeholder="e.g. JAMB Weekly" />
                  </label>
                  <label className="admin-field"><span>Source URL (https)</span>
                    <input className="admin-input" value={editor.sourceUrl} onChange={(e) => setEditor({ ...editor, sourceUrl: e.target.value })} placeholder="https://…" />
                  </label>
                </div>
                <div className="admin-field"><span>Featured image</span>
                  <div className="admin-image-row">
                    {editor.imageUrl ? <img src={editor.imageUrl} alt="Featured preview" className="admin-image-preview" /> : <div className="admin-image-preview empty">No image</div>}
                    <input className="admin-input" style={{ flex: 1 }} value={editor.imageUrl} onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })} placeholder="https://… or upload" />
                    <button type="button" className="admin-btn small" disabled={uploadingImage} onClick={() => imageFileRef.current?.click()}><Upload size={13} /> {uploadingImage ? 'Uploading…' : 'Upload'}</button>
                    {editor.imageUrl && <button type="button" className="admin-text-btn danger-text" onClick={() => setEditor({ ...editor, imageUrl: '' })}>Remove</button>}
                  </div>
                </div>
              </div>

              <div className="admin-field"><span>Article body *</span>
                <AdminRichTextEditor
                  key={editor.id || 'new'}
                  initialValue={editor.body}
                  placeholder="Write the article…"
                  onChange={(html) => { bodyHtmlRef.current = html; }}
                />
              </div>

              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn secondary-dark" onClick={openPreview}><Eye size={14} /> Preview</button>
                <button type="button" className="admin-btn secondary-dark" onClick={() => void save(false)} disabled={saving}>Save draft</button>
                <button type="button" className="admin-btn success" onClick={() => void save(true)} disabled={saving}>{saving ? 'Saving…' : 'Publish'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-filter-card">
          <select className="admin-select" aria-label="Filter articles by state" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All articles</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
          <input className="admin-input admin-search" aria-label="Search articles" placeholder="Search by title" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="admin-filter-count">{visible.length} of {articles.length}</span>
        </div>

        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Category</th><th>State</th><th>Updated</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={5} />}
                {!loading && visible.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <b>{article.title}</b>
                      <div className="muted">/{article.slug}</div>
                    </td>
                    <td>{article.category}</td>
                    <td><StatusBadge status={article.published ? 'published' : 'draft'} /></td>
                    <td><TimeAgo value={article.updated_at} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => openEdit(article)}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-btn small" onClick={() => void togglePublished(article)}>{article.published ? 'Unpublish' : 'Publish'}</button>
                        <button type="button" className="admin-text-btn danger-text" onClick={() => void remove(article)}><Trash2 size={12} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !visible.length && (
                  <tr><td colSpan={5} className="empty-state">
                    {articles.length
                      ? 'No articles match this filter.'
                      : <AdminEmptyState title="No news articles yet" hint="Create the first article — it goes straight to the live news page when published." action={<button type="button" className="admin-btn small" onClick={openCreate}><Plus size={13} /> New article</button>} />}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showPreview && (
          <div className="admin-modal-backdrop" onClick={() => setShowPreview(false)} role="presentation">
            <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Article preview" onClick={(e) => e.stopPropagation()}>
              <div className="admin-card-header">
                <h2>Preview — exactly what students will read</h2>
                <button type="button" className="admin-text-btn" onClick={() => setShowPreview(false)}>Close</button>
              </div>
              <div className="admin-modal-body hub-article-body">
                {editor?.imageUrl && <img src={editor.imageUrl} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />}
                <span className="status-badge published">{editor?.category}</span>
                <h2 style={{ margin: '10px 0 4px' }}>{editor?.title}</h2>
                <div className="muted" style={{ marginBottom: 12 }}>Preview · {new Date().toLocaleDateString()}</div>
                {looksLikeHtml(previewHtml)
                  ? <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewHtml) }} />
                  : previewHtml.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                {editor?.sourceUrl && <p className="muted">Source: <a href={editor.sourceUrl} target="_blank" rel="noopener noreferrer">{editor.sourceName || editor.sourceUrl}</a></p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
