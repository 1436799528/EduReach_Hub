import { useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminInstitution,
  deleteAdminInstitution,
  fetchAdminInstitutions,
  updateAdminInstitution,
  type AdminInstitution,
} from '../src/lib/api';
import { AdminEmptyState, TableSkeleton } from '../src/components/admin/AdminKit';

// Schools manager: direct CRUD over the `institutions` rows the public
// School Finder (/schools) reads. Same columns, one source of truth.

type FormState = { id: string | null; school_name: string; acronym: string; slug: string; state: string; institution_type: string; website_url: string; admission_portal_url: string; student_portal_url: string; is_verified: boolean };
const emptyForm: FormState = { id: null, school_name: '', acronym: '', slug: '', state: '', institution_type: '', website_url: '', admission_portal_url: '', student_portal_url: '', is_verified: false };

const TYPES = ['university', 'polytechnic', 'college of education', 'other'];

export default function AdminSchoolsPage() {
  const [institutions, setInstitutions] = useState<AdminInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(search = '') {
    setLoading(true);
    try {
      setError('');
      setInstitutions(await fetchAdminInstitutions(search));
    } catch (e) {
      setInstitutions([]);
      setError(e instanceof Error ? e.message : 'Unable to load institutions.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form) return;
    if (!form.school_name.trim()) { setError('The institution name is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        school_name: form.school_name.trim(),
        acronym: form.acronym.trim() || null,
        state: form.state.trim() || null,
        institution_type: form.institution_type.trim() || null,
        slug: form.slug.trim() || null,
        website_url: form.website_url.trim() || null,
        admission_portal_url: form.admission_portal_url.trim() || null,
        student_portal_url: form.student_portal_url.trim() || null,
        is_verified: form.is_verified,
      };
      const saved = form.id ? await updateAdminInstitution(form.id, payload) : await createAdminInstitution(payload);
      setInstitutions((current) => {
        const rest = current.filter((item) => item.id !== saved.id);
        return [...rest, saved].sort((a, b) => a.school_name.localeCompare(b.school_name));
      });
      setForm(null);
      setMessage(form.id ? 'Institution updated — the school finder reflects it immediately.' : 'Institution created — it is searchable on /schools right away.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the institution.');
    } finally { setSaving(false); }
  }

  async function remove(institution: AdminInstitution) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${institution.school_name}” from the school finder. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminInstitution(institution.id);
      setInstitutions((current) => current.filter((item) => item.id !== institution.id));
      setMessage('Institution permanently deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete the institution.');
    }
  }

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Schools &amp; Institutions</h1>
            <p>The live School Finder catalogue. Edits here change what students see on /schools without touching Supabase directly.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load(query)} disabled={loading}><RefreshCw size={14} /></button>
            <button type="button" className="admin-btn" onClick={() => setForm({ ...emptyForm })}><Plus size={14} /> New institution</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {form && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>{form.id ? 'Edit institution' : 'New institution'}</h2>
              <button type="button" className="admin-text-btn" onClick={() => setForm(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <label className="admin-field"><span>Institution name *</span>
                  <input className="admin-input" style={{ width: '100%' }} value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} placeholder="e.g. University of Lagos" />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Acronym</span>
                    <input className="admin-input" value={form.acronym} onChange={(e) => setForm({ ...form, acronym: e.target.value })} placeholder="UNILAG" />
                  </label>
                  <label className="admin-field"><span>State</span>
                    <input className="admin-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Lagos" />
                  </label>
                  <label className="admin-field"><span>Type</span>
                    <select className="admin-select" value={form.institution_type} onChange={(e) => setForm({ ...form, institution_type: e.target.value })}>
                      <option value="">Select…</option>
                      {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Slug</span>
                    <input className="admin-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="university-of-lagos" />
                  </label>
                  <label className="admin-field"><span>Verified</span>
                    <select className="admin-select" value={form.is_verified ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_verified: e.target.value === 'true' })}>
                      <option value="false">Not verified</option><option value="true">Verified</option>
                    </select>
                  </label>
                </div>
                <label className="admin-field"><span>Website URL (https)</span>
                  <input className="admin-input" style={{ width: '100%' }} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://unilag.edu.ng" />
                </label>
                <label className="admin-field"><span>Admission portal URL (https)</span>
                  <input className="admin-input" style={{ width: '100%' }} value={form.admission_portal_url} onChange={(e) => setForm({ ...form, admission_portal_url: e.target.value })} placeholder="https://admissions.unilag.edu.ng" />
                </label>
                <label className="admin-field"><span>Student portal URL (https)</span>
                  <input className="admin-input" style={{ width: '100%' }} value={form.student_portal_url} onChange={(e) => setForm({ ...form, student_portal_url: e.target.value })} placeholder="https://studentportal.unilag.edu.ng" />
                </label>
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save institution'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-filter-card">
          <input className="admin-input admin-search" aria-label="Search institutions" placeholder="Search name, acronym or state" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="admin-filter-count">{loading ? '…' : institutions.length}</span>
        </div>

        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Institution</th><th>State</th><th>Type</th><th>Website</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={5} />}
                {!loading && institutions.map((institution) => (
                  <tr key={institution.id}>
                    <td><b>{institution.school_name}</b><div className="muted">{institution.acronym || '—'}</div></td>
                    <td>{institution.state || '—'}</td>
                    <td>{institution.institution_type || '—'}</td>
                    <td>{institution.website_url ? <a href={institution.website_url} target="_blank" rel="noopener noreferrer">Open</a> : '—'}</td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => setForm({
                          id: institution.id,
                          school_name: institution.school_name,
                          acronym: institution.acronym || '',
                          slug: institution.slug || '',
                          state: institution.state || '',
                          institution_type: institution.institution_type || '',
                          website_url: institution.website_url || '',
                          admission_portal_url: institution.admission_portal_url || '',
                          student_portal_url: institution.student_portal_url || '',
                          is_verified: institution.is_verified,
                        })}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-text-btn danger-text" onClick={() => void remove(institution)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !institutions.length && (
                  <tr><td colSpan={5} className="empty-state">
                    <AdminEmptyState title="No institutions found" hint={query ? 'Try a different search.' : 'Add the first institution — it becomes searchable on the school finder immediately.'} />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
