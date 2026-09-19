import type { ReactNode } from 'react';
import { useState } from 'react';
import { Menu, X, Home, BrainCircuit, Zap, ScanSearch, MessageCircle, Search } from 'lucide-react';
import HubSideRail from './HubSideRail';
import '../hub-rail.css';

export default function HubLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const showRail = path === '/services'
    || path.startsWith('/services/apply/')
    || path === '/services/track'
    || path === '/news'
    || path.startsWith('/news/')
    || path === '/jobs'
    || path === '/cbt'
    || path === '/cbt/results';

  return (
    <div className="hub-shell hub-global-compact">
      <header className="hub-header">
        <div className="hub-container hub-main-nav">
          <button type="button" className="hub-mobile-trigger" aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="hub-mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <a className="hub-logo" href="/">EduReach<span>.ng</span></a>
          <nav className="hub-nav hub-nav-desktop" aria-label="Primary navigation">
            <a href="/">Home</a>
            <a href="/services">Services</a>
            <a href="/services">Admission</a>
            <a href="/cbt">CBT</a>
            <a href="/news">News</a>
            <a href="/screening-calculator">Tools</a>
          </nav>
          <label className="hub-search hub-search-desktop"><Search size={17} /><input placeholder="Search EduReach..." aria-label="Search EduReach" /></label>
          <div className="hub-account-actions"><a className="hub-ghost-btn" href="/login">Login</a><a className="hub-primary-btn" href="/register">Sign Up</a></div>
        </div>
      </header>

      {mobileOpen && (
        <div id="hub-mobile-menu" className="hub-mobile-panel">
          <div className="hub-mobile-panel-head"><strong>EduReach.ng</strong><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={22} /></button></div>
          <nav className="hub-mobile-links">
            <a href="/" onClick={() => setMobileOpen(false)}>Home</a>
            <a href="/services" onClick={() => setMobileOpen(false)}>Services</a>
            <a href="/services" onClick={() => setMobileOpen(false)}>Admission</a>
            <a href="/cbt" onClick={() => setMobileOpen(false)}>CBT</a>
            <a href="/news" onClick={() => setMobileOpen(false)}>News</a>
            <a href="/screening-calculator" onClick={() => setMobileOpen(false)}>Tools</a>
          </nav>
          <div className="hub-mobile-auth"><a className="hub-ghost-btn" href="/login">Login</a><a className="hub-primary-btn" href="/register">Sign Up</a></div>
        </div>
      )}

      <main>{showRail ? <div className="hub-layout-with-rail"><div className="hub-layout-content">{children}</div><HubSideRail /></div> : children}</main>

      <nav className="hub-mobile-bottom" aria-label="Mobile navigation">
        <a href="/"><Home size={18} /><span>Home</span></a>
        <a href="/cbt"><BrainCircuit size={18} /><span>CBT</span></a>
        <a href="/services"><Zap size={18} /><span>Services</span></a>
        <a href="/services/track"><ScanSearch size={18} /><span>Track</span></a>
        <a href="/news"><MessageCircle size={18} /><span>News</span></a>
      </nav>

      <footer className="hub-footer">
        <div className="hub-container hub-footer-grid">
          <div><div className="hub-logo hub-logo-footer">EduReach<span>.ng</span></div><p>Student services, academic updates and opportunities.</p></div>
          <div><h4>Quick Links</h4><a href="/">Home</a><a href="/services">Services</a><a href="/cbt">CBT</a><a href="/news">News</a></div>
          <div><h4>Student Help</h4><a href="/services/track">Track Application</a><a href="/services">Admission & Services</a><a href="/news">Academic Updates</a></div>
          <div><h4>Account</h4><a href="/login">Login</a><a href="/register">Create Account</a><a href="/dashboard">My Dashboard</a></div>
        </div>
        <div className="hub-footer-bottom">© {new Date().getFullYear()} EduReach.ng.</div>
      </footer>
    </div>
  );
}
