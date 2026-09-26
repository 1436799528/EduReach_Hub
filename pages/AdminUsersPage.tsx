import { useEffect, useState } from 'react';
import { Ban, RefreshCw } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { adminApiFetch, fetchAdminUserActivity, fetchAdminUsers, setUserSuspended, type AdminUser, type AdminUserActivity } from '../src/lib/api';
import { AdminEmptyState, StatusBadge, TimeAgo, TableSkeleton } from '../src/components/admin/AdminKit';

function profileCompletion(p: AdminUser): number {
  const fields = [p.full_name, p.school, p.faculty, p.department, p.level, p.matric_number];
  const filled = fields.filter((value) => Boolean(value && String(value).trim())).length;
  return Math.round((filled / fields.length) * 100);
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [viewingActivity, setViewingActivity] = useState<AdminUserActivity | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingError, setViewingError] = useState('');

  async function openActivity(user: AdminUser) {
    setViewing(user);
    setViewingActivity(null);
    setViewingError('');
    setViewingLoading(true);
    try {
      setViewingActivity(await fetchAdminUserActivity(user.id));
    } catch (e) {
      setViewingError(e instanceof Error ? e.message : 'Unable to load the student activity.');
    } finally { setViewingLoading(false); }
  }

  async function loadList(search: string) { await load(search); }

  async function toggleSuspend(p: AdminUser) {
    const suspend = !p.suspended;
    const confirmation = window.confirm(suspend
      ? `Suspend ${p.full_name || 'this account'}? The student will not be able to sign in until unsuspended.`
      : `Remove the suspension for ${p.full_name || 'this account'}?`);
    if (!confirmation) return;
    setBusyId(p.id);
    try {
      await setUserSuspended(p.id, suspend);
      // Re-list so the authoritative auth state is reflected.
      await loadList(query);
      setMessage(suspend ? 'Account suspended — sign-in is blocked until unsuspended.' : 'Account unsuspended.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the account.');
    } finally { setBusyId(null); }
  }


  async function load(search: string) {
    setLoading(true);
    try {
      setError('');
      setProfiles(await fetchAdminUsers(search));
    } catch (value) {
      setProfiles([]);
      setError(value instanceof Error ? value.message : 'Unable to load student accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Student Accounts</h1>
            <p>Review student profiles and staff roles through the protected admin API.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load(query)} disabled={loading}><RefreshCw size={14} /></button>
            <input
              className="admin-input admin-search"
              aria-label="Search student accounts"
              placeholder="Search name, school or matric number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><span>{error}</span><button type="button" className="admin-btn small" onClick={() => void load(query)} disabled={loading}>Try again</button></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Institution</th>
                  <th>Department</th>
                  <th>Level</th>
                  <th>Role</th>
                  <th>Profile</th>
                  <th>Joined</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <TableSkeleton rows={6} columns={7} />}

                {!loading &&
                  profiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.full_name || 'Unnamed student'}</b>
                        <div className="muted">{p.matric_number || 'No matric number'}</div>
                      </td>
                      <td>{p.school || '—'}</td>
                      <td>{p.department || '—'}</td>
                      <td>{p.level || '—'}</td>
                      <td>
                        <span className={`status-badge ${p.role}`}>{p.role}</span>
                        {p.suspended && <div className="muted" style={{ color: 'var(--admin-danger)', fontWeight: 700 }}>Suspended</div>}
                      </td>
                      <td>
                        <div className="admin-meter" title={`${profileCompletion(p)}% of profile fields completed`}>
                          <div className="admin-meter-fill" style={{ width: `${profileCompletion(p)}%` }} />
                        </div>
                        <div className="muted">{profileCompletion(p)}%</div>
                      </td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="right">
                        <div className="admin-action-row">
                          <button type="button" className="admin-btn small" onClick={() => void openActivity(p)}>View</button>
                          <button
                            type="button"
                            className={`admin-btn small ${p.suspended ? '' : 'danger'}`}
                            disabled={busyId === p.id}
                            onClick={() => void toggleSuspend(p)}
                          >
                            <Ban size={12} /> {p.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && !profiles.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      <AdminEmptyState title="No students match the search" hint="Student accounts appear here as soon as they register." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {viewing && (
          <div className="admin-modal-backdrop" onClick={() => setViewing(null)} role="presentation">
            <div className="admin-modal" role="dialog" aria-modal="true" aria-label={`Activity for ${viewing.full_name || 'student'}`} onClick={(e) => e.stopPropagation()}>
              <div className="admin-card-header">
                <h2>{viewing.full_name || 'Unnamed student'} — activity</h2>
                <button type="button" className="admin-text-btn" onClick={() => setViewing(null)}>Close</button>
              </div>
              <div className="admin-modal-body">
                <p className="admin-footnote" style={{ marginBottom: 12 }}>
                  Joined {new Date(viewing.created_at).toLocaleDateString()} · {viewing.school || 'No school set'} · profile {profileCompletion(viewing)}% complete
                </p>
                {viewingLoading && <p className="admin-footnote">Loading activity…</p>}
                {viewingError && <div className="hub-form-error" role="alert">{viewingError}</div>}
                {viewingActivity && (
                  <>
                    <h3 style={{ margin: '0 0 8px', color: 'var(--admin-navy)', fontSize: 14 }}>Service requests</h3>
                    <div className="admin-table-wrap" style={{ marginBottom: 18 }}>
                      <table className="admin-table">
                        <thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Date</th></tr></thead>
                        <tbody>
                          {viewingActivity.requests.map((row) => (
                            <tr key={row.id}>
                              <td className="mono accent">{row.reference_code || row.id.slice(0, 8)}</td>
                              <td>{row.service_catalog?.title || 'Service'}</td>
                              <td><StatusBadge status={row.status} /></td>
                              <td>{new Date(row.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {!viewingActivity.requests.length && <tr><td colSpan={4} className="empty-state">No service requests yet.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <h3 style={{ margin: '0 0 8px', color: 'var(--admin-navy)', fontSize: 14 }}>CBT attempts</h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>Exam</th><th>Status</th><th>Score</th><th>Started</th></tr></thead>
                        <tbody>
                          {viewingActivity.attempts.map((row) => (
                            <tr key={row.id}>
                              <td>{row.cbt_exams?.title || 'CBT exam'}</td>
                              <td><StatusBadge status={row.status === 'in_progress' ? 'processing' : row.status === 'submitted' ? 'completed' : row.status} /></td>
                              <td>{row.status === 'submitted' ? `${row.score ?? 0}%` : '—'}</td>
                              <td>{new Date(row.started_at).toLocaleString()}</td>
                            </tr>
                          ))}
                          {!viewingActivity.attempts.length && <tr><td colSpan={4} className="empty-state">No CBT attempts yet.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
