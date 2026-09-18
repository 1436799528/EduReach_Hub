import { ArrowRight } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { serviceCardImage } from '../src/lib/cardTheme';

export default function JobsPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">OPPORTUNITIES</span><h1>Opportunities</h1></div></div><div className="hub-panel hub-opportunity-card"><img className="hub-service-image hub-opportunity-image" src={serviceCardImage('jobs')} alt="Student opportunities" loading="lazy" /><div className="hub-opportunity-content"><span className="hub-eyebrow">OPPORTUNITIES</span><h2>No live opportunities have been published yet.</h2><p>When verified jobs, internships and scholarships are available, they will appear here.</p><a href="/news" className="hub-outline-btn">Check Updates <ArrowRight size={15}/></a></div></div></div></div></HubLayout>;
}
