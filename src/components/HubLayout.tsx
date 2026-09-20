import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  MoreVertical,
  X,
  ScanSearch,
  User,
  ShieldCheck,
  Search,
  Bell,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import HubSideRail from './HubSideRail';
import { useAuth } from '../lib/auth';
import '../hub-rail.css';

export default function HubLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  // Do not crowd full-screen tool pages with the side rail
  const showRail = path === '/news' || (path.startsWith('/news/') && path !== '/news');

  const handleNavSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!navSearch.trim()) return;

    window.history.pushState({}, '', `/services?q=${encodeURIComponent(navSearch.trim())}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    setProfileOpen(false);
    setMobileOpen(false);
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const firstName = user?.name?.split(/\s+/)[0] || 'Student';

  return (
    <div className="hub-shell hub-global-compact" style={{ background: '#FAF8FF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #D9381E 0%, #B51D04 100%)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '15px',
                  fontWeight: 900,
                  boxShadow: '0 2px 6px rgba(217, 56, 30, 0.3)',
                }}
              >
                ER
              </div>
              <span>
                EduReach<span style={{ color: '#D9381E' }}>.ng</span>
              </span>
            </a>
          </div>

          {/* DESKTOP NAVIGATION LINKS */}
          <nav className="hub-desktop-nav">
            <a
              href="/"
              style={{
                color: path === '/' ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/' ? '2px solid #D9381E' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Home
            </a>
            <a
              href="/cbt"
              style={{
                color: path.startsWith('/cbt') ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/cbt') ? '2px solid #D9381E' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              CBT Classroom
            </a>
            <a
              href="/services"
              style={{
                color: path === '/services' || path.startsWith('/services/apply') ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/services') && path !== '/services/track' ? '2px solid #D9381E' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Services &amp; Pins
            </a>
            <a
              href="/screening-calculator"
              style={{
                color: path.includes('calculator') ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path.includes('calculator') ? '2px solid #D9381E' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Calculator
            </a>
            <a
              href="/news"
              style={{
                color: path.startsWith('/news') ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/news') ? '2px solid #D9381E' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              News
            </a>
            <a
              href="/jobs"
              style={{
                color: path === '/jobs' ? '#D9381E' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/jobs' ? '2px solid #D9381E' : '2px solid transparent',
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
              <ScanSearch size={14} color="#D9381E" />
              <span>{isAuthenticated ? 'My Services' : 'Track'}</span>
            </a>

            {!isLoading && !isAuthenticated && (
              <a
                href="/login"
                style={{
                  background: '#D9381E',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(217, 56, 30, 0.25)',
                }}
              >
                Sign In
              </a>
            )}

            {isAuthenticated && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <a
                  href="/dashboard/notifications"
                  aria-label="Notifications"
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '7px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    textDecoration: 'none',
                  }}
                >
                  <Bell size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  style={{
                    background: '#D9381E',
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
                    boxShadow: '0 2px 6px rgba(217, 56, 30, 0.22)',
                  }}
                >
                  <User size={14} /> {firstName}
                </button>
                {profileOpen && (
                  <div
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
                      <ScanSearch size={14} /> My Services
                    </a>
                    <a href="/dashboard/cbt" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 800 }}>
                      <Bell size={14} /> CBT Results
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

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div
          id="hub-mobile-menu"
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
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>
                EduReach<span style={{ color: '#D9381E' }}>.ng</span>
              </strong>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
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
                CBT Classroom
              </a>
              <a href="/services" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Services &amp; Scratch Cards
              </a>
              <a href={isAuthenticated ? '/dashboard/services' : '/services/track'} onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                {isAuthenticated ? 'My Services' : 'Track Application'}
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
                    style={{ textAlign: 'center', background: '#D9381E' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="hub-primary-btn"
                    style={{ textAlign: 'center', textDecoration: 'none', background: '#D9381E' }}
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

      {/* MYSCHOOL FOOTER */}
      <footer
        style={{
          background: '#0f172a',
          color: '#94a3b8',
          padding: '40px 0 24px',
          borderTop: '3px solid #D9381E',
          marginTop: 'auto',
          fontSize: '13px',
        }}
      >
        <div className="hub-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '28px',
              marginBottom: '36px',
            }}
          >
            {/* COLUMN 1: BRAND */}
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: '8px' }}>
                EduReach<span style={{ color: '#F97316' }}>.ng</span>
              </div>
              <p style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: '12px' }}>
                Nigeria's premier academic support portal for CBT practice, verified scratch cards, NELFUND loan assistance, and admission updates.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontSize: '12px', fontWeight: 700 }}>
                <ShieldCheck size={16} /> Verified Academic Portal
              </div>
            </div>

            {/* COLUMN 2: CBT EXAMS */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                CBT Practice Center
              </h4>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/cbt?mode=JAMB" style={{ color: '#cbd5e1', textDecoration: 'none' }}>JAMB UTME 2026 Simulator</a>
                <a href="/cbt?mode=WAEC" style={{ color: '#cbd5e1', textDecoration: 'none' }}>WAEC SSCE Past Questions</a>
                <a href="/cbt?mode=NECO" style={{ color: '#cbd5e1', textDecoration: 'none' }}>NECO Exam Practice</a>
                <a href="/cbt?mode=POST-UTME" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Post-UTME Screening Tests</a>
                <a href="/dashboard/cbt/results" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Performance Scorecards</a>
              </div>
            </div>

            {/* COLUMN 3: SERVICES */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                Student Services &amp; Tools
              </h4>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/services/apply/nelfund-loan" style={{ color: '#cbd5e1', textDecoration: 'none' }}>NELFUND Loan Application</a>
                <a href="/services/apply/scratch-cards" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Buy Scratch Card / Tokens</a>
                <a href="/services/apply/results" style={{ color: '#cbd5e1', textDecoration: 'none' }}>WAEC &amp; NECO Result Checking</a>
                <a href="/services/apply/jamb-slip" style={{ color: '#cbd5e1', textDecoration: 'none' }}>JAMB Exam Slip Printing</a>
                <a href="/screening-calculator" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Screening Score Calculator</a>
                <a href="/services/track" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Track Order Reference</a>
              </div>
            </div>

            {/* COLUMN 4: COMMUNITY & LEGAL */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                Community &amp; Support
              </h4>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                <a href="/news" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Campus Noticeboard</a>
                <a href="/jobs" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Scholarships &amp; Grants</a>
                <a href="/dashboard" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Student Dashboard</a>
                <a href="https://wa.me/2349130134969" target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', textDecoration: 'none' }}>
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
