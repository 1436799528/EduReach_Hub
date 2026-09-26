import { useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  createAdminService,
  deleteAdminService,
  fetchAdminServices,
  updateAdminService,
  type AdminService,
} from '../src/lib/api';
import { AdminEmptyState, StatusBadge } from '../src/components/admin/AdminKit';

// Service Catalogue manager: full CRUD over the service_catalog rows the
// public /services page renders. The four built-in application-form services
// are editable and deactivate-able but cannot be deleted (their forms ship
// with the code release); every other row is fully managed here.

type EditState = {
  id: string | null;
  service_key: string;
  title: string;
  description: string;
  application_url: string;
  route: string;
  category: string;
  sort_order: string;
  active: boolean;
  is_form_service: boolean;
};

const emptyEdit: EditState = { id: null, service_key: '', title: '', description: '', application_url: '', route: '', category: 'Services', sort_order: '100', active: true, is_form_service: false };

export default function AdminServicesPage() {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setError('');
      setServices(await fetchAdminServices());
    } catch (e) {
      setServices([]);
      setError(e instanceof Error ? e.message : 'Unable to load the service catalogue.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) { setError('The service title cannot be empty.'); return; }
    setSaving(true); setError('');
    try {
      const values = {
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        application_url: edit.application_url.trim() || null,
        route: edit.route.trim() || null,
        category: edit.category.trim() || 'Services',
        sort_order: Number(edit.sort_order) || 100,
        active: edit.active,
      };
      if (edit.id) {
        const updated = await updateAdminService(edit.id, values);
        setServices((current) => current.map((service) => service.id === updated.id ? { ...updated, is_form_service: service.is_form_service } : service));
        setMessage('Service updated — the live catalogue reflects it on the next load.');
      } else {
        const created = await createAdminService({ ...values, service_key: edit.service_key.trim() || undefined });
        setServices((current) => [...current, { ...created, is_form_service: false }].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100)));
        setMessage('Service created — it is live on /services right away.');
      }
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the service.');
    } finally { setSaving(false); }
  }

  async function toggleActive(service: AdminService) {
    try {
      const updated = await updateAdminService(service.id, { active: !service.active });
      setServices((current) => current.map((item) => item.id === updated.id ? { ...updated, is_form_service: service.is_form_service } : item));
      setMessage(updated.active ? `“${updated.title}” is visible to students.` : `“${updated.title}” is hidden from students.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the service.');
    }
  }

  async function remove(service: AdminService) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${service.title}” from the catalogue. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminService(service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      setMessage('Service permanently deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete the service.');
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Service Catalogue</h1>
            <p>Everything students see on /services: application forms, in-app routes and external links — ordered, described and switched here.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /></button>
            <button type="button" className="admin-btn" onClick={() => setEdit({ ...emptyEdit })}><Plus size={14} /> New service</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {edit && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>{edit.id ? 'Edit service' : 'New service'}</h2>
              <button type="button" className="admin-text-btn" onClick={() => setEdit(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <div className="admin-field-row">
                  <label className="admin-field"><span>Title *</span>
                    <input className="admin-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. JAMB Services" />
                  </label>
                  {!edit.id && (
                    <label className="admin-field"><span>Key (optional)</span>
                      <input className="admin-input" value={edit.service_key} onChange={(e) => setEdit({ ...edit, service_key: e.target.value })} placeholder="auto from title" disabled={Boolean(edit.id && edit.is_form_service)} />
                    </label>
                  )}
                  <label className="admin-field"><span>Category</span>
                    <input className="admin-input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="Services / Examinations / Academics…" />
                  </label>
                  <label className="admin-field"><span>Sort order</span>
                    <input className="admin-input" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} />
                  </label>
                </div>
                <label className="admin-field"><span>Description</span>
                  <textarea className="admin-textarea" style={{ minHeight: 64 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>In-app route</span>
                    <input className="admin-input" value={edit.route} onChange={(e) => setEdit({ ...edit, route: e.target.value })} placeholder="/schools" disabled={Boolean(edit.id && edit.is_form_service)} />
                  </label>
                  <label className="admin-field"><span>External link (https)</span>
                    <input className="admin-input" value={edit.application_url} onChange={(e) => setEdit({ ...edit, application_url: e.target.value })} placeholder="https://…" disabled={Boolean(edit.id && edit.is_form_service)} />
                  </label>
                  <label className="admin-field admin-field-check"><span>Visibility</span>
                    <span className="admin-check-row">
                      <input id="svc-active" type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                      <label htmlFor="svc-active">{edit.active ? 'Visible to students' : 'Hidden'}</label>
                    </span>
                  </label>
                </div>
                {edit.id && edit.is_form_service && <p className="admin-footnote">This is a built-in application-form service: its form ships with the code release, so its key/route/link are fixed. You can still edit the title, description, category, order and visibility.</p>}
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save service'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>Catalogue</h2><span>{loading ? 'Loading…' : `${services.length} services`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Service</th><th>Key</th><th>Destination</th><th>Order</th><th>State</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="empty-state">Loading catalogue…</td></tr>}
                {!loading && services.map((service) => (
                  <tr key={service.id}>
                    <td><b>{service.title}</b><div className="muted">{service.category || '—'}</div></td>
                    <td className="mono">{service.service_key}{service.is_form_service && <div className="muted">form service</div>}</td>
                    <td>{service.application_url
                      ? <a href={service.application_url} target="_blank" rel="noopener noreferrer">External</a>
                      : service.route ? <span className="mono">{service.route}</span>
                      : service.is_form_service ? <span className="muted">In-app form</span>
                      : <span className="muted">—</span>}</td>
                    <td>{service.sort_order ?? '—'}</td>
                    <td><StatusBadge status={service.active ? 'published' : 'unpaid'} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => setEdit({
                          id: service.id,
                          service_key: service.service_key,
                          title: service.title,
                          description: service.description || '',
                          application_url: service.application_url || '',
                          route: service.route || '',
                          category: service.category || '',
                          sort_order: String(service.sort_order ?? 100),
                          active: service.active,
                          is_form_service: Boolean(service.is_form_service),
                        })}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-btn small" onClick={() => void toggleActive(service)}>{service.active ? 'Hide' : 'Show'}</button>
                        {!service.is_form_service && (
                          <button type="button" className="admin-text-btn danger-text" onClick={() => void remove(service)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !services.length && (
                  <tr><td colSpan={6} className="empty-state">
                    <AdminEmptyState title="Catalogue is empty" hint="Create the first service — it appears on the live /services page immediately." />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="admin-footnote">Built-in form services (NELFUND loan, Results, JAMB slip, Admission letters) are protected: they can be edited, reordered, hidden or shown, but not deleted — their application forms are part of the code release.</p>
      </div>
    </AdminLayout>
  );
}
