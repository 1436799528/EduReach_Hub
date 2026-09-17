import { ArrowRight, CheckCircle2, CircleAlert, CircleDollarSign, FileText, KeyRound, Newspaper, Printer } from 'lucide-react';
import { hubServices, newsItems } from '../src/data/hubContent';
import HubLayout from '../src/components/HubLayout';

const serviceIcons = { 'nelfund-loan': CircleDollarSign, results: FileText, 'scratch-cards': KeyRound, 'jamb-slip': Printer, 'admission-letters': FileText } as const;

export default function HubHomePage() {
  return <HubLayout>
    <div className="hub-page">
      <div className="hub-container hub-grid hub-home-grid">
        <section className="hub-main-stream">
          <div className="hub-section-heading hub-portal-intro">
            <div>
              <span className="hub-eyebrow">EDUREACH HUB</span>
              <h1>Student services &amp; updates</h1>
            </div>
            <a className="hub-primary-btn" href="/services">View Services <ArrowRight size={16} /></a>
          </div>

          <div className="hub-utility-cards">
            <a className="hub-feature-card hub-tone-blue" href="/cbt"><div className="hub-feature-head"><span>CBT</span><span>JAMB / WAEC</span></div><div className="hub-feature-body"><span className="hub-tag">Practice</span><h3>CBT Practice</h3><p>Start a timed practice session.</p><span className="hub-card-link">Start Test <ArrowRight size={16} /></span></div></a>
            <a className="hub-feature-card hub-tone-green" href="/services"><div className="hub-feature-head"><span>₦</span><span>STUDENT SERVICES</span></div><div className="hub-feature-body"><span className="hub-tag">NELFUND</span><h3>Student Services</h3><p>Funding, results, JAMB and admission support.</p><span className="hub-card-link">Apply Now <ArrowRight size={16} /></span></div></a>
            <a className="hub-feature-card hub-tone-amber" href="/services/apply/scratch-cards"><div className="hub-feature-head"><span>PIN</span><span>WAEC / NECO</span></div><div className="hub-feature-body"><span className="hub-tag">Result Checking</span><h3>Scratch Card Voucher</h3><p>Request the correct result-checking PIN type.</p><span className="hub-card-link">Buy Pin <ArrowRight size={16} /></span></div></a>
          </div>

          <div className="hub-section-heading compact"><div><span className="hub-eyebrow">SERVICES</span><h2>Quick student services</h2></div><a href="/services">View all <ArrowRight size={16} /></a></div>
          <div className="hub-service-grid hub-service-profile-home-grid">{hubServices.map((service, index) => { const Icon = serviceIcons[service.slug as keyof typeof serviceIcons] || FileText; return <a key={service.slug} href={`/services/apply/${service.slug}`} className={`hub-service-profile-card hub-service-profile-compact hub-tone-${service.tone}`}><div className="hub-service-banner"><span>{service.short}</span><strong>0{index + 1}</strong></div><div className="hub-service-profile-avatar"><Icon size={23}/></div><div className="hub-service-profile-body"><div className="hub-service-card-meta"><span>EduReach Service</span><span>{service.price}</span></div><h2>{service.title}</h2><p>{service.description}</p><div className="hub-service-profile-footer"><span className="hub-service-card-caption">Student support</span><span className="hub-primary-btn">{service.action} <ArrowRight size={15}/></span></div></div></a>; })}</div>

          <div className="hub-section-heading compact"><div><span className="hub-eyebrow">LATEST</span><h2>News &amp; academic updates</h2></div><a href="/news">Open news <ArrowRight size={16} /></a></div>
          <div className="hub-news-list">{newsItems.slice(0, 4).map((item) => <a href={`/news/${item.slug}`} key={item.slug} className="hub-news-row"><div className="hub-news-thumb"><Newspaper size={20}/></div><div className="hub-news-copy"><div className="hub-news-meta"><span>{item.tag}</span><span>{item.date}</span>{item.verified ? <span className="hub-verified"><CheckCircle2 size={13}/> Verified</span> : null}</div><h3>{item.title}</h3><p>{item.excerpt}</p></div><ArrowRight size={18}/></a>)}</div>
        </section>

        <aside className="hub-sidebar">
          <div className="hub-sidebar-card"><div className="hub-sidebar-head"><h3>Live News Feed</h3><CircleAlert size={17}/></div>{newsItems.slice(0,5).map((item) => <a className="hub-sidebar-news" href={`/news/${item.slug}`} key={item.slug}><span>{item.tag}</span><strong>{item.title}</strong><small>{item.date}</small></a>)}</div>
          <div className="hub-sidebar-card"><div className="hub-sidebar-head"><h3>Portal Status</h3><span className="hub-pulse" /></div><div className="hub-status-row"><span>JAMB Portal</span><strong className="status-online">Online</strong></div><div className="hub-status-row"><span>NELFUND Portal</span><strong className="status-maint">Maintenance</strong></div><div className="hub-status-row"><span>EduReach Services</span><strong className="status-online">Online</strong></div></div>
          <div className="hub-sidebar-card hub-sidebar-callout"><span className="hub-eyebrow">NEED HELP?</span><h3>Track an existing request</h3><p>Use your 10-character reference code to see the current stage of your application.</p><a href="/services/track" className="hub-primary-btn">Track Request</a></div>
        </aside>
      </div>
    </div>
  </HubLayout>;
}
