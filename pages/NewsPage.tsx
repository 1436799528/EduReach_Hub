import { ArrowRight, CheckCircle2 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { newsItems } from '../src/data/hubContent';

export default function NewsPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-page-title"><span className="hub-eyebrow">NEWS & OPPORTUNITIES</span><h1>Fast updates. Easy scanning.</h1><p>Compact student-facing news with verified action links where available.</p></div><div className="hub-news-feed">{newsItems.map((item) => <article className="hub-news-feed-row" key={item.slug}><div className="hub-feed-tag">{item.tag}</div><div className="hub-feed-main"><div className="hub-news-meta"><span>{item.date}</span>{item.verified && <span className="hub-verified"><CheckCircle2 size={13}/> Verified</span>}</div><h2>{item.title}</h2><p>{item.excerpt}</p></div><a href={`/news/${item.slug}`} className="hub-outline-btn">Read Story <ArrowRight size={16}/></a></article>)}</div></div></div></HubLayout>;
}
