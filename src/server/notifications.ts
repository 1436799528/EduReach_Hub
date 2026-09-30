/**
 * Student-facing notifications.
 *
 * The notification store (`student_notifications`) existed with indexes, RLS and
 * client helpers but nothing ever wrote to it, so a service request could change
 * status without the student ever knowing. This module is the writer for the
 * highest-value event: a real status transition.
 *
 * Copy lives here rather than in SQL so it is type-checked, reviewable and
 * testable without a database. See docs/features/NTF-1.md.
 */

export interface ServiceRequestForNotification {
  id: string;
  user_id: string;
  status: string;
  reference_code?: string | null;
  service_catalog?: { title?: string | null } | Array<{ title?: string | null }> | null;
}

export interface NotificationRecord {
  title: string;
  body: string;
  notification_type: string;
  href: string;
  metadata: Record<string, unknown>;
}

interface StatusCopy {
  title: string;
  body: string;
}

/**
 * Student-facing copy for every status in the request workflow
 * (`20260925214000_service_request_statuses.sql`). Internal vocabulary, officer
 * identities and the internal admin note never appear here.
 */
export const STATUS_NOTIFICATION_COPY: Record<string, StatusCopy> = {
  submitted: {
    title: 'Request received',
    body: 'We received your request and it is waiting for a student services officer to review it.',
  },
  reviewing: {
    title: 'Your request is being reviewed',
    body: 'A student services officer has started reviewing your request.',
  },
  processing: {
    title: 'Your request is being processed',
    body: 'Your request is now being processed. You can follow each update from your dashboard.',
  },
  awaiting_information: {
    title: 'We need more information',
    body: 'Open your request to see what is missing and reply so we can continue.',
  },
  completed: {
    title: 'Your request is complete',
    body: 'The work on your request is finished. Open it to see the outcome.',
  },
  closed: {
    title: 'Your request is closed',
    body: 'This request has been closed. Open a new one any time you need help again.',
  },
  rejected: {
    title: 'Your request was not approved',
    body: 'This request was declined. Open it for the current state, or start a new request if your situation changes.',
  },
  cancelled: {
    title: 'Your request was cancelled',
    body: 'This request was cancelled. You can submit a new request whenever you need to.',
  },
};

/** The title of the service the request belongs to, when the join returned it. */
export function serviceTitleFor(request: ServiceRequestForNotification): string {
  const catalog = request.service_catalog;
  const row = Array.isArray(catalog) ? catalog[0] : catalog;
  const title = String(row?.title || '').trim();
  return title || 'Student service request';
}

/**
 * Build the notification for a status transition.
 *
 * Returns null for a no-op transition (same status) or an unknown status, so a
 * caller can never notify about something the workflow does not define.
 */
export function notificationForStatus(
  request: ServiceRequestForNotification,
  nextStatus: string,
): NotificationRecord | null {
  const to = String(nextStatus || '').trim();
  const copy = STATUS_NOTIFICATION_COPY[to];
  if (!copy || to === String(request.status || '').trim()) return null;

  const service = serviceTitleFor(request);
  const reference = String(request.reference_code || '').trim();
  const href = reference
    ? `/dashboard/services?ref=${encodeURIComponent(reference)}`
    : '/dashboard/services';

  return {
    title: copy.title,
    body: `${service}${reference ? ` (${reference})` : ''}: ${copy.body}`,
    notification_type: 'service_request',
    href,
    metadata: {
      request_id: request.id,
      reference_code: reference || null,
      from: String(request.status || ''),
      to,
    },
  };
}

interface MinimalClient {
  from(table: string): any;
}

/**
 * Write the notification for a status change.
 *
 * Idempotent per (request, status): a repeated transition to a status the student
 * has already been told about does not write a second row. Best effort: a failure
 * is logged and reported, and never turns a successful status change into a
 * failed request.
 */
export async function notifyServiceRequestStatus(
  supabase: MinimalClient,
  options: { request: ServiceRequestForNotification; from: string; to: string },
): Promise<{ sent: boolean; reason?: string }> {
  const { request, from, to } = options;
  const notification = notificationForStatus({ ...request, status: from }, to);
  if (!notification) return { sent: false, reason: 'no-op or unknown status' };

  try {
    const existing = await supabase
      .from('student_notifications')
      .select('id')
      .eq('user_id', request.user_id)
      .eq('notification_type', notification.notification_type)
      .contains('metadata', { request_id: request.id, to })
      .limit(1);

    if (existing?.error) return { sent: false, reason: 'lookup failed' };
    if (Array.isArray(existing?.data) && existing.data.length > 0) {
      return { sent: false, reason: 'already notified' };
    }

    const { error } = await supabase.from('student_notifications').insert({
      user_id: request.user_id,
      title: notification.title,
      body: notification.body,
      notification_type: notification.notification_type,
      href: notification.href,
      metadata: notification.metadata,
    });
    if (error) {
      console.error('Service status notification failed:', error);
      return { sent: false, reason: 'insert failed' };
    }
    return { sent: true };
  } catch (error) {
    console.error('Service status notification failed:', error);
    return { sent: false, reason: 'unexpected error' };
  }
}
