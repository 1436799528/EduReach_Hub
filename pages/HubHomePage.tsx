import { ArrowRight, CheckCircle2, CircleDollarSign, FileText, KeyRound, Newspaper, Printer, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchNews, fetchServices, fetchUpcoming, type NewsItem, type ServiceItem, type UpcomingItem } from '../src/lib/api';

const serviceIcons = { 'nelfund-loan': CircleDollarSign, results: FileText, 'scratch-cards': KeyRound, 'jamb-slip': Printer, 'admission-letters': FileText } as const;

const tones = ['blue', 'green', 'amber'] as const;
function toneFor(index: number) { return tones[index % tones.length]; }
function labelFor(category: string) { return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null) {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HubHomePage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [newsError, setNewsError] = useState('');
  const [upcomingError, setUpcomingError] = useState('');

  useEffect(() => {
    void fetchServices().then(setServices).catch((value) => setServiceError(value instanceof Error ? value.message : 'Unable to load services.')).finally(() => setLoadingServices(false));
    void fetchNews().then(setNewsItems).catch((value) => setNewsError(value instanceof Error ? value.message : 'Unable to load news.')).finally(() => setLoadingNews(false));
    void fetchUpcoming().then(setUpcoming).catch((value) => setUpcomingError(value instanceof Error ? value.message : 'Unable to load upcoming items.')).finally(() => setLoadingUpcoming(false));
  }, []);

  const quickServices = useMemo(() => services.slice(0, 5), [services]);

  return <HubLayout>
    <div className="hub-page hub-home-page">
      <div className="hub-container hub-grid hub-home-grid">
        <section className="hub-main-stream">
          <div className="hub-home-topbar">
            <div>
              <span className="hub-eyebrow">EDUREACH HUB</span>
              <h1>Student updates, services &amp; practice</h1>
              
            </div>
            <div className="hub-home-top-actions">
              <a className="hub-outline-btn" href="/services/track">Track Request</a>
              <a className="hub-primary-btn" href="/dashboard">My Dashboard</a>
            </div>
          </div>

          <div className="hub-utility-cards">
            <a className="hub-feature-card hub-tone-blue" href="/cbt"><div className="hub-feature-head"><span>CBT</span><span>Practice</span></div><div className="hub-feature-body"><h3>CBT Practice</h3><span className="hub-card-link">Start Test <ArrowRight size={16} /></span></div></a>
            <a className="hub-feature-card hub-tone-green" href="/services"><div className="hub-feature-head"><span>SERVICES</span><span>{services.length || '—'}</span></div><div className="hub-feature-body"><h3>Student Services</h3><span className="hub-card-link">Open Services <ArrowRight size={16} /></span></div></a>
            <a className="hub-feature-card hub-tone-amber" href="/services/track"><div className="hub-feature-head"><span>TRACK</span><span>REQUEST</span></div><div className="hub-feature-body"><h3>Track a Request</h3><span className="hub-card-link">Check Status <ArrowRight size={16} /></span></div></a>
          </div>

          <div className="hub-section-heading compact"><div><span className="hub-eyebrow">SERVICES</span><h2>Quick student services</h2></div><a href="/services">View all <ArrowRight size={16} /></a></div>
          {loadingServices && <div className="hub-panel hub-empty">Loading services…</div>}
          {!loadingServices && serviceError && <div className="hub-form-error">{serviceError}</div>}
          {!loadingServices && !serviceError && !quickServices.length && <div className="hub-panel hub-empty">No student services are available yet.</div>}
          {!loadingServices && !serviceError && quickServices.length > 0 && <div className="hub-service-grid hub-service-profile-home-grid">{quickServices.map((service, index) => {
            const Icon = serviceIcons[service.service_key as keyof typeof serviceIcons] || FileText;
            const tone = toneFor(index);
            return <a key={service.id} href={`/services/apply/${service.service_key}`} className={`hub-service-profile-card hub-service-profile-compact hub-tone-${tone}`}>
              <div className="hub-service-banner"><span>{service.title}</span><strong>0{index + 1}</strong></div>
              <div className="hub-service-profile-avatar"><Icon size={23}/></div>
              <div className="hub-service-profile-body"><div className="hub-service-card-meta"><span>EduReach Service</span></div><h2>{service.title}</h2><p>{service.description}</p><div className="hub-service-profile-footer"><span className="hub-service-card-caption">{service.application_url ? 'Official portal' : 'Request support'}</span><span className="hub-primary-btn">{service.application_url ? 'Open Portal' : 'Apply Now'} <ArrowRight size={15} /></span></div></div>
            </a>;
          })}</div>}

          <div className="hub-section-heading compact"><div><span className="hub-eyebrow">LATEST</span><h2>Verified news &amp; academic updates</h2></div><a href="/news">Open news <ArrowRight size={16} /></a></div>
          {loadingNews && <div className="hub-panel hub-empty">Loading verified updates…</div>}
          {!loadingNews && newsError && <div className="hub-form-error">{newsError}</div>}
          {!loadingNews && !newsError && !newsItems.length && <div className="hub-panel hub-empty">No verified announcements are published right now.</div>}
          {!loadingNews && !newsError && <div className="hub-news-list">{newsItems.slice(0, 5).map((item) => <a href={`/news/${item.id}`} key={item.id} className="hub-news-row"><div className="hub-news-thumb"><Newspaper size={20}/></div><div className="hub-news-copy"><div className="hub-news-meta"><span>{labelFor(item.category)}</span><span>{formatDate(item.published_at)}</span><span className="hub-verified"><CheckCircle2 size={13}/> Verified</span></div><h3>{item.title}</h3><p>{item.summary || ''}</p></div><ArrowRight size={18}/></a>)}</div>}

          <div className="hub-section-heading compact"><div><span className="hub-eyebrow">UP NEXT</span><h2>Upcoming</h2></div></div>
          {loadingUpcoming && <div className="hub-panel hub-empty">Loading upcoming items…</div>}
          {!loadingUpcoming && upcomingError && <div className="hub-form-error">{upcomingError}</div>}
          {!loadingUpcoming && !upcomingError && !upcoming.length && <div className="hub-panel hub-empty">No upcoming deadlines or exams have been published yet.</div>}
          {!loadingUpcoming && !upcomingError && upcoming.length > 0 && <div className="hub-upcoming-list">{upcoming.map((item) => <div className="hub-upcoming-row" key={`${item.kind}-${item.id}`}><div className="hub-upcoming-icon"><CalendarDays size={18}/></div><div><span className="hub-upcoming-kind">{item.kind === 'deadline' ? 'Deadline' : 'Exam'}</span><h3>{item.title}</h3><p>{item.description || ''}</p></div><strong>{formatDate(item.due_at || item.starts_at)}</strong></div>)}</div>}
        </section>

        <aside className="hub-sidebar">
          <div className="hub-sidebar-card">
            <div className="hub-sidebar-head"><h3>Latest News</h3><a href="/news">View all</a></div>
            {loadingNews && <p className="hub-sidebar-copy">Loading…</p>}
            {!loadingNews && !newsError && newsItems.slice(0, 5).map((item) => <a className="hub-sidebar-news" href={`/news/${item.id}`} key={item.id}><span>{labelFor(item.category)}</span><strong>{item.title}</strong><small>{formatDate(item.published_at)}</small></a>)}
            {!loadingNews && !newsError && !newsItems.length && <p className="hub-sidebar-copy">No verified updates yet.</p>}
            {newsError && <p className="hub-sidebar-copy">{newsError}</p>}
          </div>
          <div className="hub-sidebar-card">
            <div className="hub-sidebar-head"><h3>Upcoming</h3></div>
            {loadingUpcoming && <p className="hub-sidebar-copy">Loading…</p>}
            {!loadingUpcoming && !upcomingError && upcoming.slice(0, 5).map((item) => <div className="hub-sidebar-news" key={`${item.kind}-${item.id}`}><span>{item.kind === 'deadline' ? 'Deadline' : 'Exam'}</span><strong>{item.title}</strong><small>{formatDate(item.due_at || item.starts_at)}</small></div>)}
            {!loadingUpcoming && !upcomingError && !upcoming.length && <p className="hub-sidebar-copy">No upcoming items yet.</p>}
            {upcomingError && <p className="hub-sidebar-copy">{upcomingError}</p>}
          </div>
          <div className="hub-sidebar-card hub-sidebar-callout"><span className="hub-eyebrow">STUDENT ACCOUNT</span><h3>Need your request history?</h3><p>Open your dashboard to see requests, CBT attempts and wallet data tied to your account.</p><a href="/dashboard" className="hub-primary-btn">Open Dashboard</a></div>
        </aside>
      </div>
    </div>
  </HubLayout>;
}
