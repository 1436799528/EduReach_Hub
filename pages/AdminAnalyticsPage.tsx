import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { fetchAdminAnalytics } from '../src/lib/api';
import { AuditTimeline, BarStat, KpiSkeleton, Metric, StatusBadge, TimeAgo } from '../src/components/admin/AdminKit';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    try { setError(''); setData(await fetchAdminAnalytics()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load analytics.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const m = data?.metrics || {};
  const num = (key: string) => Number(m[key] ?? 0);

  // Queue composition bars — derived from server metrics, never invented client-side.
  const pending = num('pending_requests');
  const completed = num('completed_requests');
  const rejected = num('rejected_requests');
  const totalRequests = num('service_requests');
  const otherRequests = Math.max(totalRequests - pending - completed - rejected, 0);
  const queueMax = Math.max(pending, completed, rejected, otherRequests, 1);

  const events24 = num('events_24h');
  const events7 = Math.max(num('events_7d'), events24, 1);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div><h1>Analytics &amp; Reports</h1><p>Live operational metrics from EduReach production data.</p></div>
          <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {error && <div className="admin-card" role="alert"><p className="empty-state">{error}</p></div>}

        {loading ? (
          <KpiSkeleton count={6} />
        ) : (
          <>
            <div className="admin-kpi-grid three">
              <Metric label="Users" value={num('users')} detail={`${num('admins')} administrators`} />
              <Metric label="Service Requests" value={totalRequests} detail={`${pending} active queue`} />
              <Metric label="Completed" value={completed} detail={`${rejected} rejected/cancelled`} />
              <Metric label="Traffic Events" value={events24} detail={`${num('sessions_24h')} sessions in 24h`} />
              <Metric label="CBT Attempts" value={num('cbt_attempts')} detail={`${num('cbt_submitted')} submitted`} />
              <Metric label="Average CBT Score" value={`${num('average_cbt_score')}%`} detail={`${num('institutions')} institutions · ${num('published_news')} news items`} />
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header"><h2>Service Queue Composition</h2><span>All-time</span></div>
                <div style={{ padding: '8px 14px 14px' }}>
                  <BarStat label="Active (submitted → awaiting info)" value={pending} max={queueMax} tone="orange" />
                  <BarStat label="Completed" value={completed} max={queueMax} tone="green" />
                  <BarStat label="Rejected / cancelled" value={rejected} max={queueMax} tone="blue" />
                  {otherRequests > 0 && <BarStat label="Closed / other" value={otherRequests} max={queueMax} tone="blue" />}
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header"><h2>Application Traffic</h2><span>Tracked events</span></div>
                <div style={{ padding: '8px 14px 14px' }}>
                  <BarStat label="Last 24 hours" value={events24} max={events7} hint={`${events24} events`} tone="orange" />
                  <BarStat label="Last 7 days" value={num('events_7d')} max={events7} hint={`${num('events_7d')} events`} tone="green" />
                  <p className="admin-footnote" style={{ margin: '4px 0 0' }}>{num('sessions_24h')} unique sessions in the last 24 hours · {num('audit_events')} audit events recorded.</p>
                </div>
              </div>
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header"><h2>Recent Staff Activity</h2><span>Audit trail</span></div>
                <AuditTimeline items={data?.audit || []} />
              </div>

              <div className="admin-card">
                <div className="admin-card-header"><h2>Recent Service Activity</h2><span>Latest 10</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Created</th></tr></thead><tbody>
                  {(data?.recentRequests || []).map((r) => <tr key={String(r.id)}><td className="mono accent">{String(r.reference_code || String(r.id).slice(0, 8))}</td><td>{r.service_catalog?.title || 'Service'}</td><td><StatusBadge status={String(r.status)} /></td><td><TimeAgo value={r.created_at} /></td></tr>)}
                  {!data?.recentRequests?.length && <tr><td colSpan={4} className="empty-state">No service activity yet.</td></tr>}
                </tbody></table></div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header"><h2>Recent Accounts</h2><span>Latest 10</span></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead><tbody>
                {(data?.recentUsers || []).map((u) => <tr key={String(u.id)}><td>{String(u.full_name || 'Unnamed user')}</td><td><StatusBadge status={String(u.role || 'student')} /></td><td><TimeAgo value={u.created_at} /></td></tr>)}
                {!data?.recentUsers?.length && <tr><td colSpan={3} className="empty-state">No accounts yet.</td></tr>}
              </tbody></table></div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
