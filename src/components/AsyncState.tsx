import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { classifyFailure } from '../lib/failures';

/**
 * APP-4 — the shared empty / error / loading states.
 *
 * Every list in the product used to answer "there is nothing here" and "the
 * request failed" with the same empty area, so a student could not tell a
 * genuine empty result from a broken page. These components keep that
 * distinction in one place: `EmptyState` never pretends a failure is emptiness,
 * and `ErrorState` always offers the recovery the failure actually supports.
 */

export function EmptyState({
  title,
  detail,
  action,
  icon,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="er-state er-state-empty" role="status">
      <span className="er-state-icon" aria-hidden="true">{icon ?? <Inbox size={22} />}</span>
      <div>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      {action && <div className="er-state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  action,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
}) {
  const failure = classifyFailure(error);
  return (
    <div className={compact ? 'er-state er-state-error is-compact' : 'er-state er-state-error'} role="alert">
      <span className="er-state-icon" aria-hidden="true">
        {failure.kind === 'offline' ? <WifiOff size={22} /> : <AlertTriangle size={22} />}
      </span>
      <div>
        <strong>{failure.title}</strong>
        <p>{failure.detail}</p>
      </div>
      {(onRetry && failure.retryable) || action ? (
        <div className="er-state-action">
          {onRetry && failure.retryable && (
            <button type="button" className="hub-outline-btn" onClick={onRetry}>
              <RefreshCw size={14} /> Try again
            </button>
          )}
          {action}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A non-blocking "this part of the page could not load" note, used when the rest
 * of the screen is still useful. It keeps the failure honest without replacing
 * working content with an error page.
 */
export function InlineNotice({
  tone = 'info',
  title,
  children,
  onRetry,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className={`er-inline-notice is-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {onRetry && (
        <button type="button" className="er-inline-notice-action" onClick={onRetry}>
          <RefreshCw size={13} /> Try again
        </button>
      )}
      {action}
    </div>
  );
}
