import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchServices, type ServiceItem } from '../src/lib/api';

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
    <div className="hub-section-heading hub-page-heading-compact">
      <div><span className="hub-eyebrow">STUDENT SERVICES</span><h1>Services</h1><p>Common student tasks, kept compact and easy to open.</p></div>
      <a className="hub-outline-btn" href="/services/track">Track Request</a>
    </div>

    {loading && <div className="hub-panel hub-empty">Loading services…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !services.length && <div className="hub-panel hub-empty">No student services are available yet.</div>}

    {!loading && !error && <div className="hub-service-catalog-grid hub-service-profile-grid">
      {services.map((service) => (
        <a
          className="hub-service-profile-card hub-service-catalog-card hub-click-card"
          href={'/services/apply/' + service.service_key}
          key={service.id}
        >
          <div className="hub-service-profile-icon"><CardIdentityMark value={service.service_key} type="service" /></div>
          <div className="hub-service-profile-body">
            <div className="hub-service-card-meta"><span>EDUREACH SERVICE</span>{service.application_url && <span>Portal link</span>}</div>
            <h2>{service.title}</h2>
            <p>{service.description}</p>
          </div>
          <ArrowRight size={18} className="hub-compact-arrow" />
        </a>
      ))}
    </div>}
  </div></div></HubLayout>;
}
