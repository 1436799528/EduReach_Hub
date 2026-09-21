import { useEffect, useState } from 'react';
import { fetchNews, type NewsItem } from '../lib/api';

/**
 * Site-wide breaking-updates ticker. Headlines scroll continuously and pause
 * on hover or keyboard focus. Renders nothing when no headlines exist.
 */
export default function BreakingTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let active = true;
    void fetchNews()
      .then((news) => active && setItems(news.slice(0, 6)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!items.length) return null;

  const loop = [...items, ...items];
  const duration = Math.max(18, items.length * 7);

  return (
    <div className="er-ticker" role="marquee" aria-label="Breaking education updates">
      <a className="er-ticker-badge" href="/news">
        Breaking
      </a>
      <div className="er-ticker-viewport">
        <div className="er-ticker-track" style={{ animationDuration: `${duration}s` }}>
          {loop.map((item, index) => (
            <a
              key={`${item.id}-${index}`}
              href={`/news/${encodeURIComponent(item.slug)}`}
              aria-hidden={index >= items.length}
              tabIndex={index >= items.length ? -1 : 0}
            >
              {item.title}
            </a>
          ))}
        </div>
      </div>
      <a className="er-ticker-all" href="/news">
        All updates
      </a>
    </div>
  );
}
