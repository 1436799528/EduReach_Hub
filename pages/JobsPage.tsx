import { ArrowRight, Briefcase, MapPin, Tag } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { jobs } from '../src/data/hubContent';

export default function JobsPage() {
  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">STUDENT OPPORTUNITIES</span>
              <h1>Opportunities & Careers</h1>
              <p>Internships, campus roles, volunteer positions, and verified scholarship listings.</p>
            </div>
            <a className="hub-outline-btn" href="/news">
              News & Updates
            </a>
          </div>

          <div className="hub-news-feed" style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
            {jobs.map((item, index) => (
              <div
                key={index}
                className="hub-news-feed-row hub-click-card"
                style={{ cursor: 'default' }}
              >
                <div className="hub-news-thumb">
                  <CardIdentityMark value="jobs" type="content" />
                </div>
                <div className="hub-feed-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={12} /> {item.type}
                </div>
                <div className="hub-feed-main">
                  <div className="hub-news-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {item.mode}
                    </span>
                    <span className="hub-verified">Verified Opportunity</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.note}</p>
                </div>
                <a
                  href="/services"
                  className="hub-outline-btn"
                  style={{ alignSelf: 'center', flexShrink: 0, textDecoration: 'none' }}
                >
                  Apply <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>

          <div className="hub-panel" style={{ marginTop: '24px', padding: '18px 20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Briefcase size={20} style={{ color: 'var(--hub-blue)' }} />
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>Want to list an opportunity or scholarship?</h3>
                <p style={{ margin: 0, color: 'var(--hub-muted)', fontSize: '12px' }}>
                  Verified educational organizations and student societies can publish vetted opportunities through EduReach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
