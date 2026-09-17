import { ArrowRight, BookOpen, Headphones, Newspaper, ScanSearch, ShieldCheck, Zap } from 'lucide-react';
import { hubServices, newsItems } from '../data/hubContent';

const quickLinks = [
  { label: 'CBT Practice', href: '/cbt', icon: Zap },
  { label: 'Student Services', href: '/services', icon: BookOpen },
  { label: 'Track Request', href: '/services/track', icon: ScanSearch },
  { label: 'News & Updates', href: '/news', icon: Newspaper },
];

export default function HubSideRail() {
  return <aside className="hub-side-rail" aria-label="EduReach student tools">
    <section className="hub-rail-card hub-rail-highlight">
      <span className="hub-eyebrow">STUDENT TOOLS</span>
      <h3>Useful shortcuts, one scroll away.</h3>
      <p>Stay on the page and jump straight to the tool or service you need.</p>
      <a href="/services" className="hub-primary-btn">Explore Services <ArrowRight size={15} /></a>
    </section>

    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Quick Links</h3><ShieldCheck size={17} /></div>
      <div className="hub-rail-links">{quickLinks.map(({ label, href, icon: Icon }) => <a key={href} href={href}><span><Icon size={16}/>{label}</span><ArrowRight size={14}/></a>)}</div>
    </section>

    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Student Services</h3><BookOpen size={17} /></div>
      <div className="hub-rail-services">{hubServices.map((service) => <a href={`/services/apply/${service.slug}`} key={service.slug}><span><strong>{service.short}</strong><small>{service.title}</small></span><ArrowRight size={14}/></a>)}</div>
    </section>

    <section className="hub-rail-card">
      <div className="hub-rail-head"><h3>Latest Updates</h3><Newspaper size={17} /></div>
      <div className="hub-rail-news">{newsItems.slice(0, 4).map((item) => <a href={`/news/${item.slug}`} key={item.slug}><span>{item.tag}</span><strong>{item.title}</strong><small>{item.date}</small></a>)}</div>
      <a className="hub-rail-more" href="/news">See all updates <ArrowRight size={14}/></a>
    </section>

    <section className="hub-rail-card hub-rail-help">
      <Headphones size={22}/>
      <h3>Need help?</h3>
      <p>Use the service tracker after submitting a request or open the service directory for the next step.</p>
      <a href="/services/track">Track a request <ArrowRight size={14}/></a>
    </section>
  </aside>;
}
