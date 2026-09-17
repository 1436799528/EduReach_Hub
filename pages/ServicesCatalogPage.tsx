import { ArrowRight, CircleDollarSign, FileText, KeyRound, Printer } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { hubServices } from '../src/data/hubContent';

const icons = { 'nelfund-loan': CircleDollarSign, results: FileText, 'scratch-cards': KeyRound, 'jamb-slip': Printer, 'admission-letters': FileText } as const;

export default function ServicesCatalogPage() {
  return <HubLayout><div className="hub-page"><div className="hub-container">
    <div className="hub-page-title"><span className="hub-eyebrow">STUDENT SERVICES</span><h1>Get the help you need without the clutter.</h1><p>Pick a service, complete the short request wizard and keep your reference code for tracking.</p></div>
    <div className="hub-service-catalog-grid hub-service-profile-grid">{hubServices.map((service, index) => {
      const Icon = icons[service.slug as keyof typeof icons] || FileText;
      return <article className={`hub-service-profile-card hub-tone-${service.tone}`} key={service.slug}>
        <div className="hub-service-banner">
          <span>{service.short}</span>
          <strong>0{index + 1}</strong>
        </div>
        <div className="hub-service-profile-avatar"><Icon size={26}/></div>
        <div className="hub-service-profile-body">
          <div className="hub-service-card-meta"><span>EduReach Service</span><span>{service.price}</span></div>
          <h2>{service.title}</h2>
          <p>{service.description}</p>
          <div className="hub-service-profile-footer">
            <span className="hub-service-card-caption">Student support</span>
            <a href={`/services/apply/${service.slug}`} className="hub-primary-btn">{service.action} <ArrowRight size={16} /></a>
          </div>
        </div>
      </article>;
    })}</div>
  </div></div></HubLayout>;
}
