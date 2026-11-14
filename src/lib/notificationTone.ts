/**
 * UI-5 — one meaning per notification.
 *
 * The panel has to distinguish read from unread, and ordinary information from
 * something that needs the student's attention. Those are two different
 * questions, so they are two different helpers:
 *
 *   - `read` already exists on the record and is rendered as the dot/weight;
 *   - `notificationTone` classifies the event itself, using the service status
 *     NTF-1 stores in metadata when it is available.
 *
 * A notification is never coloured just because it exists. An unknown type is
 * neutral information, which is the safe default.
 */

export type NotificationTone = 'success' | 'warning' | 'danger' | 'info';

export type NotificationLike = {
  type?: string | null;
  status?: string | null;
  title?: string | null;
  body?: string | null;
};

const SUCCESS_STATUSES = new Set(['completed', 'closed']);
const DANGER_STATUSES = new Set(['rejected', 'cancelled']);
const WARNING_STATUSES = new Set(['awaiting_information', 'processing', 'reviewing']);

export function notificationTone(notification: NotificationLike): NotificationTone {
  const status = String(notification.status || '').trim().toLowerCase();
  if (DANGER_STATUSES.has(status)) return 'danger';
  if (WARNING_STATUSES.has(status)) return 'warning';
  if (SUCCESS_STATUSES.has(status)) return 'success';

  // Some events have no service status (profile saved, result available). Read
  // the type first; only then fall back to the words, and only for a small,
  // explicit vocabulary rather than guesswork.
  const type = String(notification.type || '').trim().toLowerCase();
  if (/error|failed|rejected|cancelled/.test(type)) return 'danger';
  if (/warning|attention|action/.test(type)) return 'warning';
  if (/success|completed|ready/.test(type)) return 'success';

  const copy = `${notification.title || ''} ${notification.body || ''}`.toLowerCase();
  if (/could not|failed|not saved|not available/.test(copy)) return 'danger';
  if (/needs your|required|expires|overdue/.test(copy)) return 'warning';
  if (/saved|available|completed|confirmed/.test(copy)) return 'success';
  return 'info';
}

export function notificationNeedsAction(notification: NotificationLike): boolean {
  return String(notification.status || '').trim().toLowerCase() === 'awaiting_information';
}

/** A short, student-facing category label. It is not the raw status code. */
export function notificationCategory(notification: NotificationLike): string {
  if (notificationNeedsAction(notification)) return 'Action required';
  const tone = notificationTone(notification);
  if (tone === 'danger') return 'Needs attention';
  if (tone === 'warning') return 'In progress';
  if (tone === 'success') return 'Update';
  return 'Information';
}
