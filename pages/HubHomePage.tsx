import { ArrowRight, Calendar, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { services, type ServiceDefinition } from '../src/data/services';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';

const service = (key: string) => services.find((item) => item.key === key);

const examModules = [
  {
    key: 'jamb',
    title: 'JAMB',
    route: '/jamb',
    logo: '/icons/brands/jamb.svg',
    intro: 'UTME, CAPS, results and admission resources',
    links: ['JAMB CBT', 'JAMB Result', 'CAPS & Admission', 'Syllabus & Brochure', 'Past Questions'],
  },
  {
    key: 'waec',
    title: 'WAEC',
    route: '/waec',
    logo: '/icons/brands/waec.svg',
    intro: 'SSCE results, preparation and examination resources',
    links: ['WAEC Result', 'WAEC CBT', 'Timetable', 'Syllabus', 'Past Questions'],
  },
  {
    key: 'neco',
    title: 'NECO',
    route: '/neco',
    logo: '/icons/brands/neco.svg',
    intro: 'NECO results, preparation and examination information',
    links: ['NECO Result', 'NECO CBT', 'Timetable', 'Registration', 'Past Questions'],
  },
  {
    key: 'post-utme',
    title: 'Post-UTME',
    route: '/post-utme',
    logo: '/icons/post-utme.svg',
    intro: 'University screening, forms and admission preparation',
    links: ['Screening Information', 'Universities', 'Past Questions', 'CBT Practice', 'Admission Updates'],
  },
];

function formatDate(value: string | null) {
  if (!value) return 'Recent';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

function newsImageFor(item: NewsItem) {
  const category = item.category.toLowerCase();
  if (category.includes('jamb')) return '/icons/brands/jamb.svg';
  if (category.includes('waec')) return '/icons/brands/waec.svg';
  if (category.includes('neco')) return '/icons/brands/neco.svg';
  if (category.includes('nelfund') || category.includes('fund')) return '/icons/brands/nelfund.svg';
  return '/news/education.svg';
}

function LinkTile({ item }: { item: ServiceDefinition }) {
  return (
    <a className="er-mini-link" href={item.route}>
      <CardIdentityMark value={item.title} type="service" size="sm" />
      <span>{item.title}</span>
      <ChevronRight size={13} />
    </a>
  );
}

function ExamModule({ module }: { module: typeof examModules[number] }) {
  return (
    <section className="er-exam-module">
      <a href={module.route} className="er-exam-head">
        <span className="er-exam-logo"><img src={module.logo} alt="" /></span>
        <span className="er-exam-heading">
          <strong>{module.title}</strong>
          <small>{module.intro}</small>
        </span>
        <ChevronRight size={17} />
      </a>
      <div className="er-exam-links">
        {module.links.map((link) => <a href={module.route} key={link}>{link}</a>)}
      </div>
      <a href={module.route} className="er-module-more">Open {module.title} <ArrowRight size={12} /></a>
    </section>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a className="er-news-row" href={`/news/${encodeURIComponent(item.slug)}`}>
      <img src={newsImageFor(item)} alt="" loading="lazy" />
      <span>
        <small>{item.category.replace('_', ' ')} · {formatDate(item.published_at)}</small>
        <strong>{item.title}</strong>
      </span>
      <ChevronRight size={13} />
    </a>
  );
}

function Deadline({ item }: { item: UpcomingItem }) {
  const date = item.due_at || item.starts_at;
  return (
    <div className="er-deadline">
      <div className="er-date">
        <strong>{date ? new Date(date).getDate() : '—'}</strong>
        <small>{date ? new Date(date).toLocaleDateString('en-NG', { month: 'short' }) : 'Soon'}</small>
      </div>
      <span><small>{item.kind}</small><strong>{item.title}</strong></span>
    </div>
  );
}

export default function HubHomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    void fetchNews().then((items) => active && setNews(items)).catch(() => {});
    void fetchUpcoming().then((items) => active && setUpcoming(items)).catch(() => {});
    return () => { active = false; };
  }, []);

  const quick = useMemo(
    () => ['past-questions', 'jamb-cbt', 'nelfund', 'scholarships'].map(service).filter(Boolean) as ServiceDefinition[],
    [],
  );
  const admission = useMemo(
    () => ['school-finder', 'course-finder', 'admission-requirements', 'admission-consultation'].map(service).filter(Boolean) as ServiceDefinition[],
    [],
  );
  const tools = useMemo(
    () => ['cgpa-calculator', 'gpa-calculator', 'course-registration', 'timetable'].map(service).filter(Boolean) as ServiceDefinition[],
    [],
  );

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container">
          <div className="er-notice">
            <span>EDUREACH</span>
            <p>JAMB, WAEC, NECO, Post-UTME, admission and student updates.</p>
            <a href="/news">Noticeboard <ArrowRight size={12} /></a>
          </div>

          <form className="er-search" onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) window.location.href = `/services?q=${encodeURIComponent(search.trim())}`;
          }}>
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schools, courses, JAMB, WAEC, scholarships..." />
            <button type="submit">Search</button>
          </form>

          <a href="/past-questions" className="er-banner">
            <div className="er-banner-art">
              <img src="/icons/services/past-questions.svg" alt="" />
            </div>
            <div>
              <small>EDUREACH STUDY CENTRE</small>
              <strong>Past Questions &amp; CBT Practice</strong>
              <p>Prepare by examination, subject, school and year.</p>
            </div>
            <ArrowRight size={18} />
          </a>

          <section className="er-section">
            <div className="er-section-head">
              <h2>Examinations &amp; Admission</h2>
              <a href="/services">More <ArrowRight size={12} /></a>
            </div>
            <div className="er-exam-grid">
              {examModules.map((module) => <ExamModule key={module.key} module={module} />)}
            </div>
          </section>

          <section className="er-section">
            <div className="er-section-head">
              <h2>Take a Test</h2>
              <a href="/cbt">Open CBT <ArrowRight size={12} /></a>
            </div>
            <div className="er-test-strip">
              {['jamb-cbt', 'past-questions', 'waec', 'neco'].map((key) => {
                const item = service(key);
                return item ? <LinkTile key={key} item={item} /> : null;
              })}
            </div>
          </section>

          <div className="er-two-col">
            <section className="er-section">
              <div className="er-section-head"><h2>Latest Educational News</h2><a href="/news">View all <ArrowRight size={12} /></a></div>
              <div className="er-news-list">
                {news.slice(0, 6).map((item) => <NewsRow key={item.id} item={item} />)}
                {!news.length && <div className="er-empty">News updates will appear here.</div>}
              </div>
            </section>

            <section className="er-section">
              <div className="er-section-head"><h2>Upcoming</h2><a href="/news">Calendar <ArrowRight size={12} /></a></div>
              <div className="er-deadline-list">
                {upcoming.slice(0, 6).map((item) => <Deadline key={item.id} item={item} />)}
                {!upcoming.length && <div className="er-empty"><Calendar size={15} /> Verified deadlines will appear here.</div>}
              </div>
            </section>
          </div>

          <section className="er-section">
            <div className="er-section-head"><h2>Admission &amp; Schools</h2><a href="/admission">Explore <ArrowRight size={12} /></a></div>
            <div className="er-link-grid">{admission.map((item) => <LinkTile key={item.key} item={item} />)}</div>
          </section>

          <section className="er-section">
            <div className="er-section-head"><h2>Student Tools &amp; Funding</h2><a href="/services">Explore <ArrowRight size={12} /></a></div>
            <div className="er-link-grid">{[...tools, ...quick].map((item) => <LinkTile key={item.key} item={item} />)}</div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
