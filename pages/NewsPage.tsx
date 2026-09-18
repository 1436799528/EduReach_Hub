import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchNews, type NewsItem } from '../src/lib/api';

function labelFor(category: string) {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Update';
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchNews().then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load news.')).finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact">
      <div><span className="hub-eyebrow">NEWS &amp; UPDATES</span><h1>Latest Updates</h1><p>Verified announcements, campus news and important academic information.</p></div>
      <a className="hub-outline-btn" href="/jobs">Opportunities</a>
    </div>

    {loading && <div className="hub-panel hub-empty">Loading…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !items.length && <div className="hub-panel hub-empty">No verified announcements are published yet.</div>}

    {!loading && !error && items.length > 0 && <div className="hub-news-feed">
      {items.map((item) => (
        <a className="hub-news-feed-row hub-click-card" href={'/news/' + item.id} key={item.id}>
          <div className="hub-news-thumb"><CardIdentityMark value={item.category} type="news" /></div>
          <div className="hub-feed-tag">{labelFor(item.category)}</div>
          <div className="hub-feed-main">
            <div className="hub-news-meta">
              <span>{formatDate(item.published_at)}</span>
              <span className="hub-verified"><CheckCircle2 size={13}/> Verified</span>
            </div>
            <h2>{item.title}</h2>
            <p>{item.summary || ''}</p>
          </div>
          <ArrowRight size={17} className="hub-compact-arrow" />
        </a>
      ))}
    </div>}
  </div></div></HubLayout>;
}
