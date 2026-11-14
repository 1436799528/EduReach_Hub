import { userFacingError } from '../lib/errors';
import { useEffect, useState } from 'react';
import { fetchAdminAnalytics, fetchAdminScheduledJobStatus, type AdminScheduledJobStatus } from '../src/lib/api';
import { AdminDonut, AdminEmptyState, AdminStatusDot, AdminSummary, AuditTimeline, BarStat, SectionLabel, StatusBadge, TimeAgo } from '../src/components/admin/AdminKit';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminAnalytics>> | null>(null);
  const [jobs, setJobs] = useState<AdminScheduledJobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobsError, setJobsError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    setJobsError('');
    const [analyticsResult, jobsResult] = await Promise.allSettled([
      fetchAdminAnalytics(),
      fetchAdminScheduledJobStatus(),
    ]);
    if (analyticsResult.status === 'fulfilled') setData(analyticsResult.value);
    else {
      setData(null);
      setError(userFacingError(analyticsResult.reason, 'Unable to load analytics.'));
    }
    if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value);
    else {
      setJobs(null);
      setJobsError(userFacingError(jobsResult.reason, 'Scheduled job status is unavailable.'));
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const m = data?.metrics || {};
  const metric = (key: string): number | null => {
    const value = m[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const metricText = (key: string): string => {
    const value = metric(key);
    return value === null ? 'Unavailable' : value.toLocaleString();
  };

  // Queue composition bars - derived from server metrics, never invented client-side.
  const pending = metric('pending_requests');
  const completed = metric('completed_requests');
  const rejected = metric('rejected_requests');
  const totalRequests = metric('service_requests');
  const queueDataAvailable = pending !== null && completed !== null && rejected !== null && totalRequests !== null;
  const otherRequests = queueDataAvailable ? Math.max(totalRequests - pending - completed - rejected, 0) : null;
  const events24 = metric('events_24h');
  const events7 = metric('events_7d');
  const submittedAttempts = metric('cbt_submitted');
  const averageScore = submittedAttempts === 0 || submittedAttempts === null || metric('average_cbt_score') === null
    ? 'Unavailable'
    : `${metricText('average_cbt_score')}%`;
  const activityHasData = Boolean(data?.activity && (
    data.activity.topPages.length
    || data.activity.searches
    || data.activity.serviceViews.length
    || data.activity.serviceSubmits.length
    || data.activity.cbtStarts.length
    || data.activity.eventsTotal
  ));

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div><h1>Analytics &amp; Reports</h1><p>Recorded platform activity and operational health. Missing data is shown as unavailable, not zero.</p></div>
          <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {error && <div className="admin-card" role="alert"><p className="empty-state">{error}</p></div>}

        {loading ? <div className="admin-summary admin-summary-loading" aria-label="Loading analytics summary">{Array.from({ length: 6 }, (_, index) => <span className="admin-skel admin-skel-line" key={index} aria-hidden="true" />)}</div> : data && (
          <AdminSummary
            label="Analytics summary"
            items={[
              { label: 'Registered users', value: metricText('users'), detail: metric('admins') === null ? 'Administrator count unavailable' : `${metricText('admins')} administrators`, tone: 'blue' as const },
              { label: 'Open requests', value: metricText('pending_requests'), detail: totalRequests === null ? 'Total request count unavailable' : `${metricText('service_requests')} all-time requests`, tone: 'amber' as const },
              { label: 'Completed requests', value: metricText('completed_requests'), detail: metric('rejected_requests') === null ? 'Rejected/cancelled count unavailable' : `${metricText('rejected_requests')} rejected or cancelled`, tone: 'green' as const },
              { label: 'Events · 24h', value: metricText('events_24h'), detail: metric('sessions_24h') === null ? 'Unique sessions unavailable' : `${metricText('sessions_24h')} unique sessions`, tone: 'violet' as const },
              { label: 'CBT attempts', value: metricText('cbt_attempts'), detail: submittedAttempts === null ? 'Submitted count unavailable' : `${metricText('cbt_submitted')} submitted`, tone: 'blue' as const },
              { label: 'Average submitted score', value: averageScore, detail: submittedAttempts === null ? 'Submission count unavailable' : submittedAttempts === 0 ? 'No submitted attempts' : 'Across submitted attempts', tone: 'green' as const },
            ]}
          />
        )}

        {data && (
          <>
            <p className="admin-data-note">
              Daily trend lines, active or returning-user totals, CBT completion time, subject-level performance and score distributions are not supplied by the current analytics API; comparisons are omitted.
            </p>
            <div className="admin-chart-grid">
              <div className="admin-chart-card">
                <div className="admin-chart-head"><div><h2>Service queue composition</h2><p>Every request status the analytics API returns.</p></div><span className="admin-report-period">All-time</span></div>
                {queueDataAvailable ? (
                  <AdminDonut
                    ariaLabel="Service queue composition by status"
                    segments={[
                      { label: 'Open', value: pending || 0, color: '#0A3E83' },
                      { label: 'Completed', value: completed || 0, color: '#067647' },
                      { label: 'Rejected / cancelled', value: rejected || 0, color: '#B42318' },
                      { label: 'Closed / other', value: otherRequests || 0, color: '#98A2B3' },
                    ].filter((segment) => segment.value > 0)}
                  />
                ) : <AdminEmptyState title="Queue distribution unavailable" hint="The analytics response does not include all service-request totals, so no distribution is calculated." />}
              </div>

              <div className="admin-chart-card">
                <div className="admin-chart-head"><div><h2>Application traffic</h2><p>Tracked events, not extrapolated.</p></div></div>
                {events24 !== null && events7 !== null ? (
                  <>
                    <BarStat label="Last 24 hours" value={events24} max={Math.max(events24, events7, 1)} hint={`${events24.toLocaleString()} events`} />
                    <BarStat label="Last 7 days" value={events7} max={Math.max(events24, events7, 1)} hint={`${events7.toLocaleString()} events`} />
                    <p className="admin-report-note">
                      {metric('sessions_24h') === null ? 'Unique sessions unavailable' : `${metricText('sessions_24h')} unique sessions in 24 hours`}
                      {' · '}
                      {metric('audit_events') === null ? 'Audit event total unavailable.' : `${metricText('audit_events')} audit events recorded.`}
                    </p>
                  </>
                ) : <AdminEmptyState title="Traffic totals unavailable" hint="The analytics response has no complete 24-hour and 7-day event totals." />}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header"><h2>Where attention is going <SectionLabel /></h2><span>Real recorded events</span></div>
              <div className="admin-focus-body">
                {data?.activity && activityHasData ? (
                  <>
                    <div className="admin-focus-group"><h3>Most viewed pages</h3>{data.activity.topPages.slice(0, 6).map((row) => <BarStat key={row.path} label={row.path} value={row.views} max={data.activity!.topPages[0].views} tone="orange" />)}</div>
                    <div className="admin-focus-group">
                      <h3>Searches</h3>
                      <BarStat label="Searches performed" value={data.activity.searches} max={Math.max(data.activity.searches, 1)} />
                      <BarStat label="Found no result" value={data.activity.zeroResultSearches} max={Math.max(data.activity.searches, 1)} />
                      <p className="admin-footnote">Search terms are not collected, only how many searches happened and how many found nothing. That is what this panel is for.</p>
                    </div>
                    <div className="admin-focus-group"><h3>Most-started CBT exams</h3>{data.activity.cbtStarts.length ? data.activity.cbtStarts.slice(0, 6).map((row) => <BarStat key={row.exam} label={row.exam} value={row.count} max={data.activity!.cbtStarts[0].count} tone="green" />) : <p className="admin-footnote">No CBT attempts recorded yet.</p>}</div>
                    <div className="admin-focus-group"><h3>Service funnels (views → submissions)</h3>
                      {data.activity.serviceViews.length ? data.activity.serviceViews.slice(0, 6).map((row) => {
                        const submits = data.activity!.serviceSubmits.find((s) => s.path === row.path)?.count || 0;
                        return <BarStat key={row.path} label={row.path} value={row.views} max={data.activity!.serviceViews[0].views} hint={`${row.views} views · ${submits} submitted`} tone="orange" />;
                      }) : <p className="admin-footnote">No service views recorded yet.</p>}
                    </div>
                    <p className="admin-footnote">{data.activity.eventsTotal} events recorded since {new Date(data.activity.since).toLocaleDateString()}.</p>
                  </>
                ) : data?.activity ? (
                  <AdminEmptyState title="No usage recorded in the 14-day window" hint="The activity query succeeded and returned no events for this period." />
                ) : (
                  <AdminEmptyState title="Activity breakdown unavailable" hint="The server did not return the activity aggregation. This is different from a zero-activity result." />
                )}
              </div>
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <div className="admin-card-header"><h2>Recent Staff Activity</h2><span>Audit trail</span></div>
                <AuditTimeline items={data?.audit || []} />
              </div>

              <div className="admin-card">
                <div className="admin-card-header"><h2>Recent Service Activity</h2><span>Latest 10</span></div>
                <div className="admin-table-wrap" role="region" aria-label="Scrollable table" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">Reference</th><th scope="col">Service</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>
                  {(data?.recentRequests || []).map((r) => <tr key={String(r.id)}><td className="mono accent">{String(r.reference_code || String(r.id).slice(0, 8))}</td><td>{r.service_catalog?.title || 'Service'}</td><td><StatusBadge status={String(r.status)} /></td><td><TimeAgo value={r.created_at} /></td></tr>)}
                  {!data?.recentRequests?.length && <tr><td colSpan={4} className="empty-state">No service activity yet.</td></tr>}
                </tbody></table></div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header"><h2>Recent Accounts</h2><span>Latest 10</span></div>
              <div className="admin-table-wrap" role="region" aria-label="Scrollable table" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Joined</th></tr></thead><tbody>
                {(data?.recentUsers || []).map((u) => <tr key={String(u.id)}><td>{String(u.full_name || 'Unnamed user')}</td><td><StatusBadge status={String(u.role || 'student')} /></td><td><TimeAgo value={u.created_at} /></td></tr>)}
                {!data?.recentUsers?.length && <tr><td colSpan={3} className="empty-state">No accounts yet.</td></tr>}
              </tbody></table></div>
            </div>

            <div className="admin-card">
              <div className="admin-card-header">
                <h2>Scheduled Job Health</h2>
                {jobs && <span className="admin-job-health">
                  <AdminStatusDot
                    status={jobs.health.ok ? 'healthy' : 'attention'}
                    label={jobs.health.ok ? 'Expected scheduled jobs are healthy' : 'One or more scheduled jobs need attention'}
                  />
                  {jobs.health.ok ? 'Healthy' : 'Needs attention'}
                </span>}
              </div>
              {jobsError && <p className="admin-job-error" role="alert">{jobsError}</p>}
              {jobs && (
                <>
                  <p className="admin-footnote admin-job-note">Freshness window: {jobs.sinceHours} hours. This reports scheduled jobs only; it does not certify database, authentication or all API features.</p>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Last success</th><th scope="col">Recorded failures</th></tr></thead>
                      <tbody>
                        {jobs.jobs.map((job) => {
                          const needsAttention = jobs.health.stale.includes(job.job_name) || jobs.health.failing.includes(job.job_name);
                          const state = needsAttention ? 'Attention' : job.fresh ? 'Fresh' : 'Stale';
                          return (
                            <tr key={job.job_name}>
                              <td>{job.job_name}</td>
                              <td><span className="admin-job-status"><AdminStatusDot status={needsAttention ? 'attention' : job.fresh ? 'healthy' : 'pending'} label={`${job.job_name}: ${state}`} />{state}</span></td>
                              <td>{job.last_success_at ? <TimeAgo value={job.last_success_at} /> : 'No successful run recorded'}</td>
                              <td>{job.failures.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                        {jobs.health.missing.map((name) => (
                          <tr key={`missing-${name}`}>
                            <td>{name}</td>
                            <td><span className="admin-job-status"><AdminStatusDot status="attention" label={`${name}: no run recorded in the freshness window`} />Missing run</span></td>
                            <td>No successful run recorded</td>
                            <td>Unavailable</td>
                          </tr>
                        ))}
                        {!jobs.jobs.length && !jobs.health.missing.length && <tr><td colSpan={4} className="empty-state">No scheduled job information returned.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!jobs && !jobsError && !loading && <AdminEmptyState title="Job health unavailable" hint="The server did not return scheduled-job status." />}
            </div>
          </>
        )}
      </div>
  );
}
