import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Laptop,
  MessageCircle,
  Search,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
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
  action: string;
};

const quickAccess: HomeCard[] = [
  { id: 'jamb-cbt', title: 'JAMB CBT Practice', description: 'Timed UTME practice with instant scoring & corrections', eyebrow: 'EXAMINATIONS', href: '/cbt?mode=JAMB', visual: 'jamb-cbt', action: 'Start CBT' },
  { id: 'nelfund', title: 'NELFUND Loan Support', description: 'Organise your student loan details with guided verification', eyebrow: 'FINANCIAL AID', href: '/services/apply/nelfund-loan', visual: 'nelfund-loan', action: 'Apply Now' },
  { id: 'waec-results', title: 'WAEC / NECO Result Checker', description: 'Guided assistance for checking WAEC and NECO results', eyebrow: 'RESULTS', href: '/services/apply/results', visual: 'results', action: 'Check Result' },
  { id: 'scratch-cards', title: 'Scratch Cards / Tokens', description: 'Instant WAEC & NECO exam checker pins & tokens', eyebrow: 'TOKENS', href: '/services/apply/scratch-cards', visual: 'scratch-cards', action: 'Get Tokens' },
  { id: 'jamb-slip', title: 'JAMB Exam Slip Printing', description: 'Exam centre locator, verification & slip preparation', eyebrow: 'ADMISSION', href: '/services/apply/jamb-slip', visual: 'jamb-slip', action: 'Print Slip' },
  { id: 'screening-calc', title: 'Screening Score Calculator', description: 'Calculate aggregate screening score for your target university', eyebrow: 'ACADEMIC TOOL', href: '/screening-calculator', visual: 'cgpa', action: 'Calculate' },
  { id: 'admission-letters', title: 'Admission Deferment Letters', description: 'Structured request support for deferment and supplementary letters', eyebrow: 'DOCUMENTS', href: '/services/apply/admission-letters', visual: 'admission-letters', action: 'Prepare Letter' },
  { id: 'scholarships', title: 'Student Scholarships', description: 'Explore verified tertiary scholarships & student opportunities', eyebrow: 'OPPORTUNITIES', href: '/jobs', visual: 'scholarship', action: 'View Grants' },
];

const cbtExams = [
  { id: 'jamb', name: 'JAMB UTME 2026', subject: 'General Practice & Use of English', count: '40 Questions', time: '30 Mins', mode: 'JAMB' },
  { id: 'waec', name: 'WAEC SSCE Revision', subject: 'English Language & General Science', count: '50 Questions', time: '45 Mins', mode: 'WAEC' },
  { id: 'neco', name: 'NECO SSCE Comprehensive', subject: 'Mathematics & Logical Reasoning', count: '40 Questions', time: '40 Mins', mode: 'NECO' },
  { id: 'post-utme', name: 'Post-UTME Screening Mock', subject: 'Aptitude & General Studies', count: '30 Questions', time: '25 Mins', mode: 'POST-UTME' },
];

const academicTools: HomeCard[] = [
  { id: 'gpa', title: 'Aggregate Screening Calculator', description: 'Estimate screening aggregate based on institutional weights', eyebrow: 'CALCULATOR', href: '/screening-calculator', visual: 'cgpa', action: 'Open Tool' },
  { id: 'track', title: 'Application Tracker', description: 'Track digital service requests with your reference code', eyebrow: 'RADAR', href: '/services/track', visual: 'services', action: 'Track Request' },
  { id: 'cbt-results', title: 'CBT Results & Review', description: 'Review your practice scores, corrections and explanations', eyebrow: 'ANALYTICS', href: '/cbt/results', visual: 'cbt', action: 'View Results' },
  { id: 'planner', title: 'Student Workspace', description: 'Manage wallet, requests and exam history in one place', eyebrow: 'DASHBOARD', href: '/dashboard', visual: 'timetable', action: 'Go to Portal' },
];

