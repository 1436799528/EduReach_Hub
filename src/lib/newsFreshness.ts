/**
 * NEWS-2 — how old is this story, and was it checked?
 *
 * The newsroom pipeline already stores `verification_status`, `last_verified_at`
 * and `expires_at`, and the article page uses them. The list rows did not, so a
 * two-month-old admission notice read exactly like one checked this morning.
 * This module is the single rule for both surfaces.
 *
 * Four states, because three of them need different words:
 *
 *   fresh       checked recently, nothing says it has passed
 *   stale       checked, but not recently — still shown, with the date
 *   expired     superseded or past its own expiry — shown last, clearly marked
 *   unverified  no record of a check ever being made
 */

export type NewsFreshnessInput = {
  verification_status?: string | null;
  last_verified_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
};

export type NewsFreshnessState = 'fresh' | 'stale' | 'expired' | 'unverified';

export type NewsFreshness = {
  state: NewsFreshnessState;
  label: string;
  /** The date a student can see, or null when no check is recorded. */
  checkedOn: string | null;
  /** True when the story may still be described as current. */
  current: boolean;
};

/** A verified story older than this reads as stale rather than current. */
const STALE_AFTER_DAYS = 60;

const NOT_CURRENT_STATUSES = new Set(['expired', 'archived', 'superseded']);

export function newsFreshness(item: NewsFreshnessInput, now: number = Date.now()): NewsFreshness {
  const status = String(item.verification_status || '').toLowerCase();
  const checkedOn = item.last_verified_at || item.updated_at || null;
  const checkedAt = checkedOn ? new Date(checkedOn).getTime() : Number.NaN;
  const expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : Number.NaN;

  const expiredByDate = Number.isFinite(expiresAt) && expiresAt <= now;
  if (NOT_CURRENT_STATUSES.has(status) || expiredByDate) {
    return {
      state: 'expired',
      label: status === 'superseded' ? 'Replaced by a newer update' : 'No longer current',
      checkedOn,
      current: false,
    };
  }

  if (!Number.isFinite(checkedAt)) {
    return { state: 'unverified', label: 'Not checked yet', checkedOn: null, current: true };
  }

  const ageDays = (now - checkedAt) / 86_400_000;
  if (ageDays > STALE_AFTER_DAYS) {
    return { state: 'stale', label: 'Checked a while ago', checkedOn, current: true };
  }
  return { state: 'fresh', label: 'Checked by EduReach', checkedOn, current: true };
}

/**
 * The single news date format, shared by the freshness line and the list rows.
 * Returns '' for a missing or unusable value, so a caller that needs a fallback
 * label supplies its own rather than this function inventing one.
 */
export function freshnessDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
