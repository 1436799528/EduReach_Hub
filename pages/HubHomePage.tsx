import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
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

type ServiceCard = {
  id: string;
  title: string;
  description: string;
  badge: string;
  href: string;
  iconImage: string;
  themeMark: string;
  actionText: string;
};

const topExamTiles = [
  {
    title: 'JAMB CBT Simulator',
    subtitle: 'Full UTME syllabus questions with real exam timer',
    href: '/cbt?mode=JAMB',
    img: '/icons/jamb.svg',
    tag: 'UTME 2026',
  },
  {
    title: 'WAEC CBT Practice',
    subtitle: 'SSCE & GCE objective past questions revision',
    href: '/cbt?mode=WAEC',
    img: '/icons/waec.svg',
    tag: 'SSCE REVISION',
  },
  {
    title: 'NECO CBT Simulator',
    subtitle: 'National Exams Council past questions & solutions',
    href: '/cbt?mode=NECO',
    img: '/icons/neco.svg',
    tag: 'NECO 2026',
  },
  {
    title: 'NELFUND Loan Portal',
    subtitle: 'Federal student loan assistance & verification',
    href: '/services/apply/nelfund-loan',
    img: '/icons/nelfund.svg',
    tag: 'STUDENT LOAN',
  },
];

const verifiedServices: ServiceCard[] = [
  {
    id: 'nelfund',
    title: 'NELFUND Loan Application',
    description: 'Guided profile verification, institutional clearance, and loan processing.',
    badge: 'FEDERAL AID',
    href: '/services/apply/nelfund-loan',
    iconImage: '/icons/nelfund.svg',
    themeMark: 'nelfund-loan',
    actionText: 'Apply for Loan',
  },
  {
    id: 'waec-results',
    title: 'WAEC / NECO Result Checker',
    description: 'Instant online result checking assistance and verified scratch card tokens.',
    badge: 'EXAM RESULTS',
    href: '/services/apply/results',
    iconImage: '/icons/waec.svg',
    themeMark: 'results',
    actionText: 'Check Result',
  },
  {
    id: 'scratch-cards',
    title: 'Scratch Cards / Token PINs',
    description: 'Instant delivery of official WAEC and NECO examination checker PINs.',
    badge: 'INSTANT DELIVERY',
    href: '/services/apply/scratch-cards',
    iconImage: '/icons/scratch-cards.svg',
    themeMark: 'scratch-cards',
    actionText: 'Buy Scratch Card',
  },
  {
    id: 'jamb-slip',
    title: 'JAMB Exam Slip Printing',
    description: 'Coloured examination slip printing with verified centre locator and timing.',
    badge: 'JAMB PORTAL',
    href: '/services/apply/jamb-slip',
    iconImage: '/icons/jamb.svg',
    themeMark: 'jamb-slip',
    actionText: 'Print Exam Slip',
  },
  {
    id: 'admission-letters',
    title: 'Admission Deferment & Letters',
    description: 'Prepare formal deferment requests and supplementary admission letters.',
    badge: 'ADMISSIONS',
    href: '/services/apply/admission-letters',
    iconImage: '/icons/admission.svg',
    themeMark: 'admission-letters',
    actionText: 'Request Letter',
  },
  {
    id: 'post-utme',
    title: 'Post-UTME Past Questions & CBT',
    description: 'Institution-specific screening past questions with timed mock tests.',
    badge: 'SCREENING',
    href: '/cbt?mode=POST-UTME',
    iconImage: '/icons/post-utme.svg',
    themeMark: 'post-utme',
    actionText: 'Practice Post-UTME',
  },
];

const cbtSubjects = [
  { name: 'Use of English', questions: '40 Qs', icon: '📖' },
  { name: 'Mathematics', questions: '40 Qs', icon: '📐' },
  { name: 'Biology', questions: '40 Qs', icon: '🔬' },
  { name: 'Chemistry', questions: '40 Qs', icon: '🧪' },
  { name: 'Physics', questions: '40 Qs', icon: '⚡' },
  { name: 'Economics', questions: '40 Qs', icon: '📊' },
  { name: 'Government', questions: '40 Qs', icon: '🏛️' },
  { name: 'Literature in English', questions: '40 Qs', icon: '📚' },
];

