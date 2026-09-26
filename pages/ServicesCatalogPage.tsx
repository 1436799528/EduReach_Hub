import { MessageSquare, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import ServiceCard from '../src/components/ServiceCard';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { fetchServices, type ServiceItem } from '../src/lib/api';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import { SkeletonRows } from '../src/components/Skeleton';

function initialServiceSearch() {
  return new URLSearchParams(window.location.search).get('q') ?? '';
}

function initialServiceFilter() {
  return new URLSearchParams(window.location.search).get('filter') ?? 'ALL';
}

export default function ServicesCatalogPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialServiceSearch);
  const [activeFilter, setActiveFilter] = useState(initialServiceFilter);

  async function loadServices() {
    setLoading(true);
    setError('');
    try {
      setServices(await fetchServices());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load services.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      setSearch(initialServiceSearch());
      setActiveFilter(initialServiceFilter());
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  // Category pills are derived from the live catalogue itself (the admin-
  // managed category field), so new categories appear without a code change.
  const filters = useMemo(() => {
    const categories = Array.from(new Set(services.map((srv) => srv.category?.trim() || 'Services')));
    return [
      { id: 'ALL', label: 'All Services' },
      ...categories.map((category) => ({ id: category, label: category })),
    ];
  }, [services]);

  useEffect(() => {
    if (activeFilter !== 'ALL' && !filters.some((item) => item.id === activeFilter)) setActiveFilter('ALL');
  }, [filters, activeFilter]);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q || srv.title.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (activeFilter === 'ALL') return true;
      return (srv.category?.trim() || 'Services') === activeFilter;
    });
  }, [services, search, activeFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    if (activeFilter !== 'ALL') params.set('filter', activeFilter);
    else params.delete('filter');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', query ? `/services?${query}` : '/services');
    if (!search.trim() || !filteredServices.length) return;
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('.er-service-card');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('is-search-focus');
      window.setTimeout(() => target?.classList.remove('is-search-focus'), 1800);
    });
  }, [activeFilter, filteredServices, search]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '14px',
              borderBottom: '2px solid #C85841',
            }}
          >
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841', fontWeight: 800 }}>
                STUDENT SERVICES
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>
                Services
              </h1>
            </div>
            <a className="hub-outline-btn" href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent('Hello EduReach, I need help choosing a student service.')}`} target="_blank" rel="noopener noreferrer"><MessageSquare size={14} /> Talk to Us</a>
          </div>

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
              <Search size={18} style={{ color: '#C85841' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services (e.g. NELFUND, result checking, JAMB slip)..."
                aria-label="Search services"
                style={{ border: 0, outline: 0, width: '100%', fontSize: '13px', color: '#0f172a' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                >
                  ×
                </button>
              )}
            </div>

            <FilterPills options={filters} active={activeFilter} onChange={setActiveFilter} ariaLabel="Service categories" />
          </div>

          {loading && <SkeletonRows rows={4} label="Loading student services" />}
          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>{error}</span>
              <button type="button" className="hub-outline-btn" onClick={() => void loadServices()} disabled={loading}>Try again</button>
            </div>
          )}
          {!loading && !error && !filteredServices.length && (
            <div className="hub-panel hub-empty">No student services matched your search filter.</div>
          )}

          {!loading && !error && filteredServices.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead
                title={`${filteredServices.length} active service${filteredServices.length === 1 ? '' : 's'}`}
                href="/services"
                linkLabel="Browse all services"
              />
              <div className="er-service-grid">
                {filteredServices.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
