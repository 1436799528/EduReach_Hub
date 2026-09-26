import { ArrowRight, BellRing, Briefcase, MapPin, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { EDUREACH_WHATSAPP, jobApplyHref, jobs } from '../src/data/hubContent';
import { fetchOpportunities, type Opportunity } from '../src/lib/api';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { looksLikeHtml, sanitizeRichHtml } from '../src/lib/html-sanitize';

const filters = [
  { id: 'ALL', label: 'All Listings' },
  { id: 'scholarship', label: 'Scholarships & Grants' },
  { id: 'internship', label: 'Internships' },
  { id: 'campus', label: 'Campus Roles' },
  { id: 'part-time', label: 'Part-time' },
];

function readOpportunityFilter() {
  const value = new URLSearchParams(window.location.search).get('category') || 'ALL';
  return filters.some((item) => item.id === value) ? value : 'ALL';
}

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState(readOpportunityFilter);
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

  function changeFilter(next: string) {
    setActiveFilter(next);
    window.history.replaceState({}, '', next === 'ALL' ? '/jobs' : `/jobs?category=${encodeURIComponent(next)}`);
  }

  // Two listing sources, never mixed: with a configured backend the admin-
  // managed `opportunities` table is the only source; local preview shows the
  // static directory instead (labelled on the cards).
  const filteredLive = useMemo(() => {
    if (live === null) return null;
    if (activeFilter === 'ALL') return live;
    return live.filter((item) => item.category === activeFilter);
  }, [live, activeFilter]);

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
              <span className="hub-eyebrow" style={{ color: '#C85841', fontWeight: 800 }}>
                STUDENT OPPORTUNITIES &amp; GRANTS
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 4px' }}>
                Student Opportunities &amp; Grants
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Browse the currently configured student opportunities. Grants and scholarships appear only when their source, eligibility and application route have been checked.
              </p>
            </div>
            <a className="hub-outline-btn" href="/news" style={{ textDecoration: 'none', fontSize: '12px' }}>
              News &amp; Updates →
            </a>
          </div>

          <div style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <FilterPills options={filters} active={activeFilter} onChange={changeFilter} ariaLabel="Opportunity categories" />
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
            <strong>Catalogue note:</strong> there are no fabricated “all grants” results here. If a scholarship or grant is not in the filtered list, select the Scholarships & Grants filter for the notify option and confirm any opportunity on the organiser’s official channel before sharing documents or paying a fee.
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
              <BellRing size={22} style={{ color: '#C85841', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No verified scholarships listed right now.</h3>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
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
                  <div
                    key={item.title}
                    className={`er-opportunity-card ${identityClassFor(`${item.category} ${item.title}`, 'content')}`}
                    style={{
                      display: 'flex',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: '#C85841' }}>
                          <Tag size={11} /> {item.type}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={11} /> {item.mode}
                        </span>
                        <span>•</span>
                        <span style={{ color: '#64748b', fontWeight: 700 }}>Active EduReach listing</span>
                      </div>
                      <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px', lineHeight: 1.35 }}>
                        {item.title}
                      </h2>
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                        {item.note}
                      </p>
                    </div>
                    <a
                      href={jobApplyHref(item.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hub-primary-btn"
                      style={{ alignSelf: 'center', flexShrink: 0, textDecoration: 'none', fontSize: '11.5px', padding: '7px 14px', whiteSpace: 'nowrap' }}
                    >
                      Apply <ArrowRight size={13} />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!loadingLive && isSupabaseConfigured && filteredLive && filteredLive.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead title={`${filteredLive.length} open listing${filteredLive.length === 1 ? '' : 's'}`} />
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredLive.map((item) => (
                  <div
                    key={item.id}
                    className={`er-opportunity-card ${identityClassFor(`${item.category} ${item.title}`, 'content')}`}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}
                  >
                    <div className="hub-news-thumb" style={{ flexShrink: 0 }}>
                      <CardIdentityMark value={`${item.title} ${item.category} ${item.organisation || ''}`} type="content" size="sm" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: '#C85841' }}>
                          <Tag size={11} /> {item.category}
                        </span>
                        {item.deadline && (<><span>•</span><span style={{ fontWeight: 700 }}>Closes {item.deadline}</span></>)}
                        {item.locations && (<><span>•</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} /> {item.locations}</span></>)}
                      </div>
                      <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px', lineHeight: 1.35 }}>{item.title}</h2>
                      {item.organisation && <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 4px', fontWeight: 700 }}>{item.organisation}</p>}
                      {looksLikeHtml(item.description || '')
                        ? <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.description || '') }} />
                        : <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{item.description}</p>}
                    </div>
                    <a
                      href={item.link_url || jobApplyHref(item.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hub-primary-btn"
                      style={{ alignSelf: 'center', flexShrink: 0, textDecoration: 'none', fontSize: '11.5px', padding: '7px 14px', whiteSpace: 'nowrap' }}
                    >
                      {item.link_url ? 'Official link' : 'Apply'} <ArrowRight size={13} />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!loadingLive && isSupabaseConfigured && filteredLive && !filteredLive.length && !liveError && (
            <div className="hub-panel hub-empty">
              <BellRing size={22} style={{ color: '#C85841', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No open opportunities in this category right now.</h3>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
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
                  color: '#C85841',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Briefcase size={20} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Want to publish a vetted student opportunity or scholarship?
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px', lineHeight: 1.4 }}>
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
