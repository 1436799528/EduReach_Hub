import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Laptop,
  ListChecks,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  fetchAdminAnalytics,
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminAnalytics,
  type AdminServiceRequest,
} from '../src/lib/api';
import {
  ACTIVE_REQUEST_STATUSES,
  AuditTimeline,
  KpiSkeleton,
  Metric,
  RequestActions,
  StatusBadge,
  TimeAgo,
  requestStudentName,
} from '../src/components/admin/AdminKit';

const REFRESH_MS = 60_000;

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [queue, setQueue] = useState<AdminServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      setError('');
      const [analyticsData, queueData] = await Promise.all([
        fetchAdminAnalytics(),
        fetchAdminServiceRequests('all'),
      ]);
      if (!mounted.current) return;
      setAnalytics(analyticsData);
      setQueue(queueData);
      setUpdatedAt(new Date());
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Unable to load the operations dashboard.');
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, REFRESH_MS);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [load]);

  async function act(requestId: string, nextStatus: string) {
    setBusyId(requestId);
    try {
      await updateAdminServiceRequest(requestId, nextStatus);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update request.');
    } finally { setBusyId(null); }
  }

  const m = analytics?.metrics || {};
  const attention = queue
    .filter((row) => ACTIVE_REQUEST_STATUSES.includes(row.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const recentUsers = (analytics?.recentUsers || []).slice(0, 5);
  const num = (key: string) => Number(m[key] ?? 0);

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Operations Control</h1>
            <p>Live EduReach production overview — queue, students, traffic, CBT and content in one place.</p>
          </div>
          <div className="admin-header-actions">
            {updatedAt && <span className="admin-updated">Updated <TimeAgo value={updatedAt.toISOString()} /></span>}
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'spin' : undefined} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-card" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <span>{error}</span>
            <button type="button" className="admin-btn small" onClick={() => void load()} disabled={loading}>Try again</button>
          </div>
        )}

        {loading ? (
          <KpiSkeleton count={6} />
        ) : (
          <div className="admin-kpi-grid three">
            <Metric label="Active Queue" value={num('pending_requests')} detail={`${num('service_requests')} requests all-time`} icon={<ListChecks size={16} />} tone="orange" />
            <Metric label="Students" value={num('users')} detail={`${num('admins')} staff accounts`} icon={<Users size={16} />} tone="blue" />
            <Metric label="Traffic (24h)" value={num('events_24h')} detail={`${num('sessions_24h')} sessions · ${num('events_7d')} events in 7d`} icon={<Activity size={16} />} tone="green" />
            <Metric label="Completed" value={num('completed_requests')} detail={`${num('rejected_requests')} rejected / cancelled`} icon={<BadgeCheck size={16} />} tone="green" />
            <Metric label="CBT Attempts" value={num('cbt_attempts')} detail={`${num('cbt_submitted')} submitted · avg ${num('average_cbt_score')}%`} icon={<Laptop size={16} />} tone="purple" />
            <Metric label="Published News" value={num('published_news')} detail={`${num('institutions')} institutions · ${num('active_services')} active services`} icon={<Newspaper size={16} />} tone="orange" />
          </div>
        )}

        {!loading && (
          <>
            <div className="admin-quick-grid">
              <a className="admin-quick-tile" href="/admin/queue"><i className="admin-kpi-icon orange"><ListChecks size={16} /></i><div><b>Process Queue</b><small>Review, complete or reject requests</small></div></a>
              <a className="admin-quick-tile" href="/admin/cbt"><i className="admin-kpi-icon purple"><Laptop size={16} /></i><div><b>CBT Question Bank</b><small>Add exams and timed questions</small></div></a>
              <a className="admin-quick-tile" href="/admin/news"><i className="admin-kpi-icon orange"><Newspaper size={16} /></i><div><b>Newsroom CMS</b><small>Publish notices to students</small></div></a>
              <a className="admin-quick-tile" href="/admin/users"><i className="admin-kpi-icon blue"><Users size={16} /></i><div><b>Student Accounts</b><small>Search profiles and roles</small></div></a>
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2>Needs Attention</h2>
                  <span>{attention.length ? `${attention.length} active` : 'Queue clear'}</span>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Student</th><th>Service</th><th>Status</th><th>Age</th><th>Action</th></tr></thead>
                    <tbody>
                      {attention.map((row) => (
                        <tr key={row.id}>
                          <td className="accent">{requestStudentName(row)}</td>
                          <td>{row.service_catalog?.title || 'Student service'}</td>
                          <td><StatusBadge status={row.status} /></td>
                          <td><TimeAgo value={row.created_at} /></td>
                          <td className="right"><RequestActions row={row} disabled={busyId === row.id} onAction={act} /></td>
                        </tr>
                      ))}
                      {!attention.length && <tr><td colSpan={5} className="empty-state">Queue is clear — no active service requests.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="admin-card">
                  <div className="admin-card-header"><h2>Recent Staff Activity</h2><span>Audit trail</span></div>
                  <AuditTimeline items={(analytics?.audit || []).slice(0, 6)} />
                </div>
                <div className="admin-card">
                  <div className="admin-card-header"><h2>Newest Accounts</h2><span>Latest sign-ups</span></div>
                  <div className="admin-account-list">
                    {recentUsers.map((u) => (
                      <div className="admin-account-item" key={String(u.id)}>
                        <div className="admin-account-id"><i className="admin-kpi-icon blue"><ShieldCheck size={14} /></i><b>{String(u.full_name || 'Unnamed user')}</b></div>
                        <div className="admin-account-side"><StatusBadge status={String(u.role || 'student')} /><TimeAgo value={u.created_at} /></div>
                      </div>
                    ))}
                    {!recentUsers.length && <p className="empty-state" style={{ margin: 0 }}>No accounts have registered yet.</p>}
                  </div>
                </div>
              </div>
            </div>

            {queue.length > attention.length && (
              <p className="admin-footnote">Showing the {attention.length} most recent active requests. <a href="/admin/queue">Open the full queue</a> for completed history and filters.</p>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
