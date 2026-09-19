import { ArrowRight, CalendarDays, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';

type HomeCard = {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  visual: string;
  tone?: string;
};

const quickAccess: HomeCard[] = [
  { id: 'jamb', title: 'JAMB Services', description: 'Registration & admission support', eyebrow: 'ADMISSION', href: '/cbt', visual: 'jamb-slip' },
  { id: 'cbt', title: 'CBT Practice', description: 'Practice tests & instant results', eyebrow: 'EXAMS', href: '/cbt', visual: 'cbt' },
  { id: 'admission', title: 'Admission', description: 'Track and manage applications', eyebrow: 'ADMISSION', href: '/services', visual: 'admission' },
  { id: 'schools', title: 'School Finder', description: 'Explore schools and opportunities', eyebrow: 'SCHOOLS', href: '/services', visual: 'schools' },
  { id: 'past-questions', title: 'Past Questions', description: 'Prepare with exam practice', eyebrow: 'STUDY', href: '/cbt', visual: 'past-questions' },
  { id: 'scholarships', title: 'Scholarships', description: 'Find student opportunities', eyebrow: 'OPPORTUNITIES', href: '/jobs', visual: 'scholarship' },
  { id: 'results', title: 'Results', description: 'Review your CBT performance', eyebrow: 'RESULTS', href: '/cbt/results', visual: 'results' },
  { id: 'cgpa', title: 'CGPA Calculator', description: 'Calculate and plan your grades', eyebrow: 'ACADEMIC TOOL', href: '/screening-calculator', visual: 'cgpa' },
];

const academicTools: HomeCard[] = [
  { id: 'gpa', title: 'GPA & CGPA', description: 'Plan grades and monitor progress', eyebrow: 'TOOL', href: '/screening-calculator', visual: 'cgpa' },
  { id: 'timetable', title: 'Timetable', description: 'Keep your academic schedule close', eyebrow: 'TOOL', href: '/dashboard', visual: 'timetable' },
  { id: 'calendar', title: 'Academic Calendar', description: 'Stay aware of important dates', eyebrow: 'TOOL', href: '/news', visual: 'calendar' },
  { id: 'planner', title: 'Student Planner', description: 'Organise tasks, exams and deadlines', eyebrow: 'TOOL', href: '/dashboard', visual: 'planner' },
];

const examination: HomeCard[] = [
  { id: 'jamb-exam', title: 'JAMB', description: 'UTME practice and preparation', eyebrow: 'EXAM BODY', href: '/cbt', visual: 'jamb-slip' },
  { id: 'waec', title: 'WAEC', description: 'Exam preparation resources', eyebrow: 'EXAM BODY', href: '/cbt', visual: 'waec' },
  { id: 'neco', title: 'NECO', description: 'Exam preparation resources', eyebrow: 'EXAM BODY', href: '/cbt', visual: 'neco' },
  { id: 'nabteb', title: 'NABTEB', description: 'Exam preparation resources', eyebrow: 'EXAM BODY', href: '/cbt', visual: 'nabteb' },
];

function formatDate(value: string | null) {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function matches(card: HomeCard, query: string) {
  if (!query.trim()) return true;
  const haystack = [card.title, card.description, card.eyebrow].join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function ServiceCard({ card }: { card: HomeCard }) {
  return (
    <a href={card.href} className="hub-compact-card er-banner-card">
      <div className="hub-compact-icon">
        <CardIdentityMark value={card.visual} type="service" />
      </div>
      <div className="hub-compact-copy">
        <span className="hub-compact-label">{card.eyebrow}</span>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>
      <ArrowRight size={17} className="hub-compact-arrow" />
    </a>
  );
}

function SectionTitle({ eyebrow, title, href, label }: { eyebrow: string; title: string; href?: string; label?: string }) {
  return (
    <div className="hub-section-heading compact hub-home-section-title">
      <div>
        <span className="hub-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {href && <a href={href}>{label || 'View all'} <ArrowRight size={15} /></a>}
    </div>
  );
}

export default function HubHomePage() {
  const [query, setQuery] = useState('');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  useEffect(() => {
    void fetchNews().then(setNewsItems).catch(() => setNewsItems([])).finally(() => setLoadingNews(false));
    void fetchUpcoming().then(setUpcoming).catch(() => setUpcoming([])).finally(() => setLoadingUpcoming(false));
  }, []);

  const filteredQuick = useMemo(() => quickAccess.filter((card) => matches(card, query)), [query]);
  const filteredTools = useMemo(() => academicTools.filter((card) => matches(card, query)), [query]);
  const filteredExam = useMemo(() => examination.filter((card) => matches(card, query)), [query]);

  return (
    <HubLayout>
      <div className="hub-page hub-home-page hub-compact-site">
        <div className="hub-container hub-home-container">
          <section className="hub-home-intro" aria-labelledby="home-title">
            <div className="hub-home-intro-copy">
              <span className="hub-eyebrow">EDUREACH</span>
              <h1 id="home-title">Everything students need, in one place.</h1>
              <p>Admission, exams, scholarships, academic tools and student services.</p>
            </div>
            <label className="hub-home-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search schools, courses, services, news..."
                aria-label="Search EduReach"
              />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
            </label>
          </section>

          <SectionTitle eyebrow="QUICK ACCESS" title="What do you need today?" />
          {filteredQuick.length > 0 ? (
            <section className="hub-home-card-grid hub-home-card-grid-4" aria-label="Quick access">
              {filteredQuick.map((card) => <ServiceCard key={card.id} card={card} />)}
            </section>
          ) : (
            <div className="hub-panel hub-empty">No EduReach service matches “{query}”.</div>
          )}

          <section className="hub-home-news-deadline-grid">
            <div>
              <SectionTitle eyebrow="LATEST UPDATES" title="News & academic updates" href="/news" label="View all" />
              <div className="hub-news-list hub-home-news-list">
                {loadingNews && <div className="hub-panel hub-empty">Loading updates…</div>}
                {!loadingNews && !newsItems.length && <div className="hub-panel hub-empty">No announcements are published right now.</div>}
                {!loadingNews && newsItems.slice(0, 4).map((item) => (
                  <a href={'/news/' + encodeURIComponent(item.slug)} key={item.id} className="hub-news-row hub-click-card">
                    <div className="hub-news-thumb"><CardIdentityMark value={item.category} type="news" /></div>
                    <div className="hub-news-copy">
                      <div className="hub-news-meta">
                        <span>{item.category.replaceAll('_', ' ')}</span>
                        <span>{formatDate(item.published_at)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.summary || ''}</p>
                    </div>
                    <ArrowRight size={17} className="hub-compact-arrow" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle eyebrow="UPCOMING" title="Deadlines & exams" href="/news" label="View all" />
              <div className="hub-upcoming-list hub-home-upcoming-list">
                {loadingUpcoming && <div className="hub-panel hub-empty">Loading deadlines…</div>}
                {!loadingUpcoming && !upcoming.length && <div className="hub-panel hub-empty">No upcoming deadlines or exams.</div>}
                {!loadingUpcoming && upcoming.slice(0, 4).map((item) => (
                  <div className="hub-upcoming-row" key={item.kind + '-' + item.id}>
                    <div className="hub-upcoming-thumb"><CardIdentityMark value={item.kind} type="upcoming" /></div>
                    <div>
                      <span className="hub-upcoming-kind">{item.kind === 'deadline' ? 'DEADLINE' : 'EXAM'}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description || ''}</p>
                    </div>
                    <strong><CalendarDays size={13} />{formatDate(item.due_at || item.starts_at)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <SectionTitle eyebrow="STUDY & ACADEMIC TOOLS" title="Tools for everyday student life" />
          <section className="hub-home-card-grid hub-home-card-grid-4">
            {filteredTools.map((card) => <ServiceCard key={card.id} card={card} />)}
          </section>

          <SectionTitle eyebrow="ADMISSION & EXAMINATION" title="Prepare for your next step" />
          <section className="hub-home-card-grid hub-home-card-grid-4">
            {filteredExam.map((card) => <ServiceCard key={card.id} card={card} />)}
          </section>

          <section className="hub-home-footer-callout">
            <div>
              <span className="hub-eyebrow">YOUR STUDENT WORKSPACE</span>
              <h2>Keep your services, results and academic activity together.</h2>
              <p>Sign in to continue from your EduReach dashboard.</p>
            </div>
            <a className="hub-primary-btn" href="/login"><Sparkles size={15} /> Open Dashboard</a>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
