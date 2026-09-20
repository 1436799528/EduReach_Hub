import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchServices, type ServiceItem } from '../src/lib/api';

function initialServiceSearch() {
  return new URLSearchParams(window.location.search).get('q') ?? '';
}

export default function ServicesCatalogPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialServiceSearch);
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
      const matchSearch =
        !q || srv.title.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'LOAN') return srv.service_key.includes('nelfund') || srv.service_key.includes('loan');
      if (activeFilter === 'EXAMS')
        return (
          srv.service_key.includes('waec') ||
          srv.service_key.includes('neco') ||
          srv.service_key.includes('result') ||
          srv.service_key.includes('scratch')
        );
      if (activeFilter === 'ADMISSION')
        return (
          srv.service_key.includes('admission') ||
          srv.service_key.includes('slip') ||
          srv.service_key.includes('jamb')
        );
      return true;
    });
  }, [services, search, activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container">
          {/* COMPACT HEADER (NO LARGE HERO) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '14px',
              borderBottom: '2px solid #059669',
            }}
          >
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Services
              </h1>
            </div>

            <a
              className="hub-outline-btn"
              href="/services/track"
              style={{ textDecoration: 'none', fontSize: '12px', padding: '7px 14px' }}
            >
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
              marginBottom: '22px',
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
              <Search size={18} style={{ color: '#059669' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services (e.g. NELFUND, Scratch card, JAMB slip)..."
                style={{ border: 0, outline: 0, width: '100%', fontSize: '13px', color: '#0f172a' }}
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
              {[
                { id: 'ALL', label: 'All Services' },
                { id: 'LOAN', label: 'NELFUND Loans' },
                { id: 'EXAMS', label: 'Result & Scratch Cards' },
                { id: 'ADMISSION', label: 'Admission Letters' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveFilter(cat.id)}
                  style={{
                    border: '1px solid',
                    borderColor: activeFilter === cat.id ? '#059669' : '#e2e8f0',
                    background: activeFilter === cat.id ? '#059669' : '#f8fafc',
                    color: activeFilter === cat.id ? '#ffffff' : '#475569',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.label}
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredServices.map((service) => (
                <a
                  className="ms-service-card"
                  href={'/services/apply/' + service.service_key}
                  key={service.id}
                  style={{ minHeight: '104px' }}
                >
                  <div className="ms-service-card-header">
                    <CardIdentityMark value={`${service.service_key} ${service.title}`} type="service" size="md" />
                  </div>
                  <div className="ms-service-body">
                    <h3 style={{ fontSize: '15px' }}>{service.title}</h3>
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
