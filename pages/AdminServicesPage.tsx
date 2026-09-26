import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { fetchServices, updateAdminService, type AdminService } from '../src/lib/api';
import { AdminEmptyState, StatusBadge } from '../src/components/admin/AdminKit';

// Services manager: edits the `service_catalog` rows the /services page and
// the four live application forms consume. The supported service keys are a
// product boundary (see docs/ROUTES.md) — visibility and presentation are
// manageable here; new service keys need a code change by design.

type EditState = { id: string; title: string; description: string; application_url: string };
const LIVE_KEYS: Record<string, string> = {
  'nelfund-loan': 'NELFUND student loan application',
  'results': 'Result checking / verification',
  'jamb-slip': 'JAMB slip re-print',
  'admission-letters': 'Admission letter support',
};

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
      // Read through the same public API the site uses, so the admin view is
      // literally what students see (minus inactive rows, listed separately).
      const items = await fetchServices();
      setServices(items as AdminService[]);
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
      const updated = await updateAdminService(edit.id, {
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        application_url: edit.application_url.trim() || null,
      });
      setServices((current) => current.map((service) => service.id === updated.id ? updated : service));
      setEdit(null);
      setMessage('Service updated — the catalogue and form hand-off reflect it on the next load.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the service.');
    } finally { setSaving(false); }
  }

  async function toggleActive(service: AdminService) {
    try {
      const updated = await updateAdminService(service.id, { active: !service.active });
      setServices((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.active ? `“${updated.title}” is visible to students.` : `“${updated.title}” is hidden from students.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the service.');
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Service Catalogue</h1>
            <p>The supported student services. Visibility changes here take effect on the live /services page.</p>
          </div>
          <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {edit && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>Edit service</h2>
              <button type="button" className="admin-text-btn" onClick={() => setEdit(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <label className="admin-field"><span>Title</span>
                  <input className="admin-input" style={{ width: '100%' }} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                </label>
                <label className="admin-field"><span>Description</span>
                  <textarea className="admin-textarea" style={{ minHeight: 64 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </label>
                <label className="admin-field"><span>External / official link (https)</span>
                  <input className="admin-input" style={{ width: '100%' }} value={edit.application_url} onChange={(e) => setEdit({ ...edit, application_url: e.target.value })} placeholder="https://…" />
                </label>
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save service'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>Catalogue</h2><span>{loading ? 'Loading…' : `${services.length} active`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Service</th><th>Key</th><th>Link</th><th>State</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="empty-state">Loading catalogue…</td></tr>}
                {!loading && services.map((service) => (
                  <tr key={service.id}>
                    <td><b>{service.title}</b><div className="muted">{service.description || '—'}</div></td>
                    <td className="mono">{service.service_key}</td>
                    <td>{service.application_url ? <a href={service.application_url} target="_blank" rel="noopener noreferrer">Open</a> : <span className="muted">In-app form</span>}</td>
                    <td><StatusBadge status={service.active ? 'published' : 'unpaid'} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => setEdit({ id: service.id, title: service.title, description: service.description || '', application_url: service.application_url || '' })}>Edit</button>
                        <button type="button" className="admin-btn small" onClick={() => void toggleActive(service)}>{service.active ? 'Hide' : 'Show'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !services.length && (
                  <tr><td colSpan={5} className="empty-state">
                    <AdminEmptyState title="No active services in the catalogue" hint={`The four supported keys: ${Object.values(LIVE_KEYS).join(', ')}. If the catalogue is empty, seed the service_catalog table (see docs/DATABASE.md).`} />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="admin-footnote">The four service keys are a deliberate product boundary — application forms only exist for these. Adding a new service requires a code release, not just a catalogue row, so students never hit a broken form.</p>
      </div>
    </AdminLayout>
  );
}
