import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  X,
  ScanSearch,
  User,
  LogOut,
  LayoutDashboard,
  Home,
  Laptop,
  Newspaper,
  Briefcase,
  MessageCircle,
  BookOpenCheck,
  FileText,
  GraduationCap,
  BarChart3,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import HubSideRail from './HubSideRail';
import SkipLink from './a11y/SkipLink';
import ConnectionBanner from './ConnectionBanner';
import PageBar from './PageBar';
import BrandLogo from './BrandLogo';
import { useAuth } from '../lib/auth';
import { navigateInApp } from '../lib/navigation';
import { EDUREACH_WHATSAPP } from '../data/hubContent';
import SiteFooter from './SiteFooter';
import SiteSearch from './LazySiteSearch';
import NotificationCenter from './NotificationCenter';
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
    navigateInApp('/');
  };

  const firstName = user?.name?.split(/\s+/)[0] || 'Student';
  // Compact initials for mobile - never force the full name into the header.
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
              className="hub-brand-link"
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

          {/* DESKTOP NAVIGATION — the five student jobs, then a secondary
              menu. News, services and scholarships are not primary tasks, so
              they stop competing with practice for the first five slots. */}
          <nav className="hub-desktop-nav" aria-label="Primary">
            {[
              { href: '/', label: 'Home', Icon: Home, active: path === '/' },
              { href: '/cbt', label: 'Practice', Icon: BookOpenCheck, active: path.startsWith('/cbt') },
              { href: '/past-questions', label: 'Past questions', Icon: FileText, active: path.startsWith('/past-questions') },
              {
                href: isAuthenticated ? '/dashboard/cbt' : '/login',
                label: 'My CBT',
                Icon: Laptop,
                active: isAuthenticated && path.startsWith('/dashboard/cbt') && !path.startsWith('/dashboard/cbt/results'),
              },
              {
                href: isAuthenticated ? '/dashboard/cbt/results' : '/login',
                label: 'Results',
                Icon: BarChart3,
                active: isAuthenticated && path.startsWith('/dashboard/cbt/results'),
              },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="hub-nav-link"
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
            <details className="hub-more" onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              const details = event.currentTarget;
              details.open = false;
              details.querySelector('summary')?.focus();
            }}>
              <summary className="hub-nav-link" aria-label="More" title="More">
                <MoreHorizontal size={18} aria-hidden="true" />
              </summary>
              <div className="hub-more-panel">
                <a href="/services"><Briefcase size={15} aria-hidden="true" /> Services</a>
                <a href="/news"><Newspaper size={15} aria-hidden="true" /> News</a>
                <a href="/jobs"><GraduationCap size={15} aria-hidden="true" /> Scholarships</a>
                <a href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} aria-hidden="true" /> Talk to us</a>
              </div>
            </details>
          </nav>

          {path !== '/' && <SiteSearch variant="header" label="Site search" placeholder="Search EduReach" />}

          {/* ACTION BUTTONS & THREE DOT (MOBILE ONLY) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isLoading && isAuthenticated && <NotificationCenter />}
            {!isLoading && !isAuthenticated && (
              <a
                href="/login"
                style={{
                  background: 'var(--er-primary)',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 620,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(30, 64, 175, 0.25)',
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
                    background: 'var(--er-primary)',
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
                    boxShadow: '0 2px 6px rgba(30, 64, 175, 0.22)',
                  }}
                >
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
                    <a href="/settings" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', textDecoration: 'none', color: '#0f172a', fontSize: '12px', fontWeight: 620 }}>
                      <Settings size={14} /> Settings
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
              <Menu size={18} aria-hidden="true" />
              <span className="hub-menu-label">Menu</span>
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
                EduReach<span style={{ color: 'var(--er-primary)' }}>.ng</span>
              </strong>
              <button
                ref={mobileCloseRef}
                type="button"
                className="hub-mobile-close"
                onClick={() => { setMobileOpen(false); window.setTimeout(() => mobileTriggerRef.current?.focus(), 0); }}
                style={{ background: 'none', border: 0, color: '#5e6c82', cursor: 'pointer' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <SiteSearch variant="drawer" label="Site search (mobile)" onNavigate={() => setMobileOpen(false)} />

            <nav className="hub-mobile-nav" aria-label="Site sections">
              <p className="hub-mobile-nav-label">Study</p>
              {[
                { href: '/', label: 'Home', active: path === '/' },
                { href: '/cbt', label: 'Practice', active: path.startsWith('/cbt') },
                { href: '/past-questions', label: 'Past questions', active: path.startsWith('/past-questions') },
                {
                  href: isAuthenticated ? '/dashboard/cbt' : '/login',
                  label: 'My CBT',
                  active: isAuthenticated && path.startsWith('/dashboard/cbt') && !path.startsWith('/dashboard/cbt/results'),
                },
                {
                  href: isAuthenticated ? '/dashboard/cbt/results' : '/login',
                  label: 'Results',
                  active: isAuthenticated && path.startsWith('/dashboard/cbt/results'),
                },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.label}
                </a>
              ))}

              <p className="hub-mobile-nav-label">Explore</p>
              {[
                { href: '/services', label: 'Services', active: path.startsWith('/services') && path !== '/services/track' },
                { href: '/news', label: 'News and noticeboard', active: path.startsWith('/news') },
                { href: '/jobs', label: 'Scholarships and grants', active: path === '/jobs' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={`https://wa.me/${EDUREACH_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                style={{ color: '#047857' }}
              >
                <MessageCircle size={16} /> Talk to us
              </a>

              {isAuthenticated && (
                <>
                  <p className="hub-mobile-nav-label">Account</p>
                  {[
                    { href: '/dashboard', label: 'Dashboard', active: path === '/dashboard' },
                    { href: '/dashboard/services', label: 'My requests', active: path === '/dashboard/services' },
                    { href: '/profile', label: 'Profile', active: path === '/profile' },
                    { href: '/settings', label: 'Settings', active: path === '/settings' || path === '/dashboard/settings' },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  ))}
                </>
              )}
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
                    style={{ textAlign: 'center', background: 'var(--er-primary)' }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="hub-primary-btn"
                    style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--er-primary)' }}
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

      {/* MOBILE PORTAL NAVIGATION — the five jobs a phone user performs, each
          with an icon and its short label. Everything else lives in the menu. */}
      <nav className="er-mobile-bottom-nav" aria-label="Mobile navigation">
        <a className={path === '/' ? 'active' : ''} aria-current={path === '/' ? 'page' : undefined} href="/"><Home size={18} aria-hidden="true" /><span>Home</span></a>
        <a className={path.startsWith('/cbt') ? 'active' : ''} aria-current={path.startsWith('/cbt') ? 'page' : undefined} href="/cbt"><BookOpenCheck size={18} aria-hidden="true" /><span>Practice</span></a>
        <a className={isAuthenticated && path.startsWith('/dashboard/cbt') && !path.startsWith('/dashboard/cbt/results') ? 'active' : ''} aria-current={isAuthenticated && path.startsWith('/dashboard/cbt') && !path.startsWith('/dashboard/cbt/results') ? 'page' : undefined} href={isAuthenticated ? '/dashboard/cbt' : '/login'}><Laptop size={18} aria-hidden="true" /><span>My CBT</span></a>
        <a className={isAuthenticated && path.startsWith('/dashboard/cbt/results') ? 'active' : ''} aria-current={isAuthenticated && path.startsWith('/dashboard/cbt/results') ? 'page' : undefined} href={isAuthenticated ? '/dashboard/cbt/results' : '/login'}><BarChart3 size={18} aria-hidden="true" /><span>Results</span></a>
        <a className={path === '/profile' || path === '/settings' ? 'active' : ''} aria-current={path === '/profile' || path === '/settings' ? 'page' : undefined} href={isAuthenticated ? '/profile' : '/login'}><User size={18} aria-hidden="true" /><span>Profile</span></a>
      </nav>

      <SiteFooter />
    </div>
  );
}
