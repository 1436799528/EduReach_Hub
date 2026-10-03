import { userFacingError } from '../lib/errors';
import { useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminOpportunity,
  deleteAdminOpportunity,
  fetchAdminOpportunities,
  updateAdminOpportunity,
  type Opportunity,
} from '../src/lib/api';
import { AdminEmptyState, StatusBadge, TimeAgo } from '../src/components/admin/AdminKit';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

// Opportunities manager: scholarships, grants, jobs and fellowships listed on
// the public /jobs page. Full CRUD over the `opportunities` table — the same
// records the site reads. Descriptions use the rich-text editor.

const CATEGORIES = [
  { id: 'scholarship', label: 'Scholarship' },
  { id: 'grant', label: 'Grant' },
  { id: 'job', label: 'Job' },
  { id: 'fellowship', label: 'Fellowship' },
  { id: 'competition', label: 'Competition' },
];

type EditState = {
  id: string | null;
  title: string;
  organisation: string;
  category: string;
  subcategory: string;
  description: string;
  link_url: string;
  deadline: string;
  locations: string;
  eligibility: string;
  education_levels: string;
  disciplines: string;
  work_mode: string;
  is_featured: boolean;
  is_active: boolean;
};

const emptyEdit: EditState = { id: null, title: '', organisation: '', category: 'scholarship', subcategory: '', description: '', link_url: '', deadline: '', locations: '', eligibility: '', education_levels: '', disciplines: '', work_mode: '', is_featured: false, is_active: true };

