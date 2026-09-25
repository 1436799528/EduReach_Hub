import { ArrowRight, BookOpen, Newspaper, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchNews, fetchServices, type NewsItem, type ServiceItem } from '../lib/api';
import CardIdentityMark, { identityClassFor } from './CardIdentityMark';

const quickLinks = [
  { label: 'CBT Practice', href: '/cbt', icon: Zap },
  { label: 'Student Services', href: '/services', icon: BookOpen },
  { label: 'News & Updates', href: '/news', icon: Newspaper },
];

function formatDate(value: string | null) {
  if (!value) return 'Update';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HubSideRail() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    void fetchServices().then(setServices).catch(() => setServices([])).finally(() => setLoadingServices(false));
    void fetchNews().then(setNews).catch(() => setNews([])).finally(() => setLoadingNews(false));
  }, []);

  return <aside className="hub-side-rail" aria-label="EduReach student tools">
    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Quick Links</h3><ShieldCheck size={17} /></div>
      <div className="hub-rail-links">{quickLinks.map(({ label, href, icon: Icon }) => <a key={href} href={href}><span><Icon size={16}/>{label}</span><ArrowRight size={14}/></a>)}</div>
    </section>

    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Student Services</h3><BookOpen size={17} /></div>
      {loadingServices && <p className="hub-rail-copy">Loading…</p>}
      {!loadingServices && !services.length && <p className="hub-rail-copy">No services available yet.</p>}
      {!loadingServices && services.length > 0 && <div className="hub-rail-services">
        {services.slice(0, 5).map((service) => (
          <a className={identityClassFor(`${service.service_key} ${service.title}`, 'service')} href={'/services/apply/' + service.service_key} key={service.id}>
            <div className="hub-rail-service-thumb"><CardIdentityMark value={service.service_key} type="service" /></div>
            <span><strong>{service.title}</strong><small>{service.application_url ? 'Guide + official portal' : 'Read guide + request help'}</small></span>
            <ArrowRight size={14}/>
          </a>
        ))}
      </div>}
    </section>

    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Latest Updates</h3><Newspaper size={17} /></div>
      {loadingNews && <p className="hub-rail-copy">Loading…</p>}
      {!loadingNews && !news.length && <p className="hub-rail-copy">No verified updates yet.</p>}
      {!loadingNews && news.length > 0 && <div className="hub-rail-news">
        {news.slice(0, 4).map((item) => (
          <a className={identityClassFor(item.category, 'news')} href={'/news/' + encodeURIComponent(item.slug)} key={item.id}>
            <div className="hub-rail-service-thumb"><CardIdentityMark value={item.category} type="news" /></div>
            <span>{item.category.replaceAll('_', ' ')}</span>
            <strong>{item.title}</strong>
            <small>{formatDate(item.published_at)}</small>
          </a>
        ))}
      </div>}
      {!loadingNews && news.length > 0 && <a className="hub-rail-more" href="/news">See all updates <ArrowRight size={14}/></a>}
    </section>

    <a className="hub-rail-card hub-rail-help hub-click-card" href="/services">
      <BookOpen size={22} />
      <h3>Need help?</h3>
      <p>Read a service guide or open a guided-support form.</p>
      <span>Explore services <ArrowRight size={14}/></span>
    </a>
  </aside>;
}
