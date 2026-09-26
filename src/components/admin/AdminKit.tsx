import { useEffect, useState, type ReactNode } from 'react';

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

export function useAdminHealth(intervalMs = 60_000): AdminHealth {
  const [health, setHealth] = useState<AdminHealth>({ state: 'checking', latencyMs: null });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function probe() {
      const started = Date.now();
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
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

export function Metric({ label, value, detail, icon, tone }: { label: string; value: ReactNode; detail?: string; icon?: ReactNode; tone?: 'orange' | 'green' | 'blue' | 'purple' }) {
  return (
    <div className="admin-kpi">
      {(icon || tone) && (
        <div className="admin-kpi-head">
          <span>{label}</span>
          {icon && <i className={`admin-kpi-icon ${tone ? tone : ''}`}>{icon}</i>}
        </div>
      )}
      {!(icon || tone) && <span>{label}</span>}
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service request status actions (single source of truth for Dashboard + Queue)
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<string, Array<{ label: string; next: string; kind?: 'success' | 'danger' }>> = {
  submitted: [
    { label: 'Review', next: 'reviewing' },
    { label: 'Process', next: 'processing' },
    { label: 'Complete', next: 'completed', kind: 'success' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  reviewing: [
    { label: 'Process', next: 'processing' },
    { label: 'Need info', next: 'awaiting_information' },
    { label: 'Complete', next: 'completed', kind: 'success' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  processing: [
    { label: 'Need info', next: 'awaiting_information' },
    { label: 'Complete', next: 'completed', kind: 'success' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  awaiting_information: [
    { label: 'Complete', next: 'completed', kind: 'success' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  completed: [{ label: 'Close', next: 'closed' }],
};

export const ACTIVE_REQUEST_STATUSES = ['submitted', 'reviewing', 'processing', 'awaiting_information'];

export function requestStudentName(row: { form_data?: Record<string, unknown>; user_id: string }): string {
  const name = row.form_data?.fullName || row.form_data?.name;
  return String(name || `student ${(row.user_id || '').slice(0, 8)}`);
}

export function RequestActions({ row, disabled, onAction }: {
  row: { id: string; status: string };
  disabled?: boolean;
  onAction: (requestId: string, nextStatus: string) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const transitions = TRANSITIONS[row.status] || [];

  async function run(next: string) {
    if (disabled || busy) return;
    if (next === 'rejected' && !window.confirm('Reject this request? The student will see it as rejected in their dashboard.')) return;
    setBusy(true);
    try { await onAction(row.id, next); } finally { setBusy(false); }
  }

  if (!transitions.length) return <span className="muted">No action</span>;
  return (
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
              {detail ? ` — ${detail}` : ''}
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
  const pct = Math.max(2, Math.min(100, Math.round((value / safeMax) * 100)));
  return (
    <div className="admin-bar-row">
      <div className="admin-bar-top">
        <span>{label}</span>
        <b>{hint ?? value}</b>
      </div>
      <div className="admin-bar-track" role="img" aria-label={`${label}: ${hint ?? value}`}>
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
// Honest empty state (spec rule: show "No data yet", never fake data)
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
