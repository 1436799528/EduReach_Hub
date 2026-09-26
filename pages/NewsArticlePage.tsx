import { ArrowLeft, CheckCircle2, ExternalLink, Newspaper, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNews, fetchNewsItem, type NewsItem } from '../src/lib/api';
import { looksLikeHtml, sanitizeRichHtml } from '../src/lib/html-sanitize';
import { newsCategoryLabel } from '../src/data/newsCategories';
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
      .then((article) => active && setItem(article))
      .catch((value) => active && setError(value instanceof Error ? value.message : 'Unable to load this article.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  // Related reading comes from the same published source as the listings —
  // same-category stories first, then the newest remaining articles.
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
                  onError={(event) => {
                    // Never swap a broken article image for a generic photo —
                    // replace it with the intentional no-image placeholder.
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
                  ? // Rich bodies are authored in the admin CMS and sanitized
                    // with a strict allowlist at render time.
                    <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.body) }} />
                  : item.body
                    .split(/\n\s*\n/)
                    .filter(Boolean)
                    .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
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
                      setCopyError(value instanceof Error ? value.message : 'Unable to copy this link.');
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
