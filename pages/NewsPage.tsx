import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { FeaturedNews, NewsRow } from '../src/components/NewsSections';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { SkeletonRows } from '../src/components/Skeleton';

const filters = [
  { id: 'ALL', label: 'All News' },
  { id: 'jamb', label: 'JAMB Updates' },
  { id: 'admission', label: 'Admission Lists' },
  { id: 'waec', label: 'WAEC News' },
  { id: 'neco', label: 'NECO Updates' },
  { id: 'nelfund', label: 'NELFUND Loan' },
];

function readCategoryFromUrl() {
  if (typeof window === 'undefined') return 'ALL';
  const requested = new URLSearchParams(window.location.search).get('category')?.trim().toLowerCase();
  return filters.some((item) => item.id === requested) ? (requested as string) : 'ALL';
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState(() => readCategoryFromUrl());

  useEffect(() => {
    const syncFilter = () => setActiveFilter(readCategoryFromUrl());
    window.addEventListener('popstate', syncFilter);
    void fetchNews()
      .then(setItems)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load news.'))
      .finally(() => setLoading(false));
    return () => window.removeEventListener('popstate', syncFilter);
  }, []);

  function changeFilter(next: string) {
    setActiveFilter(next);
    window.history.replaceState({}, '', next === 'ALL' ? '/news' : `/news?category=${encodeURIComponent(next)}`);
  }

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) => item.category.toLowerCase().includes(activeFilter.toLowerCase()));
  }, [items, activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841', fontWeight: 800 }}>
                CAMPUS NOTICEBOARD
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 4px' }}>
                News &amp; Updates
              </h1>
            </div>
            <a className="hub-outline-btn" href="/jobs" style={{ textDecoration: 'none', fontSize: '12px' }}>
              Scholarships &amp; Grants →
            </a>
          </div>

          <div style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <FilterPills options={filters} active={activeFilter} onChange={changeFilter} ariaLabel="News categories" />
          </div>

          {loading && <SkeletonRows rows={5} label="Loading updates" />}
          {error && <div className="hub-form-error">{error}</div>}
          {!loading && !error && !filteredItems.length && (
            <div className="hub-panel hub-empty">No announcements found matching this category.</div>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <>
              {activeFilter === 'ALL' && (
                <section className="er-section" style={{ marginTop: 0 }}>
                  <SectionHead title="Featured" />
                  <FeaturedNews items={filteredItems} />
                </section>
              )}
              <section className="er-section" style={{ marginTop: 0 }}>
                <SectionHead title={activeFilter === 'ALL' ? 'Latest stories' : 'Results'} />
                <div className="er-news-list" style={{ display: 'grid', gap: '10px' }}>
                  {(activeFilter === 'ALL' ? filteredItems.slice(2) : filteredItems).map((item) => (
                    <NewsRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
