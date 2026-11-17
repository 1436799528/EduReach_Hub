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
import { useMenuDismiss, useMenuKeyboard } from '../lib/menuA11y';
import '../hub-rail.css';

export default function HubLayout({ children, customSearch }: { children: ReactNode; customSearch?: ReactNode }) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  // UX-10: both header menus share one dismissal + keyboard contract, so a
  // pointer that wanders off, an Escape, or a Tab out actually closes them.
  const accountMenuRootRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const moreRootRef = useRef<HTMLDetailsElement>(null);
  const moreTriggerRef = useRef<HTMLElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const closeAccountMenu = () => setProfileOpen(false);
  const closeMoreMenu = () => setMoreOpen(false);
  useMenuDismiss({ open: profileOpen, onClose: closeAccountMenu, rootRef: accountMenuRootRef, triggerRef: accountTriggerRef });
  const accountMenuKeyDown = useMenuKeyboard(accountMenuRef, profileOpen);
  useMenuDismiss({ open: moreOpen, onClose: closeMoreMenu, rootRef: moreRootRef, triggerRef: moreTriggerRef });
  const moreMenuKeyDown = useMenuKeyboard(morePanelRef, moreOpen);
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

  // UX-10: the drawer declares `aria-modal`, so it has to behave like a modal.
  // Focus lands on its close button, Tab and Shift+Tab cycle inside it, the page
  // behind cannot scroll, Escape closes it, and focus returns to the trigger.
  useEffect(() => {
    if (!mobileOpen) return;
    mobileCloseRef.current?.focus();
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const cycleFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        window.setTimeout(() => mobileTriggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = mobileDrawerRef.current;
      if (!drawer) return;
      const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', cycleFocus);
    return () => {
      window.removeEventListener('keydown', cycleFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="hub-shell hub-global-compact" style={{ background: '#f7f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SkipLink />
      {/* APP-3: a strip, never a takeover. The page stays usable offline. */}
      <ConnectionBanner />
      {/* CLEAN MAIN HEADER */}
      <header
        className="hub-header"
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
          className="hub-container hub-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '32px',
            padding: '12px 0',
            minHeight: '64px',
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
            <details
              ref={moreRootRef}
              className="hub-more"
              open={moreOpen}
              onToggle={(event) => setMoreOpen(event.currentTarget.open)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setMoreOpen(false);
                  moreTriggerRef.current?.focus();
                  return;
                }
                if (event.key === 'ArrowDown' && !moreOpen) {
                  event.preventDefault();
                  setMoreOpen(true);
                  return;
                }
                moreMenuKeyDown(event);
              }}
            >
              <summary ref={moreTriggerRef} className="hub-nav-link" aria-label="More" title="More" aria-haspopup="menu" aria-expanded={moreOpen}>
                <MoreHorizontal size={18} aria-hidden="true" />
              </summary>
              <div className="hub-more-panel er-menu" role="menu" aria-label="More destinations" ref={morePanelRef}>
                <a className="er-menu-item" role="menuitem" href="/services"><Briefcase size={15} aria-hidden="true" /> Services</a>
                <a className="er-menu-item" role="menuitem" href="/news"><Newspaper size={15} aria-hidden="true" /> News</a>
                <a className="er-menu-item" role="menuitem" href="/jobs"><GraduationCap size={15} aria-hidden="true" /> Scholarships</a>
                <a className="er-menu-item" role="menuitem" href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} aria-hidden="true" /> Talk to us</a>
              </div>
            </details>
          </nav>

          {customSearch !== undefined ? customSearch : <SiteSearch variant="header" label="Site search" placeholder="Search EduReach" />}

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
              <div
                ref={accountMenuRootRef}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <button
                  type="button"
                  ref={accountTriggerRef}
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-controls={profileOpen ? 'hub-profile-menu' : undefined}
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
                    ref={accountMenuRef}
                    role="menu"
                    aria-label="Account"
                    className="er-menu"
                    onKeyDown={accountMenuKeyDown}
                    style={{ position: 'absolute', top: '42px', right: 0, zIndex: 200 }}
                  >
                    <div className="er-menu-head">
                      <strong>{user?.name}</strong>
                      <span>{user?.email}</span>
                    </div>
                    <a className="er-menu-item" role="menuitem" href="/dashboard">
                      <LayoutDashboard size={14} aria-hidden="true" /> Dashboard
                    </a>
                    <a className="er-menu-item" role="menuitem" href="/profile">
                      <User size={14} aria-hidden="true" /> Profile
                    </a>
                    <a className="er-menu-item" role="menuitem" href="/dashboard/services">
                      <ScanSearch size={14} aria-hidden="true" /> My requests
                    </a>
                    <a className="er-menu-item" role="menuitem" href="/dashboard/cbt">
                      <Laptop size={14} aria-hidden="true" /> My CBT
                    </a>
                    <a className="er-menu-item" role="menuitem" href="/settings">
                      <Settings size={14} aria-hidden="true" /> Settings
                    </a>
                    <div className="er-menu-separator" role="presentation" />
                    <button
                      type="button"
                      role="menuitem"
                      className="er-menu-item is-danger"
                      onClick={handleLogout}
                    >
                      <LogOut size={14} aria-hidden="true" /> Log out
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
            ref={mobileDrawerRef}
            style={{
              width: '280px',
              maxWidth: '86vw',
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
