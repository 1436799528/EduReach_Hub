import { ArrowRight, BellRing, Briefcase, CalendarClock, MapPin, Search, ShieldCheck, ShieldQuestion, Tag, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { EDUREACH_WHATSAPP, jobApplyHref, jobs } from '../src/data/hubContent';
import { fetchOpportunities, type Opportunity } from '../src/lib/api';
import { opportunityStatus, type OpportunityState } from '../src/lib/opportunityStatus';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { plainTextFromHtml } from '../src/lib/html-sanitize';

const filters = [
  { id: 'ALL', label: 'All Listings' },
  { id: 'scholarship', label: 'Scholarships & Grants' },
  { id: 'fellowship', label: 'Fellowships & Competitions' },
  { id: 'internship', label: 'Jobs & Internships' },
  { id: 'campus', label: 'Campus Roles' },
  { id: 'part-time', label: 'Part-time' },
];

const validCategoryParams = new Set([
  ...filters.map((item) => item.id),
  'grant',
  'job',
  'competition',
]);

const statusFilters = [
  { id: 'ALL', label: 'Any status' },
  { id: 'OPEN', label: 'Open now' },
  { id: 'CLOSING', label: 'Closing soon' },
  { id: 'UNVERIFIED', label: 'Not checked yet' },
  { id: 'EXPIRED', label: 'Closed' },
];

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSING' | 'UNVERIFIED' | 'EXPIRED';

function matchesStatus(status: OpportunityState, verification: 'verified' | 'unverified', filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'EXPIRED') return status === 'expired' || status === 'closed';
  if (filter === 'UNVERIFIED') return verification === 'unverified';
  if (filter === 'CLOSING') return status === 'closing-soon';
  return status === 'open' || status === 'closing-soon';
}

