import type { ReactNode } from 'react';
import { useState } from 'react';
import { Search, Menu, X, Bell, ChevronDown, Home, BrainCircuit, Zap, ScanSearch, MessageCircle } from 'lucide-react';
import AuthModal from './AuthModal';

export default function HubLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);

  return (
    <div className="hub-shell">
      <div className="hub-utility">
        <div className="hub-container hub-row hub-utility-row">
          <div className="hub-utility-copy">EduReach Hub — practical student services and academic updates.</div>
          <div className="hub-utility-links"><a href="/services/track">Track Order</a><a href="#channels">Join WhatsApp Channel</a></div>
        </div>
      </div>

      <header className="hub-header">
        <div className="hub-container hub-main-nav">
          <button className="hub-mobile-trigger" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <a className="hub-logo" href="/">EduReach<span>.ng</span></a>
          <nav className="hub-nav hub-nav-desktop" aria-label="Primary navigation"><a href="/cbt">CBT</a><a href="/services">Services</a><a href="/news">News</a><a href="/jobs">Jobs</a></nav>
          <label className="hub-search hub-search-desktop"><Search size={17} /><input placeholder="Search student services..." aria-label="Search student services" /></label>
          <div className="hub-account-actions"><button className="hub-ghost-btn" onClick={() => setAuthMode('signin')}>Sign In</button><button className="hub-primary-btn" onClick={() => setAuthMode('signup')}>Sign Up</button><button className="hub-icon-btn" aria-label="Notifications"><Bell size={18} /></button></div>
        </div>
      </header>

      {mobileOpen && <div className="hub-mobile-panel"><div className="hub-mobile-panel-head"><strong>EduReach.ng</strong><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={22} /></button></div><nav className="hub-mobile-links"><a href="/">Home <ChevronDown size={15} /></a><a href="/cbt">CBT <ChevronDown size={15} /></a><a href="/services">Services <ChevronDown size={15} /></a><a href="/news">News <ChevronDown size={15} /></a><a href="/jobs">Jobs <ChevronDown size={15} /></a></nav><div className="hub-mobile-auth"><button className="hub-ghost-btn" onClick={() => { setMobileOpen(false); setAuthMode('signin'); }}>Sign In</button><button className="hub-primary-btn" onClick={() => { setMobileOpen(false); setAuthMode('signup'); }}>Sign Up</button></div></div>}

      <main>{children}</main>

      <nav className="hub-mobile-bottom" aria-label="Mobile navigation"><a href="/"><Home size={18} /><span>Home</span></a><a href="/cbt"><BrainCircuit size={18} /><span>CBT</span></a><a href="/services"><Zap size={18} /><span>Services</span></a><a href="/services/track"><ScanSearch size={18} /><span>Track</span></a><a href="#channels"><MessageCircle size={18} /><span>Channel</span></a></nav>

      <footer className="hub-footer"><div className="hub-container hub-footer-grid"><div><div className="hub-logo hub-logo-footer">EduReach<span>.ng</span></div><p>Student-first tools for exams, services, academic updates and opportunities.</p></div><div><h4>Quick Links</h4><a href="/cbt">CBT Practice</a><a href="/services">Services</a><a href="/news">News</a><a href="/jobs">Jobs</a></div><div><h4>Student Help</h4><a href="/services/track">Track Application</a><a href="/services">Order Support</a><a href="/news">Academic Updates</a></div><div id="channels"><h4>Channels</h4><p>Official WhatsApp and Telegram updates will be listed here.</p><button className="hub-primary-btn">Join Channel</button></div></div><div className="hub-footer-bottom">© {new Date().getFullYear()} EduReach.ng. Student support platform.</div></footer>

      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  );
}
