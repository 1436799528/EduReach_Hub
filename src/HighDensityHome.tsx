import { useMemo, useState } from 'react';
import { ArrowRight, Bell, BookOpen, BriefcaseBusiness, FileText, GraduationCap, Menu, Newspaper, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { cbtQuestions } from './data/cbtQuestions';
import { supabase } from './lib/supabase';

const services = [
  ['nelfund-loan','NELFUND Loan Assistance','Funding','Apply Now','Assistance Service','bg-blue'],
  ['results','WAEC / NECO Result Checking','Results','Check Result','Verified Service','bg-emerald'],
  ['scratch-cards','WAEC / NECO Scratch Cards','Cards','Buy Card','Verified Service','bg-blue'],
  ['jamb-slip','JAMB Exam Slip Printing','JAMB','Print Slip','Verified Service','bg-emerald'],
  ['admission-letters','Admission Deferment & Supplementary Letters','Admissions','Start Request','Verified Service','bg-blue'],
] as const;

const updates = [
  {category:'JAMB Update', title:'JAMB candidate guidance and examination-document updates', href:'/news/jamb-update'},
  {category:'NELFUND', title:'Student funding information and application guidance', href:'/news/funding-alerts'},
  {category:'Admissions', title:'Admission, supplementary and deferment updates', href:'/news/admission-watch'},
];

const quickLinks = [
  ['JAMB CAPS','/news/jamb-update'],
  ['NELFUND Status','/services/nelfund-loan'],
  ['WAEC / NECO Cards','/services/scratch-cards'],
  ['JAMB Exam Slip','/services/jamb-slip'],
  ['Admission Letters','/services/admission-letters'],
];

const go = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export default function HighDensityHome() {
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const searchText = query.trim().toLowerCase();
  const results = useMemo(() => {
    const serviceResults = services.map(([id,title,group]) => ({ type:'Service', title, meta:group, href:`/services/${id}` }));
    const cbtResults = cbtQuestions.slice(0, 12).map((item) => ({ type:'CBT', title:item.question, meta:item.subject, href:'/cbt' }));
    return [...serviceResults, ...cbtResults].filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(searchText)).slice(0, 6);
  }, [searchText]);

  return <div className="portal-home-shell">
    <header className="portal-header">
      <div className="portal-top-strip">
        <div className="portal-max portal-strip-inner">
          <span>EduReach Hub • Instant Campus &amp; Exam Portal</span>
          <div className="portal-strip-links">
            <a href="/news/jamb-update">JAMB CAPS</a>
            <a href="/services/nelfund-loan">NELFUND Status</a>
            <a href="/services/scratch-cards">WAEC/NECO Cards</a>
            <a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="whatsapp-text">Join WhatsApp</a>
          </div>
        </div>
      </div>

      <div className="portal-main-header">
        <div className="portal-max portal-header-inner">
          <button className="portal-brand" onClick={() => go('/')} aria-label="EduReach Hub home">
            <span className="portal-brand-mark">ER</span>
            <span>EduReach<b>.Hub</b></span>
          </button>
          <div className="portal-search-wrap">
            <Search size={16} className="portal-search-icon" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search past questions, news or services..." aria-label="Search EduReach" />
            {query && <div className="portal-search-menu">
              {results.map((item) => <button key={`${item.type}-${item.title}`} onClick={() => go(item.href)}><span><small>{item.type}</small>{item.title}</span><ArrowRight size={14} /></button>)}
              {!results.length && <span className="portal-no-results">No matching service or question found.</span>}
            </div>}
          </div>
          <nav className="portal-header-nav">
            <button onClick={() => go('/cbt')}>CBT</button>
            <button onClick={() => go('/services')}>Services</button>
            <button onClick={() => go('/news')}>News</button>
            <button onClick={() => go('/opportunities')}>Jobs</button>
          </nav>
          <div className="portal-auth-actions">
            <button className="portal-account" onClick={() => go('/dashboard/profile')}>My Account</button>
            <button className="portal-signin" onClick={() => go('/login')}>Sign In</button>
          </div>
          <button className="portal-menu-btn" onClick={() => setMenu((value) => !value)} aria-label="Open menu">{menu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {menu && <div className="portal-mobile-nav portal-max"><button onClick={() => go('/cbt')}>CBT Practice</button><button onClick={() => go('/services')}>Services</button><button onClick={() => go('/news')}>News</button><button onClick={() => go('/opportunities')}>Jobs</button><button onClick={() => go('/dashboard/profile')}>My Account</button></div>}
      </div>
    </header>

    <main className="portal-page">
      <div className="portal-max portal-grid">
        <section className="portal-main-column">
          <section className="portal-hero">
            <div className="portal-hero-copy">
              <div className="portal-kicker"><span>EDUREACH HUB</span><strong>Student Support Portal</strong></div>
              <h1>Everything students need, closer and easier.</h1>
              <p>Access CBT practice, digital student services, education news, scholarships, jobs and campus updates from one focused portal.</p>
              <div className="portal-hero-actions"><button className="portal-primary-btn" onClick={() => go('/services')}>Explore Services <ArrowRight size={15} /></button><button className="portal-secondary-btn" onClick={() => go('/cbt')}>Start CBT <BookOpen size={15} /></button></div>
            </div>
            <div className="portal-hero-quick">
              <span className="portal-widget-label">Quick Access</span>
              <button onClick={() => go('/services/nelfund-loan')}><b>NELFUND Assistance</b><small>Funding guidance &amp; application help</small></button>
              <button onClick={() => go('/services/jamb-slip')}><b>JAMB Exam Slip</b><small>Printing and document support</small></button>
              <button onClick={() => go('/services/results')}><b>WAEC / NECO Results</b><small>Result-checking guidance</small></button>
            </div>
          </section>

          <div id="channel" className="portal-channel-strip">
            <div><strong>Join EduReach Official Channels</strong><span>Get JAMB, NELFUND, admission and campus alerts directly on your phone.</span></div>
            <div className="portal-channel-actions"><a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="portal-channel whatsapp"><span>WhatsApp</span><b>Join Channel</b></a><a href="https://telegram.org" target="_blank" rel="noreferrer" className="portal-channel telegram"><span>Telegram</span><b>Join Channel</b></a></div>
          </div>

          <section className="portal-section">
            <div className="portal-section-head"><div><span>Featured</span><h2>Quick Student Actions</h2></div><button onClick={() => go('/services')}>View all <ArrowRight size={14} /></button></div>
            <div className="portal-card-grid">{services.slice(0,4).map(([id,title,group,action,badge,tone]) => <article className={`portal-action-card ${tone}`} key={id}><div className={`portal-card-strip ${tone}`}><b>{group === 'Funding' ? 'Assistance Service' : group === 'JAMB' ? 'JAMB Exam' : group}</b><span>{badge}</span></div><div className="portal-card-content"><h3>{title}</h3><p>{group === 'Funding' ? 'Verification and application support for student funding requests.' : group === 'JAMB' ? 'Locate, confirm and print your examination document.' : `Guided support for ${title.toLowerCase()}.`}</p><button onClick={() => go(`/services/${id}`)}>{action}</button></div></article>)}</div>
          </section>

          <section className="portal-section">
            <div className="portal-section-head"><div><span>CBT / EXAM PRACTICE</span><h2>Practice &amp; Performance</h2></div><button onClick={() => go('/cbt')}>Open CBT <ArrowRight size={14} /></button></div>
            <div className="portal-practice-grid"><article className="portal-action-card bg-blue"><div className="portal-card-strip bg-blue"><b>JAMB UTME</b><span>Free Practice</span></div><div className="portal-card-content"><h3>UTME Practice Engine</h3><p>Timed questions with instant subject performance scoring.</p><button onClick={() => go('/cbt')}>Start Test</button></div></article><article className="portal-action-card bg-emerald"><div className="portal-card-strip bg-emerald"><b>POST-UTME</b><span>Practice</span></div><div className="portal-card-content"><h3>Past Question Practice</h3><p>Build speed and confidence with focused exam-style practice.</p><button onClick={() => go('/cbt/post-utme')}>Start Practice</button></div></article></div>
          </section>

          <section className="portal-section">
            <div className="portal-section-head"><div><span>OPPORTUNITIES</span><h2>Scholarships &amp; Jobs</h2></div><button onClick={() => go('/opportunities')}>View board <ArrowRight size={14} /></button></div>
            <div className="portal-opportunity-grid"><article className="portal-action-card bg-emerald"><div className="portal-card-strip bg-emerald"><b>Scholarship</b><span>Verified Opportunity</span></div><div className="portal-card-content"><h3>Undergraduate Scholarship Board</h3><p>Find funding opportunities and check the official application route.</p><button onClick={() => go('/opportunities/undergraduate-scholarships')}>View Opportunity</button></div></article><article className="portal-action-card bg-blue"><div className="portal-card-strip bg-blue"><b>Jobs</b><span>Verified Opportunity</span></div><div className="portal-card-content"><h3>Entry-Level Opportunities</h3><p>Starter jobs, internships and graduate opportunities for students.</p><button onClick={() => go('/opportunities/graduate-opportunities')}>View Opportunity</button></div></article></div>
          </section>
        </section>

        <aside className="portal-sidebar-column">
          <section className="portal-sidebar-widget"><div className="portal-widget-head"><h3>Latest Updates</h3><button onClick={() => go('/news')}>All News</button></div><div className="portal-update-list">{updates.map((item) => <button key={item.title} onClick={() => go(item.href)}><span>{item.category}</span><b>{item.title}</b><ArrowRight size={14} /></button>)}</div></section>
          <section className="portal-sidebar-widget"><div className="portal-widget-head"><h3>Quick Links</h3></div><div className="portal-quick-links">{quickLinks.map(([label,href]) => <button key={label} onClick={() => go(href)}>{label}<ArrowRight size={14} /></button>)}</div></section>
          <section className="portal-sidebar-widget portal-trust-widget"><div className="portal-widget-head"><h3>Verified-first</h3><ShieldCheck size={17} /></div><p>EduReach keeps service labels, official links and verification states visible so students know the next step.</p><button className="portal-secondary-btn full" onClick={() => go('/about')}>How EduReach verifies</button></section>
          <section className="portal-sidebar-widget portal-community-widget"><div className="portal-widget-head"><h3>Join Community</h3><Users size={17} /></div><p>Follow the channel and stay ahead of major academic alerts.</p><div className="portal-community-buttons"><a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="portal-channel whatsapp"><span>WhatsApp</span><b>Join Channel</b></a><a href="https://telegram.org" target="_blank" rel="noreferrer" className="portal-channel telegram"><span>Telegram</span><b>Join Channel</b></a></div></section>
        </aside>
      </div>
    </main>

    <footer className="portal-footer"><div className="portal-max"><div><strong>EduReach Hub</strong><p>Student services, CBT practice, education news, opportunities and campus support in one place.</p></div><div><span>Platform</span><button onClick={() => go('/services')}>Services</button><button onClick={() => go('/news')}>News</button><button onClick={() => go('/opportunities')}>Jobs</button></div><div><span>Account</span><button onClick={() => go('/login')}>Sign In</button><button onClick={() => go('/register')}>Register</button><button onClick={() => go('/dashboard')}>Dashboard</button></div></div></footer>
  </div>;
}
