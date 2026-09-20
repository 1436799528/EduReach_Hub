import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Menu,
  X,
  Home,
  BrainCircuit,
  Zap,
  ScanSearch,
  MessageCircle,
  Search,
  ShieldCheck,
  User,
  GraduationCap,
  Calculator,
  ChevronRight,
  Headphones,
} from 'lucide-react';
import HubSideRail from './HubSideRail';
import '../hub-rail.css';

export default function HubLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  // Do not crowd full-screen tool pages (CBT Practice, CBT Results, Tracker, Calculator, Apply, Dashboard) with the side rail
  const showRail = path === '/news' || (path.startsWith('/news/') && path !== '/news');

  const handleNavSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      window.location.href = `/services?q=${encodeURIComponent(navSearch.trim())}`;
    }
  };

  return (
    <div className="hub-shell hub-global-compact" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* MYSCHOOL TOP UTILITY GREEN BAR */}
      <div
        style={{
          background: '#064e3b',
          color: '#ffffff',
          fontSize: '11.5px',
          fontWeight: 600,
          padding: '6px 0',
          borderBottom: '1px solid #047857',
        }}
      >
        <div
          className="hub-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: '#059669',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '9.5px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              PORTAL NOTICE
            </span>
            <span>Welcome to EduReach.ng — Nigeria's Premier Academic &amp; Student Services Hub</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <a href="/cbt" style={{ color: '#86efac', textDecoration: 'none', fontWeight: 700 }}>
              CBT Hall
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <a href="/services/track" style={{ color: '#ffffff', textDecoration: 'none' }}>
              Track Application
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <a href="/dashboard" style={{ color: '#ffffff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <User size={12} /> Student Account
            </a>
          </div>
        </div>
      </div>

      {/* MYSCHOOL MAIN HEADER */}
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
            padding: '10px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="hub-mobile-trigger"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="hub-mobile-menu"
              onClick={() => setMobileOpen(true)}
              style={{
                display: 'none',
                background: 'none',
                border: 0,
                color: '#0f172a',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Menu size={22} />
            </button>

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
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '15px',
                  fontWeight: 900,
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                }}
              >
                ER
              </div>
              <span>
                EduReach<span style={{ color: '#059669' }}>.ng</span>
              </span>
            </a>
          </div>

          {/* DESKTOP SEARCH BAR */}
          <form
            onSubmit={handleNavSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 260px',
              maxWidth: '380px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '4px 10px',
            }}
          >
            <Search size={16} color="#64748b" style={{ flexShrink: 0, marginRight: '8px' }} />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Search JAMB, WAEC, NELFUND, schools…"
              style={{
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: '13px',
                width: '100%',
                color: '#0f172a',
              }}
            />
          </form>

          {/* DESKTOP NAVIGATION LINKS */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <a
              href="/"
              style={{
                color: path === '/' ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/' ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Home
            </a>
            <a
              href="/cbt"
              style={{
                color: path.startsWith('/cbt') ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/cbt') ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              CBT Classroom
            </a>
            <a
              href="/services"
              style={{
                color: path === '/services' || path.startsWith('/services/apply') ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/services') && path !== '/services/track' ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Services &amp; Pins
            </a>
            <a
              href="/screening-calculator"
              style={{
                color: path.includes('calculator') ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path.includes('calculator') ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Calculator
            </a>
            <a
              href="/news"
              style={{
                color: path.startsWith('/news') ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/news') ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              News
            </a>
            <a
              href="/jobs"
              style={{
                color: path === '/jobs' ? '#059669' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/jobs' ? '2px solid #059669' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Grants
            </a>
          </nav>

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="/services/track"
              style={{
                background: '#f1f5f9',
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
              <ScanSearch size={14} color="#059669" />
              <span>Track</span>
            </a>
            <a
              href="/login"
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 0,
                borderRadius: '7px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
              }}
            >
              Sign In
            </a>
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
                EduReach<span style={{ color: '#059669' }}>.ng</span>
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
              <a href="/services/track" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Track Application
              </a>
              <a href="/screening-calculator" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Screening Calculator
              </a>
              <a href="/news" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                News &amp; Noticeboard
              </a>
              <a href="/jobs" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Scholarships &amp; Jobs
              </a>
              <a href="/dashboard" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Student Workspace
              </a>
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'grid', gap: '10px' }}>
              <a
                href="/login"
                className="hub-primary-btn"
                style={{ textAlign: 'center', textDecoration: 'none', background: '#059669' }}
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
          borderTop: '3px solid #059669',
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
                EduReach<span style={{ color: '#10b981' }}>.ng</span>
              </div>
              <p style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: '12px' }}>
                Nigeria's premier academic support portal for CBT practice, verified scratch cards, NELFUND loan assistance, and admission updates.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
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
                <a href="/cbt/results" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Performance Scorecards</a>
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
                <a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', textDecoration: 'none' }}>
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
