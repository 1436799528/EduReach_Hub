import { userFacingError } from '../lib/errors';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, MapPin, School } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import FilterSearch from '../src/components/ui/FilterSearch';
import { TrustBadge } from '../src/components/institutions/TrustBadge';
import { commonInstitutions } from '../src/data/studentOptions';
import {
  deduplicateInstitutions,
  facetsOf,
  institutionSlug,
  matchesTerm,
  sortInstitutions,
  type InstitutionFilter,
} from '../src/lib/institutions/selectors';
import { fetchInstitutionDirectory } from '../src/lib/institutions/repository';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { navigateInApp } from '../src/lib/navigation';
import type { InstitutionSummary, Ownership, VerificationStatus } from '../src/lib/institutions/types';
import { OWNERSHIP_LABELS } from '../src/lib/institutions/types';

/**
 * A starter identity for the unconfigured local preview.
 *
 * Only used when Supabase is not configured at all. In production a failed
 * directory read shows the error, never this list — see the catch below.
 */
function starterInstitutions(): InstitutionSummary[] {
  return commonInstitutions
    .filter((name) => !name.startsWith('Other'))
    .map((name, index) => {
      const match = name.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
      const schoolName = match?.[1] || name;
      const acronym = match?.[2] || null;
      return {
        id: `starter-school-${index + 1}`,
        name: schoolName,
        acronym,
        state: null,
        institutionType: 'University',
        category: 'university' as const,
        ownership: null,
        websiteUrl: null,
        admissionPortalUrl: null,
        studentPortalUrl: null,
        slug: institutionSlug(schoolName),
        aliases: acronym
          ? [{ name: acronym, type: 'acronym' as const, preferredDisplay: false, status: 'unresearched' as VerificationStatus }]
          : [],
        postUtme: null,
        verifiedWebsite: false,
        intelligencePublished: false,
      };
    });
}

/**
 * Whether this institution has published, verified intelligence.
 *
 * Today nothing does: the institution-intelligence schema is not deployed and
 * no researched batch has been imported. So no result carries a verified mark,
 * and the finder says so once, in the header, instead of implying a check that
 * never happened.
 */
function publishedVerification(institution: InstitutionSummary): VerificationStatus {
  return institution.intelligencePublished ? 'verified' : 'unresearched';
}

/**
 * The canonical detail route.
 *
 * The slug stays in the path so existing links and bookmarks keep working, and
 * the canonical UUID rides along as `id` so the details page resolves by
 * identity first. A legacy slug for a reconciled institution (the second
 * University of Calabar row, for example) still resolves.
 */
export function institutionDetailPath(institution: InstitutionSummary, returnPath: string): string {
  const slug = institution.slug || institutionSlug(institution.name);
  const params = new URLSearchParams();
  params.set('id', institution.id);
  params.set('name', institution.name);
  if (institution.acronym) params.set('acronym', institution.acronym);
  if (institution.state) params.set('state', institution.state);
  if (institution.institutionType) params.set('type', institution.institutionType);
  if (institution.websiteUrl) params.set('website', institution.websiteUrl);
  params.set('return', returnPath);
  return `/schools/${encodeURIComponent(slug)}?${params.toString()}`;
}

