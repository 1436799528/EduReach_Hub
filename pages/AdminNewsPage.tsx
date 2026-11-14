import { userFacingError } from '../lib/errors';
import { useModalDialog } from '../src/lib/useModalDialog';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, Pencil, Plus, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import {
  createAdminNews,
  deleteAdminNews,
  fetchAdminNews,
  restoreAdminNews,
  updateAdminNews,
  uploadAdminImage,
  type AdminNewsArticle,
} from '../src/lib/api';
import { newsCategories, newsCategoryLabel, newsCategoryOptions } from '../src/data/newsCategories';
import { looksLikeHtml, sanitizeRichHtml } from '../src/lib/html-sanitize';
import { AdminEmptyState, AdminPageReport, StatusBadge, TimeAgo, TableSkeleton } from '../src/components/admin/AdminKit';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';
import AdminNewsroomQueue from '../src/components/admin/AdminNewsroomQueue';
import AdminSortButton from '../src/components/admin/AdminSortButton';
import { ariaSortFor, nextSortState, sortRows, NO_SORT, type SortState } from '../src/lib/tableSort';
import { Can } from '../src/components/admin/Can';

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
  publishedAt: string;
  featured: boolean;
  tags: string;
  body: string;
  isPlaceholder: boolean;
  placeholderNote: string;
  confirmReplacement: boolean;
};

const emptyEditor: EditorState = {
  id: null, title: '', slug: '', excerpt: '', category: 'general',
  imageUrl: '', sourceName: '', sourceUrl: '', published: false,
  publishedAt: '', featured: false, tags: '', body: '', isPlaceholder: false, placeholderNote: '', confirmReplacement: false,
};

