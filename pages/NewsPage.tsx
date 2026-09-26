import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { FeaturedNews, NewsRow } from '../src/components/NewsSections';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { newsCategories, newsCategoryMatches } from '../src/data/newsCategories';
import { SkeletonRows } from '../src/components/Skeleton';

// Category pills are the shared database-driven category list (the same slugs
// the Admin Newsroom writes), so public filtering and admin authoring can
// never drift apart.
const filters = [
  { id: 'ALL', label: 'All News' },
  ...newsCategories.map((category) => ({ id: category.slug, label: category.label })),
];

// Legacy deep links (/news?category=admission, …) keep resolving to the
// current category slugs instead of falling through to “All News”.
const legacyCategoryAliases: Record<string, string> = {
  admission: 'admissions',
  funding: 'scholarships',
  campus: 'school-updates',
};

function readCategoryFromUrl() {
  if (typeof window === 'undefined') return 'ALL';
  const raw = new URLSearchParams(window.location.search).get('category')?.trim().toLowerCase();
  if (!raw) return 'ALL';
  const requested = legacyCategoryAliases[raw] || raw;
  return filters.some((item) => item.id === requested) ? requested : 'ALL';
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState(() => readCategoryFromUrl());

  async function loadNews() {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchNews());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load news.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const syncFilter = () => setActiveFilter(readCategoryFromUrl());
    window.addEventListener('popstate', syncFilter);
    void loadNews();
    return () => window.removeEventListener('popstate', syncFilter);
  }, []);

  function changeFilter(next: string) {
    setActiveFilter(next);
    window.history.replaceState({}, '', next === 'ALL' ? '/news' : `/news?category=${encodeURIComponent(next)}`);
  }

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) => newsCategoryMatches(item.category, activeFilter));
  }, [items, activeFilter]);

  // The “Latest stories” list shows every published article; the two feature
  // cards are already rendered above, so they are excluded there to avoid
  // showing the same story twice back-to-back.
  const latestItems = useMemo(() => {
    if (activeFilter !== 'ALL') return filteredItems;
    const flagged = filteredItems.filter((item) => item.featured);
    const featuredIds = new Set((flagged.length ? flagged : filteredItems).slice(0, 2).map((item) => item.id));
    return filteredItems.filter((item) => !featuredIds.has(item.id));
  }, [activeFilter, filteredItems]);

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
          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>{error}</span>
              <button type="button" className="hub-outline-btn" onClick={() => void loadNews()} disabled={loading}>Try again</button>
            </div>
          )}
          {!loading && !error && !filteredItems.length && (
            <div className="hub-panel hub-empty">
              {items.length
                ? 'No announcements found matching this category.'
                : 'No news content available yet. Verified education updates are published here as soon as they are ready.'}
            </div>
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
                {latestItems.length > 0 ? (
                  <div className="er-news-list" style={{ display: 'grid', gap: '10px' }}>
                    {latestItems.map((item) => (
                      <NewsRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="hub-panel hub-empty">No additional stories yet.</div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
