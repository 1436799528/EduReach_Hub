import { ArrowRight } from 'lucide-react';
import type { NewsItem } from '../lib/api';

export function newsThumbFor(category: string): string {
  const value = (category || '').toLowerCase();
  if (value.includes('jamb')) return '/news/jamb.svg';
  if (value.includes('waec') || value.includes('result')) return '/news/waec.svg';
  if (value.includes('neco')) return '/news/neco.svg';
  if (value.includes('nelfund') || value.includes('fund') || value.includes('scholar') || value.includes('grant') || value.includes('loan'))
    return '/news/funding.svg';
  if (value.includes('admission') || value.includes('screen')) return '/news/admission.svg';
  return '/news/education.svg';
}

export function newsCategoryLabel(category: string): string {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatNewsDate(value: string | null): string {
  if (!value) return 'Recent update';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function articleHref(item: NewsItem): string {
  return `/news/${encodeURIComponent(item.slug)}`;
}

/** Compact Myschool-style news row: thumb + category/date + headline. */
export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a className="er-news-row" href={articleHref(item)}>
      <img src={newsThumbFor(item.category)} alt="" loading="lazy" />
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

/** Two featured cards with banner art, category, date and excerpt. */
export function FeaturedNews({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  return (
    <div className="er-featured-grid">
      {items.slice(0, 2).map((item) => (
        <a key={item.id} className="er-featured-card" href={articleHref(item)}>
          <img src={newsThumbFor(item.category)} alt="" loading="lazy" />
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
