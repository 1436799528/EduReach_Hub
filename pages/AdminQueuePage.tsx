import { userFacingError } from '../lib/errors';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminServiceRequest,
} from '../src/lib/api';
import { ACTIVE_REQUEST_STATUSES, AdminPageReport, RequestActions, StatusBadge, TimeAgo, requestStudentName, TableSkeleton } from '../src/components/admin/AdminKit';
import { Can } from '../src/components/admin/Can';
import { serviceRequestUpdateFailure } from '../src/lib/serviceRequestErrors';

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteVersion, setNoteVersion] = useState('');

  function showUpdateError(error: unknown, fallback: string) {
    const failure = serviceRequestUpdateFailure(error, fallback);
    if (failure.needsRefresh) setNeedsRefresh(true);
    setError(failure.message);
  }

  async function saveNote(row: AdminServiceRequest) {
    setBusyId(row.id);
    try {
      const result = await updateAdminServiceRequest(row.id, { admin_note: noteText, expected_updated_at: noteVersion });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...result.item } : item));
      setNoteId(null);
      setNoteText('');
    } catch (e) {
      showUpdateError(e, 'Unable to save the note.');
    } finally { setBusyId(null); }
  }

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      setError('');
      setRows(await fetchAdminServiceRequests(status));
      setLoadFailed(false);
      setNeedsRefresh(false);
    } catch (e) {
      setRows([]);
      setLoadFailed(true);
      setNeedsRefresh(true);
      setError(userFacingError(e, 'Unable to load queue.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  async function act(requestId: string, nextStatus: string, expectedUpdatedAt: string) {
    setBusyId(requestId);
    try {
      await updateAdminServiceRequest(requestId, { status: nextStatus, expected_updated_at: expectedUpdatedAt });
      await load(filter);
    } catch (e) {
      showUpdateError(e, 'Unable to update request.');
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

        {!loading && !error && (
          <>
            <AdminPageReport
              title="Queue reporting"
              items={[
                { label: 'Records shown', value: rows.length.toLocaleString() },
                { label: 'Open requests', value: rows.filter((row) => ACTIVE_REQUEST_STATUSES.includes(row.status)).length.toLocaleString() },
                { label: 'Completed', value: rows.filter((row) => row.status === 'completed').length.toLocaleString() },
                { label: 'Rejected / cancelled', value: rows.filter((row) => row.status === 'rejected' || row.status === 'cancelled').length.toLocaleString() },
              ]}
              note="The queue API returns at most 200 matching records and does not provide a response-time trend."
            />
          </>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>{FILTERS.find((f) => f.value === filter)?.label || 'Queue'}</h2><span>{loading ? 'Loading…' : loadFailed ? 'Unavailable' : `${rows.length} request${rows.length === 1 ? '' : 's'}`}</span></div>
          <div className="admin-table-wrap admin-table-wrap--stack" role="region" aria-label="Scrollable table" tabIndex={0}>
            <table className="admin-table admin-table--stack">
              <thead><tr><th scope="col">Student</th><th scope="col">Service</th><th scope="col">Reference</th><th scope="col">Details</th><th scope="col">Status</th><th scope="col">Age</th><th scope="col">Action</th></tr></thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={7} />}
                {!loading && rows.map((row) => (
                  <tr key={row.id}>
                    <td className="accent" data-label="Student">{requestStudentName(row)}</td>
                    <td data-label="Service">{row.service_catalog?.title || 'Service request'}</td>
                    <td className="mono" data-label="Reference">{row.reference_code || '—'}</td>
                    <td data-label="Details">
                      {String(row.form_data?.message || row.form_data?.requestDetails || '—')}
                      {row.admin_note && <div className="muted" style={{ marginTop: 4 }}><b>Note:</b> {row.admin_note}</div>}
                      <button type="button" className="admin-text-btn" style={{ marginTop: 4 }} onClick={() => { setNoteId(noteId === row.id ? null : row.id); setNoteText(row.admin_note || ''); setNoteVersion(row.updated_at); }}>
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
                            <Can capability="service_request.process">
                              <button type="button" className="admin-btn small success" disabled={needsRefresh || busyId === row.id} onClick={() => void saveNote(row)}>Save note</button>
                            </Can>
                            <button type="button" className="admin-text-btn" onClick={() => setNoteId(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td data-label="Status"><StatusBadge status={row.status} /></td>
                    <td data-label="Age"><TimeAgo value={row.created_at} /></td>
                    <td className="right" data-label="Action"><RequestActions row={row} disabled={needsRefresh || busyId === row.id} onAction={act} /></td>
                  </tr>
                ))}
                {!loading && !loadFailed && !rows.length && <tr><td colSpan={7} className="empty-state">No matching service requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
