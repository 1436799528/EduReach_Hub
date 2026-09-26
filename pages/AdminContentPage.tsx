import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminCalendarItem,
  deleteAdminCalendarItem,
  fetchAdminCalendarItems,
  updateAdminCalendarItem,
  type AdminCalendarItem,
} from '../src/lib/api';
import { AdminEmptyState, StatusBadge, TimeAgo, TableSkeleton } from '../src/components/admin/AdminKit';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

// Events & key dates: manages the exact rows the /events page (and home
// noticeboard feed) read through /api/upcoming — edureach_deadlines and
// edureach_exams. "pending" items are visible; "cancelled" items are hidden.

type ItemType = 'deadline' | 'exam';

type FormState = {
  id: string | null;
  title: string;
  description: string;
  when: string; // due_at or starts_at (datetime-local)
  endsAt: string; // exam only
  location: string; // exam only
  priority: string;
  status: string;
};

const emptyForm: FormState = { id: null, title: '', description: '', when: '', endsAt: '', location: '', priority: 'normal', status: 'pending' };

function toLocalInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminContentPage() {
  const [type, setType] = useState<ItemType>('deadline');
  const [items, setItems] = useState<AdminCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(nextType: ItemType = type) {
    setLoading(true);
    try {
      setError('');
      setItems(await fetchAdminCalendarItems(nextType));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Unable to load calendar items.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(type); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [type]);

  async function save() {
    if (!form) return;
    if (!form.title.trim()) { setError('A title is required.'); return; }
    if (!form.when) { setError(type === 'exam' ? 'A start date/time is required.' : 'A due date/time is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        ...(type === 'exam'
          ? { starts_at: new Date(form.when).toISOString(), ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null, location: form.location.trim() || null }
          : { due_at: new Date(form.when).toISOString() }),
      };
      const saved = form.id
        ? await updateAdminCalendarItem(type, form.id, payload)
        : await createAdminCalendarItem(type, payload);
      setItems((current) => {
        const rest = current.filter((item) => item.id !== saved.id);
        return [...rest, saved].sort((a, b) => new Date(String(a.starts_at || a.due_at)).getTime() - new Date(String(b.starts_at || b.due_at)).getTime());
      });
      setForm(null);
      setMessage(form.id ? 'Item updated.' : 'Item created — it is live on the events page.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the item.');
    } finally { setSaving(false); }
  }

  async function remove(item: AdminCalendarItem) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${item.title}”. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminCalendarItem(type, item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage('Item permanently deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete the item.');
    }
  }

  const whenField = (item: AdminCalendarItem) => item.starts_at || item.due_at || null;
  const sorted = useMemo(() => [...items].sort((a, b) => new Date(String(whenField(a))).getTime() - new Date(String(whenField(b))).getTime()), [items]);

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Events &amp; Key Dates</h1>
            <p>Deadlines and exam dates shown on the student events page and the home noticeboard.</p>
          </div>
          <div className="admin-header-actions">
            <select className="admin-select" aria-label="Calendar type" value={type} onChange={(e) => { setType(e.target.value as ItemType); setForm(null); }}>
              <option value="deadline">Deadlines</option>
              <option value="exam">Exam dates</option>
            </select>
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /></button>
            <button type="button" className="admin-btn" onClick={() => setForm({ ...emptyForm })}><Plus size={14} /> New {type === 'exam' ? 'exam date' : 'deadline'}</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {form && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>{form.id ? 'Edit item' : `New ${type === 'exam' ? 'exam date' : 'deadline'}`}</h2>
              <button type="button" className="admin-text-btn" onClick={() => setForm(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <label className="admin-field"><span>Title *</span>
                  <input className="admin-input" style={{ width: '100%' }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. WAEC registration closes" />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>{type === 'exam' ? 'Starts *' : 'Due *'}</span>
                    <input className="admin-input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
                  </label>
                  {type === 'exam' && (
                    <label className="admin-field"><span>Ends (optional)</span>
                      <input className="admin-input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                    </label>
                  )}
                  {type === 'exam' && (
                    <label className="admin-field"><span>Location</span>
                      <input className="admin-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Nationwide CBT centres" />
                    </label>
                  )}
                </div>
                <div className="admin-field-row">
                  <label className="admin-field"><span>Priority</span>
                    <select className="admin-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="admin-field"><span>Visibility</span>
                    <select className="admin-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="pending">Visible</option>
                      <option value="cancelled">Hidden</option>
                    </select>
                  </label>
                </div>
                <div className="admin-field"><span>Description</span>
                  <AdminRichTextEditor
                    key={form.id || `new-${type}-${form.when}`}
                    initialValue={form.description}
                    placeholder="Supporting detail shown on the events page — rich formatting supported."
                    onChange={(html) => setForm((current) => current ? { ...current, description: html } : current)}
                    minHeight={170}
                  />
                </div>
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>{type === 'exam' ? 'Exam dates' : 'Deadlines'}</h2><span>{loading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'}`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Title</th><th>{type === 'exam' ? 'Starts' : 'Due'}</th><th>Priority</th><th>Visibility</th><th>Created</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={6} />}
                {!loading && sorted.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.title}</b><div className="muted">{item.description || '—'}</div></td>
                    <td>{new Date(String(whenField(item))).toLocaleString()}{item.location ? <div className="muted">{item.location}</div> : null}</td>
                    <td><StatusBadge status={item.priority} /></td>
                    <td><StatusBadge status={item.status === 'pending' ? 'published' : 'archived'} /></td>
                    <td><TimeAgo value={item.created_at} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => setForm({
                          id: item.id, title: item.title, description: item.description || '',
                          when: toLocalInput(whenField(item)), endsAt: toLocalInput(item.ends_at), location: item.location || '',
                          priority: item.priority, status: item.status,
                        })}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-text-btn danger-text" onClick={() => void remove(item)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !sorted.length && (
                  <tr><td colSpan={6} className="empty-state">
                    <AdminEmptyState title="No items yet" hint={`Create the first ${type === 'exam' ? 'exam date' : 'deadline'} — it appears on the events page immediately.`} />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
