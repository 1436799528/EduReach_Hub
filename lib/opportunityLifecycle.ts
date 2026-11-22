/**
 * The public state of a listing, derived from its dates with the *server's*
 * clock. A student changing their laptop date cannot make a closed scholarship
 * look open, and a deadline that passed overnight leaves the active feed
 * without anyone editing the row.
 *
 * `archived` and `scheduled` are publication states an editor chose; the other
 * three are facts about the dates. Nothing here reads a stored "open" flag,
 * because a stored flag is exactly what went stale before.
 */
export type OpportunityLifecycle = 'active' | 'upcoming' | 'expired' | 'archived' | 'scheduled';

export type OpportunityLifecycleInput = {
  status?: string | null;
  is_active?: boolean | null;
  closed_at?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  opens_at?: string | null;
  deadline?: string | null;
};

const DAY_MS = 86_400_000;

/** The calendar day in UTC, which is how the database stores date columns. */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

export function lifecycleOf(item: OpportunityLifecycleInput, now: number = Date.now()): OpportunityLifecycle {
  const status = String(item.status || 'published');
  if (status === 'archived' || item.closed_at) return 'archived';
  if (item.is_active === false) return 'archived';

  const publishedAt = item.published_at ? Date.parse(item.published_at) : Number.NaN;
  if (Number.isFinite(publishedAt) && publishedAt > now) return 'scheduled';

  const expiresAt = item.expires_at ? Date.parse(item.expires_at) : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= now) return 'expired';

  const today = new Date(now).toISOString().slice(0, 10);
  if (item.deadline && dayOf(String(item.deadline)) < today) return 'expired';
  if (item.opens_at && dayOf(String(item.opens_at)) > today) return 'upcoming';
  return 'active';
}

/**
 * Whether a row belongs in the default feed. The archive is the only scope
 * that shows expired or archived rows; a scheduled row is never shown early.
 */
export function isFeedVisible(state: OpportunityLifecycle): boolean {
  return state === 'active' || state === 'upcoming';
}

/** Whole days until the deadline, from the server clock; null when unusable. */
export function daysUntil(deadline: string | null | undefined, now: number = Date.now()): number | null {
  if (!deadline) return null;
  const parsed = Date.parse(deadline.length <= 10 ? `${deadline}T23:59:59Z` : deadline);
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil((parsed - now) / DAY_MS);
}
