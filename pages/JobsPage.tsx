import { ArrowRight, BellRing, Briefcase, MapPin, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { EDUREACH_WHATSAPP, jobApplyHref, jobs } from '../src/data/hubContent';

const filters = [
  { id: 'ALL', label: 'All Listings' },
  { id: 'scholarship', label: 'Scholarships & Grants' },
  { id: 'internship', label: 'Internships' },
  { id: 'campus', label: 'Campus Roles' },
  { id: 'part-time', label: 'Part-time' },
];

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const filteredJobs = useMemo(() => {
    if (activeFilter === 'ALL') return jobs;
    return jobs.filter((item) => item.category === activeFilter);
  }, [activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#D9381E', fontWeight: 800 }}>
                STUDENT OPPORTUNITIES &amp; GRANTS
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 4px' }}>
                Scholarships, Grants &amp; Careers
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Verified tertiary scholarships, undergraduate bursaries, and campus student work opportunities.
              </p>
            </div>
            <a className="hub-outline-btn" href="/news" style={{ textDecoration: 'none', fontSize: '12px' }}>
              News &amp; Updates →
            </a>
          </div>

          <div style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <FilterPills options={filters} active={activeFilter} onChange={setActiveFilter} ariaLabel="Opportunity categories" />
          </div>

          {!filteredJobs.length && (
            <div className="hub-panel hub-empty">
              <BellRing size={22} style={{ color: '#D9381E', marginBottom: '8px' }} />
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

          {filteredJobs.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead title={`${filteredJobs.length} open listing${filteredJobs.length === 1 ? '' : 's'}`} />
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredJobs.map((item) => (
                  <div
                    key={item.title}
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: '#D9381E' }}>
                          <Tag size={11} /> {item.type}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={11} /> {item.mode}
                        </span>
                        <span>•</span>
                        <span className="hub-verified">Verified</span>
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
                  background: '#FFF0E6',
                  color: '#D9381E',
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
