import { ArrowRight, BellRing, CalendarClock, GraduationCap, MapPin, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import FilterSearch from '../src/components/ui/FilterSearch';
import { SkeletonTiles } from '../src/components/Skeleton';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import { SCHOLARSHIP_SEED } from '../src/data/scholarshipSeed';
import { fetchOpportunitiesByScope, type Opportunity } from '../src/lib/api';
import { listingLifecycle, type ListingStatus } from '../src/lib/listingLifecycle';
import { matchesSearch } from '../src/lib/searchMatch';
import { freshnessDate } from '../src/lib/newsFreshness';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { plainTextFromHtml } from '../src/lib/html-sanitize';
import { userFacingError } from '../lib/errors';
import '../src/scholarships.css';

/**
 * Scholarships.
 *
 * The card is the News card. Same shell, same radius, border, shadow, padding,
 * heading hierarchy, hover and focus ring - only the content inside changes,
 * because a student should not have to learn a second card language to read a
 * second list. Long requirements live on the detail page (`/jobs/:id`), not in
 * the card.
 *
 * The lifecycle is derived from the listing's dates, never from a label typed
 * into a row: Open, Closing Soon, Upcoming and Closed are computed, expired
 * listings leave the active grid and are kept in the archive below it.
 */

type StatusFilter = 'all' | ListingStatus;
type LevelFilter = 'all' | 'undergraduate' | 'postgraduate' | 'other';

const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  { id: 'open', label: 'Open now' },
  { id: 'closing-soon', label: 'Closing soon' },
  { id: 'upcoming', label: 'Upcoming' },
];

const LEVEL_OPTIONS = [
  { id: 'all', label: 'All levels' },
  { id: 'undergraduate', label: 'Undergraduate' },
  { id: 'postgraduate', label: 'Postgraduate' },
  { id: 'other', label: 'Other' },
];

function levelOf(item: Opportunity): LevelFilter {
  const text = `${item.study_level || ''} ${(item.education_levels || []).join(' ')}`.toLowerCase();
  if (/postgrad|master|phd|doctor/.test(text)) return 'postgraduate';
  if (/undergrad|bachelor|100|200|300|400/.test(text)) return 'undergraduate';
  return 'other';
}

function statusChipClass(status: ListingStatus): string {
  if (status === 'closing-soon') return 'er-opp-chip is-closing';
  if (status === 'open') return 'er-opp-chip is-open';
  if (status === 'upcoming') return 'er-opp-chip is-upcoming';
  return 'er-opp-chip is-expired';
}

function fundingLabel(item: Opportunity): string {
  const text = `${item.category} ${item.subcategory || ''}`.toLowerCase();
  if (text.includes('grant')) return 'Grant';
  if (text.includes('fellowship')) return 'Fellowship';
  return 'Scholarship';
}

