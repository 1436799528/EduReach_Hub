import { services } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

const bannerTone: Record<string, string> = {
  'nelfund-loan': 'deep-blue',
  results: 'emerald',
  'scratch-cards': 'deep-blue',
  'jamb-slip': 'emerald',
  'admission-letters': 'deep-blue',
};

export default function ServicesPage() {
  return (
    <Shell title="Services">
      <section className="cat_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>Services</h2><p>Choose a service and take the next step.</p></div>
        <div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}>
          <article className="app-card service-app-card">
            <div className={`app-card-banner ${bannerTone[service.id]}`}><span>{service.shortTitle}</span><span className="app-status">Active</span></div>
            <div className="app-card-body"><h3>{service.title}</h3><p>{service.description}</p><a href={`/services/${service.id}`} className="app-card-action">{service.cta}</a></div>
          </article>
        </div>)}</div>
      </div></section>

      <section className="community-bar-area section-padding"><div className="container"><div className="community-bar">
        <div><strong>Stay connected</strong><span>Get fast student alerts and useful updates.</span></div>
        <div className="community-links"><a href="#" className="community-link telegram"><span>Telegram</span><strong>Join Channel</strong></a><a href="#" className="community-link whatsapp"><span>WhatsApp</span><strong>Join Group</strong></a><a href="#" className="community-link youtube"><span>YouTube / X</span><strong>Follow Us</strong></a></div>
      </div></div></section>
    </Shell>
  );
}
