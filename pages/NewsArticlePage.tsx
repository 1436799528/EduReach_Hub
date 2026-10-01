import { userFacingError } from '../lib/errors';
import { ArrowLeft, CheckCircle2, ExternalLink, Newspaper, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNews, fetchNewsItem, trackEvent, type NewsItem } from '../src/lib/api';
import { looksLikeHtml, sanitizeRichHtml } from '../src/lib/html-sanitize';
import { newsCategoryLabel } from '../src/data/newsCategories';
import { applySeo, seoForArticle } from '../src/lib/seoMeta';
import { formatNewsDate, NewsRow } from '../src/components/NewsSections';
import { SkeletonArticle } from '../src/components/Skeleton';

function safeContentUrl(value: string | null) {
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

function renderPlainArticleText(text: string) {
  const urlPattern = /(https:\/\/[^\s<]+)/gi;
  return text.split(/\n\s*\n/).filter(Boolean).map((paragraph, paragraphIndex) => {
    const parts = paragraph.split(urlPattern);
    return (
      <p key={`paragraph-${paragraphIndex}`}>
        {parts.map((part, index) => {
          const candidate = part.replace(/[),.;!?]+$/, '');
          const trailing = part.slice(candidate.length);
          const url = safeContentUrl(candidate);
          if (!url) return <span key={`text-${paragraphIndex}-${index}`}>{part}</span>;
          return (
            <span key={`url-${paragraphIndex}-${index}`}>
              <a href={url} target="_blank" rel="noreferrer">{candidate}</a>{trailing}
            </span>
          );
        })}
      </p>
    );
  });
}

export default function NewsArticlePage({ slug }: { slug: string }) {
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [related, setRelated] = useState<NewsItem[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setItem(null);
    void fetchNewsItem(slug)
      .then((article) => {
        if (!active) return;
        setItem(article);
        // AN-1: which articles are actually read, not just listed.
        trackEvent('news_view', { metadata: { slug: article.slug, category: article.category || undefined } });
      })
      .catch((value) => active && setError(userFacingError(value, 'Unable to load this article.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!item) return;
    // Article-level metadata: headline, summary, image, publication dates and
    // the source citation. An expired article is deliberately left uncanonical
    // and noindex so stale deadlines do not keep ranking.
    applySeo(seoForArticle({
      slug: item.slug,
      title: item.title,
      excerpt: item.summary,
      image_url: item.image_url,
      category: item.category,
      source_name: item.source_name,
      published_at: item.published_at,
      updated_at: item.updated_at || item.last_verified_at,
      expires_at: item.expires_at,
      verification_status: item.verification_status,
    }));
  }, [item]);

  useEffect(() => {
    if (!item) return;
    let active = true;
    void fetchNews()
      .then((articles) => {
        if (!active) return;
        const others = articles.filter((article) => article.slug !== item.slug);
        const sameCategory = others.filter((article) => article.category === item.category);
        const rest = others.filter((article) => article.category !== item.category);
        setRelated([...sameCategory, ...rest].slice(0, 4));
      })
      .catch(() => active && setRelated([]));
    return () => { active = false; };
  }, [item]);

  const safeImageUrl = safeContentUrl(item?.image_url || null);
  const safeSourceUrl = safeContentUrl(item?.source_url || null);
  const tags = useMemo(() => item?.tags || [], [item]);

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <a className="hub-text-btn" href="/news" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <ArrowLeft size={14} /> Back to News
          </a>

          {loading && <SkeletonArticle />}
          {error && (
            <div className="hub-panel hub-empty" role="alert">
              <h1>Article not found</h1>
              <p>{error}</p>
              <a className="hub-primary-btn" href="/news" style={{ textDecoration: 'none' }}>Browse news</a>
            </div>
          )}

          {!loading && !error && item && (
            <article className="hub-article">
              <div className="hub-news-meta">
                <span>{newsCategoryLabel(item.category)}</span>
                <span>By {item.author || 'EduReach Editorial Desk'}</span>
                <span>{formatNewsDate(item.published_at)}</span>
                {item.verification_status === 'verified' && <span className="hub-verified"><CheckCircle2 size={13} /> Source checked</span>}
              </div>

              <h1>{item.title}</h1>
              {item.summary && <p className="hub-article-lead">{item.summary}</p>}
              {safeImageUrl ? (
                <img
                  className="er-news-hero"
                  src={safeImageUrl}
                  alt={item.title}
                  fetchPriority="high"
                  decoding="async"
                  onError={(event) => {
                    const element = event.currentTarget;
                    element.onerror = null;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'er-news-hero er-news-noimage er-news-noimage-hero';
                    element.replaceWith(placeholder);
                  }}
                />
              ) : (
                <div className="er-news-hero er-news-noimage er-news-noimage-hero" aria-hidden="true">
                  <Newspaper size={22} />
                  <small>{newsCategoryLabel(item.category)}</small>
                </div>
              )}

              <div className="hub-article-body">
                {looksLikeHtml(item.body)
                  ? <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.body) }} />
                  : renderPlainArticleText(item.body)}
              </div>

              {tags.length > 0 && (
                <div className="hub-article-tags">
                  {tags.map((tag) => <span key={tag} className="hub-tag-chip">{tag}</span>)}
                </div>
              )}

              <div className="hub-verified-box">
                <div>
                  <span className="hub-eyebrow">SOURCE</span>
                  <h3>Source information</h3>
                  <p>
                    {item.author ? `Reported by ${item.author}. ` : ''}
                    {item.last_verified_at
                      ? `Last verified ${new Date(item.last_verified_at).toLocaleString('en-NG')}`
                      : 'Verification date not supplied.'}
                  </p>
                </div>
                {safeSourceUrl ? (
                  <a className="hub-card-link" href={safeSourceUrl} target="_blank" rel="noreferrer">
                    View source <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="hub-muted-label">No source link</span>
                )}
              </div>

              <div className="hub-share-strip">
                <span>Share</span>
                <button
                  type="button"
                  onClick={async () => {
                    setCopyError('');
                    try {
                      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.');
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    } catch (value) {
                      setCopyError(userFacingError(value, 'Unable to copy this link.'));
                    }
                  }}
                >
                  <Share2 size={16} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
                {copyError && <small className="hub-muted-label" role="status">{copyError}</small>}
              </div>

              {related.length > 0 && (
                <section className="er-section" style={{ marginTop: '26px' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px' }}>Related updates</h2>
                  <div className="er-news-list" style={{ display: 'grid', gap: '10px' }}>
                    {related.map((relatedItem) => <NewsRow key={relatedItem.id} item={relatedItem} />)}
                  </div>
                </section>
              )}
            </article>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
