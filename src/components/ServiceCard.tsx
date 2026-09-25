import { ArrowRight } from 'lucide-react';
import CardIdentityMark, { identityClassFor } from './CardIdentityMark';
import type { ServiceItem } from '../lib/api';

/**
 * Canonical compact service card. The whole card is the link —
 * no redundant APPLY NOW buttons inside cards.
 */
const directDestinations: Record<string, string> = {
  jamb: '/jamb',
  'jamb-cbt': '/cbt',
  'past-questions': '/past-questions',
  waec: '/waec',
  neco: '/neco',
  nabteb: '/nabteb',
  'school-finder': '/schools',
  'admission-requirements': '/admission/requirements',
  'post-utme': '/post-utme',
  scholarships: '/jobs',
  'cgpa-calculator': '/dashboard/tools',
};

export default function ServiceCard({ service }: { service: ServiceItem }) {
  const destination = directDestinations[service.service_key] || `/services/apply/${service.service_key}`;
  return (
    <a className={`er-service-card ${identityClassFor(`${service.service_key} ${service.title}`, 'service')}`} href={destination}>
      <CardIdentityMark value={`${service.service_key} ${service.title}`} type="service" size="md" />
      <span className="er-service-copy">
        <strong>{service.title}</strong>
        <small>{service.description}</small>
        <span className="er-service-meta">
          {service.application_url ? 'Official portal + step-by-step guide' : 'Step-by-step guide + guided support'} <ArrowRight size={11} />
        </span>
      </span>
    </a>
  );
}