function formatDate(value: string | null) {
  if (!value) return 'Recent';
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HubHomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackRef, setTrackRef] = useState('');
  const [activeNewsCategory, setActiveNewsCategory] = useState('all');

  useEffect(() => {
    let active = true;
    void fetchNews()
      .then((items) => {
        if (active) setNews(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingNews(false);
      });

    void fetchUpcoming()
      .then((items) => {
        if (active) setUpcoming(items);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const filteredNews = useMemo(() => {
    if (activeNewsCategory === 'all') return news;
    return news.filter((item) =>
      item.category.toLowerCase().includes(activeNewsCategory.toLowerCase())
    );
  }, [news, activeNewsCategory]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '16px 0 60px' }}>
        <div className="hub-container">
          {/* MYSCHOOL NOTICE TICKER (NO LARGE HERO) */}
          <div className="ms-ticker-strip">
            <span className="ms-ticker-badge">LATEST</span>
            <span className="ms-ticker-text">
              JAMB CAPS 2026/2027 Admission Monitoring is Active • NELFUND Student Loan Application Open • WAEC GCE 2nd Series Registration Commenced
            </span>
            <a
              href="/news"
              style={{
                color: '#86efac',
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '11px',
                flexShrink: 0,
              }}
            >
              View Noticeboard →
            </a>
          </div>

          {/* MYSCHOOL COMPACT SEARCH / SELECTOR BAR */}
          <div className="ms-search-bar">
            <Search size={18} color="#059669" />
            <input
              type="text"
              className="ms-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search JAMB, WAEC, NECO, NELFUND, Admission lists or course requirements…"
              aria-label="Search EduReach content"
            />
            {searchQuery && (
              <a
                href={`/services?q=${encodeURIComponent(searchQuery)}`}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Search
              </a>
            )}
          </div>

          {/* MYSCHOOL TOP 4 EXAM & SIMULATOR TILES */}
          <div className="ms-top-tiles-grid">
            {topExamTiles.map((tile) => (
              <a key={tile.title} href={tile.href} className="ms-top-tile">
                <div className="ms-top-tile-icon">
                  <img src={tile.img} alt={tile.title} width={42} height={42} />
                </div>
                <div className="ms-top-tile-body">
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 900,
                      color: '#059669',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {tile.tag}
                  </span>
                  <strong>{tile.title}</strong>
                  <span>{tile.subtitle}</span>
                </div>
                <ArrowRight size={14} color="#059669" style={{ flexShrink: 0 }} />
              </a>
            ))}
          </div>

          {/* 2-COLUMN MYSCHOOL BEDROCK PORTAL LAYOUT */}
          <div className="ms-portal-layout">
            {/* LEFT COLUMN: SERVICES & NEWS & CBT SUBJECTS */}
            <main>
              {/* SECTION: VERIFIED STUDENT SERVICES */}
              <section style={{ marginBottom: '28px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #059669',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={18} color="#059669" />
                    Verified Student Services &amp; Scratch Cards
                  </h2>
                  <a
                    href="/services"
                    style={{ fontSize: '12px', fontWeight: 800, color: '#059669', textDecoration: 'none' }}
                  >
                    All Services ({verifiedServices.length}) →
                  </a>
                </div>

                {/* 3-COLUMN SERVICE CARDS WITH THEME IMAGE BADGE */}
                <div className="ms-card-grid">
                  {verifiedServices.map((service) => (
                    <a key={service.id} href={service.href} className="ms-service-card">
                      <div className="ms-service-card-header">
                        <CardIdentityMark value={service.themeMark} type="service" size="sm" />
                        <span className="ms-service-badge">{service.badge}</span>
                      </div>

                      <div className="ms-service-body">
                        <h3>{service.title}</h3>
                        <p>{service.description}</p>
                      </div>

                      <div className="ms-service-foot">
                        <span className="ms-service-cta">
                          {service.actionText} <ArrowRight size={13} />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>

              {/* SECTION: CBT CLASSROOM SUBJECT QUICK PRACTICE */}
              <section style={{ marginBottom: '28px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #0284c7',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Laptop size={18} color="#0284c7" />
                    CBT Classroom Practice Subjects
                  </h2>
                  <a
                    href="/cbt"
                    style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7', textDecoration: 'none' }}
                  >
                    Open CBT Hall →
                  </a>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '10px',
                  }}
                >
                  {cbtSubjects.map((sub) => (
                    <a
                      key={sub.name}
                      href="/cbt/practice?exam=demo-exam-jamb"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '12px 10px',
                        textDecoration: 'none',
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0284c7';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{sub.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '12.5px',
                            fontWeight: 800,
                            lineHeight: 1.25,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sub.name}
                        </strong>
                        <span style={{ fontSize: '10.5px', color: '#64748b' }}>{sub.questions} • Timed</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>

              {/* SECTION: LATEST EDUCATIONAL NEWS & CAMPUS UPDATES */}
              <section>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #059669',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Latest Educational News &amp; Updates
                  </h2>

                  {/* FILTER TABS */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { id: 'all', label: 'All News' },
                      { id: 'jamb', label: 'JAMB' },
                      { id: 'admission', label: 'Admission' },
                      { id: 'waec', label: 'WAEC/NECO' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveNewsCategory(tab.id)}
                        style={{
                          background: activeNewsCategory === tab.id ? '#059669' : '#f1f5f9',
                          color: activeNewsCategory === tab.id ? '#ffffff' : '#475569',
                          border: 0,
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingNews ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    Loading verified announcements…
                  </div>
                ) : filteredNews.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No announcements found in this category.
                  </div>
                ) : (
                  <div>
                    {filteredNews.slice(0, 6).map((item) => (
                      <a
                        key={item.id}
                        href={`/news/${encodeURIComponent(item.slug)}`}
                        className="ms-news-row"
                      >
                        <div className="ms-news-thumb">
                          <CardIdentityMark value={item.category} type="news" size="sm" />
                        </div>
                        <div className="ms-news-main">
                          <div className="ms-news-meta">
                            <span style={{ fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                              {item.category.replace('_', ' ')}
                            </span>
                            <span>•</span>
                            <span>{formatDate(item.published_at)}</span>
                            <span>•</span>
                            <span style={{ color: '#64748b' }}>Verified</span>
                          </div>
                          <h3>{item.title}</h3>
                          <p>{item.summary || 'Click to read full details and guidelines on this verified announcement.'}</p>
                        </div>
                        <ArrowRight size={15} color="#cbd5e1" style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS (MYSCHOOL RADAR) */}
            <aside>
              {/* WIDGET 1: QUICK APPLICATION TRACKER */}
              <div className="ms-sidebar-widget">
                <h3 className="ms-widget-title">
                  <Search size={15} color="#059669" /> Track Application
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Enter your reference code to check real-time processing status.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (trackRef.trim()) {
                      window.location.href = `/services/track?ref=${encodeURIComponent(trackRef.trim().toUpperCase())}`;
                    }
                  }}
                  style={{ display: 'flex', gap: '6px' }}
                >
                  <input
                    type="text"
                    value={trackRef}
                    onChange={(e) => setTrackRef(e.target.value.toUpperCase())}
                    placeholder="e.g. ER-9482-JAMB"
                    required
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      border: 0,
                      borderRadius: '6px',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Track
                  </button>
                </form>
              </div>

              {/* WIDGET 2: SCREENING AGGREGATE CALCULATOR */}
              <div className="ms-sidebar-widget">
                <h3 className="ms-widget-title">
                  <CardIdentityMark value="calculator" type="service" size="sm" /> Screening Calculator
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Estimate your university admission screening aggregate using target institution weighting.
                </p>
                <a
                  href="/screening-calculator"
                  className="hub-primary-btn"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontSize: '12px',
                    padding: '8px 12px',
                    background: '#047857',
                  }}
                >
                  Open Aggregate Calculator →
                </a>
              </div>

              {/* WIDGET 3: ACADEMIC CALENDAR & DEADLINES */}
              <div className="ms-sidebar-widget">
                <h3 className="ms-widget-title">
                  <Calendar size={15} color="#059669" /> Important Deadlines
                </h3>
                <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                  {upcoming.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '8px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                          {item.kind}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {(item.due_at || item.starts_at) ? new Date(item.due_at || item.starts_at!).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) : 'Upcoming'}
                        </span>
                      </div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '12px', lineHeight: 1.3 }}>
                        {item.title}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* WIDGET 4: WHATSAPP COMMUNITY */}
              <div
                className="ms-sidebar-widget"
                style={{
                  background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                  color: '#ffffff',
                  border: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <MessageCircle size={20} color="#86efac" />
                  <strong style={{ fontSize: '14px', color: '#ffffff' }}>Join WhatsApp Community</strong>
                </div>
                <p style={{ fontSize: '12px', margin: '0 0 12px', opacity: 0.9, lineHeight: 1.4 }}>
                  Connect with over 150,000 students, get instant admission alerts, and past question discussions.
                </p>
                <a
                  href="https://chat.whatsapp.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#25d366',
                    color: '#064e3b',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 900,
                    fontSize: '12px',
                    textDecoration: 'none',
                  }}
                >
                  Join Official Group Now
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
