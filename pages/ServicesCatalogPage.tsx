import { userFacingError } from '../lib/errors';
import { MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import ServiceCard from '../src/components/ServiceCard';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { fetchServices, type ServiceItem } from '../src/lib/api';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import { SkeletonRows } from '../src/components/Skeleton';
import FilterSearch from '../src/components/ui/FilterSearch';
import { matchesSearch } from '../src/lib/searchMatch';

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
      setError(userFacingError(value, 'Unable to load services.'));
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
      if (!matchesSearch([srv.title, srv.description, srv.category, srv.service_key], search)) return false;
      if (activeFilter === 'ALL') return true;
      return (srv.category?.trim() || 'Services') === activeFilter;
    });
  }, [services, search, activeFilter]);

  const serviceSuggestions = useMemo(() => services.map((srv) => ({
    id: srv.id || srv.service_key || srv.title,
    title: srv.title,
    description: srv.description,
    category: srv.category || 'Student service',
    keywords: [srv.service_key, srv.route],
  })), [services]);

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
    <HubLayout
      customSearch={
        <FilterSearch
          className="er-header-filter-search"
          value={search}
          onChange={setSearch}
          label="Search services"
          placeholder="Search services (e.g. NELFUND)..."
          clearLabel="Clear service search"
          suggestionItems={serviceSuggestions}
          suggestionLabel="Service suggestions"
        />
      }
    >
      <div className="hub-page er-comfort-page">
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
              borderBottom: '2px solid #b14933',
            }}
          >
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933', fontWeight: 560 }}>
                STUDENT SERVICES
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 680, color: '#0f172a', margin: '2px 0 0' }}>
                Services
              </h1>
            </div>
            <a className="hub-outline-btn" href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent('Hello EduReach, I need help choosing a student service.')}`} target="_blank" rel="noopener noreferrer"><MessageSquare size={14} /> Talk to Us</a>
          </div>

          {/* The header field is desktop-only; the same suggestion-backed field
              stays reachable in the page body on a phone. */}
          <div className="er-services-mobile-search" style={{ marginBottom: 14 }}>
            <FilterSearch
              value={search}
              onChange={setSearch}
              label="Search services on mobile"
              placeholder="Search services (e.g. NELFUND)..."
              clearLabel="Clear service search"
              suggestionItems={serviceSuggestions}
              suggestionLabel="Service suggestions"
            />
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
            <div className="hub-panel hub-empty">
              <h3>{search.trim() ? 'No matching service' : 'No services published yet'}</h3>
              <p>
                {search.trim()
                  ? `No service matches "${search.trim()}". Try a different keyword, or clear the search to see everything.`
                  : 'Services appear here as they are published. If you need help with something specific, reach out on WhatsApp.'}
              </p>
              {search.trim() && (
                <button type="button" className="hub-outline-btn" onClick={() => setSearch('')}>Clear search</button>
              )}
            </div>
          )}

          {!loading && !error && filteredServices.length > 0 && (
            <section className="er-section" style={{ marginTop: 0 }}>
              <SectionHead
                title={`${filteredServices.length} active service${filteredServices.length === 1 ? '' : 's'}`}
                href="/services"
                linkLabel="Browse all services"
              />
              <div className="er-square-grid er-service-grid">
                {filteredServices.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
