import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { fetchAdminUsers, type AdminUser } from '../src/lib/api';

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(search: string) {
    setLoading(true);
    try {
      setProfiles(await fetchAdminUsers(search));
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
  }, []);

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
          <input
            className="admin-input admin-search"
            placeholder="Search name, school or matric number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

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
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="empty-state">
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
                      </td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}

                {!loading && !profiles.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No students match the search.
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
