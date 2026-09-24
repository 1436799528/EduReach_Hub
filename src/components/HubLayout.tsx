import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  MoreVertical,
  X,
  ScanSearch,
  User,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Home,
  Laptop,
  Newspaper,
  Briefcase,
} from 'lucide-react';
import HubSideRail from './HubSideRail';
import PageBar from './PageBar';
import BrandLogo from './BrandLogo';
import { useAuth } from '../lib/auth';
import { EDUREACH_WHATSAPP, EDUREACH_WHATSAPP_CHANNEL } from '../data/hubContent';
import '../hub-rail.css';

export default function HubLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  // Do not crowd full-screen tool pages with the side rail
  const showRail = path === '/news' || (path.startsWith('/news/') && path !== '/news');

  const handleLogout = async () => {
    await signOut();
    setProfileOpen(false);
    setMobileOpen(false);
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const firstName = user?.name?.split(/\s+/)[0] || 'Student';

  useEffect(() => {
    if (!mobileOpen) return;
    mobileCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        window.setTimeout(() => mobileTriggerRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  return (
    <div className="hub-shell hub-global-compact" style={{ background: '#f7f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* CLEAN MAIN HEADER */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          className="hub-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '10px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* BRAND LOGO */}
            <a
              href="/"
              aria-label="EduReach Hub home"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '20px',
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              <BrandLogo height={40} radius="50%" />
            </a>
          </div>

          {/* DESKTOP NAVIGATION LINKS */}
          <nav className="hub-desktop-nav">
            <a
              href="/"
              style={{
                color: path === '/' ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/' ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Home
            </a>
            <a
              href="/cbt"
              style={{
                color: path.startsWith('/cbt') ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/cbt') ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              CBT Practice
            </a>
            <a
              href="/services"
              style={{
                color: path === '/services' || path.startsWith('/services/apply') ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/services') && path !== '/services/track' ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Services &amp; Pins
            </a>
            <a
              href="/screening-calculator"
              style={{
                color: path.includes('calculator') ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path.includes('calculator') ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Calculator
            </a>
            <a
              href="/news"
              style={{
                color: path.startsWith('/news') ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/news') ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              News
            </a>
            <a
              href="/jobs"
              style={{
                color: path === '/jobs' ? '#C85841' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/jobs' ? '2px solid #C85841' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Grants
            </a>
          </nav>

          {/* ACTION BUTTONS & THREE DOT (MOBILE ONLY) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={isAuthenticated ? '/dashboard/services' : '/services/track'}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#334155',
                borderRadius: '7px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <ScanSearch size={14} color="#C85841" />
              <span>{isAuthenticated ? 'My Requests' : 'Track'}</span>
            </a>

            {!isLoading && !isAuthenticated && (
              <a
                href="/login"
                style={{
                  background: '#C85841',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(200, 88, 65, 0.25)',
                }}
              >
                Sign In
              </a>
            )}

            {isAuthenticated && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-controls="hub-profile-menu"
                  style={{
                    background: '#C85841',
                    color: '#ffffff',
                    border: 0,
                    borderRadius: '7px',
                    padding: '6px 11px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(200, 88, 65, 0.22)',
                  }}
                >
                  <User size={14} /> {firstName}
                </button>
                {profileOpen && (
                  <div
                    id="hub-profile-menu"
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: '40px',
                      right: 0,
                      width: '230px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: '8px',
                      zIndex: 200,
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '6px' }}>
                      <strong style={{ display: 'block', fontSize: '12.5px', color: '#0f172a' }}>{user?.name}</strong>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
                    </div>
                    <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 800 }}>
                      <LayoutDashboard size={14} /> Dashboard
                    </a>
                    <a href="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 800 }}>
                      <User size={14} /> Profile
                    </a>
                    <a href="/dashboard/services" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 800 }}>
                      <ScanSearch size={14} /> My Requests
                    </a>
                    <a href="/dashboard/cbt" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 800 }}>
                      <Laptop size={14} /> My CBT
                    </a>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', border: 0, background: 'transparent', color: '#dc2626', fontSize: '12px', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* THREE-DOT TRIGGER: ONLY VISIBLE ON MOBILE */}
            <button
              type="button"
              className="hub-mobile-trigger"
              aria-label="Open mobile menu"
              aria-expanded={mobileOpen}
              aria-controls="hub-mobile-menu"
              ref={mobileTriggerRef}
              onClick={() => setMobileOpen(true)}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '7px',
                color: '#0f172a',
                cursor: 'pointer',
                padding: '6px 8px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </header>

      <PageBar />

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div
          id="hub-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-mobile-menu-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
          }}
        >
          <div
            style={{
              width: '280px',
              background: '#ffffff',
              height: '100%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px',
              }}
            >
              <strong id="hub-mobile-menu-title" style={{ fontSize: '18px', color: '#0f172a' }}>
                EduReach<span style={{ color: '#C85841' }}>.ng</span>
              </strong>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => { setMobileOpen(false); window.setTimeout(() => mobileTriggerRef.current?.focus(), 0); }}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav style={{ display: 'grid', gap: '12px', fontSize: '14px', fontWeight: 700 }}>
              <a href="/" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Home
              </a>
              <a href="/cbt" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                CBT Practice
              </a>
              <a href="/services" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Services &amp; Scratch Cards
              </a>
              <a href={isAuthenticated ? '/dashboard/services' : '/services/track'} onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                {isAuthenticated ? 'My Requests' : 'Track Application'}
              </a>
              <a href="/screening-calculator" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Screening Calculator
              </a>
              <a href="/news" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                News &amp; Noticeboard
              </a>
              <a href="/jobs" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Scholarships &amp; Grants
              </a>
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'grid', gap: '10px' }}>
              {isAuthenticated ? (
                <>
                  <a
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="hub-outline-btn"
                    style={{ textAlign: 'center', textDecoration: 'none' }}
                  >
                    {firstName}'s Profile
                  </a>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="hub-primary-btn"
                    style={{ textAlign: 'center', background: '#C85841' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="hub-primary-btn"
                    style={{ textAlign: 'center', textDecoration: 'none', background: '#C85841' }}
                  >
                    Student Sign In
                  </a>
                  <a
                    href="/register"
                    className="hub-outline-btn"
                    style={{ textAlign: 'center', textDecoration: 'none' }}
                  >
                    Create Account
                  </a>
                </>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }} onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* MAIN BODY CONTENT */}
      <main style={{ flex: 1 }}>
        {showRail ? (
          <div className="hub-layout-with-rail">
            <div className="hub-layout-content">{children}</div>
            <HubSideRail />
          </div>
        ) : (
          children
        )}
      </main>

      {/* MOBILE PORTAL NAVIGATION */}
      <nav className="er-mobile-bottom-nav" aria-label="Mobile navigation">
        <a className={path === '/' ? 'active' : ''} aria-current={path === '/' ? 'page' : undefined} href="/"><Home size={18} /><span>Home</span></a>
        <a className={path.startsWith('/cbt') ? 'active' : ''} aria-current={path.startsWith('/cbt') ? 'page' : undefined} href="/cbt"><Laptop size={18} /><span>CBT</span></a>
        <a className={path.startsWith('/news') ? 'active' : ''} aria-current={path.startsWith('/news') ? 'page' : undefined} href="/news"><Newspaper size={18} /><span>News</span></a>
        <a className={path.startsWith('/services') ? 'active' : ''} aria-current={path.startsWith('/services') ? 'page' : undefined} href="/services"><Briefcase size={18} /><span>Services</span></a>
        <a className={path.startsWith('/dashboard') || path === '/login' ? 'active' : ''} aria-current={path.startsWith('/dashboard') || path === '/login' ? 'page' : undefined} href={isAuthenticated ? '/dashboard' : '/login'}><User size={18} /><span>Account</span></a>
      </nav>

      {/* MYSCHOOL FOOTER */}
      <footer
        className="er-footer"
        style={{
          background: '#0f172a',
          color: '#94a3b8',
          padding: '40px 0 24px',
          borderTop: '3px solid #C85841',
          marginTop: 'auto',
          fontSize: '13px',
        }}
      >
        <div className="hub-container">
          <div
            className="er-footer-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '28px',
              marginBottom: '36px',
            }}
          >
            {/* COLUMN 1: BRAND */}
            <div className="er-footer-brand">
              <div style={{ marginBottom: '10px', display: 'inline-flex', padding: '3px', background: '#ffffff', borderRadius: '50%' }}>
                <BrandLogo height={46} radius="50%" />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: '8px' }}>
                EduReach<span style={{ color: 'var(--er-tangerine)' }}>.ng</span>
              </div>
              <p style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: '12px' }}>
                Nigeria's premier academic support portal for CBT practice, verified scratch cards, NELFUND loan assistance, and admission updates.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#86efac', fontSize: '12px', fontWeight: 700 }}>
                <ShieldCheck size={16} /> Verified Academic Portal
              </div>
            </div>

            {/* COLUMN 2: CBT EXAMS — each link starts the simulator directly */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                CBT Practice Center
              </h4>
              <div className="er-footer-links" style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/cbt/practice?exam=practice-exam-jamb" style={{ color: '#cbd5e1', textDecoration: 'none' }}>JAMB CBT Simulator</a>
                <a href="/cbt/practice?exam=practice-exam-waec" style={{ color: '#cbd5e1', textDecoration: 'none' }}>WAEC CBT Practice</a>
                <a href="/cbt/practice?exam=practice-exam-neco" style={{ color: '#cbd5e1', textDecoration: 'none' }}>NECO CBT Practice</a>
                <a href="/cbt/practice?exam=practice-exam-post-utme" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Post-UTME Screening Test</a>
                <a href="/cbt" style={{ color: '#cbd5e1', textDecoration: 'none' }}>All Question Banks</a>
                <a href="/dashboard/cbt" style={{ color: '#cbd5e1', textDecoration: 'none' }}>My CBT Results</a>
              </div>
            </div>

            {/* COLUMN 3: SERVICES — live application workflows only */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                Student Services &amp; Tools
              </h4>
              <div className="er-footer-links" style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/services/apply/nelfund-loan" style={{ color: '#cbd5e1', textDecoration: 'none' }}>NELFUND Loan Application</a>
                <a href="/services/apply/scratch-cards" style={{ color: '#cbd5e1', textDecoration: 'none' }}>WAEC / NECO Scratch Cards</a>
                <a href="/services/apply/results" style={{ color: '#cbd5e1', textDecoration: 'none' }}>WAEC / NECO Result Checking</a>
                <a href="/services/apply/jamb-slip" style={{ color: '#cbd5e1', textDecoration: 'none' }}>JAMB Exam Slip Printing</a>
                <a href="/services/apply/admission-letters" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Admission Letters</a>
                <a href="/screening-calculator" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Screening Calculator</a>
                <a href="/services/track" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Track Application Status</a>
              </div>
            </div>

            {/* COLUMN 4: COMMUNITY & LEGAL */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                Community &amp; Support
              </h4>
              <div className="er-footer-links" style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/news" style={{ color: '#cbd5e1', textDecoration: 'none' }}>News &amp; Updates</a>
                <a href="/jobs" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Scholarships &amp; Grants</a>
                <a href="/dashboard" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Student Dashboard</a>
                <a href={EDUREACH_WHATSAPP_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', textDecoration: 'none', fontWeight: 800 }}>
                  📢 Follow EduReach Hub NG on WhatsApp
                </a>
                <span style={{ color: '#94a3b8', fontSize: '11.5px', lineHeight: 1.5 }}>
                  Get education updates, opportunities, resources and announcements directly on WhatsApp.
                </span>
                <a href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', textDecoration: 'none' }}>
                  WhatsApp Official Helpline
                </a>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '20px',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '11px',
              color: '#64748b',
            }}
          >
            <div>
              © {new Date().getFullYear()} EduReach.ng. All rights reserved.
            </div>
            <div>
              Disclaimer: EduReach is an independent academic support network. JAMB, WAEC, NECO, and university trademarks belong to their statutory bodies.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
