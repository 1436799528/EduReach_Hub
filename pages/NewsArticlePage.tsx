import { ArrowLeft, CheckCircle2, ExternalLink, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNewsItem, type NewsItem } from '../src/lib/api';
import { SkeletonArticle } from '../src/components/Skeleton';

function labelFor(category: string) {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NewsArticlePage({ slug }: { slug: string }) {
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    void fetchNewsItem(slug)
      .then(setItem)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load this article.'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <a className="hub-back-link" href="/news">
            <ArrowLeft size={16} /> News
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
                <span>{labelFor(item.category)}</span>
                <span>
                  {item.published_at
                    ? new Date(item.published_at).toLocaleDateString('en-NG', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Update'}
                </span>
                <span className="hub-verified">
                  <CheckCircle2 size={13} /> Published
                </span>
              </div>

              <h1>{item.title}</h1>
              {item.summary && <p className="hub-article-lead">{item.summary}</p>}
              {item.image_url && <img className="er-news-hero" src={item.image_url} alt={item.title} />}

              <div className="hub-article-body">
                {item.body
                  .split(/\n\s*\n/)
                  .filter(Boolean)
                  .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>

              <div className="hub-verified-box">
                <div>
                  <span className="hub-eyebrow">SOURCE</span>
                  <h3>Source information</h3>
                  <p>
                    {item.last_verified_at
                      ? `Last verified ${new Date(item.last_verified_at).toLocaleString('en-NG')}`
                      : 'Verification date not supplied.'}
                  </p>
                </div>
                {item.source_url ? (
                  <a className="hub-card-link" href={item.source_url} target="_blank" rel="noreferrer">
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
            </article>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
