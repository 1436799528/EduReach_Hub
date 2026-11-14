import { userFacingError } from '../lib/errors';
import { serviceRequestUpdateFailure } from '../src/lib/serviceRequestErrors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import {
  fetchAdminAnalytics,
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
  type AdminAnalytics,
  type AdminServiceRequest,
} from '../src/lib/api';
import {
  ACTIVE_REQUEST_STATUSES,
  AdminDonut,
  AdminEmptyState,
  AdminStatusDot,
  AdminSummary,
  AuditTimeline,
  BarStat,
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
      setError(userFacingError(e, 'Unable to load the operations dashboard.'));
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

  async function act(requestId: string, nextStatus: string, expectedUpdatedAt: string) {
    setBusyId(requestId);
    try {
      await updateAdminServiceRequest(requestId, { status: nextStatus, expected_updated_at: expectedUpdatedAt });
      await load(true);
    } catch (e) {
      setError(serviceRequestUpdateFailure(e, 'Unable to update request.').message);
    } finally { setBusyId(null); }
  }

  const activity = analytics?.activity || null;
  const m = analytics?.metrics || {};
  const metric = (key: string): number | null => {
    const value = m[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const metricText = (key: string): string => {
    const value = metric(key);
    return value === null ? 'Unavailable' : value.toLocaleString();
  };
  const pendingCount = metric('pending_requests');
  const attention = queue
    .filter((row) => ACTIVE_REQUEST_STATUSES.includes(row.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const recentUsers = (analytics?.recentUsers || []).slice(0, 5);

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Overview</h1>
            <p>Queues, platform health and recorded activity.</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-live" title="Data refreshed automatically every minute">
              <AdminStatusDot status="healthy" label="Live operational data" />
              Live
              {updatedAt && <span className="admin-live-time">Updated <TimeAgo value={updatedAt.toISOString()} /></span>}
            </span>
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'spin' : undefined} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-card admin-error-card" role="alert">
            <span>{error}</span>
            <div className="admin-header-actions">
              <a className="admin-btn secondary" href="/admin/queue">Open queue</a>
              <button type="button" className="admin-btn small" onClick={() => void load()} disabled={loading}>Try again</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="admin-summary admin-summary-loading" aria-label="Loading operational summary">
            {Array.from({ length: 6 }, (_, index) => <span className="admin-skel admin-skel-line" key={index} aria-hidden="true" />)}
          </div>
        ) : (
          <AdminSummary
            label="Operational summary"
            className="dashboard-summary"
            items={[
              { label: 'Registered users', value: metricText('users'), detail: metric('admins') === null ? 'Staff accounts unavailable' : `${metricText('admins')} staff accounts`, tone: 'blue' },
              { label: 'Open requests', value: metricText('pending_requests'), detail: metric('service_requests') === null ? 'All-time request count unavailable' : `${metricText('service_requests')} requests all-time`, tone: 'amber' },
              { label: 'Completed requests', value: metricText('completed_requests'), detail: metric('rejected_requests') === null ? 'Rejected/cancelled count unavailable' : `${metricText('rejected_requests')} rejected or cancelled`, tone: 'green' },
              { label: 'Site events · 24h', value: metricText('events_24h'), detail: metric('sessions_24h') === null ? 'Unique sessions unavailable' : `${metricText('sessions_24h')} unique sessions`, tone: 'violet' },
              { label: 'CBT attempts', value: metricText('cbt_attempts'), detail: metric('cbt_submitted') === null ? 'Submission count unavailable' : `${metricText('cbt_submitted')} submitted`, tone: 'blue' },
              {
                label: 'Average submitted score',
                value: metric('cbt_submitted') === 0 ? 'Unavailable' : metric('average_cbt_score') === null ? 'Unavailable' : `${metricText('average_cbt_score')}%`,
                detail: metric('cbt_submitted') === 0 ? 'No submitted attempts' : 'Across submitted attempts', tone: 'green',
              },
            ]}
          />
        )}

        {!loading && (
          <>
            {pendingCount !== null && pendingCount > 0 && (
              <div className="admin-alert" role="status">
                <ListChecks size={15} />
                <AdminStatusDot status="attention" label={`${pendingCount} open service requests require attention`} />
                <span><b>{pendingCount.toLocaleString()} service request{pendingCount === 1 ? '' : 's'} need attention.</b> Students are waiting on these.</span>
                <a className="admin-btn small" href="/admin/queue">Open queue</a>
              </div>
            )}

            <div className="admin-chart-grid">
              <div className="admin-chart-card">
                <div className="admin-chart-head"><div><h2>Request mix</h2><p>Current service-request state from the analytics totals.</p></div><span className="admin-report-period">All-time</span></div>
                {['pending_requests', 'completed_requests', 'rejected_requests'].every((key) => metric(key) !== null) ? (
                  <AdminDonut
                    ariaLabel="Service request mix"
                    segments={[
                      { label: 'Open', value: metric('pending_requests') || 0, color: '#174A3A' },
                      { label: 'Completed', value: metric('completed_requests') || 0, color: '#067647' },
                      { label: 'Rejected / cancelled', value: metric('rejected_requests') || 0, color: '#B42318' },
                    ].filter((segment) => segment.value > 0)}
                  />
                ) : <AdminEmptyState title="Request mix unavailable" hint="The analytics totals do not include all request states." />}
              </div>
              <div className="admin-chart-card">
                <div className="admin-chart-head"><div><h2>Traffic snapshot</h2><p>Events recorded by the platform.</p></div></div>
                {metric('events_24h') !== null && metric('events_7d') !== null ? (
                  <>
                    <BarStat label="Last 24 hours" value={metric('events_24h')!} max={Math.max(metric('events_24h')!, metric('events_7d')!, 1)} hint={`${metricText('events_24h')} events`} />
                    <BarStat label="Last 7 days" value={metric('events_7d')!} max={Math.max(metric('events_24h')!, metric('events_7d')!, 1)} hint={`${metricText('events_7d')} events`} />
                    <p className="admin-report-note">{metric('sessions_24h') === null ? 'Unique session total unavailable.' : `${metricText('sessions_24h')} unique sessions in 24 hours.`}</p>
                  </>
                ) : <AdminEmptyState title="Traffic totals unavailable" hint="No complete 24-hour and 7-day totals were returned." />}
              </div>
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2>Needs Attention</h2>
                  <span>{pendingCount === null ? 'Status unavailable' : pendingCount === 0 ? 'Queue clear' : `Showing ${attention.length} of ${pendingCount.toLocaleString()} open`}</span>
                </div>
                <div className="admin-table-wrap admin-table-wrap--stack" role="region" aria-label="Scrollable table" tabIndex={0}>
                  <table className="admin-table admin-table--stack">
                    <thead><tr><th scope="col">Student</th><th scope="col">Service</th><th scope="col">Status</th><th scope="col">Age</th><th scope="col">Action</th></tr></thead>
                    <tbody>
                      {attention.map((row) => (
                        <tr key={row.id}>
                          <td className="accent" data-label="Student">{requestStudentName(row)}</td>
                          <td data-label="Service">{row.service_catalog?.title || 'Student service'}</td>
                          <td data-label="Status"><StatusBadge status={row.status} /></td>
                          <td data-label="Age"><TimeAgo value={row.created_at} /></td>
                          <td className="right" data-label="Action"><RequestActions row={row} disabled={busyId === row.id} onAction={act} /></td>
                        </tr>
                      ))}
                      {!attention.length && <tr><td colSpan={5} className="empty-state">{pendingCount === null ? 'Queue status could not be determined.' : pendingCount === 0 ? 'Queue is clear. No active service requests.' : 'Open requests are reported, but no recent request rows were returned. Open the full queue to investigate.'}</td></tr>}
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
                    {activity && (activity.topPages.length || activity.searches || activity.serviceSubmits.length || activity.cbtStarts.length) ? (
                      <>
                        <FocusGroup title="Most viewed pages" rows={activity.topPages.map((row) => ({ label: row.path, value: row.views }))} />
                        <FocusGroup title="Searches" rows={[{ label: 'Searches performed', value: activity.searches }, { label: 'Found no result', value: activity.zeroResultSearches }]} />
                        <FocusGroup title="Most-started CBT exams" rows={activity.cbtStarts.map((row) => ({ label: row.exam, value: row.count }))} />
                        <FocusGroup title="Most-completed services" rows={activity.serviceSubmits.map((row) => ({ label: row.path, value: row.count }))} />
                        {activity.serviceViews.length > 0 && <FocusGroup title="Most-viewed services" rows={activity.serviceViews.map((row) => ({ label: row.path, value: row.views }))} />}
                      </>
                    ) : activity ? (
                      <AdminEmptyState
                        title="No usage recorded in the 14-day window"
                        hint="The activity query succeeded and returned no events for this period."
                      />
                    ) : (
                      <AdminEmptyState
                        title="Activity breakdown unavailable"
                        hint="The server did not return this activity aggregation."
                      />
                    )}
                  </div>
                </div>
                <div className="admin-card">
                  <div className="admin-card-header"><h2>Newest Accounts</h2><span>Latest sign-ups</span></div>
                  <div className="admin-account-list">
                    {recentUsers.map((u) => (
                      <div className="admin-account-item" key={String(u.id)}>
                        <div className="admin-account-id"><b>{String(u.full_name || 'Unnamed user')}</b></div>
                        <div className="admin-account-side"><StatusBadge status={String(u.role || 'student')} /><TimeAgo value={u.created_at} /></div>
                      </div>
                    ))}
                    {!recentUsers.length && <p className="empty-state" style={{ margin: 0 }}>{metric('users') === 0 ? 'No accounts have registered yet.' : metric('users') === null ? 'Account totals are unavailable.' : 'No recent account rows were returned.'}</p>}
                  </div>
                </div>
              </div>
            </div>

            {pendingCount !== null && pendingCount > attention.length && (
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
        <BarStat key={row.label} label={row.label} value={row.value} max={max} tone="green" />
      ))}
    </div>
  );
}
