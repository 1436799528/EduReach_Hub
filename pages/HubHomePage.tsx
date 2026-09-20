import { ArrowRight, Calendar, Search, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { services } from '../src/data/services';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';

const quickKeys = ['jamb','jamb-cbt','waec','neco','nabteb','past-questions','nelfund','scholarships','school-finder','course-finder','admission-requirements','cgpa-calculator'];
const examKeys = ['jamb-cbt','past-questions','waec','neco'];

function formatDate(value: string | null) {
  if (!value) return 'Recent';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

function newsImageFor(item: NewsItem) {
  const category = item.category.toLowerCase();
  if (category.includes('admission')) return '/icons/admission.svg';
  if (category.includes('jamb')) return '/icons/brands/jamb.png';
  if (category.includes('waec')) return '/icons/brands/waec.png';
  if (category.includes('neco')) return '/icons/brands/neco.png';
  if (category.includes('nelfund') || category.includes('fund')) return '/icons/brands/nelfund.png';
  return '/news/education.svg';
}

function serviceCard(key: string) {
  return services.find((item) => item.key === key);
}

function CompactService({ service }: { service: NonNullable<ReturnType<typeof serviceCard>> }) {
  return (
    <a className="er-tile" href={service.route}>
      <CardIdentityMark value={service.title} type="service" size="sm" />
      <span className="er-tile-copy">
        <strong>{service.title}</strong>
        <small>{service.description}</small>
      </span>
      <ChevronRight size={13} className="er-tile-arrow" />
    </a>
  );
}

function CompactNews({ item }: { item: NewsItem }) {
  return (
    <a className="er-news-row" href={`/news/${encodeURIComponent(item.slug)}`}>
      <img src={newsImageFor(item)} alt="" loading="lazy" />
      <span className="er-news-copy">
        <small>{item.category.replace('_', ' ')} · {formatDate(item.published_at)}</small>
        <strong>{item.title}</strong>
      </span>
      <ChevronRight size={13} />
    </a>
  );
}

function CompactDeadline({ item }: { item: UpcomingItem }) {
  const date = item.due_at || item.starts_at;
  return (
    <div className="er-deadline">
      <div className="er-date">
        <strong>{date ? new Date(date).getDate() : '—'}</strong>
        <small>{date ? new Date(date).toLocaleDateString('en-NG', { month: 'short' }) : 'Soon'}</small>
      </div>
      <div>
        <small>{item.kind}</small>
        <strong>{item.title}</strong>
      </div>
    </div>
  );
}

export default function HubHomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let active = true;
    void fetchNews().then((items) => active && setNews(items)).catch(() => {});
    void fetchUpcoming().then((items) => active && setUpcoming(items)).catch(() => {});
    return () => { active = false; };
  }, []);

  const filteredNews = useMemo(() => {
    if (category === 'all') return news;
    return news.filter((item) => item.category.toLowerCase().includes(category));
  }, [news, category]);

  const quickServices = quickKeys.map(serviceCard).filter(Boolean) as NonNullable<ReturnType<typeof serviceCard>>[];
  const examServices = examKeys.map(serviceCard).filter(Boolean) as NonNullable<ReturnType<typeof serviceCard>>[];

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container">
          <div className="er-notice">
            <span>NOTICE</span>
            <p>JAMB, admission, examination and student-service updates in one place.</p>
            <a href="/news">Noticeboard <ArrowRight size={12} /></a>
          </div>

          <div className="er-search">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schools, courses, JAMB, WAEC, scholarships..." />
            {search.trim() && <a href={`/services?q=${encodeURIComponent(search.trim())}`}>Search</a>}
          </div>

          <a href="/past-questions" className="er-banner">
            <div className="er-banner-mark"><CardIdentityMark value="Past Question Bank" type="service" size="sm" /></div>
            <div><small>EDUREACH STUDY CENTRE</small><strong>Past Questions, CBT Practice &amp; Exam Preparation</strong><p>Practice by examination, subject and year.</p></div>
            <ArrowRight size={18} />
          </a>

          <section className="er-section">
            <div className="er-section-head"><h2>Quick Access</h2><a href="/services">All services <ArrowRight size={12} /></a></div>
            <div className="er-quick-grid">{quickServices.map((service) => <CompactService key={service.key} service={service} />)}</div>
          </section>

          <section className="er-section">
            <div className="er-section-head"><h2>CBT &amp; Exam Preparation</h2><a href="/cbt">Open CBT <ArrowRight size={12} /></a></div>
            <div className="er-exam-grid">{examServices.map((service) => <CompactService key={service.key} service={service} />)}</div>
          </section>

          <div className="er-two-col">
            <section className="er-section">
              <div className="er-section-head"><h2>Latest News</h2><a href="/news">View all <ArrowRight size={12} /></a></div>
              <div className="er-list-tabs">
                {['all','jamb','admission','waec'].map((tab) => <button key={tab} className={category === tab ? 'active' : ''} onClick={() => setCategory(tab)}>{tab === 'all' ? 'All' : tab.toUpperCase()}</button>)}
              </div>
              <div className="er-news-list">
                {filteredNews.slice(0, 7).map((item) => <CompactNews key={item.id} item={item} />)}
                {!filteredNews.length && <div className="er-empty">No news available.</div>}
              </div>
            </section>

            <section className="er-section">
              <div className="er-section-head"><h2>Upcoming</h2><a href="/news">Calendar <ArrowRight size={12} /></a></div>
              <div className="er-deadline-list">
                {upcoming.slice(0, 6).map((item) => <CompactDeadline key={item.id} item={item} />)}
                {!upcoming.length && <div className="er-empty"><Calendar size={15} /> Verified deadlines will appear here.</div>}
              </div>
            </section>
          </div>

          <section className="er-section">
            <div className="er-section-head"><h2>Student Resources</h2><a href="/services">Explore <ArrowRight size={12} /></a></div>
            <div className="er-resource-grid">
              {['cgpa-calculator','gpa-calculator','course-registration','timetable','academic-calendar','exam-countdown','school-fees','support'].map((key) => {
                const service = serviceCard(key);
                return service ? <CompactService key={key} service={service} /> : null;
              })}
            </div>
          </section>

          <section className="er-section">
            <div className="er-section-head"><h2>Admission &amp; Funding</h2><a href="/admission">Explore <ArrowRight size={12} /></a></div>
            <div className="er-resource-grid">
              {['admission-consultation','school-finder','course-finder','admission-requirements','nelfund','scholarships'].map((key) => {
                const service = serviceCard(key);
                return service ? <CompactService key={key} service={service} /> : null;
              })}
            </div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
