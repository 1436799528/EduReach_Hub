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
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

const topPortalPillars = [
  {
    title: 'JAMB CBT Simulator',
    subtitle: 'UTME exam simulator with real timer and scoring',
    href: '/cbt',
    img: '/icons/jamb.svg',
    tag: 'UTME 2026',
  },
  {
    title: 'Verified Student Services',
    subtitle: 'NELFUND student loans, WAEC/NECO scratch cards & slips',
    href: '/services',
    img: '/icons/scratch-cards.svg',
    tag: 'SERVICES',
  },
  {
    title: 'Screening Calculator',
    subtitle: 'Aggregate calculator for Nigerian tertiary admissions',
    href: '/screening-calculator',
    img: '/icons/calculator.svg',
    tag: 'AGGREGATE',
  },
  {
    title: 'Scholarships & Grants',
    subtitle: 'Verified Federal, state, and international student funding',
    href: '/jobs',
    img: '/icons/scholarship.svg',
    tag: 'FUNDING',
  },
];

const featuredServices = [
  {
    id: 'nelfund',
    title: 'NELFUND Student Loan',
    description: 'Federal tuition assistance, upkeep loans, and institutional verification.',
    href: '/services/apply/nelfund-loan',
    themeMark: 'nelfund-loan',
    badge: 'FEDERAL AID',
  },
  {
    id: 'scratch-cards',
    title: 'WAEC / NECO Scratch Cards',
    description: 'Instant delivery of verified examination checker PINs and tokens.',
    href: '/services/apply/scratch-cards',
    themeMark: 'scratch-cards',
    badge: 'INSTANT PIN',
  },
  {
    id: 'jamb-slip',
    title: 'JAMB Exam Slip Printing',
    description: 'Original coloured examination slips with venue, date, and schedule.',
    href: '/services/apply/jamb-slip',
    themeMark: 'jamb-slip',
    badge: 'ORIGINAL SLIP',
  },
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
  const [activeNewsCategory, setActiveNewsCategory] = useState('all');
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    let active = true;

    // Check user session
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data?.session?.user) {
        const u = data.session.user;
        setLoggedInUser({
          name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Student',
          email: u.email || '',
        });
      }
    });

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
      <div className="hub-page" style={{ padding: '14px 0 50px' }}>
        <div className="hub-container">
          {/* 1. BREAKING NOTICE TICKER */}
          <div className="ms-ticker-strip">
            <span className="ms-ticker-badge">NOTICE</span>
            <span className="ms-ticker-text">
              JAMB CAPS 2026/2027 Admission Monitoring Active • NELFUND Student Loan Verification Open • WAEC &amp; NECO Result Checking Services Live
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
              Noticeboard →
            </a>
          </div>

          {/* 2. LOGGED-IN QUICK BANNER (If user is signed in) */}
          {loggedInUser && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#059669" />
                <span style={{ fontSize: '12.5px', color: '#065f46', fontWeight: 700 }}>
                  Welcome back, <strong>{loggedInUser.name}</strong>! Your applications and mock exam scores are ready in your dashboard.
                </span>
              </div>
              <a
                href="/dashboard"
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <LayoutDashboard size={13} /> Open Dashboard →
              </a>
            </div>
          )}

          {/* 3. COMPACT SEARCH BAR */}
          <div className="ms-search-bar" style={{ marginBottom: '14px' }}>
            <Search size={18} color="#059669" />
            <input
              type="text"
              className="ms-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search JAMB, WAEC, NELFUND, university cut-offs, or course requirements…"
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

          {/* 4. TOP 4 PORTAL PILLARS */}
          <div className="ms-top-tiles-grid" style={{ marginBottom: '18px' }}>
            {topPortalPillars.map((tile) => (
              <a key={tile.title} href={tile.href} className="ms-top-tile">
                <div className="ms-top-tile-icon">
                  <img src={tile.img} alt={tile.title} width={38} height={38} />
                </div>
                <div className="ms-top-tile-body">
                  <span
                    style={{
                      fontSize: '9.5px',
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

          {/* 5. 2-COLUMN MYSCHOOL PORTAL LAYOUT */}
          <div className="ms-portal-layout">
            {/* LEFT MAIN COLUMN: LATEST NEWS & FEATURED SERVICES OVERVIEW */}
            <main>
              {/* SECTION: LATEST EDUCATIONAL NEWS & CAMPUS NOTICES (Core of Myschool.ng) */}
              <section style={{ marginBottom: '24px' }}>
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
                      fontSize: '14.5px',
                      fontWeight: 900,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Latest Educational News &amp; Updates
                  </h2>

                  {/* FILTER TABS */}
                  <div style={{ display: 'flex', gap: '5px' }}>
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
                          borderRadius: '5px',
                          padding: '3px 9px',
                          fontSize: '10.5px',
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
                          <p>{item.summary || 'Click to read official guidelines and instructions on this announcement.'}</p>
                        </div>
                        <ArrowRight size={15} color="#cbd5e1" style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <a
                    href="/news"
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#059669',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    View All Educational News &amp; Updates →
                  </a>
                </div>
              </section>

              {/* SECTION: FEATURED ACADEMIC SERVICES (Compact 3-Card Strip, not overwhelming) */}
              <section>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    paddingBottom: '6px',
                    borderBottom: '2px solid #059669',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '14.5px',
                      fontWeight: 900,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle2 size={16} color="#059669" />
                    Verified Student Services
                  </h2>
                  <a
                    href="/services"
                    style={{ fontSize: '11.5px', fontWeight: 800, color: '#059669', textDecoration: 'none' }}
                  >
                    Browse Catalog →
                  </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {featuredServices.map((service) => (
                    <a
                      key={service.id}
                      href={service.href}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        textDecoration: 'none',
                        color: '#0f172a',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <CardIdentityMark value={service.themeMark} type="service" size="sm" />
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 5px', borderRadius: '4px' }}>
                            {service.badge}
                          </span>
                        </div>
                        <strong style={{ fontSize: '12.5px', display: 'block', color: '#0f172a', marginBottom: '4px' }}>
                          {service.title}
                        </strong>
                        <p style={{ margin: 0, fontSize: '10.5px', color: '#64748b', lineHeight: 1.45 }}>
                          {service.description}
                        </p>
                      </div>

                      <div style={{ marginTop: '10px', fontSize: '11px', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Request Service <ArrowRight size={12} />
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            </main>

            {/* RIGHT COLUMN: DASHBOARD PROMPT + NOTICEBOARD / DEADLINES */}
            <aside>
              {/* WIDGET 1: STUDENT DASHBOARD PROMPT CARD */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <LayoutDashboard size={16} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                      Student Workspace
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Personal academic portal
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5, margin: '0 0 12px' }}>
                  Track your service applications, review past CBT scores, calculate your semester CGPA, and save shortlisted universities.
                </p>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <a
                    href="/dashboard"
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    {loggedInUser ? 'Open My Dashboard →' : 'Sign In to Dashboard →'}
                  </a>
                  {!loggedInUser && (
                    <a
                      href="/register"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Create Free Student Account
                    </a>
                  )}
                </div>
              </div>

              {/* WIDGET 2: ACADEMIC CALENDAR & DEADLINES */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Calendar size={15} color="#059669" />
                  <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.04em' }}>
                    Academic Deadlines
                  </strong>
                </div>

                <div style={{ display: 'grid', gap: '8px', fontSize: '11.5px' }}>
                  {upcoming.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '8px 10px',
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>
                          {item.kind}
                        </span>
                        <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                          {item.due_at || item.starts_at
                            ? new Date(item.due_at || item.starts_at!).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
                            : 'Upcoming'}
                        </span>
                      </div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '11.5px', lineHeight: 1.3 }}>
                        {item.title}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* WIDGET 3: WHATSAPP COMMUNITY & HELPLINE */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <MessageCircle size={18} color="#86efac" />
                  <strong style={{ fontSize: '13px', color: '#ffffff' }}>Official WhatsApp Helpline</strong>
                </div>
                <p style={{ fontSize: '11px', margin: '0 0 10px', color: '#d1fae5', lineHeight: 1.45 }}>
                  Get real-time admission assistance, scratch card PIN verification, and scholarship announcements.
                </p>
                <a
                  href="https://wa.me/2348000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#25d366',
                    color: '#064e3b',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '11.5px',
                    textDecoration: 'none',
                  }}
                >
                  Chat with Academic Support →
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
