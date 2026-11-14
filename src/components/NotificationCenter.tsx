import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  fetchNotificationsWithStatus,
  markNotificationRead,
  markNotificationsRead,
  type NotificationLoad,
} from '../lib/studentDashboard';
import {
  notificationCategory,
  notificationNeedsAction,
  notificationTone,
  type NotificationTone,
} from '../lib/notificationTone';
import { SkeletonRows } from './Skeleton';

/**
 * UI-5 — the notification centre.
 *
 * A quiet bell in the header, a neutral panel, and one small unread count. The
 * panel answers three questions without shouting: is there anything new, what
 * happened, and does it need me? Unread is a dot and weight; importance is an
 * icon colour and a short category label. Nothing gets a coloured card simply
 * for existing.
 *
 * The bell is only rendered for a real signed-in account. A local preview has no
 * notification store, so it shows no bell rather than a permanently empty one.
 */
export default function NotificationCenter({ variant = 'site' }: { variant?: 'site' | 'dashboard' }) {
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated && user && !user.isLocal ? user.id : '';
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<NotificationLoad | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `er-notif-panel-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setLoad(await fetchNotificationsWithStatus(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // A count on a closed bell is the whole point of a bell, so the first load
  // happens without waiting for a click. It re-runs only when the account does.
  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const items = load?.items || [];
  const unread = items.filter((item) => !item.read).length;
  const failed = Boolean(load?.error);

  /**
   * UX-6: opening the panel never marks everything read. The unread count is a
   * promise that those items still need attention; a bulk write happens only
   * through the explicit control below. The write is optimistic but
   * reconciled: a failure restores the previous list and shows the error.
   */
  const markAllRead = useCallback(async () => {
    if (!userId || marking || unread === 0) return;
    const previous = load;
    setMarkError('');
    setMarking(true);
    setLoad({ items: items.map((item) => ({ ...item, read: true })), error: false });
    try {
      await markNotificationsRead(userId);
    } catch {
      setLoad(previous);
      setMarkError('Notifications could not be marked as read. Try again.');
    } finally {
      setMarking(false);
    }
  }, [userId, marking, unread, load, items]);


  /**
   * If the bulk write failed, opening one unread row can still record that one
   * read. It is optimistic with the same rollback contract as mark-all-read.
   */
  const markOneRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const previous = load;
    const target = (previous?.items || []).find((item) => item.id === notificationId);
    if (!target || target.read) return;
    setLoad((current) => current ? { ...current, items: current.items.map((item) => item.id === notificationId ? { ...item, read: true } : item) } : current);
    setMarkError('');
    try {
      await markNotificationRead(userId, notificationId);
    } catch {
      setLoad(previous);
      setMarkError('That notification could not be marked as read. Try again.');
    }
  }, [userId, load]);
  if (!userId) return null;

  return (
    <div className={`er-notif er-notif--${variant}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="er-notif-trigger"
        aria-label={
          failed
            ? `Notifications, ${unread ? `${unread} unread, ` : ''}could not check for updates`
            : unread ? `Notifications, ${unread} unread` : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={17} aria-hidden="true" />
        {failed && (
          <>
            <span className="er-notif-alert" aria-hidden="true" />
            <span className="er-visually-hidden">Could not check for updates</span>
          </>
        )}
        {unread > 0 && (
          <>
            <span className="er-notif-unread-dot" aria-hidden="true" />
            <span className="er-visually-hidden">{unread} unread</span>
          </>
        )}
      </button>

      {open && (
        <div id={panelId} className="er-notif-panel" role="dialog" aria-label="Notifications">
          <header className="er-notif-header">
            <div>
              <h2>Notifications</h2>
              <p>{failed ? 'Could not check for updates' : loading && !load ? 'Checking for updates…' : unread ? `${unread} unread` : 'You are up to date'}</p>
            </div>
            {unread > 0 && !failed && (
              <button type="button" className="er-notif-mark" onClick={() => void markAllRead()} disabled={marking}>
                {marking ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </header>

          <div className="er-notif-body">
            {loading && !load ? (
              <SkeletonRows rows={3} label="Loading notifications" />
            ) : failed && !items.length ? (
              <div className="er-notif-empty" role="alert">
                <p>Notifications could not be loaded. Your account is still signed in.</p>
                <button type="button" className="er-notif-retry" onClick={() => void refresh()}>
                  <RefreshCw size={13} /> Try again
                </button>
              </div>
            ) : items.length ? (
              <ul className="er-notif-list">
                {items.slice(0, 8).map((item) => {
                  const tone = notificationTone(item);
                  const content = (
                    <>
                      <span className={`er-notif-icon is-${tone}`} aria-hidden="true">
                        {tone === 'success' ? <CheckCircle2 size={15} />
                          : tone === 'danger' ? <AlertTriangle size={15} />
                          : tone === 'warning' ? <AlertTriangle size={15} />
                          : <Info size={15} />}
                      </span>
                      <span className="er-notif-copy">
                        <strong>
                          {!item.read && <span className="er-notif-dot" role="img" aria-label="Unread" />}
                          {item.title}
                        </strong>
                        {item.body && <span className="er-notif-detail">{item.body}</span>}
                        <small>
                          {item.time}
                          <span className={`er-notif-category is-${tone}`}>{notificationCategory(item)}</span>
                          {notificationNeedsAction(item) && <span className="er-visually-hidden"> — action required</span>}
                        </small>
                      </span>
                    </>
                  );
                  return (
                    <li key={item.id} className={item.read ? undefined : 'is-unread'}>
                      {item.href ? (
                        <a className="er-notif-row" href={item.href} onClick={() => { if (!item.read) void markOneRead(item.id); setOpen(false); }}>
                          {content}
                        </a>
                      ) : (
                        <div
                          className="er-notif-row"
                          role={item.read ? undefined : 'button'}
                          tabIndex={item.read ? undefined : 0}
                          onClick={item.read ? undefined : () => void markOneRead(item.id)}
                          onKeyDown={item.read ? undefined : (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              void markOneRead(item.id);
                            }
                          }}
                        >{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="er-notif-empty">
                Nothing yet. When a service request changes status, it appears here.
              </p>
            )}
            {markError && <p className="er-notif-error" role="status">{markError}</p>}
            {failed && items.length > 0 && (
              <p className="er-notif-error" role="status">Showing the last loaded list; refresh to check again.</p>
            )}
          </div>

          <footer className="er-notif-footer">
            <a href="/dashboard/notifications" onClick={() => setOpen(false)}>Open notification centre</a>
          </footer>
        </div>
      )}
    </div>
  );
}

/** Shared by the panel and tests: the icon tone is the only colour meaning. */
export const NOTIFICATION_TONE_ICON: Record<NotificationTone, string> = {
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  info: 'info',
};
