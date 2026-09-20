import { ArrowRight, CheckCircle2, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchServices, type ServiceItem } from '../src/lib/api';

export default function ServicesCatalogPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    void fetchServices()
      .then(setServices)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load services.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || srv.title.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'LOAN') return srv.service_key.includes('nelfund') || srv.service_key.includes('loan');
      if (activeFilter === 'EXAMS') return srv.service_key.includes('waec') || srv.service_key.includes('neco') || srv.service_key.includes('result') || srv.service_key.includes('scratch');
      if (activeFilter === 'ADMISSION') return srv.service_key.includes('admission') || srv.service_key.includes('slip') || srv.service_key.includes('jamb');
      return true;
    });
  }, [services, search, activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">EDUREACH CATALOGUE</span>
              <h1 style={{ fontSize: '28px', fontWeight: 900 }}>Verified Student Services</h1>
              <p>Transparent, guided educational services designed for Nigerian tertiary students and admission candidates.</p>
            </div>
            <a className="hub-outline-btn" href="/services/track" style={{ textDecoration: 'none' }}>
              Track Existing Request →
            </a>
          </div>

          {/* SEARCH & CATEGORY FILTER */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
              <Search size={18} style={{ color: '#64748b' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services (e.g. NELFUND, Scratch card, JAMB slip)..."
                style={{ border: 0, outline: 0, width: '100%', fontSize: '13px' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'LOAN', 'EXAMS', 'ADMISSION'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  style={{
                    border: '1px solid',
                    borderColor: activeFilter === cat ? '#2563eb' : '#e2e8f0',
                    background: activeFilter === cat ? '#2563eb' : '#f8fafc',
                    color: activeFilter === cat ? '#ffffff' : '#475569',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat === 'ALL' ? 'All Services' : cat === 'LOAN' ? 'NELFUND Loans' : cat === 'EXAMS' ? 'Result & Scratch Cards' : 'Admission Letters'}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="hub-panel hub-empty">Loading student services…</div>}
          {error && <div className="hub-form-error">{error}</div>}
          {!loading && !error && !filteredServices.length && (
            <div className="hub-panel hub-empty">No student services matched your search filter.</div>
          )}

          {!loading && !error && (
            <div className="hub-service-profile-grid">
              {filteredServices.map((service) => (
                <a
                  className="hub-service-profile-card"
                  href={'/services/apply/' + service.service_key}
                  key={service.id}
                >
                  <div>
                    <div className="hub-service-card-meta">
                      <CardIdentityMark value={service.service_key} type="service" />
                      <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '5px', color: '#059669', fontWeight: 800 }}>
                        <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                        Verified Active
                      </span>
                    </div>
                    <div className="hub-service-profile-body">
                      <h2>{service.title}</h2>
                      <p>{service.description}</p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                      <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                      Direct Assistance
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Apply Now <ArrowRight size={14} className="hub-compact-arrow" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