export default function AdminOpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState('');

  async function load() {
    setLoading(true);
    try {
      setError('');
      setItems(await fetchAdminOpportunities());
    } catch (e) {
      setItems([]);
      setError(userFacingError(e, 'Unable to load opportunities.'));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function openEdit(item: Opportunity) {
    setEdit({
      id: item.id, title: item.title, organisation: item.organisation || '',
      category: item.category, subcategory: item.subcategory || '', description: item.description || '',
      link_url: item.link_url || '', deadline: item.deadline || '',
      locations: item.locations || '', eligibility: item.eligibility || '',
      education_levels: (item.education_levels || []).join(', '),
      disciplines: (item.disciplines || []).join(', '),
      work_mode: item.work_mode || '', is_featured: Boolean(item.is_featured),
      is_active: item.is_active !== false,
    });
    setDescriptionHtml(item.description || '');
    setMessage('');
  }

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) { setError('A title is required.'); return; }
    setSaving(true); setError('');
    try {
      const values = {
        title: edit.title.trim(),
        organisation: edit.organisation.trim() || null,
        category: edit.category,
        subcategory: edit.subcategory.trim() || null,
        description: descriptionHtml.trim() || null,
        link_url: edit.link_url.trim() || null,
        deadline: edit.deadline || null,
        locations: edit.locations.trim() || null,
        eligibility: edit.eligibility.trim() || null,
        education_levels: edit.education_levels.split(',').map((value) => value.trim()).filter(Boolean),
        disciplines: edit.disciplines.split(',').map((value) => value.trim()).filter(Boolean),
        work_mode: edit.work_mode || null,
        is_featured: edit.is_featured,
        is_active: edit.is_active,
      };
      const saved = edit.id ? await updateAdminOpportunity(edit.id, values) : await createAdminOpportunity(values);
      setItems((current) => {
        const rest = current.filter((item) => item.id !== saved.id);
        return [saved, ...rest];
      });
      setEdit(null);
      setDescriptionHtml('');
      setMessage(edit.id ? 'Opportunity updated — /jobs reflects it on the next load.' : 'Opportunity published — it is live on /jobs right away.');
    } catch (e) {
      setError(userFacingError(e, 'Unable to save the opportunity.'));
    } finally { setSaving(false); }
  }

  async function toggleActive(item: Opportunity) {
    try {
      const updated = await updateAdminOpportunity(item.id, { ...item, is_active: !(item.is_active !== false) });
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      setMessage(updated.is_active ? `“${updated.title}” is visible to students.` : `“${updated.title}” is hidden from students.`);
    } catch (e) {
      setError(userFacingError(e, 'Unable to update the opportunity.'));
    }
  }

  async function remove(item: Opportunity) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${item.title}”. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminOpportunity(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage('Opportunity permanently deleted.');
    } catch (e) {
      setError(userFacingError(e, 'Unable to delete the opportunity.'));
    }
  }

  const visible = items.filter((item) => filter === 'all' ? true : item.category === filter);

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Scholarships &amp; Opportunities</h1>
            <p>Scholarships, grants, jobs and fellowships on the student /jobs page — managed here, served from Supabase.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading} aria-label="Refresh opportunities"><RefreshCw size={14} /></button>
            <button type="button" className="admin-btn" onClick={() => { setEdit({ ...emptyEdit }); setDescriptionHtml(''); }}><Plus size={14} /> New opportunity</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {edit && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>{edit.id ? 'Edit opportunity' : 'New opportunity'}</h2>
              <button type="button" className="admin-text-btn" onClick={() => setEdit(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <div className="admin-field-row">
                  <label className="admin-field"><span>Title *</span>
                    <input className="admin-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. NNPC/SNEPCo National University Scholarship" />
                  </label>
                  <label className="admin-field"><span>Organisation</span>
                    <input className="admin-input" value={edit.organisation} onChange={(e) => setEdit({ ...edit, organisation: e.target.value })} placeholder="e.g. SNEPCo" />
                  </label>
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Category</span>
                    <select className="admin-select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                      {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                    </select>
                  </label>
                  <label className="admin-field"><span>Subcategory</span>
                    <input className="admin-input" value={edit.subcategory} onChange={(e) => setEdit({ ...edit, subcategory: e.target.value })} placeholder="e.g. Undergraduate scholarship" />
                  </label>
                  <label className="admin-field"><span>Deadline</span>
                    <input className="admin-input" type="date" value={edit.deadline} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} />
                  </label>
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Location</span>
                    <input className="admin-input" value={edit.locations} onChange={(e) => setEdit({ ...edit, locations: e.target.value })} placeholder="e.g. Nationwide · Lagos · Remote" />
                  </label>
                  <label className="admin-field"><span>Eligibility</span>
                    <input className="admin-input" value={edit.eligibility} onChange={(e) => setEdit({ ...edit, eligibility: e.target.value })} placeholder="Who can apply?" />
                  </label>
                  <label className="admin-field"><span>Work mode</span>
                    <select className="admin-select" value={edit.work_mode} onChange={(e) => setEdit({ ...edit, work_mode: e.target.value })}>
                      <option value="">Not specified</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
                    </select>
                  </label>
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Education levels</span>
                    <input className="admin-input" value={edit.education_levels} onChange={(e) => setEdit({ ...edit, education_levels: e.target.value })} placeholder="Undergraduate, Graduate" />
                  </label>
                  <label className="admin-field"><span>Disciplines</span>
                    <input className="admin-input" value={edit.disciplines} onChange={(e) => setEdit({ ...edit, disciplines: e.target.value })} placeholder="Engineering, STEM, Computer Science" />
                  </label>
                  <label className="admin-field admin-field-check"><span>Discovery</span>
                    <span className="admin-check-row">
                      <input id="opp-featured" type="checkbox" checked={edit.is_featured} onChange={(e) => setEdit({ ...edit, is_featured: e.target.checked })} />
                      <label htmlFor="opp-featured">Featured</label>
                    </span>
                  </label>
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Official link (https)</span>
                    <input className="admin-input" value={edit.link_url} onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} placeholder="https://…" />
                  </label>
                  <label className="admin-field admin-field-check"><span>Visibility</span>
                    <span className="admin-check-row">
                      <input id="opp-active" type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
                      <label htmlFor="opp-active">{edit.is_active ? 'Visible to students' : 'Hidden'}</label>
                    </span>
                  </label>
                </div>
              </div>
              <div className="admin-field"><span>Details (rich content)</span>
                <AdminRichTextEditor
                  key={edit.id || 'new-opportunity'}
                  initialValue={edit.description}
                  placeholder="Requirements, benefits, how to apply…"
                  onChange={setDescriptionHtml}
                  minHeight={200}
                />
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save opportunity'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-filter-card">
          <select className="admin-select" aria-label="Filter opportunities" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          <span className="admin-filter-count">{visible.length} of {items.length}</span>
        </div>

        <div className="admin-card">
          <div className="admin-card-header"><h2>Opportunities</h2><span>{loading ? 'Loading…' : `${items.length} total`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">Opportunity</th><th scope="col">Category</th><th scope="col">Deadline</th><th scope="col">State</th><th scope="col">Updated</th><th scope="col" className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="empty-state">Loading opportunities…</td></tr>}
                {!loading && visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.title}</b>
                      <div className="muted">{item.organisation || '—'}{item.link_url ? <> · <a href={item.link_url} target="_blank" rel="noopener noreferrer">official link</a></> : null}</div>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.deadline || '—'}</td>
                    <td><StatusBadge status={item.is_active !== false ? 'published' : 'archived'} /></td>
                    <td><TimeAgo value={item.updated_at} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => openEdit(item)}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-btn small" onClick={() => void toggleActive(item)}>{item.is_active !== false ? 'Hide' : 'Show'}</button>
                        <button type="button" className="admin-text-btn danger-text" aria-label={`Delete ${item.title || 'this opportunity'}`} onClick={() => void remove(item)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !visible.length && (
                  <tr><td colSpan={6} className="empty-state">
                    <AdminEmptyState title="No opportunities yet" hint="Publish the first scholarship or grant — it appears on the student /jobs page immediately." action={<button type="button" className="admin-btn small" onClick={() => { setEdit({ ...emptyEdit }); setDescriptionHtml(''); }}><Plus size={13} /> New opportunity</button>} />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