function formatDate(value: string | null) {
  if (!value) return 'Recent';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function matches(card: HomeCard, query: string) {
  if (!query.trim()) return true;
  const haystack = [card.title, card.description, card.eyebrow].join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
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

  return (
    <HubLayout>
      <div className="hub-page hub-home-page">
        <div className="hub-container">
          {/* MYSCHOOL HERO SECTION */}
          <section className="ms-hero-portal" aria-labelledby="home-title">
            <div className="ms-hero-top">
              <span className="ms-hero-badge">
                <Sparkles size={14} /> NIGERIA'S NO. 1 STUDENT SUCCESS PORTAL
              </span>
              <a
                href="/services/track"
                style={{ color: '#bfdbfe', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
              >
                Track a submitted request →
              </a>
            </div>
            <h1 id="home-title" className="ms-hero-title">
              Everything Nigerian Students Need, In One Place.
            </h1>
            <p className="ms-hero-subtitle">
              JAMB UTME CBT Practice, NELFUND Loans, WAEC/NECO Result Checkers, Screening Calculators, Verified Academic News, and Student Services.
            </p>

            <form
              className="ms-search-box"
              onSubmit={(e) => e.preventDefault()}
            >
              <Search size={20} style={{ color: '#64748b', marginRight: '10px' }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search JAMB past questions, WAEC results, NELFUND loan, scholarships, cut-off marks..."
                aria-label="Search EduReach Hub"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', color: '#64748b', padding: '0 8px', fontSize: '18px' }}
                >
                  ×
                </button>
              )}
              <button type="submit">
                <span>Search</span>
                <ArrowRight size={15} />
              </button>
            </form>

            <div className="ms-quick-tags">
              <span>Popular:</span>
              <a href="/cbt?mode=JAMB">JAMB CBT Practice</a>
              <a href="/services/apply/nelfund-loan">NELFUND Loan</a>
              <a href="/services/apply/scratch-cards">WAEC Scratch Cards</a>
              <a href="/screening-calculator">Screening Calculator</a>
              <a href="/cbt?mode=POST-UTME">Post-UTME Screening</a>
              <a href="/news">Latest News</a>
            </div>
          </section>

          {/* QUICK ACCESS SERVICES GRID */}
          <div className="hub-section-heading" style={{ marginBottom: '14px' }}>
            <div>
              <span className="hub-eyebrow">FAST ACCESS</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900 }}>What would you like to do today?</h2>
            </div>
            <a href="/services" style={{ color: '#2563eb', fontWeight: 800, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              View all services <ArrowRight size={14} />
            </a>
          </div>

          {filteredQuick.length > 0 ? (
            <div className="ms-card-grid">
              {filteredQuick.map((card) => (
                <a key={card.id} href={card.href} className="ms-card">
                  <div className="ms-card-head">
                    <CardIdentityMark value={card.visual} type="service" />
                    <span className="ms-card-badge">{card.eyebrow}</span>
                  </div>
                  <div className="ms-card-content">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                  <div className="ms-card-foot">
                    <span className="ms-card-cta">
                      {card.action} <ArrowRight size={13} className="hub-compact-arrow" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="hub-panel hub-empty">No EduReach service matches “{query}”.</div>
          )}

          {/* MYSCHOOL CBT CLASSROOM HIGHLIGHT */}
          <section className="ms-cbt-showcase" aria-labelledby="cbt-showcase-title">
            <div className="ms-cbt-header">
              <div>
                <span className="hub-eyebrow" style={{ color: '#059669' }}>CBT CLASSROOM &amp; TEST ENGINE</span>
                <h2 id="cbt-showcase-title">Practice Online for Your Upcoming Examination</h2>
                <p>Timed practice questions with instant score evaluation, answers, and step-by-step corrections.</p>
              </div>
              <a href="/cbt" className="hub-primary-btn" style={{ background: '#059669', textDecoration: 'none' }}>
                <Laptop size={16} /> Enter CBT Classroom
              </a>
            </div>

            <div className="ms-cbt-tabs">
              {cbtExams.map((exam) => (
                <a
                  key={exam.id}
                  href={`/cbt/practice?exam=demo-exam-${exam.id}`}
                  className="ms-cbt-exam-card"
                >
                  <div>
                    <div className="ms-cbt-exam-top">
                      <GraduationCap size={18} style={{ color: '#059669' }} />
                      <strong>{exam.name}</strong>
                    </div>
                    <p>{exam.subject}</p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                      <span>{exam.count}</span>
                      <span><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {exam.time}</span>
                    </div>
                    <span className="ms-cbt-exam-btn">
                      Start Test <ArrowRight size={13} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* LATEST NEWS & KEY DEADLINES (MYSCHOOL DUAL COLUMN) */}
          <div className="hub-home-news-deadline-grid" style={{ marginTop: '24px' }}>
            {/* LATEST NEWS */}
            <div>
              <div className="hub-section-heading" style={{ marginBottom: '12px' }}>
                <div>
                  <span className="hub-eyebrow">VERIFIED DESK</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900 }}>Latest Academic &amp; School News</h2>
                </div>
                <a href="/news" style={{ color: '#2563eb', fontWeight: 800, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  All updates <ArrowRight size={13} />
                </a>
              </div>

              <div className="hub-news-list">
                {loadingNews && <div className="hub-panel hub-empty">Loading verified updates…</div>}
                {!loadingNews && !newsItems.length && (
                  <div className="hub-panel hub-empty">No announcements are published right now.</div>
                )}
                {!loadingNews &&
                  newsItems.slice(0, 4).map((item) => (
                    <a
                      href={'/news/' + encodeURIComponent(item.slug)}
                      key={item.id}
                      className="hub-news-row"
                    >
                      <div className="hub-news-thumb">
                        <CardIdentityMark value={item.category} type="news" />
                      </div>
                      <div className="hub-news-copy">
                        <div className="hub-news-meta">
                          <span>{item.category.replaceAll('_', ' ')}</span>
                          <span>{formatDate(item.published_at)}</span>
                          <span className="hub-verified" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> Verified
                          </span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.summary || ''}</p>
                      </div>
                      <ArrowRight size={15} className="hub-compact-arrow" />
                    </a>
                  ))}
              </div>
            </div>

            {/* UPCOMING DEADLINES & EXAM DATES */}
            <div>
              <div className="hub-section-heading" style={{ marginBottom: '12px' }}>
                <div>
                  <span className="hub-eyebrow">ACADEMIC RADAR</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900 }}>Important Dates &amp; Deadlines</h2>
                </div>
                <a href="/news" style={{ color: '#2563eb', fontWeight: 800, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  Timetables <ArrowRight size={13} />
                </a>
              </div>

              <div className="hub-upcoming-list">
                {loadingUpcoming && <div className="hub-panel hub-empty">Loading key dates…</div>}
                {!loadingUpcoming && !upcoming.length && (
                  <div className="hub-panel hub-empty">No upcoming deadlines found.</div>
                )}
                {!loadingUpcoming &&
                  upcoming.slice(0, 4).map((item) => (
                    <div className="hub-upcoming-row" key={item.kind + '-' + item.id}>
                      <div className="hub-upcoming-thumb">
                        <CardIdentityMark value={item.kind} type="upcoming" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="hub-upcoming-kind">{item.kind === 'deadline' ? 'DEADLINE' : 'EXAM'}</span>
                        <h3>{item.title}</h3>
                        <p>{item.description || ''}</p>
                      </div>
                      <strong>
                        <CalendarDays size={13} />
                        {formatDate(item.due_at || item.starts_at)}
                      </strong>
                    </div>
                  ))}
              </div>

              {/* SOCIAL CHANNELS WIDGET */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Users size={16} style={{ color: '#059669' }} />
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>Join EduReach Student Communities</strong>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                  Get instant JAMB past question drops, NELFUND loan notices, and school admission list alerts on WhatsApp &amp; Telegram.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    WhatsApp Group
                  </a>
                  <a
                    href="https://t.me/"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    Telegram Channel
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* ESSENTIAL STUDENT TOOLS */}
          <div className="hub-section-heading" style={{ marginTop: '32px', marginBottom: '14px' }}>
            <div>
              <span className="hub-eyebrow">ACADEMIC TOOLS</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900 }}>Tools for Everyday Student Life</h2>
            </div>
          </div>

          <div className="ms-card-grid">
            {filteredTools.map((card) => (
              <a key={card.id} href={card.href} className="ms-card">
                <div className="ms-card-head">
                  <CardIdentityMark value={card.visual} type="service" />
                  <span className="ms-card-badge">{card.eyebrow}</span>
                </div>
                <div className="ms-card-content">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <div className="ms-card-foot">
                  <span className="ms-card-cta">
                    {card.action} <ArrowRight size={13} className="hub-compact-arrow" />
                  </span>
                </div>
              </a>
            ))}
          </div>

          {/* FOOTER CALLOUT */}
          <section className="hub-home-footer-callout" style={{ marginTop: '36px' }}>
            <div>
              <span className="hub-eyebrow">YOUR STUDENT DASHBOARD</span>
              <h2>Keep your services, exam scores and wallet in one place.</h2>
              <p>Explore your personal student dashboard or start a service request today.</p>
            </div>
            <a className="hub-primary-btn" href="/dashboard" style={{ textDecoration: 'none' }}>
              <Sparkles size={15} /> Open Student Workspace
            </a>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
