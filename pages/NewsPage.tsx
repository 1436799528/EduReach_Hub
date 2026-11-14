import { userFacingError } from '../lib/errors';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import SectionHead from '../src/components/SectionHead';
import { FeaturedNews, NewsCard } from '../src/components/NewsSections';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { newsCategories, newsCategoryLabel, newsCategoryMatches, newsCategorySlug } from '../src/data/newsCategories';
import { matchesSearch } from '../src/lib/searchMatch';
import { SkeletonRows } from '../src/components/Skeleton';
import { isArticleCurrent } from '../src/lib/newsFreshness';
import FilterSearch from '../src/components/ui/FilterSearch';

// Category pills are the shared database-driven category list (the same slugs
// the Admin Newsroom writes), so public filtering and admin authoring can
// never drift apart.
const filters = [
  { id: 'ALL', label: 'All News' },
  ...newsCategories.map((category) => ({ id: category.slug, label: category.label })),
];

// Legacy deep links (/news?category=admission, /news?category=funding, …) keep
// resolving to the current slugs through the shared canonicaliser - the same one
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
    if (!query.trim()) return byCategory;
    // Tokenised matching (same helper as site search): word order and
    // punctuation do not matter, every word must appear somewhere.
    return byCategory.filter((item) => matchesSearch(
      [item.title, item.summary, item.source_name, item.category, newsCategoryLabel(item.category), ...(item.tags || [])],
      query,
    ));
  }, [items, activeFilter, query]);

  // Expired and superseded stories are removed from the public board; the
  // remaining cards are ordered newest first.
  const orderedItems = useMemo(
    () => [...filteredItems]
      .filter(isArticleCurrent)
      .sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()),
    [filteredItems],
  );

  // The “Latest stories” list shows every published article. Only explicitly
  // highlighted stories (maximum two) are excluded to avoid duplicate cards.
  const latestItems = useMemo(() => {
    const featuredIds = new Set(orderedItems.filter((item) => item.featured).slice(0, 2).map((item) => item.id));
    return orderedItems.filter((item) => !featuredIds.has(item.id));
  }, [orderedItems]);

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
            <label className="er-library-search" style={{ maxWidth: '260px' }}>
              <span style={{ fontSize: '12px', fontWeight: 560 }}>Category</span>
              <select value={activeFilter} onChange={(event) => changeFilter(event.target.value)} aria-label="News category">
                {filters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {/* UI-5: one shared filter field, instead of a page-local copy. */}
            <div style={{ marginTop: '12px', width: '100%', maxWidth: '420px' }}>
              <FilterSearch
                value={query}
                onChange={setQuery}
                label="Search news"
                placeholder="Search headlines, sources, tags"
                clearLabel="Clear news search"
              />
            </div>
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
                    ? 'No current announcements match this category yet. Expired notices are removed.'
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
                    <div className="er-news-card-grid">
                      {latestItems.map((item) => (
                        <NewsCard key={item.id} item={item} />
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