function ScholarshipCard({ item, archived = false }: { item: Opportunity; archived?: boolean }) {
  const lifecycle = listingLifecycle(item);
  const verified = Boolean(item.verified_at || item.last_verified_at);
  const verifiedOn = freshnessDate(item.verified_at || item.last_verified_at || null);
  const href = archived ? item.link_url : `/jobs/${encodeURIComponent(item.id)}`;
  const description = plainTextFromHtml(item.description || '');
  // An archived listing without a source link is still worth showing, but it
  // must not become a dead anchor. It renders as a plain card instead.
  const Wrapper = (href ? 'a' : 'div') as 'a';

  return (
    <Wrapper
      className={`er-news-card er-scholarship-card${archived ? ' is-archived' : ''}`}
      {...(href ? { href } : {})}
      {...(archived && href ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={`${item.title}${archived ? ' (closed, opens the provider page)' : ''}`}
    >
      <span className="er-scholarship-media" aria-hidden="true">
        <CardIdentityMark
          value={`${item.title} ${item.organisation || ''} scholarship`}
          type="content"
          size="md"
        />
      </span>
      <span className="er-news-card-body">
        <small className="er-news-card-kicker">
          <span>{fundingLabel(item)}</span>
          <span aria-hidden="true">·</span>
          <span>{item.study_level || 'Study level not stated'}</span>
        </small>
        <strong>{item.title}</strong>
        <span className="er-scholarship-provider">{item.organisation || 'Provider not recorded'}</span>
        {description && <span className="er-news-card-summary">{description}</span>}

        <span className="er-news-card-kicker er-scholarship-meta">
          {item.locations && (
            <span className="er-opp-chip">
              <MapPin size={11} aria-hidden="true" /> {item.locations}
            </span>
          )}
          <span className={statusChipClass(lifecycle.status)}>
            <CalendarClock size={11} aria-hidden="true" /> {lifecycle.label}
          </span>
          <span className={`er-opp-chip ${verified ? 'is-verified' : 'is-unverified'}`}>
            {verified ? <ShieldCheck size={11} aria-hidden="true" /> : <ShieldQuestion size={11} aria-hidden="true" />}
            {verified ? 'Verified' : 'Not yet checked'}
          </span>
        </span>

        <span className="er-news-card-foot">
          <span>
            {lifecycle.detail}
            {verifiedOn ? ` · Checked ${verifiedOn}` : ''}
          </span>
          <span className="er-news-card-read">
            {archived ? 'View source' : 'View scholarship'} <ArrowRight size={13} aria-hidden="true" />
          </span>
        </span>
      </span>
    </Wrapper>
  );
}

export default function ScholarshipsPage() {
  const [active, setActive] = useState<Opportunity[] | null>(isSupabaseConfigured ? null : SCHOLARSHIP_SEED);
  const [archive, setArchive] = useState<Opportunity[] | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    fetchOpportunitiesByScope('active')
      .then((items) => { if (!cancelled) setActive(items); })
      .catch((value) => {
        if (cancelled) return;
        setError(userFacingError(value, 'Scholarships are temporarily unavailable.'));
        setActive([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!archiveOpen || archive !== null) return;
    if (!isSupabaseConfigured) {
      setArchive(SCHOLARSHIP_SEED.filter((item) => listingLifecycle(item).status === 'closed'));
      return;
    }
    let cancelled = false;
    setArchiveLoading(true);
    setArchiveError('');
    fetchOpportunitiesByScope('archive')
      .then((items) => { if (!cancelled) setArchive(items); })
      .catch((value) => { if (!cancelled) setArchiveError(userFacingError(value, 'Past listings could not be loaded.')); })
      .finally(() => { if (!cancelled) setArchiveLoading(false); });
    return () => { cancelled = true; };
  }, [archiveOpen, archive]);

  const visible = useMemo(() => {
    const list = (active || []).filter(
      (item) =>
        (item.category === 'scholarship' || item.category === 'grant' || item.category === 'fellowship') &&
        // Closed rows belong to the archive; they are never part of the open list.
        listingLifecycle(item).status !== 'closed',
    );
    return list
      .filter((item) => {
        const lifecycle = listingLifecycle(item);
        if (statusFilter !== 'all' && lifecycle.status !== statusFilter) return false;
        if (levelFilter !== 'all' && levelOf(item) !== levelFilter) return false;
        return matchesSearch(
          [item.title, item.organisation, item.description, item.eligibility, item.study_level, item.locations, item.subcategory],
          search,
        );
      })
      .sort((a, b) => {
        const lifecycleA = listingLifecycle(a);
        const lifecycleB = listingLifecycle(b);
        if (lifecycleA.actionable !== lifecycleB.actionable) return lifecycleA.actionable ? -1 : 1;
        if (Boolean(a.is_featured) !== Boolean(b.is_featured)) return a.is_featured ? -1 : 1;
        return Number(lifecycleA.daysLeft ?? Number.POSITIVE_INFINITY) - Number(lifecycleB.daysLeft ?? Number.POSITIVE_INFINITY);
      });
  }, [active, statusFilter, levelFilter, search]);

  const suggestions = useMemo(() => (active || [])
    .filter((item) => listingLifecycle(item).status !== 'closed')
    .map((item) => ({
    id: item.id,
    title: item.title,
    description: [item.organisation, item.study_level, item.locations].filter(Boolean).join(' · '),
    category: 'Scholarship',
    keywords: [item.description, item.eligibility, item.subcategory],
  })), [active]);

  const loading = active === null;

  return (
    <HubLayout>
      <div className="hub-page er-comfort-page">
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">SCHOLARSHIPS &amp; GRANTS</span>
              <h1>Scholarships for Nigerian students</h1>
              <p>
                Every listing states who offers it, when EduReach last checked the provider’s own page, and
                whether it is still open. Closed listings move to the archive instead of staying in the open list.
              </p>
            </div>
            <a className="hub-outline-btn" href="/jobs" style={{ textDecoration: 'none' }}>
              Jobs &amp; internships <ArrowRight size={13} aria-hidden="true" />
            </a>
          </div>

          <div className="er-scholarship-toolbar">
            <FilterSearch
              value={search}
              onChange={setSearch}
              label="Search scholarships"
              placeholder="Search provider, level or country"
              clearLabel="Clear scholarship search"
              suggestionItems={suggestions}
              suggestionLabel="Scholarship suggestions"
            />
            <div className="er-scholarship-filters">
              <FilterPills
                options={STATUS_OPTIONS}
                active={statusFilter}
                onChange={(id) => setStatusFilter(id as StatusFilter)}
                ariaLabel="Filter scholarships by status"
              />
              <label className="er-library-search er-scholarship-level">
                <span>Study level</span>
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
                >
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error && (
            <div className="hub-form-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonTiles tiles={3} label="Loading scholarships" />
          ) : visible.length > 0 ? (
            <section className="er-section" style={{ marginTop: 0 }} aria-labelledby="open-scholarships">
              <SectionHead title={`${visible.length} ${visible.length === 1 ? 'listing' : 'listings'}`} />
              <h2 id="open-scholarships" className="er-visually-hidden">Open and upcoming scholarships</h2>
              <div className="er-news-card-grid er-standard-card-grid">
                {visible.map((item) => (
                  <ScholarshipCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : (
            <div className="hub-panel hub-empty">
              <BellRing size={22} aria-hidden="true" />
              <h2>No scholarship matches this view</h2>
              <p>
                {search || statusFilter !== 'all' || levelFilter !== 'all'
                  ? 'Clear the search or choose another status to see the full list.'
                  : 'New scholarships appear here only after the provider’s page has been checked.'}
              </p>
              <a
                className="hub-primary-btn"
                href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent('Hello EduReach, notify me when new scholarships are listed.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                Notify me <ArrowRight size={13} aria-hidden="true" />
              </a>
            </div>
          )}

          <section className="er-section er-scholarship-archive" aria-labelledby="archive-heading">
            <div className="er-scholarship-archive-head">
              <div>
                <h2 id="archive-heading">Past deadlines</h2>
                <p>
                  Closed listings stay readable so you can prepare for the next cycle. They are never shown as open.
                </p>
              </div>
              <button
                type="button"
                className="hub-outline-btn"
                aria-expanded={archiveOpen}
                aria-controls="scholarship-archive-list"
                onClick={() => setArchiveOpen((open) => !open)}
              >
                {archiveOpen ? 'Hide archive' : 'Show archive'}
              </button>
            </div>

            {archiveOpen && (
              <div id="scholarship-archive-list">
                {archiveLoading && <SkeletonTiles tiles={2} label="Loading past listings" />}
                {archiveError && <div className="hub-form-error" role="alert">{archiveError}</div>}
                {!archiveLoading && !archiveError && archive && archive.length > 0 && (
                  <div className="er-news-card-grid er-standard-card-grid">
                    {archive.map((item) => <ScholarshipCard key={item.id} item={item} archived />)}
                  </div>
                )}
                {!archiveLoading && !archiveError && archive && archive.length === 0 && (
                  <p className="er-scholarship-archive-empty">No closed listings are recorded yet.</p>
                )}
              </div>
            )}
          </section>

          <div className="er-scholarship-note">
            <GraduationCap size={18} aria-hidden="true" />
            <p>
              EduReach does not collect scholarship application fees and does not process applications. Apply only
              on the provider’s own page, and never pay anyone who promises you an award.
            </p>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
