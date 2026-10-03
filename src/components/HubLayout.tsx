import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MoreVertical,
  X,
  ScanSearch,
  User,
  LogOut,
  LayoutDashboard,
  Home,
  Laptop,
  Newspaper,
  Briefcase,
  Search as SearchIcon,
  MessageCircle,
} from 'lucide-react';
import HubSideRail from './HubSideRail';
import SkipLink from './a11y/SkipLink';
import ConnectionBanner from './ConnectionBanner';
import PageBar from './PageBar';
import BrandLogo from './BrandLogo';
import { useAuth } from '../lib/auth';
import { EDUREACH_WHATSAPP, EDUREACH_WHATSAPP_CHANNEL } from '../data/hubContent';
import '../hub-rail.css';

function navigateToSearch(term: string) {
  const query = term.trim();
  const path = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function HubLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
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
  // Compact initials for mobile — never force the full name into the header.
  const userInitials = useMemo(() => {
    const name = (user?.name || 'Student').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.slice(0, 2) || 'ST').toUpperCase();
  }, [user?.name]);

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
      <SkipLink />
      {/* APP-3: a strip, never a takeover. The page stays usable offline. */}
      <ConnectionBanner />
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
                fontWeight: 680,
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
                color: path === '/' ? '#b14933' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/' ? '2px solid #b14933' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Home
            </a>
            <a
              href="/cbt"
              style={{
                color: path.startsWith('/cbt') ? '#b14933' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/cbt') ? '2px solid #b14933' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              CBT Practice
            </a>
            <a
              href="/services"
              style={{
                color: path === '/services' || path.startsWith('/services/apply') ? '#b14933' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/services') && path !== '/services/track' ? '2px solid #b14933' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Services
            </a>
            <a
              href="/news"
              style={{
                color: path.startsWith('/news') ? '#b14933' : '#334155',
                textDecoration: 'none',
                borderBottom: path.startsWith('/news') ? '2px solid #b14933' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              News
            </a>
            <a
              href="/jobs"
              style={{
                color: path === '/jobs' ? '#b14933' : '#334155',
                textDecoration: 'none',
                borderBottom: path === '/jobs' ? '2px solid #b14933' : '2px solid transparent',
                padding: '4px 0',
              }}
            >
              Grants
            </a>
            <a href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ color: '#047857', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 0', fontWeight: 620 }}>
              <MessageCircle size={14} /> Talk to Us
            </a>
          </nav>

          <form className="hub-global-search" role="search" aria-label="Site search" onSubmit={(event) => { event.preventDefault(); navigateToSearch(siteSearch); }}>
            <SearchIcon size={15} aria-hidden="true" />
            <input value={siteSearch} onChange={(event) => setSiteSearch(event.target.value)} placeholder="Search" aria-label="Search EduReach" />
          </form>

          {/* ACTION BUTTONS & THREE DOT (MOBILE ONLY) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isLoading && isAuthenticated && (
              <a
                href="/dashboard/services"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  borderRadius: '7px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 620,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <ScanSearch size={14} color="#b14933" />
                <span>My Requests</span>
              </a>
            )}

            {!isLoading && !isAuthenticated && (
              <a
                href="/login"
                style={{
                  background: '#b14933',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 620,
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
                  aria-label={`Account menu for ${user?.name || 'Student'}`}
                  className="hub-profile-trigger"
                  style={{
                    background: '#b14933',
                    color: '#ffffff',
                    border: 0,
                    borderRadius: '7px',
                    padding: '6px 11px',
                    fontSize: '12px',
                    fontWeight: 620,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(200, 88, 65, 0.22)',
                  }}
                >
                  <span className="hub-profile-trigger-name"><User size={14} /> {firstName}</span>
                  <span className="hub-profile-trigger-initials" aria-hidden="true">{userInitials}</span>
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
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#5e6c82', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
                    </div>
                    <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 620 }}>
                      <LayoutDashboard size={14} /> Dashboard
                    </a>
                    <a href="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 620 }}>
                      <User size={14} /> Profile
                    </a>
                    <a href="/dashboard/services" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 620 }}>
                      <ScanSearch size={14} /> My Requests
                    </a>
                    <a href="/dashboard/cbt" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 620 }}>
                      <Laptop size={14} /> My CBT
                    </a>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', border: 0, background: 'transparent', color: '#dc2626', fontSize: '12px', fontWeight: 620, cursor: 'pointer', textAlign: 'left' }}
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
                EduReach<span style={{ color: '#b14933' }}>.ng</span>
              </strong>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => { setMobileOpen(false); window.setTimeout(() => mobileTriggerRef.current?.focus(), 0); }}
                style={{ background: 'none', border: 0, color: '#5e6c82', cursor: 'pointer' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <form className="hub-mobile-search" role="search" aria-label="Site search (mobile)" onSubmit={(event) => { event.preventDefault(); setMobileOpen(false); navigateToSearch(siteSearch); }}>
              <SearchIcon size={16} aria-hidden="true" />
              <input value={siteSearch} onChange={(event) => setSiteSearch(event.target.value)} placeholder="Search EduReach" aria-label="Search EduReach" />
              <button type="submit">Go</button>
            </form>

            <nav style={{ display: 'grid', gap: '12px', fontSize: '14px', fontWeight: 560 }}>
              <a href="/" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Home
              </a>
              <a href="/cbt" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                CBT Practice
              </a>
              <a href="/services" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Services
              </a>
              {isAuthenticated && (
                <a href="/dashboard/services" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                  My Requests
                </a>
              )}
              <a href="/news" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                News &amp; Noticeboard
              </a>
              <a href="/jobs" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                Scholarships &amp; Grants
              </a>
              <a href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageCircle size={16} /> Talk to Us
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
                    style={{ textAlign: 'center', background: '#b14933' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="hub-primary-btn"
                    style={{ textAlign: 'center', textDecoration: 'none', background: '#b14933' }}
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
          {/* Redundant pointer affordance: the drawer has a Close button and closes on Escape. */}
          <div style={{ flex: 1 }} role="presentation" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* MAIN BODY CONTENT */}
      <main id="main-content" tabIndex={-1} style={{ flex: 1 }}>
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

      {/* Minimal footer — secondary navigation only; sits naturally at the bottom of content. */}
      <footer className="er-footer" style={{ background: '#0f172a', color: '#94a3b8', padding: '24px 0', borderTop: '1px solid #1e293b', marginTop: 'auto', fontSize: '12px' }}>
        <div className="hub-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BrandLogo height={28} radius="50%" />
              <strong style={{ color: '#ffffff', fontSize: '13px', fontWeight: 620 }}>EduReach Hub</strong>
            </div>
            <nav className="er-footer-links" aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px' }}>
              <a href="/" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Home</a>
              <a href="/cbt" style={{ color: '#cbd5e1', textDecoration: 'none' }}>CBT</a>
              <a href="/services" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Services</a>
              <a href="/news" style={{ color: '#cbd5e1', textDecoration: 'none' }}>News</a>
              <a href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={{ color: '#86efac', fontWeight: 620, textDecoration: 'none' }}>Help</a>
              <a href="#" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Contact</a>
              <a href="#" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Privacy</a>
              <a href="#" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Terms</a>
            </nav>
            <div style={{ fontSize: '11px', color: '#64748b' }}>© {new Date().getFullYear()} EduReach Hub</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
