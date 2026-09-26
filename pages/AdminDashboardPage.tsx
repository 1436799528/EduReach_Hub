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
import {
  fetchAdminAnalytics,
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminAnalytics,
  type AdminServiceRequest,
} from '../src/lib/api';
import {
  ACTIVE_REQUEST_STATUSES,
  AdminEmptyState,
  AuditTimeline,
  BarStat,
  KpiSkeleton,
  Metric,
  RequestActions,
  SectionLabel,
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

  const activity = analytics?.activity || null;
  const m = analytics?.metrics || {};
  const attention = queue
    .filter((row) => ACTIVE_REQUEST_STATUSES.includes(row.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const recentUsers = (analytics?.recentUsers || []).slice(0, 5);
  const num = (key: string) => Number(m[key] ?? 0);

  return (
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
              <a className="admin-quick-tile" href="/admin/news"><i className="admin-kpi-icon orange"><Newspaper size={16} /></i><div><b>Newsroom CMS</b><small>Create, edit, publish or remove news</small></div></a>
              <a className="admin-quick-tile" href="/admin/opportunities"><i className="admin-kpi-icon green"><BadgeCheck size={16} /></i><div><b>Opportunities</b><small>Manage scholarships, grants and jobs</small></div></a>
              <a className="admin-quick-tile" href="/admin/services"><i className="admin-kpi-icon orange"><ListChecks size={16} /></i><div><b>Service Catalogue</b><small>Edit, show, hide or add student services</small></div></a>
              <a className="admin-quick-tile" href="/admin/content"><i className="admin-kpi-icon blue"><Newspaper size={16} /></i><div><b>Events &amp; Dates</b><small>Manage deadlines and exam dates</small></div></a>
              <a className="admin-quick-tile" href="/admin/users"><i className="admin-kpi-icon blue"><Users size={16} /></i><div><b>Student Accounts</b><small>Search profiles and roles</small></div></a>
            </div>

            {num('pending_requests') > 0 && (
              <div className="admin-alert" role="status">
                <ListChecks size={15} />
                <span><b>{num('pending_requests')} service request{num('pending_requests') === 1 ? '' : 's'} need attention.</b> Students are waiting on these.</span>
                <a className="admin-btn small" href="/admin/queue">Open queue</a>
              </div>
            )}

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2>Needs Attention <SectionLabel live /></h2>
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
                  <div className="admin-card-header"><h2>Where attention is going <SectionLabel /></h2><span>Real events</span></div>
                  <div className="admin-focus-body">
                    {activity && (activity.topPages.length || activity.topSearches.length || activity.serviceSubmits.length || activity.cbtStarts.length) ? (
                      <>
                        <FocusGroup title="Most viewed pages" rows={activity.topPages.map((row) => ({ label: row.path, value: row.views }))} />
                        <FocusGroup title="Top searches" rows={activity.topSearches.map((row) => ({ label: row.term, value: row.count }))} />
                        <FocusGroup title="Most-started CBT exams" rows={activity.cbtStarts.map((row) => ({ label: row.exam, value: row.count }))} />
                        <FocusGroup title="Most-completed services" rows={activity.serviceSubmits.map((row) => ({ label: row.path, value: row.count }))} />
                      </>
                    ) : (
                      <AdminEmptyState
                        title="No usage telemetry yet"
                        hint="Page views, searches, service and CBT activity are recorded from real traffic. This fills in as students use the live site — nothing is simulated."
                      />
                    )}
                  </div>
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
  );
}

function FocusGroup({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  if (!rows.length) return null;
  return (
    <div className="admin-focus-group">
      <h3>{title}</h3>
      {rows.slice(0, 5).map((row) => (
        <BarStat key={row.label} label={row.label} value={row.value} max={max} tone="orange" />
      ))}
    </div>
  );
}
