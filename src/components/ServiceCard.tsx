import { ArrowRight } from 'lucide-react';
import CardIdentityMark from './CardIdentityMark';
import type { ServiceItem } from '../lib/api';

/**
 * Canonical compact service card. The whole card is the link —
 * no redundant APPLY NOW buttons inside cards.
 */
export default function ServiceCard({ service }: { service: ServiceItem }) {
  return (
    <a className="er-service-card" href={`/services/apply/${service.service_key}`}>
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
