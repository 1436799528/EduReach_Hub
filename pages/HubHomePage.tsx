import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchNews, fetchServices, fetchUpcoming, type NewsItem, type ServiceItem, type UpcomingItem } from '../src/lib/api';

function labelFor(category: string) {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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

  return (
    <HubLayout>
      <div className="hub-page hub-home-page hub-compact-site">
        <div className="hub-container hub-grid hub-home-grid">
          <section className="hub-main-stream">
            <div className="hub-home-topbar">
              <div>
                <span className="hub-eyebrow">EDUREACH HUB</span>
                <h1>Student updates, services &amp; practice</h1>
                <p>Useful student tools and verified academic information in one compact workspace.</p>
              </div>
              <div className="hub-home-top-actions">
                <a className="hub-outline-btn" href="/news">Campus Updates</a>
                <a className="hub-primary-btn" href="/dashboard">My Dashboard</a>
              </div>
            </div>

            <div className="hub-utility-cards hub-compact-utility-cards">
              <a className="hub-compact-card hub-tone-blue" href="/cbt">
                <div className="hub-compact-icon"><CardIdentityMark value="jamb-slip" type="service" /></div>
                <div className="hub-compact-copy">
                  <span className="hub-compact-label">JAMB</span>
                  <h3>JAMB &amp; Post-UTME CBT</h3>
                  <p>Practice by exam mode</p>
                </div>
                <ArrowRight size={17} className="hub-compact-arrow" />
              </a>
              <a className="hub-compact-card hub-tone-green" href="/services">
                <div className="hub-compact-icon"><CardIdentityMark value="services" type="service" /></div>
                <div className="hub-compact-copy">
                  <span className="hub-compact-label">SERVICES</span>
                  <h3>Student Services</h3>
                  <p>Practical student service tools</p>
                </div>
                <ArrowRight size={17} className="hub-compact-arrow" />
              </a>
              <a className="hub-compact-card hub-tone-amber" href="/news">
                <div className="hub-compact-icon"><CardIdentityMark value="news" type="content" /></div>
                <div className="hub-compact-copy">
                  <span className="hub-compact-label">UPDATES</span>
                  <h3>Campus Updates</h3>
                  <p>Verified academic news</p>
                </div>
                <ArrowRight size={17} className="hub-compact-arrow" />
              </a>
            </div>

            <div className="hub-section-heading compact">
              <div><span className="hub-eyebrow">SERVICES</span><h2>Quick student services</h2></div>
              <a href="/services">View all <ArrowRight size={16} /></a>
            </div>

            {loadingServices && <div className="hub-panel hub-empty">Loading services…</div>}
            {!loadingServices && serviceError && <div className="hub-form-error">{serviceError}</div>}
            {!loadingServices && !serviceError && !quickServices.length && <div className="hub-panel hub-empty">No student services are available yet.</div>}
            {!loadingServices && !serviceError && quickServices.length > 0 && (
              <div className="hub-service-grid hub-service-profile-home-grid">
                {quickServices.map((service) => (
                  <a key={service.id} href={'/services/apply/' + service.service_key} className="hub-service-profile-card hub-service-profile-compact hub-compact-service-card">
                    <div className="hub-service-profile-icon"><CardIdentityMark value={service.service_key} type="service" /></div>
                    <div className="hub-service-profile-body">
                      <div className="hub-service-card-meta"><span>EduReach Service</span></div>
                      <h2>{service.title}</h2>
                      <p>{service.description}</p>
                    </div>
                    <ArrowRight size={17} className="hub-compact-arrow" />
                  </a>
                ))}
              </div>
            )}

            <div className="hub-section-heading compact">
              <div><span className="hub-eyebrow">LATEST</span><h2>Verified news &amp; academic updates</h2></div>
              <a href="/news">Open news <ArrowRight size={16} /></a>
            </div>

            {loadingNews && <div className="hub-panel hub-empty">Loading verified updates…</div>}
            {!loadingNews && newsError && <div className="hub-form-error">{newsError}</div>}
            {!loadingNews && !newsError && !newsItems.length && <div className="hub-panel hub-empty">No verified announcements are published right now.</div>}
            {!loadingNews && !newsError && (
              <div className="hub-news-list">
                {newsItems.slice(0, 5).map((item) => (
                  <a href={'/news/' + item.id} key={item.id} className="hub-news-row hub-click-card">
                    <div className="hub-news-thumb"><CardIdentityMark value={item.category} type="news" /></div>
                    <div className="hub-news-copy">
                      <div className="hub-news-meta">
                        <span>{labelFor(item.category)}</span>
                        <span>{formatDate(item.published_at)}</span>
                        <span className="hub-verified"><CheckCircle2 size={13}/> Verified</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.summary || ''}</p>
                    </div>
                    <ArrowRight size={18} />
                  </a>
                ))}
              </div>
            )}

            <div className="hub-section-heading compact"><div><span className="hub-eyebrow">UP NEXT</span><h2>Upcoming</h2></div></div>
            {loadingUpcoming && <div className="hub-panel hub-empty">Loading upcoming items…</div>}
            {!loadingUpcoming && upcomingError && <div className="hub-form-error">{upcomingError}</div>}
            {!loadingUpcoming && !upcomingError && !upcoming.length && <div className="hub-panel hub-empty">No upcoming deadlines or exams have been published yet.</div>}
            {!loadingUpcoming && !upcomingError && upcoming.length > 0 && (
              <div className="hub-upcoming-list">
                {upcoming.map((item) => (
                  <div className="hub-upcoming-row" key={item.kind + '-' + item.id}>
                    <div className="hub-upcoming-thumb"><CardIdentityMark value={item.kind} type="upcoming" /></div>
                    <div>
                      <span className="hub-upcoming-kind">{item.kind === 'deadline' ? 'Deadline' : 'Exam'}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description || ''}</p>
                    </div>
                    <strong>{formatDate(item.due_at || item.starts_at)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="hub-sidebar">
            <div className="hub-sidebar-card">
              <div className="hub-sidebar-head"><h3>Latest News</h3><a href="/news">View all</a></div>
              {loadingNews && <p className="hub-sidebar-copy">Loading…</p>}
              {!loadingNews && !newsError && newsItems.slice(0, 5).map((item) => (
                <a className="hub-sidebar-news" href={'/news/' + item.id} key={item.id}>
                  <div className="hub-news-thumb"><CardIdentityMark value={item.category} type="news" /></div>
                  <span>{labelFor(item.category)}</span>
                  <strong>{item.title}</strong>
                  <small>{formatDate(item.published_at)}</small>
                </a>
              ))}
              {!loadingNews && !newsError && !newsItems.length && <p className="hub-sidebar-copy">No verified updates yet.</p>}
              {newsError && <p className="hub-sidebar-copy">{newsError}</p>}
            </div>

            <div className="hub-sidebar-card">
              <div className="hub-sidebar-head"><h3>Upcoming</h3></div>
              {loadingUpcoming && <p className="hub-sidebar-copy">Loading…</p>}
              {!loadingUpcoming && !upcomingError && upcoming.slice(0, 5).map((item) => (
                <div className="hub-sidebar-news" key={item.kind + '-' + item.id}>
                  <div className="hub-news-thumb"><CardIdentityMark value={item.kind} type="upcoming" /></div>
                  <span>{item.kind === 'deadline' ? 'Deadline' : 'Exam'}</span>
                  <strong>{item.title}</strong>
                  <small>{formatDate(item.due_at || item.starts_at)}</small>
                </div>
              ))}
              {!loadingUpcoming && !upcomingError && !upcoming.length && <p className="hub-sidebar-copy">No upcoming items yet.</p>}
              {upcomingError && <p className="hub-sidebar-copy">{upcomingError}</p>}
            </div>

            <a href="/news" className="hub-sidebar-card hub-sidebar-callout hub-click-card">
              <span className="hub-eyebrow">CAMPUS UPDATES</span>
              <h3>Keep up with what is changing.</h3>
              <p>Check verified announcements, academic updates and important student deadlines from EduReach.</p>
              <ArrowRight size={17} />
            </a>
          </aside>
        </div>
      </div>
    </HubLayout>
  );
}
