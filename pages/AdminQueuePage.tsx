import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminServiceRequest,
} from '../src/lib/api';
import { RequestActions, StatusBadge, TimeAgo, requestStudentName, TableSkeleton } from '../src/components/admin/AdminKit';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'processing', label: 'Processing' },
  { value: 'awaiting_information', label: 'Awaiting information' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminQueuePage() {
  const [rows, setRows] = useState<AdminServiceRequest[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  async function saveNote(row: AdminServiceRequest) {
    setBusyId(row.id);
    try {
      await updateAdminServiceRequest(row.id, { admin_note: noteText });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, admin_note: noteText || null } : item));
      setNoteId(null);
      setNoteText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the note.');
    } finally { setBusyId(null); }
  }

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      setError('');
      setRows(await fetchAdminServiceRequests(status));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Unable to load queue.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  async function act(requestId: string, nextStatus: string) {
    setBusyId(requestId);
    try {
      await updateAdminServiceRequest(requestId, nextStatus);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update request.');
    } finally { setBusyId(null); }
  }

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Service Processing Queue</h1>
            <p>Process student service requests through controlled status transitions.</p>
          </div>
          <select aria-label="Filter service queue by status" className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {error && (
          <div className="admin-card" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <span>{error}</span>
            <button type="button" className="admin-btn small" onClick={() => void load(filter)} disabled={loading}>Try again</button>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>{FILTERS.find((f) => f.value === filter)?.label || 'Queue'}</h2><span>{loading ? 'Loading…' : `${rows.length} request${rows.length === 1 ? '' : 's'}`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Student</th><th>Service</th><th>Reference</th><th>Details</th><th>Status</th><th>Age</th><th>Action</th></tr></thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={7} />}
                {!loading && rows.map((row) => (
                  <tr key={row.id}>
                    <td className="accent">{requestStudentName(row)}</td>
                    <td>{row.service_catalog?.title || 'Service request'}</td>
                    <td className="mono">{row.reference_code || '—'}</td>
                    <td>
                      {String(row.form_data?.message || row.form_data?.requestDetails || '—')}
                      {row.admin_note && <div className="muted" style={{ marginTop: 4 }}><b>Note:</b> {row.admin_note}</div>}
                      <button type="button" className="admin-text-btn" style={{ marginTop: 4 }} onClick={() => { setNoteId(noteId === row.id ? null : row.id); setNoteText(row.admin_note || ''); }}>
                        {row.admin_note ? 'Edit note' : 'Add note'}
                      </button>
                      {noteId === row.id && (
                        <div className="admin-note-editor">
                          <textarea
                            className="admin-textarea"
                            style={{ minHeight: 56 }}
                            aria-label="Internal admin note"
                            placeholder="Internal note (never shown to the student)"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                          />
                          <div className="admin-action-row">
                            <button type="button" className="admin-btn small success" disabled={busyId === row.id} onClick={() => void saveNote(row)}>Save note</button>
                            <button type="button" className="admin-text-btn" onClick={() => setNoteId(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td><TimeAgo value={row.created_at} /></td>
                    <td className="right"><RequestActions row={row} disabled={busyId === row.id} onAction={act} /></td>
                  </tr>
                ))}
                {!loading && !rows.length && <tr><td colSpan={7} className="empty-state">No matching service requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
