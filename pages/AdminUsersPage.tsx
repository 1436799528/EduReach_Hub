import { useEffect, useState } from 'react';
import { Ban, RefreshCw } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { adminApiFetch, fetchAdminUsers, setUserSuspended, type AdminUser } from '../src/lib/api';
import { AdminEmptyState, StatusBadge, TimeAgo } from '../src/components/admin/AdminKit';

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
                {loading && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Loading student accounts…
                    </td>
                  </tr>
                )}

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
      </div>
    </AdminLayout>
  );
}
