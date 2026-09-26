import { ArrowRight, Newspaper } from 'lucide-react';
import type { NewsItem } from '../lib/api';
import { newsCategoryLabel } from '../data/newsCategories';
import { identityClassFor } from './CardIdentityMark';

export { newsCategoryLabel };

export function formatNewsDate(value: string | null): string {
  if (!value) return 'Recent update';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function articleHref(item: NewsItem): string {
  return `/news/${encodeURIComponent(item.slug)}`;
}

function safeImageSrc(value: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Article image with an honest fallback.
 *
 * Every article renders its OWN featured image. When an article genuinely has
 * no image (or the stored image fails to load), we show an intentional neutral
 * placeholder instead of silently recycling one of the bundled stock photos —
 * that is what made every card look identical before.
 */
export function NewsImage({ item, className }: { item: NewsItem; className?: string }) {
  const src = safeImageSrc(item.image_url);
  const label = newsCategoryLabel(item.category);
  if (!src) {
    return (
      <span className={`er-news-noimage ${className || ''}`} aria-hidden="true">
        <Newspaper size={18} />
        <small>{label}</small>
      </span>
    );
  }
  return (
    <img
      src={src}
      className={className}
      alt={`${item.title} — ${label}`}
      loading="lazy"
      onError={(event) => {
        // Broken media must not masquerade as a generic photo; swap to the
        // intentional placeholder once and stop handling errors.
        const element = event.currentTarget;
        element.onerror = null;
        const placeholder = document.createElement('span');
        placeholder.className = `er-news-noimage ${className || ''}`;
        element.replaceWith(placeholder);
      }}
    />
  );
}

/** Compact Myschool-style news row: thumb + category/date + headline. */
export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a className="er-news-row" href={articleHref(item)}>
      <NewsImage item={item} className="er-news-photo" />
      <span>
        <small>
          {newsCategoryLabel(item.category)} · {formatNewsDate(item.published_at)}
        </small>
        <strong>{item.title}</strong>
      </span>
      <ArrowRight size={13} />
    </a>
  );
}

/**
 * Featured cards. Editorial control first: articles flagged “featured” in the
 * Newsroom lead; when nothing is flagged the two newest stories fill the slot
 * so the section never fabricates a feature state.
 */
export function FeaturedNews({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const flagged = items.filter((item) => item.featured);
  const list = (flagged.length ? flagged : items).slice(0, 2);
  return (
    <div className="er-featured-grid">
      {list.map((item) => (
        <a key={item.id} className="er-featured-card" href={articleHref(item)}>
          <NewsImage item={item} className="er-news-photo" />
          <span className="er-featured-body">
            <small>
              {newsCategoryLabel(item.category)} · {formatNewsDate(item.published_at)}
            </small>
            <strong>{item.title}</strong>
            {item.summary && <small className="er-featured-excerpt">{item.summary}</small>}
          </span>
        </a>
      ))}
    </div>
  );
}

/** Numbered trending list in the Myschool 01–10 style. */
export function TrendingNews({ items, limit = 5 }: { items: NewsItem[]; limit?: number }) {
  const list = items.slice(0, limit);
  if (!list.length) return null;
  return (
    <ol className="er-trend-list">
      {list.map((item, index) => (
        <li key={item.id}>
          <a className={identityClassFor(item.category, 'news')} href={articleHref(item)}>
            <span className="er-trend-num">{String(index + 1).padStart(2, '0')}</span>
            <span className="er-trend-copy">
              <small>
                {newsCategoryLabel(item.category)} · {formatNewsDate(item.published_at)}
              </small>
              <strong>{item.title}</strong>
            </span>
            <ArrowRight size={13} />
          </a>
        </li>
      ))}
    </ol>
  );
}
