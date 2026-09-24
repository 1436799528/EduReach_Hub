import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import {
  createAdminNews,
  deleteAdminNews,
  fetchAdminNews,
  updateAdminNews,
  type AdminNewsArticle,
} from '../src/lib/api';

const categories = ['jamb', 'admission', 'waec', 'neco', 'nelfund', 'campus', 'opportunities', 'general'];

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  category: 'general',
  image_url: '',
  source_url: '',
  published: false,
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<AdminNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  async function load() {
    try {
      setError('');
      setArticles(await fetchAdminNews());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load newsroom articles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const publishedCount = useMemo(() => articles.filter((a) => a.published).length, [articles]);

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setSlugTouched(false);
    setPreviewBroken(false);
  }

  function startEdit(article: AdminNewsArticle) {
    setForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || '',
      body: article.body,
      category: article.category || 'general',
      image_url: article.image_url || '',
      source_url: article.source_url || '',
      published: article.published,
    });
    setEditingId(article.id);
    setSlugTouched(true);
    setPreviewBroken(false);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(publish: boolean) {
    try {
      setError('');
      setNotice('');
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        body: form.body.trim(),
        category: form.category,
        image_url: form.image_url.trim() || null,
        source_url: form.source_url.trim() || null,
        published: publish,
      };
      if (editingId) {
        await updateAdminNews(editingId, payload);
        setNotice('Article updated.');
      } else {
        await createAdminNews(payload);
        setNotice(publish ? 'Article published to the news feed.' : 'Draft saved.');
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this article.');
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This removes it from the news feed permanently.`)) return;
    try {
      setError('');
      setNotice('');
      await deleteAdminNews(id);
      if (editingId === id) resetForm();
      setNotice('Article deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete this article.');
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Newsroom CMS</h1>
            <p>Write, edit, publish and delete news articles. Published stories appear on /news and exam hubs.</p>
          </div>
        </div>
        {error && <div className="admin-card">{error}</div>}
        {notice && <div className="admin-card">{notice}</div>}

        <div className="admin-kpi-grid two">
          <div className="admin-kpi">
            <span>Published</span>
            <strong>{publishedCount}</strong>
            <small>Live on the student news feed</small>
          </div>
          <div className="admin-kpi">
            <span>Drafts</span>
            <strong>{articles.length - publishedCount}</strong>
            <small>Hidden until published</small>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2>{editingId ? 'Edit Article' : 'Write Article'}</h2>
            <span>{editingId ? 'Updating a live or draft story' : 'New story starts here'}</span>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <input
              className="admin-input"
              placeholder="Headline *"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value);
                if (!slugTouched) set('slug', slugify(e.target.value));
              }}
            />
            <div className="admin-inline-form">
              <input
                className="admin-input"
                placeholder="URL slug (auto from headline)"
                value={form.slug}
                onChange={(e) => {
                  set('slug', slugify(e.target.value));
                  setSlugTouched(true);
                }}
              />
              <select className="admin-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="admin-input"
              placeholder="Short excerpt (one line shown on cards)"
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
            />
            <textarea
              className="admin-input"
              rows={8}
              style={{ height: 'auto', minHeight: '160px' }}
              placeholder="Article body * — blank lines separate paragraphs"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
            />
            <input
              className="admin-input"
              placeholder="Cover image URL (https://… or /news/photos/….jpg)"
              value={form.image_url}
              onChange={(e) => {
                set('image_url', e.target.value);
                setPreviewBroken(false);
              }}
            />
            {form.image_url.trim() && !previewBroken && (
              <img
                src={form.image_url.trim()}
                alt="Cover preview"
                style={{ maxWidth: '260px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                onError={() => setPreviewBroken(true)}
              />
            )}
            {form.image_url.trim() && previewBroken && (
              <span className="hub-muted-label">Cover preview unavailable — check the image URL.</span>
            )}
            <input
              className="admin-input"
              placeholder="Source URL (official announcement link, optional)"
              value={form.source_url}
              onChange={(e) => set('source_url', e.target.value)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
              <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
              Published (visible on the student news feed)
            </label>
            <div className="admin-inline-form">
              <button type="button" className="admin-btn success" onClick={() => void save(true)}>
                {editingId ? 'Save & Publish' : 'Publish Article'}
              </button>
              <button type="button" className="admin-btn secondary" onClick={() => void save(false)}>
                {editingId ? 'Save as Draft' : 'Save Draft'}
              </button>
              {editingId && (
                <button type="button" className="admin-btn secondary" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2>All Articles</h2>
            <span>{loading ? 'Loading…' : `${articles.length} stories`}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <br />
                      <span className="mono">/news/{a.slug}</span>
                    </td>
                    <td>{a.category}</td>
                    <td>
                      <span className={`status-badge ${a.published ? 'published' : 'archived'}`}>
                        {a.published ? 'published' : 'draft'}
                      </span>
                    </td>
                    <td>{a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="admin-text-btn" onClick={() => startEdit(a)}>
                        Edit
                      </button>{' '}
                      {a.published && (
                        <>
                          <a className="admin-text-btn" href={`/news/${encodeURIComponent(a.slug)}`}>
                            View
                          </a>{' '}
                        </>
                      )}
                      <button type="button" className="admin-text-btn" onClick={() => void remove(a.id, a.title)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !articles.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No articles yet. Write the first story above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
