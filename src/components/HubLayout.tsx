import type { ReactNode } from 'react';
import { useState } from 'react';
import { Search, Menu, X, Bell, Home, BrainCircuit, Zap, ScanSearch, MessageCircle } from 'lucide-react';

export default function HubLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="hub-shell">
      <header className="hub-header">
        <div className="hub-container hub-main-nav">
          <button className="hub-mobile-trigger" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <a className="hub-logo" href="/">EduReach<span>.ng</span></a>
          <nav className="hub-nav hub-nav-desktop" aria-label="Primary navigation">
            <a href="/">Home</a>
            <a href="/cbt">CBT</a>
            <a href="/services">Services</a>
            <a href="/news">News</a>
            <a href="/jobs">Jobs</a>
          </nav>
          <label className="hub-search hub-search-desktop"><Search size={17} /><input placeholder="Search student services..." aria-label="Search student services" /></label>
          <div className="hub-account-actions"><a className="hub-ghost-btn" href="/login">Sign In</a><a className="hub-primary-btn" href="/register">Sign Up</a><button className="hub-icon-btn" aria-label="Notifications"><Bell size={18} /></button></div>
        </div>
      </header>

      {mobileOpen && <div className="hub-mobile-panel"><div className="hub-mobile-panel-head"><strong>EduReach.ng</strong><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={22} /></button></div><nav className="hub-mobile-links"><a href="/">Home</a><a href="/cbt">CBT</a><a href="/services">Services</a><a href="/news">News</a><a href="/jobs">Jobs</a></nav><div className="hub-mobile-auth"><a className="hub-ghost-btn" href="/login">Sign In</a><a className="hub-primary-btn" href="/register">Sign Up</a></div></div>}

      <main>{children}</main>

      <nav className="hub-mobile-bottom" aria-label="Mobile navigation"><a href="/"><Home size={18} /><span>Home</span></a><a href="/cbt"><BrainCircuit size={18} /><span>CBT</span></a><a href="/services"><Zap size={18} /><span>Services</span></a><a href="/services/track"><ScanSearch size={18} /><span>Track</span></a><a href="#channels"><MessageCircle size={18} /><span>Channel</span></a></nav>

      <footer className="hub-footer"><div className="hub-container hub-footer-grid"><div><div className="hub-logo hub-logo-footer">EduReach<span>.ng</span></div><p>Student services, academic updates and opportunities.</p></div><div><h4>Quick Links</h4><a href="/">Home</a><a href="/cbt">CBT</a><a href="/services">Services</a><a href="/news">News</a></div><div><h4>Student Help</h4><a href="/services/track">Track Application</a><a href="/services">Service Support</a><a href="/news">Academic Updates</a></div><div id="channels"><h4>Channels</h4><p>Get EduReach updates directly.</p><button className="hub-primary-btn">Join Channel</button></div></div><div className="hub-footer-bottom">© {new Date().getFullYear()} EduReach.ng.</div></footer>
    </div>
  );
}
