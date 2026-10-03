import { userFacingError } from '../lib/errors';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { FeaturedNews, NewsRow } from '../src/components/NewsSections';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { newsCategories, newsCategoryMatches, newsCategorySlug } from '../src/data/newsCategories';
import { SkeletonRows } from '../src/components/Skeleton';
import { newsFreshness } from '../src/lib/newsFreshness';
import { Search, X } from 'lucide-react';

// Category pills are the shared database-driven category list (the same slugs
// the Admin Newsroom writes), so public filtering and admin authoring can
// never drift apart.
const filters = [
  { id: 'ALL', label: 'All News' },
  ...newsCategories.map((category) => ({ id: category.slug, label: category.label })),
];

// Legacy deep links (/news?category=admission, /news?category=funding, …) keep
// resolving to the current slugs through the shared canonicaliser — the same one
// the filter and the database use, so there is no third spelling to maintain.
function readCategoryFromUrl() {
  if (typeof window === 'undefined') return 'ALL';
  const raw = new URLSearchParams(window.location.search).get('category')?.trim();
  if (!raw) return 'ALL';
  const requested = newsCategorySlug(raw);
  return filters.some((item) => item.id === requested) ? requested : 'ALL';
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState(() => readCategoryFromUrl());
  const [query, setQuery] = useState(() => (typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') || '')));

  async function loadNews() {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchNews());
    } catch (value) {
      setError(userFacingError(value, 'Unable to load news.'));
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
    const byCategory = activeFilter === 'ALL' ? items : items.filter((item) => newsCategoryMatches(item.category, activeFilter));
    const needle = query.trim().toLowerCase();
    if (!needle) return byCategory;
    return byCategory.filter((item) => [item.title, item.summary, item.source_name, item.category, ...(item.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle));
  }, [items, activeFilter, query]);

  // Expired or superseded stories are listed after current ones rather than
  // hidden: a student searching for a closed deadline must still find it.
  const orderedItems = useMemo(
    () => [...filteredItems].sort((a, b) => Number(newsFreshness(b).current) - Number(newsFreshness(a).current)),
    [filteredItems],
  );

  // The “Latest stories” list shows every published article; the two feature
  // cards are already rendered above, so they are excluded there to avoid
  // showing the same story twice back-to-back.
  const latestItems = useMemo(() => {
    if (activeFilter !== 'ALL') return orderedItems;
    const flagged = orderedItems.filter((item) => item.featured);
    const featuredIds = new Set((flagged.length ? flagged : orderedItems).slice(0, 2).map((item) => item.id));
    return orderedItems.filter((item) => !featuredIds.has(item.id));
  }, [activeFilter, orderedItems]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933', fontWeight: 560 }}>
                CAMPUS NOTICEBOARD
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 680, color: '#0f172a', margin: '2px 0 4px' }}>
                News &amp; Updates
              </h1>
            </div>
            <a className="hub-outline-btn" href="/jobs" style={{ textDecoration: 'none', fontSize: '12px' }}>
              Scholarships &amp; Grants →
            </a>
          </div>

          <div style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
            <FilterPills options={filters} active={activeFilter} onChange={changeFilter} ariaLabel="News categories" />
            <label className="er-library-search" style={{ marginTop: '12px', maxWidth: '420px', width: '100%' }}>
              <Search size={17} aria-hidden="true" />
              <span className="er-visually-hidden">Search news</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search headlines, sources, tags"
                aria-label="Search news"
              />
              {query && (
                <button type="button" className="er-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div className="er-late-region er-late-region--feed-page">
            {loading && <SkeletonRows rows={5} label="Loading updates" />}
            {error && (
              <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span>{error}</span>
                <button type="button" className="hub-outline-btn" onClick={() => void loadNews()} disabled={loading}>Try again</button>
              </div>
            )}
            {!loading && !error && !orderedItems.length && (
              <div className="hub-panel hub-empty">
                {query.trim()
                  ? `Nothing matches “${query.trim()}”${activeFilter === 'ALL' ? '' : ' in this category'}. Clear the search or try another category.`
                  : items.length
                    ? 'No announcements match this category yet. The category is real — nothing has been published under it.'
                    : 'No news content available yet. Verified education updates are published here as soon as they are ready.'}
              </div>
            )}

            {!loading && !error && orderedItems.length > 0 && (
              <>
                {activeFilter === 'ALL' && (
                  <section className="er-section" style={{ marginTop: 0 }}>
                    <SectionHead title="Featured" />
                    <FeaturedNews items={orderedItems} />
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
      </div>
    </HubLayout>
  );
}
