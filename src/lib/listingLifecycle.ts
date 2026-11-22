/**
 * The lifecycle a scholarship listing is in, in the words the card shows.
 *
 * The database stores dates, not a status string, because a stored "Open"
 * becomes a lie the moment the deadline passes. This module derives the state
 * from `opens_at`, `deadline`, `expires_at`, `closed_at` and the editorial
 * `status` field, and the server applies the same rule to the feed. The four
 * words a student sees are the four the brief asks for: Open, Closing Soon,
 * Upcoming, Closed.
 *
 * Archive membership is a separate question: a listing is in the archive when
 * it is closed or archived, and an archived listing stays readable by direct
 * link instead of being deleted.
 */

export type ListingStatus = 'open' | 'closing-soon' | 'upcoming' | 'closed';

export type ListingLifecycleInput = {
  deadline?: string | null;
  opens_at?: string | null;
  expires_at?: string | null;
  closed_at?: string | null;
  status?: string | null;
  is_active?: boolean | null;
};

export type ListingLifecycle = {
  status: ListingStatus;
  /** The chip text: Open, Closing Soon, Upcoming or Closed. */
  label: string;
  /** A sentence for the card's detail line. */
  detail: string;
  actionable: boolean;
  /** Whole days until the deadline; null when there is no usable date. */
  daysLeft: number | null;
};

const CLOSING_SOON_DAYS = 14;

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Whole days between two ISO days (UTC), never a fractional day. */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function listingLifecycle(item: ListingLifecycleInput, now: number = Date.now()): ListingLifecycle {
  const today = new Date(now).toISOString().slice(0, 10);
  const archived = String(item.status || 'published') === 'archived' || Boolean(item.closed_at) || item.is_active === false;
  const deadline = isoDay(item.deadline);
  const opens = isoDay(item.opens_at);
  const expires = item.expires_at ? Date.parse(item.expires_at) : Number.NaN;

  if (archived) {
    return { status: 'closed', label: 'Closed', detail: deadline ? `Closed ${formatDay(deadline)}` : 'Closed', actionable: false, daysLeft: null };
  }
  if (Number.isFinite(expires) && expires <= now) {
    return { status: 'closed', label: 'Closed', detail: 'This listing has expired', actionable: false, daysLeft: null };
  }
  if (deadline && deadline < today) {
    return { status: 'closed', label: 'Closed', detail: `Closed ${formatDay(deadline)}`, actionable: false, daysLeft: null };
  }
  if (opens && opens > today) {
    return { status: 'upcoming', label: 'Upcoming', detail: `Opens ${formatDay(opens)}`, actionable: false, daysLeft: null };
  }
  if (!deadline) {
    return {
      status: 'open',
      label: 'Open',
      detail: 'No closing date listed — confirm on the provider’s page',
      actionable: true,
      daysLeft: null,
    };
  }
  const daysLeft = daysBetween(today, deadline);
  if (daysLeft <= CLOSING_SOON_DAYS) {
    return {
      status: 'closing-soon',
      label: 'Closing Soon',
      detail: daysLeft <= 0 ? `Closes ${formatDay(deadline)}` : `Closes ${formatDay(deadline)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
      actionable: true,
      daysLeft,
    };
  }
  return {
    status: 'open',
    label: 'Open',
    detail: `Closes ${formatDay(deadline)} · ${daysLeft} days left`,
    actionable: true,
    daysLeft,
  };
}

export function isArchivedListing(item: ListingLifecycleInput, now: number = Date.now()): boolean {
  return listingLifecycle(item, now).status === 'closed';
}
