import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNews, type NewsItem } from '../src/lib/api';

function labelFor(category: string) {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchNews().then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'Unable to load news.')).finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-page-title"><span className="hub-eyebrow">NEWS & OPPORTUNITIES</span><h1>Verified academic updates.</h1><p>Student-facing updates are served from the EduReach verification pipeline with source information attached.</p></div>
    {loading && <div className="hub-panel hub-empty">Loading verified updates…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !items.length && <div className="hub-panel hub-empty">No verified announcements are published right now.</div>}
    {!loading && !error && <div className="hub-news-feed">{items.map((item) => <article className="hub-news-feed-row" key={item.id}><div className="hub-feed-tag">{labelFor(item.category)}</div><div className="hub-feed-main"><div className="hub-news-meta"><span>{item.published_at ? new Date(item.published_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Update'}</span><span className="hub-verified"><CheckCircle2 size={13}/> Verified</span></div><h2>{item.title}</h2><p>{item.summary || 'Verified EduReach update.'}</p></div><a href={`/news/${item.id}`} className="hub-outline-btn">Read Story <ArrowRight size={16}/></a></article>)}</div>}
  </div></div></HubLayout>;
}
