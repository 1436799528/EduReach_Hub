import { ArrowRight } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';

export default function JobsPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact">
      <div><span className="hub-eyebrow">OPPORTUNITIES</span><h1>Opportunities</h1></div>
    </div>
    <a className="hub-panel hub-opportunity-card hub-click-card hub-compact-opportunity" href="/news">
      <div className="hub-opportunity-identity"><CardIdentityMark value="jobs" type="content" /></div>
      <div className="hub-opportunity-content">
        <span className="hub-eyebrow">JOBS · INTERNSHIPS · SCHOLARSHIPS</span>
        <h2>No live opportunities have been published yet.</h2>
        <p>Verified student opportunities will appear here when available.</p>
      </div>
      <ArrowRight size={18} className="hub-compact-arrow" />
    </a>
  </div></div></HubLayout>;
}
