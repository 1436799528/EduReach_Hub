import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { adminApiFetch } from '../src/lib/api';

type Field = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  readonly?: boolean;
};

type Resource = {
  key: string;
  label: string;
  table: string;
  fields: Field[];
  notes?: string;
};

type Row = Record<string, unknown> & { id?: string };

const RESOURCE_KEYS = [
  'institutions','faculties','departments','programmes','courses',
  'cbt_exams','exam_questions','news_articles','opportunities',
  'service_catalog','deadlines','calendar_exams'
] as const;

function csvParse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => v.trim() !== '')) rows.push(row);
  }
  return rows;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminContentManagerPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceKey, setResourceKey] = useState<string>('institutions');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fileName, setFileName] = useState('');

  const resource = useMemo(() => resources.find(r => r.key === resourceKey), [resources, resourceKey]);

  async function loadResources() {
    const data = await adminApiFetch<{ resources: Resource[] }>('/api/admin/content-manager/resources');
    setResources(data.resources || []);
  }

  async function loadRows(key = resourceKey) {
    setLoading(true); setError('');
    try {
      const data = await adminApiFetch<{ rows: Row[] }>(`/api/admin/content-manager/data/${encodeURIComponent(key)}`);
      setRows(data.rows || []);
    } catch (e) {
      setRows([]); setError(e instanceof Error ? e.message : 'Unable to load data.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadResources().catch(e => setError(e instanceof Error ? e.message : 'Unable to load content manager.')); }, []);
  useEffect(() => { if (resources.length) void loadRows(resourceKey); }, [resourceKey, resources.length]);

  function startNew() {
    if (!resource) return;
    const next: Row = {};
    resource.fields.forEach(field => { if (!field.readonly) next[field.name] = field.type === 'boolean' ? false : ''; });
    setEditing(next); setShowForm(true); setMessage('');
  }

  function startEdit(row: Row) {
    setEditing({ ...row }); setShowForm(true); setMessage('');
  }

  async function saveRow() {
    if (!resource || !editing) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const isEdit = Boolean(editing.id);
      const data = await adminApiFetch<{ row: Row }>(
        `/api/admin/content-manager/data/${encodeURIComponent(resource.key)}${isEdit ? '/' + encodeURIComponent(String(editing.id)) : ''}`,
        { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(editing) }
      );
      setRows(current => isEdit ? current.map(row => row.id === editing.id ? data.row : row) : [data.row, ...current]);
      setShowForm(false); setEditing(null); setMessage(isEdit ? 'Record updated.' : 'Record created.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save record.');
    } finally { setSaving(false); }
  }

  async function removeRow(row: Row) {
    if (!resource || !row.id) return;
    if (!window.confirm(`Delete this ${resource.label.toLowerCase()} record? If other data depends on it, deletion will be refused.`)) return;
    try {
      await adminApiFetch(`/api/admin/content-manager/data/${encodeURIComponent(resource.key)}/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      setRows(current => current.filter(item => item.id !== row.id));
      setMessage('Record deleted.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete record.'); }
  }

  async function importCsv(file: File) {
    if (!resource) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const text = await file.text();
      const parsed = csvParse(text);
      if (parsed.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
      const headers = parsed[0].map(h => h.trim());
      const allowed = new Set(resource.fields.map(f => f.name));
      const unknown = headers.filter(h => !allowed.has(h));
      if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}. Download the template for this section.`);
      const dataRows = parsed.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
      const result = await adminApiFetch<{ inserted: number; updated: number; errors: Array<{ row: number; error: string }> }>(
        `/api/admin/content-manager/import/${encodeURIComponent(resource.key)}`,
        { method: 'POST', body: JSON.stringify({ rows: dataRows }) }
      );
      await loadRows(resource.key);
      setFileName(file.name);
      setMessage(`Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.errors.length} rejected.${result.errors.length ? ' See the error list below.' : ''}`);
      if (result.errors.length) setError(result.errors.map(item => `Row ${item.row}: ${item.error}`).join(' • '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to import CSV.');
    } finally { setSaving(false); }
  }

  function template() {
    if (!resource) return;
    download(`edureach-${resource.key}-template.csv`, resource.fields.filter(f => !f.readonly).map(f => f.name).concat(resource.fields.some(f => f.name === 'id') ? ['id'] : []).join(',') + '\n');
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Content Manager</h1>
          <p>One bulk workspace for the editable Supabase data that powers the site. No code changes are required for routine content updates.</p>
        </div>
        <div className="admin-header-actions">
          <select className="admin-select" value={resourceKey} onChange={e => { setResourceKey(e.target.value); setShowForm(false); }}>
            {resources.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <button className="admin-btn secondary-dark" type="button" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} /></button>
          <button className="admin-btn" type="button" onClick={startNew}><Plus size={14} /> New</button>
        </div>
      </div>

      {error && <div className="admin-card" role="alert" style={{ padding: 14 }}>{error}</div>}
      {message && <div className="admin-card" style={{ padding: 14, borderLeft: '4px solid var(--admin-green)' }}>{message}</div>}

      {resource && (
        <>
          <div className="admin-two-col">
            <div className="admin-card">
              <div className="admin-card-header"><h2>Bulk import</h2><span>{fileName || 'CSV'}</span></div>
              <div style={{ padding: 18 }}>
                <p className="muted">Use the exact field names shown below. Required fields are marked. Existing records can be updated by including their <b>id</b> in the CSV where the template allows it.</p>
                <div className="admin-action-row">
                  <button className="admin-btn secondary-dark" type="button" onClick={template}><Download size={14} /> Download template</button>
                  <label className="admin-btn" style={{ cursor: 'pointer' }}><Upload size={14} /> Import CSV<input hidden type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.currentTarget.value = ''; }} /></label>
                </div>
              </div>
            </div>
            <div className="admin-card">
              <div className="admin-card-header"><h2>Database fields</h2><span>{resource.table}</span></div>
              <div className="admin-table-wrap">
                <table className="admin-table"><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Mode</th></tr></thead><tbody>
                  {resource.fields.map(field => <tr key={field.name}><td><b>{field.label}</b><div className="muted">{field.name}</div></td><td>{field.type}</td><td>{field.required ? 'Yes' : 'No'}</td><td>{field.readonly ? 'Read-only' : 'Editable'}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          </div>

          {showForm && editing && (
            <div className="admin-card">
              <div className="admin-card-header"><h2>{editing.id ? 'Edit record' : 'New record'}</h2><button className="admin-text-btn" type="button" onClick={() => setShowForm(false)}>Close</button></div>
              <div className="admin-news-editor-body">
                <div className="admin-news-form-grid">
                  {resource.fields.map(field => {
                    if (field.readonly) return null;
                    const value = editing[field.name];
                    if (field.type === 'boolean') return <label className="admin-field" key={field.name}><span>{field.label}{field.required ? ' *' : ''}</span><select className="admin-select" value={String(Boolean(value))} onChange={e => setEditing({ ...editing, [field.name]: e.target.value === 'true' })}><option value="true">True</option><option value="false">False</option></select></label>;
                    return <label className="admin-field" key={field.name}><span>{field.label}{field.required ? ' *' : ''}</span><input className="admin-input" style={{ width: '100%' }} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime-local' ? 'datetime-local' : 'text'} value={value == null ? '' : String(value)} onChange={e => setEditing({ ...editing, [field.name]: e.target.value })} /></label>;
                  })}
                </div>
                <div className="admin-news-editor-actions"><button className="admin-btn success" type="button" onClick={() => void saveRow()} disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button></div>
              </div>
            </div>
          )}

          <div className="admin-card">
            <div className="admin-card-header"><h2>{resource.label}</h2><span>{loading ? 'Loading…' : `${rows.length} shown`}</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table"><thead><tr>{resource.fields.filter(f => !f.readonly).slice(0, 6).map(f => <th key={f.name}>{f.label}</th>)}<th className="right">Actions</th></tr></thead>
                <tbody>
                  {!loading && rows.map(row => <tr key={String(row.id)}>{resource.fields.filter(f => !f.readonly).slice(0, 6).map(f => <td key={f.name}>{String(row[f.name] ?? '—').slice(0, 120)}</td>)}<td className="right"><div className="admin-action-row"><button className="admin-btn small" type="button" onClick={() => startEdit(row)}><Pencil size={12} /> Edit</button><button className="admin-text-btn danger-text" type="button" onClick={() => void removeRow(row)}><Trash2 size={12} /></button></div></td></tr>)}
                  {loading && <tr><td colSpan={7} className="empty-state">Loading…</td></tr>}
                  {!loading && !rows.length && <tr><td colSpan={7} className="empty-state">No records yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
