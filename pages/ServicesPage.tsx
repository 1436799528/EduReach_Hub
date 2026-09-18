import { services } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

export default function ServicesPage() {
  return (
    <Shell title="Our Services">
      <section className="cat_area section-padding service-overview-area">
        <div className="container">
          <div className="section-title text-center">
            <h2>Student Services</h2>
            <p>Practical support for important academic and admission-related tasks.</p>
          </div>

          <div className="service-card-grid" aria-label="EduReach student services">
            {services.map((service) => (
              <a className="service-compact-card" href={'/services/' + service.id} key={service.id}>
                <span className="service-compact-card__mark" aria-hidden="true">
                  <span className={service.icon + ' service-compact-card__icon'} />
                </span>

                <span className="service-compact-card__body">
                  <strong>{service.title}</strong>
                  <span>{service.description}</span>
                </span>

                <span className="service-compact-card__arrow" aria-hidden="true">
                  <i className="fa fa-angle-right" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="top_cat__area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>How To Use EduReach</h2>
            <p>Choose a service, check the guidance, then send a support request when you need assistance.</p>
          </div>

          <div className="row">
            {[
              ['01', 'Choose Your Service', 'Open the service that matches the task you need to complete.'],
              ['02', 'Check The Details', 'Review the steps and information you may need before you begin.'],
              ['03', 'Send A Request', 'Use the support form on the service page when you need help.'],
              ['04', 'Stay Secure', 'Never submit passwords, OTPs, card PINs or other secret credentials.'],
            ].map(([number, title, text]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={number}>
                <div className="single_tp">
                  <span className="sc_one">{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
