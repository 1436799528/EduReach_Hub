import { Bell, BookOpen, FileText, GraduationCap, LogOut, Newspaper, ArrowRight } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { hubServices } from '../src/data/hubContent';

const demoRequests = [
  { service: 'NELFUND Loan Application', status: 'processing', ref: 'DEMO-NLF-2026-001', date: '15 Sep 2026' },
  { service: 'WAEC / NECO Result Checking', status: 'completed', ref: 'DEMO-RES-2026-002', date: '12 Sep 2026' },
  { service: 'JAMB Exam Slip Printing', status: 'submitted', ref: 'DEMO-JAMB-2026-003', date: '10 Sep 2026' },
];

export default function DemoDashboardPage() {
  function exitDemo() {
    sessionStorage.removeItem('edureach_demo_mode');
    window.location.href = '/';
  }

  return (
    <HubLayout>
      <section className="hub-page">
        <div className="hub-container">
          <div className="hub-demo-dashboard-hero">
            <div>
              <span className="hub-eyebrow">DEMO STUDENT ACCOUNT</span>
              <h1>Welcome to the EduReach student workspace.</h1>
              <p>This is a safe sample account. The information below is demo data so you can test the navigation, services, tracking flow and student dashboard.</p>
            </div>
            <button className="hub-outline-btn" type="button" onClick={exitDemo}><LogOut size={16} /> Exit Demo</button>
          </div>

          <div className="hub-demo-note"><Bell size={17} /><span><strong>Demo mode is active.</strong> No real student record, payment or service request is being submitted from this preview.</span></div>

          <div className="hub-demo-grid">
            <div className="hub-demo-main">
              <div className="hub-panel">
                <div className="hub-section-head"><div><span className="hub-eyebrow">STUDENT PROFILE</span><h2>EduReach Demo Student</h2></div><span className="hub-badge">300L</span></div>
                <div className="hub-profile-grid">
                  <div><span>Institution</span><strong>University Demo Campus</strong></div>
                  <div><span>Faculty</span><strong>Faculty of Engineering</strong></div>
                  <div><span>Department</span><strong>Electrical Engineering</strong></div>
                  <div><span>Email</span><strong>demo@edureach.ng</strong></div>
                </div>
              </div>

              <div className="hub-panel">
                <div className="hub-section-head"><div><span className="hub-eyebrow">SERVICE ACTIVITY</span><h2>Recent requests</h2></div><a href="/services/track" className="hub-text-link">Track requests <ArrowRight size={15} /></a></div>
                <div className="hub-demo-request-list">
                  {demoRequests.map((request) => <div className="hub-demo-request" key={request.ref}><div><span className="hub-badge soft">{request.status}</span><h3>{request.service}</h3><small>{request.ref} · {request.date}</small></div><FileText size={20} /></div>)}
                </div>
              </div>
            </div>

            <aside className="hub-demo-side">
              <div className="hub-panel"><div className="hub-section-head"><div><span className="hub-eyebrow">QUICK SERVICES</span><h2>Explore the five services</h2></div></div><div className="hub-demo-service-list">{hubServices.map((service) => <a key={service.slug} href={`/services/${service.slug}`}><span><FileText size={17} /><span><strong>{service.title}</strong><small>{service.price}</small></span></span><ArrowRight size={15} /></a>)}</div></div>
              <div className="hub-panel"><span className="hub-eyebrow">STUDENT NEWS</span><h2>Quick links</h2><div className="hub-demo-links"><a href="/news"><Newspaper size={17} /> News & updates</a><a href="/cbt"><BookOpen size={17} /> CBT practice</a><a href="/jobs"><GraduationCap size={17} /> Jobs & opportunities</a></div></div>
            </aside>
          </div>
        </div>
      </section>
    </HubLayout>
  );
}
