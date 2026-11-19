import { useEffect, useState } from 'react';
import { userFacingError } from '../../lib/errors';
import { fetchNews, type NewsItem } from '../lib/api';
import { isArticleCurrent } from '../lib/newsFreshness';
import { EmptyState, ErrorState } from './AsyncState';
import { NewsCard } from './NewsSections';
import SectionHead from './SectionHead';
import { SkeletonRows } from './Skeleton';

/** A small, live preview of the verified news feed on the product home page. */
export default function HomeNewsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchNews()
      .then((news) => {
        if (!active) return;
        setItems(news.filter(isArticleCurrent).slice(0, 3));
      })
      .catch((value) => {
        if (active) setError(userFacingError(value, 'Unable to load the latest news.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retry]);

  return (
    <section className="er-section er-home-news" aria-label="Latest news">
      <SectionHead title="Latest news" href="/news" linkLabel="All news" />
      <div className="er-late-region er-late-region--feed">
        {loading && <SkeletonRows rows={3} label="Loading latest news" />}
        {!loading && error && (
          <ErrorState error={error} onRetry={() => setRetry((value) => value + 1)} />
        )}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="No current news yet"
            detail="Verified education updates will appear here when they are published."
            action={<a className="hub-outline-btn" href="/news">Browse news</a>}
          />
        )}
        {!loading && !error && items.length > 0 && (
          <div className="er-square-grid er-home-news-grid er-standard-card-grid">
            {items.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
