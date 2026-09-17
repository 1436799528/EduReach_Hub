import { BriefcaseBusiness, MapPin, ArrowRight } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { jobs } from '../src/data/hubContent';

export default function JobsPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-page-title"><span className="hub-eyebrow">JOBS & OPPORTUNITIES</span><h1>Student-friendly opportunities.</h1><p>Compact listings ready for a future live jobs API.</p></div><div className="hub-job-list">{jobs.map((job) => <article className="hub-job-card" key={job.title}><div className="hub-job-icon"><BriefcaseBusiness size={22}/></div><div className="hub-job-main"><h2>{job.title}</h2><div className="hub-job-meta"><span>{job.type}</span><span><MapPin size={14}/> {job.mode}</span></div><p>{job.note}</p></div><button className="hub-outline-btn">View Opportunity <ArrowRight size={16}/></button></article>)}</div></div></div></HubLayout>;
}
