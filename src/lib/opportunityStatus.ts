/**
 * OPP-1 — never present an unverified listing as confidently active.
 *
 * The two live opportunities had `deadline` and `last_verified_at` both null
 * while the page header claimed the source, eligibility and application route
 * had been checked. This module derives what can honestly be said about a
 * listing from the fields that exist, so the page cannot over-claim again.
 *
 * Two independent facts are reported, because they are independent:
 *
 *   verification  did EduReach check this listing?   verified | unverified
 *   state         is it still open to apply to?      open | closing-soon | expired | undated
 *
 * An unverified listing that has not expired is still shown — hiding it would
 * lose a real opportunity — but it is labelled, and its call to action is
 * "Check the source" rather than "Apply".
 */

export type OpportunityLike = {
  title: string;
  deadline?: string | null;
  last_verified_at?: string | null;
  source_name?: string | null;
  link_url?: string | null;
  closed_at?: string | null;
};

export type OpportunityState = 'open' | 'closing-soon' | 'expired' | 'undated' | 'closed';
export type OpportunityVerification = 'verified' | 'unverified';

export type OpportunityStatus = {
  state: OpportunityState;
  verification: OpportunityVerification;
  /** Chip text for the deadline state. */
  stateLabel: string;
  /** Chip text for provenance. */
  verificationLabel: string;
  /** What the primary button may say, given both facts. */
  cta: string;
  /** True when the listing may be described as currently open to applications. */
  actionable: boolean;
  daysLeft: number | null;
  verifiedOn: string | null;
};

/** Days until the deadline, counted in whole days; null when undated. */
export function daysUntil(deadline?: string | null, now: number = Date.now()): number | null {
  if (!deadline) return null;
  const trimmed = String(deadline).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const target = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  const today = new Date(now);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}

const CLOSING_SOON_DAYS = 14;

export function opportunityStatus(item: OpportunityLike, now: number = Date.now()): OpportunityStatus {
  const verification: OpportunityVerification = item.last_verified_at ? 'verified' : 'unverified';
  const verifiedOn = item.last_verified_at ? String(item.last_verified_at) : null;
  const left = daysUntil(item.deadline, now);

  let state: OpportunityState;
  if (item.closed_at) state = 'closed';
  else if (left === null) state = 'undated';
  else if (left < 0) state = 'expired';
  else if (left <= CLOSING_SOON_DAYS) state = 'closing-soon';
  else state = 'open';

  const stateLabel =
    state === 'expired' ? `Closed ${String(item.deadline).slice(0, 10)}`
    : state === 'closed' ? 'Closed'
    : state === 'closing-soon' ? (left === 0 ? 'Closes today' : left === 1 ? 'Closes tomorrow' : `Closes in ${left} days`)
    : state === 'undated' ? 'No closing date given'
    : `Closes ${String(item.deadline).slice(0, 10)}`;

  const actionable = state !== 'expired' && state !== 'closed';

  return {
    state,
    verification,
    stateLabel,
    verificationLabel: verification === 'verified' ? 'Checked by EduReach' : 'Not yet checked by EduReach',
    // An unverified listing never gets a confident "Apply": the student is sent
    // to the organiser's own page to confirm it first.
    cta: !actionable ? 'Closed' : verification === 'verified' ? 'Apply' : 'Check the source',
    actionable,
    daysLeft: left,
    verifiedOn,
  };
}
