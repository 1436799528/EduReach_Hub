import { ArrowRight, Briefcase, MapPin, Tag } from 'lucide-react';
import { useState, useMemo } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { jobs } from '../src/data/hubContent';

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const filteredJobs = useMemo(() => {
    if (activeFilter === 'ALL') return jobs;
    return jobs.filter((item) =>
      item.type.toLowerCase().includes(activeFilter.toLowerCase()) ||
      item.title.toLowerCase().includes(activeFilter.toLowerCase())
    );
  }, [activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#059669', fontWeight: 800 }}>
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

          {/* FILTER PILLS */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '18px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {[
              { id: 'ALL', label: 'All Listings' },
              { id: 'scholarship', label: 'Scholarships' },
              { id: 'internship', label: 'Internships' },
              { id: 'campus', label: 'Campus Roles' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  border: '1px solid',
                  borderColor: activeFilter === tab.id ? '#059669' : '#e2e8f0',
                  background: activeFilter === tab.id ? '#059669' : '#ffffff',
                  color: activeFilter === tab.id ? '#ffffff' : '#475569',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hub-news-feed" style={{ display: 'grid', gap: '12px' }}>
            {filteredJobs.map((item, index) => (
              <div
                key={index}
                className="hub-news-feed-row hub-click-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  cursor: 'default',
                }}
              >
                <div className="hub-news-thumb" style={{ flexShrink: 0 }}>
                  <CardIdentityMark value="jobs" type="content" size="sm" />
                </div>
                <div className="hub-feed-main" style={{ flex: 1, minWidth: 0 }}>
                  <div className="hub-news-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: '#059669' }}>
                      <Tag size={11} /> {item.type}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <MapPin size={11} /> {item.mode}
                    </span>
                    <span>•</span>
                    <span className="hub-verified" style={{ color: '#059669' }}>Verified</span>
                  </div>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px', lineHeight: 1.35 }}>
                    {item.title}
                  </h2>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                    {item.note}
                  </p>
                </div>
                <a
                  href="/services"
                  className="hub-primary-btn"
                  style={{
                    alignSelf: 'center',
                    flexShrink: 0,
                    textDecoration: 'none',
                    fontSize: '11.5px',
                    padding: '7px 14px',
                    background: '#059669',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Apply <ArrowRight size={13} />
                </a>
              </div>
            ))}
          </div>

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
                  background: '#ecfdf5',
                  color: '#059669',
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