/** datetime-local value ↔ ISO helpers (local timezone in, UTC stored). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<AdminNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'placeholder'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestNumber = useRef(0);
  const listOptions = useRef({ page, state: filter, search: query });
  listOptions.current = { page, state: filter, search: query };
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sort, setSort] = useState<SortState>(NO_SORT);
  const [selected, setSelected] = useState<Map<string, AdminNewsArticle>>(new Map());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [undoBatch, setUndoBatch] = useState<{ items: AdminNewsArticle[]; expiresAt: number } | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [undoBusy, setUndoBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const lastSelectedRef = useRef('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [gateError, setGateError] = useState('');
  const bodyHtmlRef = useRef('');
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const request = ++requestNumber.current;
    setLoading(true); setError('');
    try {
      const result = await fetchAdminNews({ ...listOptions.current, pageSize: 50 });
      if (request === requestNumber.current) { setArticles(result.items); setHasMore(result.hasMore); }
    } catch (e) {
      if (request === requestNumber.current) { setArticles([]); setHasMore(false); setError(userFacingError(e, 'Unable to load newsroom articles.')); }
    } finally { if (request === requestNumber.current) setLoading(false); }
  }
  // A11Y-1: focus enters the preview, Tab stays inside it, Escape closes it.
  const previewDialogRef = useModalDialog<HTMLDivElement>(showPreview, () => setShowPreview(false));

  useEffect(() => {
    setLoading(true); setArticles([]); setHasMore(false);
    const timer = window.setTimeout(() => { void load(); }, 200);
    return () => { window.clearTimeout(timer); requestNumber.current++; };
  }, [page, filter, query]);

  const visible = sortRows(articles, sort, (article, key) => {
    if (key === 'title') return article.title;
    if (key === 'category') return newsCategoryLabel(article.category);
    if (key === 'state') return article.published ? 'published' : 'draft';
    if (key === 'published') return article.published_at ? new Date(article.published_at).getTime() : null;
    if (key === 'updated') return new Date(article.updated_at).getTime();
    return null;
  });

  /* ---------------- selection, bulk delete and undo ---------------- */
  // Selection is the id -> row snapshot map, not just ids: bulk delete must be
  // able to offer Undo after the server rows are gone, and a selection has to
  // survive a page change where the row is no longer in `visible`.
  const selectedOnPage = visible.filter((article) => selected.has(article.id)).length;
  const allOnPageSelected = visible.length > 0 && selectedOnPage === visible.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;
  const selectAllLabel = `Select all ${visible.length} matching${hasMore ? ' on this page' : ''}`;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPageSelected;
  }, [someOnPageSelected, loading]);

  useEffect(() => {
    if (!undoBatch) { setUndoSeconds(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((undoBatch.expiresAt - Date.now()) / 1000));
      setUndoSeconds(remaining);
      if (remaining === 0) setUndoBatch(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [undoBatch]);

  function toggleSelected(article: AdminNewsArticle, checked: boolean, range = false) {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) {
        const start = visible.findIndex((row) => row.id === lastSelectedRef.current);
        const end = visible.findIndex((row) => row.id === article.id);
        if (range && start >= 0 && end >= 0 && start !== end) {
          visible.slice(Math.min(start, end), Math.max(start, end) + 1).forEach((row) => next.set(row.id, row));
        } else {
          next.set(article.id, article);
        }
      } else {
        next.delete(article.id);
      }
      return next;
    });
    lastSelectedRef.current = article.id;
  }

  function toggleSelectPage(checked: boolean) {
    setSelected((current) => {
      const next = new Map(current);
      for (const article of visible) {
        if (checked) next.set(article.id, article); else next.delete(article.id);
      }
      return next;
    });
  }

  async function deleteSelected() {
    if (bulkDeleting || !selected.size) return;
    const items = [...selected.values()];
    setBulkDeleting(true);
    setError('');
    setMessage('');
    const deleted: AdminNewsArticle[] = [];
    const failed: AdminNewsArticle[] = [];
    for (const article of items) {
      try {
        await deleteAdminNews(article.id);
        deleted.push(article);
      } catch {
        failed.push(article);
      }
    }
    const deletedIds = new Set(deleted.map((article) => article.id));
    setArticles((current) => current.filter((article) => !deletedIds.has(article.id)));
    setSelected(new Map());
    if (deleted.length) {
      setUndoBatch({ items: deleted, expiresAt: Date.now() + 10_000 });
      setUndoSeconds(10);
      setMessage(`${deleted.length} article${deleted.length === 1 ? '' : 's'} deleted.`);
    }
    if (failed.length) {
      setError(`${failed.length} article${failed.length === 1 ? '' : 's'} could not be deleted. ${deleted.length ? `${deleted.length} were deleted.` : ''} Try the remaining selection again.`.trim());
      setSelected(new Map(failed.map((article) => [article.id, article] as const)));
    }
    setBulkDeleting(false);
  }

  async function undoDelete() {
    if (!undoBatch || undoBusy) return;
    setUndoBusy(true);
    setError('');
    const restored: AdminNewsArticle[] = [];
    const failed: AdminNewsArticle[] = [];
    for (const article of undoBatch.items) {
      try {
        restored.push(await restoreAdminNews(article));
      } catch {
        failed.push(article);
      }
    }
    if (restored.length) {
      setMessage(`${restored.length} article${restored.length === 1 ? '' : 's'} restored.`);
      await load();
    }
    if (failed.length) {
      setError(`${failed.length} article${failed.length === 1 ? '' : 's'} could not be restored. Nothing was invented; try Undo again before the countdown ends.`);
      setUndoBatch({ items: failed, expiresAt: Date.now() + 10_000 });
    } else {
      setUndoBatch(null);
    }
    setUndoBusy(false);
  }

  function openCreate() { setEditor({ ...emptyEditor }); setMessage(''); setGateError(''); }
  function openEdit(article: AdminNewsArticle) {
    setEditor({
      id: article.id, title: article.title, slug: article.slug, excerpt: article.excerpt || '',
      category: article.category || 'general', imageUrl: article.image_url || '',
      sourceName: article.source_name || '', sourceUrl: article.source_url || '',
      published: article.published, publishedAt: toLocalInputValue(article.published_at),
      featured: article.featured === true, tags: article.tags || '', body: article.body || '',
      isPlaceholder: article.is_placeholder === true, placeholderNote: article.placeholder_note || '', confirmReplacement: false,
    });
    bodyHtmlRef.current = article.body || '';
    setMessage(''); setGateError('');
  }

  /**
   * Publication quality gate (§21). A published article must look like a
   * finished education-news article - the save is refused until it does.
   * Drafts only need a title so work is never lost.
   */
  function validateForPublish(next: EditorState, body: string): string | null {
    if (!next.title.trim()) return 'A meaningful title is required before publishing.';
    if (next.title.trim().length < 15) return 'The title is too short. Write a headline students can understand.';
    if (!next.excerpt.trim()) return 'Add a summary. It appears on cards and at the top of the article.';
    if (!body.trim() || body.replace(/<[^>]*>/g, '').trim().length < 80) return 'The article body is too short to publish. Write the full story first.';
    if (!next.category.trim()) return 'Choose a category before publishing.';
    if (next.publishedAt && !Number.isFinite(new Date(next.publishedAt).getTime())) return 'The publication date is invalid.';
    if (next.sourceUrl.trim()) {
      try {
        const parsed = new URL(next.sourceUrl.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'The source URL must be a real web address.';
      } catch {
        return 'The source URL is not a valid link.';
      }
    }
    return null;
  }

  async function save(publish?: boolean) {
    if (!editor) return;
    const body = bodyHtmlRef.current;
    const wantsPublish = publish === undefined ? editor.published : publish;
    if (!editor.title.trim()) { setError('An article title is required.'); return; }
    if (!body.trim()) { setError('The article body cannot be empty.'); return; }
    if (editor.isPlaceholder && !editor.placeholderNote.trim()) { setError('Describe what information is needed for this placeholder.'); return; }
    if (wantsPublish && editor.isPlaceholder) { setGateError('Replace the placeholder and save it as a draft before publishing.'); return; }
    if (wantsPublish && articles.some((article) => article.id === editor.id && article.is_placeholder)) { setGateError('Save the replacement as a draft before publishing it.'); return; }
    if (wantsPublish) {
      const gate = validateForPublish(editor, body);
      if (gate) { setGateError(gate); return; }
    }
    setGateError('');
    setSaving(true); setError('');
    try {
      const publishedAtIso = editor.publishedAt ? new Date(editor.publishedAt).toISOString() : null;
      const payload = {
        title: editor.title.trim(),
        slug: editor.slug.trim() || undefined,
        excerpt: editor.excerpt.trim() || null,
        body,
        category: editor.category,
        image_url: editor.imageUrl.trim() || null,
        source_name: editor.sourceName.trim() || null,
        source_url: editor.sourceUrl.trim() || null,
        published: wantsPublish,
        published_at: wantsPublish ? publishedAtIso : null,
        featured: editor.featured,
        tags: editor.tags.trim() || null,
        is_placeholder: editor.isPlaceholder,
        placeholder_note: editor.isPlaceholder ? editor.placeholderNote.trim() : null,
        confirm_placeholder_replacement: editor.confirmReplacement,
      };
      const saved = editor.id ? await updateAdminNews(editor.id, payload) : await createAdminNews(payload);
      setArticles((items) => {
        const rest = items.filter((item) => item.id !== saved.id);
        return [saved, ...rest];
      });
      setEditor({
        ...emptyEditor, id: saved.id, title: saved.title, slug: saved.slug,
        excerpt: saved.excerpt || '', category: saved.category || 'general',
        imageUrl: saved.image_url || '', sourceName: saved.source_name || '',
        sourceUrl: saved.source_url || '', published: saved.published,
        publishedAt: toLocalInputValue(saved.published_at), featured: saved.featured === true,
        tags: saved.tags || '', body: saved.body || '',
        isPlaceholder: saved.is_placeholder === true, placeholderNote: saved.placeholder_note || '', confirmReplacement: false,
      });
      bodyHtmlRef.current = saved.body || '';
      setMessage(saved.published ? 'Article published. It is live on the news page.' : 'Draft saved.');
      void load();
    } catch (e) {
      setError(userFacingError(e, 'Unable to save the article.'));
    } finally { setSaving(false); }
  }

  async function togglePublished(article: AdminNewsArticle) {
    try {
      const updated = await updateAdminNews(article.id, { published: !article.published });
      setArticles((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.published ? `“${updated.title}” is now published.` : `“${updated.title}” is now an unpublished draft.`);
      void load();
    } catch (e) {
      setError(userFacingError(e, 'Unable to update the article.'));
    }
  }

  async function toggleFeatured(article: AdminNewsArticle) {
    try {
      const updated = await updateAdminNews(article.id, { featured: !(article.featured === true) });
      setArticles((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.featured ? `“${updated.title}” now leads the Featured section.` : `“${updated.title}” removed from Featured.`);
      void load();
    } catch (e) {
      setError(userFacingError(e, 'Unable to update the article.'));
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
      void load();
    } catch (e) {
      setError(userFacingError(e, 'Unable to delete the article.'));
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
      setError(userFacingError(e, 'Image upload failed.'));
    } finally { setUploadingImage(false); }
  }

  function openPreview() {
    if (!editor) return;
    const html = bodyHtmlRef.current;
    if (!html.trim()) { setError('Nothing to preview yet. Write the article body first.'); return; }
    setPreviewHtml(html);
    setShowPreview(true);
  }

  const categoryOptions = editor ? newsCategoryOptions(editor.category) : newsCategories;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Newsroom CMS</h1>
          <p>Publish notices to the student news page. Saved here means saved in Supabase. The site reads the same records.</p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          <Can capability="news.create">
            <button type="button" className="admin-btn" onClick={openCreate}><Plus size={14} /> New article</button>
          </Can>
        </div>
      </div>

      <AdminPageReport
        title="Newsroom reporting"
        items={[
          { label: 'Published', value: articles.filter((article) => article.published).length.toLocaleString() },
          { label: 'Drafts', value: articles.filter((article) => !article.published && !article.is_placeholder).length.toLocaleString() },
          { label: 'Placeholders', value: articles.filter((article) => article.is_placeholder).length.toLocaleString() },
          { label: 'Featured', value: articles.filter((article) => article.featured).length.toLocaleString() },
        ]}
      />

      {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
      {message && !undoBatch && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

      {undoBatch && (
        <div className="admin-undo-bar" role="status" aria-live="polite">
          <span className="admin-undo-progress" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, undoSeconds / 10))})` }} />
          </span>
          <span className="admin-undo-copy">
            <strong>{undoBatch.items.length} article{undoBatch.items.length === 1 ? '' : 's'} deleted</strong>
            <small>Undo closes in {undoSeconds}s</small>
          </span>
          <button type="button" className="admin-text-btn admin-undo-action" onClick={() => void undoDelete()} disabled={undoBusy}>
            {undoBusy ? 'Restoring…' : 'Undo'}
          </button>
        </div>
      )}

      <AdminNewsroomQueue onPublished={() => void load()} />

      {editor && (
        <div className="admin-card admin-news-editor">
          <div className="admin-card-header">
            <h2>{editor.id ? 'Edit article' : 'New article'}</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {editor.id && editor.published && (
                <a className="admin-text-btn" href={`/news/${encodeURIComponent(editor.slug || editor.title)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> View live
                </a>
              )}
              <button type="button" className="admin-text-btn" onClick={() => { setEditor(null); setMessage(''); setGateError(''); }}>Close editor</button>
            </div>
          </div>
          <div className="admin-news-editor-body">
            <div className="admin-news-form-grid">
              <label className="admin-field"><span>Title *</span>
                <input className="admin-input" style={{ width: '100%' }} value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="e.g. JAMB announces 2027 UTME registration dates" />
              </label>
              <label className="admin-field">
                <span><input type="checkbox" checked={editor.isPlaceholder} onChange={(e) => {
                  if (!e.target.checked && editor.isPlaceholder && !window.confirm('Have you replaced the placeholder with genuine, verified information? Save it as a draft before publishing.')) return;
                  setEditor({ ...editor, isPlaceholder: e.target.checked, published: e.target.checked ? false : editor.published, confirmReplacement: !e.target.checked });
                }} /> PLACEHOLDER — not publishable until replaced</span>
              </label>
              {editor.isPlaceholder && <label className="admin-field"><span>Information needed *</span>
                <textarea className="admin-textarea" maxLength={1000} value={editor.placeholderNote} onChange={(e) => setEditor({ ...editor, placeholderNote: e.target.value })} />
              </label>}
              <div className="admin-field-row">
                <label className="admin-field"><span>Slug (optional)</span>
                  <input className="admin-input" value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} placeholder="auto-generated from title" />
                </label>
                <label className="admin-field"><span>Category</span>
                  <select className="admin-select" value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })}>
                    {categoryOptions.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                  </select>
                </label>
                <label className="admin-field admin-field-check">
                  <span>Status</span>
                  <span className="admin-check-row">
                    <input id="news-published" type="checkbox" checked={editor.published} onChange={(e) => setEditor({ ...editor, published: e.target.checked })} />
                    <label htmlFor="news-published">{editor.published ? 'Published' : 'Draft'}</label>
                  </span>
                </label>
                <label className="admin-field admin-field-check">
                  <span>Highlight on homepage</span>
                  <span className="admin-check-row">
                    <input id="news-featured" type="checkbox" checked={editor.featured} onChange={(e) => setEditor({ ...editor, featured: e.target.checked })} />
                    <label htmlFor="news-featured">{editor.featured ? 'Selected for student-critical highlights' : 'Regular news feed only'}</label>
                  </span>
                </label>
              </div>
              <p className="admin-quality-gate">Highlight only high-impact student updates: exam and admission decisions, registration changes, results, deadlines, funding decisions or policy changes students are actively waiting for. Routine announcements remain in the regular news feed. Only the first two highlighted stories appear in the featured section.</p>
              <div className="admin-field-row">
                <label className="admin-field"><span>Publication date {editor.published ? '*' : '(set when publishing)'}</span>
                  <input className="admin-input" type="datetime-local" value={editor.publishedAt} onChange={(e) => setEditor({ ...editor, publishedAt: e.target.value })} />
                </label>
                <label className="admin-field"><span>Tags (comma-separated)</span>
                  <input className="admin-input" value={editor.tags} onChange={(e) => setEditor({ ...editor, tags: e.target.value })} placeholder="utme 2027, registration" />
                </label>
              </div>
              <label className="admin-field"><span>Excerpt / summary *</span>
                <textarea className="admin-textarea" style={{ minHeight: 64 }} value={editor.excerpt} onChange={(e) => setEditor({ ...editor, excerpt: e.target.value })} placeholder="One or two sentences shown in listings" />
              </label>
              <div className="admin-field-row">
                <label className="admin-field"><span>Source / organisation</span>
                  <input className="admin-input" value={editor.sourceName} onChange={(e) => setEditor({ ...editor, sourceName: e.target.value })} placeholder="e.g. JAMB, University of Lagos" />
                </label>
                <label className="admin-field"><span>Source URL (https)</span>
                  <input className="admin-input" value={editor.sourceUrl} onChange={(e) => setEditor({ ...editor, sourceUrl: e.target.value })} placeholder="https://…" />
                </label>
              </div>
              <div className="admin-field"><span>Featured image</span>
                <div className="admin-image-row">
                  {editor.imageUrl ? <img src={editor.imageUrl} alt="Featured preview" className="admin-image-preview" loading="lazy" decoding="async" /> : <div className="admin-image-preview empty">No image</div>}
                  <input className="admin-input" aria-label="Featured image URL" style={{ flex: 1 }} value={editor.imageUrl} onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })} placeholder="https://… or upload" />
                  <button type="button" className="admin-btn small" disabled={uploadingImage} onClick={() => imageFileRef.current?.click()}><Upload size={13} /> {uploadingImage ? 'Uploading…' : 'Upload'}</button>
                  {editor.imageUrl && <button type="button" className="admin-text-btn danger-text" onClick={() => setEditor({ ...editor, imageUrl: '' })}>Remove</button>}
                </div>
                <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void uploadFeaturedImage(file);
                }} />
                <small className="admin-quality-gate">Uploads go to the Supabase Storage `admin-content` bucket and the URL is stored on this article. Each article shows its own image. Articles without one render a placeholder, never a shared stock photo.</small>
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

            {gateError && <div className="admin-quality-gate is-error" role="alert">{gateError}</div>}

            <div className="admin-news-editor-actions">
              <button type="button" className="admin-btn secondary-dark" onClick={openPreview}><Eye size={14} /> Preview</button>
              <button type="button" className="admin-btn secondary-dark" onClick={() => void save(false)} disabled={saving} aria-busy={saving}>Save draft</button>
              <Can capability="news.publish" fallback={<span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>Publishing needs the news.publish capability.</span>}>
                <button type="button" className="admin-btn success" onClick={() => void save(true)} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : editor.published ? 'Save & keep published' : 'Publish'}</button>
              </Can>
            </div>
          </div>
        </div>
      )}

      <div className="admin-filter-card">
        <select className="admin-select" aria-label="Filter articles by state" value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value as typeof filter); }}>
          <option value="all">All articles</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="placeholder">Placeholders</option>
        </select>
        <input className="admin-input admin-search" aria-label="Search articles" placeholder="Search by title" maxLength={120} value={query} onChange={(e) => { setPage(1); setQuery(e.target.value); }} />
        <span className="admin-filter-count">Page {page} · {visible.length} articles</span>
        <button type="button" className="admin-btn small" disabled={loading || page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <button type="button" className="admin-btn small" disabled={loading || !hasMore} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>

      {selected.size > 0 && (
        <div className="admin-bulk-bar" role="status" aria-live="polite">
          <span><strong>{selected.size}</strong> selected</span>
          <Can capability="news.delete">
            <button type="button" className="admin-btn danger" onClick={() => void deleteSelected()} disabled={bulkDeleting}>
              <Trash2 size={16} aria-hidden="true" /> {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </button>
          </Can>
          <button type="button" className="admin-text-btn" onClick={() => setSelected(new Map())} disabled={bulkDeleting}>Clear selection</button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-table-wrap admin-table-wrap--stack" role="region" aria-label="Scrollable table" tabIndex={0}>
          <table className="admin-table admin-table--stack">
            <thead><tr>
              <Can capability="news.delete" fallback={<th scope="col" className="admin-select-cell" aria-hidden="true" />}>
                <th scope="col" className="admin-select-cell">
                  <label className="admin-check-hit">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label={selectAllLabel}
                      checked={allOnPageSelected}
                      disabled={!visible.length || bulkDeleting}
                      onChange={(event) => toggleSelectPage(event.target.checked)}
                    />
                  </label>
                </th>
              </Can>
              <th scope="col" aria-sort={ariaSortFor(sort, 'title')}><AdminSortButton label="Title" sortKey="title" sort={sort} onSort={(key) => setSort((current) => nextSortState(current, key))} /></th>
              <th scope="col" aria-sort={ariaSortFor(sort, 'category')}><AdminSortButton label="Category" sortKey="category" sort={sort} onSort={(key) => setSort((current) => nextSortState(current, key))} /></th>
              <th scope="col" aria-sort={ariaSortFor(sort, 'state')}><AdminSortButton label="State" sortKey="state" sort={sort} onSort={(key) => setSort((current) => nextSortState(current, key))} /></th>
              <th scope="col" aria-sort={ariaSortFor(sort, 'published')}><AdminSortButton label="Published" sortKey="published" sort={sort} onSort={(key) => setSort((current) => nextSortState(current, key))} /></th>
              <th scope="col" aria-sort={ariaSortFor(sort, 'updated')}><AdminSortButton label="Updated" sortKey="updated" sort={sort} onSort={(key) => setSort((current) => nextSortState(current, key))} /></th>
              <th scope="col" className="right">Actions</th>
            </tr></thead>
            <tbody>
              {loading && <TableSkeleton rows={6} columns={7} />}
              {!loading && visible.map((article) => (
                <tr key={article.id} className={selected.has(article.id) ? 'is-selected' : undefined}>
                  <Can capability="news.delete" fallback={<td className="admin-select-cell" aria-hidden="true" />}>
                    <td className="admin-select-cell">
                      <label className="admin-check-hit">
                        <input
                          type="checkbox"
                          aria-label={`Select ${article.title}`}
                          checked={selected.has(article.id)}
                          disabled={bulkDeleting}
                          onChange={(event) => toggleSelected(article, event.target.checked, (event.nativeEvent as MouseEvent).shiftKey)}
                        />
                      </label>
                    </td>
                  </Can>
                  <td data-label="Title">
                    <b>{article.title}</b>{article.is_placeholder && <strong> · PLACEHOLDER</strong>}
                    <div className="muted">/{article.slug}{article.featured ? ' · ★ featured' : ''}</div>
                    {article.is_placeholder && article.placeholder_note && <div className="muted">{article.placeholder_note}</div>}
                  </td>
                  <td data-label="Category">{newsCategoryLabel(article.category)}</td>
                  <td data-label="State"><StatusBadge status={article.published ? 'published' : 'draft'} /></td>
                  <td data-label="Published">{article.published && article.published_at ? new Date(article.published_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td data-label="Updated"><TimeAgo value={article.updated_at} /></td>
                  <td className="right" data-label="Actions">
                    <div className="admin-action-row">
                      <Can capability="news.update">
                        <button type="button" className="admin-btn small" onClick={() => openEdit(article)}><Pencil size={12} /> Edit</button>
                      </Can>
                      <Can capability="news.publish">
                        <button type="button" className="admin-btn small" onClick={() => void togglePublished(article)} disabled={article.is_placeholder} title={article.is_placeholder ? 'Replace and save this placeholder as a draft first' : undefined}>{article.published ? 'Unpublish' : 'Publish'}</button>
                      </Can>
                      <button type="button" className="admin-btn small" onClick={() => void toggleFeatured(article)} title={article.featured ? 'Remove from featured' : 'Feature this article'}>
                        <Star size={12} /> {article.featured ? 'Unfeature' : 'Feature'}
                      </button>
                      <Can capability="news.delete">
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          aria-label="Delete"
                          title={`Delete “${article.title}”`}
                          onClick={() => void remove(article)}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !error && !visible.length && (
                <tr><td colSpan={7} className="empty-state">
                  {filter !== 'all' || query.trim() || page > 1
                    ? 'No articles match this filter or page.'
                    : <AdminEmptyState title="No news articles yet" hint="Create the first article. It goes straight to the live news page when published. The public site shows an empty state until then." action={<button type="button" className="admin-btn small" onClick={openCreate}><Plus size={13} /> New article</button>} />}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="admin-modal-backdrop" onClick={() => setShowPreview(false)} role="presentation">
          <div ref={previewDialogRef} tabIndex={-1} className="admin-modal" role="dialog" aria-modal="true" aria-label="Article preview" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-header">
              <h2>Preview: exactly what students will read</h2>
              <button type="button" className="admin-text-btn" onClick={() => setShowPreview(false)}>Close</button>
            </div>
            <div className="admin-modal-body hub-article-body">
              {editor?.imageUrl ? <img src={editor.imageUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} /> : <div className="er-news-noimage" style={{ height: 120, borderRadius: 12, marginBottom: 14 }}><small>No featured image</small></div>}
              <span className="status-badge published">{editor ? newsCategoryLabel(editor.category) : ''}</span>
              <h2 style={{ margin: '10px 0 4px' }}>{editor?.title}</h2>
              <div className="muted" style={{ marginBottom: 12 }}>
                Preview · {editor?.publishedAt ? new Date(editor.publishedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString()}
                {editor?.sourceName ? ` · Source: ${editor.sourceName}` : ''}
              </div>
              {looksLikeHtml(previewHtml)
                ? <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewHtml) }} />
                : previewHtml.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {editor?.sourceUrl && <p className="muted">Source: <a href={editor.sourceUrl} target="_blank" rel="noopener noreferrer">{editor.sourceName || editor.sourceUrl}</a></p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