function readOpportunityFilter() {
  const value = new URLSearchParams(window.location.search).get('category') || 'ALL';
  if (value === 'grant') return 'scholarship';
  if (value === 'competition') return 'fellowship';
  if (value === 'job') return 'internship';
  return validCategoryParams.has(value) ? value : 'ALL';
}

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState(readOpportunityFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [educationFilter, setEducationFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [workModeFilter, setWorkModeFilter] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'deadline' | 'latest' | 'featured'>('deadline');
  // When a live backend is configured, the Supabase `opportunities` table is
  // the only listing source (admin-managed). The static list below exists for
  // local preview only and never mixes with live rows.
  const [live, setLive] = useState<Opportunity[] | null>(isSupabaseConfigured ? null : []);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    fetchOpportunities()
      .then((items) => { if (active) setLive(items); })
      .catch(() => { if (active) { setLiveError(true); setLive([]); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncFromUrl = () => setActiveFilter(readOpportunityFilter());
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  function updateUrl(nextCategory = activeFilter, nextSearch = search) {
    const params = new URLSearchParams();
    if (nextCategory !== 'ALL') params.set('category', nextCategory);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    window.history.replaceState({}, '', params.toString() ? `/jobs?${params.toString()}` : '/jobs');
  }

  function changeFilter(next: string) {
    setActiveFilter(next);
    updateUrl(next);
  }

  // Two listing sources, never mixed: with a configured backend the admin-
  // managed `opportunities` table is the only source; local preview shows the
  // static directory instead (labelled on the cards).
  const filterOptions = useMemo(() => {
    const source = live || [];
    return {
      education: Array.from(new Set(source.flatMap((item) => item.education_levels || []))).sort(),
      disciplines: Array.from(new Set(source.flatMap((item) => item.disciplines || []))).sort(),
    };
  }, [live]);

  const filteredLive = useMemo(() => {
    if (live === null) return null;
    const query = search.trim().toLowerCase();
    const matched = live.filter((item) => {
      const categoryMatch = activeFilter === 'ALL'
        || (activeFilter === 'scholarship' && (item.category === 'scholarship' || item.category === 'grant'))
        || (activeFilter === 'fellowship' && (item.category === 'fellowship' || item.category === 'competition'))
        || (activeFilter === 'internship' && (item.category === 'job' || item.category === 'internship'))
        || item.category === activeFilter;
      if (!categoryMatch) return false;
      const status = opportunityStatus(item);
      if (!matchesStatus(status.state, status.verification, statusFilter)) return false;
      const haystack = [
        item.title, item.organisation, item.description, item.locations, item.eligibility,
        item.subcategory, ...(item.education_levels || []), ...(item.disciplines || []),
      ].join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (educationFilter && !(item.education_levels || []).includes(educationFilter)) return false;
      if (disciplineFilter && !(item.disciplines || []).includes(disciplineFilter)) return false;
      if (workModeFilter && item.work_mode !== workModeFilter) return false;
      if (featuredOnly && !item.is_featured) return false;
      return true;
    });
    return matched.sort((a, b) => {
      const left = opportunityStatus(a);
      const right = opportunityStatus(b);
      if (sortMode === 'latest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (sortMode === 'featured' && Boolean(a.is_featured) !== Boolean(b.is_featured)) return a.is_featured ? -1 : 1;
      if (left.actionable !== right.actionable) return left.actionable ? -1 : 1;
      if (left.verification !== right.verification) return left.verification === 'verified' ? -1 : 1;
      return Number(left.daysLeft ?? Number.POSITIVE_INFINITY) - Number(right.daysLeft ?? Number.POSITIVE_INFINITY);
    });
  }, [live, activeFilter, statusFilter, search, educationFilter, disciplineFilter, workModeFilter, featuredOnly, sortMode]);

  const filteredStatic = useMemo(() => {
    if (isSupabaseConfigured) return [];
    if (activeFilter === 'ALL') return jobs;
    return jobs.filter((item) => item.category === activeFilter);
  }, [activeFilter]);

  const loadingLive = live === null;

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933', fontWeight: 560 }}>
                STUDENT OPPORTUNITIES &amp; GRANTS
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 680, color: '#0f172a', margin: '2px 0 4px' }}>
                Student Opportunities &amp; Grants
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#5e6c82' }}>
                Every listing states where it came from, when EduReach last checked it, and whether it is still open. A listing EduReach has not checked yet is labelled as such — never presented as verified.
              </p>
            </div>
            <a className="hub-outline-btn" href="/news" style={{ textDecoration: 'none', fontSize: '12px' }}>
              News &amp; Updates →
            </a>
          </div>

          <div style={{ marginBottom: '14px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '9px', padding: '0 11px', minHeight: '42px' }}>
              <Search size={17} style={{ color: '#64748b', flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); updateUrl(activeFilter, e.target.value); }}
                placeholder="Search jobs, scholarships, internships, grants…"
                aria-label="Search opportunities"
                style={{ border: 0, outline: 0, background: 'transparent', width: '100%', fontSize: '13px', color: '#0f172a' }}
              />
              {search && <button type="button" onClick={() => { setSearch(''); updateUrl(activeFilter, ''); }} aria-label="Clear search" style={{ border: 0, background: 'transparent', padding: 4, cursor: 'pointer' }}><X size={15} /></button>}
            </label>
            {isSupabaseConfigured && live && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '8px', marginTop: '10px' }}>
                <select value={educationFilter} onChange={(e) => setEducationFilter(e.target.value)} aria-label="Filter by education level" className="admin-select">
                  <option value="">Any education level</option>
                  {filterOptions.education.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)} aria-label="Filter by discipline" className="admin-select">
                  <option value="">Any discipline</option>
                  {filterOptions.disciplines.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={workModeFilter} onChange={(e) => setWorkModeFilter(e.target.value)} aria-label="Filter by work mode" className="admin-select">
                  <option value="">Any work mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)} aria-label="Sort opportunities" className="admin-select">
                  <option value="deadline">Sort: Deadline</option>
                  <option value="latest">Sort: Latest</option>
                  <option value="featured">Sort: Featured</option>
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button type="button" className={featuredOnly ? 'hub-primary-btn' : 'hub-outline-btn'} onClick={() => setFeaturedOnly((value) => !value)} style={{ fontSize: '11.5px', padding: '6px 10px' }}>
                Featured
              </button>
              <button type="button" className={statusFilter === 'CLOSING' ? 'hub-primary-btn' : 'hub-outline-btn'} onClick={() => setStatusFilter(statusFilter === 'CLOSING' ? 'ALL' : 'CLOSING')} style={{ fontSize: '11.5px', padding: '6px 10px' }}>
                Closing soon
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <FilterPills options={filters} active={activeFilter} onChange={changeFilter} ariaLabel="Opportunity categories" />
          </div>

          <div className="er-status-filter" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <span className="er-library-filter-label"><CalendarClock size={15} /> Show</span>
            <FilterPills
              options={statusFilters}
              active={statusFilter}
              onChange={(next) => setStatusFilter(next as StatusFilter)}
              ariaLabel="Filter by deadline and verification state"
            />
          </div>

          <div
            role="note"
            style={{
              marginBottom: '18px',
              padding: '12px 14px',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              background: '#fffbeb',
              color: '#854d0e',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            <strong>Before you apply:</strong> EduReach lists an opportunity only with its source. “Checked by EduReach” means the organiser's page was open and the details matched when we last looked — it is not a guarantee, and no listing is ever a reason to pay a fee. If a filter shows nothing, that is the honest state of the catalogue.
          </div>

          {loadingLive && (
            <div className="hub-panel hub-empty">Loading opportunities…</div>
          )}

          {!loadingLive && isSupabaseConfigured && liveError && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span>Opportunities are temporarily unavailable.</span>
              <button type="button" className="hub-outline-btn" onClick={() => { setLive(null); setLiveError(false); fetchOpportunities().then((items) => setLive(items)).catch(() => { setLiveError(true); setLive([]); }); }}>Try again</button>
            </div>
          )}

          {!loadingLive && !isSupabaseConfigured && !filteredStatic.length && (
            <div className="hub-panel hub-empty">
              <BellRing size={22} style={{ color: '#b14933', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No verified scholarships listed right now.</h3>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#5e6c82' }}>
                New scholarships and grants are added only after verification. Message the helpline and we will notify you.
              </p>
              <a
                className="hub-primary-btn"
                href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent('Hello EduReach, notify me when new scholarships are listed.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                Notify me <ArrowRight size={13} />
              </a>
            </div>
          )}

          {!loadingLive && !isSupabaseConfigured && filteredStatic.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead title={`${filteredStatic.length} preview listing${filteredStatic.length === 1 ? '' : 's'}`} />
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredStatic.map((item) => (
                  <a
                    key={item.title}
                    href={jobApplyHref(item.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`er-opportunity-card er-opportunity-link ${identityClassFor(`${item.category} ${item.title}`, 'content')}`}
                    style={{
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <div className="hub-news-thumb" style={{ flexShrink: 0 }}>
                      <CardIdentityMark value={`${item.title} ${item.category} ${item.type}`} type="content" size="sm" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5e6c82', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 620, color: '#b14933' }}>
                          <Tag size={11} /> {item.type}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={11} /> {item.mode}
                        </span>
                        <span>•</span>
                        <span style={{ color: '#5e6c82', fontWeight: 620 }}>Active EduReach listing</span>
                      </div>
                      <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: '0 0 3px', lineHeight: 1.35 }}>
                        {item.title}
                      </h2>
                      <p style={{ fontSize: '12.5px', color: '#5e6c82', margin: 0, lineHeight: 1.4 }}>
                        {item.note}
                      </p>
                    </div>
                    <span
                      className="hub-primary-btn er-card-cta"
                      style={{ alignSelf: 'center', flexShrink: 0, fontSize: '11.5px', padding: '7px 14px', whiteSpace: 'nowrap' }}
                    >
                      Apply <ArrowRight size={13} />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {!loadingLive && isSupabaseConfigured && filteredLive && filteredLive.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead title={`${filteredLive.length} matching listing${filteredLive.length === 1 ? '' : 's'}`} />
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredLive.map((item) => {
                  const status = opportunityStatus(item);
                  return (
                    <a
                      key={item.id}
                      href={item.link_url || jobApplyHref(item.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`er-opportunity-card er-opportunity-link ${identityClassFor(`${item.category} ${item.title}`, 'content')}${status.actionable ? '' : ' is-expired'}`}
                      style={{ alignItems: 'flex-start', gap: '14px', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)', opacity: status.actionable ? 1 : 0.78 }}
                    >
                      <div className="hub-news-thumb" style={{ flexShrink: 0 }}>
                        <CardIdentityMark value={`${item.title} ${item.category} ${item.organisation || ''}`} type="content" size="sm" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="er-opportunity-chips">
                          <span className="er-opp-chip is-category"><Tag size={11} /> {item.category}</span>
                          <span className={`er-opp-chip ${status.actionable ? (status.state === 'closing-soon' ? 'is-closing' : 'is-open') : 'is-expired'}`}>
                            <CalendarClock size={11} /> {status.stateLabel}
                          </span>
                          <span className={`er-opp-chip ${status.verification === 'verified' ? 'is-verified' : 'is-unverified'}`}>
                            {status.verification === 'verified' ? <ShieldCheck size={11} /> : <ShieldQuestion size={11} />} {status.verificationLabel}
                          </span>
                          {item.locations && <span className="er-opp-chip"><MapPin size={11} /> {item.locations}</span>}
                        </div>
                        <h2 style={{ fontSize: '15px', color: '#0f172a', margin: '6px 0 3px', lineHeight: 1.35 }}>{item.title}</h2>
                        {item.organisation && <p className="er-opp-organisation">{item.organisation}</p>}
                        <p style={{ fontSize: '12.5px', color: '#5e6c82', margin: 0, lineHeight: 1.45 }}>
                          {plainTextFromHtml(item.description || '')}
                        </p>
                        <dl className="er-opp-facts">
                          <div>
                            <dt><Users size={12} /> Eligibility</dt>
                            <dd>{item.eligibility?.trim() ? item.eligibility : 'Not recorded — check the organiser’s page'}</dd>
                          </div>
                          <div>
                            <dt>Source</dt>
                            <dd>{item.source_name?.trim() ? item.source_name : item.link_url ? 'Organiser’s own page' : 'No source recorded'}</dd>
                          </div>
                          <div>
                            <dt>Last checked</dt>
                            <dd>{status.verifiedOn ? new Date(status.verifiedOn).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not yet checked by EduReach'}</dd>
                          </div>
                        </dl>
                      </div>
                      <span
                        className={status.actionable ? 'hub-primary-btn er-card-cta' : 'hub-outline-btn er-card-cta'}
                        style={{ alignSelf: 'center', flexShrink: 0, fontSize: '11.5px', padding: '7px 14px', whiteSpace: 'nowrap' }}
                      >
                        {status.cta} <ArrowRight size={13} />
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {!loadingLive && isSupabaseConfigured && filteredLive && !filteredLive.length && !liveError && (
            <div className="hub-panel hub-empty">
              <BellRing size={22} style={{ color: '#b14933', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No open opportunities in this category right now.</h3>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#5e6c82' }}>
                EduReach lists scholarships and grants only after verification. Message the helpline and we will notify you when new ones open.
              </p>
              <a
                className="hub-primary-btn"
                href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent('Hello EduReach, notify me when new scholarships are listed.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                Notify me <ArrowRight size={13} />
              </a>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              padding: '18px 20px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: '#F9F0EE',
                  color: '#b14933',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Briefcase size={20} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 620, color: '#0f172a' }}>
                  Want to publish a vetted student opportunity or scholarship?
                </h3>
                <p style={{ margin: 0, color: '#5e6c82', fontSize: '12px', lineHeight: 1.4 }}>
                  Verified educational organizations and scholarship boards can list vetted opportunities through EduReach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