export default function SchoolFinderPage() {
  const params = new URLSearchParams(window.location.search);
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([]);
  const [filter, setFilter] = useState<InstitutionFilter>({
    term: params.get('school') || '',
    state: params.get('state') || null,
    ownership: (params.get('ownership') as Ownership | null) || null,
    type: params.get('type') || null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        if (!isSupabaseConfigured) {
          if (active) setInstitutions(starterInstitutions());
          return;
        }
        const rows = await fetchInstitutionDirectory();
        if (active) {
          setInstitutions(sortInstitutions(deduplicateInstitutions(rows)));
          setError('');
        }
      } catch (value) {
        if (active) {
          setError(userFacingError(value, 'The institution directory could not be loaded.'));
          // Production never silently substitutes the maintained starter list
          // for a configured-but-failing directory; the starter list is only
          // the unconfigured local-preview source.
          setInstitutions(isSupabaseConfigured ? [] : starterInstitutions());
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (filter.term.trim()) next.set('school', filter.term.trim()); else next.delete('school');
    if (filter.state) next.set('state', filter.state); else next.delete('state');
    if (filter.ownership) next.set('ownership', filter.ownership); else next.delete('ownership');
    if (filter.type) next.set('type', filter.type); else next.delete('type');
    const suffix = next.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${suffix ? `?${suffix}` : ''}`);
  }, [filter]);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = new URLSearchParams(window.location.search);
      setFilter({
        term: next.get('school') || '',
        state: next.get('state') || null,
        ownership: (next.get('ownership') as Ownership | null) || null,
        type: next.get('type') || null,
      });
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const directory = useMemo(() => deduplicateInstitutions(institutions), [institutions]);
  const facets = useMemo(() => facetsOf(directory), [directory]);

  const filtered = useMemo(() => {
    const term = filter.term.trim();
    return directory.filter((institution) => {
      if (term && !matchesTerm(institution, term)) return false;
      if (filter.state && institution.state !== filter.state) return false;
      // An ownership filter matches only published ownership. With no
      // ownership data imported it matches nothing, which is the honest
      // answer — it never guesses a category from the institution's name.
      if (filter.ownership && institution.ownership !== filter.ownership) return false;
      if (filter.type && !String(institution.institutionType || '').toLowerCase().includes(filter.type.toLowerCase())) {
        return false;
      }
      return true;
    }).slice(0, 120);
  }, [directory, filter]);

  // SEARCH-2: every institution on the page is suggested, including acronym,
  // alias and state text that does not occur at the start of the name.
  const institutionSuggestions = useMemo(() => directory.map((institution) => ({
    id: institution.id,
    title: institution.name,
    description: [institution.acronym, institution.state, institution.institutionType].filter(Boolean).join(' · '),
    category: institution.institutionType || 'Institution',
    keywords: [
      institution.ownership,
      institution.state,
      ...(institution.aliases || []).map((alias) => alias.name),
    ],
  })), [directory]);
  const returnPath = `${window.location.pathname}${window.location.search}`;

  const update = useCallback((patch: Partial<InstitutionFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
  }, []);

  return (
    <HubLayout>
      <div className="hub-page school-finder-page er-comfort-page">
        <div className="hub-container school-finder-container">
          <div className="school-finder-head">
            <div>
              <span className="hub-eyebrow">Student tools</span>
              <h1>Find your school</h1>
              <p>Search the maintained institution directory by official name, acronym, accepted alias or state.</p>
            </div>
          </div>
          <section className="school-finder-search-card" aria-label="School search">
            <div className="school-finder-search-row">
              <FilterSearch
                value={filter.term}
                onChange={(term) => update({ term })}
                label="Search for a school"
                placeholder="Search school, acronym, alias or state..."
                clearLabel="Clear school search"
                suggestionItems={institutionSuggestions}
                suggestionLimit={8}
                suggestionLabel="School suggestions"
                autoFocus
              />
            </div>
            <div className="er-finder-filters">
              <select
                value={filter.state ?? ''}
                onChange={(event) => update({ state: event.target.value || null })}
                aria-label="Filter by state"
              >
                <option value="">All states</option>
                {facets.states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <select
                value={filter.ownership ?? ''}
                onChange={(event) => update({ ownership: (event.target.value || null) as Ownership | null })}
                aria-label="Filter by ownership"
                disabled={facets.ownerships.length === 0}
              >
                <option value="">
                  {facets.ownerships.length ? 'Any ownership' : 'Ownership not published yet'}
                </option>
                {facets.ownerships.map((ownership) => (
                  <option key={ownership} value={ownership}>{OWNERSHIP_LABELS[ownership]}</option>
                ))}
              </select>
              <select
                value={filter.type ?? ''}
                onChange={(event) => update({ type: event.target.value || null })}
                aria-label="Filter by institution type"
              >
                <option value="">All institution types</option>
                {facets.types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="school-finder-search-meta">
              {loading
                ? 'Loading the institution directory…'
                : `${filtered.length} matching institution${filtered.length === 1 ? '' : 's'}`}
            </div>
          </section>

          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>The institution directory could not be loaded right now. Please try again in a moment.</span>
              <button type="button" className="hub-outline-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </div>
          )}

          {!loading && !error && !filtered.length && (
            <div className="hub-panel hub-empty">
              <School size={24} />
              <h2>No school found</h2>
              <p>Try an acronym, an alternative name, a state or a shorter school name.</p>
            </div>
          )}

          <div className="school-finder-results">
            {filtered.map((institution) => {
              const detailPath = institutionDetailPath(institution, returnPath);
              const status = publishedVerification(institution);
              return (
                <div className="school-finder-result-card school-finder-result-card-link" key={institution.id}>
                  <div className="school-finder-result-icon"><School size={20} /></div>
                  <div className="school-finder-result-copy">
                    <h2>
                      {/* One stretched link covers the card; the official-site
                          link below sits above it, so the card keeps exactly
                          one interaction target and no nested anchors. */}
                      <a
                        className="school-finder-result-title-link"
                        href={detailPath}
                        onClick={(event) => {
                          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                          event.preventDefault();
                          navigateInApp(detailPath);
                        }}
                      >
                        {institution.name}
                      </a>
                    </h2>
                    <p>
                      {institution.acronym && <b>{institution.acronym} · </b>}
                      {institution.institutionType || 'Institution'} <span>·</span>{' '}
                      <MapPin size={13} /> {institution.state ? `${institution.state} State` : 'Nigeria'}
                    </p>
                    <div className="er-finder-badges">
                      {/* No ownership pill unless ownership is a published
                          fact. Nothing infers one from the name. */}
                      {institution.ownership && (
                        <span className="er-ownership-badge">{OWNERSHIP_LABELS[institution.ownership]}</span>
                      )}
                      {status === 'verified' && <TrustBadge status={status} />}
                      {institution.websiteUrl && (
                        <a
                          className="er-finder-website"
                          href={institution.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Official website <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="er-card-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
                </div>
              );
            })}
          </div>

          {!loading && !error && filtered.length > 0 && (
            <p className="er-section-note" style={{ marginTop: 14 }}>
              Ownership, programme, cut-off and screening details are not shown yet. They are part of the
              institution-intelligence dataset EduReach is still verifying, and none of them will be estimated here.
            </p>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
