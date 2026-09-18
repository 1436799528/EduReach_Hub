import { ArrowRight, CircleDollarSign, FileText, KeyRound, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchServices, type ServiceItem } from '../src/lib/api';

const icons = { 'nelfund-loan': CircleDollarSign, results: FileText, 'scratch-cards': KeyRound, 'jamb-slip': Printer, 'admission-letters': FileText } as const;
const tones = ['blue', 'green', 'amber'] as const;

export default function ServicesCatalogPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchServices()
      .then(setServices)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load services.'))
      .finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container">
    <div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">STUDENT SERVICES</span><h1>Services</h1></div><a className="hub-outline-btn" href="/news">Campus Updates</a></div>
    {loading && <div className="hub-panel hub-empty">Loading services…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !services.length && <div className="hub-panel hub-empty">No student services are available yet.</div>}
    {!loading && !error && <div className="hub-service-catalog-grid hub-service-profile-grid">{services.map((service, index) => {
      const Icon = icons[service.service_key as keyof typeof icons] || FileText;
      const tone = tones[index % tones.length];
      return <article className={`hub-service-profile-card hub-tone-${tone}`} key={service.id}>
        <div className="hub-service-banner"><span>{service.title}</span><strong>0{index + 1}</strong></div>
        <div className="hub-service-profile-avatar"><Icon size={26}/></div>
        <div className="hub-service-profile-body"><div className="hub-service-card-meta"><span>EduReach Service</span>{service.application_url && <span>Official portal available</span>}</div><h2>{service.title}</h2><p>{service.description}</p><div className="hub-service-profile-footer"><span className="hub-service-card-caption">{service.application_url ? 'Official link' : 'Request support'}</span><a href={`/services/apply/${service.service_key}`} className="hub-primary-btn">{service.application_url ? 'Open / Request' : 'Start Request'} <ArrowRight size={16} /></a></div></div>
      </article>;
    })}</div>}
  </div></div></HubLayout>;
}
