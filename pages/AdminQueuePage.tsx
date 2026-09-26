import { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import {
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminServiceRequest,
} from '../src/lib/api';
import { RequestActions, StatusBadge, TimeAgo, requestStudentName } from '../src/components/admin/AdminKit';

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
    <AdminLayout>
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
                {loading && <tr><td colSpan={7} className="empty-state">Loading the service queue…</td></tr>}
                {!loading && rows.map((row) => (
                  <tr key={row.id}>
                    <td className="accent">{requestStudentName(row)}</td>
                    <td>{row.service_catalog?.title || 'Service request'}</td>
                    <td className="mono">{row.reference_code || '—'}</td>
                    <td>{String(row.form_data?.message || row.form_data?.requestDetails || '—')}</td>
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
    </AdminLayout>
  );
}
