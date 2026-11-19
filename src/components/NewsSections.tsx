import { ArrowRight } from 'lucide-react';
import type { NewsItem } from '../lib/api';
import { newsCategoryLabel } from '../data/newsCategories';
import { freshnessDate, newsFreshness } from '../lib/newsFreshness';
import OptimizedImage from './OptimizedImage';

export { newsCategoryLabel };

/**
 * The list-row date. Delegates to the shared news formatter and supplies the
 * visible fallback a row needs (the freshness line uses the empty string).
 */
export function formatNewsDate(value: string | null): string {
  return freshnessDate(value) || 'Recent update';
}

function articleHref(item: NewsItem): string {
  return `/news/${encodeURIComponent(item.slug)}`;
}

/**
 * Article image.
 *
 * Every article renders its OWN featured image through the shared pipeline: the
 * Netlify Image CDN serves WebP/AVIF at the size the slot asks for, the original
 * is preserved, and a missing or broken image becomes the neutral placeholder
 * rather than a stock photograph of something else. `NewsImage` never invents an
 * image, and it never claims ownership of a remote one.
 */
export function NewsImage({ item, className, layout = 'card' }: { item: NewsItem; className?: string; layout?: 'card' | 'row' | 'hero' }) {
  const label = newsCategoryLabel(item.category);
  const size = layout === 'row' ? { width: 112, height: 112 } : layout === 'hero' ? { width: 960, height: 540 } : { width: 300, height: 188 };
  return (
    <OptimizedImage
      src={item.image_url}
      alt={`${item.title}, ${label}`}
      width={size.width}
      height={size.height}
      layout={layout}
      className={`er-news-photo ${className || ''}`.trim()}
      placeholderLabel={label}
    />
  );
}

/** Compact Myschool-style news row: thumb + category/date + headline. */
export function NewsRow({ item }: { item: NewsItem }) {
  const freshness = newsFreshness(item);
  const checked = freshnessDate(freshness.checkedOn);
  return (
    <a className={`er-news-row is-${freshness.state}`} href={articleHref(item)}>
      <NewsImage item={item} className="er-news-photo" />
      <span>
        <small>
          {newsCategoryLabel(item.category)} · {formatNewsDate(item.published_at)}
          {item.source_name ? ` · ${item.source_name}` : ''}
        </small>
        <strong>{item.title}</strong>
        {!freshness.current ? (
          <small className="er-news-freshness is-warning">{freshness.label}</small>
        ) : freshness.state === 'stale' || freshness.state === 'unverified' ? (
          <small className="er-news-freshness">
            {freshness.label}
            {checked ? ` ${checked}` : ''}
          </small>
        ) : null}
      </span>
      <ArrowRight size={13} />
    </a>
  );
}

/**
 * News card: image, category · date, headline, summary, source.
 *
 * One calm surface for every story. Colour is not decoration here: eight
 * gradients by category made the board look like a fruit salad, and a reader
 * does not learn anything from a card being plum rather than teal. What the
 * reader needs is a readable headline, the article's own photograph, and an
 * honest date — so the card is white, the type is dark, and the only colour is
 * the category label's muted grey. Order in the grid changes nothing.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  const freshness = newsFreshness(item);
  return (
    <a className={`er-news-card is-${freshness.state}`} href={articleHref(item)}>
      <span className="er-news-card-media"><NewsImage item={item} className="er-news-photo" /></span>
      <span className="er-news-card-body">
        <small className="er-news-card-kicker">
          <span>{newsCategoryLabel(item.category)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.published_at || undefined}>{formatNewsDate(item.published_at)}</time>
        </small>
        <strong>{item.title}</strong>
        {item.summary && <span className="er-news-card-summary">{item.summary}</span>}
        {!freshness.current && (
          <small className="er-news-freshness is-warning">{freshness.label}</small>
        )}
        <span className="er-news-card-foot">
          <span>{item.source_name || 'EduReach updates'}</span>
          <span className="er-news-card-read">
            Read <ArrowRight size={13} aria-hidden="true" />
          </span>
        </span>
      </span>
    </a>
  );
}

/**
 * Featured cards. Only articles explicitly flagged as student-critical in the
 * Newsroom lead; ordinary recency does not promote a story into a highlight.
 */
export function FeaturedNews({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const flagged = items.filter((item) => item.featured);
  // Highlights are editorially selected; routine recency alone is not enough.
  if (!flagged.length) return null;
  const list = flagged.slice(0, 2);
  return (
    <div className="er-featured-grid er-standard-card-grid">
      {list.map((item) => (
        <a key={item.id} className="er-featured-card" href={articleHref(item)}>
          <span className="er-featured-media"><NewsImage item={item} className="er-news-photo" /></span>
          <span className="er-featured-body">
            <small>
              {newsCategoryLabel(item.category)} · {formatNewsDate(item.published_at)}
            </small>
            <strong>{item.title}</strong>
            {item.summary && <small className="er-featured-excerpt">{item.summary}</small>}
            {!newsFreshness(item).current && <small className="er-news-freshness is-warning">{newsFreshness(item).label}</small>}
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
          <a href={articleHref(item)}>
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
