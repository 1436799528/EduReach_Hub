import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { fetchAdminAnalytics, type AdminAnalytics } from '../src/lib/api';

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="admin-kpi"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setData(await fetchAdminAnalytics()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load analytics.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const m = data?.metrics || {};
  return <AdminLayout>
    <div className="admin-page">
      <div className="admin-page-header">
        <div><h1>Analytics &amp; Reports</h1><p>Live operational metrics from EduReach production data.</p></div>
        <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div className="admin-card"><p className="empty-state">{error}</p></div>}
      <div className="admin-kpi-grid">
        <Metric label="Users" value={m.users ?? 0} detail={`${m.admins ?? 0} administrators`} />
        <Metric label="Service Requests" value={m.service_requests ?? 0} detail={`${m.pending_requests ?? 0} active queue`} />
        <Metric label="Completed" value={m.completed_requests ?? 0} detail={`${m.rejected_requests ?? 0} rejected/cancelled`} />
        <Metric label="Traffic Events" value={m.events_24h ?? 0} detail={`${m.sessions_24h ?? 0} sessions in 24h`} />
        <Metric label="7-Day Events" value={m.events_7d ?? 0} />
        <Metric label="CBT Attempts" value={m.cbt_attempts ?? 0} detail={`${m.cbt_submitted ?? 0} submitted`} />
        <Metric label="Average CBT Score" value={`${m.average_cbt_score ?? 0}%`} />
        <Metric label="Institutions" value={m.institutions ?? 0} detail={`${m.active_services ?? 0} active services`} />
        <Metric label="Published News" value={m.published_news ?? 0} detail={`${m.audit_events ?? 0} audit events`} />
      </div>
      <div className="admin-card">
        <div className="admin-card-header"><h2>Recent Service Activity</h2><span>Production</span></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {(data?.recentRequests || []).map((r: any) => <tr key={r.id}><td className="mono accent">{r.reference_code || r.id.slice(0,8)}</td><td>{r.service_catalog?.title || 'Service'}</td><td><span className={`status-badge ${r.status}`}>{r.status}</span></td><td>{new Date(r.created_at).toLocaleString()}</td></tr>)}
          {!data?.recentRequests?.length && <tr><td colSpan={4} className="empty-state">No service activity yet.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="admin-card">
        <div className="admin-card-header"><h2>Recent Accounts</h2><span>Latest 10</span></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead><tbody>
          {(data?.recentUsers || []).map((u: any) => <tr key={u.id}><td>{u.full_name || 'Unnamed user'}</td><td><span className={`status-badge ${u.role}`}>{u.role}</span></td><td>{new Date(u.created_at).toLocaleString()}</td></tr>)}
          {!data?.recentUsers?.length && <tr><td colSpan={3} className="empty-state">No accounts yet.</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  </AdminLayout>;
}