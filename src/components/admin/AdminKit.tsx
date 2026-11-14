import { API_BASE_PATH } from '../../lib/apiBase';
import { useEffect, useState, type ReactNode } from 'react';
import { Can } from './Can';
import { serviceRequestActions } from '../../lib/serviceRequestTransitions';

// Shared admin toolkit: small presentational building blocks and hooks reused
// across the admin console (dashboard, analytics, queue). Any pattern that
// appears on more than one admin page belongs here, not in a page file.

// ---------------------------------------------------------------------------
// Time display
// ---------------------------------------------------------------------------

export function relativeTime(value: unknown): string {
  const then = new Date(String(value ?? '')).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  const suffix = diff >= 0 ? 'ago' : 'from now';
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ${suffix}`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TimeAgo({ value, className }: { value: unknown; className?: string }) {
  const iso = String(value ?? '');
  const valid = Number.isFinite(new Date(iso).getTime());
  return (
    <time dateTime={iso || undefined} title={valid ? new Date(iso).toLocaleString() : undefined} className={className}>
      {relativeTime(value)}
    </time>
  );
}

// ---------------------------------------------------------------------------
// Backend health probe (GET /api/health is public and cheap)
// ---------------------------------------------------------------------------

export type AdminHealth = { state: 'checking' | 'ok' | 'down'; latencyMs: number | null };

const ADMIN_API_BASE = API_BASE_PATH;

export function useAdminHealth(intervalMs = 60_000): AdminHealth {
  const [health, setHealth] = useState<AdminHealth>({ state: 'checking', latencyMs: null });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function probe() {
      const started = Date.now();
      try {
        const response = await fetch(`${ADMIN_API_BASE}/health`, { signal: controller.signal, cache: 'no-store' });
        if (!active) return;
        if (response.ok) setHealth({ state: 'ok', latencyMs: Date.now() - started });
        else setHealth({ state: 'down', latencyMs: null });
      } catch {
        if (active) setHealth({ state: 'down', latencyMs: null });
      }
    }

    void probe();
    const timer = window.setInterval(() => { if (!document.hidden) void probe(); }, intervalMs);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [intervalMs]);

  return health;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const BADGE_LABELS: Record<string, string> = {
  awaiting_information: 'awaiting info',
  in_progress: 'in progress',
  super_admin: 'super admin',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || '').toLowerCase();
  return <span className={`status-badge ${normalized}`}>{BADGE_LABELS[normalized] || normalized || '—'}</span>;
}

// ---------------------------------------------------------------------------
// KPI metric card
// ---------------------------------------------------------------------------

export function Metric({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: string; icon?: ReactNode; tone?: 'orange' | 'green' | 'blue' | 'purple' }) {
  return (
    <div className="admin-kpi">
      <div className="admin-kpi-head">
        <span>{label}</span>
        {icon && <i className="admin-kpi-icon" aria-hidden="true">{icon}</i>}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export type AdminReportTone = 'blue' | 'green' | 'amber' | 'rose' | 'violet';

export type AdminSummaryItem = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  tone?: AdminReportTone;
};

export function AdminSummary({ label, items }: { label: string; items: AdminSummaryItem[] }) {
  return (
    <section className="admin-summary" aria-label={label}>
      {items.map((item) => (
        <div className="admin-summary-item" key={item.label}>
          <div className="admin-summary-top">
            <span className="admin-summary-label">{item.label}</span>
            {item.icon && <i className="admin-summary-icon" aria-hidden="true">{item.icon}</i>}
          </div>
          <strong className="admin-summary-value">{item.value}</strong>
          {item.detail && <small className="admin-summary-detail">{item.detail}</small>}
        </div>
      ))}
    </section>
  );
}

/** Per-page analytical report. Every admin section renders one from the rows it
 * already loaded; it never invents a trend the API did not return. */
export function AdminPageReport({
  title,
  subtitle,
  items,
  note,
}: {
  title: string;
  subtitle?: string;
  items: AdminSummaryItem[];
  note?: string;
}) {
  return (
    <section className="admin-report" aria-label={`${title} report`}>
      <div className="admin-report-head">
        <div>
          <span className="admin-report-kicker">Page analytics</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="admin-report-period">Current view</span>
      </div>
      <AdminSummary label={`${title} metrics`} items={items} />
      {note && <p className="admin-report-note">{note}</p>}
    </section>
  );
}

/** Donut built from real segments; the legend carries the numbers. */
export function AdminDonut({
  segments,
  ariaLabel,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  ariaLabel: string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="admin-donut-wrap">
      <svg className="admin-donut" viewBox="0 0 100 100" role="img" aria-label={ariaLabel}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#EEF2F6" strokeWidth="13" />
        {total > 0 && segments.map((segment) => {
          const length = (Math.max(segment.value, 0) / total) * circumference;
          const circle = (
            <circle
              key={segment.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="13"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="butt"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="50" y="47" textAnchor="middle" className="admin-donut-total">{total.toLocaleString()}</text>
        <text x="50" y="60" textAnchor="middle" className="admin-donut-caption">total</text>
      </svg>
      <ul className="admin-donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <i style={{ background: segment.color }} aria-hidden="true" />
            <span>{segment.label}</span>
            <b>{segment.value.toLocaleString()}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminCountBadge({ count, label }: { count: number; label: string }) {
  if (!Number.isFinite(count) || count <= 0) return null;
  return <span className="admin-count-badge" aria-label={`${count} ${label}`}>{count.toLocaleString()}</span>;
}

export type AdminStatus = 'live' | 'healthy' | 'attention' | 'error' | 'pending' | 'inactive';

export function AdminStatusDot({ status, label, detail }: { status: AdminStatus; label: string; detail?: string }) {
  const description = detail ? `${label}: ${detail}` : label;
  return (
    <span className={`admin-status-dot ${status}`} role="img" aria-label={description} title={description} tabIndex={0}>
      <i aria-hidden="true" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Service request status actions (single source of truth for Dashboard + Queue)
// ---------------------------------------------------------------------------

export const ACTIVE_REQUEST_STATUSES = ['submitted', 'reviewing', 'processing', 'awaiting_information'];

export function requestStudentName(row: { form_data?: Record<string, unknown>; user_id: string }): string {
  const name = row.form_data?.fullName || row.form_data?.name;
  return String(name || `student ${(row.user_id || '').slice(0, 8)}`);
}

export function RequestActions({ row, disabled, onAction }: {
  row: { id: string; status: string; updated_at: string };
  disabled?: boolean;
  onAction: (requestId: string, nextStatus: string, expectedUpdatedAt: string) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const transitions = serviceRequestActions(row.status);

  async function run(next: string) {
    if (disabled || busy) return;
    if (next === 'rejected' && !window.confirm('Reject this request? The student will see it as rejected in their dashboard.')) return;
    setBusy(true);
    try { await onAction(row.id, next, row.updated_at); } finally { setBusy(false); }
  }

  if (!transitions.length) return <span className="muted">No action</span>;
  // Processing a request is `service_request.process`; without it the console
  // shows the status as read-only (the API refuses the call regardless).
  return (
    <Can capability="service_request.process" fallback={<span className="muted">Read only</span>}>
      <div className="admin-action-row">
        {transitions.map((t) => (
          <button
            key={t.next}
            type="button"
            className={`admin-btn small ${t.kind || ''}`}
            disabled={disabled || busy}
            onClick={() => void run(t.next)}
          >
            {busy ? '…' : t.label}
          </button>
        ))}
      </div>
    </Can>
  );
}

// ---------------------------------------------------------------------------
// Staff audit timeline
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  status_change: 'Request status changed',
  create: 'Record created',
  update: 'Record updated',
  delete: 'Record deleted',
  news_create: 'News article published',
  news_update: 'News article updated',
  news_delete: 'News article deleted',
};

const ENTITY_LABELS: Record<string, string> = {
  service_request: 'service request',
  cbt_exam: 'CBT exam',
  exam_question: 'CBT question',
  news_article: 'news article',
};

export function AuditTimeline({ items, emptyText = 'No staff activity recorded yet.' }: {
  items: Array<Record<string, unknown>>;
  emptyText?: string;
}) {
  if (!items.length) return <p className="empty-state" style={{ margin: 0 }}>{emptyText}</p>;
  return (
    <ul className="admin-timeline">
      {items.map((item, index) => {
        const action = String(item.action || 'event');
        const entity = String(item.entity_type || '');
        const metadata = (item.metadata && typeof item.metadata === 'object') ? item.metadata as Record<string, unknown> : {};
        const detail = [metadata.from ? `${String(metadata.from)} → ${String(metadata.to)}` : '', String(metadata.title || metadata.slug || '')].filter(Boolean).join(' · ');
        return (
          <li key={String(item.id || index)}>
            <div className="t-action">{ACTION_LABELS[action] || action.replace(/_/g, ' ')}</div>
            <div className="t-meta">
              {ENTITY_LABELS[entity] || entity}
              {detail ? `: ${detail}` : ''}
              {' · '}
              <TimeAgo value={item.created_at} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Simple horizontal stat bar (no chart library; pure CSS)
// ---------------------------------------------------------------------------

export function BarStat({ label, value, max, hint, tone = 'orange' }: { label: string; value: number; max: number; hint?: string; tone?: 'orange' | 'green' | 'blue' }) {
  const safeMax = max > 0 ? max : 1;
  const pct = value <= 0 ? 0 : Math.max(2, Math.min(100, Math.round((value / safeMax) * 100)));
  const accessibleValue = hint ?? value.toLocaleString();
  return (
    <div className="admin-bar-row">
      <div className="admin-bar-top">
        <span>{label}</span>
        <b>{accessibleValue}</b>
      </div>
      <div className="admin-bar-track" role="img" aria-label={`${label}: ${accessibleValue}`} title={`${label}: ${accessibleValue}`}>
        <div className={`admin-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="admin-kpi-grid">
      {Array.from({ length: count }, (_, i) => <div key={i} className="admin-skel admin-skel-kpi" aria-hidden="true" />)}
    </div>
  );
}

export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: '8px 14px 14px' }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="admin-skel admin-skel-row" />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (spec rule: show "No data yet", never fake data)
// ---------------------------------------------------------------------------

export function AdminEmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="admin-empty">
      <b>{title}</b>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function SectionLabel({ live }: { live?: boolean }) {
  return (
    <span className={`admin-section-label ${live ? 'live' : ''}`}>
      <i /> {live ? 'Live now' : 'Last 14 days'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table loading skeleton - same shimmer system as the public site so admin
// tables hold their shape while loading instead of showing "Loading…" text.
// ---------------------------------------------------------------------------

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex} className="admin-skel-cell">
              <div
                className="admin-skel admin-skel-line"
                style={{ width: colIndex === 0 ? '55%' : colIndex === columns - 1 ? '70%' : '38%' }}
              />
            </td>
          ))}
        </tr>
      ))}
      <tr>
        <td colSpan={columns} style={{ border: 0 }}>
          <span className="er-visually-hidden">Loading…</span>
        </td>
      </tr>
    </>
  );
}
