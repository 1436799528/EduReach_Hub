import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { newsCardImage } from '../src/lib/cardTheme';

function labelFor(category: string) { return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchNews().then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load news.')).finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">NEWS</span><h1>Latest Updates</h1></div></div>
    {loading && <div className="hub-panel hub-empty">Loading…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !items.length && <div className="hub-panel hub-empty">No verified announcements are published yet.</div>}
    {!loading && !error && items.length > 0 && <div className="hub-news-feed">{items.map((item) => <article className="hub-news-feed-row" key={item.id}><div className="hub-news-thumb"><img src={newsCardImage(item.category)} alt="" loading="lazy" /></div><div className="hub-feed-tag">{labelFor(item.category)}</div><div className="hub-feed-main"><div className="hub-news-meta"><span>{item.published_at ? new Date(item.published_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Update'}</span><span className="hub-verified"><CheckCircle2 size={13}/> Verified</span></div><h2>{item.title}</h2><p>{item.summary || ''}</p></div><a href={`/news/${item.id}`} className="hub-outline-btn">Read <ArrowRight size={16} /></a></article>)}</div>}
  </div></div></HubLayout>;
}
