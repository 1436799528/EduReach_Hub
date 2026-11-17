import { BadgeCheck, CalendarClock, Clock3, ExternalLink, Link2, ShieldAlert } from 'lucide-react';
import type { SectionState, VerificationStatus } from '../../lib/institutions/types';

/**
 * Source-verification marks for institution facts.
 *
 * The rule these components exist to enforce: a green "Verified" mark is a
 * statement about a *fact*, not about a row. Nothing here turns "this record
 * exists" or "this request succeeded" into a verified badge — every mark needs
 * an explicit status, and the statuses that are not `verified` get their own
 * visible wording.
 *
 * Four states a student must be able to tell apart:
 *
 *   * officially sourced and reviewed  → Verified, with the date
 *   * researched but not yet reviewed  → Awaiting verification
 *   * not imported into EduReach yet   → Not yet imported
 *   * not published by the institution → Source unavailable
 */

export type TrustTone = 'verified' | 'pending' | 'missing' | 'unavailable' | 'session';

export function trustForStatus(status: VerificationStatus | null | undefined): TrustTone {
  if (status === 'verified') return 'verified';
  if (status === 'discovered' || status === 'in_review') return 'pending';
  if (status === 'unpublished_by_institution') return 'unavailable';
  if (status === 'disputed' || status === 'outdated') return 'unavailable';
  return 'missing';
}

const TRUST_LABELS: Record<TrustTone, string> = {
  verified: 'Verified',
  pending: 'Awaiting verification',
  missing: 'Not yet imported',
  unavailable: 'Source unavailable',
  session: 'Session-specific',
};

export function TrustBadge({
  status,
  verifiedAt,
  withLabel = true,
}: {
  status: VerificationStatus | null | undefined;
  verifiedAt?: string | null;
  withLabel?: boolean;
}) {
  const tone = trustForStatus(status);
  return <TrustMark tone={tone} verifiedAt={verifiedAt} withLabel={withLabel} />;
}

export function TrustMark({
  tone,
  verifiedAt,
  withLabel = true,
  label,
}: {
  tone: TrustTone;
  verifiedAt?: string | null;
  withLabel?: boolean;
  label?: string;
}) {
  const Icon =
    tone === 'verified' ? BadgeCheck : tone === 'pending' ? Clock3 : tone === 'session' ? CalendarClock : ShieldAlert;
  const text = label ?? TRUST_LABELS[tone];
  const date = formatCheckDate(verifiedAt);
  return (
    <span className={`er-trust er-trust--${tone}`} title={date ? `${text} — checked ${date}` : text}>
      <Icon size={12} aria-hidden="true" />
      {withLabel && <span>{text}</span>}
      {date && <span className="er-trust-date">· {date}</span>}
      {!withLabel && <span className="er-sr-only">{text}</span>}
    </span>
  );
}

/** A short, unambiguous date. A raw ISO string reads as a different fact. */
export function formatCheckDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The session a fact belongs to.
 *
 * Admission facts change every cycle, so a value without its session is not a
 * fact a student can act on. `isCurrent` says whether it is the newest
 * published session, and an older one says so in words.
 */
export function SessionBadge({ session, isCurrent }: { session: string | null; isCurrent: boolean }) {
  if (!session) return null;
  return (
    <span className={`er-trust er-trust--${isCurrent ? 'session' : 'pending'}`}>
      <CalendarClock size={12} aria-hidden="true" />
      <span>{session} session</span>
      {!isCurrent && <span className="er-trust-date">· earlier session</span>}
    </span>
  );
}

/**
 * A compact source reference.
 *
 * Only ever rendered with a URL that came from the data. A missing URL renders
 * nothing rather than a plausible-looking link.
 */
export function SourceLink({
  url,
  label = 'Official source',
  verifiedAt,
}: {
  url: string | null | undefined;
  label?: string;
  verifiedAt?: string | null;
}) {
  if (!url || !/^https?:\/\/\S+$/i.test(url)) return null;
  const date = formatCheckDate(verifiedAt);
  return (
    <a className="er-source-link" href={url} target="_blank" rel="noopener noreferrer">
      <Link2 size={12} aria-hidden="true" />
      <span>{label}</span>
      <ExternalLink size={11} aria-hidden="true" />
      {date && <span className="er-source-date">checked {date}</span>}
    </a>
  );
}

const SECTION_MESSAGES: Record<SectionState, string> = {
  available: '',
  empty: 'No published record for this section yet. An empty section means EduReach has not published it, not that the institution has none.',
  awaiting_review: 'Researched and awaiting review. Nothing here is shown as fact until an editor verifies it against the official source.',
  not_imported: 'Not yet imported. The institution-intelligence dataset is still being verified and has not been published for this institution.',
  unavailable: 'This section could not be loaded just now.',
};

/**
 * The one-line explanation under a section heading.
 *
 * Rendered for every state except `available`, so a panel can never be empty
 * and silent — silence reads as "this institution has none".
 */
export function SectionNote({ state, note }: { state: SectionState; note?: string }) {
  if (state === 'available') return null;
  return <p className="er-section-note">{note ?? SECTION_MESSAGES[state]}</p>;
}
