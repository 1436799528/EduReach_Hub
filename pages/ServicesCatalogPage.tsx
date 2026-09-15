import { ArrowRight, BadgeNaira, FileText, GraduationCap, KeyRound, Printer } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { hubServices } from '../src/data/hubContent';

const icons = { 'nelfund-loan': BadgeNaira, 'jamb-caps-regularization': GraduationCap, 'waec-neco-pin': KeyRound, 'jamb-slip': Printer, 'admission-letters': FileText } as const;

export default function ServicesCatalogPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container">
    <div className="hub-page-title"><span className="hub-eyebrow">STUDENT SERVICES</span><h1>Get the help you need without the clutter.</h1><p>Pick a service, complete the short request wizard and keep your reference code for tracking.</p></div>
    <div className="hub-service-catalog-grid">{hubServices.map((service) => { const Icon = icons[service.slug as keyof typeof icons] || FileText; return <article className={`hub-service-large hub-tone-${service.tone}`} key={service.slug}><div className="hub-service-large-top"><div className="hub-service-icon"><Icon size={22}/></div><span className="hub-tag">{service.short}</span></div><h2>{service.title}</h2><p>{service.description}</p><div className="hub-service-large-footer"><span>{service.price}</span><a href={`/services/apply/${service.slug}`} className="hub-primary-btn">{service.action} <ArrowRight size={16}/></a></div></article>; })}</div>
  </div></div></HubLayout>;
}
